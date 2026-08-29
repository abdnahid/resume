"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, ChevronDown, UserCheck } from "lucide-react";
import { FilterSearch, FilterSelect, FilterSelectOption } from "@/app/(main)/_components/filters";
import type { Employee, EmployeeStatus } from "@/lib/types";
import type { OrgPostFlat, OrgRoot } from "@/lib/org";
import PageContainer from "@/components/PageContainer";

// ─── Types ────────────────────────────────────────────────────────────────────

type OfficeOption = {
  id: number;
  nameBn: string;
  nameEn: string;
  type: string;
  rootId: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const IS_ADMIN = (r: string) => r === "superadmin" || r === "officeadmin";

const STATUS_CONFIG: Record<EmployeeStatus, { label: string; className: string }> = {
  active:   { label: "Active",   className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  retired:  { label: "Retired",  className: "bg-slate-100  text-slate-600   ring-1 ring-slate-200"   },
  prl:      { label: "PRL",      className: "bg-amber-50   text-amber-700   ring-1 ring-amber-200"   },
  inactive: { label: "Inactive", className: "bg-red-50     text-red-600     ring-1 ring-red-200"     },
};

const INPUT = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-white";

// ─── Inline icons ─────────────────────────────────────────────────────────────

const OfficeIcon  = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0"><rect x="2" y="4" width="12" height="10" rx="1.5" /><path d="M5 4V3a3 3 0 016 0v1" /></svg>;
const ApproveIcon = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0"><path d="M2.5 8.5l3.5 3.5 7.5-7.5" /></svg>;
const ReleaseIcon = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0"><path d="M10 8H3m0 0l3-3M3 8l3 3" /><path d="M13 4v8" /></svg>;
const RoleIcon    = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0"><circle cx="8" cy="5.5" r="3" /><path d="M2 14c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /></svg>;
const AssignIcon  = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0"><rect x="2" y="4" width="12" height="10" rx="1.5" /><path d="M8 8v4m-2-2h4" /></svg>;
const KeyIcon     = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0"><circle cx="6" cy="8" r="3.5" /><path d="M9 8h5M12 7v2" /></svg>;
const ResumeIcon  = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0"><path d="M4 2.5h5.5L13 6v7.5a1 1 0 01-1 1H4a1 1 0 01-1-1v-10a1 1 0 011-1z" /><path d="M9 2.5V6h4M5.5 8.5h5M5.5 10.5h5M5.5 12.5h3" /></svg>;
const EditIcon    = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0"><path d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z" /></svg>;
const CardIcon    = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0"><rect x="2" y="3.5" width="12" height="9" rx="1.5" /><path d="M2 6.5h12M4.5 9.5h3" /></svg>;

// ─── Shared overlay ───────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          {children}
          <button type="button" onClick={onClose} className="ml-3 shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Designation picker (shared between Release & Assign Post modals) ─────────

function DesignationPicker({
  orgPosts,
  wings,
  offices,
  officeId,
  onOfficeChange,
  wingId,
  onWingChange,
  selectedPostId,
  onPostChange,
}: {
  orgPosts: OrgPostFlat[];
  wings: OrgRoot[];
  offices: OfficeOption[];
  officeId: string;
  onOfficeChange: (v: string) => void;
  wingId: number | null;
  onWingChange: (id: number) => void;
  selectedPostId: string;
  onPostChange: (v: string) => void;
}) {
  const selectedOffice = offices.find((o) => o.id === Number(officeId)) ?? null;
  const isHead = selectedOffice?.type === "head";
  const activeRootId = isHead ? wingId : (selectedOffice?.rootId ?? null);

  const grouped = useMemo(() => {
    if (activeRootId == null) return {} as Record<string, OrgPostFlat[]>;
    const filtered = orgPosts.filter((p) => p.rootId === activeRootId);
    const map: Record<string, OrgPostFlat[]> = {};
    for (const post of filtered) {
      const label = post.pathBn.length > 1 ? post.pathBn.slice(1).join(" › ") : post.pathBn[0];
      if (!map[label]) map[label] = [];
      map[label].push(post);
    }
    return map;
  }, [orgPosts, activeRootId]);

  const hasGroups = Object.keys(grouped).length > 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">New Office</label>
        <select
          value={officeId}
          onChange={(e) => { onOfficeChange(e.target.value); onPostChange(""); }}
          className={INPUT + " font-bn-serif"}
        >
          <option value="">— Select office —</option>
          {offices.map((o) => (
            <option key={o.id} value={String(o.id)}>{o.nameBn}</option>
          ))}
        </select>
      </div>

      {isHead && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Wing</label>
          <div className="flex flex-wrap gap-2">
            {wings.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => { onWingChange(w.id); onPostChange(""); }}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer font-bn-serif ${
                  wingId === w.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-200 text-slate-700 hover:border-slate-400"
                }`}
              >
                {w.nameBn}
              </button>
            ))}
          </div>
        </div>
      )}

      {officeId && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">New Designation</label>
          {activeRootId == null && isHead && (
            <p className="text-sm text-slate-400 italic">Select a wing above to see designations.</p>
          )}
          {activeRootId != null && !hasGroups && (
            <p className="text-sm text-slate-400 italic">No sanctioned posts for this office.</p>
          )}
          {hasGroups && (() => {
            const selectedPost = orgPosts.find((p) => p.id === Number(selectedPostId)) ?? null;
            return selectedPost ? (
              <div className="flex items-center gap-3 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span className="font-bn-serif flex-1">{selectedPost.nameBn}</span>
                {selectedPost.grade && (
                  <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                    Grade {selectedPost.grade}
                  </span>
                )}
                <button type="button" onClick={() => onPostChange("")} className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer">✕</button>
              </div>
            ) : (
              <select
                size={8}
                value={selectedPostId}
                onChange={(e) => onPostChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 font-bn-serif"
              >
                <option value="">— choose designation —</option>
                {Object.entries(grouped).map(([groupLabel, posts]) => (
                  <optgroup key={groupLabel} label={groupLabel}>
                    {posts.map((post) => (
                      <option key={post.id} value={String(post.id)}>
                        {post.nameBn}{post.grade ? `  (গ্রেড ${post.grade})` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Release Modal ────────────────────────────────────────────────────────────

function ReleaseModal({
  employee,
  orgPosts,
  wings,
  offices,
  onClose,
}: {
  employee: Employee;
  orgPosts: OrgPostFlat[];
  wings: OrgRoot[];
  offices: OfficeOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [orderNo, setOrderNo]       = useState("");
  const [orderDate, setOrderDate]   = useState("");
  const [releasedAt, setReleasedAt] = useState("");
  const [newOfficeId, setNewOfficeId]     = useState("");
  const [wingId, setWingId]               = useState<number | null>(null);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!releasedAt) { setError("Release date is required"); return; }
    if (!newOfficeId) { setError("New office is required"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/employees/${employee.id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releasedAt,
          orderNo:      orderNo      || null,
          orderDate:    orderDate    || null,
          newOfficeId:  Number(newOfficeId),
          newOrgPostId: selectedPostId ? Number(selectedPostId) : null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Failed to release";
        try { msg = JSON.parse(text).error ?? msg; } catch {}
        setError(msg);
        return;
      }
      router.refresh();
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-slate-900">Release from Post</h3>
            <p className="text-sm text-slate-500 mt-0.5 font-bn-serif">{employee.name.bn}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Current: {employee.current_job.designation_bn || "—"} · {employee.current_job.office_bn}
            </p>
          </div>
          <button type="button" onClick={onClose} className="ml-3 shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Transfer Order Memo No</label>
              <input type="text" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} className={INPUT} placeholder="e.g. MPA/TR/2026/..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Order Date</label>
              <input type="text" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={INPUT} placeholder="DD-MM-YYYY" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Release Date <span className="text-red-500">*</span>
            </label>
            <input type="text" value={releasedAt} onChange={(e) => setReleasedAt(e.target.value)} className={INPUT} placeholder="DD-MM-YYYY" />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">New Posting</p>
            <DesignationPicker
              orgPosts={orgPosts}
              wings={wings}
              offices={offices}
              officeId={newOfficeId}
              onOfficeChange={(v) => { setNewOfficeId(v); setWingId(null); }}
              wingId={wingId}
              onWingChange={setWingId}
              selectedPostId={selectedPostId}
              onPostChange={setSelectedPostId}
            />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 cursor-pointer transition-colors">
              {saving ? "Saving…" : "Confirm Release"}
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

// ─── Approve Modal ────────────────────────────────────────────────────────────

function ApproveModal({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const router = useRouter();
  const [joinedAt, setJoinedAt] = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!joinedAt) { setError("Joining date is required"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/postings/${employee.currentPostingId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinedAt }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? "Failed"); return; }
      router.refresh();
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-slate-900">Approve Joining</h3>
            <p className="text-sm text-slate-500 mt-0.5 font-bn-serif">{employee.name.bn}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Pending: {employee.current_job.designation_bn || "—"} · {employee.current_job.office_bn}
            </p>
            {employee.releasedAt && (
              <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                <span>Released:</span>
                <span className="font-semibold">{employee.releasedAt}</span>
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="ml-3 shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Joining Date <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={joinedAt}
              onChange={(e) => setJoinedAt(e.target.value)}
              placeholder="DD-MM-YYYY"
              className={INPUT}
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors">
              {saving ? "Saving…" : "Approve & Activate"}
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

// ─── Assign Role Modal ────────────────────────────────────────────────────────

function AssignRoleModal({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const router = useRouter();
  const [role, setRole]   = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) { setError("Select a role"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/users/${employee.userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? "Failed"); return; }
      router.refresh();
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-slate-900">Assign System Role</h3>
            <p className="text-sm text-slate-500 mt-0.5 font-bn-serif">{employee.name.bn}</p>
          </div>
          <button type="button" onClick={onClose} className="ml-3 shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={INPUT}>
              <option value="">— Select role —</option>
              <option value="officeadmin">Office Admin</option>
              <option value="data_entry">Data Entry</option>
              <option value="employee">Employee</option>
            </select>
            <p className="text-xs text-slate-400 mt-1.5">
              Office Admin: manage employees &amp; approve postings.<br />
              Data Entry: read-only access to salary &amp; bank advice.<br />
              Employee: view own profile only.
            </p>
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 cursor-pointer transition-colors">
              {saving ? "Saving…" : "Assign Role"}
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

// ─── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [done, setDone]     = useState(false);

  async function handleReset() {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/users/${employee.userId}/reset-password`, {
        method: "POST",
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? "Failed"); return; }
      setDone(true);
      setTimeout(onClose, 1800);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-slate-900">Reset Password</h3>
            <p className="text-sm text-slate-500 mt-0.5 font-bn-serif">{employee.name.bn}</p>
          </div>
          <button type="button" onClick={onClose} className="ml-3 shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3 text-center">
            Password reset to <span className="font-mono font-semibold">12345678</span>
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-600 mb-5">
              This will reset <span className="font-bn-serif font-medium text-slate-800">{employee.name.bn}</span>&apos;s
              password to <span className="font-mono font-semibold text-slate-800">12345678</span>.
              The employee should change it after logging in.
            </p>
            {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleReset}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {saving ? "Resetting…" : "Reset Password"}
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Admin Action Dropdown ────────────────────────────────────────────────────

function AdminActionMenu({
  employee,
  role,
  onRelease,
  onApprove,
  onAssignRole,
  onResetPassword,
}: {
  employee: Employee;
  role: string;
  onRelease: (e: Employee) => void;
  onApprove: (e: Employee) => void;
  onAssignRole: (e: Employee) => void;
  onResetPassword: (e: Employee) => void;
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

  const close = () => setOpen(false);
  const isSuperAdmin = role === "superadmin";
  const { postingStatus, currentPostingId } = employee;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
      >
        Actions
        <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1">

          {/* View Resume → superadmin + officeadmin */}
          <Link
            href={`/hr/listing/${employee.id}/resume`}
            onClick={close}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-sky-700 hover:bg-sky-50 transition-colors"
          >
            <span className="text-sky-400"><ResumeIcon /></span>
            View Resume
          </Link>

          {/* ID Card → superadmin + officeadmin */}
          <Link
            href={`/hr/listing/${employee.id}/card`}
            onClick={close}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-teal-700 hover:bg-teal-50 transition-colors"
          >
            <span className="text-teal-400"><CardIcon /></span>
            ID Card
          </Link>

          {/* Edit → super admin only */}
          {isSuperAdmin && (
            <Link
              href={`/hr/listing/${employee.id}/edit`}
              onClick={close}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50 transition-colors"
            >
              <span className="text-indigo-400"><EditIcon /></span>
              Edit
            </Link>
          )}

          {/* No posting → super admin assigns initial post */}
          {isSuperAdmin && postingStatus === null && (
            <Link
              href={`/hr/listing/${employee.id}/post`}
              onClick={close}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-violet-700 hover:bg-violet-50 transition-colors"
            >
              <span className="text-violet-400"><AssignIcon /></span>
              Assign Post
            </Link>
          )}

          {/* Active or legacy (no posting) → release */}
          {postingStatus !== "pending" && (
            <button
              type="button"
              onClick={() => { onRelease(employee); close(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
            >
              <span className="text-amber-400"><ReleaseIcon /></span>
              Release from Post
            </button>
          )}

          {/* Pending posting → approve */}
          {postingStatus === "pending" && currentPostingId && (
            <button
              type="button"
              onClick={() => { onApprove(employee); close(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <span className="text-emerald-400"><ApproveIcon /></span>
              Approve Joining
            </button>
          )}

          {/* Assign role → super admin only */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => { onAssignRole(employee); close(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="text-slate-400"><RoleIcon /></span>
              Assign Role
            </button>
          )}

          {/* Reset password → super admin only */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => { onResetPassword(employee); close(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <span className="text-red-400"><KeyIcon /></span>
              Reset Password
            </button>
          )}
        </div>
      )}
    </div>
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

function PostingBadge({ postingStatus }: { postingStatus: "pending" | "active" | null }) {
  if (postingStatus === "pending") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200">
        Pending
      </span>
    );
  }
  if (postingStatus === null) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 ring-1 ring-red-200">
        No Posting
      </span>
    );
  }
  return null;
}

// ─── Main Table ───────────────────────────────────────────────────────────────

export default function EmployeeTable({
  employees,
  role,
  myOfficeId,
  orgPosts,
  wings,
  offices,
}: {
  employees: Employee[];
  role: string;
  myOfficeId: number | null;
  orgPosts: OrgPostFlat[];
  wings: OrgRoot[];
  offices: OfficeOption[];
}) {
  const [search, setSearch]   = useState("");
  const [office, setOffice]   = useState("");
  const [stat, setStat]       = useState("");

  const [releaseTarget,    setReleaseTarget]    = useState<Employee | null>(null);
  const [approveTarget,    setApproveTarget]    = useState<Employee | null>(null);
  const [assignRoleTarget, setAssignRoleTarget] = useState<Employee | null>(null);
  const [resetPwTarget,    setResetPwTarget]    = useState<Employee | null>(null);

  const isSuperAdmin = role === "superadmin";

  const OFFICES = [...new Set(employees.map((e) => e.current_job.office_bn).filter(Boolean))];
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
    <PageContainer>
      {/* Modals */}
      {releaseTarget && (
        <ReleaseModal
          employee={releaseTarget}
          orgPosts={orgPosts}
          wings={wings}
          offices={offices}
          onClose={() => setReleaseTarget(null)}
        />
      )}
      {approveTarget && (
        <ApproveModal
          employee={approveTarget}
          onClose={() => setApproveTarget(null)}
        />
      )}
      {assignRoleTarget && (
        <AssignRoleModal
          employee={assignRoleTarget}
          onClose={() => setAssignRoleTarget(null)}
        />
      )}
      {resetPwTarget && (
        <ResetPasswordModal
          employee={resetPwTarget}
          onClose={() => setResetPwTarget(null)}
        />
      )}

      {/* Width and centring come from PageContainer, so this is just a group. */}
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Employees</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {filtered.length} employee{filtered.length !== 1 ? "s" : ""} found
            </p>
          </div>
          {isSuperAdmin && (
            <Link
              href="/hr/listing/new"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              + Add Employee
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <FilterSearch value={search} onChange={setSearch} placeholder="Search by ID or name…" className="flex-1" />
          {isSuperAdmin && (
            <FilterSelect
              value={office}
              onChange={setOffice}
              options={OFFICE_OPTIONS}
              placeholder="সকল অফিস"
              icon={<OfficeIcon />}
              optionClassName="font-bn-serif"
              width="min-w-56"
            />
          )}
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
                      <div className="flex items-start gap-2 flex-wrap">
                        <p className="font-medium text-slate-800 leading-snug font-bn-serif text-base">{emp.name.bn}</p>
                        <PostingBadge postingStatus={emp.postingStatus} />
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5 font-bn-serif">
                        {emp.wing
                          ? `${emp.current_job.designation_bn} — ${emp.wing}`
                          : emp.current_job.designation_bn || "—"}
                      </p>
                      <p className="text-sm text-slate-400 mt-0.5 font-bn-serif">{emp.current_job.office_bn || "—"}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusPill status={emp.status} />
                    </td>
                    <td className="px-4 py-4 align-top">
                      {IS_ADMIN(role) ? (
                        <AdminActionMenu
                          employee={emp}
                          role={role}
                          onRelease={setReleaseTarget}
                          onApprove={setApproveTarget}
                          onAssignRole={setAssignRoleTarget}
                          onResetPassword={setResetPwTarget}
                        />
                      ) : (
                        <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 cursor-pointer">
                          Profile
                        </button>
                      )}
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
    </PageContainer>
  );
}
