"use client";

import { Download, Printer } from "lucide-react";

/**
 * The test report, in the wing's own printed format (D145).
 *
 * Laid out from the paper form the client supplied: a masthead naming the
 * **wing** rather than the office, a two-column identification block, the
 * five-column results table, the conforms/does-not remark, three signature
 * blocks and the five standing notes.
 *
 * **A seal, not a signature.** `Employee` carries no signature image — only
 * `DirectorGeneral` does — so each block prints a ruled box with the name,
 * designation, wing and office, and the date the step was taken. It is what a
 * rubber stamp says, and it does not pretend to be a hand. The moment
 * signatures exist the box is where the image goes.
 *
 * **Readable at every stage.** A draft has no number, unsigned blocks and a
 * watermark saying so — because the officer about to send it up needs to read
 * exactly what the next desk will read, and a document that only exists once
 * approved cannot be checked before it is.
 *
 * Screen and PDF are the same page; the toolbar is `print:hidden`.
 */

export type ReportView = {
  orderCode: string;
  state: string;
  isDraft: boolean;
  reportNo: string | null;
  labRegNo: string;
  labReferenceNo: string;
  wingTitle: string;
  officeName: string;
  officeAddress: string;
  officePhone: string | null;
  packageName: string;
  productName: string;
  specification: string | null;
  receivedOn: string | null;
  testingFrom: string | null;
  testingTo: string | null;
  urgent: boolean;
  condition: string;
  specimens: { labCode: string; specimenNo: number }[];
  referrals: { referralNo: string; labName: string }[];
  rows: {
    sl: number;
    description: string;
    standardLimit: string | null;
    isDeclared: boolean;
    result: string | null;
    verdict: string;
    method: string | null;
  }[];
  remark: string;
  remarks: string | null;
  seals: {
    label: string;
    name: string;
    designation: string | null;
    wing: string | null;
    office: string;
    at: string | null;
  }[];
};

const NOTES = [
  "The results reported above pertain only to the sample supplied to & tested in the Laboratories.",
  "The report when required to be quoted or reproduced, has to be reproduced or quoted in full.",
  "Reports are not allowed to be used or reproduced for any commercial purpose.",
  "Any complaint about test report should be reported within a month.",
  "The unspent portion of the samples may be auctioned/disposed off after three months from the date of issue of said report.",
];

export default function ReportDocument({
  report,
  pdfHref,
  backHref,
}: {
  report: ReportView;
  pdfHref: string;
  backHref: string;
}) {
  return (
    <div className="bg-muted px-4 py-8 print:m-0 print:bg-white print:p-0">
      <div className="print:hidden mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3">
        <a href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to the work order
        </a>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary/40 hover:text-primary"
          >
            <Printer className="h-4 w-4" strokeWidth={1.8} />
            Print
          </button>
          <a
            href={pdfHref}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Download className="h-4 w-4" strokeWidth={1.8} />
            Download PDF
          </a>
        </div>
      </div>

      <div className="relative mx-auto max-w-4xl border border-rule bg-paper text-[10.5pt] leading-snug shadow-sm print:border-none print:shadow-none">
        {/* **Said on the page, not only in the chrome.** A printed draft that
            does not announce itself is a document somebody will file. */}
        {report.isDraft && (
          <p className="absolute right-6 top-4 rounded border-2 border-ink px-2 py-0.5 font-mono text-[9pt] font-bold uppercase tracking-widest">
            Draft — not approved
          </p>
        )}

        <div className="px-10 py-8 print:px-8 print:py-6">
          <header className="text-center">
            <h1 className="font-serif text-[13pt] font-bold uppercase tracking-wide">
              Bangladesh Standards and Testing Institution
            </h1>
            <p className="text-[11pt] font-semibold">({report.wingTitle})</p>
            <p className="text-[10pt]">{report.officeAddress}</p>
            {report.officePhone && <p className="text-[10pt]">Phone: {report.officePhone}</p>}
            <p className="mx-auto mt-3 w-fit border border-ink px-6 py-0.5 font-semibold">
              Test Report
            </p>
          </header>

          {/* The two-column identification block, as the form arranges it. */}
          <div className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            <div className="space-y-1">
              <Field label="Test report No." value={report.reportNo ?? "— not yet numbered —"} />
              <Field label="Date of received of sample" value={report.receivedOn ?? "—"} />
              <Field label="Identification of test item" value={report.packageName} />
              <Field label="Product" value={report.productName} />
              <Field label="Lab. Reg. No" value={report.labRegNo} demo />
              <Field label="Work order" value={report.orderCode} mono />
            </div>
            <div className="space-y-1">
              <Field label="Lab Reference No." value={report.labReferenceNo} demo />
              <Field
                label="Date of testing"
                value={
                  report.testingFrom
                    ? `${report.testingFrom} to ${report.testingTo ?? "—"}`
                    : "—"
                }
              />
              <Field label="Sampling plan" value="As per the sampling letter" />
              <Field label="Test method/Specification used" value={report.specification ?? "—"} />
              <Field label="Priority" value={report.urgent ? "URGENT" : "Normal"} />
            </div>
          </div>

          <p className="mt-3">
            <span className="text-ink-2">Condition of test item:</span> {report.condition}
          </p>
          <p className="mt-1">
            <span className="text-ink-2">Specimens:</span>{" "}
            {report.specimens.map((s) => s.labCode).join(", ") || "—"}
          </p>

          {/* A full grid, the house rule for a generated document. */}
          <table className="mt-3 w-full border-collapse border border-rule text-[9.5pt]">
            <thead>
              <tr className="bg-secondary/40">
                <th className="w-10 border border-rule px-1.5 py-1 text-left">SL. No.</th>
                <th className="border border-rule px-1.5 py-1 text-left">Description of tests</th>
                <th className="border border-rule px-1.5 py-1 text-left">Standard limits</th>
                <th className="border border-rule px-1.5 py-1 text-left">Test Results</th>
                <th className="w-32 border border-rule px-1.5 py-1 text-left">
                  Reference test Method
                </th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.sl}>
                  <td className="border border-rule px-1.5 py-1 align-top">{r.sl}</td>
                  <td className="border border-rule px-1.5 py-1 align-top">{r.description}</td>
                  <td className="border border-rule px-1.5 py-1 align-top">
                    {r.standardLimit ?? "—"}
                    {/* Whose figure it is, said on the report itself: the
                        specification delegated it and the manufacturer stated
                        it (D144). */}
                    {r.isDeclared && (
                      <span className="ml-1 text-[8pt] text-ink-2">(declared)</span>
                    )}
                  </td>
                  <td className="border border-rule px-1.5 py-1 align-top">
                    {r.result ?? <span className="text-ink-2">not recorded</span>}
                  </td>
                  <td className="border border-rule px-1.5 py-1 align-top">{r.method ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-3">
            <span className="text-ink-2">Remarks:</span> <strong>{report.remark}</strong>
          </p>
          {report.remarks && <p className="mt-1 text-[10pt]">{report.remarks}</p>}

          {/* Where part of the work was run outside, the report says so and
              names the laboratory — the accountable unit is still BSTI (D140),
              but a reader is entitled to know which bench produced a figure. */}
          {report.referrals.length > 0 && (
            <p className="mt-2 text-[9.5pt]">
              <span className="text-ink-2">Tests carried out at an accredited outside
              laboratory:</span>{" "}
              {report.referrals.map((r) => `${r.labName} (${r.referralNo})`).join("; ")}
            </p>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {report.seals.map((s) => (
              <div key={s.label} className="text-center">
                <p className="mb-1 text-[9.5pt] text-ink-2">{s.label}</p>
                {/* The seal. A ruled box saying who acted and when — what a
                    rubber stamp says. `Employee` carries no signature image, so
                    nothing here pretends to be a hand. */}
                <div
                  className={`mx-auto flex min-h-[72px] flex-col justify-center border px-2 py-1.5 ${
                    s.name ? "border-ink" : "border-dashed border-rule"
                  }`}
                >
                  {s.name ? (
                    <>
                      <p className="font-semibold leading-tight">{s.name}</p>
                      {s.designation && <p className="text-[9pt] leading-tight">{s.designation}</p>}
                      {s.wing && <p className="text-[9pt] leading-tight">{s.wing}</p>}
                      <p className="text-[9pt] leading-tight">{s.office}</p>
                      {s.at && <p className="mt-0.5 text-[8.5pt] text-ink-2">{s.at}</p>}
                    </>
                  ) : (
                    <p className="text-[9pt] text-ink-2">awaiting</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-[9pt] leading-snug">
            <p className="font-semibold">N.B:</p>
            <ol className="ml-4 list-[lower-roman] space-y-0.5">
              {NOTES.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, mono, demo,
}: {
  label: string;
  value: string;
  mono?: boolean;
  demo?: boolean;
}) {
  return (
    <p>
      <span className="text-ink-2">{label}:</span>{" "}
      <span className={mono ? "font-mono" : undefined}>{value}</span>
      {/* **A placeholder that says so.** These two series are not generated by
          this system yet, and a fabricated government number that does not
          announce itself is the one thing a report must not carry. */}
      {demo && (
        <span className="ml-1 rounded border border-rule px-1 text-[8pt] uppercase text-ink-2">
          demo
        </span>
      )}
    </p>
  );
}
