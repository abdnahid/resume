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
export async function resolveDestinations(
  officeId: number,
  subProductId: number,
  /**
   * What the field officer chose for this consignment, parameter → office
   * (D125). It **wins over everything**, including a standing preference:
   * the preference pre-fills and he may override it.
   */
  chosen?: Map<number, number>,
) {
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
    /**
     * **Every office that could run this test, on every routed row** — not only
     * on the ones nothing could settle.
     *
     * A destination used to become unchangeable the moment it was decided: the
     * picker rendered `choices`, which holds only the *unresolved* ties, so a
     * test that resolved by any rule — it can be done here, a preference names
     * somewhere, one office is the only candidate — vanished from the officer's
     * view with no way back. On application 26 that meant Sabbir's own two
     * choices, made and then invisible, and no way at all to move a test the
     * receiving office covers by sending it out (D65) to an office with a real
     * bench for it.
     *
     * Carrying the candidates on every row is what makes the plan editable
     * rather than merely computed. `chosen` already wins over everything in the
     * rule below; this is what lets a person reach it.
     */
    alternatives: { officeId: number; officeName: string; manner: string }[];
    /** True when a person picked this, false when a rule did. */
    chosenByOfficer: boolean;
    /** Which rule put it here, for the screen to say so. */
    reason: "officer" | "own_bench" | "in_house" | "own_outsourced" | "outsourced";
  }[] = [];
  const problems: string[] = [];
  /**
   * Offices this sub-product is already going to, so a tie prefers one of them.
   * Filled as we go: the parameters are in catalogue order, which is the order
   * the officer reads them in, so the box that grows is the one he has already
   * seen named.
   */
  const alreadyUsed = new Set<number>();

  for (const p of parameters) {
    const candidates = byParameter.get(p.id) ?? [];
    if (!candidates.length) {
      problems.push(`no office has said it can run ${p.nameEn}`);
      continue;
    }

    /**
     * **A real bench beats an outsourced one, wherever it is** — the client's
     * rule, 2026-09-15. An office that covers a test by sending it to a private
     * laboratory is a valid destination and stays accountable for it (D65), but
     * it is not the *better* destination when BSTI can run the test itself:
     * choosing it would pay an outside laboratory for work a bench down the
     * road does, and add a referral, a courier and a second set of hands to the
     * chain of custody. So travelling to a BSTI bench is preferred over
     * outsourcing at home, and only when nothing is run in-house anywhere does
     * the receiving office's own outsourcing win.
     *
     * Within each tier, keep it here if we can — a sample that does not travel
     * is a box nobody has to carry.
     *
     *   1. what the officer chose            — always, and he may choose an
     *                                          outsourced office deliberately
     *   2. our own bench
     *   3. any other office's bench
     *   4. our own office, outsourcing it
     *   5. any other office, outsourcing it
     */
    const picked = chosen?.get(p.id);
    const byOfficer = picked ? candidates.find((c) => c.officeId === picked) : undefined;

    const bench = candidates.filter((c) => c.manner === "in_house");
    const sentOut = candidates.filter((c) => c.manner !== "in_house");
    const ownBench = bench.find((c) => c.officeId === officeId);
    const ownSentOut = sentOut.find((c) => c.officeId === officeId);

    /**
     * Which of several equal offices, when neither we nor a standing preference
     * settles it.
     *
     * **Fewest boxes wins.** An office already receiving another test of this
     * sub-product costs the applicant no extra errand, while a fresh office is
     * one more counter to visit and one more seal to check. Where even that is
     * level it falls to the lowest office id, which decides nothing on the
     * merits but decides it the same way every time — and the officer sees the
     * answer on the row and can move it.
     */
    const tieBreak = (from: typeof candidates) => {
      if (!from.length) return undefined;
      const pref = from.find((c) => c.officeId === preferred.get(p.id));
      if (pref) return pref;
      return [...from].sort(
        (a, b) =>
          (alreadyUsed.has(b.officeId) ? 1 : 0) - (alreadyUsed.has(a.officeId) ? 1 : 0) ||
          a.officeId - b.officeId,
      )[0];
    };

    const chose =
      byOfficer ?? ownBench ?? tieBreak(bench) ?? ownSentOut ?? tieBreak(sentOut);

    // A choice the officer made against an office that has since dropped the
    // capability is not silently ignored — he picked it, and it stopped being
    // possible after he did.
    if (picked && !byOfficer)
      problems.push(
        `${p.nameEn} was sent to an office that no longer says it can run it — choose again`,
      );

    // **Every candidate list now resolves**, because the tie-break has a final
    // rung that always answers. A test with no destination used to be listed in
    // `choices` and rendered by a second picker above the grid, which is the
    // duplication the client asked to be rid of: a cell cannot exist for a test
    // going nowhere, so it could not be shown on the row like every other test.
    // Defaulting is safe now in a way it was not before D141 — the destination
    // is visible on the row, carries its alternatives, and can be moved.
    if (!chose) continue;

    if (preferred.has(p.id) && !candidates.some((c) => c.officeId === preferred.get(p.id)))
      problems.push(
        `${p.nameEn} is preferred to an office that has not said it can run it`,
      );

    alreadyUsed.add(chose.officeId);

    routed.push({
      parameterId: p.id, parameterName: p.nameEn,
      officeId: chose.officeId, manner: chose.manner,
      officeName: chose.office.nameEn,
      alternatives: candidates.map((c) => ({
        officeId: c.officeId, officeName: c.office.nameEn, manner: c.manner,
      })),
      chosenByOfficer: !!byOfficer,
      reason: byOfficer
        ? "officer"
        : chose === ownBench
          ? "own_bench"
          : chose.manner === "in_house"
            ? "in_house"
            : chose === ownSentOut
              ? "own_outsourced"
              : "outsourced",
    });
  }

  return {
    routed,
    problems,
    /** True while nobody has declared anything for this package at all. */
    noCapability: caps.length === 0,
  };
}

/** The grid, with every cell we already know an answer for filled in. */
/** Where one test is going, and everywhere else it could go. */
export type RoutingDetail = {
  applicationSubProductId: number;
  parameterId: number;
  officeId: number;
  manner: string;
  alternatives: { officeId: number; officeName: string; manner: string }[];
  chosenByOfficer: boolean;
  reason: "officer" | "own_bench" | "in_house" | "own_outsourced" | "outsourced";
};

export async function buildPlanFor(applicationId: number): Promise<{
  plan: SamplePlan;
  problems: string[];
  /**
   * Every *settled* route, with its alternatives — so the screen can show where
   * each test is going and let the officer move it. `openChoices` covers only
   * the ties nothing could settle, which left a decided destination with no way
   * back to it.
   */
  routing: RoutingDetail[];
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
  const routing: RoutingDetail[] = [];

  const chosenRows = await prisma.applicationParameterDestination.findMany({
    where: { applicationSubProduct: { applicationId } },
    select: { applicationSubProductId: true, parameterId: true, officeId: true },
  });

  for (const sp of app.subProducts) {
    const chosen = new Map(
      chosenRows.filter((c) => c.applicationSubProductId === sp.id)
        .map((c) => [c.parameterId, c.officeId]),
    );
    const d = await resolveDestinations(app.bstiOfficeId, sp.subProductId, chosen);
    problems.push(...d.problems.map((p) => `${sp.subProduct.nameEn}: ${p}`));
    for (const r of d.routed)
      routing.push({
        applicationSubProductId: sp.id,
        parameterId: r.parameterId,
        officeId: r.officeId,
        manner: r.manner,
        alternatives: r.alternatives,
        chosenByOfficer: r.chosenByOfficer,
        reason: r.reason,
      });
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

  return { plan: buildPlan(subProducts, known), problems, routing };
}

/**
 * Record where the officer is sending one test.
 *
 * Refused unless the office actually holds the capability — the picker offers
 * only capable offices, and a rule enforced where the button is holds only for
 * people who used the button.
 */
export async function setParameterDestination(args: {
  applicationSubProductId: number;
  parameterId: number;
  officeId: number | null;
  employeeId?: string | null;
  note?: string | null;
}) {
  if (args.officeId === null) {
    await prisma.applicationParameterDestination.deleteMany({
      where: {
        applicationSubProductId: args.applicationSubProductId,
        parameterId: args.parameterId,
      },
    });
    return { cleared: true };
  }

  const capable = await prisma.parameterCapability.findUnique({
    where: {
      officeId_parameterId: { officeId: args.officeId, parameterId: args.parameterId },
    },
    select: { isActive: true, office: { select: { nameEn: true } } },
  });
  if (!capable?.isActive) {
    const office = await prisma.office.findUnique({
      where: { id: args.officeId }, select: { nameEn: true },
    });
    throw new Error(`${office?.nameEn ?? "That office"} has not said it can run this test.`);
  }

  await prisma.applicationParameterDestination.upsert({
    where: {
      applicationSubProductId_parameterId: {
        applicationSubProductId: args.applicationSubProductId,
        parameterId: args.parameterId,
      },
    },
    create: {
      applicationSubProductId: args.applicationSubProductId,
      parameterId: args.parameterId,
      officeId: args.officeId,
      chosenByEmployeeId: args.employeeId ?? null,
      note: args.note?.trim() || null,
    },
    update: {
      officeId: args.officeId,
      chosenAt: new Date(),
      chosenByEmployeeId: args.employeeId ?? null,
      note: args.note?.trim() || null,
    },
  });
  return { cleared: false, officeName: capable.office.nameEn };
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
  // Named, not numbered: this message is read by the officer at the factory
  // with the jars in front of him, and an office id is not something he carries.
  const officeName = new Map(
    (
      await prisma.office.findMany({
        where: { id: { in: [...new Set(plan.cells.map((c) => c.officeId))] } },
        select: { id: true, nameEn: true },
      })
    ).map((o) => [o.id, o.nameEn]),
  );
  const all = [...problems, ...planProblems(plan, officeName)];
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
      application: {
        select: {
          id: true, state: true, testFeePoisha: true,
          testFeePayment: { select: { status: true } },
        },
      },
    },
  });
  if (!c) throw new Error("No such consignment.");
  if (c.officeId !== args.officeId)
    throw new Error(
      `This box is for ${c.office?.nameEn ?? "another office"}. It cannot be received here.`,
    );
  if (c.state !== "awaiting_submission" && c.state !== "packed")
    throw new Error(`This box has already been ${c.state.replace(/_/g, " ")}.`);

  // **The testing fee must be paid before a box is taken in** (D129). The
  // counter reads the fee and never writes it (spec §5.2): it can see that the
  // money is outstanding and refuse the sample, and it cannot mark a file paid
  // to accommodate somebody at the desk. Refusing here rather than only hiding
  // the button, because a rule enforced where the button is holds only for
  // people who used the button.
  if (c.application.testFeePayment?.status !== "paid") {
    const due = c.application.testFeePoisha;
    throw new Error(
      `The testing fee${due ? ` of ৳${(due / 100).toLocaleString("en-BD")}` : ""} has not been paid. ` +
        `The sample cannot be received until it is.`,
    );
  }

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
