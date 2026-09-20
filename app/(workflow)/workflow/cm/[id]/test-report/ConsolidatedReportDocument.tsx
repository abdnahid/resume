"use client";

import React from "react";
import { Download, Printer } from "lucide-react";
import GovHeader from "@/components/GovHeader";
import type { OrgInfo } from "@/lib/types";
import type { ConsolidatedReport } from "@/lib/cm/consolidated-report";

/**
 * সমন্বিত পরীক্ষা প্রতিবেদন — the consolidated test report (A§8, D147).
 *
 * **One grid, not a stack of reports.** The addendum asks for every result
 * against every planned test with its limit, method, facility and verdict, and
 * the reason it is one table is the determination at the bottom: an officer
 * deciding whether a product conforms has to read down a single column of
 * verdicts. Three separate reports stapled together is what he has already got.
 *
 * **The facility column is the merged grouping cell** — the document table
 * convention: full grid, one row per test, the grouping column `rowSpan`-merged
 * and emitted on the first row only. Here it carries the office and the report
 * number, so every line can be traced back to the signed paper it came from.
 *
 * **English, deliberately, in a family of Bengali documents.** Every row is
 * lifted verbatim from a wing's own report — parameter names, limits and
 * methods are English in the wings' `.xlsx` files and on their printed forms —
 * and translating a limit is how a limit changes meaning. The headings and the
 * determination are given in both.
 *
 * Screen and PDF are the same page, as everywhere else.
 */

const VERDICT_LABEL: Record<string, string> = {
  pass: "Pass",
  fail: "Fail",
  inconclusive: "Inconclusive",
  not_tested: "Not tested",
};

export default function ConsolidatedReportDocument({
  org,
  report,
  pdfHref,
  backHref,
}: {
  org: OrgInfo;
  report: ConsolidatedReport;
  pdfHref: string;
  backHref: string;
}) {
  const cell = "border border-rule-strong px-2 py-1.5 align-top";
  const head = `${cell} bg-rule/20 text-left font-semibold`;

  return (
    <div className="min-h-screen bg-muted px-4 py-8 print:m-0 print:min-h-0 print:bg-white print:p-0">
      <div className="print:hidden mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3">
        <a href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to the file
        </a>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Printer className="h-3.5 w-3.5" strokeWidth={1.8} />
            Print
          </button>
          <a
            href={pdfHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
            PDF
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-4xl border border-rule bg-paper px-10 py-8 text-[10.5pt] leading-[1.6] shadow-sm print:border-none print:px-0 print:shadow-none">
        <GovHeader org={org} />

        <div className="mt-6 text-center">
          <h1 className="font-bn-serif text-[13pt] font-semibold">সমন্বিত পরীক্ষা প্রতিবেদন</h1>
          <p className="text-[10pt] tracking-wide text-ink-3">CONSOLIDATED TEST REPORT</p>
        </div>

        {/* Identity. A label/value table stays two-column — the grid is for
            tabulated data with a repeating shape. */}
        <table className="mt-6 w-full border-collapse">
          <tbody>
            <tr>
              <td className={`${cell} w-44 bg-rule/20 font-semibold`}>Application No.</td>
              <td className={`${cell} font-mono`}>{report.applicationNo ?? "—"}</td>
              <td className={`${cell} w-40 bg-rule/20 font-semibold`}>Compiled on</td>
              <td className={cell}>{report.compiledOn}</td>
            </tr>
            <tr>
              <td className={`${cell} bg-rule/20 font-semibold`}>Applicant</td>
              <td className={cell} colSpan={3}>{report.company}</td>
            </tr>
            <tr>
              <td className={`${cell} bg-rule/20 font-semibold`}>Factory</td>
              <td className={cell} colSpan={3}>
                {[report.factory, report.factoryDistrict].filter(Boolean).join(", ")}
              </td>
            </tr>
            <tr>
              <td className={`${cell} bg-rule/20 font-semibold`}>Product</td>
              <td className={cell} colSpan={3}>{report.product ?? "—"}</td>
            </tr>
            <tr>
              <td className={`${cell} bg-rule/20 font-semibold`}>Specification</td>
              <td className={cell} colSpan={3}>
                {report.standards.length ? report.standards.join(", ") : "—"}
              </td>
            </tr>
            <tr>
              <td className={`${cell} bg-rule/20 font-semibold`}>Inspection order</td>
              <td className={cell}>
                <span className="font-mono">{report.orderNo ?? "—"}</span>
                {report.inspectedOn && (
                  <span className="text-ink-3"> · visited {report.inspectedOn}</span>
                )}
              </td>
              <td className={`${cell} bg-rule/20 font-semibold`}>Reports compiled</td>
              <td className={cell}>{report.reports}</td>
            </tr>
          </tbody>
        </table>

        {/* The results. Full grid, one row per test, facility merged. */}
        <h2 className="mt-7 text-[11pt] font-semibold">
          Test results <span className="font-normal text-ink-3">· পরীক্ষার ফলাফল</span>
        </h2>
        <table className="mt-1.5 w-full border-collapse">
          <thead>
            <tr>
              <th className={`${head} w-8`}>Sl.</th>
              <th className={head}>Test</th>
              <th className={`${head} w-40`}>Standard limit</th>
              <th className={`${head} w-28`}>Result</th>
              <th className={`${head} w-20`}>Verdict</th>
              <th className={`${head} w-28`}>Method</th>
              <th className={`${head} w-40`}>Facility</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let sl = 0;
              return report.sections.map((s) => (
                <React.Fragment key={s.orderId}>
                  {s.rows.map((r, i) => {
                    sl++;
                    return (
                      <tr key={`${s.orderId}-${r.sl}`}>
                        <td className={cell}>{sl}</td>
                        <td className={cell}>{r.description}</td>
                        <td className={cell}>
                          {r.standardLimit ?? "—"}
                          {r.isDeclared && (
                            <span className="ml-1 text-[8.5pt] text-ink-3">(declared)</span>
                          )}
                        </td>
                        <td className={`${cell} font-medium`}>{r.result ?? "—"}</td>
                        <td
                          className={`${cell} font-semibold ${
                            r.verdict === "fail" ? "text-red-700" : ""
                          }`}
                        >
                          {VERDICT_LABEL[r.verdict] ?? r.verdict}
                        </td>
                        <td className={`${cell} text-[9.5pt]`}>{r.method ?? "—"}</td>
                        {i === 0 && (
                          <td className={cell} rowSpan={s.rows.length || 1}>
                            <span className="block font-medium">{s.officeName}</span>
                            <span className="block text-[9pt] text-ink-3">{s.wingTitle}</span>
                            <span className="mt-1 block font-mono text-[8.5pt] text-ink-3">
                              {s.reportNo ?? "—"}
                            </span>
                            {s.referrals.map((x) => (
                              <span key={x.referralNo} className="mt-1 block text-[8.5pt] text-ink-3">
                                via {x.labName}
                              </span>
                            ))}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ));
            })()}
          </tbody>
        </table>

        {/* The determination. */}
        <h2 className="mt-7 text-[11pt] font-semibold">
          Determination <span className="font-normal text-ink-3">· সিদ্ধান্ত</span>
        </h2>
        <table className="mt-1.5 w-full border-collapse">
          <tbody>
            <tr>
              <td className={`${cell} w-44 bg-rule/20 font-semibold`}>Tests performed</td>
              <td className={cell}>{report.totals.tested}</td>
              <td className={`${cell} w-28 bg-rule/20 font-semibold`}>Passed</td>
              <td className={cell}>{report.totals.passed}</td>
              <td className={`${cell} w-28 bg-rule/20 font-semibold`}>Failed</td>
              <td className={`${cell} font-semibold ${report.totals.failed ? "text-red-700" : ""}`}>
                {report.totals.failed}
              </td>
            </tr>
          </tbody>
        </table>

        <p
          className={`mt-3 border px-3 py-2.5 text-[11pt] font-semibold ${
            report.verdict === "fail"
              ? "border-red-300 text-red-800"
              : "border-rule-strong text-ink"
          }`}
        >
          {report.verdict === "fail"
            ? `The sample does NOT conform to ${report.standards.join(", ") || "the specification"} in respect of ${report.totals.failed} of ${report.totals.tested} tested parameters.`
            : `The sample CONFORMS to ${report.standards.join(", ") || "the specification"} in respect of all ${report.totals.tested} tested parameters.`}
        </p>

        {report.failures.length > 0 && (
          <>
            <h3 className="mt-5 text-[10.5pt] font-semibold text-red-800">
              Parameters not conforming
            </h3>
            <table className="mt-1.5 w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${head} w-8`}>Sl.</th>
                  <th className={head}>Test</th>
                  <th className={`${head} w-28`}>Result</th>
                  <th className={`${head} w-40`}>Facility</th>
                </tr>
              </thead>
              <tbody>
                {report.failures.map((f, i) => (
                  <tr key={`${f.description}-${i}`}>
                    <td className={cell}>{i + 1}</td>
                    <td className={cell}>{f.description}</td>
                    <td className={`${cell} font-medium`}>{f.result ?? "—"}</td>
                    <td className={cell}>{f.officeName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Where every figure came from. A compiled document that cannot be
            traced back to the signed reports behind it is an assertion. */}
        <h2 className="mt-7 text-[11pt] font-semibold">
          Reports compiled <span className="font-normal text-ink-3">· সংকলিত প্রতিবেদন</span>
        </h2>
        <table className="mt-1.5 w-full border-collapse">
          <thead>
            <tr>
              <th className={`${head} w-8`}>Sl.</th>
              <th className={head}>Report No.</th>
              <th className={head}>Package</th>
              <th className={`${head} w-40`}>Laboratory</th>
              <th className={`${head} w-28`}>Tested to</th>
              <th className={`${head} w-40`}>Authorised by</th>
            </tr>
          </thead>
          <tbody>
            {report.sections.map((s, i) => (
              <tr key={s.orderId}>
                <td className={cell}>{i + 1}</td>
                <td className={`${cell} font-mono text-[9pt]`}>{s.reportNo ?? "—"}</td>
                <td className={cell}>{s.packageName}</td>
                <td className={cell}>{s.officeName}</td>
                <td className={cell}>{s.testedOn ?? "—"}</td>
                <td className={cell}>{s.authorisedBy ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 border-t border-rule pt-3 text-[9.5pt] text-ink-3">
          <p>
            This report is compiled by the system from the approved test reports listed above. It
            restates their findings and adds no observation of its own; each signed report remains
            the evidence for the figures attributed to it.
          </p>
          <p className="mt-1">
            The results pertain only to the samples drawn under inspection order{" "}
            <span className="font-mono">{report.orderNo ?? "—"}</span> and tested at the
            laboratories named.
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
