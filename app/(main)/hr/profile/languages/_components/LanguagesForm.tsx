"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import RepeatingSection from "../../_components/RepeatingSection";
import StepNavButton from "@/components/StepNavButton";

const INPUT = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-background transition-colors";
const LABEL = "block text-sm font-medium text-foreground mb-1.5";
const PROFICIENCY = [{ value: "good", label: "Good (ভালো)" }, { value: "better", label: "Better (উত্তম)" }, { value: "best", label: "Excellent (অতি উত্তম)" }];

type Row = { name: string; proficiency: string; comment: string };
const EMPTY: Row = { name: "", proficiency: "", comment: "" };

export default function LanguagesForm({ initial, prevStep, nextStep }: { initial: Row[]; prevStep: string | null; nextStep: string | null }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [{ name: "Bengali", proficiency: "best", comment: "" }, { name: "English", proficiency: "good", comment: "" }]);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState("");
  const update = (i: number, p: Partial<Row>) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...p } : row));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/profile/languages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) }).finally(() => setSaving(false));
    if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
    setSaved(true); router.refresh(); if (nextStep) router.push("/hr/profile?step=" + nextStep);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <RepeatingSection rows={rows} onAdd={() => setRows((r) => [...r, { ...EMPTY }])} onRemove={(i) => setRows((r) => r.filter((_, idx) => idx !== i))} addLabel="+ Add Language" emptyMessage="No language records.">
        {(row, i) => (
          <div className="grid grid-cols-3 gap-4 items-start">
            <div><label className={LABEL}>Language Name <span className="text-red-500">*</span></label><input value={row.name} onChange={(e) => update(i, { name: e.target.value })} required className={INPUT} placeholder="e.g. English" /></div>
            <div>
              <label className={LABEL}>Proficiency</label>
              <div className="space-y-1.5 mt-1">
                {PROFICIENCY.map((p) => (
                  <label key={p.value} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" checked={row.proficiency === p.value} onChange={() => update(i, { proficiency: p.value })} className="accent-slate-800" />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            <div><label className={LABEL}>Comment</label><input value={row.comment} onChange={(e) => update(i, { comment: e.target.value })} className={INPUT} placeholder="Optional note" /></div>
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
