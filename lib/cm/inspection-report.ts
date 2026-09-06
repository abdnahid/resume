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
  samplingRemarks: string | null;
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
    samplingRemarks: args.input.samplingRemarks?.trim() || null,
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
 * Send the visit up for approval — to whoever handed the file down (D84).
 *
 * **The inspection report and the sampling record go together**, because they
 * are one visit (D92). Splitting them would let a senior approve a report about
 * a factory whose samples he has not seen, or clear a set of jars without the
 * findings that justify drawing them.
 *
 * Refuses while anything is missing, the samples included: a visit that reaches
 * a senior half finished costs two hand-offs to fix what one check catches.
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
  // The jars have to be sealed before the visit can be signed off: the sampling
  // record is half of what is being approved.
  const sealed = await prisma.consignment.count({ where: { applicationId: args.applicationId } });
  if (sealed === 0) gaps.push("No samples have been sealed for this visit.");
  if (gaps.length) throw new Error(`The visit is not finished: ${gaps.join(" ")}`);
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

/**
 * The approving desk's three answers (D92).
 *
 * A visit is either sound, or wrong on paper, or wrong in the factory, and each
 * needs a different thing to happen:
 *
 * - **approve** — the report is numbered and the file goes straight back to the
 *   officer, because the letters that follow are his to issue and a file parked
 *   on the approver's desk is a day lost for nothing.
 * - **return** — the paperwork is wrong. It goes back down to the officer with
 *   a note and nothing else changes: the samples stand, the visit stands, and he
 *   fixes what was written about it.
 * - **redevelop** — the *factory* is not ready. A development notice goes to the
 *   applicant, the file waits on **them**, and the visit stays on the record,
 *   because a re-inspection is a second visit rather than an edit of the first.
 *
 * Deliberately one function: the three share every guard, and three entry points
 * would be three places to forget that only a senior may answer.
 */
async function assertMayDecide(applicationId: number, employeeId: string, role: string) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { holderEmployeeId: true, bstiOfficeId: true },
  });
  if (app.holderEmployeeId !== employeeId) {
    throw new Error("The file has to reach you before you can answer for it.");
  }
  const report = await reportFor(applicationId);
  if (!report) throw new Error("There is no inspection report on this file.");
  if (report.approvedAt) throw new Error("This report is already approved.");
  if (!report.submittedAt) throw new Error("The officer has not sent this visit up yet.");

  if (role !== "superadmin") {
    if (report.preparedByEmployeeId === employeeId) {
      throw new Error("A visit is answered for by your senior, not by you.");
    }
    if (!app.bstiOfficeId) throw new Error("This file has no office.");
    const { desksOfOffice } = await import("@/lib/workflow/inbox");
    const { canPassTo } = await import("@/lib/workflow/chain");
    const desks = await desksOfOffice(app.bstiOfficeId);
    const author = desks.find((d) => d.employeeId === report.preparedByEmployeeId);
    const me = desks.find((d) => d.employeeId === employeeId);
    if (!author || !me || !canPassTo(author, me, "up")) {
      throw new Error("Only an officer senior to whoever made this visit can answer for it.");
    }
  }
  return { app, report };
}

/**
 * Send the visit back down for correction — the paperwork, not the factory.
 *
 * Nothing on the application reopens: this is an internal note between two
 * desks, and the applicant is not involved. The report's `submittedAt` is
 * cleared so the officer can edit it again and send it back.
 */
export async function returnVisitToOfficer(args: {
  applicationId: number;
  employeeId: string;
  role: string;
  note: string;
  actorUserId: string;
}) {
  const { report } = await assertMayDecide(args.applicationId, args.employeeId, args.role);
  if (!args.note.trim()) throw new Error("Say what has to be corrected.");

  await prisma.$transaction([
    prisma.inspectionReport.update({ where: { id: report.id }, data: { submittedAt: null } }),
    prisma.application.update({
      where: { id: args.applicationId },
      data: {
        holderEmployeeId: report.preparedByEmployeeId,
        state: "inspection_completed",
      },
    }),
    prisma.applicationMovement.create({
      data: {
        applicationId: args.applicationId,
        fromEmployeeId: args.employeeId,
        toEmployeeId: report.preparedByEmployeeId,
        direction: "down",
        note: args.note.trim(),
        actorUserId: args.actorUserId,
      },
    }),
  ]);
  return report.preparedByEmployeeId;
}

/**
 * Demand a re-inspection: the factory is not ready.
 *
 * The file goes on hold waiting on the **applicant**, not on BSTI, and the
 * notice is what they see. The visit and its samples stay exactly as recorded —
 * a re-inspection is a second visit, and rewriting the first would lose the
 * finding that caused this.
 */
export async function demandFactoryDevelopment(args: {
  applicationId: number;
  employeeId: string;
  role: string;
  note: string;
  actorUserId: string;
}) {
  const { report } = await assertMayDecide(args.applicationId, args.employeeId, args.role);
  if (!args.note.trim()) throw new Error("Say what the factory has to put right.");

  const last = await prisma.factoryDevelopmentNotice.findFirst({
    where: { applicationId: args.applicationId },
    orderBy: { roundNo: "desc" },
    select: { roundNo: true },
  });

  await prisma.$transaction([
    prisma.factoryDevelopmentNotice.create({
      data: {
        applicationId: args.applicationId,
        roundNo: (last?.roundNo ?? 0) + 1,
        raisedByEmployeeId: args.employeeId,
        note: args.note.trim(),
      },
    }),
    prisma.application.update({
      where: { id: args.applicationId },
      data: { state: "awaiting_factory_development" },
    }),
    prisma.applicationEvent.create({
      data: {
        applicationId: args.applicationId,
        kind: "factory_development_demanded",
        note: args.note.trim(),
        actorUserId: args.actorUserId,
      },
    }),
  ]);
  return report.id;
}

/** The senior approves, and the report is numbered. */
export async function approveReport(args: {
  applicationId: number;
  employeeId: string;
  role: string;
  actorUserId: string;
}) {
  const { app, report } = await assertMayDecide(args.applicationId, args.employeeId, args.role);

  const reportNo = await nextReportNo(app.bstiOfficeId);

  /**
   * Approval hands the file **straight back to the officer**.
   *
   * The letters that follow are his to issue — to the testing wings, to the
   * applicant, to each One Stop counter — so a file parked on the approver's
   * desk is a day lost for nothing. It is the same reasoning as the inspection
   * plan (D82): the desk that does the next thing should be holding it.
   */
  await prisma.$transaction([
    prisma.inspectionReport.update({
      where: { id: report.id },
      data: { approvedByEmployeeId: args.employeeId, approvedAt: new Date(), reportNo },
    }),
    prisma.application.update({
      where: { id: args.applicationId },
      data: {
        state: "inspection_completed",
        holderEmployeeId: report.preparedByEmployeeId,
      },
    }),
    prisma.applicationMovement.create({
      data: {
        applicationId: args.applicationId,
        fromEmployeeId: args.employeeId,
        toEmployeeId: report.preparedByEmployeeId,
        direction: "down",
        note: `Inspection report approved — ${reportNo}.`,
        actorUserId: args.actorUserId,
      },
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
