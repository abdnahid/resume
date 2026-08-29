"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";
import GovHeader from "@/components/GovHeader";
import { BENGALI_MONTHS, toBengaliDigits, numberToBengaliWords } from "@/lib/bengali";
import type { Payslip } from "@/lib/salary/slip";

/**
 * The salary slip, print-styled.
 *
 * The toolbar is `print:hidden`, so the same page serves the on-screen view and
 * the PDF that Puppeteer renders from it — there is no second layout to keep in
 * step.
 */

function bdt(n: number) {
  return toBengaliDigits(n.toLocaleString("en-US")) + ".০০";
}

/**
 * Salary dates are stored `MM-DD-YYYY`; documents read DD-MM-YYYY. Printing the
 * stored form raw gave "০৮-২৮-২০২৬" — a twenty-eighth month.
 */
function toDisplayDate(stored: string): string {
  const m = stored.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[2]}-${m[1]}-${m[3]}` : stored;
}

export default function PayslipDocument({ slip }: { slip: Payslip }) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);

  const bnMonth = BENGALI_MONTHS[slip.month] ?? slip.month;
  // Daily-basis staff hold no fixation: no grade, no step, no allowances.
  const isDaily = slip.dailyRate !== null;
  const totalPayable = slip.netSalary + slip.arrearAmount;

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/salary/slip/${slip.employee.id}/pdf?month=${encodeURIComponent(slip.month)}&year=${encodeURIComponent(slip.year)}`,
      );
      if (!res.ok) throw new Error("Could not build the PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-${slip.employee.id}-${slip.month}-${slip.year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Falls back to the browser's own print-to-PDF, which needs no server.
      window.print();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted py-8 px-4 print:bg-white print:p-0 print:m-0">
      {/* Toolbar */}
      <div className="print:hidden max-w-3xl mx-auto flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-slate-500 hover:bg-muted transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-title">Salary Slip</h1>
            <p className="text-sm text-muted-foreground">
              {slip.employee.nameEn} · {slip.month} {slip.year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Printer size={15} />
            Print
          </button>
          <button
            type="button"
            disabled={downloading}
            onClick={download}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Download size={15} />
            {downloading ? "Preparing…" : "Download PDF"}
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="max-w-3xl mx-auto bg-paper shadow-sm border border-rule print:shadow-none print:border-none font-bn-serif text-base leading-[1.7]">
        <div className="px-12 py-8 print:px-10 print:py-8">
          <GovHeader org={slip.org} />

          <h2 className="text-center text-[13pt] font-bold text-ink mt-4 mb-1 underline underline-offset-4">
            বেতন বিবরণী
          </h2>
          <p className="text-center text-ink-2 mb-5">
            {bnMonth}, {toBengaliDigits(slip.year)}
          </p>

          {/* Employee block */}
          <table className="w-full text-sm mb-5">
            <tbody>
              <tr>
                <td className="py-1 text-ink-3 w-32">নাম</td>
                <td className="py-1 text-ink font-semibold">{slip.employee.nameBn}</td>
                <td className="py-1 text-ink-3 w-28">আইডি</td>
                <td className="py-1 text-ink font-mono">{toBengaliDigits(slip.employee.id)}</td>
              </tr>
              <tr>
                <td className="py-1 text-ink-3">পদবী</td>
                <td className="py-1 text-ink">{slip.employee.designationBn}</td>
                <td className="py-1 text-ink-3">{isDaily ? "ধরন" : "গ্রেড"}</td>
                <td className="py-1 text-ink">
                  {isDaily ? (
                    "দৈনিক ভিত্তিক"
                  ) : (
                    <>
                      {toBengaliDigits(slip.grade)}
                      {slip.step !== null && ` (ধাপ ${toBengaliDigits(slip.step)})`}
                    </>
                  )}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-ink-3">কার্যালয়</td>
                <td className="py-1 text-ink">{slip.employee.officeNameBn}</td>
                <td className="py-1 text-ink-3">হিসাব নং</td>
                <td className="py-1 text-ink font-mono">
                  {slip.employee.bankAccountNo
                    ? toBengaliDigits(slip.employee.bankAccountNo)
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Earnings, then deductions, on one amount column */}
          <div className="border border-rule-strong rounded overflow-hidden mb-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-rule/40 border-b border-rule-strong">
                  <th className="border-r border-rule-strong px-3 py-2 text-left font-semibold text-ink-2">
                    বিবরণ
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-ink-2 w-48">
                    টাকা
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* ── Salary and allowances ── */}
                <tr className="bg-rule/20 border-b border-rule">
                  <td
                    colSpan={2}
                    className="px-3 py-1.5 font-semibold text-ink-2 text-[13px]"
                  >
                    {isDaily ? "দৈনিক ভিত্তিক মজুরি" : "বেতন ও ভাতাদি"}
                  </td>
                </tr>

                {isDaily ? (
                  <tr className="border-b border-rule">
                    <td className="border-r border-rule px-3 py-2 pl-6 text-ink-2">
                      কর্মদিবস {toBengaliDigits(slip.daysWorked ?? 0)} দিন × দৈনিক{" "}
                      {bdt(slip.dailyRate ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">
                      {bdt((slip.daysWorked ?? 0) * (slip.dailyRate ?? 0))}
                    </td>
                  </tr>
                ) : (
                  <tr className="border-b border-rule">
                    <td className="border-r border-rule px-3 py-2 pl-6 text-ink-2">
                      মূল বেতন
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">
                      {bdt(slip.basicSalary)}
                    </td>
                  </tr>
                )}

                {slip.earnings.map((l, i) => (
                  <tr key={`e${i}`} className="border-b border-rule">
                    <td className="border-r border-rule px-3 py-2 pl-6 text-ink-2">
                      {l.nameBn}
                      {l.suppressed && (
                        <span className="text-ink-4 text-xs"> (স্থগিত)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">
                      {bdt(l.amount)}
                    </td>
                  </tr>
                ))}

                <tr className="bg-rule/30 border-b border-rule-strong font-semibold">
                  <td className="border-r border-rule-strong px-3 py-2 text-ink-2">
                    মোট প্রাপ্য
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">
                    {bdt(slip.grossEarning)}
                  </td>
                </tr>

                {/* ── Deductions ── */}
                <tr className="bg-rule/20 border-b border-rule">
                  <td
                    colSpan={2}
                    className="px-3 py-1.5 font-semibold text-ink-2 text-[13px]"
                  >
                    কর্তন
                  </td>
                </tr>

                {slip.deductions.length > 0 ? (
                  slip.deductions.map((l, i) => (
                    <tr key={`d${i}`} className="border-b border-rule">
                      <td className="border-r border-rule px-3 py-2 pl-6 text-ink-2">
                        {l.nameBn}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">
                        {bdt(l.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-b border-rule">
                    <td className="border-r border-rule px-3 py-2 pl-6 text-ink-4 italic">
                      কোনো কর্তন নেই
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-4">
                      {bdt(0)}
                    </td>
                  </tr>
                )}

                <tr className="bg-rule/30 border-b border-rule-strong font-semibold">
                  <td className="border-r border-rule-strong px-3 py-2 text-ink-2">
                    মোট কর্তন
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">
                    {bdt(slip.totalDeduction)}
                  </td>
                </tr>

                {/* ── Net ── */}
                <tr className="border-b border-rule">
                  <td className="border-r border-rule px-3 py-2 text-ink-2 font-semibold">
                    নীট বেতন (মোট প্রাপ্য − মোট কর্তন)
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink font-semibold">
                    {bdt(slip.netSalary)}
                  </td>
                </tr>

                {slip.arrearAmount > 0 && (
                  <tr className="border-b border-rule">
                    <td className="border-r border-rule px-3 py-2 text-ink-2">
                      বকেয়া
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">
                      {bdt(slip.arrearAmount)}
                    </td>
                  </tr>
                )}

                <tr className="bg-rule/50 font-bold border-t border-rule-strong">
                  <td className="border-r border-rule-strong px-3 py-2.5 text-ink">
                    মোট প্রদেয়
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                    {bdt(totalPayable)}
                  </td>
                </tr>

                <tr className="border-t border-rule">
                  <td colSpan={2} className="px-3 py-2 text-ink-2">
                    <span className="font-semibold">কথায়ঃ</span>{" "}
                    {numberToBengaliWords(totalPayable)} টাকা মাত্র।
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {(slip.verdictNote || slip.arrearNote) && (
            <div className="text-xs text-ink-3 space-y-1 mb-6">
              {slip.verdictNote && <p>* আদালতের আদেশ — {slip.verdictNote}</p>}
              {slip.arrearNote && <p>* বকেয়া — {slip.arrearNote}</p>}
            </div>
          )}

          {/* Signatures */}
          <div className="flex justify-between items-end mt-14 text-sm text-ink-2">
            <div className="text-center">
              <div className="border-t border-ink w-44 pt-1">প্রস্তুতকারী</div>
            </div>
            <div className="text-center">
              <div className="border-t border-ink w-44 pt-1">হিসাব রক্ষণ কর্মকর্তা</div>
            </div>
          </div>

          <p className="mt-8 text-[10px] text-ink-4 text-center">
            ইস্যুর তারিখঃ {toBengaliDigits(toDisplayDate(slip.issueDate))} · কম্পিউটারে প্রস্তুতকৃত,
            স্বাক্ষর ব্যতীত বৈধ নয়।
          </p>
        </div>
      </div>
    </div>
  );
}
