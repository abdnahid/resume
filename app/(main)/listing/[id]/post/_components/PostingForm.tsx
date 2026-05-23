"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { OrgPostFlat, OrgRoot } from "@/lib/org";

type OfficeOption = {
  id: number;
  nameBn: string;
  nameEn: string;
  type: string;
  rootId: number | null;
};

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold shrink-0">{n}</span>
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</span>
    </div>
  );
}

export default function PostingForm({
  employeeId,
  orgPosts,
  wings,
  offices,
  defaultOfficeId,
}: {
  employeeId: string;
  orgPosts: OrgPostFlat[];
  wings: OrgRoot[];
  offices: OfficeOption[];
  defaultOfficeId: number;
  defaultGrade: string;
}) {
  const router = useRouter();

  const [officeId, setOfficeId]   = useState(String(defaultOfficeId));
  const [wingId, setWingId]       = useState<number | null>(null);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [orderNo, setOrderNo]     = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  const selectedOffice = useMemo(() => offices.find((o) => o.id === Number(officeId)) ?? null, [offices, officeId]);
  const isHead = selectedOffice?.type === "head";
  const activeRootId: number | null = isHead ? wingId : (selectedOffice?.rootId ?? null);

  const selectedPost = useMemo(() => orgPosts.find((p) => p.id === Number(selectedPostId)) ?? null, [orgPosts, selectedPostId]);

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

  function handleOfficeChange(val: string) { setOfficeId(val); setWingId(null); setSelectedPostId(""); }
  function handleWingChange(id: number)    { setWingId(id); setSelectedPostId(""); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/employees/${employeeId}/postings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgPostId:  selectedPost?.id ?? null,
          officeId:   Number(officeId),
          orderNo:    orderNo   || null,
          orderDate:  orderDate || null,
        }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? "Failed to save posting"); return; }
      router.push("/listing");
      router.refresh();
    } finally { setSaving(false); }
  }

  const INPUT = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-white";
  const stepNum = (n: number) => isHead ? n : n - 1;

  return (
    <form onSubmit={handleSubmit} className="space-y-7">

      {/* Step 1: Office */}
      <div>
        <StepLabel n={1} label="Select Office" />
        <select value={officeId} onChange={(e) => handleOfficeChange(e.target.value)} className={INPUT + " font-bn-serif"}>
          {offices.map((o) => <option key={o.id} value={o.id}>{o.nameBn}</option>)}
        </select>
      </div>

      {/* Step 2: Wing (head office only) */}
      {isHead && (
        <div>
          <StepLabel n={2} label="Select Wing" />
          <div className="flex flex-wrap gap-2">
            {wings.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => handleWingChange(w.id)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer font-bn-serif ${
                  wingId === w.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                {w.nameBn}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Designation */}
      <div>
        <StepLabel n={stepNum(3)} label="Select Designation" />
        {activeRootId == null && isHead && (
          <p className="text-sm text-slate-400 italic">Select a wing above to see available designations.</p>
        )}
        {activeRootId != null && !hasGroups && (
          <p className="text-sm text-slate-400 italic">No sanctioned posts found for this office.</p>
        )}
        {hasGroups && (
          <>
            <select
              size={12}
              value={selectedPostId}
              onChange={(e) => setSelectedPostId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 font-bn-serif"
            >
              <option value="" disabled>— choose a designation —</option>
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
            {selectedPost && (
              <div className="mt-2 flex items-center gap-3 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span className="font-bn-serif">{selectedPost.nameBn}</span>
                {selectedPost.grade && (
                  <span className="ml-auto text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                    Grade {selectedPost.grade}
                  </span>
                )}
                <button type="button" onClick={() => setSelectedPostId("")} className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer">✕</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Step 4: Appointment Letter */}
      <div className="space-y-4 pt-1 border-t border-border">
        <StepLabel n={stepNum(4)} label="Appointment Letter" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Memo No</label>
            <input type="text" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} className={INPUT} placeholder="Appointment letter memo no" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Order Date</label>
            <input type="text" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={INPUT} placeholder="DD-MM-YYYY" />
          </div>
        </div>
        <p className="text-xs text-slate-400">
          The employee will appear as <strong>Pending</strong> in the office admin&apos;s list. Office admin enters the joining date when the employee reports.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Saving…" : "Create Pending Posting"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
