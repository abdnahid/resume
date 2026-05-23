"use client";

import { UserCheck, ChevronDown, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilterSearch, FilterSelect, FilterSelectOption } from "@/app/(main)/_components/filters";
import type { Employee, EmployeeStatus } from "@/lib/types";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EmployeeStatus, { label: string; className: string }> = {
  active:   { label: "Active",   className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  retired:  { label: "Retired",  className: "bg-slate-100  text-slate-600   ring-1 ring-slate-200"   },
  prl:      { label: "PRL",      className: "bg-amber-50   text-amber-700   ring-1 ring-amber-200"   },
  inactive: { label: "Inactive", className: "bg-red-50     text-red-600     ring-1 ring-red-200"     },
};

// ─── Inline icons ─────────────────────────────────────────────────────────────

const OfficeIcon  = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0"><rect x="2" y="4" width="12" height="10" rx="1.5" /><path d="M5 4V3a3 3 0 016 0v1" /></svg>;
const ProfileIcon = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0"><circle cx="8" cy="5.5" r="3" /><path d="M2 14c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /></svg>;
const ResumeIcon  = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0"><rect x="3" y="2" width="10" height="12" rx="1.5" /><line x1="6" y1="6" x2="10" y2="6" /><line x1="6" y1="8.5" x2="10" y2="8.5" /><line x1="6" y1="11" x2="8.5" y2="11" /></svg>;
const ReleaseIcon = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0"><path d="M10 8H3m0 0l3-3M3 8l3 3" /><path d="M13 4v8" /></svg>;

// ─── Release from Post modal ──────────────────────────────────────────────────

function ReleaseModal({
  employeeName,
  postingId,
  onClose,
}: {
  employeeName: string;
  postingId: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [relievedAt, setRelievedAt] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleRelease() {
    if (!relievedAt) { setError("Relieved date is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/postings/${postingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relievedAt, remarks: remarks || null }),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? "Failed to release");
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">Release from Post</h3>
            <p className="text-sm text-slate-500 mt-0.5 font-bn-serif">{employeeName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          This will end the current posting. The employee will have no active posting until reassigned.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Relieved Date <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={relievedAt}
              onChange={(e) => setRelievedAt(e.target.value)}
              placeholder="DD-MM-YYYY"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={handleRelease}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : "Confirm Release"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin action dropdown ────────────────────────────────────────────────────

function AdminActionMenu({
  employee,
  onRelease,
}: {
  employee: Employee;
  onRelease: (emp: Employee) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all duration-150 cursor-pointer"
      >
        Actions
        <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-100 py-1">
          <Link
            href={`/listing/${employee.id}/post`}
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="text-slate-400"><OfficeIcon /></span>
            New Posting
          </Link>

          {employee.currentPostingId && (
            <button
              type="button"
              onClick={() => { onRelease(employee); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
            >
              <span className="text-amber-400"><ReleaseIcon /></span>
              Release from Post
            </button>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span className="text-slate-400"><ProfileIcon /></span>
            Profile
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span className="text-slate-400"><ResumeIcon /></span>
            Resume
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileButton() {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all duration-150 cursor-pointer"
    >
      <span className="text-slate-400"><ProfileIcon /></span>
      Profile
    </button>
  );
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: EmployeeStatus }) {
  const { label, className } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// ─── Main Table ───────────────────────────────────────────────────────────────

const IS_ADMIN = (role: string) => role === "superadmin" || role === "officeadmin";

export default function EmployeeTable({ employees, role }: { employees: Employee[]; role: string }) {
  const [search, setSearch] = useState("");
  const [office, setOffice] = useState("");
  const [stat, setStat]     = useState("");
  const [releaseTarget, setReleaseTarget] = useState<Employee | null>(null);

  const OFFICES = [...new Set(employees.map((e) => e.current_job.office_bn))];

  const OFFICE_OPTIONS: FilterSelectOption[] = OFFICES.map((o) => ({
    label: o, value: o, className: "font-bn-serif",
  }));

  const STATUS_OPTIONS: FilterSelectOption[] = (Object.keys(STATUS_CONFIG) as EmployeeStatus[]).map(
    (key) => ({ label: STATUS_CONFIG[key].label, value: key }),
  );

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.id.includes(q) || e.name.bn.includes(q) || e.name.en.toLowerCase().includes(q);
    const matchOffice = !office || e.current_job.office_bn === office;
    const matchStat   = !stat   || e.status === stat;
    return matchSearch && matchOffice && matchStat;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      {releaseTarget && releaseTarget.currentPostingId && (
        <ReleaseModal
          employeeName={releaseTarget.name.bn}
          postingId={releaseTarget.currentPostingId}
          onClose={() => setReleaseTarget(null)}
        />
      )}

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Employees</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {filtered.length} employee{filtered.length !== 1 ? "s" : ""} found
            </p>
          </div>
          {IS_ADMIN(role) && (
            <Link
              href="/listing/new"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              + Add Employee
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <FilterSearch
            value={search}
            onChange={setSearch}
            placeholder="Search by ID or name…"
            className="flex-1"
          />
          <FilterSelect
            value={office}
            onChange={setOffice}
            options={OFFICE_OPTIONS}
            placeholder="সকল অফিস"
            icon={<OfficeIcon />}
            optionClassName="font-bn-serif"
            width="min-w-56"
          />
          <FilterSelect
            value={stat}
            onChange={setStat}
            options={STATUS_OPTIONS}
            placeholder="All Status"
            icon={<UserCheck size={15} />}
            width="min-w-36"
          />
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <colgroup>
              <col className="w-36" />
              <col />
              <col className="w-28" />
              <col className="w-32" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">ID</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Employee</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length > 0 ? (
                filtered.map((emp) => (
                  <tr key={emp.id} className="group hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 align-top">
                      <span className="font-mono text-xs text-slate-400 tracking-tight">{emp.id}</span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="font-medium text-slate-800 leading-snug font-bn-serif text-base">{emp.name.bn}</p>
                      <p className="text-sm text-slate-500 mt-0.5 font-bn-serif">
                        {emp.wing
                          ? `${emp.current_job.designation_bn} — ${emp.wing}`
                          : emp.current_job.designation_bn}
                      </p>
                      <p className="text-sm text-slate-400 mt-0.5 font-bn-serif">{emp.current_job.office_bn}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusPill status={emp.status} />
                    </td>
                    <td className="px-4 py-4 align-top">
                      {IS_ADMIN(role)
                        ? <AdminActionMenu employee={emp} onRelease={setReleaseTarget} />
                        : <ProfileButton />
                      }
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center text-slate-400 text-sm py-16">
                    No employees match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
