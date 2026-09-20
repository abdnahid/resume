/**
 * The consolidated test report — addendum A§8, and D147.
 *
 * ```
 * ALL lab_jobs REPORT_APPROVED
 *   → system compiles consolidated_test_report
 *   → application returns to FDO
 *   → FDO reviews consolidated report
 * ```
 *
 * **Generated, never typed** — the addendum's own words, and the reason this is
 * a service rather than a form. Every figure in it has already been read at a
 * bench, checked, authorised and approved; asking the field officer to copy
 * them into a summary would produce a second set of numbers free to disagree
 * with the signed reports behind it, and it is the summary that would be quoted.
 *
 * **It assembles the reports, not the results.** Each section is built by
 * `buildReportView()` — the same call the individual report page makes — so a
 * line in the compiled document and the same line on the wing's own paper
 * cannot differ. Reading `TestResult` again here would be a third path to the
 * same figure.
 *
 * **This is the document where the blinding ends, deliberately.** Every lab
 * report is built from an order and reaches no company (D71); this one is the
 * file's, on the CM side, and it names the applicant, the factory and the
 * product — because its reader is the officer deciding a licence and its
 * subject is one company's product. The cut exists to keep the *bench* from
 * knowing whose sample it holds, not to keep the file from knowing what the
 * bench found.
 *
 * **Only approved reports are in it.** A compiled document containing a draft
 * would be a conformity determination resting on a figure the wing has not
 * signed for, and `complete` is what says every one is in.
 */
import { prisma } from "@/lib/prisma";
import { buildReportView, type ReportView } from "@/lib/labs/report-view";
import { declaredLimitsForOrder } from "@/lib/cm/declared-limits";
import { labProgressFor } from "@/lib/cm/lab-progress";

export type ConsolidatedSection = {
  orderId: number;
  orderCode: string;
  officeName: string;
  wingTitle: string;
  reportNo: string | null;
  packageName: string;
  specification: string | null;
  testedOn: string | null;
  referrals: { referralNo: string; labName: string }[];
  rows: ReportView["rows"];
  /** Who signed this one — the compiled report cites its sources. */
  authorisedBy: string | null;
};

export type ConsolidatedReport = {
  applicationNo: string | null;
  company: string;
  factory: string;
  factoryDistrict: string | null;
  product: string | null;
  standards: string[];
  officeName: string | null;
  /** The visit the samples came from, so the report cites its own origin. */
  orderNo: string | null;
  inspectedOn: string | null;
  sections: ConsolidatedSection[];
  /** Every leaf across every report, counted for the determination. */
  totals: { tested: number; passed: number; failed: number; other: number };
  verdict: "pass" | "fail";
  /** Named, because a failure is the FDO's next action (A§8.1). */
  failures: { description: string; officeName: string; result: string | null }[];
  reports: number;
  compiledOn: string;
};

/**
 * Compile one application's testing into a single document.
 *
 * Returns `null` while any report is outstanding — the gate is A§8's
 * `ALL lab_jobs REPORT_APPROVED`, read through `labProgressFor().complete` so
 * the panel that offers the document and the service that builds it agree about
 * whether it exists.
 */
export async function consolidatedReportFor(
  applicationId: number,
): Promise<ConsolidatedReport | null> {
  const progress = await labProgressFor(applicationId);
  if (!progress.complete) return null;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      applicationNo: true,
      organization: { select: { nameEn: true } },
      factory: { select: { nameEn: true, district: true } },
      bstiOffice: { select: { nameEn: true } },
      product: {
        select: {
          nameEn: true,
          standards: { select: { bds: { select: { number: true } } } },
        },
      },
      inspection: { select: { orderNo: true, scheduledOn: true } },
    },
  });
  if (!app) return null;

  const day = (d: Date | null | undefined) =>
    d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null;

  // Every approved order across every destination, in the order the boxes were
  // sealed — `labProgressFor` walks consignments by id, so the sections read in
  // the same order as the sampling report and the applicant's letters.
  const orderIds = progress.destinations.flatMap((d) =>
    d.orderList.filter((o) => o.approved).map((o) => o.orderId),
  );

  const sections: ConsolidatedSection[] = [];
  for (const orderId of orderIds) {
    const view = await buildReportView(orderId, await declaredLimitsForOrder(orderId));
    if (!view) continue;
    sections.push({
      orderId,
      orderCode: view.orderCode,
      officeName: view.officeName,
      wingTitle: view.wingTitle,
      reportNo: view.reportNo,
      packageName: view.packageName,
      specification: view.specification,
      testedOn: view.testingTo,
      referrals: view.referrals,
      rows: view.rows,
      authorisedBy: view.seals.find((s) => s.label === "Authorized Signatory")?.name || null,
    });
  }

  const all = sections.flatMap((s) => s.rows.map((r) => ({ ...r, officeName: s.officeName })));
  const failed = all.filter((r) => r.verdict === "fail");
  const passed = all.filter((r) => r.verdict === "pass");

  return {
    applicationNo: app.applicationNo,
    company: app.organization?.nameEn ?? "—",
    factory: app.factory?.nameEn ?? "—",
    factoryDistrict: app.factory?.district ?? null,
    product: app.product?.nameEn ?? null,
    standards: app.product?.standards.map((s) => s.bds.number) ?? [],
    officeName: app.bstiOffice?.nameEn ?? null,
    orderNo: app.inspection?.orderNo ?? null,
    inspectedOn: day(app.inspection?.scheduledOn),
    sections,
    totals: {
      tested: all.length,
      passed: passed.length,
      failed: failed.length,
      other: all.length - passed.length - failed.length,
    },
    // **One failure fails the product**, which is the same rule the individual
    // report's own remark applies (`conformsLine`) and the rule
    // `labProgressFor` applies across offices. A§8.1 is explicit that this does
    // *not* reject the application — it starts the re-inspection conversation —
    // so this is a conformity statement, not a decision.
    verdict: failed.length ? "fail" : "pass",
    failures: failed.map((r) => ({
      description: r.description,
      officeName: r.officeName,
      result: r.result,
    })),
    reports: sections.length,
    compiledOn: day(new Date())!,
  };
}
