"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";

const INPUT = "rounded-lg border border-border px-3 py-2 text-sm bg-background outline-none focus:border-slate-400 transition-colors";

export default function ApprovalsFilterBar({
  offices,
}: {
  offices: { id: number; nameBn: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const q        = sp.get("q")        ?? "";
  const officeId = sp.get("officeId") ?? "";
  const status   = sp.get("status")   ?? "";

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`/hr/approvals?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <div className="relative flex-1 min-w-[220px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={q}
          onChange={(e) => update("q", e.target.value)}
          placeholder="Search by employee ID or name…"
          className={`${INPUT} w-full pl-9`}
        />
      </div>

      <select
        value={officeId}
        onChange={(e) => update("officeId", e.target.value)}
        className={INPUT}
      >
        <option value="">All Offices</option>
        {offices.map((o) => (
          <option key={o.id} value={String(o.id)}>{o.nameBn}</option>
        ))}
      </select>

      <select
        value={status}
        onChange={(e) => update("status", e.target.value)}
        className={INPUT}
      >
        <option value="">All Statuses</option>
        <option value="submitted">Pending Review</option>
        <option value="approved">Approved</option>
        <option value="needs_revision">Needs Revision</option>
      </select>
    </div>
  );
}
