"use client";

import { Download, Printer } from "lucide-react";
import GovHeader from "@/components/GovHeader";
import { toBengaliDigits } from "@/lib/bengali";
import type { OrgInfo } from "@/lib/types";
import React from "react";

/**
 * The two letters that go to BSTI's own desks after an approved visit (D95,
 * D130) — one document, because they share a letterhead, a memo number and a
 * box, and differ in what they ask.
 *
 * **The wing-head letter is blinded** (D71). It goes to testing-wing staff, and
 * the variant *is* the applicant's identity, so it names the package, the box,
 * the seal and the jar count and never the company, the factory, the brand or
 * the application number. **The One Stop letter is not**: a counter hands the
 * box back and forth with the person carrying it and checks the fee against
 * their file, so it must name them.
 *
 * **The urgent badge is drawn as a border and bold type, not as a colour**
 * (D134). This page is printed, and a red panel comes off a mono office printer
 * as grey — the one mark on the letter that must survive the photocopier is the
 * one that says how fast the work is wanted.
 *
 * Screen and PDF are the same page — the toolbar is `print:hidden`, as on the
 * office order and the salary slip.
 */

export type InternalLetterView = {
  kind: "wing_head" | "one_stop";
  letterNo: string;
  issuedOn: string;
  dueOn: string;
  issuedBy: { name: string; designation: string | null };
  addressedTo: { name: string; designation: string | null } | null;
  officeNameBn: string;
  box: { code: string; sealNo: string; submitted: boolean; specimenCount: number } | null;
  packages: { name: string; parameters: string[]; specimenCount: number }[];
  feeTaka: string | null;
  feePaid: boolean;
  urgent: boolean;
  applicant: { applicationNo: string | null; company: string; product: string | null } | null;
};

export default function InternalLetterDocument({
  org,
  letter,
  pdfHref,
  backLabel = "Back to my letters",
  backHref,
}: {
  org: OrgInfo;
  letter: InternalLetterView;
  pdfHref: string;
  /** Where the reader came from — the inbox, or the work order (D138). */
  backLabel?: string;
  backHref: string;
}) {
  const isCounter = letter.kind === "one_stop";

  return (
    <div className="bg-muted px-4 py-8 print:m-0 print:bg-white print:p-0">
      <div className="print:hidden mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3">
        <a href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
          ← {backLabel}
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
            <div className="text-right">
              <div>
                <span className="text-ink-2">তারিখ:</span> {letter.issuedOn}
              </div>
              <div className="mt-2 flex justify-end">
                {letter.urgent ? (
                  <span className="rounded-md bg-secondary px-2 py-1 font-mono text-secondary-foreground">
                    URGENT
                  </span>
                ) : (
                  <span className="rounded-md bg-secondary px-2 py-1 font-mono text-secondary-foreground">
                    NORMAL
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <p>বরাবর,</p>
            {isCounter ? (
              <>
                <p className="ml-5 font-semibold">ওয়ান স্টপ সার্ভিস সেন্টার</p>
                <p className="ml-5">{letter.officeNameBn}</p>
              </>
            ) : (
              <>
                <p className="ml-5 font-semibold">{letter.addressedTo?.name ?? "—"}</p>
                {letter.addressedTo?.designation && (
                  <p className="ml-5">{letter.addressedTo.designation}</p>
                )}
                <p className="ml-5">{letter.officeNameBn}</p>
              </>
            )}
          </div>

          <p className="mt-5">
            <span className="font-semibold">বিষয়:</span>{" "}
            {isCounter
              ? "সীলমোহরকৃত নমুনা গ্রহণ প্রসঙ্গে।"
              : "সীলমোহরকৃত নমুনা পরীক্ষণের জন্য প্রেরণ প্রসঙ্গে।"}
          </p>

          <p className="mt-5 text-justify">
            {isCounter ? (
              <>
                জনাব, উপর্যুক্ত বিষয়ে জানানো যাচ্ছে যে,{" "}
                <span className="font-semibold">{letter.applicant?.company ?? "—"}</span>{" "}
                — এর
                {letter.applicant?.product ? (
                  <>
                    {" "}
                    <span className="font-semibold">{letter.applicant.product}</span> পণ্যের
                  </>
                ) : null}{" "}
                সিএম লাইসেন্স আবেদনের বিপরীতে পরিদর্শনকালে সংগৃহীত ও যৌথ স্বাক্ষরে
                সীলমোহরকৃত নিম্নবর্ণিত বাক্সটি আবেদনকারী কর্তৃক আপনার কার্যালয়ের ওয়ান
                স্টপ সার্ভিস সেন্টারে জমা প্রদান করা হবে। বাক্সটি গ্রহণের সময় নিম্নের
                নির্দেশনা অনুসরণের জন্য অনুরোধ করা হলো।
              </>
            ) : (
              <>
                জনাব, উপর্যুক্ত বিষয়ে জানানো যাচ্ছে যে, সিএম লাইসেন্স আবেদনের বিপরীতে
                পরিচালিত কারখানা পরিদর্শনকালে সংগৃহীত ও যৌথ স্বাক্ষরে সীলমোহরকৃত
                নিম্নবর্ণিত নমুনা আপনার কার্যালয়ের ওয়ান স্টপ সার্ভিস সেন্টারের মাধ্যমে
                পরীক্ষণের জন্য প্রেরণ করা হচ্ছে। বিধি মোতাবেক পরীক্ষণ সম্পন্ন করে
                প্রতিবেদন প্রেরণের জন্য অনুরোধ করা হলো।
              </>
            )}
          </p>

          {letter.box && (
            <table className="mt-4 w-full border-collapse text-[10.5pt]">
              <tbody>
                <tr className="border-y border-rule">
                  <td className="w-48 bg-rule/20 px-2 py-1.5 font-semibold">বাক্স নং</td>
                  <td className="px-2 py-1.5 font-mono">{letter.box.code}</td>
                </tr>
                <tr className="border-b border-rule">
                  <td className="bg-rule/20 px-2 py-1.5 font-semibold">সীল নং</td>
                  <td className="px-2 py-1.5 font-mono">{letter.box.sealNo}</td>
                </tr>
                <tr className="border-b border-rule">
                  <td className="bg-rule/20 px-2 py-1.5 font-semibold">নমুনার সংখ্যা</td>
                  <td className="px-2 py-1.5">
                    {toBengaliDigits(letter.box.specimenCount)} টি
                  </td>
                </tr>
                {isCounter && letter.applicant?.applicationNo && (
                  <tr className="border-b border-rule">
                    <td className="bg-rule/20 px-2 py-1.5 font-semibold">আবেদন নং</td>
                    <td className="px-2 py-1.5 font-mono">
                      {toBengaliDigits(letter.applicant.applicationNo)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* **The wing head is told which tests, the counter only how many.**
              He is being asked whether his bench can run them, which a number
              cannot answer; the counter takes the box at the door and never
              opens it. The names are the ones routed to *this* office — a
              package split across two wings sends each of them its own half
              (D134). */}
          {letter.packages.length > 0 && (
            <table className="mt-4 w-full border-collapse text-[10.5pt]">
              <thead>
                <tr className="border-y border-rule bg-rule/20">
                  <th className=" border border-theme w-8 px-2 py-1.5 text-left font-semibold">ক্রঃ</th>
                  <th className=" border border-theme w-48 px-2 py-1.5 text-left font-semibold">পণ্যের ধরন</th>
                  <th className=" border border-theme w-20 px-2 py-1.5 text-left font-semibold">নমুনা</th>
                  <th className=" border border-theme px-2 py-1.5 text-left font-semibold">
                    {isCounter ? "প্যারামিটার" : "পরীক্ষণীয় প্যারামিটার"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {letter.packages.map((p,i) =>
      p.parameters.map((param, paramIndex) => (
        <tr key={`${p.parameters}-${paramIndex}`}>
          {paramIndex === 0 && (
            <React.Fragment>
              <td className="border border-theme px-2 py-1.5" rowSpan={p.parameters.length >0? p.parameters.length : 1}>{toBengaliDigits(i + 1)}</td>
                    <td className="border border-theme px-2 py-1.5" rowSpan={p.parameters.length >0? p.parameters.length : 1}>{p.name}</td>
                    <td className="border border-theme px-2 py-1.5" rowSpan={p.parameters.length >0? p.parameters.length : 1}>{toBengaliDigits(p.specimenCount)} টি</td>
            </React.Fragment>
            
          )}

          <td className={`border border-theme p-1 ${paramIndex%2 === 0 ? "bg-rule/60" : "bg-white"}`}>{param}</td>
        </tr>
      ))
    )}
                
              </tbody>
            </table>
          )}

          <ol className="mt-5 list-decimal space-y-1.5 pl-6 text-justify">
            <li>
              <span className="font-semibold">সীল অক্ষত থাকা আবশ্যক।</span> সীল ভাঙা
              বা ক্ষতিগ্রস্ত অবস্থায় বাক্সটি গ্রহণ করা যাবে না; সেক্ষেত্রে পুনরায় নমুনা
              সংগ্রহের প্রয়োজন হবে।
            </li>
            {isCounter ? (
              <>
                <li>
                  <span className="font-semibold">পরীক্ষণ ফি পরিশোধ ব্যতীত নমুনা
                  গ্রহণ করা যাবে না।</span>{" "}
                  {letter.feeTaka ? (
                    <>
                      এই আবেদনের পরীক্ষণ ফি{" "}
                      <span className="font-semibold">{letter.feeTaka}</span>।{" "}
                    </>
                  ) : null}
                  ফি পরিশোধের অবস্থা ওয়ান স্টপ স্ক্রিনে দেখা যাবে; কাউন্টার হতে ফি
                  পরিশোধিত হিসেবে চিহ্নিত করার কোনো সুযোগ নেই।
                  {letter.urgent && (
                    <>
                      {" "}
                      <span className="font-semibold">এই ফি জরুরি ভিত্তিতে পরীক্ষণের
                      হারে ধার্য করা হয়েছে।</span>
                    </>
                  )}
                </li>
                <li>
                  বাক্স গ্রহণের পর ওয়ান স্টপ স্ক্রিনে &lsquo;গ্রহণ করা হয়েছে&rsquo;
                  হিসেবে চিহ্নিত করতে হবে। এর পূর্বে পরীক্ষাগারের কার্যক্রম শুরু হবে না।
                </li>
                <li>
                  জমাদানের সময় আবেদনকারীর নিকট হতে নমুনা জমাদান পত্রের অনুলিপি গ্রহণ
                  করতে হবে।
                </li>
              </>
            ) : (
              <>
                <li>
                  ওয়ান স্টপ সার্ভিস সেন্টারে বাক্সটি গ্রহণের পর পরীক্ষাগারে হস্তান্তর
                  করা হবে। গ্রহণের পূর্বে পরীক্ষণ কার্যক্রম শুরু করা যাবে না।
                </li>
                <li>
                  বাক্স খোলার সময় সীলের অবস্থা লিপিবদ্ধ করতে হবে এবং প্রতিটি নমুনার
                  গায়ে মুদ্রিত কিউআর কোডের মাধ্যমে নমুনা শনাক্ত করতে হবে।
                </li>
                <li>
                  আপনার কার্যালয়ে যে প্যারামিটারের পরীক্ষণ সুবিধা নেই, তা বিধি মোতাবেক
                  স্বীকৃত পরীক্ষাগারে সম্পন্ন করানোর ব্যবস্থা গ্রহণ করতে হবে; এ ক্ষেত্রেও
                  নমুনার জিম্মাদারি বিএসটিআই-এর উপরই বর্তাবে।
                </li>
                {letter.urgent && (
                  <li>
                    <span className="font-semibold">এই আবেদনের পরীক্ষণ জরুরি ভিত্তিতে
                    সম্পন্ন করতে হবে</span> এবং সে অনুযায়ী পরীক্ষণ ফি আদায় করা হয়েছে।
                    নমুনা গ্রহণের পর জরুরি টার্নঅ্যারাউন্ড অনুসরণ করে প্রতিবেদন প্রেরণের
                    জন্য অনুরোধ করা হলো।
                  </li>
                )}
              </>
            )}
            <li>
              অনুগ্রহপূর্বক <span className="font-semibold">{letter.dueOn}</span> তারিখের
              মধ্যে নমুনা জমাদানের বিষয়টি অনুসরণ করুন।
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
