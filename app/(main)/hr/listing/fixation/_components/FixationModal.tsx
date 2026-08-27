"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, CheckCircle2 } from "lucide-react";
import type { Employee } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Stored `MM-DD-YYYY` → the `YYYY-MM-DD` an `<input type="date">` wants. */
function toInputDate(stored: string): string {
  const m = stored.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : "";
}

const GRADES = Array.from({ length: 20 }, (_, i) => i + 1);

// ─── Component ────────────────────────────────────────────────────────────────

export default function FixationModal({
  employee,
  onClose,
}: {
  /** The row being fixed. Null renders nothing — the parent owns that state. */
  employee: Employee | null;
  onClose: () => void;
}) {
  const router = useRouter();

  const [grade, setGrade] = useState("");
  const [basicSalary, setBasicSalary] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validThru, setValidThru] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Load current values every time the modal opens on a different employee.
  // `expired` and `not_found` are computed at read time and never stored, so a
  // row showing either is edited back as `active` unless changed here.
  useEffect(() => {
    if (!employee) return;
    const f = employee.fixation;

    setGrade(f.grade ? String(f.grade) : "");
    setBasicSalary(f.basicSalary ? String(f.basicSalary) : "");
    setValidFrom(toInputDate(f.validFrom));
    setValidThru(toInputDate(f.validThru));
    setStatus(f.salaryStatus === "inactive" ? "inactive" : "active");
    setError(null);
    setSaved(false);
  }, [employee]);

  if (!employee) return null;

  const isNew = !(employee.fixation.validFrom && employee.fixation.validThru);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/salary/fixation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          grade,
          basicSalary,
          validFrom,
          validThru,
          salaryStatus: status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save fixation");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {isNew ? "Set Salary Fixation" : "Edit Salary Fixation"}
            </h2>
            <p className="text-sm text-slate-500 font-bn-serif mt-0.5">
              {employee.name.bn}
            </p>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {employee.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {saved ? (
          /* ── Success state ────────────────────────────────────────────── */
          <div className="px-5 py-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={28} className="text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">Fixation saved</p>
                <p className="text-sm text-slate-500">
                  Grade {grade} · ৳ {Number(basicSalary).toLocaleString("en-BD")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          /* ── Form ─────────────────────────────────────────────────────── */
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Grade</span>
                <select
                  required
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none cursor-pointer"
                >
                  <option value="" disabled>
                    Select
                  </option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      Grade {g}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">
                  Basic salary (৳)
                </span>
                <input
                  type="number"
                  required
                  min={1}
                  step={1}
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 tabular-nums focus:border-slate-400 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">
                  Valid from
                </span>
                <input
                  type="date"
                  required
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 tabular-nums focus:border-slate-400 focus:outline-none cursor-pointer"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">
                  Valid through
                </span>
                <input
                  type="date"
                  required
                  min={validFrom || undefined}
                  value={validThru}
                  onChange={(e) => setValidThru(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 tabular-nums focus:border-slate-400 focus:outline-none cursor-pointer"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-slate-500">Status</span>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "active" | "inactive")
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none cursor-pointer"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <span className="mt-1 block text-[11px] text-slate-400">
                A record past its valid-through date shows as Expired on its own.
              </span>
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {saving ? "Saving…" : isNew ? "Set fixation" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
