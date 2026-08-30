"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  X, ChevronLeft, ChevronRight, Zap, CheckCircle2, Trash2, AlertTriangle, Lock,
  CalendarClock,
} from "lucide-react";

/**
 * Process one office's salary for one month.
 *
 * Payroll is per office — each office pays its own staff and issues its own
 * bank advice — so the month grid reflects one office at a time.
 *
 * Months run in order: a month cannot be processed while a later one already
 * is. Going back therefore means undoing, which this modal offers directly,
 * and which is refused once the advice for that month has been issued.
 */

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const MONTH_IDX: Record<string, number> = Object.fromEntries(
  MONTHS.map((m, i) => [m, i + 1]),
);

function order(month: string, year: number) {
  return year * 12 + (MONTH_IDX[month] ?? 0);
}

export type ProcessedEntry = {
  month: string;
  year: string;
  officeId: number;
  count: number;
  hasAdvice: boolean;
};

export type PayrollOffice = { id: number; nameEn: string; activeCount: number };

type MonthState = "available" | "future" | "processed" | "blocked" | "selected";

type ProcessResult = {
  /** Which payroll produced this result. */
  category?: "regular" | "daily_basis" | "all";
  processed: number;
  skipped: number;
  arrearsPaid?: number;
  skippedDetail?: { id: string; name: string; reason: string }[];
  month: string;
  year: string;
};

function formatBDT(n: number) {
  return "৳ " + n.toLocaleString("en-BD");
}

export default function ProcessSalaryModal({
  isOpen,
  onClose,
  offices,
  processed,
  pinned,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Offices this user may run payroll for. */
  offices: PayrollOffice[];
  /** Every month already processed, across those offices. */
  processed: ProcessedEntry[];
  /** True for an officeadmin — the office cannot be changed. */
  pinned: boolean;
}) {
  const router = useRouter();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const minYear = currentYear - 3;

  const [officeId, setOfficeId] = useState<number | null>(offices[0]?.id ?? null);
  const [displayYear, setDisplayYear] = useState(currentYear);
  const [selected, setSelected] = useState<string | null>(null);
  /** Which payroll is running, if any — the two buttons act independently. */
  const [loading, setLoading] = useState<"regular" | "daily_basis" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProcessedEntry | null>(null);

  // Daily-basis staff are paid by the day, so their days are confirmed before
  // anything is written. Everyone else is decided by their fixation.


  /** Months processed for the office currently in view. */
  const officeMonths = useMemo(
    () => processed.filter((p) => p.officeId === officeId),
    [processed, officeId],
  );

  const lastProcessed = useMemo(() => {
    if (!officeMonths.length) return null;
    return officeMonths.reduce((max, m) =>
      order(m.month, Number(m.year)) > order(max.month, Number(max.year)) ? m : max,
    );
  }, [officeMonths]);

  function startYear() {
    if (!lastProcessed) return currentYear;
    const ly = Number(lastProcessed.year);
    return MONTH_IDX[lastProcessed.month] >= 12
      ? Math.min(ly + 1, currentYear)
      : ly;
  }

  useEffect(() => {
    if (isOpen) {
      setOfficeId(offices[0]?.id ?? null);
      setSelected(null);
      setResult(null);
      setError(null);
      setConfirmDelete(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    setDisplayYear(startYear());
    setSelected(null);
    setConfirmDelete(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeId, processed]);

  if (!isOpen) return null;

  const office = offices.find((o) => o.id === officeId) ?? null;

  function entryFor(month: string, year: number): ProcessedEntry | null {
    return (
      officeMonths.find((m) => m.month === month && Number(m.year) === year) ?? null
    );
  }

  function getMonthState(month: string, year: number): MonthState {
    const mi = MONTH_IDX[month];
    if (year > currentYear || (year === currentYear && mi > currentMonth)) {
      return "future";
    }
    if (entryFor(month, year)) return "processed";

    // A later month already processed blocks this one — undo it first.
    if (lastProcessed && order(month, year) < order(lastProcessed.month, Number(lastProcessed.year))) {
      return "blocked";
    }
    if (selected === `${month} ${year}`) return "selected";
    return "available";
  }

  function handleMonthClick(month: string) {
    const state = getMonthState(month, displayYear);
    setError(null);
    if (state === "future") return;
    if (state === "processed") {
      setConfirmDelete(entryFor(month, displayYear));
      return;
    }
    if (state === "blocked") {
      setError(
        `${lastProcessed!.month} ${lastProcessed!.year} is already processed for this office. Delete it first to go back to ${month} ${displayYear}.`,
      );
      return;
    }
    setSelected(state === "selected" ? null : `${month} ${displayYear}`);
  }

  /**
   * Run one of the two payrolls for the selected month.
   *
   * They are separate operations because they are decided by different things:
   * regular staff by their fixation, daily-basis staff by the days in the
   * attendance register. Running them together hid one inside the other's
   * result.
   */
  async function runProcess(category: "regular" | "daily_basis") {
    if (!selected || officeId === null) return;
    const [month, year] = selected.split(" ");
    setLoading(category);
    setError(null);
    try {
      const res = await fetch("/api/salary/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, officeId, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Processing failed");
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirmDelete || officeId === null) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/salary/process", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: confirmDelete.month,
          year: confirmDelete.year,
          officeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not undo that month");
      setConfirmDelete(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  const [selMonth, selYear] = selected ? selected.split(" ") : [null, null];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Process Salary</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {result ? (
          /* ── Result ─────────────────────────────────────────────────── */
          <div className="px-5 py-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={28} className="text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">
                  {result.category === "daily_basis"
                    ? "Daily-basis payroll complete"
                    : result.category === "regular"
                      ? "Regular payroll complete"
                      : "Processing complete"}
                </p>
                <p className="text-sm text-slate-500">
                  {result.month} {result.year} · {office?.nameEn}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Processed</span>
                <span className="font-semibold text-emerald-600">
                  {result.processed} employees
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Skipped</span>
                <span className="font-semibold text-slate-400">
                  {result.skipped} employees
                </span>
              </div>
              {(result.arrearsPaid ?? 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Arrears paid</span>
                  <span className="font-semibold text-emerald-600">
                    {formatBDT(result.arrearsPaid!)}
                  </span>
                </div>
              )}
            </div>

            {result.skippedDetail && result.skippedDetail.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 max-h-40 overflow-y-auto">
                <p className="text-[11px] font-semibold text-amber-800 mb-1.5">
                  Not paid this month
                </p>
                {result.skippedDetail.map((s) => (
                  <p key={s.id} className="text-[11px] text-amber-800 leading-relaxed">
                    <span className="font-mono">{s.id}</span> {s.name} — {s.reason}
                  </p>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : confirmDelete ? (
          /* ── Undo a processed month ─────────────────────────────────── */
          <div className="px-5 py-6 space-y-4">
            <div className="flex items-start gap-3">
              {confirmDelete.hasAdvice ? (
                <Lock size={24} className="text-slate-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={24} className="text-amber-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold text-slate-900">
                  {confirmDelete.month} {confirmDelete.year}
                </p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {confirmDelete.hasAdvice
                    ? "The bank advice for this month has been issued, so it can no longer be undone. Delete the advice first if this really has to change."
                    : `Undo this month for ${office?.nameEn}? ${confirmDelete.count} salary record${confirmDelete.count === 1 ? "" : "s"} will be removed. Any arrears they settled go back to pending and will be paid with the next month processed.`}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setConfirmDelete(null); setError(null); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {confirmDelete.hasAdvice ? "Close" : "Cancel"}
              </button>
              {!confirmDelete.hasAdvice && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  {deleting ? "Undoing…" : "Undo month"}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ── Selection ──────────────────────────────────────────────── */
          <div className="px-5 py-4 space-y-4">
            {/* Office */}
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-500">Office</span>
              <select
                value={officeId ?? ""}
                disabled={pinned || offices.length <= 1}
                onChange={(e) => setOfficeId(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed"
              >
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nameEn} ({o.activeCount} active)
                  </option>
                ))}
              </select>
            </label>

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
                const entry = entryFor(month, displayYear);
                return (
                  <button
                    key={month}
                    type="button"
                    disabled={state === "future"}
                    onClick={() => handleMonthClick(month)}
                    title={
                      state === "future" ? "Future month"
                      : state === "processed"
                        ? entry?.hasAdvice
                          ? "Processed · advice issued"
                          : "Processed — click to undo"
                      : state === "blocked" ? "A later month is processed; undo it first"
                      : undefined
                    }
                    className={`py-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                      state === "selected"
                        ? "bg-primary text-white shadow-sm"
                        : state === "processed"
                        ? "bg-emerald-50 text-emerald-700 cursor-pointer hover:bg-emerald-100"
                        : state === "blocked"
                        ? "text-slate-300 cursor-pointer hover:bg-slate-50"
                        : state === "future"
                        ? "text-slate-200 cursor-not-allowed"
                        : "text-slate-700 hover:bg-slate-100 cursor-pointer"
                    }`}
                  >
                    {month.slice(0, 3)}
                    {entry?.hasAdvice && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                Processed
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-600" />
                Advice issued
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-slate-200" />
                Blocked / future
              </span>
            </div>

            <div className="min-h-[36px] flex items-center justify-center">
              {selected ? (
                <p className="text-xs text-slate-500 text-center">
                  <span className="font-semibold text-slate-700">
                    {office?.activeCount ?? 0}
                  </span>{" "}
                  active {office?.activeCount === 1 ? "employee" : "employees"} at{" "}
                  {office?.nameEn} for{" "}
                  <span className="font-semibold text-slate-700">
                    {selMonth} {selYear}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-slate-400 text-center">
                  Select a month to process, or a processed month to undo it
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

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
                disabled={!selected || loading !== null}
                onClick={() => runProcess("regular")}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {loading === "regular" ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Zap size={14} />
                )}
                {loading === "regular" ? "Processing…" : "Process regular staff"}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Daily-basis staff are paid from the attendance register, under
              Salary Fixation → Daily basis.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
