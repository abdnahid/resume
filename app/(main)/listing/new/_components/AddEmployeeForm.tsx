"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type OrgPostOption = {
  id: number;
  nameBn: string;
  nameEn: string;
  grade: string;
  unitNameBn: string;
  unitParentBn: string | null;
};

type OfficeOption = { id: number; nameBn: string; nameEn: string };

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

export default function AddEmployeeForm({
  orgPosts,
  offices,
}: {
  orgPosts: OrgPostOption[];
  offices: OfficeOption[];
}) {
  const router = useRouter();

  // Personal
  const [employeeId, setEmployeeId] = useState("");
  const [nameEn, setNameEn]         = useState("");
  const [nameBn, setNameBn]         = useState("");
  const [fatherNameEn, setFatherNameEn] = useState("");
  const [fatherNameBn, setFatherNameBn] = useState("");
  const [motherNameEn, setMotherNameEn] = useState("");
  const [motherNameBn, setMotherNameBn] = useState("");
  const [dateOfBirth, setDateOfBirth]   = useState("");
  const [gender, setGender]             = useState("male");
  const [maritalStatus, setMaritalStatus] = useState("single");
  const [bloodGroup, setBloodGroup]     = useState("");
  const [nid, setNid]                   = useState("");
  const [status, setStatus]             = useState("active");
  const [role, setRole]                 = useState("employee");

  // Contact
  const [email, setEmail]               = useState("");
  const [mobileHome, setMobileHome]     = useState("");
  const [mobileOffice, setMobileOffice] = useState("");

  // Job
  const [officeId, setOfficeId]               = useState(String(offices[0]?.id ?? ""));
  const [dateOfJoining, setDateOfJoining]     = useState("");
  const [initialDesignationBn, setInitialDesignationBn] = useState("");

  // Initial posting
  const [postSearch, setPostSearch]       = useState("");
  const [selectedPost, setSelectedPost]   = useState<OrgPostOption | null>(null);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [postingGrade, setPostingGrade]   = useState("");
  const [joinedAt, setJoinedAt]           = useState("");
  const [postingOrderNo, setPostingOrderNo]   = useState("");
  const [postingOrderDate, setPostingOrderDate] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const filteredPosts = useMemo(() => {
    const q = postSearch.toLowerCase();
    if (!q) return orgPosts.slice(0, 30);
    return orgPosts
      .filter(
        (p) =>
          p.nameBn.includes(postSearch) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.unitNameBn.includes(postSearch),
      )
      .slice(0, 30);
  }, [postSearch, orgPosts]);

  function selectPost(p: OrgPostOption) {
    setSelectedPost(p);
    setPostSearch(p.nameBn);
    setShowDropdown(false);
    if (p.grade) setPostingGrade(p.grade);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: employeeId.trim(),
          nameEn: nameEn.trim(),
          nameBn: nameBn.trim(),
          fatherNameEn: fatherNameEn.trim(),
          fatherNameBn: fatherNameBn.trim(),
          motherNameEn: motherNameEn.trim(),
          motherNameBn: motherNameBn.trim(),
          dateOfBirth,
          gender,
          maritalStatus,
          officeId: Number(officeId),
          bloodGroup: bloodGroup || null,
          nid: nid || null,
          status,
          role,
          email: email || null,
          mobileHome: mobileHome || null,
          mobileOffice: mobileOffice || null,
          dateOfJoining: dateOfJoining || null,
          initialDesignationBn: initialDesignationBn || null,
          orgPostId: selectedPost?.id ?? null,
          postingGrade: postingGrade || null,
          postingOfficeId: officeId,
          joinedAt: joinedAt || dateOfJoining || null,
          postingOrderNo: postingOrderNo || null,
          postingOrderDate: postingOrderDate || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? "Failed to create employee");
        return;
      }
      router.push("/listing");
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
          <Field label="Employee ID" required>
            <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required className={INPUT} placeholder="e.g. 20240010001" />
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
          <Field label="System Role">
            <select value={role} onChange={(e) => setRole(e.target.value)} className={INPUT}>
              <option value="employee">Employee</option>
              <option value="data_entry">Data Entry</option>
              <option value="officeadmin">Office Admin</option>
              <option value="superadmin">Super Admin</option>
            </select>
          </Field>
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4 pb-2 border-b border-border">
          Contact
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="leave blank to auto-generate" className={INPUT} />
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

      {/* ── Initial Posting ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1 pb-2 border-b border-border">
          Initial Posting
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Optional. Set only "Joining Date" to create a posting without a specific designation yet.
        </p>
        <div className="space-y-4">
          {/* OrgPost search */}
          <div className="relative">
            <label className="block text-sm font-medium text-foreground mb-1.5">Designation (Sanctioned Post)</label>
            <input
              type="text"
              value={postSearch}
              onChange={(e) => { setPostSearch(e.target.value); setShowDropdown(true); setSelectedPost(null); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search by designation name…"
              autoComplete="off"
              className={INPUT_BN}
            />
            {showDropdown && filteredPosts.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-sm">
                {filteredPosts.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseDown={() => selectPost(p)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 cursor-pointer"
                    >
                      <p className="font-bn-serif">{p.nameBn}</p>
                      <p className="text-xs text-slate-400 font-bn-serif">
                        {p.unitParentBn ? `${p.unitParentBn} › ` : ""}{p.unitNameBn}
                        {p.grade ? ` · Grade ${p.grade}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Grade">
              <input value={postingGrade} onChange={(e) => setPostingGrade(e.target.value)} placeholder="e.g. 9" className={INPUT} />
            </Field>
            <Field label="Joining Date">
              <input value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} placeholder="DD-MM-YYYY (auto-fills from above)" className={INPUT} />
            </Field>
            <Field label="Order No">
              <input value={postingOrderNo} onChange={(e) => setPostingOrderNo(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Order Date">
              <input value={postingOrderDate} onChange={(e) => setPostingOrderDate(e.target.value)} placeholder="DD-MM-YYYY" className={INPUT} />
            </Field>
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-3 pt-2 pb-8">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Saving…" : "Create Employee"}
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
