"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Lock,
  Users,
} from "lucide-react";
import PageContainer from "@/components/PageContainer";
import type { AttendanceSheet } from "@/lib/salary/attendance";

/**
 * Record days worked for daily-basis staff, a month at a time.
 *
 * Deliberately not part of the pay run. Days can be entered as the month goes
 * along and corrected afterwards; only once a month has actually been paid does
 * a row lock, because changing it then would leave the payslip and the bank
 * advice disagreeing with the register.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatBDT(n: number) {
  return "৳ " + n.toLocaleString("en-BD");
}

const INPUT =
  "rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none";

export default function AttendanceRegister({
  offices,
  pinned,
}: {
  offices: { id: number; nameEn: string }[];
  pinned: boolean;
}) {
  const now = new Date();
  const [officeId, setOfficeId] = useState(offices[0]?.id ?? 0);
  const [month, setMonth] = useState(MONTHS[now.getMonth()]);
  const [year, setYear] = useState(String(now.getFullYear()));

  const [sheet, setSheet] = useState<AttendanceSheet | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!officeId) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/salary/attendance?officeId=${officeId}&month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load attendance");
      setSheet(data as AttendanceSheet);
      setDraft(
        Object.fromEntries(
          (data as AttendanceSheet).rows.map((r) => [
            r.employeeId,
            r.daysWorked === null ? "" : String(r.daysWorked),
          ]),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSheet(null);
    } finally {
      setLoading(false);
    }
  }, [officeId, month, year]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!sheet) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const days = sheet.rows
        .filter((r) => !r.processed)
        .map((r) => ({ employeeId: r.employeeId, daysWorked: draft[r.employeeId] ?? "" }));
      const res = await fetch("/api/salary/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officeId, month, year, days }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save attendance");
      setNotice(
        `Saved ${data.saved} record${data.saved === 1 ? "" : "s"}.` +
          (data.clamped?.length
            ? ` ${data.clamped.length} were above the ${data.maxDays}-day ceiling and were reduced to it.`
            : ""),
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const editable = sheet?.rows.filter((r) => !r.processed) ?? [];
  const missing = editable.filter((r) => !draft[r.employeeId]).length;
  const total = (sheet?.rows ?? []).reduce((sum, r) => {
    const d = Number(draft[r.employeeId]);
    return sum + (Number.isFinite(d) && r.dailyRate ? d * r.dailyRate : 0);
  }, 0);

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 3 + i));

  return (
    <PageContainer>
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <CalendarClock size={18} /> Attendance
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Days worked by daily-basis staff. Record them as the month goes along —
          salary processing reads this register and will not pay anyone whose
          days are missing. Staff on a fixation do not appear here; their pay
          comes from their salary structure.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={officeId}
          disabled={pinned || offices.length <= 1}
          onChange={(e) => setOfficeId(Number(e.target.value))}
          className={`${INPUT} w-72 cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed`}
        >
          {offices.map((o) => (
            <option key={o.id} value={o.id}>{o.nameEn}</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={`${INPUT} w-40 cursor-pointer`}
        >
          {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className={`${INPUT} w-28 cursor-pointer`}
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {error && (
        <p className="flex gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Loading…</p>
      ) : !sheet || sheet.rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center">
          <Users size={20} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-500">
            No daily-basis staff at this office.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span className="w-28 shrink-0">ID</span>
              <span className="flex-1">Employee</span>
              <span className="w-24 text-right">Rate</span>
              <span className="w-20 text-right">Days</span>
              <span className="w-28 text-right">Payable</span>
              <span className="w-36">Recorded</span>
            </div>
            <div className="divide-y divide-slate-50">
              {sheet.rows.map((r) => {
                const d = Number(draft[r.employeeId]);
                const payable =
                  Number.isFinite(d) && r.dailyRate ? d * r.dailyRate : null;
                return (
                  <div key={r.employeeId} className="flex items-center gap-4 px-4 py-2.5">
                    <span className="w-28 shrink-0 font-mono text-xs text-slate-400">
                      {r.employeeId}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-800">{r.nameEn}</p>
                      <p className="truncate font-bn-serif text-[11px] text-slate-400">
                        {r.designationBn ?? "—"}
                      </p>
                    </div>
                    <span className="w-24 text-right text-xs tabular-nums text-slate-500">
                      {r.dailyRate === null ? (
                        <span className="text-amber-600">no rate</span>
                      ) : (
                        `৳${r.dailyRate}/day`
                      )}
                    </span>
                    <div className="w-20 text-right">
                      {r.processed ? (
                        <span className="inline-flex items-center gap-1 text-sm tabular-nums text-slate-500">
                          <Lock size={11} /> {r.daysWorked}
                        </span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          max={sheet.maxDays}
                          value={draft[r.employeeId] ?? ""}
                          placeholder="—"
                          onChange={(e) =>
                            setDraft((p) => ({ ...p, [r.employeeId]: e.target.value }))
                          }
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm tabular-nums focus:border-slate-400 focus:outline-none"
                        />
                      )}
                    </div>
                    <span className="w-28 text-right text-sm font-medium tabular-nums text-slate-800">
                      {payable === null ? "—" : formatBDT(payable)}
                    </span>
                    <span className="w-36 truncate text-[11px] text-slate-400">
                      {r.processed
                        ? "paid — locked"
                        : r.recordedBy
                          ? `by ${r.recordedBy}`
                          : "not recorded"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white">
            <div className="text-xs text-slate-300">
              {sheet.rows.length} daily-basis · {missing} still without days ·
              at most {sheet.maxDays} days a month
            </div>
            <div className="text-sm font-semibold tabular-nums">
              {formatBDT(total)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving || editable.length === 0}
              onClick={() =>
                setDraft((p) => {
                  const next = { ...p };
                  for (const r of editable) next[r.employeeId] = String(sheet.maxDays);
                  return next;
                })
              }
              className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              Set all to {sheet.maxDays}
            </button>
            <button
              type="button"
              disabled={saving || editable.length === 0}
              onClick={save}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Check size={15} />
              {saving ? "Saving…" : "Save attendance"}
            </button>
          </div>
        </>
      )}
    </PageContainer>
  );
}
