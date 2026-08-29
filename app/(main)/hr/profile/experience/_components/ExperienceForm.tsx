"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import RepeatingSection from "../../_components/RepeatingSection";
import SingleDatePopover from "../../../../_components/DateScape/SingleDatePopover";
import { toDate, fromDate } from "@/lib/dateHelpers";
import StepNavButton from "@/components/StepNavButton";

const INPUT = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-background transition-colors";
const INPUT_BN = INPUT + " font-bn-serif";
const LABEL = "block text-sm font-medium text-foreground mb-1.5";

type Row = { designationBn: string; designationEn: string; grade: string; office: string; start: string; end: string; orderNo: string; orderDate: string };
const EMPTY: Row = { designationBn: "", designationEn: "", grade: "", office: "", start: "", end: "", orderNo: "", orderDate: "" };

export default function ExperienceForm({ initial, prevStep, nextStep }: { initial: Row[]; prevStep: string | null; nextStep: string | null }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const update = (i: number, p: Partial<Row>) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...p } : row));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/profile/experience", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) }).finally(() => setSaving(false));
    if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
    setSaved(true); router.refresh(); if (nextStep) router.push("/hr/profile?step=" + nextStep);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <RepeatingSection rows={rows} onAdd={() => setRows((r) => [...r, { ...EMPTY }])} onRemove={(i) => setRows((r) => r.filter((_, idx) => idx !== i))} addLabel="+ Add Previous Job" emptyMessage="No previous experience. Click below to add one.">
        {(row, i) => (
          <div className="grid grid-cols-2 gap-4">
            <div><label className={LABEL}>Designation (Bengali) <span className="text-red-500">*</span></label><input value={row.designationBn} onChange={(e) => update(i, { designationBn: e.target.value })} required className={INPUT_BN} /></div>
            <div><label className={LABEL}>Designation (English) <span className="text-red-500">*</span></label><input value={row.designationEn} onChange={(e) => update(i, { designationEn: e.target.value })} required className={INPUT} /></div>
            <div className="col-span-2"><label className={LABEL}>Organization / Office <span className="text-red-500">*</span></label><input value={row.office} onChange={(e) => update(i, { office: e.target.value })} required className={INPUT} placeholder="Organization name" /></div>
            <div><label className={LABEL}>Grade</label><input value={row.grade} onChange={(e) => update(i, { grade: e.target.value })} className={INPUT} placeholder="e.g. 9" /></div>
            <div><label className={LABEL}>Order No</label><input value={row.orderNo} onChange={(e) => update(i, { orderNo: e.target.value })} className={INPUT} /></div>
            <div><label className={LABEL}>Start Date <span className="text-red-500">*</span></label>
              <SingleDatePopover
                defaultDate={toDate(row.start)}
                getSelectedDate={(date) => update(i, { start: date ? fromDate(date) : "" })}
                placeholder="Pick date"
              />
            </div>
            <div><label className={LABEL}>End Date</label>
              <SingleDatePopover
                defaultDate={toDate(row.end)}
                getSelectedDate={(date) => update(i, { end: date ? fromDate(date) : "" })}
                placeholder="Pick date or leave blank if current"
              />
            </div>
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
