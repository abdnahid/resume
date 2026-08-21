"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  X,
  Plus,
  Search,
  ChevronDown,
  Stamp,
  Printer,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { FilterSelect, FilterSelectOption } from "@/app/(main)/_components/filters";
import type {
  IdCardBatchRecord,
  IdCardBatchDetail,
  PersonName,
} from "@/lib/types";

type EmployeeOption = {
  id: string;
  nameBn: string;
  nameEn: string;
  designationBn: string;
  officeBn: string;
};

type CurrentDg = { name: PersonName; hasSignature: boolean } | null;

const INPUT =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-white";

// ─── Status pill ─────────────────────────────────────────────────────────────

function BatchStatusPill({ status }: { status: "pending" | "issued" }) {
  return status === "issued" ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
      Issued
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200">
      Pending
    </span>
  );
}

// ─── Create request modal ──────────────────────────────────────────────────────

function CreateBatchModal({
  employees,
  onClose,
}: {
  employees: EmployeeOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [office, setOffice] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [memoNo, setMemoNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const officeOptions: FilterSelectOption[] = [
    ...new Set(employees.map((e) => e.officeBn).filter(Boolean)),
  ]
    .sort((a, b) => a.localeCompare(b, "bn"))
    .map((o) => ({ label: o, value: o, className: "font-bn-serif" }));

  const filtered = employees.filter((e) => {
    const q = query.toLowerCase();
    const matchQuery =
      !q || e.id.includes(q) || e.nameBn.includes(q) || e.nameEn.toLowerCase().includes(q);
    const matchOffice = !office || e.officeBn === office;
    return matchQuery && matchOffice;
  });

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((e) => selected.has(e.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((e) => next.delete(e.id));
      else filtered.forEach((e) => next.add(e.id));
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) {
      setError("Select at least one employee");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/id-card-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds: [...selected], memoNo: memoNo || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to create request");
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900">New Authorization Request</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select employees to place before the DG for ID card authorization.
            </p>
          </div>
          <button type="button" onClick={onClose} className="ml-3 shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-hidden flex flex-col">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Memo No (optional)</label>
            <input value={memoNo} onChange={(e) => setMemoNo(e.target.value)} className={INPUT} placeholder="Authorization file reference" />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by ID or name…"
                className={INPUT + " pl-9"}
              />
            </div>
            <FilterSelect
              value={office}
              onChange={setOffice}
              options={officeOptions}
              placeholder="সকল অফিস"
              optionClassName="font-bn-serif"
              width="min-w-44"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAllFiltered}
                className="accent-primary"
                disabled={filtered.length === 0}
              />
              Select all{office ? " in office" : ""} ({filtered.length})
            </label>
            <span className="text-slate-500">
              {selected.size} selected
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </span>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-y-auto max-h-72 divide-y divide-slate-50">
            {filtered.length > 0 ? (
              filtered.map((e) => {
                const checked = selected.has(e.id);
                return (
                  <label
                    key={e.id}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${checked ? "bg-secondary" : "hover:bg-slate-50"}`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(e.id)} className="accent-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bn-serif text-sm font-medium text-slate-800 truncate">{e.nameBn}</p>
                      <p className="text-xs text-slate-400 truncate font-bn-serif">
                        {e.designationBn || "—"}{e.officeBn ? ` · ${e.officeBn}` : ""}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">{e.id}</span>
                  </label>
                );
              })
            ) : (
              <p className="text-center text-sm text-slate-400 py-8">No employees match.</p>
            )}
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
          <button
            type="button"
            disabled={saving || selected.size === 0}
            onClick={handleSubmit}
            className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors"
          >
            {saving ? "Creating…" : `Place Request (${selected.size})`}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Issue (record signing date) modal ─────────────────────────────────────────

function IssueBatchModal({
  batch,
  onClose,
}: {
  batch: IdCardBatchRecord;
  onClose: () => void;
}) {
  const router = useRouter();
  const [signedDate, setSignedDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signedDate) {
      setError("Signing date is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/id-card-batches/${batch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedDate }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to issue");
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900">Record DG Signing &amp; Issue</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Batch #{batch.id} · {batch.cardCount} card{batch.cardCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="ml-3 shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <p className="text-xs text-slate-500">
            Enter the date the Director General signed the authorization file. This becomes the
            &ldquo;Issued on&rdquo; date on every card in this batch.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Signing Date <span className="text-red-500">*</span>
            </label>
            <input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} className={INPUT} autoFocus />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors">
              {saving ? "Issuing…" : "Issue Cards"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Expandable batch row ───────────────────────────────────────────────────────

function BatchRow({
  batch,
  onIssue,
}: {
  batch: IdCardBatchRecord;
  onIssue: (b: IdCardBatchRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<IdCardBatchDetail | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !detail) {
      setLoading(true);
      try {
        const res = await fetch(`/api/id-card-batches/${batch.id}`);
        if (res.ok) setDetail(await res.json());
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <>
      <tr className="hover:bg-slate-50/70 transition-colors">
        <td className="px-5 py-4 align-top font-mono text-xs text-slate-400">#{batch.id}</td>
        <td className="px-4 py-4 align-top text-slate-600">{batch.memoNo || "—"}</td>
        <td className="px-4 py-4 align-top">
          <p className="font-bn-serif text-sm text-slate-700">{batch.dgName.bn}</p>
        </td>
        <td className="px-4 py-4 align-top text-slate-600 whitespace-nowrap">{batch.requestedAt}</td>
        <td className="px-4 py-4 align-top text-slate-600 tabular-nums">{batch.cardCount}</td>
        <td className="px-4 py-4 align-top whitespace-nowrap">{batch.signedDate || "—"}</td>
        <td className="px-4 py-4 align-top">
          <BatchStatusPill status={batch.status} />
        </td>
        <td className="px-4 py-4 align-top">
          <div className="flex items-center gap-1.5">
            {batch.status === "pending" && (
              <button
                type="button"
                onClick={() => onIssue(batch)}
                className="px-3 py-1.5 rounded-lg bg-secondary text-primary text-xs font-medium hover:bg-secondary/70 transition-colors cursor-pointer whitespace-nowrap"
              >
                Issue
              </button>
            )}
            <Link
              href={`/hr/listing/id-cards/${batch.id}`}
              title="Authorization list (for the DG letter)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <FileText size={12} />
              List
            </Link>
            <button
              type="button"
              onClick={toggle}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cards
              <ChevronDown size={12} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} className="px-5 pb-4 bg-slate-50/40">
            {loading ? (
              <p className="text-sm text-slate-400 py-3">Loading…</p>
            ) : detail && detail.cards.length > 0 ? (
              <div className="border border-slate-200 rounded-lg bg-white overflow-hidden mt-1">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-50">
                    {detail.cards.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400 w-32">{c.employee.id}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-bn-serif text-sm text-slate-700">{c.employee.name.bn}</span>
                          <span className="font-bn-serif text-xs text-slate-400 ml-2">{c.employee.designation_bn}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">v{c.version}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 capitalize">{c.status}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Link
                            href={`/hr/listing/${c.employee.id}/card`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <Printer size={12} />
                            Card
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-3">No cards in this batch.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────

export default function IdCardManager({
  batches,
  employees,
  currentDg,
}: {
  batches: IdCardBatchRecord[];
  employees: EmployeeOption[];
  currentDg: CurrentDg;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [issueTarget, setIssueTarget] = useState<IdCardBatchRecord | null>(null);

  const canCreate = !!currentDg;

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      {createOpen && <CreateBatchModal employees={employees} onClose={() => setCreateOpen(false)} />}
      {issueTarget && <IssueBatchModal batch={issueTarget} onClose={() => setIssueTarget(null)} />}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">ID Card Authorization</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {batches.length} batch{batches.length !== 1 ? "es" : ""} · authorized by the Director General
            </p>
          </div>
          <button
            type="button"
            disabled={!canCreate}
            title={canCreate ? undefined : "Appoint a Director General first"}
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Plus size={15} />
            New Request
          </button>
        </div>

        {/* DG status banners */}
        {!currentDg && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
            <Stamp size={16} className="shrink-0" />
            <span>
              No Director General is appointed.{" "}
              <Link href="/hr/listing/director-general" className="font-semibold underline">
                Appoint one
              </Link>{" "}
              before requesting ID card authorization.
            </span>
          </div>
        )}
        {currentDg && !currentDg.hasSignature && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
            <Stamp size={16} className="shrink-0" />
            <span>
              The current DG ({currentDg.name.en}) has no signature on file — batches can be
              requested but not issued.{" "}
              <Link href="/hr/listing/director-general" className="font-semibold underline">
                Upload signature
              </Link>
              .
            </span>
          </div>
        )}
        {currentDg && currentDg.hasSignature && (
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
            <span>
              Signatory: <span className="font-medium text-slate-700">{currentDg.name.en}</span>
            </span>
          </div>
        )}

        {/* Batches table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Batch", "Memo", "Signatory", "Requested", "Cards", "Signed", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 first:px-5 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {batches.length > 0 ? (
                  batches.map((b) => <BatchRow key={b.id} batch={b} onIssue={setIssueTarget} />)
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center text-slate-400 text-sm py-16">
                      <CreditCard size={26} className="text-slate-300 mx-auto mb-2" />
                      No authorization requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
