"use client";

import { Download, Printer } from "lucide-react";
import GovHeader from "@/components/GovHeader";
import { toBengaliDigits } from "@/lib/bengali";
import type { OrgInfo } from "@/lib/types";

/**
 * নমুনা সংগ্রহ প্রতিবেদন — what was drawn at the visit (D96).
 *
 * **Almost entirely derived.** The sub-products, variants, laboratories,
 * specimen counts and seal numbers are already rows, written when the officer
 * sealed the jars (D87); re-typing them into a report would be a second copy to
 * disagree with the first. What the officer adds is the paragraph only he can
 * write — quantity drawn, condition of the goods, whatever the seal numbers do
 * not say.
 *
 * **It carries the inspection report's number, not one of its own.** One visit,
 * one approval: a separate serial would imply the two could be approved apart,
 * which is exactly what D92 refuses.
 *
 * Screen and PDF are the same page, as everywhere else.
 */

export type SamplingReportView = {
  reportNo: string | null;
  approvedOn: string | null;
  preparedBy: { name: string; designation: string | null };
  approvedBy: { name: string; designation: string | null } | null;
  inspectedOn: string | null;
  orderNo: string | null;
  applicationNo: string | null;
  product: string | null;
  company: string;
  factory: string;
  factoryDistrict: string | null;
  remarks: string | null;
  boxes: {
    code: string;
    sealNo: string | null;
    labName: string;
    discipline: string;
    officeName: string;
    specimens: {
      subProductName: string;
      brand: string;
      variant: string | null;
      size: string;
      specimenNo: number;
      parameterCount: number;
    }[];
  }[];
};

export default function SamplingReportDocument({
  org,
  report,
  pdfHref,
}: {
  org: OrgInfo;
  report: SamplingReportView;
  pdfHref: string;
}) {
  const total = report.boxes.reduce((n, b) => n + b.specimens.length, 0);

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

          <h1 className="mt-5 text-center text-[13pt] font-semibold">নমুনা সংগ্রহ প্রতিবেদন</h1>
          <p className="text-center text-[10pt] text-ink-2">
            (পরিদর্শন প্রতিবেদনের অংশ — একই পরিদর্শনের নমুনা সংক্রান্ত বিবরণ)
          </p>

          <div className="mt-5 space-y-1">
            <Row label="প্রতিষ্ঠান" value={report.company} />
            <Row
              label="কারখানা"
              value={[report.factory, report.factoryDistrict].filter(Boolean).join(", ")}
            />
            <Row label="পণ্য" value={report.product} />
            <Row label="আবেদন নং" value={report.applicationNo} mono />
            <Row label="পরিদর্শন আদেশ" value={report.orderNo} mono />
            <Row label="পরিদর্শনের তারিখ" value={report.inspectedOn} />
            <Row
              label="সর্বমোট নমুনা"
              value={`${toBengaliDigits(total)} টি, ${toBengaliDigits(report.boxes.length)} টি সীলকৃত বাক্সে`}
            />
          </div>

          {report.boxes.map((b) => (
            <div key={b.code} className="mt-6">
              <p className="font-semibold">
                {b.labName}
                <span className="ml-2 text-[10pt] font-normal text-ink-2">
                  {b.officeName} · {b.discipline}
                </span>
              </p>
              <p className="text-[10pt] text-ink-2">
                বাক্স <span className="font-mono">{b.code}</span>
                {b.sealNo && (
                  <>
                    {" · সীল "}
                    <span className="font-mono">{b.sealNo}</span>
                  </>
                )}
                {" · "}
                {toBengaliDigits(b.specimens.length)} টি নমুনা
              </p>

              <table className="mt-1.5 w-full border-collapse">
                <thead>
                  <tr className="border-y border-rule bg-rule/20">
                    <th className="w-10 px-2 py-1 text-left font-semibold">ক্রঃ</th>
                    <th className="px-2 py-1 text-left font-semibold">উপ-পণ্য</th>
                    <th className="px-2 py-1 text-left font-semibold">ব্র্যান্ড ও আকার</th>
                    <th className="w-20 px-2 py-1 text-left font-semibold">নমুনা নং</th>
                    <th className="w-24 px-2 py-1 text-left font-semibold">পরীক্ষা</th>
                  </tr>
                </thead>
                <tbody>
                  {b.specimens.map((s, i) => (
                    <tr key={`${b.code}-${i}`} className="border-b border-rule">
                      <td className="px-2 py-1">{toBengaliDigits(i + 1)}</td>
                      <td className="px-2 py-1">{s.subProductName}</td>
                      <td className="px-2 py-1">
                        {[s.brand, s.variant, s.size].filter(Boolean).join(" · ")}
                      </td>
                      <td className="px-2 py-1">{toBengaliDigits(s.specimenNo)}</td>
                      <td className="px-2 py-1">{toBengaliDigits(s.parameterCount)} টি</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {report.remarks && (
            <div className="mt-6">
              <p className="font-semibold">মন্তব্য</p>
              <p className="mt-1 whitespace-pre-wrap text-justify">{report.remarks}</p>
            </div>
          )}

          <p className="mt-6 text-justify text-[10.5pt] text-ink-2">
            উপরে বর্ণিত নমুনাসমূহ যৌথ স্বাক্ষরে সীলকৃত করা হয়েছে এবং আবেদনকারীর
            জিম্মায় রাখা হয়েছে। নির্ধারিত ওয়ান স্টপ সার্ভিস সেন্টারে জমাদানের
            সময় সীল অক্ষত থাকা আবশ্যক।
          </p>

          <div className="mt-14 flex justify-end">
            <div className="text-center text-[10.5pt]">
              <div className="h-12" />
              <div className="border-t border-ink pt-1">
                <div className="font-semibold">{report.preparedBy.name}</div>
                <div className="text-ink-2">{report.preparedBy.designation ?? ""}</div>
                <div className="text-ink-2">নমুনা সংগ্রহকারী কর্মকর্তা</div>
              </div>
            </div>
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

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-ink-2">{label}:</span>{" "}
      <span className={mono ? "font-mono" : ""}>{value}</span>
    </div>
  );
}
