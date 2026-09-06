"use client";

import { Download, Printer } from "lucide-react";
import GovHeader from "@/components/GovHeader";
import { toBengaliDigits } from "@/lib/bengali";
import type { OrgInfo } from "@/lib/types";

/**
 * নমুনা জমাদান পত্র — the applicant's instruction to deliver the sealed boxes
 * (D98).
 *
 * The one letter of the three that asks something of the person reading it, so
 * it is written as an instruction and not as a notification: which box, whose
 * counter, and what happens if a seal is broken. **Seal numbers are printed in
 * full**, because they are what the counter checks the box against and what
 * makes a short consignment visible at the counter rather than at a laboratory
 * bench a week later (D72).
 *
 * Screen and PDF are the same page — the toolbar is `print:hidden`, as on the
 * office order and the salary slip.
 */

export type LetterView = {
  letterNo: string;
  issuedOn: string;
  dueOn: string;
  issuedBy: { name: string; designation: string | null };
  applicationNo: string | null;
  product: string | null;
  company: string;
  companyAddress: string | null;
  factory: string;
  factoryAddress: string | null;
  inspectedOn: string | null;
  reportNo: string | null;
  boxes: {
    code: string;
    sealNo: string;
    labName: string;
    discipline: string;
    officeName: string;
    officeAddress: string | null;
    specimenCount: number;
    submitted: boolean;
  }[];
};

export default function LetterDocument({
  org,
  letter,
  pdfHref,
  backHref,
}: {
  org: OrgInfo;
  letter: LetterView;
  pdfHref: string;
  backHref: string;
}) {
  const total = letter.boxes.reduce((n, b) => n + b.specimenCount, 0);

  return (
    <div className="bg-muted px-4 py-8 print:m-0 print:bg-white print:p-0">
      <div className="print:hidden mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3">
        <a href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to the application
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

      <div className="mx-auto max-w-4xl border border-rule bg-paper font-bn-serif text-[11pt] leading-[1.7] shadow-sm print:border-none print:shadow-none">
        <div className="px-12 py-8 print:px-10 print:py-8">
          <GovHeader org={org} />

          <div className="mt-5 flex items-start justify-between gap-6">
            <div>
              <span className="text-ink-2">স্মারক নং:</span>{" "}
              <span className="font-mono">{letter.letterNo}</span>
            </div>
            <div>
              <span className="text-ink-2">তারিখ:</span> {letter.issuedOn}
            </div>
          </div>

          <div className="mt-5">
            <p>বরাবর,</p>
            <p className="ml-5 font-semibold">{letter.company}</p>
            {letter.companyAddress && <p className="ml-5">{letter.companyAddress}</p>}
          </div>

          <p className="mt-5">
            <span className="font-semibold">বিষয়:</span> সংগৃহীত ও সীলমোহরকৃত নমুনা
            পরীক্ষাগারে জমাদান প্রসঙ্গে।
          </p>

          <p className="mt-5 text-justify">
            জনাব, উপর্যুক্ত বিষয়ে জানানো যাচ্ছে যে, আপনার{" "}
            <span className="font-semibold">{letter.factory}</span>
            {letter.factoryAddress ? `, ${letter.factoryAddress}` : ""} — এ{" "}
            {letter.inspectedOn ? `${letter.inspectedOn} তারিখে ` : ""}
            পরিচালিত পরিদর্শনকালে{" "}
            {letter.product ? (
              <>
                <span className="font-semibold">{letter.product}</span> পণ্যের{" "}
              </>
            ) : null}
            নমুনা সংগ্রহ করে যৌথ স্বাক্ষরে সীলমোহর করা হয়েছে এবং আপনার জিম্মায়
            প্রদান করা হয়েছে। নিম্নবর্ণিত সীলমোহরকৃত বাক্সসমূহ সংশ্লিষ্ট
            কার্যালয়ের ওয়ান স্টপ সার্ভিস সেন্টারে জমা প্রদানের জন্য অনুরোধ করা
            হলো।
          </p>

          <table className="mt-4 w-full border-collapse text-[10.5pt]">
            <thead>
              <tr className="border-y border-rule bg-rule/20">
                <th className="w-8 px-2 py-1.5 text-left font-semibold">ক্রঃ</th>
                <th className="px-2 py-1.5 text-left font-semibold">বাক্স ও সীল নং</th>
                <th className="px-2 py-1.5 text-left font-semibold">যে কার্যালয়ে জমা দিতে হবে</th>
                <th className="px-2 py-1.5 text-left font-semibold">পরীক্ষাগার</th>
                <th className="w-16 px-2 py-1.5 text-left font-semibold">নমুনা</th>
              </tr>
            </thead>
            <tbody>
              {letter.boxes.map((b, i) => (
                <tr key={b.code} className="border-b border-rule align-top">
                  <td className="px-2 py-1.5">{toBengaliDigits(i + 1)}</td>
                  <td className="px-2 py-1.5">
                    <div className="font-mono text-[10pt]">{b.code}</div>
                    <div className="font-mono text-[10pt] text-ink-2">সীল: {b.sealNo}</div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div>ওয়ান স্টপ সার্ভিস সেন্টার</div>
                    <div className="text-ink-2">{b.officeName}</div>
                    {b.officeAddress && (
                      <div className="text-[9.5pt] text-ink-3">{b.officeAddress}</div>
                    )}
                  </td>
                  <td className="px-2 py-1.5">{b.labName}</td>
                  <td className="px-2 py-1.5">{toBengaliDigits(b.specimenCount)} টি</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-2 text-[10pt] text-ink-2">
            সর্বমোট {toBengaliDigits(letter.boxes.length)} টি সীলমোহরকৃত বাক্সে{" "}
            {toBengaliDigits(total)} টি নমুনা।
          </p>

          <ol className="mt-5 list-decimal space-y-1.5 pl-6 text-justify">
            <li>
              <span className="font-semibold">সীল অক্ষত থাকা আবশ্যক।</span> সীল
              ভাঙা বা ক্ষতিগ্রস্ত অবস্থায় কোনো বাক্স গ্রহণ করা হবে না; সেক্ষেত্রে
              পুনরায় নমুনা সংগ্রহের প্রয়োজন হবে।
            </li>
            <li>
              প্রতিটি বাক্স উপরে উল্লিখিত নির্দিষ্ট কার্যালয়ে জমা দিতে হবে। একাধিক
              কার্যালয়ের ক্ষেত্রে প্রতিটিতে পৃথকভাবে জমা প্রদান করতে হবে।
            </li>
            <li>
              জমাদানের সময় এই পত্রের অনুলিপি সঙ্গে আনতে হবে।
            </li>
            <li>
              অনুগ্রহপূর্বক <span className="font-semibold">{letter.dueOn}</span>{" "}
              তারিখের মধ্যে জমা প্রদান করুন। বিলম্বে নমুনার গুণগত মান পরিবর্তিত
              হতে পারে।
            </li>
            <li>
              পরীক্ষণ ফি সংশ্লিষ্ট পরীক্ষাগারের চাহিদা অনুযায়ী পৃথকভাবে জানানো
              হবে।
            </li>
          </ol>

          <div className="mt-12 flex justify-end">
            <div className="text-center text-[10.5pt]">
              <div className="h-12" />
              <div className="border-t border-ink pt-1">
                <div className="font-semibold">{letter.issuedBy.name}</div>
                <div className="text-ink-2">{letter.issuedBy.designation ?? ""}</div>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-rule pt-2 text-[9.5pt] text-ink-3">
            আবেদন নং: {letter.applicationNo ?? "—"}
            {letter.reportNo ? ` · পরিদর্শন প্রতিবেদন: ${letter.reportNo}` : ""}
          </div>
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
