"use client";

import { Download, Printer } from "lucide-react";
import GovHeader from "@/components/GovHeader";
import { toBengaliDigits } from "@/lib/bengali";
import type { OrgInfo } from "@/lib/types";

/**
 * প্রারম্ভিক পরিদর্শন প্রতিবেদন as the printed document (D86).
 *
 * The wing's paper form is a form — boxes to fill. This is the *filled* thing:
 * the boxes that were only there to be written in are gone, and what remains is
 * what the officer found. Sections keep the wing's numbering so an officer
 * reading it recognises the shape.
 *
 * Screen and PDF are the same page, as the office order and the salary slip
 * are: the toolbar is `print:hidden` and Puppeteer loads this URL.
 */

export type PrintedReport = {
  reportNo: string | null;
  approvedOn: string | null;
  preparedBy: { name: string; designation: string | null };
  approvedBy: { name: string; designation: string | null } | null;
  inspectedOn: string | null;
  orderNo: string | null;
  applicationNo: string | null;
  product: string | null;
  standards: string[];
  applicant: string | null;
  company: string;
  companyAddress: string | null;
  factory: string;
  factoryAddress: string | null;
  govtApprovalOk: boolean | null;
  govtApprovalNote: string | null;
  declaredCapacity: string | null;
  foundCapacity: string | null;
  utilisationPercent: string | null;
  unitCostTaka: string | null;
  remarks: string | null;
  team: { name: string; designation: string | null }[];
  conditions: { labelBn: string; satisfactory: boolean; note: string | null }[];
  markings: { labelBn: string; present: boolean }[];
  narrative: { labelBn: string; text: string }[];
};

export default function ReportDocument({
  org,
  report,
  pdfHref,
}: {
  org: OrgInfo;
  report: PrintedReport;
  pdfHref: string;
}) {
  return (
    <div className="min-h-screen bg-muted px-4 py-8 print:m-0 print:bg-white print:p-0">
      <div className="print:hidden mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3">
        <a href="/workflow" className="text-sm text-muted-foreground hover:text-foreground">
          ← All files
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

      <div className="mx-auto max-w-4xl border border-rule bg-paper font-bn-serif text-[11pt] leading-[1.65] shadow-sm print:border-none print:shadow-none">
        <div className="px-12 py-8 print:px-10 print:py-8">
          <GovHeader org={org} />

          <div className="mt-5 flex items-start justify-between gap-6">
            <div>
              <span className="text-ink-2">নং:</span>{" "}
              <span className="font-mono">{report.reportNo ?? "—"}</span>
            </div>
            <div>
              <span className="text-ink-2">তারিখ:</span> {report.approvedOn ?? "—"}
            </div>
          </div>

          <h1 className="mt-5 text-center text-[13pt] font-semibold">
            (কারখানা/প্রতিষ্ঠানসমূহে প্রারম্ভিক পরিদর্শন প্রতিবেদন)
          </h1>

          <Section n="১" title="সাধারণ তথ্যাবলী" />
          <Field label="পরিদর্শনকারী কর্মকর্তার নাম ও পদবী">
            {report.team.length
              ? report.team.map((t) => `${t.name}${t.designation ? `, ${t.designation}` : ""}`).join("; ")
              : `${report.preparedBy.name}${report.preparedBy.designation ? `, ${report.preparedBy.designation}` : ""}`}
          </Field>
          <Field label="ক) উৎপাদিত পণ্যের নাম">{report.product ?? "—"}</Field>
          <Field label="বিডিএস নং">{report.standards.join(", ") || "—"}</Field>
          <Field label="খ) দরখাস্তকারীর নাম ও পদবি">{report.applicant ?? "—"}</Field>
          <Field label="গ) প্রতিষ্ঠানের নাম ও ঠিকানা">
            {report.company}
            {report.companyAddress ? `, ${report.companyAddress}` : ""}
          </Field>
          <Field label="ঘ) কারখানার অবস্থানের ঠিকানা">
            {report.factory}
            {report.factoryAddress ? `, ${report.factoryAddress}` : ""}
          </Field>
          <Field label="ঙ) সরকারি অনুমোদন">
            {report.govtApprovalOk === null ? "—" : report.govtApprovalOk ? "সঠিক" : "সঠিক নয়"}
            {report.govtApprovalNote ? ` — ${report.govtApprovalNote}` : ""}
          </Field>
          {report.orderNo && (
            <Field label="পরিদর্শন আদেশ">
              <span className="font-mono">{report.orderNo}</span>
              {report.inspectedOn ? `, পরিদর্শনের তারিখ ${report.inspectedOn}` : ""}
            </Field>
          )}

          <Section n="২" title="পণ্যের উৎপাদন সম্পর্কিত তথ্যাবলী" />
          <p className="mt-2 font-semibold">(খ) স্বাস্থ্য ও পরিবেশগত অবস্থা</p>
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr className="border-y border-rule bg-rule/20">
                <th className="px-2 py-1 text-left font-semibold">বিষয়</th>
                <th className="w-40 px-2 py-1 text-left font-semibold">অবস্থা</th>
                <th className="px-2 py-1 text-left font-semibold">মন্তব্য</th>
              </tr>
            </thead>
            <tbody>
              {report.conditions.map((c) => (
                <tr key={c.labelBn} className="border-b border-rule">
                  <td className="px-2 py-1">{c.labelBn}</td>
                  <td className="px-2 py-1">{c.satisfactory ? "সন্তোষজনক" : "সন্তোষজনক নয়"}</td>
                  <td className="px-2 py-1">{c.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Declared beside found: the whole reason an inspection happens. */}
          <p className="mt-4 font-semibold">(ঙ–ছ) উৎপাদন</p>
          <table className="mt-1.5 w-full border-collapse">
            <tbody>
              <Two label="ঘোষিত উৎপাদন ক্ষমতা" value={report.declaredCapacity ?? "—"} />
              <Two label="পরিদর্শনে প্রাপ্ত উৎপাদন ক্ষমতা" value={report.foundCapacity ?? "—"} />
              <Two
                label="উৎপাদন ক্ষমতার ভিত্তিতে উৎপাদনের শতকরা হার"
                value={report.utilisationPercent ? `${toBengaliDigits(report.utilisationPercent)}%` : "—"}
              />
              <Two
                label="ইউনিট প্রতি উৎপাদন মূল্য"
                value={report.unitCostTaka ? `৳ ${toBengaliDigits(report.unitCostTaka)}` : "—"}
              />
            </tbody>
          </table>

          <p className="mt-4 font-semibold">(জ) মোড়কীকরণ এবং চিহ্নিতকরণ</p>
          <table className="mt-1.5 w-full border-collapse">
            <tbody>
              {report.markings.map((m, i) => (
                <tr key={m.labelBn} className="border-b border-rule">
                  <td className="w-10 px-2 py-1">{toBengaliDigits(i + 1)}</td>
                  <td className="px-2 py-1">{m.labelBn}</td>
                  <td className="w-24 px-2 py-1">{m.present ? "আছে" : "নাই"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Section n="৩–৪" title="পরীক্ষণ পদ্ধতি, সিএম ফি ও মান চিহ্ন" />
          {report.narrative.map((n) => (
            <Field key={n.labelBn} label={n.labelBn}>
              {n.text}
            </Field>
          ))}
          {report.remarks && <Field label="মন্তব্য">{report.remarks}</Field>}

          <div className="mt-16 flex justify-between gap-8">
            <Sign caption="স্বাক্ষর ও সিল — আবেদনকারী/প্রতিনিধি" />
            <Sign
              caption="স্বাক্ষর ও সিল — পরিদর্শনকারী কর্মকর্তা"
              name={report.preparedBy.name}
              designation={report.preparedBy.designation}
            />
          </div>

          {report.approvedBy && (
            <div className="mt-10 border-t border-rule pt-3 text-[10pt] text-ink-3">
              অনুমোদন: {report.approvedBy.name}
              {report.approvedBy.designation ? `, ${report.approvedBy.designation}` : ""} —{" "}
              {report.approvedOn}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            margin: 1.5cm 2cm;
            size: A4;
          }
        }
      `}</style>
    </div>
  );
}

function Section({ n, title }: { n: string; title: string }) {
  return (
    <h2 className="mt-6 border-b border-ink pb-1 text-[12pt] font-semibold">
      {n}। {title}
    </h2>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <span className="text-ink-2">{label}:</span>{" "}
      <span className="whitespace-pre-wrap">{children}</span>
    </div>
  );
}

function Two({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-rule">
      <td className="px-2 py-1 text-ink-2">{label}</td>
      <td className="px-2 py-1 font-medium">{value}</td>
    </tr>
  );
}

function Sign({
  caption,
  name,
  designation,
}: {
  caption: string;
  name?: string;
  designation?: string | null;
}) {
  return (
    <div className="text-center text-[10.5pt]">
      <div className="h-12" />
      <div className="border-t border-ink pt-1">
        {name && <div className="font-semibold">{name}</div>}
        {designation && <div className="text-ink-2">{designation}</div>}
        <div className="text-ink-2">{caption}</div>
      </div>
    </div>
  );
}
