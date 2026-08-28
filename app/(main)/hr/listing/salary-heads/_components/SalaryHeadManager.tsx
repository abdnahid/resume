"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { SalaryHeadRecord } from "@/lib/salary/compute";
import { ZONE_LABEL } from "@/lib/salary/compute";
import type { ActiveScale } from "@/lib/salary/queries";

/**
 * Create and edit the allowances and deductions that fixation can draw on.
 *
 * A head is either a fixed taka amount or a percentage of basic. House rent is
 * the one exception — it follows the government slab table for the employee's
 * office zone, so its amount is not typed anywhere.
 */

type Basis = "fixed" | "percent_of_basic" | "house_rent_rule";
type Kind = "earning" | "deduction";

const BASIS_LABEL: Record<Basis, string> = {
  fixed: "Fixed amount",
  percent_of_basic: "% of basic",
  house_rent_rule: "Government house rent rule",
};

const BLANK = {
  code: "",
  nameEn: "",
  nameBn: "",
  kind: "earning" as Kind,
  basis: "fixed" as Basis,
  defaultValue: "",
  isDefault: false,
  isActive: true,
  sortOrder: "0",
  note: "",
};

type Draft = typeof BLANK;

function formatBDT(n: number) {
  return "৳ " + n.toLocaleString("en-BD");
}

const INPUT =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none";

export default function SalaryHeadManager({
  heads,
  scale,
}: {
  heads: SalaryHeadRecord[];
  scale: ActiveScale | null;
}) {
  const router = useRouter();

  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNew() {
    setDraft(BLANK);
    setEditing("new");
    setError(null);
  }

  function startEdit(head: SalaryHeadRecord) {
    setDraft({
      code: head.code,
      nameEn: head.nameEn,
      nameBn: head.nameBn,
      kind: head.kind,
      basis: head.basis,
      defaultValue: head.defaultValue === null ? "" : String(head.defaultValue),
      isDefault: head.isDefault,
      isActive: head.isActive,
      sortOrder: String(head.sortOrder),
      note: head.note ?? "",
    });
    setEditing(head.id);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const isNew = editing === "new";
      const res = await fetch(
        isNew ? "/api/salary/heads" : `/api/salary/heads/${editing}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(isNew ? { code: draft.code } : {}),
            nameEn: draft.nameEn,
            nameBn: draft.nameBn,
            kind: draft.kind,
            basis: draft.basis,
            defaultValue: draft.defaultValue === "" ? null : Number(draft.defaultValue),
            isDefault: draft.isDefault,
            isActive: draft.isActive,
            sortOrder: Number(draft.sortOrder),
            note: draft.note,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save the head");
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function remove(head: SalaryHeadRecord) {
    setError(null);
    try {
      const res = await fetch(`/api/salary/heads/${head.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete the head");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const earnings = heads.filter((h) => h.kind === "earning");
  const deductions = heads.filter((h) => h.kind === "deduction");

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-5xl">
        {/* Intro */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Salary heads</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              The building blocks a salary fixation is assembled from. Each head is
              either a fixed taka amount or a percentage of basic salary, and can be
              attached to or removed from any individual employee.
            </p>
          </div>
          <button
            type="button"
            onClick={startNew}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus size={15} />
            New head
          </button>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* House rent rates in force */}
        {scale && scale.slabs.length > 0 && (
          <details className="rounded-xl border border-slate-200 bg-white">
            <summary className="px-4 py-3 text-sm font-medium text-slate-700 cursor-pointer">
              House rent rates in force ({scale.code})
            </summary>
            <div className="px-4 pb-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 uppercase tracking-wider">
                    <th className="text-left py-2">Basic</th>
                    <th className="text-left py-2">Zone</th>
                    <th className="text-right py-2">Rate</th>
                    <th className="text-right py-2">Not less than</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {scale.slabs.map((s, i) => (
                    <tr key={i}>
                      <td className="py-2 tabular-nums text-slate-600">
                        {s.minBasic === 0
                          ? `Up to ${s.maxBasic?.toLocaleString("en-BD")}`
                          : s.maxBasic === null
                            ? `${s.minBasic.toLocaleString("en-BD")} and above`
                            : `${s.minBasic.toLocaleString("en-BD")} – ${s.maxBasic.toLocaleString("en-BD")}`}
                      </td>
                      <td className="py-2 text-slate-600">{ZONE_LABEL[s.zone]}</td>
                      <td className="py-2 text-right tabular-nums text-slate-800">
                        {s.percent}%
                      </td>
                      <td className="py-2 text-right tabular-nums text-slate-800">
                        {formatBDT(s.minAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* Editor */}
        {editing !== null && (
          <div className="rounded-xl border border-slate-300 bg-white p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {editing === "new" ? "New salary head" : `Editing ${draft.code}`}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {editing === "new" && (
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Code</span>
                  <input
                    value={draft.code}
                    onChange={(e) =>
                      setDraft({ ...draft, code: e.target.value.toUpperCase() })
                    }
                    placeholder="MEDICAL"
                    className={`${INPUT} mt-1 font-mono`}
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Permanent — saved fixations are read back through it.
                  </span>
                </label>
              )}

              <label className="block">
                <span className="text-xs font-medium text-slate-500">Kind</span>
                <select
                  value={draft.kind}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as Kind })}
                  className={`${INPUT} mt-1 cursor-pointer`}
                >
                  <option value="earning">Allowance (adds to pay)</option>
                  <option value="deduction">Deduction (subtracts)</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">Name (English)</span>
                <input
                  value={draft.nameEn}
                  onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}
                  placeholder="Medical Allowance"
                  className={`${INPUT} mt-1`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">Name (Bengali)</span>
                <input
                  value={draft.nameBn}
                  onChange={(e) => setDraft({ ...draft, nameBn: e.target.value })}
                  placeholder="চিকিৎসা ভাতা"
                  className={`${INPUT} mt-1 font-bn-serif`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">
                  How it is calculated
                </span>
                <select
                  value={draft.basis}
                  onChange={(e) =>
                    setDraft({ ...draft, basis: e.target.value as Basis })
                  }
                  className={`${INPUT} mt-1 cursor-pointer`}
                >
                  <option value="fixed">Fixed amount (৳)</option>
                  <option value="percent_of_basic">Percentage of basic salary</option>
                  <option value="house_rent_rule">Government house rent rule</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">
                  {draft.basis === "percent_of_basic"
                    ? "Default percentage"
                    : "Default amount (৳)"}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  disabled={draft.basis === "house_rent_rule"}
                  value={draft.defaultValue}
                  onChange={(e) => setDraft({ ...draft, defaultValue: e.target.value })}
                  className={`${INPUT} mt-1 tabular-nums disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed`}
                />
                <span className="mt-1 block text-[11px] text-slate-400">
                  {draft.basis === "house_rent_rule"
                    ? "Set by the slab table, not here."
                    : "What the fixation form starts with. Overridable per employee."}
                </span>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">Sort order</span>
                <input
                  type="number"
                  step={1}
                  value={draft.sortOrder}
                  onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
                  className={`${INPUT} mt-1 tabular-nums`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">Note (optional)</span>
                <input
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  className={`${INPUT} mt-1`}
                />
              </label>
            </div>

            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.isDefault}
                  onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                  className="cursor-pointer"
                />
                Attach to new fixations by default
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                  className="cursor-pointer"
                />
                Active
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Check size={15} />
                {saving ? "Saving…" : "Save head"}
              </button>
            </div>
          </div>
        )}

        {/* Lists */}
        {heads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center">
            <p className="text-sm text-slate-500">No salary heads yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Fixation can still pay basic salary alone, but nothing else until a
              head exists.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <HeadList title="Allowances" heads={earnings} onEdit={startEdit} onDelete={remove} />
            <HeadList title="Deductions" heads={deductions} onEdit={startEdit} onDelete={remove} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── One list ─────────────────────────────────────────────────────────────────

function HeadList({
  title,
  heads,
  onEdit,
  onDelete,
}: {
  title: string;
  heads: SalaryHeadRecord[];
  onEdit: (h: SalaryHeadRecord) => void;
  onDelete: (h: SalaryHeadRecord) => void;
}) {
  if (heads.length === 0) {
    return (
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          {title}
        </h2>
        <p className="text-xs text-slate-400 italic px-1">None yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        {title}
      </h2>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-50">
        {heads.map((h) => (
          <div key={h.id} className="flex items-center gap-4 px-4 py-3">
            <span
              className={`w-1.5 h-8 rounded-full shrink-0 ${
                h.kind === "earning" ? "bg-emerald-400" : "bg-red-300"
              } ${h.isActive ? "" : "opacity-30"}`}
            />
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium truncate ${
                  h.isActive ? "text-slate-800" : "text-slate-400 line-through"
                }`}
              >
                {h.nameEn}
              </p>
              <p className="text-xs text-slate-500 font-bn-serif truncate">
                {h.nameBn}
              </p>
            </div>

            <span className="font-mono text-[11px] text-slate-400 w-28 shrink-0 truncate">
              {h.code}
            </span>

            <span className="text-xs text-slate-500 w-48 shrink-0">
              {BASIS_LABEL[h.basis]}
              {h.basis !== "house_rent_rule" && h.defaultValue !== null && (
                <span className="text-slate-800 font-medium">
                  {" · "}
                  {h.basis === "percent_of_basic"
                    ? `${h.defaultValue}%`
                    : formatBDT(h.defaultValue)}
                </span>
              )}
            </span>

            <div className="w-24 shrink-0 flex flex-col items-start gap-0.5">
              {h.isDefault && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                  default
                </span>
              )}
              {(h.usageCount ?? 0) > 0 && (
                <span className="text-[10px] text-slate-400">
                  used on {h.usageCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onEdit(h)}
                title="Edit"
                className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(h)}
                disabled={(h.usageCount ?? 0) > 0}
                title={
                  (h.usageCount ?? 0) > 0
                    ? "Used by saved fixations — set it inactive instead."
                    : "Delete"
                }
                className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
