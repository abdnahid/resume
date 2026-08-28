"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Gavel,
  Plus,
  Scale,
  Undo2,
  X,
} from "lucide-react";
import type { CaseRecord } from "@/lib/salary/cases";
import type { SalaryHeadRecord, VerdictClauseType } from "@/lib/salary/compute";
import { CLAUSE_LABEL, CLAUSE_VALUE_HINT } from "@/lib/salary/compute";

/**
 * The case register, and the one place a verdict is turned into money.
 *
 * Recording a verdict applies it immediately: it raises a fixation version from
 * its effective date, and a restoring version for the day after it ends.
 * Revoking one restores normal pay and, where the order says so, totals the pay
 * that was withheld so the next processed month makes it good.
 */

const FORUMS = [
  ["departmental", "Departmental"],
  ["administrative_tribunal", "Administrative Tribunal"],
  ["civil_court", "Civil Court"],
  ["criminal_court", "Criminal Court"],
  ["high_court", "High Court Division"],
  ["appellate_division", "Appellate Division"],
] as const;

const STATUSES = [
  ["open", "Open"],
  ["under_trial", "Under trial"],
  ["verdict_given", "Verdict given"],
  ["under_appeal", "Under appeal"],
  ["closed", "Closed"],
] as const;

const STATUS_STYLE: Record<string, string> = {
  open: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  under_trial: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  verdict_given: "bg-red-50 text-red-700 ring-1 ring-red-200",
  under_appeal: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  closed: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};

const CLAUSE_ORDER: VerdictClauseType[] = [
  "reduce_increments",
  "withhold_increment",
  "demote_grade",
  "basic_percent",
  "suppress_allowances",
  "suppress_head",
];

const INPUT =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none";

type Employee = { id: string; nameBn: string; nameEn: string; office: string };
type DraftClause = { type: VerdictClauseType; value: string; headId: string };

function formatBDT(n: number) {
  return "৳ " + n.toLocaleString("en-BD");
}

export default function CaseManager({
  cases,
  employees,
  heads,
}: {
  cases: CaseRecord[];
  employees: Employee[];
  heads: SalaryHeadRecord[];
}) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [newCase, setNewCase] = useState(false);
  const [verdictFor, setVerdictFor] = useState<CaseRecord | null>(null);
  const [revokeFor, setRevokeFor] = useState<{ c: CaseRecord; verdictId: number; orderNo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      cases.filter((c) => {
        if (statusFilter && c.status !== statusFilter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          c.caseNo.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.employee.id.includes(q) ||
          c.employee.nameEn.toLowerCase().includes(q) ||
          c.employee.nameBn.includes(search)
        );
      }),
    [cases, search, statusFilter],
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Scale size={18} /> Case register
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-3xl">
              Court and departmental cases against staff. Recording a verdict
              applies it to the employee&apos;s salary fixation straight away;
              lifting one restores normal pay and, where the order directs it,
              pays back what was withheld.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setNewCase(true); setError(null); }}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus size={15} /> New case
          </button>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search case number, title or employee…"
            className={`${INPUT} flex-1 min-w-64`}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${INPUT} w-48 cursor-pointer`}
          >
            <option value="">All statuses</option>
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center">
            <p className="text-sm text-slate-500">
              {cases.length === 0 ? "No cases on the register." : "No cases match your filters."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <CaseCard
                key={c.id}
                kase={c}
                onAddVerdict={() => { setVerdictFor(c); setError(null); setNotice(null); }}
                onRevoke={(verdictId, orderNo) => {
                  setRevokeFor({ c, verdictId, orderNo });
                  setError(null);
                  setNotice(null);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {newCase && (
        <NewCaseModal
          employees={employees}
          onClose={() => setNewCase(false)}
          onSaved={() => { setNewCase(false); router.refresh(); }}
        />
      )}

      {verdictFor && (
        <VerdictModal
          kase={verdictFor}
          heads={heads}
          onClose={() => setVerdictFor(null)}
          onSaved={(msg) => { setVerdictFor(null); setNotice(msg); router.refresh(); }}
        />
      )}

      {revokeFor && (
        <RevokeModal
          verdictId={revokeFor.verdictId}
          orderNo={revokeFor.orderNo}
          onClose={() => setRevokeFor(null)}
          onSaved={(msg) => { setRevokeFor(null); setNotice(msg); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ─── One case ─────────────────────────────────────────────────────────────────

function CaseCard({
  kase,
  onAddVerdict,
  onRevoke,
}: {
  kase: CaseRecord;
  onAddVerdict: () => void;
  onRevoke: (verdictId: number, orderNo: string) => void;
}) {
  const forumLabel = FORUMS.find(([v]) => v === kase.forum)?.[1] ?? kase.forum;
  const statusLabel = STATUSES.find(([v]) => v === kase.status)?.[1] ?? kase.status;
  const liveVerdict = kase.verdicts.find((v) => !v.revokedOn);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-start gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-slate-500">{kase.caseNo}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLE[kase.status] ?? ""}`}>
              {statusLabel}
            </span>
            <span className="text-[11px] text-slate-400">{forumLabel}</span>
          </div>
          <p className="text-sm font-medium text-slate-800 mt-1">{kase.title}</p>
          <p className="text-xs text-slate-500 font-bn-serif mt-0.5">
            {kase.employee.nameBn}
            <span className="font-mono text-slate-400"> · {kase.employee.id}</span>
          </p>
          {kase.summary && (
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{kase.summary}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onAddVerdict}
          disabled={Boolean(liveVerdict)}
          title={liveVerdict ? "A verdict is already in force. Lift it before recording another." : undefined}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Gavel size={13} /> Record verdict
        </button>
      </div>

      {kase.verdicts.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 space-y-2">
          {kase.verdicts.map((v) => (
            <div
              key={v.id}
              className={`rounded-lg border px-3 py-2 ${
                v.revokedOn ? "border-slate-100 bg-white" : "border-red-200 bg-red-50/60"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800">
                    {v.orderNo}
                    <span className="font-normal text-slate-500"> · {v.summary}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                    {v.effectiveFrom} → {v.effectiveTo ?? "until lifted"}
                    {v.revokedOn && ` · revoked ${v.revokedOn}`}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {v.clauses.map((c) => (
                      <span
                        key={c.id}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600"
                      >
                        {CLAUSE_LABEL[c.type]}
                        {c.value !== null && `: ${c.value}`}
                        {c.headName && `: ${c.headName}`}
                      </span>
                    ))}
                  </div>
                  {v.revokedOn && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      {v.revokedReason}
                      {v.arrearsOrdered && (
                        <span className="text-emerald-700 font-medium"> · arrears paid</span>
                      )}
                    </p>
                  )}
                </div>
                {!v.revokedOn && (
                  <button
                    type="button"
                    onClick={() => onRevoke(v.id, v.orderNo)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 text-[11px] font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Undo2 size={12} /> Lift
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden">
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

// ─── New case ─────────────────────────────────────────────────────────────────

function NewCaseModal({
  employees,
  onClose,
  onSaved,
}: {
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    employeeId: "",
    caseNo: "",
    title: "",
    forum: "departmental",
    status: "open",
    filedOn: "",
    summary: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the case");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New case" onClose={onClose}>
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Employee</span>
        <select
          value={form.employeeId}
          onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
          className={`${INPUT} mt-1 cursor-pointer`}
        >
          <option value="">Select an employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.id} — {e.nameEn}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Case number</span>
          <input
            value={form.caseNo}
            onChange={(e) => setForm({ ...form, caseNo: e.target.value })}
            placeholder="AT/2027/114"
            className={`${INPUT} mt-1 font-mono`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Filed on</span>
          <input
            type="date"
            value={form.filedOn}
            onChange={(e) => setForm({ ...form, filedOn: e.target.value })}
            className={`${INPUT} mt-1 tabular-nums cursor-pointer`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Forum</span>
          <select
            value={form.forum}
            onChange={(e) => setForm({ ...form, forum: e.target.value })}
            className={`${INPUT} mt-1 cursor-pointer`}
          >
            {FORUMS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Status</span>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className={`${INPUT} mt-1 cursor-pointer`}
          >
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-slate-500">Title</span>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Departmental proceedings for absence without leave"
          className={`${INPUT} mt-1`}
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-500">Summary (optional)</span>
        <textarea
          rows={3}
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
          className={`${INPUT} mt-1`}
        />
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {saving ? "Saving…" : "Create case"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Record a verdict ─────────────────────────────────────────────────────────

function VerdictModal({
  kase,
  heads,
  onClose,
  onSaved,
}: {
  kase: CaseRecord;
  heads: SalaryHeadRecord[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    orderNo: "",
    verdictDate: "",
    effectiveFrom: "",
    effectiveTo: "",
    summary: "",
    reduceDerivedAllowances: false,
  });
  const [clauses, setClauses] = useState<DraftClause[]>([]);
  const [adding, setAdding] = useState<VerdictClauseType | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPercentClause = clauses.some((c) => c.type === "basic_percent");

  function addClause() {
    if (!adding) return;
    setClauses((cs) => [...cs, { type: adding, value: "", headId: "" }]);
    setAdding("");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${kase.id}/verdicts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          clauses: clauses.map((c) => ({
            type: c.type,
            value: c.value === "" ? null : Number(c.value),
            headId: c.headId === "" ? null : Number(c.headId),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not record the verdict");
      const a = data.applied;
      onSaved(
        `Verdict recorded and applied. Net pay ${formatBDT(a.netBefore)} → ${formatBDT(a.netAfter)} from ${form.effectiveFrom}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Record a verdict"
      subtitle={`${kase.caseNo} · ${kase.employee.nameEn}`}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Order number</span>
          <input
            value={form.orderNo}
            onChange={(e) => setForm({ ...form, orderNo: e.target.value })}
            className={`${INPUT} mt-1 font-mono`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Verdict date</span>
          <input
            type="date"
            value={form.verdictDate}
            onChange={(e) => setForm({ ...form, verdictDate: e.target.value })}
            className={`${INPUT} mt-1 tabular-nums cursor-pointer`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Takes effect from</span>
          <input
            type="date"
            value={form.effectiveFrom}
            onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
            className={`${INPUT} mt-1 tabular-nums cursor-pointer`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Until (optional)</span>
          <input
            type="date"
            value={form.effectiveTo}
            onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
            className={`${INPUT} mt-1 tabular-nums cursor-pointer`}
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            Leave blank if it stands until lifted.
          </span>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-slate-500">What the order says</span>
        <textarea
          rows={2}
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
          placeholder="All allowances cancelled for one year"
          className={`${INPUT} mt-1`}
        />
      </label>

      {/* Clauses */}
      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          What it does to pay
        </p>

        {clauses.length === 0 && (
          <p className="text-xs text-slate-400 italic">
            No clauses yet — a verdict with none would change nothing.
          </p>
        )}

        {clauses.map((c, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
            <span className="text-sm text-slate-800 flex-1">{CLAUSE_LABEL[c.type]}</span>

            {c.type === "suppress_head" ? (
              <select
                value={c.headId}
                onChange={(e) =>
                  setClauses((cs) => cs.map((x, j) => (j === i ? { ...x, headId: e.target.value } : x)))
                }
                className="w-56 rounded-lg border border-slate-200 px-2 py-1 text-sm cursor-pointer"
              >
                <option value="">Choose a head…</option>
                {heads.map((h) => (
                  <option key={h.id} value={h.id}>{h.nameEn}</option>
                ))}
              </select>
            ) : CLAUSE_VALUE_HINT[c.type] ? (
              <label className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">{CLAUSE_VALUE_HINT[c.type]}</span>
                <input
                  type="number"
                  min={1}
                  value={c.value}
                  onChange={(e) =>
                    setClauses((cs) => cs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                  }
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm text-right tabular-nums"
                />
              </label>
            ) : null}

            <button
              type="button"
              onClick={() => setClauses((cs) => cs.filter((_, j) => j !== i))}
              className="h-6 w-6 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        ))}

        <div className="flex items-center gap-2">
          <select
            value={adding}
            onChange={(e) => setAdding(e.target.value as VerdictClauseType | "")}
            className={`${INPUT} flex-1 cursor-pointer`}
          >
            <option value="">Add a clause…</option>
            {CLAUSE_ORDER.filter(
              (t) => t === "suppress_head" || !clauses.some((c) => c.type === t),
            ).map((t) => (
              <option key={t} value={t}>{CLAUSE_LABEL[t]}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!adding}
            onClick={addClause}
            className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {hasPercentClause && (
          <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
            <input
              type="checkbox"
              checked={form.reduceDerivedAllowances}
              onChange={(e) => setForm({ ...form, reduceDerivedAllowances: e.target.checked })}
              className="mt-0.5 cursor-pointer"
            />
            <span>
              Reduce percentage allowances too.
              <span className="block text-[11px] text-slate-500 mt-0.5">
                Off (the default) means house rent and other percentage
                allowances stay on the <strong>full scale basic</strong> — &ldquo;half
                the basic only, rest remains same&rdquo;. On, they follow the
                reduced basic down.
              </span>
            </span>
          </label>
        )}
      </div>

      <p className="flex gap-2 text-[11px] text-slate-500 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
        Saving applies this to the employee&apos;s salary immediately — a new
        fixation version from the effective date, and a restoring version for the
        day after it ends. A month already paid cannot be reduced.
      </p>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
        >
          <Gavel size={15} />
          {saving ? "Applying…" : "Record and apply"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Lift a verdict ───────────────────────────────────────────────────────────

function RevokeModal({
  verdictId,
  orderNo,
  onClose,
  onSaved,
}: {
  verdictId: number;
  orderNo: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [revokedOn, setRevokedOn] = useState("");
  const [reason, setReason] = useState("");
  const [arrearsOrdered, setArrearsOrdered] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/verdicts/${verdictId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revokedOn, reason, arrearsOrdered }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not lift the verdict");
      onSaved(
        data.arrearAmount > 0
          ? `Verdict lifted. Arrears of ${formatBDT(data.arrearAmount)} across ${data.arrearMonths} month(s) will be paid with the next salary processed.`
          : "Verdict lifted. Normal pay resumes from the date given.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Lift the verdict" subtitle={orderNo} onClose={onClose}>
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Normal pay resumes from</span>
        <input
          type="date"
          value={revokedOn}
          onChange={(e) => setRevokedOn(e.target.value)}
          className={`${INPUT} mt-1 tabular-nums cursor-pointer`}
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-500">Why it is being lifted</span>
        <textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Appeal allowed by the Administrative Tribunal"
          className={`${INPUT} mt-1`}
        />
      </label>

      <label className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5">
        <input
          type="checkbox"
          checked={arrearsOrdered}
          onChange={(e) => setArrearsOrdered(e.target.checked)}
          className="mt-0.5 cursor-pointer"
        />
        <span>
          The order directs that withheld pay be made good.
          <span className="block text-[11px] text-slate-500 mt-0.5">
            Totals the difference across every month already paid under this
            verdict, and adds it to the next salary processed for the employee.
          </span>
        </span>
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
        >
          <Check size={15} />
          {saving ? "Lifting…" : "Lift verdict"}
        </button>
      </div>
    </Modal>
  );
}
