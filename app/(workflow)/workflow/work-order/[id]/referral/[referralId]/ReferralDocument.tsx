"use client";

import { Download, Printer } from "lucide-react";
import GovHeader from "@/components/GovHeader";
import type { OrgInfo } from "@/lib/types";

/**
 * The letter a testing officer hands to an accredited outside laboratory
 * (D140).
 *
 * **This is the one document in the system that leaves the building**, and the
 * blinding rule therefore matters more here than anywhere else. It is built
 * from the test order, which carries no application column at all (D70), so
 * there is no path from this page to a company, a factory, a brand or an
 * application number even by accident. The specimens are named by their lab
 * code, which is what is written on the jar.
 *
 * **It asks for figures, not for a verdict.** The outside laboratory observes
 * and reports; BSTI judges the result against the standard and signs for it
 * (D65). So the limit is printed for information and there is no pass/fail
 * column to fill in — that judgement is the testing officer's when he enters
 * the reading.
 *
 * **Urgency is a border and bold type, never a colour** — the same reason as
 * the sampling letter: a red panel comes off a mono office printer as grey.
 *
 * Screen and PDF are the same page; the toolbar is `print:hidden`.
 */

export type ReferralView = {
  referralNo: string;
  issuedOn: string;
  issuedBy: { name: string; designation: string | null };
  labName: string;
  labAddress: string | null;
  officeNameBn: string;
  orderCode: string;
  urgent: boolean;
  note: string | null;
  packageName: string;
  standard: string | null;
  specimens: { labCode: string; specimenNo: number }[];
  tests: { name: string; method: string | null; limit: string | null; subs: string[] }[];
};

export default function ReferralDocument({
  org,
  referral,
  pdfHref,
  backHref,
}: {
  org: OrgInfo;
  referral: ReferralView;
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

      <div className="mx-auto max-w-4xl border border-rule bg-paper font-bn-serif text-[11pt] leading-[1.7] shadow-sm print:border-none print:shadow-none">
        <div className="px-12 py-8 print:px-10 print:py-8">
          <GovHeader org={org} />

          <div className="mt-5 flex items-start justify-between gap-6">
            <div>
              <span className="text-ink-2">স্মারক নং:</span>{" "}
              <span className="font-mono">{referral.referralNo}</span>
            </div>
            <div className="text-right">
              <div>
                <span className="text-ink-2">তারিখ:</span> {referral.issuedOn}
              </div>
              <div className="mt-2 flex justify-end">
                <span
                  className={`rounded-md px-2 py-1 font-mono ${
                    referral.urgent
                      ? "border-2 border-ink font-bold"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {referral.urgent ? "URGENT" : "NORMAL"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <p>বরাবর,</p>
            <p className="ml-5 font-semibold">{referral.labName}</p>
            {referral.labAddress && <p className="ml-5">{referral.labAddress}</p>}
          </div>

          <p className="mt-5">
            <span className="text-ink-2">বিষয়:</span>{" "}
            <span className="font-semibold">
              নমুনা পরীক্ষণের অনুরোধ — {referral.packageName}
              {referral.standard ? ` (${referral.standard})` : ""}
            </span>
          </p>

          <p className="mt-4">জনাব,</p>
          <p className="mt-2 text-justify">
            বাংলাদেশ স্ট্যান্ডার্ডস অ্যান্ড টেস্টিং ইনস্টিটিউশন,{" "}
            {referral.officeNameBn}-এর পক্ষ হতে নিম্নবর্ণিত নমুনাসমূহ পরীক্ষণের
            জন্য প্রেরণ করা হলো। অনুগ্রহপূর্বক নিচের ছকে উল্লিখিত পরীক্ষাসমূহ
            সম্পন্ন করে <strong>প্রাপ্ত ফলাফল</strong> এই দপ্তরে প্রেরণ করার
            জন্য অনুরোধ করা হলো। উল্লেখ্য, মানের সাথে তুলনা করে সিদ্ধান্ত প্রদান
            বিএসটিআই কর্তৃক সম্পন্ন হবে; আপনাদের নিকট হতে কেবল পরিমাপকৃত ফলাফল
            প্রত্যাশিত।
          </p>

          {/* The specimens, by the code written on the jar — the only
              identifier that exists on this side of the cut (D71). */}
          <div className="mt-5">
            <p className="font-semibold">প্রেরিত নমুনা</p>
            <table className="mt-1.5 w-full border-collapse border border-rule text-[10pt]">
              <thead>
                <tr className="bg-secondary/40">
                  <th className="border border-rule px-2 py-1 text-left">ক্রমিক</th>
                  <th className="border border-rule px-2 py-1 text-left">নমুনা কোড</th>
                  <th className="border border-rule px-2 py-1 text-left">পণ্য</th>
                </tr>
              </thead>
              <tbody>
                {referral.specimens.map((s, i) => (
                  <tr key={s.labCode}>
                    <td className="border border-rule px-2 py-1">{i + 1}</td>
                    <td className="border border-rule px-2 py-1 font-mono">{s.labCode}</td>
                    <td className="border border-rule px-2 py-1">{referral.packageName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* A full grid with a merged grouping cell, per the house rule for
              generated documents: one row per test, the sub-parameters listed
              inside their parent's row rather than as orphan lines. */}
          <div className="mt-5">
            <p className="font-semibold">পরীক্ষণীয় প্যারামিটার</p>
            <table className="mt-1.5 w-full border-collapse border border-rule text-[10pt]">
              <thead>
                <tr className="bg-secondary/40">
                  <th className="border border-rule px-2 py-1 text-left">ক্রমিক</th>
                  <th className="border border-rule px-2 py-1 text-left">পরীক্ষা</th>
                  <th className="border border-rule px-2 py-1 text-left">পদ্ধতি</th>
                  <th className="border border-rule px-2 py-1 text-left">মান (তথ্যার্থে)</th>
                  <th className="border border-rule px-2 py-1 text-left">প্রাপ্ত ফলাফল</th>
                </tr>
              </thead>
              <tbody>
                {referral.tests.map((t, i) => (
                  <tr key={`${t.name}-${i}`}>
                    <td className="border border-rule px-2 py-1 align-top">{i + 1}</td>
                    <td className="border border-rule px-2 py-1 align-top">
                      {t.name}
                      {t.subs.length > 0 && (
                        <ul className="mt-0.5 ml-4 list-disc text-[9pt] text-ink-2">
                          {t.subs.map((sub) => (
                            <li key={sub}>{sub}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="border border-rule px-2 py-1 align-top">{t.method ?? "—"}</td>
                    <td className="border border-rule px-2 py-1 align-top">{t.limit ?? "—"}</td>
                    {/* Left blank on purpose: this column is filled in by hand
                        or on the outside laboratory's own report, and typed
                        back into our system by the testing officer. */}
                    <td className="border border-rule px-2 py-1"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {referral.note && (
            <p className="mt-4 text-justify">
              <span className="text-ink-2">বিশেষ নির্দেশনা:</span> {referral.note}
            </p>
          )}

          <p className="mt-4 text-[10pt] text-ink-2">
            যোগাযোগের সূত্র: কার্যাদেশ নং <span className="font-mono">{referral.orderCode}</span>{" "}
            — ফলাফল প্রেরণের সময় এই স্মারক নম্বর উল্লেখ করার জন্য অনুরোধ করা হলো।
          </p>

          {/* Name and designation only — `Employee` carries no signature image
              (only `DirectorGeneral` does), the same as the office order. */}
          <div className="mt-10 flex justify-end">
            <div className="text-center">
              <div className="h-12" />
              <p className="border-t border-rule pt-1 font-semibold">{referral.issuedBy.name}</p>
              {referral.issuedBy.designation && <p>{referral.issuedBy.designation}</p>}
              <p>{referral.officeNameBn}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
