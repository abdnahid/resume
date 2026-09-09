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
  const parameters = await prisma.testParameter.findMany({
    where: { subProductId },
    orderBy: [{ ordinal: "asc" }, { id: "asc" }],
    select: { id: true, nameEn: true, discipline: true },
  });
  const parameterIds = parameters.map((p) => p.id);

  const [caps, prefs] = await Promise.all([
    prisma.parameterCapability.findMany({
      where: { parameterId: { in: parameterIds }, isActive: true },
      select: {
        officeId: true, parameterId: true, manner: true, labId: true,
        lab: { select: { isActive: true } },
        office: { select: { nameEn: true } },
      },
    }),
    prisma.routingPreference.findMany({
      where: { officeId, parameterId: { in: parameterIds } },
      select: { parameterId: true, toOfficeId: true },
    }),
  ]);

  const byParameter = new Map<number, typeof caps>();
  for (const c of caps) {
    // A closed bench is not a destination, whatever the capability says. Work
    // the office sends out needs no bench of its own, so it is unaffected.
    if (c.manner === "in_house" && c.lab && !c.lab.isActive) continue;
    if (!byParameter.has(c.parameterId)) byParameter.set(c.parameterId, []);
    byParameter.get(c.parameterId)!.push(c);
  }
  const preferred = new Map(prefs.map((p) => [p.parameterId, p.toOfficeId]));

  const routed: {
    parameterId: number; parameterName: string; officeId: number;
    manner: string; officeName: string;
  }[] = [];
  const choices: {
    parameterId: number; parameterName: string;
    offices: { officeId: number; officeName: string; manner: string }[];
  }[] = [];
  const problems: string[] = [];

  for (const p of parameters) {
    const candidates = byParameter.get(p.id) ?? [];
    if (!candidates.length) {
      problems.push(`no office has said it can run ${p.nameEn}`);
      continue;
    }

    // Keep it here if we can — a sample that does not travel is a box nobody
    // has to carry. Otherwise the office's standing preference, if it names one
    // that is actually capable. Otherwise, if exactly one office can do it,
    // there is nothing to choose.
    const here = candidates.find((c) => c.officeId === officeId);
    const pref = candidates.find((c) => c.officeId === preferred.get(p.id));
    const sole = candidates.length === 1 ? candidates[0] : undefined;
    const chosen = here ?? pref ?? sole;

    if (!chosen) {
      choices.push({
        parameterId: p.id, parameterName: p.nameEn,
        offices: candidates.map((c) => ({
          officeId: c.officeId, officeName: c.office.nameEn, manner: c.manner,
        })),
      });
      problems.push(
        `${p.nameEn} can be run at ${candidates.length} offices — ${candidates
          .map((c) => c.office.nameEn.split(",").pop()?.trim())
          .join(", ")} — and none is preferred, so somebody has to choose`,
      );
      continue;
    }
    if (preferred.has(p.id) && !pref)
      problems.push(
        `${p.nameEn} is preferred to an office that has not said it can run it`,
      );

    routed.push({
      parameterId: p.id, parameterName: p.nameEn,
      officeId: chosen.officeId, manner: chosen.manner,
      officeName: chosen.office.nameEn,
    });
  }

  return {
    routed,
    /** Parameters with several capable offices and no preference to break the tie. */
    choices,
    problems,
    /** True while nobody has declared anything for this package at all. */
    noCapability: caps.length === 0,
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
        // A line the applicant declared but was not making at the visit is
        // struck out, not deleted (D91) — no cell, no box, nothing sealed.
        where: { notInProductionAt: null },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          subProductId: true,
          subProduct: { select: { nameEn: true } },
          _count: { select: { skus: { where: { notInProductionAt: null } } } },
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
    select: { applicationSubProductId: true, officeId: true, samplesPerVariant: true },
  });
  const learned = await prisma.officeSampleRequirement.findMany({
    where: { subProductId: { in: subProducts.map((s) => s.subProductId) } },
    select: { officeId: true, subProductId: true, samplesPerVariant: true },
  });

  const known = new Map<string, number>();
  for (const sp of subProducts)
    for (const l of learned)
      if (l.subProductId === sp.subProductId)
        known.set(cellKey(sp.applicationSubProductId, l.officeId), l.samplesPerVariant);
  for (const e of entered)
    if (e.officeId !== null)
      known.set(cellKey(e.applicationSubProductId, e.officeId), e.samplesPerVariant);

  return { plan: buildPlan(subProducts, known), problems };
}

/**
 * The FDO's figure for one cell — and the office's default, updated with it.
 *
 * Writing both is what turns the phone call into data: the first application
 * for a sub-product costs a call, every one after arrives pre-filled and the
 * office can correct its own row at any time.
 */
export async function setRequirement(args: {
  applicationSubProductId: number;
  officeId: number;
  samplesPerVariant: number;
  employeeId?: string;
  note?: string;
}) {
  const { applicationSubProductId, officeId, samplesPerVariant, employeeId, note } = args;
  if (!Number.isInteger(samplesPerVariant) || samplesPerVariant < 1)
    throw new Error("A destination needs at least one sample per variant.");

  const asp = await prisma.applicationSubProduct.findUniqueOrThrow({
    where: { id: applicationSubProductId },
    select: { subProductId: true },
  });

  return prisma.$transaction(async (tx) => {
    const row = await tx.sampleRequirement.upsert({
      where: { applicationSubProductId_officeId: { applicationSubProductId, officeId } },
      create: { applicationSubProductId, officeId, samplesPerVariant, source: "entered", note },
      update: { samplesPerVariant, source: "entered", note },
    });
    await tx.officeSampleRequirement.upsert({
      where: { officeId_subProductId: { officeId, subProductId: asp.subProductId } },
      create: {
        officeId, subProductId: asp.subProductId, samplesPerVariant,
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
    where: {
      applicationSubProduct: { applicationId, notInProductionAt: null },
      notInProductionAt: null,
    },
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
      // One box per destination **office** — derived from the plan, never
      // typed, so an empty box cannot be prepared and a needed one cannot be
      // missed. The office is the addressee whether it runs the tests on its
      // own bench or sends them out (D116).
      const consignmentByOffice = new Map<number, number>();
      for (const box of plan.boxes) {
        const c = await tx.consignment.create({
          data: {
            code: newConsignmentCode(),
            applicationId,
            officeId: box.officeId,
            sealNo: newConsignmentCode().replace("BX-", "SEAL-"),
            state: "packed",
            packedByEmployeeId: employeeId ?? null,
          },
          select: { id: true },
        });
        consignmentByOffice.set(box.officeId, c.id);
        await tx.custodyEvent.create({
          data: { consignmentId: c.id, state: "packed", note: "Sealed at the factory by the FDO." },
        });
      }

      let specimens = 0;
      for (const cell of plan.cells) {
        // The work item names the catalogue sub-product, never the
        // application — see the note on `LabTestOrder`. Its bench is filled in
        // by the office when it opens the box; for work sent out there is none.
        const order = await tx.labTestOrder.create({
          data: {
            code: newTestOrderCode(),
            officeId: cell.officeId,
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
                consignmentId: consignmentByOffice.get(cell.officeId)!,
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

      return { consignments: consignmentByOffice.size, specimens, totalPlanned: plan.totalSamples };
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
      id: true, state: true, officeId: true,
      office: { select: { nameEn: true } },
      application: { select: { id: true, state: true } },
    },
  });
  if (!c) throw new Error("No such consignment.");
  if (c.officeId !== args.officeId)
    throw new Error(
      `This box is for ${c.office?.nameEn ?? "another office"}. It cannot be received here.`,
    );
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
