"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import RepeatingSection from "../../_components/RepeatingSection";
import SingleDatePopover from "../../../_components/DateScape/SingleDatePopover";
import { toDate, fromDate } from "@/lib/dateHelpers";

const INPUT = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-background transition-colors";
const LABEL = "block text-sm font-medium text-foreground mb-1.5";
const TYPES = [{ value: "departmental", label: "Departmental (বিভাগীয়)" }, { value: "criminal", label: "Criminal (ফৌজদারী)" }, { value: "acc", label: "ACC (দুদক)" }];

type Row = { type: string; reason: string; description: string; startDate: string; endDate: string; comment: string };
const EMPTY: Row = { type: "departmental", reason: "", description: "", startDate: "", endDate: "", comment: "" };

export default function DisciplinaryForm({ initial, prevStep, nextStep }: { initial: Row[]; prevStep: string | null; nextStep: string | null }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState("");
  const update = (i: number, p: Partial<Row>) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...p } : row));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/profile/disciplinary", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) }).finally(() => setSaving(false));
    if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
    setSaved(true); if (nextStep) router.push("/profile?step=" + nextStep); else router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <RepeatingSection rows={rows} onAdd={() => setRows((r) => [...r, { ...EMPTY }])} onRemove={(i) => setRows((r) => r.filter((_, idx) => idx !== i))} addLabel="+ Add Record" emptyMessage="No disciplinary action records.">
        {(row, i) => (
          <div className="space-y-4">
            <div>
              <label className={LABEL}>Type <span className="text-red-500">*</span></label>
              <div className="flex gap-4 flex-wrap">
                {TYPES.map((t) => <label key={t.value} className="flex items-center gap-2 cursor-pointer text-sm"><input type="radio" checked={row.type===t.value} onChange={() => update(i, { type: t.value })} className="accent-slate-800" />{t.label}</label>)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={LABEL}>Reason <span className="text-red-500">*</span></label><textarea value={row.reason} onChange={(e) => update(i, { reason: e.target.value })} required rows={3} className={INPUT} /></div>
              <div><label className={LABEL}>Description <span className="text-red-500">*</span></label><textarea value={row.description} onChange={(e) => update(i, { description: e.target.value })} required rows={3} className={INPUT} /></div>
              <div><label className={LABEL}>Start Date</label>
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
              <div className="col-span-2"><label className={LABEL}>Comment</label><textarea value={row.comment} onChange={(e) => update(i, { comment: e.target.value })} rows={2} className={INPUT} /></div>
            </div>
            <div className="p-3 rounded-lg bg-muted border border-border">
              <p className="text-xs text-muted-foreground">You can also upload the action letter copy here once file upload is enabled.</p>
            </div>
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
