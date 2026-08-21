"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import RepeatingSection from "../../_components/RepeatingSection";
import SingleDatePopover from "../../../../_components/DateScape/SingleDatePopover";
import { toDate, fromDate } from "@/lib/dateHelpers";

const INPUT = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-background transition-colors";
const LABEL = "block text-sm font-medium text-foreground mb-1.5";
const TYPES = [{ value: "departmental", label: "Departmental (দাপ্তরিক)" }, { value: "inter_departmental", label: "Inter-Departmental (আন্তঃদাপ্তরিক)" }, { value: "international", label: "International (আন্তর্জাতিক)" }];
const SUBJECTS = ["Good Governance (শুদ্ধাচার)", "Public Administration (জনপ্রশাসন)", "Innovation (ইনোভেশন)", "Other (অন্যান্য)"];

type Row = { type: string; title: string; awardedBy: string; country: string; subject: string; reason: string; year: string };
const EMPTY: Row = { type: "departmental", title: "", awardedBy: "", country: "", subject: "", reason: "", year: "" };

export default function AwardsForm({ initial, prevStep, nextStep }: { initial: Row[]; prevStep: string | null; nextStep: string | null }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState("");
  const update = (i: number, p: Partial<Row>) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...p } : row));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/profile/awards", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: rows.map((r) => ({ ...r, title: r.title || r.subject || "Award" })) }) }).finally(() => setSaving(false));
    if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
    setSaved(true); router.refresh(); if (nextStep) router.push("/hr/profile?step=" + nextStep);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <RepeatingSection rows={rows} onAdd={() => setRows((r) => [...r, { ...EMPTY }])} onRemove={(i) => setRows((r) => r.filter((_, idx) => idx !== i))} addLabel="+ Add Award" emptyMessage="No award records yet.">
        {(row, i) => (
          <div className="space-y-4">
            <div>
              <label className={LABEL}>Type <span className="text-red-500">*</span></label>
              <div className="flex gap-4 flex-wrap">
                {TYPES.map((t) => <label key={t.value} className="flex items-center gap-2 cursor-pointer text-sm"><input type="radio" checked={row.type===t.value} onChange={() => update(i, { type: t.value })} className="accent-slate-800" />{t.label}</label>)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={LABEL}>Country</label><input value={row.country} onChange={(e) => update(i, { country: e.target.value })} className={INPUT} /></div>
              <div><label className={LABEL}>Institution</label><input value={row.awardedBy} onChange={(e) => update(i, { awardedBy: e.target.value })} className={INPUT} /></div>
              <div><label className={LABEL}>Date</label>
                <SingleDatePopover
                  defaultDate={toDate(row.year)}
                  getSelectedDate={(date) => update(i, { year: date ? fromDate(date) : "" })}
                  placeholder="Pick date"
                />
              </div>
            </div>
            <div>
              <label className={LABEL}>Subject</label>
              <div className="grid grid-cols-2 gap-2">
                {SUBJECTS.map((s) => <label key={s} className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={row.subject.includes(s)} onChange={(e) => update(i, { subject: e.target.checked ? [...row.subject.split(",").filter(Boolean), s].join(",") : row.subject.split(",").filter((x) => x !== s).join(",") })} className="accent-slate-800" />{s}</label>)}
              </div>
            </div>
            <div><label className={LABEL}>Reason <span className="text-red-500">*</span></label><textarea value={row.reason} onChange={(e) => update(i, { reason: e.target.value })} required rows={2} className={INPUT} /></div>
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
