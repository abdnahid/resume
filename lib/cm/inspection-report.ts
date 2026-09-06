/**
 * The initial inspection report — প্রারম্ভিক পরিদর্শন প্রতিবেদন (D86).
 *
 * Modelled on the wing's own form, with three deliberate differences that our
 * data makes possible:
 *
 * 1. **Production as *found*, beside production as *declared*.** The wing's
 *    form has one capacity box. We already hold what the applicant claimed in
 *    `ApplicationProduction`, so the report records what the officer found next
 *    to it — and "did they under-declare" is the question an inspection exists
 *    to answer, which one box cannot express.
 * 2. **The sub-product is a finding.** The applicant applies against a product;
 *    the officer records which variants he actually saw (D67), and that is what
 *    resolves the test plan and the fee. The form is where that happens.
 * 3. **Nothing is re-typed that the file already holds.** The product, the BDS
 *    numbers, the company and factory addresses and the applicant's name are
 *    printed from the application, not asked for again — the wing's paper form
 *    asks because paper cannot look them up.
 *
 * The attachments the paper form asks for (a machinery list, a process
 * description) are text here: the document store does not exist, so recording a
 * file nobody can reopen would be worse than asking for the substance.
 *
 * Approval follows D84 — the officer who handed the file down.
 */
import { prisma } from "@/lib/prisma";
import { memoOfficeLabel } from "@/lib/bengali";
import { INSPECTION_CONDITIONS, INSPECTION_MARKINGS, INSPECTION_NARRATIVE } from "./policy";

const REPORT_INCLUDE = {
  preparedBy: { select: { nameEn: true, designationEn: true, designationBn: true } },
  approvedBy: { select: { nameEn: true, designationEn: true, designationBn: true } },
  foundCapacityUnit: { select: { id: true, code: true, nameEn: true } },
  conditions: { orderBy: { id: "asc" as const } },
  markings: { orderBy: { id: "asc" as const } },
  answers: { orderBy: { id: "asc" as const } },
};

/**
 * Who may see the inspection work — the sampling plan and the report (D90).
 *
 * **Not everyone on the flow, and not yet.** D80 gives every desk that has
 * handled a file the right to read it, which is right for the application; it
 * is wrong for a report being written. Until the officer sends it up it is a
 * draft — half-answered questions and a capacity figure he has not checked —
 * and a senior reading a draft over his shoulder either corrects work that was
 * going to be corrected anyway or forms a view of a visit from notes.
 *
 * So: the visiting officer always; the desk it has been sent to, once it is
 * sent; everyone with standing once it is approved, because by then it is a
 * document rather than somebody's working.
 *
 * The sampling plan follows the report rather than having a rule of its own —
 * it is the same visit, and a senior who cannot read the report has no use for
 * the jar counts behind it.
 */
export type InspectionAudience = "author" | "approver" | "chain" | "none";

export function inspectionAudience(args: {
  /** Whoever proposed the plan — the officer who made the visit. */
  visitingOfficerId: string | null;
  /** The desk currently holding the file. */
  holderEmployeeId: string | null;
  viewerEmployeeId: string | null;
  viewerRole: string;
  submittedAt: Date | null;
  approvedAt: Date | null;
}): InspectionAudience {
  const me = args.viewerEmployeeId;
  if (args.approvedAt) return "chain";
  if (me && me === args.visitingOfficerId) return "author";
  if (args.submittedAt && me && me === args.holderEmployeeId) return "approver";
  // A superadmin is not exempt: the point is not access control against
  // administrators, it is that unfinished work is not somebody else's to read.
  return "none";
}

export async function reportFor(applicationId: number) {
  return prisma.inspectionReport.findUnique({
    where: { applicationId },
    include: REPORT_INCLUDE,
  });
}

export type ReportInput = {
  applicantName: string | null;
  applicantDesignation: string | null;
  govtApprovalOk: boolean | null;
  govtApprovalNote: string | null;
  foundCapacityValue: number | null;
  foundCapacityUnitId: number | null;
  utilisationPercent: number | null;
  unitCostPoisha: number | null;
  remarks: string | null;
  conditions: { key: string; satisfactory: boolean; note: string | null }[];
  markings: { key: string; present: boolean }[];
  answers: { key: string; text: string }[];
};

/**
 * Write the report, or correct one that has not been approved.
 *
 * Guarded on **holding** the file, like every other act on it: the officer who
 * went to the factory is the one holding it when he comes back, and a report
 * amended by somebody who was not there is a report nobody can be asked about.
 *
 * The three lists are **replaced, not merged** — the same reasoning as the
 * inspection team. A merged list of condition checks would keep a tick against
 * something the officer had since cleared.
 */
export async function saveReport(args: {
  applicationId: number;
  employeeId: string;
  input: ReportInput;
}) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: args.applicationId },
    select: { holderEmployeeId: true, state: true },
  });
  if (app.holderEmployeeId !== args.employeeId) {
    throw new Error("Only whoever is holding this file can write its inspection report.");
  }

  const existing = await reportFor(args.applicationId);
  if (existing?.approvedAt) {
    throw new Error("This report is approved. Correcting it now means a fresh report.");
  }

  const conditionKeys = new Set(INSPECTION_CONDITIONS.map((c) => c.key));
  const markingKeys = new Set(INSPECTION_MARKINGS.map((c) => c.key));
  const answerKeys = new Set(INSPECTION_NARRATIVE.map((c) => c.key));

  const scalars = {
    applicantName: args.input.applicantName?.trim() || null,
    applicantDesignation: args.input.applicantDesignation?.trim() || null,
    govtApprovalOk: args.input.govtApprovalOk,
    govtApprovalNote: args.input.govtApprovalNote?.trim() || null,
    foundCapacityValue: args.input.foundCapacityValue,
    foundCapacityUnitId: args.input.foundCapacityUnitId,
    utilisationPercent: args.input.utilisationPercent,
    unitCostPoisha: args.input.unitCostPoisha,
    remarks: args.input.remarks?.trim() || null,
  };

  const report = existing
    ? await prisma.inspectionReport.update({ where: { id: existing.id }, data: scalars })
    : await prisma.inspectionReport.create({
        data: {
          applicationId: args.applicationId,
          preparedByEmployeeId: args.employeeId,
          ...scalars,
        },
      });

  await prisma.$transaction([
    prisma.inspectionConditionCheck.deleteMany({ where: { reportId: report.id } }),
    prisma.inspectionMarkingCheck.deleteMany({ where: { reportId: report.id } }),
    prisma.inspectionReportAnswer.deleteMany({ where: { reportId: report.id } }),
  ]);
  await prisma.$transaction([
    prisma.inspectionConditionCheck.createMany({
      data: args.input.conditions
        .filter((c) => conditionKeys.has(c.key))
        .map((c) => ({
          reportId: report.id,
          key: c.key,
          satisfactory: c.satisfactory,
          note: c.note?.trim() || null,
        })),
    }),
    prisma.inspectionMarkingCheck.createMany({
      data: args.input.markings
        .filter((m) => markingKeys.has(m.key))
        .map((m) => ({ reportId: report.id, key: m.key, present: m.present })),
    }),
    prisma.inspectionReportAnswer.createMany({
      data: args.input.answers
        .filter((a) => answerKeys.has(a.key) && a.text.trim().length > 0)
        .map((a) => ({ reportId: report.id, key: a.key, text: a.text.trim() })),
    }),
  ]);

  return reportFor(args.applicationId);
}

/**
 * What is still missing before the report can be sent up.
 *
 * Returned as a list rather than thrown one at a time, so an officer fixes
 * everything in one sitting instead of discovering the next gap after each
 * save — the same shape `missingForSubmission()` uses on the applicant's side.
 */
export function reportGaps(report: Awaited<ReturnType<typeof reportFor>>): string[] {
  if (!report) return ["The report has not been started."];
  const gaps: string[] = [];
  if (report.govtApprovalOk === null) gaps.push("সরকারি অনুমোদন — mark it correct or not correct.");
  if (report.conditions.length !== INSPECTION_CONDITIONS.length) {
    gaps.push("স্বাস্থ্য ও পরিবেশগত অবস্থা — every row needs a mark.");
  }
  if (report.markings.length !== INSPECTION_MARKINGS.length) {
    gaps.push("মোড়কীকরণ ও চিহ্নিতকরণ — every item needs আছে or নাই.");
  }
  if (report.foundCapacityValue === null || report.foundCapacityUnitId === null) {
    gaps.push("উৎপাদন ক্ষমতা — record what you found at the factory.");
  }
  const answered = new Set(report.answers.map((a) => a.key));
  const missing = INSPECTION_NARRATIVE.filter((f) => !answered.has(f.key));
  if (missing.length) {
    gaps.push(`${missing.length} narrative ${missing.length === 1 ? "section is" : "sections are"} empty.`);
  }
  return gaps;
}

/**
 * Send the report up for approval — to whoever handed the file down (D84).
 *
 * Refuses while anything is missing. A report that reaches a senior half filled
 * costs two hand-offs to fix what one check would have caught.
 */
export async function sendReportForApproval(args: {
  applicationId: number;
  employeeId: string;
  note: string | null;
  actorUserId: string;
}) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: args.applicationId },
    select: { holderEmployeeId: true },
  });
  if (app.holderEmployeeId !== args.employeeId) {
    throw new Error("Only whoever is holding this file can send its report.");
  }

  const report = await reportFor(args.applicationId);
  const gaps = reportGaps(report);
  if (gaps.length) throw new Error(`The report is not finished: ${gaps.join(" ")}`);
  if (report!.approvedAt) throw new Error("This report is already approved.");

  const { delegatorOf } = await import("@/lib/workflow/inbox");
  const to = await delegatorOf(args.applicationId, args.employeeId);
  if (!to) {
    throw new Error("Nobody handed this file down to you, so there is no senior to send it to.");
  }

  await prisma.$transaction([
    prisma.inspectionReport.update({
      where: { id: report!.id },
      data: { submittedAt: new Date() },
    }),
    prisma.application.update({
      where: { id: args.applicationId },
      data: { holderEmployeeId: to.employeeId, state: "inspection_report_submitted" },
    }),
    prisma.applicationMovement.create({
      data: {
        applicationId: args.applicationId,
        fromEmployeeId: args.employeeId,
        toEmployeeId: to.employeeId,
        direction: "up",
        note: args.note?.trim() || "Inspection report sent for approval.",
        actorUserId: args.actorUserId,
      },
    }),
  ]);
  return to;
}

/** The senior approves, and the report is numbered. */
export async function approveReport(args: {
  applicationId: number;
  employeeId: string;
  role: string;
}) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: args.applicationId },
    select: { holderEmployeeId: true, bstiOfficeId: true },
  });
  if (app.holderEmployeeId !== args.employeeId) {
    throw new Error("The file has to reach you before you can approve its report.");
  }

  const report = await reportFor(args.applicationId);
  if (!report) throw new Error("There is no inspection report to approve.");
  if (report.approvedAt) throw new Error("This report is already approved.");

  if (args.role !== "superadmin") {
    if (report.preparedByEmployeeId === args.employeeId) {
      throw new Error("An inspection report is approved by your senior, not by you.");
    }
    const { desksOfOffice } = await import("@/lib/workflow/inbox");
    const { canPassTo } = await import("@/lib/workflow/chain");
    if (!app.bstiOfficeId) throw new Error("This file has no office.");
    const desks = await desksOfOffice(app.bstiOfficeId);
    const author = desks.find((d) => d.employeeId === report.preparedByEmployeeId);
    const me = desks.find((d) => d.employeeId === args.employeeId);
    if (!author || !me || !canPassTo(author, me, "up")) {
      throw new Error("Only an officer senior to whoever wrote this report can approve it.");
    }
  }

  const reportNo = await nextReportNo(app.bstiOfficeId);
  await prisma.$transaction([
    prisma.inspectionReport.update({
      where: { id: report.id },
      data: { approvedByEmployeeId: args.employeeId, approvedAt: new Date(), reportNo },
    }),
    prisma.application.update({
      where: { id: args.applicationId },
      data: { state: "inspection_completed" },
    }),
  ]);
  return reportFor(args.applicationId);
}

/** `বিএসটিআই/<office>/পরিদর্শন-প্রতিবেদন/<serial>/<year>` — the memo shape (D85). */
async function nextReportNo(officeId: number | null): Promise<string> {
  const year = new Date().getFullYear();
  const office = officeId
    ? await prisma.office.findUnique({ where: { id: officeId }, select: { nameBn: true } })
    : null;
  const label = office?.nameBn ? memoOfficeLabel(office.nameBn) : "ঢাকা";
  const prefix = `বিএসটিআই/${label}/পরিদর্শন-প্রতিবেদন/`;
  const suffix = `/${year}`;
  const existing = await prisma.inspectionReport.findMany({
    where: { reportNo: { startsWith: prefix, endsWith: suffix } },
    select: { reportNo: true },
  });
  const highest = existing.reduce((max, r) => {
    const n = Number(r.reportNo!.slice(prefix.length, r.reportNo!.length - suffix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}${suffix}`;
}
