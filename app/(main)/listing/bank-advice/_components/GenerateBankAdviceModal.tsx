"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, ChevronLeft, ChevronRight, FileText, CheckCircle2 } from "lucide-react";
import type { SalaryProcessMonth, BankAdviceRecord } from "@/lib/types";
import SingleDatePopover from "@/app/(main)/_components/DateScape/SingleDatePopover";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const MONTH_IDX: Record<string, number> = Object.fromEntries(
  MONTHS.map((m, i) => [m, i + 1])
);

function toOrder(month: string, year: number) {
  return year * 12 + (MONTH_IDX[month] ?? 0);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type MonthState = "available" | "future" | "generated" | "fence" | "selected";

// ─── Component ────────────────────────────────────────────────────────────────

export default function GenerateBankAdviceModal({
  isOpen,
  onClose,
  generatedAdvices,
  salaryMonths,
}: {
  isOpen: boolean;
  onClose: () => void;
  generatedAdvices: Pick<BankAdviceRecord, "month" | "year">[];
  salaryMonths: SalaryProcessMonth[];
}) {
  const router = useRouter();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const minYear = currentYear - 3;

  const generatedSet = new Set(generatedAdvices.map((a) => `${a.month} ${a.year}`));
  const lastGenerated =
    generatedAdvices.length > 0
      ? generatedAdvices.reduce((max, a) =>
          toOrder(a.month, Number(a.year)) > toOrder(max.month, Number(max.year))
            ? a
            : max
        )
      : null;

  const salaryMap = new Map(
    salaryMonths.map((m) => [`${m.month} ${m.year}`, m.count])
  );

  function startYear() {
    if (!lastGenerated) return currentYear;
    const ly = Number(lastGenerated.year);
    const lm = MONTH_IDX[lastGenerated.month];
    return lm >= 12 ? Math.min(ly + 1, currentYear) : ly;
  }

  const [displayYear, setDisplayYear] = useState(startYear);
  const [selected, setSelected] = useState<string | null>(null);
  const [chequeNo, setChequeNo] = useState("");
  const [depositDate, setDepositDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BankAdviceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Incremented on each open to remount SingleDatePopover and clear its internal state
  const [calendarKey, setCalendarKey] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setDisplayYear(startYear());
      setSelected(null);
      setChequeNo("");
      setDepositDate(undefined);
      setResult(null);
      setError(null);
      setCalendarKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  function getMonthState(month: string, year: number): MonthState {
    const mi = MONTH_IDX[month];
    const key = `${month} ${year}`;

    if (year > currentYear || (year === currentYear && mi > currentMonth)) {
      return "future";
    }
    if (generatedSet.has(key)) return "generated";
    if (lastGenerated) {
      const lastOrder = toOrder(lastGenerated.month, Number(lastGenerated.year));
      if (toOrder(month, year) > lastOrder + 1) return "fence";
    }
    if (selected === key) return "selected";
    return "available";
  }

  function handleMonthClick(month: string) {
    const state = getMonthState(month, displayYear);
    if (state === "future" || state === "generated" || state === "fence") return;
    const key = `${month} ${displayYear}`;
    setSelected((prev) => (prev === key ? null : key));
    setError(null);
  }

  async function handleGenerate() {
    if (!selected || !chequeNo.trim() || !depositDate) return;
    const [month, year] = selected.split(" ");
    // Convert Date to YYYY-MM-DD for the API (which stores as DD-MM-YYYY)
    const dd = String(depositDate.getDate()).padStart(2, "0");
    const mm = String(depositDate.getMonth() + 1).padStart(2, "0");
    const depositDateISO = `${depositDate.getFullYear()}-${mm}-${dd}`;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bank-advice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, chequeNo: chequeNo.trim(), depositDate: depositDateISO }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const [selMonth, selYear] = selected ? selected.split(" ") : [null, null];
  const employeeCount = selected ? (salaryMap.get(selected) ?? 0) : 0;
  const hasSalary = selected ? salaryMap.has(selected) : false;
  // hasSalary is informational only — the API is the authoritative check.
  // Page data may be stale if salary was processed after this page loaded.
  const canGenerate =
    !!selected && chequeNo.trim().length > 0 && depositDate !== undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Generate Bank Advice</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {result ? (
          /* ── Success state ─────────────────────────────────────────── */
          <div className="px-5 py-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={28} className="text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">Generated Successfully</p>
                <p className="text-sm text-slate-500">{result.month} {result.year}</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Memo No</span>
                <span className="font-medium text-slate-700 font-bn-serif text-xs">#{result.memoNo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Employees</span>
                <span className="font-semibold text-slate-700">{result.employeeCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total</span>
                <span className="font-semibold text-slate-700">
                  ৳ {result.totalAmount.toLocaleString("en-BD")}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push(`/listing/bank-advice/${result.id}`)}
                className="flex-1 py-2.5 rounded-xl border border-primary/30 text-primary text-sm font-semibold hover:bg-secondary transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <FileText size={14} />
                View
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* ── Selection state ───────────────────────────────────────── */
          <div className="px-5 py-4 space-y-4">

            {/* Year navigation */}
            <div className="flex items-center justify-between select-none">
              <button
                type="button"
                onClick={() => setDisplayYear((y) => Math.max(y - 1, minYear))}
                disabled={displayYear <= minYear}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-slate-800 tabular-nums">
                {displayYear}
              </span>
              <button
                type="button"
                onClick={() => setDisplayYear((y) => Math.min(y + 1, currentYear))}
                disabled={displayYear >= currentYear}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-4 gap-1.5">
              {MONTHS.map((month) => {
                const state = getMonthState(month, displayYear);
                const isDisabled =
                  state === "future" || state === "generated" || state === "fence";
                const isSelected = state === "selected";
                const isGenerated = state === "generated";
                return (
                  <button
                    key={month}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleMonthClick(month)}
                    title={
                      isGenerated ? "Already generated"
                      : state === "future" ? "Future month"
                      : state === "fence" ? "Generate previous months first"
                      : undefined
                    }
                    className={`py-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                      isSelected
                        ? "bg-primary text-white shadow-sm"
                        : isGenerated
                        ? "text-slate-400 cursor-not-allowed"
                        : isDisabled
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-700 hover:bg-slate-100 cursor-pointer"
                    }`}
                  >
                    {month.slice(0, 3)}
                    {isGenerated && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-300" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
                Already generated
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-slate-100" />
                Unavailable
              </span>
            </div>

            {/* Info + inputs (shown after selecting a month) */}
            {selected ? (
              <div className="space-y-3">
                {hasSalary ? (
                  <p className="text-xs text-slate-500 text-center">
                    <span className="font-semibold text-slate-700">{employeeCount}</span>{" "}
                    {employeeCount === 1 ? "employee" : "employees"} for{" "}
                    <span className="font-semibold text-slate-700">{selMonth} {selYear}</span>
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-center">
                    No processed salary found for {selMonth} {selYear}
                  </p>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Cheque No
                  </label>
                  <input
                    type="text"
                    value={chequeNo}
                    onChange={(e) => setChequeNo(e.target.value)}
                    placeholder="e.g. 8538724523"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-800 placeholder:text-slate-300 focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                </div>

                <SingleDatePopover
                  key={calendarKey}
                  fieldTitle="Deposit Date"
                  placeholder="Pick deposit date"
                  defaultDate={depositDate}
                  getSelectedDate={(date) => setDepositDate(date)}
                  lang="en-GB"
                />
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center min-h-[36px] flex items-center justify-center">
                Select a month to generate
              </p>
            )}

            {/* Error */}
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canGenerate || loading}
                onClick={handleGenerate}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <FileText size={14} />
                )}
                {loading ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
