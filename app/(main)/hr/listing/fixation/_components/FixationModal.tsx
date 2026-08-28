"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Gavel,
  History,
  Lock,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Employee } from "@/lib/types";
import {
  applyVerdict,
  computeSheet,
  FIXATION_REASONS,
  headsToSheetInputs,
  stepsForGrade,
  verdictOn,
  ZONE_LABEL,
  type FixationContext,
  type FixationReason,
  type FixationVersion,
  type SalarySheet,
} from "@/lib/salary/compute";
import {
  dateKey,
  fiscalYear,
  toInputDate,
  toStoredDate,
} from "@/lib/salary/dates";

/**
 * Salary fixation, as a compilation of building blocks.
 *
 * Basic salary comes from the pay scale for the grade; house rent from the
 * government slab table for the office's zone; every other allowance and
 * deduction is a head attached here and removable per employee.
 *
 * The preview stage is not decoration — `computeSheet()` is the same function
 * the route calls when it saves, so the sheet an operator approves is the sheet
 * that gets stored. Only `lib/salary/compute.ts` and `lib/salary/dates.ts` are
 * imported, never `lib/salary/queries.ts`: this is a client component, and the
 * query half would drag `pg` into the browser bundle (D9).
 */

type Stage = "form" | "preview" | "saved";
type Mode = "new" | "edit";

type AttachedLine = { headId: number; value: string };

const GRADES = Array.from({ length: 20 }, (_, i) => i + 1);

function formatBDT(amount: number) {
  return "৳ " + amount.toLocaleString("en-BD");
}

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

  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<FixationContext | null>(null);
  const [versions, setVersions] = useState<FixationVersion[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [stage, setStage] = useState<Stage>("form");
  const [mode, setMode] = useState<Mode>("new");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [reason, setReason] = useState<FixationReason>("annual");
  const [grade, setGrade] = useState("");
  const [step, setStep] = useState("");
  const [basicSalary, setBasicSalary] = useState("");
  // Always the stored `MM-DD-YYYY` form, never the `YYYY-MM-DD` an
  // `<input type="date">` emits. Mixing the two silently broke both the
  // date check and the verdict lookup, since neither can be compared or
  // parsed without knowing which form it is holding.
  const [validFrom, setValidFrom] = useState("");
  const [validThru, setValidThru] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<AttachedLine[]>([]);
  const [addingHeadId, setAddingHeadId] = useState("");

  const current = versions.find((v) => v.salaryStatus === "active") ?? null;
  const hasScale = Boolean(context?.scale?.verified && context.steps.length);

  // ── Load context and history whenever the modal opens on an employee ───────
  const load = useCallback(async (employeeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/salary/fixation?employeeId=${encodeURIComponent(employeeId)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load fixation data");
      setContext(data.context as FixationContext);
      setVersions(data.versions as FixationVersion[]);
      return data as { context: FixationContext; versions: FixationVersion[] };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!employee) return;

    setStage("form");
    setShowHistory(false);
    setError(null);
    setAddingHeadId("");

    load(employee.id).then((data) => {
      if (!data) return;
      const { context: ctx, versions: vs } = data;
      const inForce = vs.find((v) => v.salaryStatus === "active") ?? null;
      const fy = fiscalYear();

      if (inForce) {
        // Default to raising a new version — the fiscal-year case and the
        // mid-year case both want one. Correcting in place is opt-in.
        setMode("new");
        setReason("annual");
        setGrade(String(inForce.grade));
        // Versions fixed before the grid was loaded carry no step. Recover it
        // when the stored basic happens to be a rung; otherwise leave it unset
        // and let `offGridBasic` explain why.
        setStep(
          inForce.step !== null
            ? String(inForce.step)
            : String(
                ctx.steps.find(
                  (s) =>
                    s.grade === inForce.grade &&
                    s.amount === inForce.basicSalary,
                )?.step ?? "",
              ),
        );
        setBasicSalary(String(inForce.basicSalary));
        setValidFrom(fy.from);
        setValidThru(fy.thru);
        setStatus("active");
        setNote("");
        setLines(
          inForce.items.map((i) => ({
            headId: i.headId,
            value: i.value === null ? "" : String(i.value),
          })),
        );
      } else {
        setMode("new");
        setReason(vs.length ? "annual" : "initial");
        const empGrade = Number(employee.current_job.grade);
        setGrade(Number.isInteger(empGrade) && empGrade >= 1 && empGrade <= 20 ? String(empGrade) : "");
        setStep("");
        setBasicSalary("");
        setValidFrom(fy.from);
        setValidThru(fy.thru);
        setStatus("active");
        setNote("");
        setLines(
          ctx.heads
            .filter((h) => h.isDefault && h.isActive)
            .map((h) => ({
              headId: h.id,
              value: h.defaultValue === null ? "" : String(h.defaultValue),
            })),
        );
      }
    });
  }, [employee, load]);

  // ── Switching between correcting and raising ──────────────────────────────
  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    if (next === "edit" && current) {
      setReason(current.reason);
      setGrade(String(current.grade));
      setStep(
        current.step !== null
          ? String(current.step)
          : String(
              (context?.steps ?? []).find(
                (s) =>
                  s.grade === current.grade && s.amount === current.basicSalary,
              )?.step ?? "",
            ),
      );
      setBasicSalary(String(current.basicSalary));
      setValidFrom(current.validFrom);
      setValidThru(current.validThru);
      setStatus(current.salaryStatus === "inactive" ? "inactive" : "active");
      setNote(current.note ?? "");
      setLines(
        current.items.map((i) => ({
          headId: i.headId,
          value: i.value === null ? "" : String(i.value),
        })),
      );
    } else {
      const fy = fiscalYear();
      setReason("annual");
      setValidFrom(fy.from);
      setValidThru(fy.thru);
      setNote("");
    }
  }

  // ── The sheet, recomputed on every keystroke ──────────────────────────────
  // Basic salary is the scale's figure for the grade and step. It is never
  // typed — a reduced salary is a court verdict applied on top, not a number
  // an operator invents.
  const resolvedBasic = useMemo(() => {
    if (!context || grade === "" || step === "") return 0;
    const cell = context.steps.find(
      (s) => s.grade === Number(grade) && s.step === Number(step),
    );
    return cell?.amount ?? 0;
  }, [step, grade, context]);

  /**
   * A stored basic that is not a rung on the grade's scale — the six legacy
   * rows fixed before the grid was loaded. Surfaced so the operator is told to
   * put the employee back on scale rather than silently losing the old figure.
   */
  const offGridBasic = useMemo(() => {
    if (!context || step !== "" || grade === "") return null;
    const stored = Number(basicSalary);
    if (!Number.isFinite(stored) || stored <= 0) return null;
    const onGrid = context.steps.some(
      (s) => s.grade === Number(grade) && s.amount === stored,
    );
    return onGrid ? null : stored;
  }, [context, step, grade, basicSalary]);

  /** The verdict in force on the date this version takes effect, if any. */
  const activeVerdict = useMemo(() => {
    if (!context || !validFrom) return null;
    return verdictOn(context.verdicts, validFrom);
  }, [context, validFrom]);

  const sheet: SalarySheet | null = useMemo(() => {
    if (!context) return null;
    const effect = applyVerdict(
      grade === "" ? 0 : Number(grade),
      step === "" ? 0 : Number(step),
      context.steps,
      activeVerdict,
    );
    return computeSheet({
      basicSalary: activeVerdict ? effect.basicSalary : resolvedBasic,
      percentBase: activeVerdict ? effect.percentBase : resolvedBasic,
      zone: context.zone,
      heads: headsToSheetInputs(
        context.heads,
        lines.map((l) => ({
          headId: l.headId,
          value: l.value === "" ? null : Number(l.value),
        })),
      ),
      slabs: context.slabs,
      suppressAllAllowances: effect.suppressAllAllowances,
      suppressedHeadIds: effect.suppressedHeadIds,
      verdictNotes: effect.notes,
    });
  }, [context, resolvedBasic, lines, activeVerdict, grade, step]);

  if (!employee) return null;

  const gradeSteps =
    context && grade !== "" ? stepsForGrade(context.steps, Number(grade)) : [];

  const attachedIds = new Set(lines.map((l) => l.headId));
  const available = (context?.heads ?? []).filter(
    (h) => h.isActive && !attachedIds.has(h.id),
  );

  function headById(id: number) {
    return context?.heads.find((h) => h.id === id) ?? null;
  }

  function addHead() {
    const id = Number(addingHeadId);
    if (!Number.isInteger(id)) return;
    const head = headById(id);
    if (!head) return;
    setLines((ls) => [
      ...ls,
      { headId: id, value: head.defaultValue === null ? "" : String(head.defaultValue) },
    ]);
    setAddingHeadId("");
  }

  function removeHead(id: number) {
    setLines((ls) => ls.filter((l) => l.headId !== id));
  }

  function setLineValue(id: number, value: string) {
    setLines((ls) => ls.map((l) => (l.headId === id ? { ...l, value } : l)));
  }

  // ── Validation before the preview stage ───────────────────────────────────
  function validate(): string | null {
    if (grade === "") return "Choose a grade.";
    if (!hasScale) return "No verified pay scale is loaded.";
    if (step === "") return "Choose a step — basic salary comes from the scale.";
    if (resolvedBasic <= 0) return "That grade and step is not on the scale.";
    if (!validFrom) return "Choose an effective-from date.";
    if (!validThru) return "Choose a valid-through date.";
    if (dateKey(validThru) < dateKey(validFrom)) {
      return "Valid through cannot be earlier than valid from.";
    }
    return null;
  }

  function goPreview() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStage("preview");
  }

  async function handleSave() {
    if (!employee) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/salary/fixation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          fixationId: mode === "edit" && current ? current.id : undefined,
          grade,
          step,
          validFrom,
          validThru,
          salaryStatus: status,
          reason,
          note,
          items: lines.map((l) => ({
            headId: l.headId,
            value: l.value === "" ? null : Number(l.value),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save fixation");
      setStage("saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("form");
    } finally {
      setSaving(false);
    }
  }

  const isNew = versions.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {stage === "preview"
                ? "Check the salary sheet"
                : isNew
                  ? "Set salary fixation"
                  : mode === "edit"
                    ? "Correct the current fixation"
                    : "Raise a new fixation"}
            </h2>
            <p className="text-sm text-slate-500 font-bn-serif mt-0.5">
              {employee.name.bn}
            </p>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {employee.id}
              {context?.officeName ? ` · ${context.officeName}` : ""}
              {context?.zone ? ` · ${ZONE_LABEL[context.zone]}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {versions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                title="Fixation history"
                className={`h-7 px-2 flex items-center gap-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  showHistory
                    ? "bg-slate-100 text-slate-700"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                }`}
              >
                <History size={14} />
                {versions.length}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {loading && (
          <p className="px-6 py-10 text-center text-sm text-slate-400">
            Loading pay scale and heads…
          </p>
        )}

        {/* ── History ──────────────────────────────────────────────────── */}
        {!loading && showHistory && (
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Fixation history
            </p>
            <div className="space-y-1.5">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 text-xs bg-white rounded-lg border border-slate-100 px-3 py-2"
                >
                  <span className="tabular-nums text-slate-500 w-44 shrink-0">
                    {v.validFrom} → {v.validThru}
                  </span>
                  <span className="text-slate-400 w-20 shrink-0 capitalize">
                    {v.reason}
                  </span>
                  <span className="tabular-nums text-slate-700 font-medium w-24 shrink-0">
                    {formatBDT(v.netSalary)}
                  </span>
                  <span className="text-slate-400">
                    grade {v.grade}
                    {v.step !== null ? `, step ${v.step}` : ""}
                  </span>
                  {v.isLocked && (
                    <span className="ml-auto inline-flex items-center gap-1 text-slate-400">
                      <Lock size={11} /> paid
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Saved ────────────────────────────────────────────────────── */}
        {stage === "saved" && (
          <div className="px-6 py-8 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={28} className="text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">Fixation saved</p>
                <p className="text-sm text-slate-500">
                  Grade {grade}
                  {step !== "" ? `, step ${step}` : ""} · net{" "}
                  {formatBDT(sheet?.netSalary ?? 0)} from {validFrom}
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
        )}

        {/* ── Preview ──────────────────────────────────────────────────── */}
        {stage === "preview" && sheet && (
          <div className="px-6 py-5 space-y-4">
            <SalarySheetView sheet={sheet} employee={employee} />

            {sheet.verdictNotes.length > 0 && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 space-y-1">
                <p className="flex items-center gap-2 text-xs font-semibold text-red-800">
                  <Gavel size={13} /> Applied by court verdict
                </p>
                {sheet.verdictNotes.map((n, i) => (
                  <p key={i} className="text-xs text-red-700 pl-5">
                    {n}
                  </p>
                ))}
              </div>
            )}

            {sheet.warnings.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
                {sheet.warnings.map((w, i) => (
                  <p key={i} className="flex gap-2 text-xs text-amber-800">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    {w}
                  </p>
                ))}
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStage("form")}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={14} />
                Back to edit
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {saving ? "Saving…" : "Confirm and save"}
              </button>
            </div>
          </div>
        )}

        {/* ── Form ─────────────────────────────────────────────────────── */}
        {!loading && stage === "form" && context && (
          <div className="px-6 py-5 space-y-5">
            {/* Mode switch */}
            {current && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => switchMode("new")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    mode === "new"
                      ? "bg-primary text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Raise a new version
                </button>
                <button
                  type="button"
                  disabled={current.isLocked || current.verdictId !== null}
                  onClick={() => switchMode("edit")}
                  title={
                    current.verdictId !== null
                      ? "This version comes from a court verdict. Lift or amend the verdict in case management instead."
                      : current.isLocked
                        ? "A salary month has been processed against this version, so it can no longer be edited."
                        : undefined
                  }
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    current.isLocked || current.verdictId !== null
                      ? "border border-slate-100 text-slate-300 cursor-not-allowed"
                      : mode === "edit"
                        ? "bg-primary text-white cursor-pointer"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  }`}
                >
                  {(current.isLocked || current.verdictId !== null) && (
                    <Lock size={11} className="inline mr-1" />
                  )}
                  Correct the current one
                </button>
              </div>
            )}

            {activeVerdict && !current?.verdictId && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                  <Gavel size={14} />
                  Verdict {activeVerdict.orderNo} is in force on {validFrom}
                </p>
                <p className="text-[11px] text-amber-800 mt-1">
                  {activeVerdict.summary} — its clauses are applied to the sheet
                  below and to whatever is saved.
                </p>
              </div>
            )}

            {current?.verdictId && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-red-800">
                  <Gavel size={14} />
                  Under court verdict {current.verdictOrderNo}
                </p>
                <p className="text-[11px] text-red-700 mt-1">
                  Pay is currently set by that order, not by this form. A new
                  version raised here will take over from its effective date —
                  to restore normal pay instead, lift the verdict in case
                  management.
                </p>
              </div>
            )}

            {/* Reason + validity */}
            <div className="grid grid-cols-3 gap-3">
              <label className="block col-span-1">
                <span className="text-xs font-medium text-slate-500">Reason</span>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as FixationReason)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none cursor-pointer"
                >
                  {FIXATION_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">
                  Effective from
                </span>
                <input
                  type="date"
                  value={toInputDate(validFrom)}
                  onChange={(e) => setValidFrom(toStoredDate(e.target.value) ?? "")}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 tabular-nums focus:border-slate-400 focus:outline-none cursor-pointer"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">
                  Valid through
                </span>
                <input
                  type="date"
                  value={toInputDate(validThru)}
                  onChange={(e) => setValidThru(toStoredDate(e.target.value) ?? "")}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 tabular-nums focus:border-slate-400 focus:outline-none cursor-pointer"
                />
              </label>
            </div>

            {mode === "new" && current && (
              <p className="text-[11px] text-slate-400 -mt-2">
                The version running {current.validFrom} → {current.validThru} will
                be closed the day before this one starts.
              </p>
            )}

            {/* Basic salary */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Basic salary
                </p>
                {context.scale && (
                  <span className="text-[11px] text-slate-400">
                    {context.scale.code}
                    {context.scale.incrementNote
                      ? ` · ${context.scale.incrementNote}`
                      : ""}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Grade</span>
                  <select
                    value={grade}
                    onChange={(e) => {
                      setGrade(e.target.value);
                      setStep("");
                    }}
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
                  <span className="text-xs font-medium text-slate-500">Step</span>
                  <select
                    value={step}
                    disabled={!hasScale || !gradeSteps.length}
                    onChange={(e) => setStep(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none cursor-pointer disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed"
                  >
                    <option value="" disabled>
                      {hasScale ? "Select" : "Scale not loaded"}
                    </option>
                    {gradeSteps.map((s) => (
                      <option key={s.step} value={s.step}>
                        {s.step === 0 ? "Initial" : `Increment ${s.step}`} ·{" "}
                        {s.amount.toLocaleString("en-BD")}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="block">
                  <span className="text-xs font-medium text-slate-500">
                    Amount (৳)
                  </span>
                  <div className="mt-1 w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-700">
                    {resolvedBasic > 0 ? (
                      resolvedBasic.toLocaleString("en-BD")
                    ) : (
                      <span className="text-slate-300">From the scale</span>
                    )}
                  </div>
                </div>
              </div>

              {!hasScale && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  No verified pay scale is loaded, so fixation cannot resolve a
                  basic salary. Run <code>npm run seed:salary</code>.
                </p>
              )}

              {hasScale && offGridBasic !== null && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  The stored basic of ৳{offGridBasic.toLocaleString("en-BD")} is
                  not a step on the grade {grade || "—"} scale — it predates the
                  grid being loaded. Choose the correct step to put this employee
                  back on scale.
                </p>
              )}
            </div>

            {/* Heads */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Allowances and deductions
              </p>

              {lines.length === 0 && (
                <p className="text-xs text-slate-400 italic">
                  Nothing attached — this employee would be paid basic salary
                  alone.
                </p>
              )}

              <div className="space-y-1.5">
                {lines.map((line) => {
                  const head = headById(line.headId);
                  if (!head) return null;
                  const computed =
                    sheet &&
                    [...sheet.earnings, ...sheet.deductions].find(
                      (l) => l.headId === line.headId,
                    );
                  return (
                    <div
                      key={line.headId}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
                    >
                      <span
                        className={`w-1.5 h-6 rounded-full shrink-0 ${
                          head.kind === "earning" ? "bg-emerald-400" : "bg-red-300"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800 truncate">
                          {head.nameEn}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate font-bn-serif">
                          {head.nameBn}
                        </p>
                      </div>

                      {head.basis === "house_rent_rule" ? (
                        <span className="text-[11px] text-slate-500 w-40 text-right">
                          {computed?.basisNote ?? "Government rate"}
                        </span>
                      ) : (
                        <label className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={line.value}
                            onChange={(e) =>
                              setLineValue(line.headId, e.target.value)
                            }
                            className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm text-right text-slate-800 tabular-nums focus:border-slate-400 focus:outline-none"
                          />
                          <span className="text-[11px] text-slate-400 w-4">
                            {head.basis === "percent_of_basic" ? "%" : "৳"}
                          </span>
                        </label>
                      )}

                      <span
                        className={`text-sm font-medium tabular-nums w-24 text-right ${
                          head.kind === "earning" ? "text-slate-800" : "text-red-600"
                        }`}
                      >
                        {head.kind === "deduction" ? "− " : ""}
                        {formatBDT(computed?.amount ?? 0)}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeHead(line.headId)}
                        title="Remove this head"
                        className="h-6 w-6 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {available.length > 0 ? (
                <div className="flex items-center gap-2 pt-1">
                  <select
                    value={addingHeadId}
                    onChange={(e) => setAddingHeadId(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none cursor-pointer"
                  >
                    <option value="">Add an allowance or deduction…</option>
                    <optgroup label="Allowances">
                      {available
                        .filter((h) => h.kind === "earning")
                        .map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.nameEn}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Deductions">
                      {available
                        .filter((h) => h.kind === "deduction")
                        .map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.nameEn}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                  <button
                    type="button"
                    disabled={!addingHeadId}
                    onClick={addHead}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  {context.heads.length === 0
                    ? "No salary heads exist yet. A superadmin creates them at HR → Salary heads."
                    : "Every active head is already attached."}
                </p>
              )}
            </div>

            {/* Running total */}
            {sheet && (
              <div className="flex items-center justify-between rounded-xl bg-slate-900 text-white px-4 py-3">
                <div className="text-xs text-slate-300">
                  Gross {formatBDT(sheet.grossEarning)} · Deductions{" "}
                  {formatBDT(sheet.totalDeduction)}
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  Net {formatBDT(sheet.netSalary)}
                </div>
              </div>
            )}

            {/* Status + note */}
            <div className="grid grid-cols-3 gap-3">
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
              </label>
              <label className="block col-span-2">
                <span className="text-xs font-medium text-slate-500">
                  Note (optional)
                </span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Order number, reason for the change…"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                />
              </label>
            </div>

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
                type="button"
                onClick={goPreview}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Preview salary sheet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── The sheet ────────────────────────────────────────────────────────────────

/** The salary sheet as an operator checks it before submitting. */
function SalarySheetView({
  sheet,
  employee,
}: {
  sheet: SalarySheet;
  employee: Employee;
}) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-800 font-bn-serif">
          {employee.name.bn}
        </p>
        <p className="text-xs text-slate-500 font-bn-serif">
          {employee.current_job.designation_bn}
        </p>
      </div>

      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-50">
          <tr>
            <td className="px-4 py-2.5 text-slate-700">Basic salary</td>
            <td className="px-4 py-2.5 text-right text-[11px] text-slate-400">
              From the pay scale
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">
              {formatBDT(sheet.basicSalary)}
            </td>
          </tr>

          {sheet.earnings.map((l) => (
            <tr key={l.headId} className={l.suppressed ? "bg-red-50/40" : undefined}>
              <td className={`px-4 py-2.5 ${l.suppressed ? "text-slate-400 line-through" : "text-slate-700"}`}>
                {l.nameEn}
              </td>
              <td className="px-4 py-2.5 text-right text-[11px] text-slate-400">
                {l.basisNote}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">
                {formatBDT(l.amount)}
              </td>
            </tr>
          ))}

          <tr className="bg-slate-50/70">
            <td colSpan={2} className="px-4 py-2.5 font-medium text-slate-700">
              Gross pay
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">
              {formatBDT(sheet.grossEarning)}
            </td>
          </tr>

          {sheet.deductions.map((l) => (
            <tr key={l.headId}>
              <td className="px-4 py-2.5 text-slate-700">{l.nameEn}</td>
              <td className="px-4 py-2.5 text-right text-[11px] text-slate-400">
                {l.basisNote}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-red-600">
                − {formatBDT(l.amount)}
              </td>
            </tr>
          ))}

          {sheet.deductions.length > 0 && (
            <tr className="bg-slate-50/70">
              <td colSpan={2} className="px-4 py-2.5 font-medium text-slate-700">
                Total deductions
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-red-600">
                − {formatBDT(sheet.totalDeduction)}
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-slate-900 text-white">
            <td colSpan={2} className="px-4 py-3 font-semibold">
              Net payable
            </td>
            <td className="px-4 py-3 text-right tabular-nums font-bold">
              {formatBDT(sheet.netSalary)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
