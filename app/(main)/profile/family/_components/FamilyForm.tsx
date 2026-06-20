"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import RepeatingSection from "../../_components/RepeatingSection";
import SingleDatePopover from "../../../_components/DateScape/SingleDatePopover";
import { toDate, fromDate } from "@/lib/dateHelpers";

const INPUT = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-background transition-colors";
const INPUT_BN = INPUT + " font-bn-serif";
const LABEL = "block text-sm font-medium text-foreground mb-1.5";
const SECTION = "text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4 pb-2 border-b border-border";

type SpouseData = { nid: string; mobile: string; nameBn: string; nameEn: string; motherNameBn: string; motherNameEn: string; fatherNameBn: string; fatherNameEn: string; dateOfBirth: string; occupation: string; bloodGroup: string; nationality: string; passportNo: string; passportReceivePlace: string; passportReceiveDate: string; passportIssueDate: string; passportExpiryDate: string };
type ChildData = { nameBn: string; nameEn: string; dateOfBirth: string; bloodGroup: string; brn: string; nid: string; gender: string; isSpecial: boolean };

const EMPTY_CHILD: ChildData = { nameBn: "", nameEn: "", dateOfBirth: "", bloodGroup: "", brn: "", nid: "", gender: "", isSpecial: false };
const BLOOD_OPTIONS = ["A_pos","A_neg","B_pos","B_neg","AB_pos","AB_neg","O_pos","O_neg"];
const BLOOD_LABELS: Record<string,string> = { A_pos:"A+", A_neg:"A−", B_pos:"B+", B_neg:"B−", AB_pos:"AB+", AB_neg:"AB−", O_pos:"O+", O_neg:"O−" };

export default function FamilyForm({ maritalStatus, spouse: initSpouse, children: initChildren, prevStep, nextStep }: {
  maritalStatus: string; spouse: SpouseData | null; children: ChildData[];
  prevStep: string | null; nextStep: string | null;
}) {
  const router = useRouter();
  const isMarried = maritalStatus === "married";
  const [spouse, setSpouse] = useState<SpouseData>(initSpouse ?? { nid:"",mobile:"",nameBn:"",nameEn:"",motherNameBn:"",motherNameEn:"",fatherNameBn:"",fatherNameEn:"",dateOfBirth:"",occupation:"",bloodGroup:"",nationality:"",passportNo:"",passportReceivePlace:"",passportReceiveDate:"",passportIssueDate:"",passportExpiryDate:"" });
  const [children, setChildren] = useState<ChildData[]>(initChildren);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState("");
  const sf = (k: keyof SpouseData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSpouse((s) => ({ ...s, [k]: e.target.value }));
  const uc = (i: number, p: Partial<ChildData>) => setChildren((c) => c.map((ch, idx) => idx === i ? { ...ch, ...p } : ch));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/profile/family", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spouse: isMarried ? spouse : null, children }) }).finally(() => setSaving(false));
    if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
    setSaved(true); if (nextStep) router.push("/profile?step=" + nextStep); else router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {isMarried && (
        <section>
          <h2 className={SECTION}>Spouse Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={LABEL}>NID <span className="text-red-500">*</span></label><input value={spouse.nid} onChange={sf("nid")} className={INPUT} /></div>
            <div><label className={LABEL}>Mobile <span className="text-red-500">*</span></label><input value={spouse.mobile} onChange={sf("mobile")} className={INPUT} placeholder="+880..." /></div>
            <div><label className={LABEL}>Name (Bengali) <span className="text-red-500">*</span></label><input value={spouse.nameBn} onChange={sf("nameBn")} className={INPUT_BN} /></div>
            <div><label className={LABEL}>Name (English) <span className="text-red-500">*</span></label><input value={spouse.nameEn} onChange={sf("nameEn")} className={INPUT} /></div>
            <div><label className={LABEL}>Mother's Name (BN)</label><input value={spouse.motherNameBn} onChange={sf("motherNameBn")} className={INPUT_BN} /></div>
            <div><label className={LABEL}>Mother's Name (EN)</label><input value={spouse.motherNameEn} onChange={sf("motherNameEn")} className={INPUT} /></div>
            <div><label className={LABEL}>Father's Name (BN)</label><input value={spouse.fatherNameBn} onChange={sf("fatherNameBn")} className={INPUT_BN} /></div>
            <div><label className={LABEL}>Father's Name (EN)</label><input value={spouse.fatherNameEn} onChange={sf("fatherNameEn")} className={INPUT} /></div>
            <div><label className={LABEL}>Date of Birth</label>
              <SingleDatePopover
                defaultDate={toDate(spouse.dateOfBirth)}
                getSelectedDate={(date) => setSpouse((s) => ({ ...s, dateOfBirth: date ? fromDate(date) : "" }))}
                placeholder="Pick date"
              />
            </div>
            <div><label className={LABEL}>Occupation <span className="text-red-500">*</span></label><input value={spouse.occupation} onChange={sf("occupation")} className={INPUT} /></div>
            <div><label className={LABEL}>Blood Group</label><select value={spouse.bloodGroup} onChange={sf("bloodGroup")} className={INPUT}><option value="">— Select —</option>{BLOOD_OPTIONS.map((b) => <option key={b} value={b}>{BLOOD_LABELS[b]}</option>)}</select></div>
            <div><label className={LABEL}>Nationality</label><input value={spouse.nationality} onChange={sf("nationality")} className={INPUT} /></div>
            <div><label className={LABEL}>Passport No</label><input value={spouse.passportNo} onChange={sf("passportNo")} className={INPUT} /></div>
            <div><label className={LABEL}>Passport Receive Place</label><input value={spouse.passportReceivePlace} onChange={sf("passportReceivePlace")} className={INPUT} /></div>
            <div><label className={LABEL}>Passport Receive Date</label>
              <SingleDatePopover
                defaultDate={toDate(spouse.passportReceiveDate)}
                getSelectedDate={(date) => setSpouse((s) => ({ ...s, passportReceiveDate: date ? fromDate(date) : "" }))}
                placeholder="Pick date"
              />
            </div>
            <div><label className={LABEL}>Passport Issue Date</label>
              <SingleDatePopover
                defaultDate={toDate(spouse.passportIssueDate)}
                getSelectedDate={(date) => setSpouse((s) => ({ ...s, passportIssueDate: date ? fromDate(date) : "" }))}
                placeholder="Pick date"
              />
            </div>
            <div><label className={LABEL}>Passport Expiry Date</label>
              <SingleDatePopover
                defaultDate={toDate(spouse.passportExpiryDate)}
                getSelectedDate={(date) => setSpouse((s) => ({ ...s, passportExpiryDate: date ? fromDate(date) : "" }))}
                placeholder="Pick date"
              />
            </div>
          </div>
        </section>
      )}
      {!isMarried && <p className="text-sm text-muted-foreground italic">Spouse section is available for married employees. Update your marital status in <a href="/profile/personal" className="underline">Personal Info</a>.</p>}

      <section>
        <h2 className={SECTION}>Children Details</h2>
        <RepeatingSection rows={children} onAdd={() => setChildren((c) => [...c, { ...EMPTY_CHILD }])} onRemove={(i) => setChildren((c) => c.filter((_, idx) => idx !== i))} addLabel="+ Add Child" emptyMessage="No children records yet.">
          {(child, i) => (
            <div className="grid grid-cols-2 gap-4">
              <div><label className={LABEL}>Name (Bengali) <span className="text-red-500">*</span></label><input value={child.nameBn} onChange={(e) => uc(i, { nameBn: e.target.value })} required className={INPUT_BN} /></div>
              <div><label className={LABEL}>Name (English) <span className="text-red-500">*</span></label><input value={child.nameEn} onChange={(e) => uc(i, { nameEn: e.target.value })} required className={INPUT} /></div>
              <div><label className={LABEL}>Date of Birth <span className="text-red-500">*</span></label>
                <SingleDatePopover
                  defaultDate={toDate(child.dateOfBirth)}
                  getSelectedDate={(date) => uc(i, { dateOfBirth: date ? fromDate(date) : "" })}
                  placeholder="Pick date"
                />
              </div>
              <div><label className={LABEL}>Blood Group</label><select value={child.bloodGroup} onChange={(e) => uc(i, { bloodGroup: e.target.value })} className={INPUT}><option value="">— Select —</option>{BLOOD_OPTIONS.map((b) => <option key={b} value={b}>{BLOOD_LABELS[b]}</option>)}</select></div>
              <div><label className={LABEL}>BRN</label><input value={child.brn} onChange={(e) => uc(i, { brn: e.target.value })} className={INPUT} placeholder="Birth registration number" /></div>
              <div><label className={LABEL}>NID</label><input value={child.nid} onChange={(e) => uc(i, { nid: e.target.value })} className={INPUT} /></div>
              <div>
                <label className={LABEL}>Gender</label>
                <div className="flex gap-4">
                  {[["male","Male"],["female","Female"],["other","Other"]].map(([v,l]) => (
                    <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" checked={child.gender===v} onChange={() => uc(i, { gender: v })} className="accent-slate-800" />{l}</label>
                  ))}
                </div>
              </div>
              <div>
                <label className={LABEL}>Special Child?</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" checked={child.isSpecial===true} onChange={() => uc(i, { isSpecial: true })} className="accent-slate-800" />Yes</label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" checked={child.isSpecial===false} onChange={() => uc(i, { isSpecial: false })} className="accent-slate-800" />No</label>
                </div>
              </div>
            </div>
          )}
        </RepeatingSection>
      </section>

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
