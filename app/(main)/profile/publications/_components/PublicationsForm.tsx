"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import RepeatingSection from "../../_components/RepeatingSection";
import SingleDatePopover from "../../../_components/DateScape/SingleDatePopover";
import { toDate, fromDate } from "@/lib/dateHelpers";

const INPUT = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-background transition-colors";
const LABEL = "block text-sm font-medium text-foreground mb-1.5";

type Row = { type: string; title: string; publisher: string; writers: string; year: string; description: string };
const EMPTY: Row = { type: "", title: "", publisher: "", writers: "", year: "", description: "" };

export default function PublicationsForm({ initial, prevStep, nextStep }: { initial: Row[]; prevStep: string | null; nextStep: string | null }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState("");
  const update = (i: number, p: Partial<Row>) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...p } : row));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/profile/publications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) }).finally(() => setSaving(false));
    if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
    setSaved(true); if (nextStep) router.push("/profile?step=" + nextStep); else router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <RepeatingSection rows={rows} onAdd={() => setRows((r) => [...r, { ...EMPTY }])} onRemove={(i) => setRows((r) => r.filter((_, idx) => idx !== i))} addLabel="+ Add Publication" emptyMessage="No publication records yet.">
        {(row, i) => (
          <div className="grid grid-cols-2 gap-4">
            <div><label className={LABEL}>Type</label><input value={row.type} onChange={(e) => update(i, { type: e.target.value })} className={INPUT} placeholder="e.g. Book, Article, Paper" /></div>
            <div><label className={LABEL}>Subject <span className="text-red-500">*</span></label><input value={row.title} onChange={(e) => update(i, { title: e.target.value })} required className={INPUT} placeholder="Title / Subject" /></div>
            <div><label className={LABEL}>Publisher</label><input value={row.publisher} onChange={(e) => update(i, { publisher: e.target.value })} className={INPUT} /></div>
            <div><label className={LABEL}>Writer(s) Name</label><input value={row.writers} onChange={(e) => update(i, { writers: e.target.value })} className={INPUT} /></div>
            <div><label className={LABEL}>Publication Date</label>
              <SingleDatePopover
                defaultDate={toDate(row.year)}
                getSelectedDate={(date) => update(i, { year: date ? fromDate(date) : "" })}
                placeholder="Pick date"
              />
            </div>
            <div className="col-span-2"><label className={LABEL}>Description</label><textarea value={row.description} onChange={(e) => update(i, { description: e.target.value })} rows={2} className={INPUT} /></div>
          </div>
        )}
      </RepeatingSection>
      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex items-center justify-between pb-8">
        {prevStep ? <button type="button" onClick={() => router.push("/profile?step=" + prevStep)} className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer">← Previous</button> : <div />}
        <div className="flex items-center gap-3">
          {saved && <span className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle2 size={16} /> Saved</span>}
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer">{saving ? "Saving…" : nextStep ? "Save & Next →" : "Save"}</button>
        </div>
      </div>
    </form>
  );
}
