"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import RepeatingSection from "../../_components/RepeatingSection";

const INPUT = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-background transition-colors";
const LABEL = "block text-sm font-medium text-foreground mb-1.5";

type Row = { type: string; comment: string };
const EMPTY: Row = { type: "", comment: "" };

export default function CurricularsForm({ initial, prevStep, nextStep }: { initial: Row[]; prevStep: string | null; nextStep: string | null }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState("");
  const update = (i: number, p: Partial<Row>) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...p } : row));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/profile/curriculars", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) }).finally(() => setSaving(false));
    if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
    setSaved(true); router.refresh(); if (nextStep) router.push("/hr/profile?step=" + nextStep);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <RepeatingSection rows={rows} onAdd={() => setRows((r) => [...r, { ...EMPTY }])} onRemove={(i) => setRows((r) => r.filter((_, idx) => idx !== i))} addLabel="+ Add Curricular" emptyMessage="No curricular records yet.">
        {(row, i) => (
          <div className="space-y-3">
            <div><label className={LABEL}>Curricular Type <span className="text-red-500">*</span></label><input value={row.type} onChange={(e) => update(i, { type: e.target.value })} required className={INPUT} placeholder="e.g. Sports, Cultural, Volunteering" /></div>
            <div><label className={LABEL}>Comment <span className="text-red-500">*</span></label><textarea value={row.comment} onChange={(e) => update(i, { comment: e.target.value })} rows={3} className={INPUT} placeholder="Describe the activity" /></div>
          </div>
        )}
      </RepeatingSection>
      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex items-center justify-between pb-8">
        {prevStep ? <button type="button" onClick={() => router.push("/hr/profile?step=" + prevStep)} className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer">← Previous</button> : <div />}
        <div className="flex items-center gap-3">
          {saved && <span className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle2 size={16} /> Saved</span>}
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer">{saving ? "Saving…" : nextStep ? "Save & Next →" : "Save"}</button>
        </div>
      </div>
    </form>
  );
}
