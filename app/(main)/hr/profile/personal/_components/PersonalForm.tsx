"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2 } from "lucide-react";
import SingleDatePopover from "../../../../_components/DateScape/SingleDatePopover";
import { toDate, fromDate } from "@/lib/dateHelpers";

const INPUT      = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-background transition-colors";
const INPUT_BN   = INPUT + " font-bn-serif";
const READONLY   = "w-full rounded-lg border border-border px-3 py-2 text-sm bg-muted text-muted-foreground cursor-not-allowed";
const SECTION    = "text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4 pb-2 border-b border-border";
const LABEL      = "block text-sm font-medium text-foreground mb-1.5";
const RADIO_ROW  = "flex items-center gap-1.5 text-sm cursor-pointer";

type Props = {
  employeeId: string;
  prevStep: string | null;
  nextStep: string | null;
  data: {
    nameEn: string; nameBn: string;
    fatherNameEn: string; fatherNameBn: string;
    motherNameEn: string; motherNameBn: string;
    dateOfBirth: string; gender: string; maritalStatus: string;
    bloodGroup: string; nid: string; passportNo: string;
    nationality: string; placeOfBirth: string;
    signatureLabel: string; photoLabel: string;
    email: string; mobileHome: string; mobileOffice: string; phone: string;
    emergencyName: string; emergencyRelation: string;
    emergencyPhone: string; emergencyMobile: string;
  };
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={LABEL}>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

function UploadPlaceholder({ label }: { label: string }) {
  return (
    <div className="border-2 border-dashed border-border rounded-lg px-4 py-5 text-center cursor-pointer hover:border-slate-400 hover:bg-muted/50 transition-colors">
      <Upload size={16} className="mx-auto mb-1.5 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Max 1 MB · JPG, PNG, PDF</p>
    </div>
  );
}

export default function PersonalForm({ employeeId, data, prevStep, nextStep }: Props) {
  const router = useRouter();

  const [nameEn,            setNameEn]            = useState(data.nameEn);
  const [nameBn,            setNameBn]            = useState(data.nameBn);
  const [fatherNameEn,      setFatherNameEn]      = useState(data.fatherNameEn);
  const [fatherNameBn,      setFatherNameBn]      = useState(data.fatherNameBn);
  const [motherNameEn,      setMotherNameEn]      = useState(data.motherNameEn);
  const [motherNameBn,      setMotherNameBn]      = useState(data.motherNameBn);
  const [dateOfBirth,       setDateOfBirth]       = useState(data.dateOfBirth);
  const [gender,            setGender]            = useState(data.gender);
  const [maritalStatus,     setMaritalStatus]     = useState(data.maritalStatus);
  const [bloodGroup,        setBloodGroup]        = useState(data.bloodGroup);
  const [nid,               setNid]               = useState(data.nid);
  const [passportNo,        setPassportNo]        = useState(data.passportNo);
  const [nationality,       setNationality]       = useState(data.nationality || "Bangladeshi");
  const [placeOfBirth,      setPlaceOfBirth]      = useState(data.placeOfBirth);
  const [email,             setEmail]             = useState(data.email);
  const [mobileHome,        setMobileHome]        = useState(data.mobileHome);
  const [mobileOffice,      setMobileOffice]      = useState(data.mobileOffice);
  const [phone,             setPhone]             = useState(data.phone);
  const [emergencyName,     setEmergencyName]     = useState(data.emergencyName);
  const [emergencyRelation, setEmergencyRelation] = useState(data.emergencyRelation);
  const [emergencyPhone,    setEmergencyPhone]    = useState(data.emergencyPhone);
  const [emergencyMobile,   setEmergencyMobile]   = useState(data.emergencyMobile);

  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch("/api/profile/personal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameEn, nameBn, fatherNameEn, fatherNameBn, motherNameEn, motherNameBn,
          dateOfBirth, gender, maritalStatus,
          bloodGroup: bloodGroup || null,
          nid: nid || null, passportNo: passportNo || null,
          nationality: nationality || null, placeOfBirth: placeOfBirth || null,
          email: email || null, mobileHome: mobileHome || null,
          mobileOffice: mobileOffice || null, phone: phone || null,
          emergencyName: emergencyName || null,
          emergencyRelation: emergencyRelation || null,
          emergencyPhone: emergencyPhone || null,
          emergencyMobile: emergencyMobile || null,
        }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? "Failed to save"); return; }
      setSaved(true);
      router.refresh();
      if (nextStep) router.push("/hr/profile?step=" + nextStep);
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">

      {/* ── Identity ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className={SECTION}>Personal Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Employee ID">
            <input value={employeeId} readOnly className={READONLY + " font-mono"} />
          </Field>
          <div />

          <Field label="Name (Bengali)" required>
            <input value={nameBn} onChange={(e) => setNameBn(e.target.value)} required className={INPUT_BN} placeholder="বাংলায় নাম" />
          </Field>
          <Field label="Name (English)" required>
            <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} required className={INPUT} placeholder="Full name in English" />
          </Field>

          <Field label="Mother's Name (Bengali)" required>
            <input value={motherNameBn} onChange={(e) => setMotherNameBn(e.target.value)} required className={INPUT_BN} placeholder="মায়ের নাম (বাংলায়)" />
          </Field>
          <Field label="Mother's Name (English)" required>
            <input value={motherNameEn} onChange={(e) => setMotherNameEn(e.target.value)} required className={INPUT} />
          </Field>

          <Field label="Father's Name (Bengali)" required>
            <input value={fatherNameBn} onChange={(e) => setFatherNameBn(e.target.value)} required className={INPUT_BN} placeholder="পিতার নাম (বাংলায়)" />
          </Field>
          <Field label="Father's Name (English)" required>
            <input value={fatherNameEn} onChange={(e) => setFatherNameEn(e.target.value)} required className={INPUT} />
          </Field>

          <Field label="NID Number" required>
            <input value={nid} onChange={(e) => setNid(e.target.value)} className={INPUT} placeholder="National ID number" />
          </Field>
          <Field label="Passport Number">
            <input value={passportNo} onChange={(e) => setPassportNo(e.target.value)} className={INPUT} />
          </Field>

          <Field label="Date of Birth" required>
            <SingleDatePopover
              defaultDate={toDate(dateOfBirth)}
              getSelectedDate={(date) => setDateOfBirth(date ? fromDate(date) : "")}
              placeholder="Pick date"
            />
          </Field>
          <Field label="Nationality" required>
            <input value={nationality} onChange={(e) => setNationality(e.target.value)} className={INPUT} />
          </Field>

          <Field label="Place of Birth (District)">
            <input value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} className={INPUT} placeholder="District name" />
          </Field>
          <Field label="Blood Group">
            <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className={INPUT}>
              <option value="">— Select —</option>
              <option value="A_pos">A+</option>
              <option value="A_neg">A−</option>
              <option value="B_pos">B+</option>
              <option value="B_neg">B−</option>
              <option value="AB_pos">AB+</option>
              <option value="AB_neg">AB−</option>
              <option value="O_pos">O+</option>
              <option value="O_neg">O−</option>
            </select>
          </Field>

          <div className="space-y-2">
            <label className={LABEL}>Gender <span className="text-red-500">*</span></label>
            <div className="flex gap-6">
              {[["male","Male"],["female","Female"],["other","Other"]].map(([v,l]) => (
                <label key={v} className={RADIO_ROW}>
                  <input type="radio" name="gender" value={v} checked={gender===v} onChange={() => setGender(v)} className="accent-slate-800" />
                  {l}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className={LABEL}>Marital Status <span className="text-red-500">*</span></label>
            <div className="flex gap-5 flex-wrap">
              {[["single","Single"],["married","Married"],["divorced","Divorced"],["widowed","Widowed"]].map(([v,l]) => (
                <label key={v} className={RADIO_ROW}>
                  <input type="radio" name="maritalStatus" value={v} checked={maritalStatus===v} onChange={() => setMaritalStatus(v)} className="accent-slate-800" />
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Photo & Signature ───────────────────────────────────────────── */}
      <section>
        <h2 className={SECTION}>Photo & Signature</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Profile Photo</label>
            <UploadPlaceholder label="Upload profile photo" />
          </div>
          <div>
            <label className={LABEL}>Signature</label>
            <UploadPlaceholder label="Upload signature image" />
          </div>
        </div>
      </section>

      {/* ── Contact ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className={SECTION}>Contact Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Mobile (Personal)" required>
            <input value={mobileHome} onChange={(e) => setMobileHome(e.target.value)} className={INPUT} placeholder="+880..." />
          </Field>
          <Field label="Mobile (Office)">
            <input value={mobileOffice} onChange={(e) => setMobileOffice(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Email" required>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Tel (Home)">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT} />
          </Field>
        </div>
      </section>

      {/* ── Emergency Contact ───────────────────────────────────────────── */}
      <section>
        <h2 className={SECTION}>Emergency Contact</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name" required>
            <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Relation" required>
            <input value={emergencyRelation} onChange={(e) => setEmergencyRelation(e.target.value)} className={INPUT} placeholder="e.g. Brother, Spouse" />
          </Field>
          <Field label="Mobile No" required>
            <input value={emergencyMobile} onChange={(e) => setEmergencyMobile(e.target.value)} className={INPUT} placeholder="+880..." />
          </Field>
          <Field label="Phone (if any)">
            <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className={INPUT} />
          </Field>
        </div>
      </section>

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center justify-between pb-8">
        {prevStep ? (
          <button type="button" onClick={() => router.push("/hr/profile?step=" + prevStep)} className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer">← Previous</button>
        ) : <div />}
        <div className="flex items-center gap-3">
          {saved && <span className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle2 size={16} /> Saved</span>}
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer">
            {saving ? "Saving…" : nextStep ? "Save & Next →" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
