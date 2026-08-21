"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, ChevronLeft, ChevronRight, Zap, CheckCircle2 } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const MONTH_IDX: Record<string, number> = Object.fromEntries(
  MONTHS.map((m, i) => [m, i + 1])
);

// ─── Types ────────────────────────────────────────────────────────────────────

type LastProcessed = { month: string; year: string } | null;
type MonthState = "available" | "future" | "processed" | "selected";
type ProcessResult = { processed: number; skipped: number; month: string; year: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProcessSalaryModal({
  isOpen,
  onClose,
  lastProcessed,
  activeCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  lastProcessed: LastProcessed;
  activeCount: number;
}) {
  const router = useRouter();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const minYear = currentYear - 3;

  // Open on the year of lastProcessed so the "fence" (blocked months) is
  // immediately visible. If lastProcessed was December, advance to next year.
  function startYear() {
    if (!lastProcessed) return currentYear;
    const ly = Number(lastProcessed.year);
    const lm = MONTH_IDX[lastProcessed.month];
    return lm >= 12 ? Math.min(ly + 1, currentYear) : ly;
  }

  const [displayYear, setDisplayYear] = useState(startYear);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset all modal state (including year) every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setDisplayYear(startYear());
      setSelected(null);
      setResult(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  function getMonthState(month: string, year: number): MonthState {
    const mi = MONTH_IDX[month];

    // Future month?
    if (year > currentYear || (year === currentYear && mi > currentMonth)) {
      return "future";
    }

    // Already processed or before last processed?
    if (lastProcessed) {
      const ly = Number(lastProcessed.year);
      const lm = MONTH_IDX[lastProcessed.month];
      if (year < ly || (year === ly && mi <= lm)) return "processed";
    }

    if (selected === `${month} ${year}`) return "selected";
    return "available";
  }

  function handleMonthClick(month: string) {
    const state = getMonthState(month, displayYear);
    if (state === "future" || state === "processed") return;
    setSelected(state === "selected" ? null : `${month} ${displayYear}`);
  }

  async function handleProcess() {
    if (!selected) return;
    const [month, year] = selected.split(" ");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/salary/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Processing failed");
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    onClose(); // useEffect resets all state when isOpen flips to false→true
  }

  const [selMonth, selYear] = selected ? selected.split(" ") : [null, null];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Process Salary</h2>
          <button
            type="button"
            onClick={handleClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {result ? (
          /* ── Success state ────────────────────────────────────────────── */
          <div className="px-5 py-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={28} className="text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">Processing Complete</p>
                <p className="text-sm text-slate-500">{result.month} {result.year}</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Processed</span>
                <span className="font-semibold text-emerald-600">{result.processed} employees</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Skipped</span>
                <span className="font-semibold text-slate-400">{result.skipped} employees</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          /* ── Month selection state ────────────────────────────────────── */
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
              <span className="text-sm font-semibold text-slate-800 tabular-nums">{displayYear}</span>
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
                const isDisabled = state === "future" || state === "processed";
                const isSelected = state === "selected";
                return (
                  <button
                    key={month}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleMonthClick(month)}
                    title={
                      state === "future" ? "Future month"
                      : state === "processed" ? "Already processed"
                      : undefined
                    }
                    className={`py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                      isSelected
                        ? "bg-primary text-white shadow-sm"
                        : isDisabled
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-700 hover:bg-slate-100 cursor-pointer"
                    }`}
                  >
                    {month.slice(0, 3)}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-slate-200" />
                Already processed
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-slate-100" />
                Future
              </span>
            </div>

            {/* Info */}
            <div className="min-h-[36px] flex items-center justify-center">
              {selected ? (
                <p className="text-xs text-slate-500 text-center">
                  <span className="font-semibold text-slate-700">{activeCount}</span> active{" "}
                  {activeCount === 1 ? "employee" : "employees"} will be processed for{" "}
                  <span className="font-semibold text-slate-700">{selMonth} {selYear}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-400 text-center">Select a month to process</p>
              )}
            </div>

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
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selected || loading}
                onClick={handleProcess}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Zap size={14} />
                )}
                {loading ? "Processing…" : "Process"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
