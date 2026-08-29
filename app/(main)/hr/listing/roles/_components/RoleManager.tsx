"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Search, ShieldCheck } from "lucide-react";
import { ROLE_LABELS as ROLES } from "@/lib/roles";
import PageContainer from "@/components/PageContainer";

/**
 * Assign roles to employees.
 *
 * With 651 people on the roster, this is a search-and-filter screen rather than
 * a list: you come here knowing who you want to promote.
 */



const ROLE_STYLE: Record<string, string> = {
  superadmin: "bg-red-50 text-red-700 ring-1 ring-red-200",
  officeadmin: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  case_officer: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  data_entry: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  employee: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};

type Row = {
  id: string;
  nameEn: string;
  nameBn: string;
  designationBn: string | null;
  category: string;
  role: string;
  officeId: number;
  officeName: string;
};

export default function RoleManager({
  employees,
  offices,
  me,
}: {
  employees: Row[];
  offices: { id: number; nameEn: string }[];
  me: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of employees) c.set(e.role, (c.get(e.role) ?? 0) + 1);
    return c;
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees
      .filter((e) => {
        if (officeFilter && String(e.officeId) !== officeFilter) return false;
        if (roleFilter && e.role !== roleFilter) return false;
        if (!q) return true;
        return (
          e.id.includes(q) ||
          e.nameEn.toLowerCase().includes(q) ||
          e.nameBn.includes(search.trim())
        );
      })
      // Anyone already holding a role first — that is who you come here to check.
      .sort((a, b) => {
        const rank = (r: string) => (r === "employee" ? 1 : 0);
        return rank(a.role) - rank(b.role) || a.id.localeCompare(b.id);
      })
      .slice(0, 200);
  }, [employees, search, officeFilter, roleFilter]);

  async function assign(e: Row, role: string) {
    if (role === e.role) return;
    setSaving(e.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/roles/${e.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not assign the role");
      setNotice(`${e.nameEn} is now ${ROLES.find((r) => r.value === role)?.label ?? role}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(null);
    }
  }

  const INPUT =
    "rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none";

  return (
    <PageContainer>
        <div>
          <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck size={18} /> Roles
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Everyone imported from the HR export starts as an employee. Promote
            office admins, case officers and data entry staff here.
          </p>
        </div>

        {/* Who holds what */}
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRoleFilter(roleFilter === r.value ? "" : r.value)}
              title={r.hint}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                roleFilter === r.value
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {r.label}
              <span className="ml-1.5 tabular-nums opacity-70">{counts.get(r.value) ?? 0}</span>
            </button>
          ))}
        </div>

        {error && (
          <p className="flex gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by employee ID or name…"
              className={`${INPUT} w-full pl-9`}
            />
          </div>
          <select
            value={officeFilter}
            onChange={(e) => setOfficeFilter(e.target.value)}
            className={`${INPUT} w-64 cursor-pointer`}
          >
            <option value="">All offices</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>{o.nameEn}</option>
            ))}
          </select>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-50">
          {filtered.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-400">
              Nobody matches those filters.
            </p>
          ) : (
            filtered.map((e) => (
              <div key={e.id} className="flex items-center gap-4 px-4 py-3">
                <span className="font-mono text-xs text-slate-400 w-28 shrink-0">{e.id}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {e.nameEn}
                    {e.id === me && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-white">
                        you
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 font-bn-serif truncate">
                    {e.nameBn}
                    {e.designationBn ? ` · ${e.designationBn}` : ""}
                  </p>
                </div>
                <span className="text-xs text-slate-500 w-56 shrink-0 truncate">{e.officeName}</span>
                <span className="text-[10px] text-slate-400 w-20 shrink-0">{e.category}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium w-28 text-center shrink-0 ${ROLE_STYLE[e.role] ?? ""}`}
                >
                  {ROLES.find((r) => r.value === e.role)?.label ?? e.role}
                </span>
                <select
                  value={e.role}
                  disabled={saving === e.id}
                  onChange={(ev) => assign(e, ev.target.value)}
                  className={`${INPUT} w-40 shrink-0 cursor-pointer disabled:opacity-50`}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>

        {filtered.length === 200 && (
          <p className="text-xs text-slate-400">
            Showing the first 200. Narrow the search to see the rest.
          </p>
        )}
    </PageContainer>
  );
}
