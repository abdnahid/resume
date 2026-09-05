/**
 * The inspection plan: when the visit happens, who goes, and who approved it
 * (D82).
 *
 * The reviewing officer proposes a date and a team once the desk review has
 * passed. The plan then travels **with the file** up the ordinary chain — no
 * queue of its own — and every desk above may correct the date or the team,
 * because a senior officer who cannot change a plan he is accountable for has
 * to send it back instead, which is a round trip for a typed date.
 *
 * The **office head approves**. That is the wing's Director, or the officer
 * acting in that post (D57, D74), so the role already answers "who is the
 * Director here" and no approver column is needed.
 *
 * Approval issues the **office order**, which is what the factory and every
 * desk on the flow see. It is numbered then and not at proposal, for the same
 * reason an application number is assigned at submission: a number quoted to a
 * factory should mean a visit that is actually going to happen.
 *
 * Server half (D9). `states.ts` holds the Prisma-free state rules.
 */
import { prisma } from "@/lib/prisma";
import type { ApplicationState } from "@/generated/prisma/client";

/** The states an inspection plan may be proposed from. */
const PROPOSABLE: ApplicationState[] = ["review_passed", "inspection_revision_requested"];

/** Has the desk review finished, closing the correction loop? */
export function reviewIsClosed(state: ApplicationState): boolean {
  return !["submitted", "received_by_director", "in_channel_descending", "assigned_to_fdo",
    "under_review", "shortfall_issued", "shortfall_responded"].includes(state);
}

export async function planFor(applicationId: number) {
  return prisma.inspectionPlan.findUnique({
    where: { applicationId },
    include: {
      proposedBy: { select: { id: true, nameEn: true, designationEn: true, designationBn: true } },
      approvedBy: { select: { id: true, nameEn: true, designationEn: true, designationBn: true } },
      members: {
        include: {
          employee: { select: { id: true, nameEn: true, designationEn: true, designationBn: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
}

/**
 * Propose the visit, or correct a proposal that has not been approved.
 *
 * One call for both because they are the same act by different people: the
 * proposing officer writes the plan, and a senior desk holding the file
 * afterwards rewrites it. Guarded on **holding** the file either way — a plan
 * amended by somebody who is not accountable for it is a plan nobody signed.
 *
 * An approved plan is refused. Changing the date after the office order has
 * issued means a new order, not an edited one.
 */
export async function proposeInspection(args: {
  applicationId: number;
  employeeId: string;
  scheduledOn: Date;
  note: string | null;
  members: { employeeId: string; role: string | null }[];
}) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: args.applicationId },
    select: { state: true, holderEmployeeId: true, bstiOfficeId: true },
  });
  if (app.holderEmployeeId !== args.employeeId) {
    throw new Error("Only whoever is holding this file can plan the inspection.");
  }

  const existing = await planFor(args.applicationId);
  if (existing?.approvedAt) {
    throw new Error(
      "This inspection has already been approved. Changing the date now means a fresh order.",
    );
  }
  if (!existing && !PROPOSABLE.includes(app.state)) {
    throw new Error("The desk review has to pass before an inspection can be planned.");
  }
  if (Number.isNaN(args.scheduledOn.getTime())) throw new Error("Choose a date for the visit.");
  if (args.members.length === 0) throw new Error("Name at least one officer for the team.");

  // Every named officer must be a real, serving member of staff. A plan is an
  // instruction to people, so a stale id would put a name on an office order
  // that nobody can be held to.
  const ids = [...new Set(args.members.map((m) => m.employeeId))];
  const found = await prisma.employee.findMany({
    where: { id: { in: ids }, status: "active" },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    throw new Error("One of the officers named is not on the serving roster.");
  }

  const data = {
    scheduledOn: args.scheduledOn,
    note: args.note?.trim() || null,
  };

  // Members are replaced rather than merged: the team is a list, and diffing it
  // would leave somebody on the visit because nobody remembered to remove them.
  const [plan] = await prisma.$transaction([
    existing
      ? prisma.inspectionPlan.update({ where: { id: existing.id }, data })
      : prisma.inspectionPlan.create({
          data: {
            applicationId: args.applicationId,
            proposedByEmployeeId: args.employeeId,
            ...data,
          },
        }),
    prisma.application.update({
      where: { id: args.applicationId },
      data: { state: "inspection_proposed" },
    }),
  ]);

  await prisma.inspectionTeamMember.deleteMany({ where: { planId: plan.id } });
  await prisma.inspectionTeamMember.createMany({
    data: ids.map((employeeId) => ({
      planId: plan.id,
      employeeId,
      role: args.members.find((m) => m.employeeId === employeeId)?.role?.trim() || null,
    })),
  });

  return planFor(args.applicationId);
}

/**
 * The office head approves, and the office order issues.
 *
 * Guarded on the role rather than on seniority: `office_head` is precisely
 * "the desk that speaks for this office", and where the Director's post is
 * vacant it is the officer acting in it (D57, D74). Also guarded on holding the
 * file, so an office head cannot approve a plan that is still three desks below
 * him and which he has therefore not read.
 */
export async function approveInspection(args: {
  applicationId: number;
  employeeId: string;
  role: string;
}) {
  if (args.role !== "office_head" && args.role !== "superadmin") {
    throw new Error("Only the office head can approve an inspection plan.");
  }
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: args.applicationId },
    select: { state: true, holderEmployeeId: true, bstiOfficeId: true },
  });
  if (app.holderEmployeeId !== args.employeeId) {
    throw new Error("The file has to reach you before you can approve its plan.");
  }

  // The head of *this* office. Holding the file already implies it reached them
  // and `pass()` only moves a file inside its own office — but the order carries
  // an office's name, so the office is checked here rather than inferred from
  // how the file got there.
  if (args.role === "office_head") {
    const me = await prisma.employee.findUnique({
      where: { id: args.employeeId },
      select: {
        officeId: true,
        postings: { where: { relievedAt: null }, select: { officeId: true }, take: 1 },
      },
    });
    const mine = me?.postings[0]?.officeId ?? me?.officeId ?? null;
    if (!mine || mine !== app.bstiOfficeId) {
      throw new Error("This file belongs to another office, whose head approves its inspections.");
    }
  }

  const plan = await planFor(args.applicationId);
  if (!plan) throw new Error("There is no inspection plan to approve.");
  if (plan.approvedAt) throw new Error("This plan is already approved.");

  const orderNo = await nextOrderNo(app.bstiOfficeId);

  await prisma.$transaction([
    prisma.inspectionPlan.update({
      where: { id: plan.id },
      data: { approvedByEmployeeId: args.employeeId, approvedAt: new Date(), orderNo },
    }),
    prisma.application.update({
      where: { id: args.applicationId },
      data: { state: "inspection_approved" },
    }),
  ]);
  return planFor(args.applicationId);
}

/**
 * Send the plan back to be reworked.
 *
 * A senior desk may simply edit the date or the team, so this is for the case
 * that cannot be fixed by editing — the visit should not happen yet, or the
 * wrong officer proposed it. It clears no data: the plan stays as written so
 * the desk below can see what was objected to.
 */
export async function requestPlanRevision(args: {
  applicationId: number;
  employeeId: string;
  reason: string | null;
}) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: args.applicationId },
    select: { holderEmployeeId: true },
  });
  if (app.holderEmployeeId !== args.employeeId) {
    throw new Error("Only whoever is holding this file can send the plan back.");
  }
  const plan = await planFor(args.applicationId);
  if (!plan) throw new Error("There is no inspection plan on this file.");
  if (plan.approvedAt) throw new Error("An approved plan cannot be sent back.");

  await prisma.$transaction([
    prisma.inspectionPlan.update({
      where: { id: plan.id },
      data: { note: args.reason?.trim() || plan.note },
    }),
    prisma.application.update({
      where: { id: args.applicationId },
      data: { state: "inspection_revision_requested" },
    }),
  ]);
  return planFor(args.applicationId);
}

/**
 * The next office order number for an office.
 *
 * `<office>/INS/<year>/<serial>` — the office first, because each office issues
 * its own orders and a serial shared across 23 offices would make two orders
 * with the same number in different districts. Counted from the rows that exist
 * rather than a counter table, which cannot drift out of step with them.
 */
async function nextOrderNo(officeId: number | null): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${officeId ?? 0}/INS/${year}/`;
  const last = await prisma.inspectionPlan.findFirst({
    where: { orderNo: { startsWith: prefix } },
    orderBy: { orderNo: "desc" },
    select: { orderNo: true },
  });
  const n = last?.orderNo ? Number(last.orderNo.slice(prefix.length)) : 0;
  return `${prefix}${String((Number.isFinite(n) ? n : 0) + 1).padStart(4, "0")}`;
}

/** Plans for several files at once — one query for the whole board. */
export async function plansForMany(applicationIds: number[]) {
  if (applicationIds.length === 0) return [];
  return prisma.inspectionPlan.findMany({
    where: { applicationId: { in: applicationIds } },
    select: {
      applicationId: true, scheduledOn: true, orderNo: true,
      proposedAt: true, approvedAt: true,
      proposedBy: { select: { nameEn: true } },
      approvedBy: { select: { nameEn: true } },
      _count: { select: { members: true } },
    },
  });
}

/** Officers who could be put on a team — the file's office, serving, with a desk. */
export async function teamCandidates(officeId: number) {
  const { employeesOfOffice } = await import("@/lib/salary/payroll");
  return prisma.employee.findMany({
    where: { ...employeesOfOffice(officeId), status: "active", category: { not: "daily_basis" } },
    select: { id: true, nameEn: true, designationEn: true, designationBn: true, grade: true },
    orderBy: [{ grade: "asc" }, { nameEn: "asc" }],
  });
}
