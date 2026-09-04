/**
 * Samples, boxes and the crossing between CM and the testing wings — the
 * server half (D9). `codes.ts` and `plan.ts` are the Prisma-free halves.
 *
 * The chain this file implements:
 *
 *   resolveDestinations   the routing map says which labs test what
 *   buildPlanFor          the grid the FDO fills in, pre-filled where a lab
 *                         has told us before
 *   setRequirement        his number, remembered for next time
 *   commitSampling        one transaction: test orders, specimens, boxes
 *   submitConsignment     the applicant hands a box in at that office's counter
 *   openConsignment       the lab opens it and checks the seal
 */
import { prisma } from "@/lib/prisma";
import {
  buildPlan,
  cellKey,
  planProblems,
  type PlanSubProduct,
  type SamplePlan,
} from "./plan";
import {
  newRef,
  newCmCode,
  newLabCode,
  newConsignmentCode,
  newTestOrderCode,
} from "./codes";

/**
 * Which lab runs each of a sub-product's parameters, for an application
 * received at a given office.
 *
 * Reads `LabRouting`, which is the office × parameter map each office
 * maintains. **A routing row that names a lab without the matching capability
 * is refused, not followed** (D64) — that is the entire reason capability and
 * routing are separate tables, and following it would send a sample to a lab
 * that cannot run the test.
 */
export async function resolveDestinations(officeId: number, subProductId: number) {
  const rows = await prisma.labRouting.findMany({
    where: { officeId, parameter: { subProductId } },
    select: {
      labId: true,
      isPlaceholder: true,
      parameter: { select: { id: true, nameEn: true, discipline: true } },
      lab: { select: { id: true, nameEn: true, discipline: true, officeId: true } },
    },
  });

  const capable = new Set(
    (
      await prisma.labCapability.findMany({
        where: { isActive: true, parameter: { subProductId } },
        select: { labId: true, parameterId: true },
      })
    ).map((c) => `${c.labId}:${c.parameterId}`),
  );

  const routed: { parameterId: number; parameterName: string; labId: number }[] = [];
  const problems: string[] = [];

  for (const r of rows) {
    if (!capable.has(`${r.labId}:${r.parameter.id}`)) {
      problems.push(
        `${r.parameter.nameEn} is routed to ${r.lab.nameEn}, which does not hold that capability`,
      );
      continue;
    }
    routed.push({ parameterId: r.parameter.id, parameterName: r.parameter.nameEn, labId: r.labId });
  }

  const parameterCount = await prisma.testParameter.count({ where: { subProductId } });
  const covered = new Set(routed.map((r) => r.parameterId)).size;
  if (covered < parameterCount)
    problems.push(
      `${parameterCount - covered} of ${parameterCount} parameters have no usable route from this office`,
    );

  return {
    routed,
    problems,
    /** True while every row is still the seeded stand-in (D66). */
    allPlaceholder: rows.length > 0 && rows.every((r) => r.isPlaceholder),
  };
}

/** The grid, with every cell we already know an answer for filled in. */
export async function buildPlanFor(applicationId: number): Promise<{
  plan: SamplePlan;
  problems: string[];
}> {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: {
      bstiOfficeId: true,
      subProducts: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          subProductId: true,
          subProduct: { select: { nameEn: true } },
          _count: { select: { skus: true } },
        },
      },
    },
  });
  if (!app.bstiOfficeId)
    throw new Error("The receiving office is not set — routing cannot be resolved.");

  const subProducts: PlanSubProduct[] = [];
  const problems: string[] = [];

  for (const sp of app.subProducts) {
    const d = await resolveDestinations(app.bstiOfficeId, sp.subProductId);
    problems.push(...d.problems.map((p) => `${sp.subProduct.nameEn}: ${p}`));
    subProducts.push({
      applicationSubProductId: sp.id,
      subProductId: sp.subProductId,
      subProductName: sp.subProduct.nameEn,
      variantCount: sp._count.skus,
      routed: d.routed,
    });
  }

  // What is already known: entered on this application, else what the lab
  // agreed the last time anyone asked.
  const entered = await prisma.sampleRequirement.findMany({
    where: { applicationSubProduct: { applicationId } },
    select: { applicationSubProductId: true, labId: true, samplesPerVariant: true },
  });
  const learned = await prisma.labSampleRequirement.findMany({
    where: { subProductId: { in: subProducts.map((s) => s.subProductId) } },
    select: { labId: true, subProductId: true, samplesPerVariant: true },
  });

  const known = new Map<string, number>();
  for (const sp of subProducts)
    for (const l of learned)
      if (l.subProductId === sp.subProductId)
        known.set(cellKey(sp.applicationSubProductId, l.labId), l.samplesPerVariant);
  for (const e of entered)
    known.set(cellKey(e.applicationSubProductId, e.labId), e.samplesPerVariant);

  return { plan: buildPlan(subProducts, known), problems };
}

/**
 * The FDO's figure for one cell — and the lab's default, updated with it.
 *
 * Writing both is what turns the phone call into data: the first application
 * for a sub-product costs a call, every one after arrives pre-filled and the
 * lab can correct its own row at any time.
 */
export async function setRequirement(args: {
  applicationSubProductId: number;
  labId: number;
  samplesPerVariant: number;
  employeeId?: string;
  note?: string;
}) {
  const { applicationSubProductId, labId, samplesPerVariant, employeeId, note } = args;
  if (!Number.isInteger(samplesPerVariant) || samplesPerVariant < 1)
    throw new Error("A lab needs at least one sample per variant.");

  const asp = await prisma.applicationSubProduct.findUniqueOrThrow({
    where: { id: applicationSubProductId },
    select: { subProductId: true },
  });

  return prisma.$transaction(async (tx) => {
    const row = await tx.sampleRequirement.upsert({
      where: { applicationSubProductId_labId: { applicationSubProductId, labId } },
      create: { applicationSubProductId, labId, samplesPerVariant, source: "entered", note },
      update: { samplesPerVariant, source: "entered", note },
    });
    await tx.labSampleRequirement.upsert({
      where: { labId_subProductId: { labId, subProductId: asp.subProductId } },
      create: {
        labId, subProductId: asp.subProductId, samplesPerVariant,
        agreedByEmployeeId: employeeId ?? null, note,
      },
      update: {
        samplesPerVariant, agreedAt: new Date(),
        agreedByEmployeeId: employeeId ?? null, note,
      },
    });
    return row;
  });
}

/**
 * Turn the agreed plan into work items and physical specimens.
 *
 * One transaction, because a half-written plan is a box of jars nobody can
 * account for. Refuses if the plan is incomplete or a route is unusable —
 * the specimens are about to be sealed and cannot be recalled.
 *
 * Idempotent by refusal, not by upsert: an application that already has
 * consignments must have them voided deliberately rather than silently
 * regenerated under the applicant's feet.
 */
export async function commitSampling(applicationId: number, employeeId?: string) {
  const existing = await prisma.consignment.count({ where: { applicationId } });
  if (existing > 0)
    throw new Error("This application already has sealed consignments.");

  const { plan, problems } = await buildPlanFor(applicationId);
  const all = [...problems, ...planProblems(plan)];
  if (all.length) throw new Error(`Sampling plan is not ready:\n- ${all.join("\n- ")}`);

  const skus = await prisma.applicationSku.findMany({
    where: { applicationSubProduct: { applicationId } },
    select: { id: true, applicationSubProductId: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  const skusBySubProduct = new Map<number, number[]>();
  for (const s of skus) {
    if (!skusBySubProduct.has(s.applicationSubProductId)) skusBySubProduct.set(s.applicationSubProductId, []);
    skusBySubProduct.get(s.applicationSubProductId)!.push(s.id);
  }

  return prisma.$transaction(
    async (tx) => {
      // One box per destination lab — derived from the plan, never typed, so
      // an empty box cannot be prepared and a needed one cannot be missed.
      const consignmentByLab = new Map<number, number>();
      for (const box of plan.boxes) {
        const c = await tx.consignment.create({
          data: {
            code: newConsignmentCode(),
            applicationId,
            labId: box.labId,
            sealNo: newConsignmentCode().replace("BX-", "SEAL-"),
            state: "packed",
            packedByEmployeeId: employeeId ?? null,
          },
          select: { id: true },
        });
        consignmentByLab.set(box.labId, c.id);
        await tx.custodyEvent.create({
          data: { consignmentId: c.id, state: "packed", note: "Sealed at the factory by the FDO." },
        });
      }

      let specimens = 0;
      for (const cell of plan.cells) {
        // The lab's work item names the catalogue sub-product, never the
        // application — see the note on `LabTestOrder`.
        const order = await tx.labTestOrder.create({
          data: {
            code: newTestOrderCode(),
            labId: cell.labId,
            subProductId: cell.subProductId,
            state: "awaiting_sample",
            items: {
              create: cell.parameterIds.map((parameterId, i) => ({ parameterId, sortOrder: i })),
            },
          },
          select: { id: true },
        });

        const skuIds = skusBySubProduct.get(cell.applicationSubProductId) ?? [];
        let specimenNo = 0;
        for (const skuId of skuIds) {
          for (let i = 0; i < (cell.samplesPerVariant ?? 0); i++) {
            specimenNo++;
            const sample = await tx.sample.create({
              data: {
                ref: newRef(),
                labCode: newLabCode(),
                labTestOrderId: order.id,
                specimenNo,
                state: "sealed",
              },
              select: { id: true },
            });
            await tx.sampleRegistration.create({
              data: {
                sampleId: sample.id,
                cmCode: newCmCode(),
                applicationSkuId: skuId,
                applicationSubProductId: cell.applicationSubProductId,
                consignmentId: consignmentByLab.get(cell.labId)!,
                sealedByEmployeeId: employeeId ?? null,
              },
            });
            specimens++;
          }
        }
      }

      await tx.consignment.updateMany({
        where: { applicationId },
        data: { state: "awaiting_submission" },
      });

      return { consignments: consignmentByLab.size, specimens, totalPlanned: plan.totalSamples };
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
}

/**
 * The applicant hands a box in at the destination office's own counter.
 *
 * **Per box, not per application** — the applicant visits every destination
 * office, so this fires several times with several dates, and the file is only
 * fully in when the last one lands. The counter checks the seal and the box; it
 * never opens one, so a short consignment surfaces at the lab instead.
 *
 * The fee is read, never written: the counter cannot mark a file paid to
 * accommodate a walk-in (spec §5.2).
 */
export async function submitConsignment(args: {
  code: string;
  officeId: number;
  userId: string;
  sealIntact: boolean;
  note?: string;
}) {
  const c = await prisma.consignment.findUnique({
    where: { code: args.code },
    select: {
      id: true, state: true, labId: true,
      lab: { select: { officeId: true, nameEn: true } },
      application: { select: { id: true, state: true } },
    },
  });
  if (!c) throw new Error("No such consignment.");
  if (c.lab.officeId !== args.officeId)
    throw new Error(`This box is for ${c.lab.nameEn}. It cannot be received here.`);
  if (c.state !== "awaiting_submission" && c.state !== "packed")
    throw new Error(`This box has already been ${c.state.replace(/_/g, " ")}.`);

  if (!args.sealIntact) {
    return prisma.$transaction(async (tx) => {
      await tx.consignment.update({
        where: { id: c.id },
        data: { state: "rejected", sealIntact: false, rejectionReason: args.note ?? "Seal broken on arrival." },
      });
      await tx.custodyEvent.create({
        data: { consignmentId: c.id, state: "rejected", actorUserId: args.userId, note: args.note ?? "Seal broken on arrival." },
      });
      return { accepted: false as const };
    });
  }

  return prisma.$transaction(async (tx) => {
    await tx.consignment.update({
      where: { id: c.id },
      data: { state: "submitted", submittedAt: new Date(), receivedByUserId: args.userId, sealIntact: true },
    });
    await tx.custodyEvent.create({
      data: { consignmentId: c.id, state: "submitted", actorUserId: args.userId, note: args.note },
    });
    await tx.sample.updateMany({
      where: { registry: { consignmentId: c.id } },
      data: { state: "submitted" },
    });

    // "Sample received" is only true once every box is in.
    const remaining = await tx.consignment.count({
      where: { applicationId: c.application.id, state: { in: ["packed", "awaiting_submission"] } },
    });
    await tx.application.update({
      where: { id: c.application.id },
      data: { state: remaining === 0 ? "sample_received" : "sample_partially_received" },
    });

    return { accepted: true as const, remainingBoxes: remaining };
  });
}

/** The lab opens the box. Only the lab may. */
export async function openConsignment(args: {
  code: string;
  labId: number;
  employeeId: string;
  sealIntact: boolean;
  note?: string;
}) {
  const c = await prisma.consignment.findUnique({
    where: { code: args.code },
    select: { id: true, state: true, labId: true },
  });
  if (!c) throw new Error("No such consignment.");
  if (c.labId !== args.labId) throw new Error("This box belongs to another laboratory.");
  if (c.state !== "submitted") throw new Error("This box has not been handed in yet.");

  return prisma.$transaction(async (tx) => {
    await tx.consignment.update({
      where: { id: c.id },
      data: {
        state: args.sealIntact ? "received_at_lab" : "rejected",
        openedAt: new Date(),
        openedByEmployeeId: args.employeeId,
        sealIntact: args.sealIntact,
        rejectionReason: args.sealIntact ? null : (args.note ?? "Seal not intact."),
      },
    });
    await tx.custodyEvent.create({
      data: {
        consignmentId: c.id,
        state: args.sealIntact ? "received_at_lab" : "rejected",
        note: args.note,
      },
    });
    if (!args.sealIntact) return { accepted: false as const };

    await tx.sample.updateMany({
      where: { registry: { consignmentId: c.id } },
      data: { state: "received_at_lab" },
    });
    const orders = await tx.sample.findMany({
      where: { registry: { consignmentId: c.id } },
      select: { labTestOrderId: true },
      distinct: ["labTestOrderId"],
    });
    await tx.labTestOrder.updateMany({
      where: { id: { in: orders.map((o) => o.labTestOrderId) }, state: "awaiting_sample" },
      data: { state: "in_progress" },
    });
    return { accepted: true as const, orders: orders.length };
  });
}
