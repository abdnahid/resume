"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OfficeOption = { id: number; nameBn: string; nameEn: string };

type EmployeeInput = {
  id: string;
  nameEn: string;
  nameBn: string;
  fatherNameEn: string;
  fatherNameBn: string;
  motherNameEn: string;
  motherNameBn: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  bloodGroup: string;
  nid: string;
  status: string;
  email: string;
  mobileHome: string;
  mobileOffice: string;
  officeId: number;
  dateOfJoining: string;
  initialDesignationBn: string;
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-white";
const INPUT_BN = INPUT + " font-bn-serif";
const READONLY = INPUT + " bg-slate-50 text-slate-500 cursor-not-allowed";

export default function EditEmployeeForm({
  employee,
  offices,
}: {
  employee: EmployeeInput;
  offices: OfficeOption[];
}) {
  const router = useRouter();

  // Personal
  const [nameEn, setNameEn]                 = useState(employee.nameEn);
  const [nameBn, setNameBn]                 = useState(employee.nameBn);
  const [fatherNameEn, setFatherNameEn]     = useState(employee.fatherNameEn);
  const [fatherNameBn, setFatherNameBn]     = useState(employee.fatherNameBn);
  const [motherNameEn, setMotherNameEn]     = useState(employee.motherNameEn);
  const [motherNameBn, setMotherNameBn]     = useState(employee.motherNameBn);
  const [dateOfBirth, setDateOfBirth]       = useState(employee.dateOfBirth);
  const [gender, setGender]                 = useState(employee.gender);
  const [maritalStatus, setMaritalStatus]   = useState(employee.maritalStatus);
  const [bloodGroup, setBloodGroup]         = useState(employee.bloodGroup);
  const [nid, setNid]                       = useState(employee.nid);
  const [status, setStatus]                 = useState(employee.status);

  // Contact
  const [email, setEmail]                   = useState(employee.email);
  const [mobileHome, setMobileHome]         = useState(employee.mobileHome);
  const [mobileOffice, setMobileOffice]     = useState(employee.mobileOffice);

  // Job
  const [officeId, setOfficeId]                         = useState(String(employee.officeId));
  const [dateOfJoining, setDateOfJoining]               = useState(employee.dateOfJoining);
  const [initialDesignationBn, setInitialDesignationBn] = useState(employee.initialDesignationBn);

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameEn: nameEn.trim(),
          nameBn: nameBn.trim(),
          fatherNameEn: fatherNameEn.trim(),
          fatherNameBn: fatherNameBn.trim(),
          motherNameEn: motherNameEn.trim(),
          motherNameBn: motherNameBn.trim(),
          dateOfBirth,
          gender,
          maritalStatus,
          bloodGroup: bloodGroup || null,
          nid: nid || null,
          status,
          email: email || null,
          mobileHome: mobileHome || null,
          mobileOffice: mobileOffice || null,
          officeId: Number(officeId),
          dateOfJoining: dateOfJoining || null,
          initialDesignationBn: initialDesignationBn || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to update employee");
        return;
      }
      router.push("/hr/listing");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Personal Information ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4 pb-2 border-b border-border">
          Personal Information
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Employee ID">
            <input value={employee.id} readOnly className={READONLY + " font-mono"} />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={INPUT}>
              <option value="active">Active</option>
              <option value="prl">PRL</option>
              <option value="retired">Retired</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>

          <Field label="Name (English)" required>
            <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} required className={INPUT} />
          </Field>
          <Field label="Name (Bengali)" required>
            <input value={nameBn} onChange={(e) => setNameBn(e.target.value)} required className={INPUT_BN} />
          </Field>

          <Field label="Father's Name (English)" required>
            <input value={fatherNameEn} onChange={(e) => setFatherNameEn(e.target.value)} required className={INPUT} />
          </Field>
          <Field label="Father's Name (Bengali)" required>
            <input value={fatherNameBn} onChange={(e) => setFatherNameBn(e.target.value)} required className={INPUT_BN} />
          </Field>

          <Field label="Mother's Name (English)" required>
            <input value={motherNameEn} onChange={(e) => setMotherNameEn(e.target.value)} required className={INPUT} />
          </Field>
          <Field label="Mother's Name (Bengali)" required>
            <input value={motherNameBn} onChange={(e) => setMotherNameBn(e.target.value)} required className={INPUT_BN} />
          </Field>

          <Field label="Date of Birth" required>
            <input value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} placeholder="DD-MM-YYYY" required className={INPUT} />
          </Field>
          <Field label="Gender" required>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={INPUT}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>

          <Field label="Marital Status" required>
            <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className={INPUT}>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
            </select>
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

          <Field label="NID">
            <input value={nid} onChange={(e) => setNid(e.target.value)} className={INPUT} />
          </Field>
          <div /> {/* spacer */}
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4 pb-2 border-b border-border">
          Contact
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
          </Field>
          <div /> {/* spacer */}
          <Field label="Mobile (Home)">
            <input value={mobileHome} onChange={(e) => setMobileHome(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Mobile (Office)">
            <input value={mobileOffice} onChange={(e) => setMobileOffice(e.target.value)} className={INPUT} />
          </Field>
        </div>
      </section>

      {/* ── Job Details ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4 pb-2 border-b border-border">
          Job Details
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Use the Release / Approve actions on the employee list to change the current posting.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Office" required>
              <select value={officeId} onChange={(e) => setOfficeId(e.target.value)} className={INPUT_BN}>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>{o.nameBn}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Date of Joining">
            <input value={dateOfJoining} onChange={(e) => setDateOfJoining(e.target.value)} placeholder="DD-MM-YYYY" className={INPUT} />
          </Field>
          <Field label="Initial Designation (Bengali)">
            <input value={initialDesignationBn} onChange={(e) => setInitialDesignationBn(e.target.value)} className={INPUT_BN} />
          </Field>
        </div>
      </section>

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-3 pt-2 pb-8">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Saving…" : "Save Changes"}
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
