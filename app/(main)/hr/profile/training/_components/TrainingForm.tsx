"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import RepeatingSection from "../../_components/RepeatingSection";
import SingleDatePopover from "../../../../_components/DateScape/SingleDatePopover";
import { toDate, fromDate } from "@/lib/dateHelpers";
import StepNavButton from "@/components/StepNavButton";

const INPUT = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-background transition-colors";
const LABEL = "block text-sm font-medium text-foreground mb-1.5";

type Row = { isLocal: boolean; title: string; institution: string; result: string; startDate: string; endDate: string; duration: string; country: string };
const EMPTY: Row = { isLocal: true, title: "", institution: "", result: "", startDate: "", endDate: "", duration: "", country: "" };

export default function TrainingForm({ initial, prevStep, nextStep }: { initial: Row[]; prevStep: string | null; nextStep: string | null }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState("");
  const update = (i: number, p: Partial<Row>) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...p } : row));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/profile/training", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) }).finally(() => setSaving(false));
    if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
    setSaved(true); router.refresh(); if (nextStep) router.push("/hr/profile?step=" + nextStep);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <RepeatingSection rows={rows} onAdd={() => setRows((r) => [...r, { ...EMPTY }])} onRemove={(i) => setRows((r) => r.filter((_, idx) => idx !== i))} addLabel="+ Add Training" emptyMessage="No training records yet.">
        {(row, i) => (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="radio" checked={row.isLocal} onChange={() => update(i, { isLocal: true, country: "" })} className="accent-slate-800" /> Local</label>
              <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="radio" checked={!row.isLocal} onChange={() => update(i, { isLocal: false })} className="accent-slate-800" /> Foreign</label>
            </div>
            {!row.isLocal && <div className="col-span-2"><label className={LABEL}>Country <span className="text-red-500">*</span></label><input value={row.country} onChange={(e) => update(i, { country: e.target.value })} required={!row.isLocal} className={INPUT} /></div>}
            <div className="col-span-2"><label className={LABEL}>Training Title <span className="text-red-500">*</span></label><input value={row.title} onChange={(e) => update(i, { title: e.target.value })} required className={INPUT} /></div>
            <div className="col-span-2"><label className={LABEL}>Institute Name <span className="text-red-500">*</span></label><input value={row.institution} onChange={(e) => update(i, { institution: e.target.value })} className={INPUT} /></div>
            <div><label className={LABEL}>Start Date <span className="text-red-500">*</span></label>
              <SingleDatePopover
                defaultDate={toDate(row.startDate)}
                getSelectedDate={(date) => update(i, { startDate: date ? fromDate(date) : "" })}
                placeholder="Pick date"
              />
            </div>
            <div><label className={LABEL}>End Date</label>
              <SingleDatePopover
                defaultDate={toDate(row.endDate)}
                getSelectedDate={(date) => update(i, { endDate: date ? fromDate(date) : "" })}
                placeholder="Pick date"
              />
            </div>
            <div><label className={LABEL}>Duration</label><input value={row.duration} onChange={(e) => update(i, { duration: e.target.value })} className={INPUT} placeholder="e.g. 0 Year 0 Month 2 Day" /></div>
            <div><label className={LABEL}>Result</label><input value={row.result} onChange={(e) => update(i, { result: e.target.value })} className={INPUT} placeholder="e.g. Participated" /></div>
          </div>
        )}
      </RepeatingSection>
      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex items-center justify-between pb-8">
        {prevStep ? <StepNavButton href={"/hr/profile?step=" + prevStep} className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer">← Previous</StepNavButton> : <div />}
        <div className="flex items-center gap-3">
          {saved && <span className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle2 size={16} /> Saved</span>}
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer">{saving ? "Saving…" : nextStep ? "Save & Next →" : "Save"}</button>
        </div>
      </div>
    </form>
  );
}
