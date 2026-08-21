"use client";

import GovHeader from "@/components/GovHeader";
import {
  BENGALI_MONTHS,
  toBengaliDigits,
  formatBDTBengali,
} from "@/lib/bengali";
import type { OrgInfo, BankAdviceRecord, BankAdviceEntry } from "@/lib/types";
import { useRouter } from "next/navigation";

// ─── Static recipient details (kept static per spec) ─────────────────────────

const RECIPIENT = {
  title: "সহকারী মহাব্যবস্থাপক",
  org: "সোনালী ব্যাংক পিএলসি",
  branch: "তেজগাঁও শিল্প এলাকা শাখা",
  address: "তেজগাঁও, ঢাকা-১২০৮।",
};

// BSTI main current account at Sonali Bank (static)
const BSTI_ACCOUNT = "০১২৪২০০০০০৫০৬";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBDT(n: number) {
  return n.toLocaleString("en-BD") + ".00";
}

function buildSubject(month: string, year: string) {
  return `${BENGALI_MONTHS[month] ?? month}, ${toBengaliDigits(year)} মাসের বেতন ভাতাদি পরিশোধের অর্থ ছাড়ের প্রসঙ্গে।`;
}

function buildBodyText(advice: BankAdviceRecord, entryCount: number) {
  const bnMonth = BENGALI_MONTHS[advice.month] ?? advice.month;
  const bnYear = toBengaliDigits(advice.year);
  const bnChequeDate = toBengaliDigits(advice.chequeDate);
  const bnDepositDate = toBengaliDigits(advice.depositDate);
  const bnCount = toBengaliDigits(entryCount);
  const bnAmount = formatBDTBengali(advice.totalAmount);

  return (
    `উপর্যুক্ত বিষয়ের প্রেক্ষিতে জানানো যাচ্ছে যে, বিএসটিআই প্রধান কার্যালয়ের কর্মকর্তা ও ` +
    `কর্মচারীদের ${bnMonth}, ${bnYear} মাসের বেতন ভাতা পরিশোধের নিমিত্তে চলতি হিসাব নং- ${BSTI_ACCOUNT} এর ` +
    `একটি চেক নং-${advice.chequeNo}, তারিখ: ${bnChequeDate} টাকা ${bnAmount} ` +
    `(${advice.totalInWords} টাকা মাত্র) নিম্নে বর্ণিত তালিকার ${bnCount} জন কর্মকর্তা ও ` +
    `কর্মচারীদের নামের পাশে বর্ণিত বেতনের অর্থ স্ব স্ব সঞ্চয়ী হিসাবে স্থানান্তরের জন্য অনুরোধ করা হলো। ` +
    `অত্র বেতন ভাতাদি অর্থ ${bnDepositDate} তারিখে সংশ্লিষ্ট কর্মকর্তা/কর্মচারীদের হিসাবে জমা ` +
    `প্রদান করার জন্য বিশেষভাবে অনুরোধ করা হলো।`
  );
}

// ─── Print button ─────────────────────────────────────────────────────────────

function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors cursor-pointer"
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="w-4 h-4"
      >
        <path d="M4 6V2h8v4M4 12H3a1 1 0 01-1-1V7a1 1 0 011-1h10a1 1 0 011 1v4a1 1 0 01-1 1h-1" />
        <rect x="4" y="10" width="8" height="5" rx="0.5" />
        <path d="M4 8.5h1" />
      </svg>
      Print
    </button>
  );
}

// ─── Main document ────────────────────────────────────────────────────────────

export default function BankAdviceDocument({
  advice,
  entries,
  org,
}: {
  advice: BankAdviceRecord;
  entries: BankAdviceEntry[];
  org: OrgInfo;
}) {
  const router = useRouter();
  const total = entries.reduce((s, e) => s + e.salaryAllowance, 0);
  const subject = buildSubject(advice.month, advice.year);
  const bodyText = buildBodyText(advice, entries.length);

  return (
    <div className="min-h-screen bg-muted py-8 px-4 print:bg-white print:p-0 print:m-0">
      {/* Toolbar */}
      <div className="print:hidden max-w-4xl mx-auto flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-slate-500 hover:bg-muted transition-colors cursor-pointer"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="w-4 h-4"
            >
              <path d="M10 12L6 8l4-4" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold text-title">
              Bank Advice Document
            </h1>
            <p className="text-sm text-muted-foreground">
              {advice.month} {advice.year}
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      {/* Document */}
      <div className="max-w-4xl mx-auto bg-paper shadow-sm border border-rule print:shadow-none print:border-none font-bn-serif text-base leading-[1.7]">
        <div className="px-12 py-8 print:px-10 print:py-8">
          {/* Letterhead */}
          <GovHeader org={org} />

          {/* Memo + Date */}
          <div className="flex justify-between items-start mt-4 mb-4">
            <p className="text-ink-2">
              <span className="font-semibold">স্মারক নংঃ</span>{" "}
              <span className="font-bn-serif">{advice.memoNo}</span>
            </p>
            <p className="text-ink-2">
              <span className="font-semibold">তারিখঃ</span>{" "}
              {toBengaliDigits(advice.chequeDate)}
            </p>
          </div>

          {/* Recipient */}
          <div className="mb-5 text-ink-2 space-y-0.5">
            <p className="font-semibold">{RECIPIENT.title}</p>
            <p>{RECIPIENT.org}</p>
            <p>{RECIPIENT.branch}</p>
            <p>{RECIPIENT.address}</p>
          </div>

          {/* Subject */}
          <div className="mb-4">
            <p className="text-ink-2">
              <span className="font-bold">বিষয়ঃ</span>{" "}
              <span className="font-semibold underline underline-offset-2">
                {subject}
              </span>
            </p>
          </div>

          {/* Salutation */}
          <p className="mb-3 text-ink-2">জনাব,</p>

          {/* Body */}
          <div className="mb-6 text-ink-2 text-justify leading-relaxed">
            <p className="indent-8 bg-yellow-50 border-l-4 border-yellow-300 pl-3 pr-2 py-1 rounded-r-md">
              {bodyText}
            </p>
          </div>

          {/* Table */}
          <div className="mb-2 border border-rule-strong rounded overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-rule/40 border-b border-rule-strong">
                  <th className="border-r border-rule-strong px-3 py-2 text-center font-semibold text-ink-2 w-12">
                    ক্রম
                  </th>
                  <th className="border-r border-rule-strong px-3 py-2 text-center font-semibold text-ink-2">
                    নাম
                  </th>
                  <th className="border-r border-rule-strong px-3 py-2 text-center font-semibold text-ink-2">
                    পদবী
                  </th>
                  <th className="border-r border-rule-strong px-3 py-2 text-center font-semibold text-ink-2 whitespace-nowrap">
                    সঞ্চয়ী হিসাব নং
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-ink-2 whitespace-nowrap">
                    বেতন ভাতা
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row, i) => (
                  <tr
                    key={row.sl}
                    className={`border-b border-rule ${i % 2 === 0 ? "bg-paper" : "bg-rule/20"}`}
                  >
                    <td className="border-r border-rule px-3 py-2.5 text-center text-ink-3">
                      {toBengaliDigits(row.sl)}
                    </td>
                    <td className="border-r border-rule px-3 py-2.5 text-center text-ink-2 font-medium">
                      {row.name}
                    </td>
                    <td className="border-r border-rule px-3 py-2.5 text-center text-ink-3">
                      {row.designation}
                    </td>
                    <td className="border-r border-rule px-3 py-2.5 text-center font-mono text-ink-3 text-xs tracking-wide">
                      {row.accountNo || <span className="text-ink-4">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">
                      {formatBDT(row.salaryAllowance)}
                    </td>
                  </tr>
                ))}

                {/* Total row */}
                <tr className="border-t-2 border-rule-strong bg-rule/40 font-semibold">
                  <td
                    colSpan={4}
                    className="border-r border-rule-strong px-3 py-2.5 text-right text-ink-2"
                  >
                    সর্বমোট
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                    {formatBDT(total)}
                  </td>
                </tr>

                {/* In words row */}
                <tr className="border-t border-rule bg-paper">
                  <td className="border-r border-rule px-3 py-2.5 text-ink-2 font-semibold whitespace-nowrap">
                    কথায়ঃ
                  </td>
                  <td colSpan={4} className="px-3 py-2.5 text-ink-2 text-right">
                    {advice.totalInWords}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signature */}
          <div className="mt-12 flex justify-end">
            <div className="text-center">
              <div className="border-b border-rule-strong w-48 mb-1" />
              <p className="text-sm text-ink-2 font-semibold">স্বাক্ষর</p>
              <p className="text-xs text-ink-3">কর্মকর্তার নাম ও পদবী</p>
              <p className="text-xs text-ink-3">বিএসটিআই, ঢাকা</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
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
