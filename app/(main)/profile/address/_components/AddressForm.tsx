"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { BD_DIVISIONS } from "@/lib/bdGeoData";
import { BD_POST_OFFICES } from "@/lib/bdPostOffices";

const INPUT   = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-background transition-colors";
const SECTION = "text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4 pb-2 border-b border-border";
const LABEL   = "block text-sm font-medium text-foreground mb-1.5";

const CORP_TYPES = [
  { value: "cityCorp",  label: "City Corporation" },
  { value: "pourosova", label: "Pourosova" },
  { value: "union",     label: "Union" },
];

type AddrData = {
  division: string; district: string; upazila: string;
  cityCorpType: string; cityCorpName: string; ward: string;
  houseNo: string; road: string; postOffice: string;
  postCode: string; thana: string;
};

function AddressBlock({
  data, onChange, required,
}: {
  data: AddrData;
  onChange: (patch: Partial<AddrData>) => void;
  required?: boolean;
}) {
  const [postSearch, setPostSearch] = useState("");
  const [postOpen, setPostOpen] = useState(false);
  const postRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (postRef.current && !postRef.current.contains(e.target as Node)) {
        setPostOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const divisionData = BD_DIVISIONS.find((d) => d.name === data.division);
  const districts = divisionData?.districts ?? [];
  const districtData = districts.find((d) => d.name === data.district);
  const upazilas = districtData?.upazilas ?? [];
  const postOffices = BD_POST_OFFICES[data.district] ?? [];
  const filteredPosts = postSearch
    ? postOffices.filter((p) => p.name.includes(postSearch))
    : postOffices;

  const corpLabel =
    data.cityCorpType === "cityCorp" ? "City Corporation" :
    data.cityCorpType === "pourosova" ? "Pourosova" :
    data.cityCorpType === "union" ? "Union" : "Corp / Pourosova / Union";

  return (
    <div className="space-y-4">
      {/* Division → District → Upazila */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={LABEL}>Division{required && <span className="text-red-500 ml-0.5">*</span>}</label>
          <select
            value={data.division}
            onChange={(e) => onChange({ division: e.target.value, district: "", upazila: "", postOffice: "", postCode: "" })}
            className={INPUT}
          >
            <option value="">— Select —</option>
            {BD_DIVISIONS.map((d) => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>District{required && <span className="text-red-500 ml-0.5">*</span>}</label>
          <select
            value={data.district}
            onChange={(e) => onChange({ district: e.target.value, upazila: "", postOffice: "", postCode: "" })}
            className={INPUT}
            disabled={!data.division}
          >
            <option value="">— Select —</option>
            {districts.map((d) => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>Upazila{required && <span className="text-red-500 ml-0.5">*</span>}</label>
          <select
            value={data.upazila}
            onChange={(e) => onChange({ upazila: e.target.value })}
            className={INPUT}
            disabled={!data.district}
          >
            <option value="">— Select —</option>
            {upazilas.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      {/* City Corp / Pourosova / Union */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={LABEL}>City Corp / Pourosova / Union</label>
          <select
            value={data.cityCorpType}
            onChange={(e) => onChange({ cityCorpType: e.target.value, cityCorpName: "" })}
            className={INPUT}
          >
            <option value="">— Select Type —</option>
            {CORP_TYPES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>{corpLabel} Name</label>
          <input
            value={data.cityCorpName}
            onChange={(e) => onChange({ cityCorpName: e.target.value })}
            className={`${INPUT} ${!data.cityCorpType ? "opacity-50 cursor-not-allowed" : ""}`}
            placeholder={data.cityCorpType ? "Enter name" : "Select type first"}
            disabled={!data.cityCorpType}
          />
        </div>
        <div>
          <label className={LABEL}>Ward</label>
          <input value={data.ward} onChange={(e) => onChange({ ward: e.target.value })} className={INPUT} placeholder="Ward no." />
        </div>
      </div>

      {/* House + Road */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>House / Holding No{required && <span className="text-red-500 ml-0.5">*</span>}</label>
          <input value={data.houseNo} onChange={(e) => onChange({ houseNo: e.target.value })} className={INPUT} placeholder="House/holding number" />
        </div>
        <div>
          <label className={LABEL}>Road / Block / Sector{required && <span className="text-red-500 ml-0.5">*</span>}</label>
          <input value={data.road} onChange={(e) => onChange({ road: e.target.value })} className={INPUT} placeholder="Road or sector name" />
        </div>
      </div>

      {/* Post Office searchable combobox + Post Code (auto-filled) */}
      <div className="grid grid-cols-2 gap-4">
        <div ref={postRef} className="relative">
          <label className={LABEL}>Post Office{required && <span className="text-red-500 ml-0.5">*</span>}</label>
          <input
            value={postOpen ? postSearch : data.postOffice}
            onChange={(e) => { setPostSearch(e.target.value); setPostOpen(true); }}
            onFocus={() => { setPostSearch(""); setPostOpen(true); }}
            className={`${INPUT} ${!data.district ? "opacity-50 cursor-not-allowed" : ""}`}
            placeholder={data.district ? "Search post office…" : "Select district first"}
            disabled={!data.district}
          />
          {postOpen && filteredPosts.length > 0 && (
            <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
              {filteredPosts.map((p) => (
                <li key={p.name}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-2"
                    onClick={() => {
                      onChange({ postOffice: p.name, postCode: p.code });
                      setPostOpen(false);
                      setPostSearch("");
                    }}
                  >
                    <span>{p.name}</span>
                    <span className="text-muted-foreground text-xs shrink-0">{p.code}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label className={LABEL}>Post Code{required && <span className="text-red-500 ml-0.5">*</span>}</label>
          <input
            value={data.postCode}
            readOnly
            className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-muted text-muted-foreground cursor-default"
            placeholder="Auto-filled from post office"
          />
        </div>
      </div>

      {/* Thana */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Thana{required && <span className="text-red-500 ml-0.5">*</span>}</label>
          <input value={data.thana} onChange={(e) => onChange({ thana: e.target.value })} className={INPUT} />
        </div>
      </div>
    </div>
  );
}

const EMPTY: AddrData = {
  division: "", district: "", upazila: "", cityCorpType: "",
  cityCorpName: "", ward: "", houseNo: "", road: "",
  postOffice: "", postCode: "", thana: "",
};

export default function AddressForm({
  present: initPresent,
  permanent: initPermanent,
  prevStep,
  nextStep,
}: {
  present: AddrData;
  permanent: AddrData;
  prevStep: string | null;
  nextStep: string | null;
}) {
  const router = useRouter();
  const [present,         setPresent]         = useState<AddrData>(initPresent ?? EMPTY);
  const [permanent,       setPermanent]       = useState<AddrData>(initPermanent ?? EMPTY);
  const [sameAsPermanent, setSameAsPermanent] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  function handleSameToggle(checked: boolean) {
    setSameAsPermanent(checked);
    if (checked) setPermanent(present);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch("/api/profile/address", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ present, permanent, sameAsPermanent }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? "Failed to save"); return; }
      setSaved(true);
      router.refresh();
      if (nextStep) router.push("/profile?step=" + nextStep);
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">

      <section>
        <h2 className={SECTION}>Present Address</h2>
        <AddressBlock
          data={present}
          onChange={(p) => setPresent((prev) => ({ ...prev, ...p }))}
          required
        />
      </section>

      <label className="flex items-center gap-2.5 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={sameAsPermanent}
          onChange={(e) => handleSameToggle(e.target.checked)}
          className="w-4 h-4 rounded accent-slate-800"
        />
        <span className="text-sm text-foreground">Permanent address same as present address</span>
      </label>

      {!sameAsPermanent && (
        <section>
          <h2 className={SECTION}>Permanent Address</h2>
          <AddressBlock
            data={permanent}
            onChange={(p) => setPermanent((prev) => ({ ...prev, ...p }))}
          />
        </section>
      )}

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center justify-between pb-8">
        {prevStep ? (
          <button type="button" onClick={() => router.push("/profile?step=" + prevStep)} className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer">← Previous</button>
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
