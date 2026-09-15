/**
 * The laboratory's work — the server half of D133.
 *
 * `ladder.ts` holds the rules that need no database (D9); this holds the
 * queries and the writes.
 *
 * **What the two sides may see of each other.** A test order carries no
 * application (D70), so nothing here joins to one. The FDO learns that testing
 * finished and what it concluded; he does not learn which examiner held the
 * order or how long it sat on a desk. The wing sees the package, the specimens
 * and the parameters, and never the company or the brand — the variant *is* the
 * applicant's identity (D71).
 */
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/roles";
import {
  type LabRung,
  type SignaturePlan,
  LAB_RUNGS,
  nextRungBelow,
  overallVerdict,
  rungOf,
  signaturePlan,
} from "@/lib/labs/ladder";

export type LabActor = {
  employeeId: string;
  userId: string;
  officeId: number | null;
  roles: readonly string[];
  role?: string | null;
};

/**
 * A `/workflow` actor as a lab one — the two differ only in whether the
 * employee id may be null.
 *
 * Written once because the work order board moved into `/workflow` (D137) and
 * four screens there now need both shapes. Structurally typed rather than
 * importing `WorkflowActor`, so `lib/labs/` still depends on nothing outside
 * itself.
 *
 * **An actor with no employee id resolves to no office and therefore no
 * orders**, which is the right answer: a user account with no employment has no
 * bench.
 */
export function labActorFor(a: {
  employeeId: string | null;
  userId: string;
  officeId: number | null;
  roles: readonly string[];
  role?: string | null;
}): LabActor {
  return {
    employeeId: a.employeeId ?? "",
    userId: a.userId,
    officeId: a.employeeId ? a.officeId : null,
    roles: a.roles,
    role: a.role,
  };
}

// ── Who heads a wing ────────────────────────────────────────────────────────

/**
 * The wing heads at an office, with the discipline each covers.
 *
 * **The role says who; their desk says which wing** (D133). Head office has a
 * Director (Physical) and a Director (Chemical) and a plain role cannot tell
 * them apart — but they already sit in the wings they head, so the fact is
 * recorded once and cannot drift out of step with the organogram.
 *
 * **A holder whose desk is in no wing covers every discipline.** That is the
 * branch office case rather than a fallback: a branch has no testing wing, its
 * labs hang off the office itself, and its head heads both. The same is true of
 * a wing head holding no desk at all, which is the honest reading of "nobody
 * has placed this person yet" — refusing them would stop an office dead.
 *
 * The **acting** post wins where there is one (D74): a Deputy Director holding
 * a vacant Director's charge is running that wing, which is exactly the Chemical
 * Testing Wing's position today.
 */
export async function wingHeadsOfOffice(officeId: number) {
  /**
   * **Head office answers from the desk; a branch answers from the office head**
   * (the client's rule, 2026-09-14, amending D133).
   *
   * `wing_head` was a granted role and that is what left the module dead: the
   * desks were all there, nobody held the role, and every office had no wing
   * head. A granted role that duplicates a derivable fact is two sources of
   * truth free to disagree — the reasoning D122 applied to `User.role`.
   *
   * Head office staffs `Executive (Physical Testing Wing)` and
   * `Executive (Chemical Testing Wing)`, and whoever holds the Director post in
   * one of them heads it — **substantive or in additional charge** (D74), which
   * is the Chemical wing's position today. The test is on the unit naming a
   * *testing* wing, not merely Executive: head office's own `office_head` is the
   * Director of the Certification Marks Wing, and he heads no laboratory.
   *
   * A branch has no testing wing — its labs hang off the office — so its head
   * covers both disciplines. **Keyed on the `office_head` role rather than on
   * the Executive desk**, because only 11 of 23 office heads actually sit in
   * their office's Executive section: the rest are seated in CM, in Metrology,
   * one in a Physical Lab, and two hold no desk at all. Deriving from the desk
   * would leave twelve offices with no wing head; the role is 23 of 23.
   */
  const inTestingWing = await prisma.employee.findMany({
    where: {
      officeId,
      status: "active",
      OR: [
        { actingOrgPost: { unit: { nameEn: { contains: "Testing Wing" } } } },
        { AND: [{ actingOrgPostId: null }, { orgPost: { unit: { nameEn: { contains: "Testing Wing" } } } }] },
      ],
    },
    select: {
      id: true,
      orgPost: { select: { nameEn: true } },
      actingOrgPost: { select: { nameEn: true } },
    },
  });
  // Only the wing's Director heads it — a Deputy Director sitting in the same
  // Executive unit is on the ladder, not at the top of it.
  const headIds = inTestingWing
    .filter((e) => rungOf((e.actingOrgPost ?? e.orgPost)?.nameEn) === "wing_head")
    .map((e) => e.id);

  // Which way this office answered. It decides how the disciplines are read,
  // and getting that wrong is not cosmetic — see below.
  const byTestingWingDesk = headIds.length > 0;

  const holders = await prisma.employee.findMany({
    where: byTestingWingDesk
      ? { id: { in: headIds } }
      : {
          officeId,
          status: "active",
          user: { OR: [{ roles: { has: "office_head" } }, { role: "office_head" }] },
        },
    select: {
      id: true,
      nameEn: true,
      nameBn: true,
      designationEn: true,
      designationBn: true,
      orgPost: { select: { nameEn: true, unitId: true, unit: { select: { nameEn: true } } } },
      actingOrgPost: { select: { nameEn: true, unitId: true, unit: { select: { nameEn: true } } } },
    },
    orderBy: { id: "asc" },
  });

  return holders.map((h) => {
    const post = h.actingOrgPost ?? h.orgPost;
    const unit = post?.unit.nameEn ?? "";
    /**
     * **Only a head office wing director is narrowed by his unit.** There the
     * unit *is* the wing — `Executive (Chemical Testing Wing)` — and the whole
     * point is telling the two Directors apart.
     *
     * **A branch office head always covers both**, whatever unit he happens to
     * sit in, because his office has no testing wings to be head of only one
     * of. Reading his unit was a real fault and not a cosmetic one: Pabna's
     * office head is seated in *Physical Lab, Pabna*, which matched the
     * physical test and left him unable to receive a chemical order at his own
     * office. Twelve of the 23 office heads sit outside Executive, so this
     * would have misfired wherever one of them happened to sit in a lab or a
     * discipline-named section.
     */
    const disciplines: ("physical" | "chemical")[] = !byTestingWingDesk
      ? ["physical", "chemical"]
      : /chemical|chemistry|রাসায়ন|রসায়ন/i.test(unit)
        ? ["chemical"]
        : /physical|physics|textile|পদার্থ|ভৌত|টেক্সটাইল/i.test(unit)
          ? ["physical"]
          : ["physical", "chemical"];
    return {
      employeeId: h.id,
      nameEn: h.nameEn,
      nameBn: h.nameBn,
      designation: h.designationEn ?? h.designationBn,
      postTitle: post?.nameEn ?? null,
      unitEn: post?.unit.nameEn ?? null,
      disciplines,
    };
  });
}

/** Does this person head the wing that would run this order? */
export async function headsThisOrder(actor: LabActor, orderId: number): Promise<boolean> {
  if (!actor.officeId) return false;
  const order = await prisma.labTestOrder.findUnique({
    where: { id: orderId },
    select: { officeId: true, lab: { select: { discipline: true } } },
  });
  if (!order || order.officeId !== actor.officeId) return false;
  const heads = await wingHeadsOfOffice(actor.officeId);
  const mine = heads.find((h) => h.employeeId === actor.employeeId);
  if (!mine) return false;
  // An order with no bench named is an office covering the test `third_party`
  // (D116) — there is no discipline to match on, so whoever heads a wing there
  // may take it.
  const d = order.lab?.discipline;
  return !d || mine.disciplines.includes(d as "physical" | "chemical");
}

// ── The rungs an office actually staffs ─────────────────────────────────────

export type LabDesk = {
  employeeId: string;
  nameEn: string;
  nameBn: string;
  designation: string | null;
  rung: LabRung;
  isTestingOfficer: boolean;
};

/**
 * Everyone at this office who is on the laboratory ladder, by rung.
 *
 * Scoped to the office rather than to the wing, deliberately. A branch office's
 * labs are not in wings at all, and at head office a wing's sections are
 * several units deep — so restricting by unit would empty the list at exactly
 * the offices with fewest people. The wing head chooses a person; the list
 * being a little wide costs a longer picker, while being too narrow costs a
 * hand-off that cannot be made.
 */
export async function labDesksOfOffice(officeId: number): Promise<LabDesk[]> {
  const people = await prisma.employee.findMany({
    where: { officeId, status: "active" },
    select: {
      id: true,
      nameEn: true,
      nameBn: true,
      designationEn: true,
      designationBn: true,
      orgPost: { select: { nameEn: true } },
      actingOrgPost: { select: { nameEn: true } },
      user: { select: { role: true, roles: true } },
    },
    orderBy: { id: "asc" },
  });

  const headIds = new Set((await wingHeadsOfOffice(officeId)).map((h) => h.employeeId));

  const out: LabDesk[] = [];
  for (const p of people) {
    const post = p.actingOrgPost ?? p.orgPost;
    // The post is the job where there is one (D124); the recorded designation
    // answers for the 249 people who hold no desk.
    const rung =
      rungOf(post?.nameEn) ?? rungOf(p.designationEn) ?? rungOf(p.designationBn);
    if (!rung) continue;
    const isHead = headIds.has(p.id);
    out.push({
      employeeId: p.id,
      nameEn: p.nameEn,
      nameBn: p.nameBn,
      designation: post?.nameEn ?? p.designationEn ?? p.designationBn,
      // Heading this office's testing is what puts somebody at the top of the
      // ladder. A Director who heads no testing wing — Certification Marks, say
      // — reads as the rung below, because that is where his title sits.
      rung: isHead ? "wing_head" : rung === "wing_head" ? "deputy_director" : rung,
      // **Every Examiner and every Assistant Director is a testing officer by
      // the desk they hold** (the client's rule, 2026-09-14). It was a granted
      // role on the theory that "an AD tests where no Examiner post is filled"
      // is a fact about a person; it is a fact about a *desk*, and deriving it
      // means an office is never one forgotten grant away from a dead bench.
      isTestingOfficer: rung === "examiner" || rung === "assistant_director",
    });
  }
  return out;
}

/**
 * Is this the rung of somebody who runs a test, rather than supervises one?
 *
 * The one place the question is answered, so `enterResult`, `submitReport` and
 * the screen's own `canEnterResults` cannot drift apart.
 */
export function isTestingRung(rung: LabRung | null | undefined): boolean {
  return rung === "examiner" || rung === "assistant_director";
}

/** Which rungs this office staffs, top first. */
export function staffedRungs(desks: readonly LabDesk[]): LabRung[] {
  return LAB_RUNGS.filter((r) => desks.some((d) => d.rung === r));
}

/**
 * The signature plan for an office — what its staffing means for who signs.
 *
 * Computed from the rungs **below** the wing head, because the wing head's own
 * act is approval and counting him would make every office look as though it
 * had a Deputy Director.
 */
export async function planForOffice(officeId: number): Promise<{
  desks: LabDesk[];
  rungs: LabRung[];
  plan: SignaturePlan;
}> {
  const desks = await labDesksOfOffice(officeId);
  const rungs = staffedRungs(desks).filter((r) => r !== "wing_head");
  return { desks, rungs, plan: signaturePlan(rungs) };
}

// ── The flow ────────────────────────────────────────────────────────────────

/**
 * The wing takes the samples in.
 *
 * **Distinct from the counter's receipt, and both are shown to the FDO.** The
 * One Stop counter accepts a sealed box at the door (D93); the wing accepts the
 * specimens onto its own bench. Between those two the box is inside the office
 * and nobody has looked at it, which is a real gap and the reason the client
 * asked for both.
 *
 * Refused until the box has actually been handed in — a wing cannot receive
 * what the counter has not taken.
 */
export async function receiveByWing(args: { orderId: number; actor: LabActor; note?: string }) {
  const { orderId, actor } = args;
  if (!(await headsThisOrder(actor, orderId)) && !hasRole(actor, "superadmin")) {
    throw new Error("Only this wing's head may receive its samples.");
  }

  const order = await prisma.labTestOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      state: true,
      specimens: {
        select: { registry: { select: { consignment: { select: { state: true, code: true } } } } },
      },
    },
  });
  if (!order) throw new Error("No such test order.");
  if (order.state !== "awaiting_sample") {
    throw new Error("These samples have already been received.");
  }

  const boxes = order.specimens.flatMap((s) =>
    s.registry?.consignment ? [s.registry.consignment] : [],
  );
  const notIn = boxes.filter((c) => c.state !== "submitted" && c.state !== "received_at_lab");
  if (notIn.length) {
    // Named rather than counted: the fix is to go and take that box in at the
    // counter, and a number does not say which.
    throw new Error(
      `Not handed in at the counter yet: ${[...new Set(notIn.map((c) => c.code))].join(", ")}.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.labTestOrder.update({
      where: { id: orderId },
      data: {
        state: "received",
        receivedByWingAt: new Date(),
        receivedByWingEmployeeId: actor.employeeId,
        holderEmployeeId: actor.employeeId,
        holderRung: "wing_head",
      },
    });
    await tx.labTestOrderMovement.create({
      data: {
        orderId,
        toEmployeeId: actor.employeeId,
        direction: "receive",
        note: args.note,
        actorUserId: actor.userId,
      },
    });
    await tx.sample.updateMany({
      where: { labTestOrderId: orderId },
      data: { state: "received_at_lab" },
    });
    return { received: true as const };
  });
}

/**
 * Who this holder may hand the order down to — the next staffed rung, and
 * nobody else.
 *
 * **A choice, not a broadcast** (the client's answer, 2026-09-13). A section
 * with three Assistant Directors needs somebody to say which one, and an order
 * sitting on a rung with no name against it is an order nobody is accountable
 * for.
 */
export async function passCandidates(orderId: number) {
  const order = await prisma.labTestOrder.findUnique({
    where: { id: orderId },
    select: { officeId: true, holderRung: true, holderEmployeeId: true },
  });
  if (!order?.officeId || !order.holderRung) return { rung: null, desks: [] as LabDesk[] };

  const desks = await labDesksOfOffice(order.officeId);
  const rung = nextRungBelow(order.holderRung as LabRung, staffedRungs(desks));
  if (!rung) return { rung: null, desks: [] as LabDesk[] };
  return {
    rung,
    desks: desks.filter((d) => d.rung === rung && d.employeeId !== order.holderEmployeeId),
  };
}

/** Hand the order down one rung. Only the holder may. */
export async function passDown(args: {
  orderId: number;
  toEmployeeId: string;
  actor: LabActor;
  note?: string;
}) {
  const order = await prisma.labTestOrder.findUnique({
    where: { id: args.orderId },
    select: { id: true, state: true, holderEmployeeId: true, officeId: true },
  });
  if (!order) throw new Error("No such test order.");
  if (order.holderEmployeeId !== args.actor.employeeId && !hasRole(args.actor, "superadmin")) {
    throw new Error("Only whoever holds this order may pass it on.");
  }
  if (order.state !== "received" && order.state !== "in_progress") {
    throw new Error("This order is not on a desk that can pass it down.");
  }

  const { rung, desks } = await passCandidates(args.orderId);
  const to = desks.find((d) => d.employeeId === args.toEmployeeId);
  if (!rung || !to) {
    // Re-checked here and not only at the picker: a rule enforced where the
    // button is holds only for people who used the button.
    throw new Error("That desk is not the next rung of this laboratory's ladder.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.labTestOrder.update({
      where: { id: args.orderId },
      data: { state: "in_progress", holderEmployeeId: to.employeeId, holderRung: rung },
    });
    await tx.labTestOrderMovement.create({
      data: {
        orderId: args.orderId,
        fromEmployeeId: order.holderEmployeeId,
        toEmployeeId: to.employeeId,
        direction: "down",
        note: args.note,
        actorUserId: args.actor.userId,
      },
    });
    return { to: to.nameEn, rung };
  });
}

// ── Results ─────────────────────────────────────────────────────────────────

/**
 * Record one reading.
 *
 * **A value and a verdict, because the limit cannot be checked by machine.**
 * `LimitKind` splits four kinds a single column cannot (D61) and the text runs
 * from "from 40 to 48" to "As per BDS 1149" to a value the manufacturer
 * declares — so the officer judges and the system records. A parser guessing at
 * those fails invisibly, which is the one failure mode a test result must not
 * have.
 */
export async function enterResult(args: {
  orderItemId: number;
  sampleId: number;
  subParameterId: number | null;
  observedValue: string | null;
  verdict: "pass" | "fail" | "inconclusive" | "not_tested";
  actor: LabActor;
}) {
  const item = await prisma.labTestOrderItem.findUnique({
    where: { id: args.orderItemId },
    select: {
      id: true,
      order: {
        select: { id: true, state: true, holderEmployeeId: true, holderRung: true, officeId: true },
      },
    },
  });
  if (!item) throw new Error("No such parameter on this order.");
  const order = item.order;

  if (order.holderEmployeeId !== args.actor.employeeId && !hasRole(args.actor, "superadmin")) {
    throw new Error("This order is on somebody else's bench.");
  }
  // **The desk holding the work decides, not a grant.** Every Examiner and
  // every Assistant Director is a testing officer; a Deputy Director or a wing
  // head holding the order is supervising it, and passes it to a bench.
  if (!isTestingRung(order.holderRung) && !hasRole(args.actor, "superadmin")) {
    throw new Error("Only a testing officer may enter a result. Pass the order to a bench first.");
  }
  if (order.state !== "received" && order.state !== "in_progress") {
    throw new Error("Results cannot be changed once the report has gone up.");
  }

  // Postgres treats nulls as distinct, so the unique index does not cover the
  // no-sub-parameter case — the leaf rule from D61 has to be enforced here.
  const existing = await prisma.testResult.findFirst({
    where: {
      orderItemId: args.orderItemId,
      sampleId: args.sampleId,
      subParameterId: args.subParameterId,
    },
    select: { id: true },
  });

  const data = {
    observedValue: args.observedValue,
    verdict: args.verdict,
    enteredByEmployeeId: args.actor.employeeId,
  };

  const [result] = await prisma.$transaction([
    existing
      ? prisma.testResult.update({ where: { id: existing.id }, data })
      : prisma.testResult.create({
          data: {
            ...data,
            orderItemId: args.orderItemId,
            sampleId: args.sampleId,
            subParameterId: args.subParameterId,
          },
        }),
    prisma.labTestOrder.update({ where: { id: order.id }, data: { state: "in_progress" } }),
  ]);
  return result;
}

/**
 * Every result-bearing line on an order, with whatever has been entered.
 *
 * The leaf rule again (D61): a parameter with sub-parameters produces one line
 * per sub-parameter, one without produces a single line of its own.
 */
export async function resultLines(orderId: number) {
  const order = await prisma.labTestOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      specimens: { select: { id: true, labCode: true, specimenNo: true }, orderBy: { specimenNo: "asc" } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          sortOrder: true,
          parameter: {
            select: {
              id: true,
              nameEn: true,
              nameBn: true,
              discipline: true,
              method: { select: { designation: true } },
              limitText: true,
              limitKind: true,
              subParameters: {
                orderBy: { ordinal: "asc" },
                select: { id: true, label: true, limitText: true, limitKind: true },
              },
            },
          },
          results: {
            select: {
              id: true,
              sampleId: true,
              subParameterId: true,
              observedValue: true,
              verdict: true,
            },
          },
        },
      },
    },
  });
  if (!order) return null;

  const lines = order.items.flatMap((item) =>
    (item.parameter.subParameters.length
      ? item.parameter.subParameters.map((sp) => ({
          subParameterId: sp.id as number | null,
          label: `${item.parameter.nameEn} — ${sp.label}`,
          limit: sp.limitText,
          limitKind: sp.limitKind,
        }))
      : [
          {
            subParameterId: null as number | null,
            label: item.parameter.nameEn,
            limit: item.parameter.limitText,
            limitKind: item.parameter.limitKind,
          },
        ]
    ).map((leaf) => ({
      orderItemId: item.id,
      parameterId: item.parameter.id,
      parameterName: item.parameter.nameEn,
      discipline: item.parameter.discipline,
      method: item.parameter.method?.designation ?? null,
      ...leaf,
      bySample: order.specimens.map((s) => {
        const r = item.results.find(
          (x) => x.sampleId === s.id && x.subParameterId === leaf.subParameterId,
        );
        return {
          sampleId: s.id,
          labCode: s.labCode,
          specimenNo: s.specimenNo,
          resultId: r?.id ?? null,
          observedValue: r?.observedValue ?? "",
          verdict: (r?.verdict ?? "not_tested") as "pass" | "fail" | "inconclusive" | "not_tested",
        };
      }),
    })),
  );

  return { specimens: order.specimens, lines };
}

/**
 * Every leaf × specimen, flattened for the verdict rule.
 *
 * A parameter is tested **per specimen**, so a line is only answered when every
 * jar has a reading — otherwise a report could be signed off having tested one
 * of three.
 */
function verdictInput(lines: NonNullable<Awaited<ReturnType<typeof resultLines>>>["lines"]) {
  return lines.flatMap((l) =>
    l.bySample.map((s) => ({
      label: l.bySample.length > 1 ? `${l.label} (specimen ${s.specimenNo})` : l.label,
      verdict: s.verdict,
    })),
  );
}

/** What still stands between this order and a submitted report. */
export async function reportGaps(orderId: number): Promise<string[]> {
  const r = await resultLines(orderId);
  if (!r) return ["No such test order."];
  return overallVerdict(verdictInput(r.lines)).gaps;
}
