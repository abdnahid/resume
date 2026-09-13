/**
 * The laboratory's test report — the signatures it collects and the acts that
 * move it (D133).
 *
 * Split from `testing.ts` because the two answer different questions: that file
 * is the bench (who holds the order, what the readings are), this one is the
 * document (who signed it, what it concluded, what number it carries).
 *
 * **Which signatures exist depends on who the office staffs**, and the flow is
 * derived from `signaturePlan()` rather than written down twice. An office with
 * no Assistant Director never enters `pending_check`, so nobody waits for a
 * signature there is no one to give.
 */
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/roles";
import { memoOfficeLabel } from "@/lib/bengali";
import { type LabRung, overallVerdict, stateAfterSubmit } from "@/lib/labs/ladder";
import {
  type LabActor,
  headsThisOrder,
  labDesksOfOffice,
  planForOffice,
  resultLines,
} from "@/lib/labs/testing";

/**
 * Whoever handed this order down to the desk holding it — the rule D84 settled
 * for the inspection plan, applied to the bench.
 *
 * **There is nothing to choose.** He delegated the work, so the work comes back
 * to him; offering a list of seniors both asks a question the order's own
 * history already answers and lets the wrong person be picked. Only a `down`
 * counts: a `receive` had no sender and an `up` came from somebody junior.
 */
async function delegatorOf(orderId: number, employeeId: string) {
  const m = await prisma.labTestOrderMovement.findFirst({
    where: { orderId, toEmployeeId: employeeId, direction: "down" },
    orderBy: { id: "desc" },
    select: { fromEmployeeId: true },
  });
  return m?.fromEmployeeId ?? null;
}

async function orderForSigning(orderId: number) {
  const order = await prisma.labTestOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      state: true,
      officeId: true,
      holderEmployeeId: true,
      holderRung: true,
    },
  });
  if (!order) throw new Error("No such test order.");
  if (!order.officeId) throw new Error("This order names no office.");
  return { ...order, officeId: order.officeId };
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Send the order up to the desk that signs next.
 *
 * Prefers the delegator, and **falls back to any desk at that rung** — he may
 * have retired, or the order may have reached the bench by a route with no
 * `down` in it. A finished report that cannot find its next signer would
 * otherwise sit on a desk with no way forward, which is the deadlock D76 had to
 * write a script to undo.
 */
async function sendUpTo(
  tx: Tx,
  args: {
    orderId: number;
    from: string;
    rung: LabRung;
    officeId: number;
    actorUserId: string;
    note?: string;
  },
) {
  const desks = await labDesksOfOffice(args.officeId);
  const atRung = desks.filter((d) => d.rung === args.rung && d.employeeId !== args.from);
  const preferred = await delegatorOf(args.orderId, args.from);
  const to = atRung.find((d) => d.employeeId === preferred) ?? atRung[0];
  if (!to) {
    throw new Error(
      `This office has nobody at ${args.rung.replace(/_/g, " ")} for the report to go to.`,
    );
  }

  await tx.labTestOrder.update({
    where: { id: args.orderId },
    data: { holderEmployeeId: to.employeeId, holderRung: args.rung },
  });
  await tx.labTestOrderMovement.create({
    data: {
      orderId: args.orderId,
      fromEmployeeId: args.from,
      toEmployeeId: to.employeeId,
      direction: "up",
      note: args.note,
      actorUserId: args.actorUserId,
    },
  });
  return to;
}

/**
 * The testing officer submits his results.
 *
 * **Refused while any line is unanswered**, by name and all at once — the shape
 * `reportGaps()` and `missingForSubmission()` use, so he fixes every gap in one
 * sitting instead of meeting the next one after each save.
 *
 * The verdict is computed here and **stored**: the result rows stay editable
 * while the order is on his bench, and a document that has been signed must not
 * restate itself afterwards.
 */
export async function submitReport(args: { orderId: number; actor: LabActor; remarks?: string }) {
  const order = await orderForSigning(args.orderId);
  if (order.holderEmployeeId !== args.actor.employeeId && !hasRole(args.actor, "superadmin")) {
    throw new Error("This order is on somebody else's bench.");
  }
  if (!hasRole(args.actor, "testing_officer") && !hasRole(args.actor, "superadmin")) {
    throw new Error("Only a testing officer may submit results.");
  }
  if (order.state !== "received" && order.state !== "in_progress") {
    throw new Error("This report has already gone up.");
  }

  const lines = await resultLines(args.orderId);
  if (!lines) throw new Error("No such test order.");
  const { verdict, gaps } = overallVerdict(
    lines.lines.flatMap((l) =>
      l.bySample.map((s) => ({
        label: l.bySample.length > 1 ? `${l.label} (specimen ${s.specimenNo})` : l.label,
        verdict: s.verdict,
      })),
    ),
  );
  if (gaps.length) throw new Error(`Not ready to submit:\n· ${gaps.join("\n· ")}`);

  const { plan } = await planForOffice(order.officeId);
  const next = stateAfterSubmit(plan);
  // Where one rung tests and authorises its own work both signatures are his,
  // and there is nobody in between (D133).
  const selfAuthorises = plan.authorisedBy === plan.testedBy;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const signed = {
      verdict,
      remarks: args.remarks,
      testedByEmployeeId: args.actor.employeeId,
      testedAt: now,
      ...(selfAuthorises
        ? { authorisedByEmployeeId: args.actor.employeeId, authorisedAt: now }
        : {}),
    };
    await tx.labTestReport.upsert({
      where: { orderId: args.orderId },
      create: { orderId: args.orderId, ...signed },
      update: { ...signed, returnedNote: null },
    });
    await tx.labTestOrder.update({ where: { id: args.orderId }, data: { state: next } });

    // **The rung comes from the plan, never from the state's name.** They are
    // not the same thing: at an office with an Assistant Director and no Deputy
    // Director the state is `pending_authorisation` and the authoriser is the
    // AD, so mapping the state to a rank would send the report to a Deputy
    // Director the office has not got — and `sendUpTo()` would refuse it,
    // stranding a finished report on the bench that wrote it.
    const rung: LabRung =
      next === "pending_approval"
        ? "wing_head"
        : next === "pending_check"
          ? plan.checkedBy!
          : plan.authorisedBy;
    const to = await sendUpTo(tx, {
      orderId: args.orderId,
      from: args.actor.employeeId,
      rung,
      officeId: order.officeId,
      actorUserId: args.actor.userId,
      note: "Test results submitted",
    });
    return { verdict, state: next, to: to.nameEn };
  });
}

/** The Assistant Director's check. */
export async function checkReport(args: { orderId: number; actor: LabActor }) {
  const order = await orderForSigning(args.orderId);
  if (order.state !== "pending_check") throw new Error("This report is not awaiting a check.");
  if (order.holderEmployeeId !== args.actor.employeeId && !hasRole(args.actor, "superadmin")) {
    throw new Error("This report is on somebody else's desk.");
  }
  const { plan } = await planForOffice(order.officeId);
  return prisma.$transaction(async (tx) => {
    await tx.labTestReport.update({
      where: { orderId: args.orderId },
      data: { checkedByEmployeeId: args.actor.employeeId, checkedAt: new Date() },
    });
    await tx.labTestOrder.update({
      where: { id: args.orderId },
      data: { state: "pending_authorisation" },
    });
    const to = await sendUpTo(tx, {
      orderId: args.orderId,
      from: args.actor.employeeId,
      rung: plan.authorisedBy,
      officeId: order.officeId,
      actorUserId: args.actor.userId,
      note: "Checked",
    });
    return { to: to.nameEn };
  });
}

/** Authorisation — the last signature before the draft reaches the wing head. */
export async function authoriseReport(args: { orderId: number; actor: LabActor }) {
  const order = await orderForSigning(args.orderId);
  if (order.state !== "pending_authorisation") {
    throw new Error("This report is not awaiting authorisation.");
  }
  if (order.holderEmployeeId !== args.actor.employeeId && !hasRole(args.actor, "superadmin")) {
    throw new Error("This report is on somebody else's desk.");
  }
  return prisma.$transaction(async (tx) => {
    await tx.labTestReport.update({
      where: { orderId: args.orderId },
      data: { authorisedByEmployeeId: args.actor.employeeId, authorisedAt: new Date() },
    });
    await tx.labTestOrder.update({
      where: { id: args.orderId },
      data: { state: "pending_approval" },
    });
    const to = await sendUpTo(tx, {
      orderId: args.orderId,
      from: args.actor.employeeId,
      rung: "wing_head",
      officeId: order.officeId,
      actorUserId: args.actor.userId,
      note: "Authorised",
    });
    return { to: to.nameEn };
  });
}

/** The memo shape, assigned at approval. */
async function nextReportNo(officeId: number): Promise<string> {
  const year = new Date().getFullYear();
  const office = await prisma.office.findUnique({
    where: { id: officeId },
    select: { nameBn: true },
  });
  const label = office?.nameBn ? memoOfficeLabel(office.nameBn) : "ঢাকা";
  // বিএসটিআই/<office>/পরীক্ষা-প্রতিবেদন/<serial>/<year>
  const prefix = `বিএসটিআই/${label}/পরীক্ষা-প্রতিবেদন/`;
  const suffix = `/${year}`;
  const existing = await prisma.labTestReport.findMany({
    where: { reportNo: { startsWith: prefix, endsWith: suffix } },
    select: { reportNo: true },
  });
  const highest = existing.reduce((max, r) => {
    const n = Number(r.reportNo!.slice(prefix.length, r.reportNo!.length - suffix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}${suffix}`;
}

/**
 * The wing head approves, and the draft becomes a document.
 *
 * **Numbered here, not at drafting** — the rule an application number and an
 * office order both follow: a number that has been quoted should mean a decided
 * document, and numbering drafts burns numbers and leaves gaps that read as
 * lost reports.
 */
export async function approveReport(args: { orderId: number; actor: LabActor }) {
  const order = await orderForSigning(args.orderId);
  if (order.state !== "pending_approval") throw new Error("This report is not awaiting approval.");
  if (!(await headsThisOrder(args.actor, args.orderId)) && !hasRole(args.actor, "superadmin")) {
    throw new Error("Only this wing's head may approve its reports.");
  }
  const report = await prisma.labTestReport.findUnique({
    where: { orderId: args.orderId },
    select: { testedByEmployeeId: true, authorisedByEmployeeId: true, reportNo: true },
  });
  if (!report?.testedByEmployeeId || !report.authorisedByEmployeeId) {
    throw new Error("This draft is not signed by the officers who tested and authorised it.");
  }
  if (report.reportNo) throw new Error("This report has already been approved.");

  const reportNo = await nextReportNo(order.officeId);
  await prisma.$transaction([
    prisma.labTestReport.update({
      where: { orderId: args.orderId },
      data: { reportNo, approvedByEmployeeId: args.actor.employeeId, approvedAt: new Date() },
    }),
    prisma.labTestOrder.update({
      where: { id: args.orderId },
      data: {
        state: "reported",
        reportedAt: new Date(),
        holderEmployeeId: args.actor.employeeId,
        holderRung: "wing_head",
      },
    }),
  ]);
  return { reportNo };
}

/**
 * Send a draft back down to the officer who tested it.
 *
 * **The signatures above his are cleared with it.** A report he is about to
 * change must not keep a check and an authorisation that were given to the
 * version before — the same reason an inspection plan cannot be edited after
 * approval (D85).
 */
export async function returnReport(args: { orderId: number; actor: LabActor; note: string }) {
  const order = await orderForSigning(args.orderId);
  if (order.holderEmployeeId !== args.actor.employeeId && !hasRole(args.actor, "superadmin")) {
    throw new Error("This report is on somebody else's desk.");
  }
  if (!["pending_check", "pending_authorisation", "pending_approval"].includes(order.state)) {
    throw new Error("There is no draft here to send back.");
  }
  if (!args.note.trim()) throw new Error("Say what needs correcting.");

  const report = await prisma.labTestReport.findUnique({
    where: { orderId: args.orderId },
    select: { testedByEmployeeId: true },
  });
  const to = report?.testedByEmployeeId;
  if (!to) throw new Error("This draft names no testing officer to return it to.");
  // Where there is no Examiner post filled the Assistant Director tests, so the
  // rung it goes back to is the plan's and not a fixed rank.
  const { plan } = await planForOffice(order.officeId);

  return prisma.$transaction(async (tx) => {
    await tx.labTestReport.update({
      where: { orderId: args.orderId },
      data: {
        returnedNote: args.note,
        checkedByEmployeeId: null,
        checkedAt: null,
        authorisedByEmployeeId: null,
        authorisedAt: null,
      },
    });
    await tx.labTestOrder.update({
      where: { id: args.orderId },
      data: { state: "in_progress", holderEmployeeId: to, holderRung: plan.testedBy },
    });
    await tx.labTestOrderMovement.create({
      data: {
        orderId: args.orderId,
        fromEmployeeId: args.actor.employeeId,
        toEmployeeId: to,
        direction: "down",
        note: args.note,
        actorUserId: args.actor.userId,
      },
    });
    return { to };
  });
}

/** The report as a document — every signature, with the desk each came from. */
export async function reportFor(orderId: number) {
  return prisma.labTestReport.findUnique({
    where: { orderId },
    select: {
      id: true,
      reportNo: true,
      verdict: true,
      remarks: true,
      returnedNote: true,
      testedAt: true,
      checkedAt: true,
      authorisedAt: true,
      approvedAt: true,
      testedBy: { select: { id: true, nameEn: true, nameBn: true, designationEn: true, designationBn: true } },
      checkedBy: { select: { id: true, nameEn: true, nameBn: true, designationEn: true, designationBn: true } },
      authorisedBy: { select: { id: true, nameEn: true, nameBn: true, designationEn: true, designationBn: true } },
      approvedBy: { select: { id: true, nameEn: true, nameBn: true, designationEn: true, designationBn: true } },
    },
  });
}
