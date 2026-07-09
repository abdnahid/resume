"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import RepeatingSection from "../../_components/RepeatingSection";

const INPUT = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-background transition-colors";
const LABEL = "block text-sm font-medium text-foreground mb-1.5";

// ── Degree tiers ──────────────────────────────────────────────────────────────
const TIERS = [
  {
    tier: "Post-Graduate / Research",
    degrees: [
      { id: "phd",     label: "Ph.D. / Doctorate",                              bnLabel: "ডক্টরেট ডিগ্রী",      subjects: ["chemistry","applied_chemistry","biochemistry","agricultural_chemistry","microbiology","food_bacteriology","botany","zoology","physics","applied_physics_electronics","mathematics","applied_mathematics","statistics","soil_science","civil_engineering","mechanical_engineering","eee","cse","chemical_engineering","textile_engineering","leather_technology","ceramic_engineering","mme"] },
      { id: "masters", label: "Master's Degree (M.Sc. / M.A. / M.B.A. / M.Com. / M.S.S.)", bnLabel: "স্নাতকোত্তর ডিগ্রী", subjects: ["general_admin","coordination","chemistry","applied_chemistry","biochemistry","agricultural_chemistry","microbiology","food_bacteriology","botany","zoology","physics","applied_physics_electronics","mathematics","applied_mathematics","statistics","soil_science","accounting","finance","management","marketing","commerce","economics","journalism","bengali","english","political_science","public_administration","history_islamic_history","law"] },
      { id: "kamil",   label: "Kamil",                                           bnLabel: "কামিল",              subjects: ["madrasa_general","quran_islamic_studies","hadith_islamic_studies","dawah_islamic_studies","shariah"] },
    ],
  },
  {
    tier: "Undergraduate / Graduate",
    degrees: [
      { id: "bsc_eng",    label: "B.Sc. Engineering",               bnLabel: "ইঞ্জিনিয়ারিংয়ে স্নাতক",    subjects: ["civil_engineering","mechanical_engineering","eee","cse","chemical_engineering","textile_engineering","leather_technology","ceramic_engineering","mme","ipe","architecture","bme","pge","ae","name","urp","wre","ne","mechatronics","glass_engineering"] },
      { id: "ba_honors",  label: "B.A. (Honors)",                   bnLabel: "বি.এ. (অনার্স)",             subjects: ["bengali","english","history_islamic_history","economics","political_science","public_administration"] },
      { id: "ba_pass",    label: "B.A. (Pass)",                     bnLabel: "বি.এ. (পাস কোর্স)",          subjects: ["humanities_general"] },
      { id: "bss_honors", label: "B.S.S. (Honors)",                 bnLabel: "বি.এস.এস. (অনার্স)",         subjects: ["economics","political_science","public_administration","sociology","journalism"] },
      { id: "bss_pass",   label: "B.S.S. (Pass)",                   bnLabel: "বি.এস.এস. (পাস কোর্স)",      subjects: ["social_science_general"] },
      { id: "bsc_honors", label: "B.Sc. (Honors)",                  bnLabel: "বি.এস.সি. (অনার্স)",         subjects: ["chemistry","applied_chemistry","biochemistry","agricultural_chemistry","microbiology","food_bacteriology","botany","zoology","physics","applied_physics_electronics","mathematics","applied_mathematics","statistics","soil_science"] },
      { id: "bsc_pass",   label: "B.Sc. (Pass)",                    bnLabel: "বি.এস.সি. (পাস কোর্স)",      subjects: ["pure_science_general"] },
      { id: "bba_honors", label: "B.B.A. / B.Com. (Honors)",        bnLabel: "বি.বি.এ. / বি.কম. (অনার্স)", subjects: ["accounting","finance","management","marketing","commerce"] },
      { id: "bcom_pass",  label: "B.Com. (Pass)",                   bnLabel: "বি.কম. (পাস কোর্স)",         subjects: ["commerce_general"] },
      { id: "llb_honors", label: "LL.B. (Honors)",                  bnLabel: "এলএল.বি. (অনার্স)",          subjects: ["law"] },
      { id: "llb_pass",   label: "LL.B. (Pass)",                    bnLabel: "এলএল.বি. (পাস)",             subjects: ["law"] },
      { id: "fazil",      label: "Fazil",                           bnLabel: "ফাজিল",                      subjects: ["madrasa_general","quran_islamic_studies","hadith_islamic_studies","dawah_islamic_studies","shariah"] },
    ],
  },
  {
    tier: "Diplomas & Certifications",
    degrees: [
      { id: "diploma_eng",  label: "Diploma-in-Engineering",                bnLabel: "ডিপ্লোমা-ইন-ইঞ্জিনিয়ারিং", subjects: ["civil_engineering","mechanical_engineering","eee","cse","chemical_engineering","textile_engineering","leather_technology","ceramic_engineering","mme","ipe","architecture","bme","pge","ae","name","urp","wre","ne","mechatronics","glass_engineering"] },
      { id: "pgd",          label: "Postgraduate Diploma (PGD)",             bnLabel: "পোস্টগ্রাজুয়েট ডিপ্লোমা",  subjects: ["library_science","computer_science"] },
      { id: "trade_course", label: "Trade Course / Vocational Certificate",  bnLabel: "ট্রেড কোর্স / কারিগরি সার্টিফিকেট", subjects: ["mech_trade","elec_trade","machinist_trade","carpentry_trade","fitter_trade","plumbing_trade"] },
    ],
  },
  {
    tier: "Secondary & Higher Secondary",
    degrees: [
      { id: "hsc_alim",   label: "HSC / Alim / Equivalent",     bnLabel: "উচ্চ মাধ্যমিক বা সমমান",      subjects: ["group_science","group_commerce","group_humanities","group_vocational","group_general_madrasa"] },
      { id: "ssc_dakhil", label: "SSC / Dakhil / Equivalent",   bnLabel: "মাধ্যমিক বা সমমান",            subjects: ["group_science","group_commerce","group_humanities","group_vocational","group_general_madrasa"] },
      { id: "jsc_class8", label: "JSC / JDC / Class 8 Pass",    bnLabel: "অষ্টম শ্রেণী বা সমমান পাস",   subjects: ["group_general"] },
    ],
  },
] as const;

// Degree lookup map
const DEGREE_MAP = Object.fromEntries(
  TIERS.flatMap((t) => t.degrees.map((d) => [d.id, d]))
);

// Subject reference
const SUBJECTS: Record<string, { label: string; bnLabel: string }> = {
  chemistry:                    { label: "Chemistry",                            bnLabel: "রসায়ন" },
  applied_chemistry:            { label: "Applied Chemistry",                    bnLabel: "ফলিত রসায়ন" },
  biochemistry:                 { label: "Biochemistry",                         bnLabel: "প্রাণ রসায়ন" },
  agricultural_chemistry:       { label: "Agricultural Chemistry",               bnLabel: "এগ্রি কেমিস্ট্রি" },
  microbiology:                 { label: "Microbiology",                         bnLabel: "মাইক্রোবায়োলজী" },
  food_bacteriology:            { label: "Food & Bacteriology",                  bnLabel: "ফুড ও ব্যাকটেরিওলজী" },
  botany:                       { label: "Botany",                               bnLabel: "উদ্ভিদ বিজ্ঞান" },
  zoology:                      { label: "Zoology",                              bnLabel: "প্রাণী বিদ্যা" },
  physics:                      { label: "Physics",                              bnLabel: "পদার্থ বিজ্ঞান" },
  applied_physics_electronics:  { label: "Applied Physics & Electronics",        bnLabel: "ফলিত পদার্থ বিজ্ঞান ও ইলেকট্রনিক্স" },
  mathematics:                  { label: "Mathematics",                          bnLabel: "গণিত" },
  applied_mathematics:          { label: "Applied Mathematics",                  bnLabel: "ফলিত গণিত" },
  statistics:                   { label: "Statistics",                           bnLabel: "পরিসংখ্যান" },
  soil_science:                 { label: "Soil Science",                         bnLabel: "মৃত্তিকা বিজ্ঞান" },
  civil_engineering:            { label: "Civil Engineering",                    bnLabel: "পুরকৌশল" },
  mechanical_engineering:       { label: "Mechanical Engineering",               bnLabel: "যন্ত্রকৌশল" },
  eee:                          { label: "Electrical & Electronic Engineering",  bnLabel: "তড়িৎ ও ইলেকট্রনিক প্রকৌশল" },
  cse:                          { label: "Computer Science & Engineering",       bnLabel: "কম্পিউটার প্রকৌশল" },
  chemical_engineering:         { label: "Chemical Engineering",                 bnLabel: "রাসায়নিক প্রকৌশল" },
  textile_engineering:          { label: "Textile Engineering",                  bnLabel: "টেক্সটাইল ইঞ্জিনিয়ারিং" },
  leather_technology:           { label: "Leather Technology",                   bnLabel: "লেদার টেকনোলজী" },
  ceramic_engineering:          { label: "Ceramic Engineering",                  bnLabel: "সিরামিক ইঞ্জিনিয়ারিং" },
  mme:                          { label: "Materials & Metallurgical Engineering", bnLabel: "উপাদান ও ধাতব প্রকৌশল" },
  ipe:                          { label: "Industrial & Production Engineering",   bnLabel: "শিল্প ও উৎপাদন প্রকৌশল" },
  architecture:                 { label: "Architecture",                          bnLabel: "স্থাপত্য" },
  bme:                          { label: "Biomedical Engineering",                bnLabel: "বায়োমেডিক্যাল ইঞ্জিনিয়ারিং" },
  pge:                          { label: "Petroleum & Georesources Engineering",  bnLabel: "পেট্রোলিয়াম ও ভূসম্পদ প্রকৌশল" },
  ae:                           { label: "Aeronautical / Aerospace Engineering",  bnLabel: "অ্যারোনটিক্যাল / অ্যারোস্পেস ইঞ্জিনিয়ারিং" },
  name:                         { label: "Naval Architecture & Marine Engineering",bnLabel: "নৌযান স্থাপত্য ও সামুদ্রিক প্রকৌশল" },
  urp:                          { label: "Urban & Regional Planning",             bnLabel: "নগর ও অঞ্চল পরিকল্পনা" },
  wre:                          { label: "Water Resources Engineering",           bnLabel: "জলসম্পদ প্রকৌশল" },
  ne:                           { label: "Nuclear Engineering",                   bnLabel: "নিউক্লিয়ার ইঞ্জিনিয়ারিং" },
  mechatronics:                 { label: "Mechatronics Engineering",              bnLabel: "মেকাট্রনিক্স ইঞ্জিনিয়ারিং" },
  glass_engineering:            { label: "Glass & Ceramic Engineering",           bnLabel: "গ্লাস ও সিরামিক প্রকৌশল" },
  accounting:                   { label: "Accounting",                           bnLabel: "হিসাব বিজ্ঞান" },
  finance:                      { label: "Finance",                              bnLabel: "অর্থায়ন" },
  management:                   { label: "Management",                           bnLabel: "ব্যবস্থাপনা" },
  marketing:                    { label: "Marketing",                            bnLabel: "মার্কেটিং" },
  commerce:                     { label: "Commerce / Business Administration",   bnLabel: "বাণিজ্য / ব্যবসায় প্রশাসন" },
  commerce_general:             { label: "General Commerce",                     bnLabel: "সাধারণ বাণিজ্য" },
  economics:                    { label: "Economics",                            bnLabel: "অর্থনীতি" },
  journalism:                   { label: "Mass Communication & Journalism",      bnLabel: "গণযোগাযোগ ও সাংবাদিকতা" },
  law:                          { label: "Law",                                  bnLabel: "আইন" },
  bengali:                      { label: "Bengali",                              bnLabel: "বাংলা" },
  english:                      { label: "English",                              bnLabel: "ইংরেজি" },
  political_science:            { label: "Political Science",                    bnLabel: "রাষ্ট্রবিজ্ঞান" },
  public_administration:        { label: "Public Administration",                bnLabel: "লোক প্রশাসন" },
  history_islamic_history:      { label: "History / Islamic History",            bnLabel: "ইতিহাস / ইসলামের ইতিহাস" },
  library_science:              { label: "Library Science",                      bnLabel: "গ্রন্থাগার বিজ্ঞান" },
  computer_science:             { label: "Computer Science",                     bnLabel: "কম্পিউটার বিজ্ঞান" },
  general_admin:                { label: "General Administration",               bnLabel: "সাধারণ প্রশাসন" },
  coordination:                 { label: "Coordination",                         bnLabel: "সমন্বয়" },
  sociology:                    { label: "Sociology",                            bnLabel: "সমাজবিজ্ঞান" },
  madrasa_general:              { label: "General",                              bnLabel: "সাধারণ" },
  quran_islamic_studies:        { label: "Al-Quran & Islamic Studies",           bnLabel: "আল-কোরআন এন্ড ইসলামিক স্টাডিজ" },
  hadith_islamic_studies:       { label: "Al-Hadith & Islamic Studies",          bnLabel: "আল-হাদিস এন্ড ইসলামিক স্টাডিজ" },
  dawah_islamic_studies:        { label: "Dawah & Islamic Studies",              bnLabel: "দাওয়া এন্ড ইসলামিক স্টাডিজ" },
  shariah:                      { label: "Shariah",                              bnLabel: "শরীয়াহ" },
  mech_trade:                   { label: "Mechanical Trade",                     bnLabel: "মেকানিক্যাল ট্রেড" },
  elec_trade:                   { label: "Electrical Trade / House Wiring",      bnLabel: "ইলেকট্রিক্যাল ট্রেড / হাউজ ওয়ারিং" },
  machinist_trade:              { label: "Machinist Trade",                      bnLabel: "যন্ত্রবিদ ট্রেড" },
  carpentry_trade:              { label: "Carpentry & Woodwork",                 bnLabel: "কাঠমিস্ত্রি ও নকশা ট্রেড" },
  fitter_trade:                 { label: "Fitter Trade",                         bnLabel: "ফিটার ট্রেড" },
  plumbing_trade:               { label: "Plumbing Trade",                       bnLabel: "প্লাম্বিং ট্রেড" },
  group_science:                { label: "Science Group",                        bnLabel: "বিজ্ঞান বিভাগ" },
  group_commerce:               { label: "Commerce Group",                       bnLabel: "ব্যবসায় শিক্ষা বিভাগ" },
  group_humanities:             { label: "Humanities Group",                     bnLabel: "মানবিক বিভাগ" },
  group_vocational:             { label: "Vocational Group",                     bnLabel: "কারিগরি বিভাগ" },
  group_general_madrasa:        { label: "General Group - Madrasa",              bnLabel: "সাধারণ বিভাগ (মাদ্রাসা)" },
  humanities_general:           { label: "General Humanities",                   bnLabel: "সাধারণ মানবিক" },
  social_science_general:       { label: "General Social Science",               bnLabel: "সাধারণ সামাজিক বিজ্ঞান" },
  pure_science_general:         { label: "General Pure Science",                 bnLabel: "সাধারণ বিজ্ঞান" },
  group_general:                { label: "General",                              bnLabel: "সাধারণ" },
};

// Degrees that need a Board field
const BOARD_DEGREES = new Set(["ssc_dakhil", "hsc_alim", "jsc_class8"]);
const BOARDS = ["ঢাকা","চট্টগ্রাম","রাজশাহী","যশোর","কুমিল্লা","সিলেট","বরিশাল","দিনাজপুর","ময়মনসিংহ","অন্যান্য"];
const SECONDARY_METRICS = [
  { id: "out_of_5",     label: "Out of 5 (GPA)" },
  { id: "division_1st", label: "1st Division" },
  { id: "division_2nd", label: "2nd Division" },
  { id: "division_3rd", label: "3rd Division" },
];
const UNIVERSITY_METRICS = [
  { id: "out_of_4",  label: "Out of 4 (CGPA)" },
  { id: "class_1st", label: "1st Class" },
  { id: "class_2nd", label: "2nd Class" },
  { id: "pass",      label: "Pass" },
];
const NUMERIC_METRICS = new Set(["out_of_5", "out_of_4"]);
const CATEGORICAL_RESULT: Record<string, string> = {
  division_1st: "1st Division",
  division_2nd: "2nd Division",
  division_3rd: "3rd Division",
  class_1st: "1st Class",
  class_2nd: "2nd Class",
  pass: "Pass",
};

// Degrees in the "Undergraduate / Graduate" tier get a searchable university combobox
const UNDERGRAD_DEGREES = new Set([
  "bsc_eng","ba_honors","ba_pass","bss_honors","bss_pass",
  "bsc_honors","bsc_pass","bba_honors","bcom_pass","llb_honors","llb_pass","fazil",
]);

const UNIVERSITIES = [
  // Public — general & science/tech
  "University of Dhaka",
  "University of Rajshahi",
  "University of Chittagong",
  "University of Khulna",
  "Jahangirnagar University",
  "Jagannath University",
  "Islamic University, Kushtia",
  "National University",
  "Bangladesh Open University",
  "Begum Rokeya University, Rangpur",
  "Comilla University",
  "Noakhali Science and Technology University",
  "Jessore University of Science and Technology",
  "Pabna University of Science and Technology",
  "Barishal University",
  "Shahjalal University of Science and Technology",
  "Hajee Mohammad Danesh Science and Technology University",
  "Mawlana Bhashani Science and Technology University",
  "Patuakhali Science and Technology University",
  "Rangamati Science and Technology University",
  "Sunamganj Science and Technology University",
  "Bangabandhu Sheikh Mujibur Rahman Science and Technology University",
  "Bangabandhu Sheikh Mujibur Rahman Digital University",
  "Bangabandhu Sheikh Mujibur Rahman Maritime University",
  "Bangabandhu Sheikh Mujibur Rahman Aviation and Aerospace University",
  "Rabindra University, Bangladesh",
  "Sheikh Hasina University, Netrokona",
  // Public — engineering
  "Bangladesh University of Engineering and Technology (BUET)",
  "Rajshahi University of Engineering and Technology (RUET)",
  "Khulna University of Engineering and Technology (KUET)",
  "Chittagong University of Engineering and Technology (CUET)",
  "Dhaka University of Engineering & Technology (DUET)",
  "Military Institute of Science and Technology (MIST)",
  "Bangladesh University of Textiles (BUTEX)",
  // Public — agriculture
  "Bangladesh Agricultural University, Mymensingh",
  "Sher-e-Bangla Agricultural University",
  "Sylhet Agricultural University",
  "Khulna Agricultural University",
  // Public — professional / special
  "Bangabandhu Sheikh Mujib Medical University (BSMMU)",
  "Bangladesh University of Professionals (BUP)",
  // Private — top tier
  "North South University",
  "BRAC University",
  "Independent University, Bangladesh (IUB)",
  "East West University",
  "American International University-Bangladesh (AIUB)",
  "Ahsanullah University of Science and Technology (AUST)",
  "Daffodil International University",
  "United International University",
  "University of Liberal Arts Bangladesh (ULAB)",
  "University of Asia Pacific",
  "International University of Business Agriculture and Technology (IUBAT)",
  // Private — mid-tier & regional
  "Southeast University",
  "Bangladesh University of Business and Technology (BUBT)",
  "Stamford University Bangladesh",
  "Green University of Bangladesh",
  "Bangladesh University",
  "Manarat International University",
  "Primeasia University",
  "Uttara University",
  "Eastern University",
  "Dhaka International University",
  "World University of Bangladesh",
  "European University of Bangladesh",
  "Central University of Science and Technology",
  "Atish Dipankar University of Science and Technology",
  "Gono Bishwabidyalay",
  "Shanto-Mariam University of Creative Technology",
  "University of Information Technology and Sciences (UITS)",
  "Prime University",
  "Notre Dame University Bangladesh",
  "Canadian University of Bangladesh",
  "Britannia University",
  // Private — Chittagong & Sylhet region
  "Metropolitan University, Sylhet",
  "Leading University, Sylhet",
  "Port City International University",
  "Southern University Bangladesh",
  "Premiere University, Chittagong",
  "BGC Trust University Bangladesh",
  "Varendra University",
  "Queens University",
];

function UniversityCombobox({ value, onChange, required }: {
  value: string; onChange: (v: string) => void; required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const filtered = query.trim().length === 0
    ? UNIVERSITIES
    : UNIVERSITIES.filter((u) => u.toLowerCase().includes(query.toLowerCase())).slice(0, 20);

  function select(u: string) {
    onChange(u);
    setQuery(u);
    setOpen(false);
  }

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onChange(query);
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [query, onChange]);

  return (
    <div ref={containerRef} className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        required={required}
        autoComplete="off"
        className={INPUT}
        placeholder="Type to search or enter university name"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-background border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto text-sm">
          {filtered.map((u) => (
            <li
              key={u}
              onMouseDown={(e) => { e.preventDefault(); select(u); }}
              className={`px-3 py-2 cursor-pointer hover:bg-muted ${u === value ? "bg-muted font-medium" : ""}`}
            >
              {u}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type EduRow = {
  degree: string; institution: string; subject: string;
  board: string; gpa: string; result: string; passingYear: string;
};
const EMPTY_ROW: EduRow = { degree: "", institution: "", subject: "", board: "", gpa: "", result: "", passingYear: "" };

export default function EducationForm({ initial, prevStep, nextStep }: { initial: EduRow[]; prevStep: string | null; nextStep: string | null }) {
  const router = useRouter();
  const [rows, setRows] = useState<EduRow[]>(initial.length ? initial : [{ ...EMPTY_ROW }]);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  const update = (i: number, patch: Partial<EduRow>) =>
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/profile/education", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    }).finally(() => setSaving(false));
    if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
    setSaved(true); router.refresh(); if (nextStep) router.push("/profile?step=" + nextStep);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <RepeatingSection
        rows={rows}
        onAdd={() => setRows((r) => [...r, { ...EMPTY_ROW }])}
        onRemove={(i) => setRows((r) => r.filter((_, idx) => idx !== i))}
        addLabel="+ Add Qualification"
        emptyMessage="No education records yet. Click below to add one."
      >
        {(row, i) => {
          const degreeInfo = DEGREE_MAP[row.degree] ?? null;
          const availableSubjects = degreeInfo?.subjects ?? [];
          const needsBoard = BOARD_DEGREES.has(row.degree);

          return (
            <div className="grid grid-cols-3 gap-4">
              {/* Degree — grouped by tier */}
              <div>
                <label className={LABEL}>Degree <span className="text-red-500">*</span></label>
                <select
                  value={row.degree}
                  onChange={(e) => update(i, { degree: e.target.value, subject: "", board: "" })}
                  required
                  className={INPUT}
                >
                  <option value="">— Select Degree —</option>
                  {TIERS.map((tier) => (
                    <optgroup key={tier.tier} label={tier.tier}>
                      {tier.degrees.map((d) => (
                        <option key={d.id} value={d.id}>{d.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {degreeInfo && (
                  <p className="text-[11px] text-muted-foreground mt-1 font-bn-serif">{degreeInfo.bnLabel}</p>
                )}
              </div>

              {/* Institution */}
              <div className="col-span-2">
                <label className={LABEL}>Institution <span className="text-red-500">*</span></label>
                {UNDERGRAD_DEGREES.has(row.degree) ? (
                  <UniversityCombobox
                    value={row.institution}
                    onChange={(v) => update(i, { institution: v })}
                    required
                  />
                ) : (
                  <input
                    value={row.institution}
                    onChange={(e) => update(i, { institution: e.target.value })}
                    required
                    className={INPUT}
                    placeholder="School / College / University name"
                  />
                )}
              </div>

              {/* Subject — dependent on degree */}
              <div>
                <label className={LABEL}>
                  {needsBoard ? "Group / Stream" : "Subject / Discipline"}
                  {row.degree && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <select
                  value={row.subject}
                  onChange={(e) => update(i, { subject: e.target.value })}
                  required={!!row.degree}
                  disabled={!row.degree}
                  className={`${INPUT} ${!row.degree ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <option value="">
                    {row.degree ? "— Select —" : "Select degree first"}
                  </option>
                  {availableSubjects.map((key) => {
                    const sub = SUBJECTS[key];
                    if (!sub) return null;
                    return (
                      <option key={key} value={key}>
                        {sub.label}
                      </option>
                    );
                  })}
                </select>
                {row.subject && SUBJECTS[row.subject] && (
                  <p className="text-[11px] text-muted-foreground mt-1 font-bn-serif">
                    {SUBJECTS[row.subject].bnLabel}
                  </p>
                )}
              </div>

              {/* Board — only for secondary tier */}
              {needsBoard && (
                <div>
                  <label className={LABEL}>Education Board</label>
                  <select
                    value={row.board}
                    onChange={(e) => update(i, { board: e.target.value })}
                    className={INPUT}
                  >
                    <option value="">— Select Board —</option>
                    {BOARDS.map((b) => (
                      <option key={b} value={b}>{b} Board</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Result Scale */}
              <div>
                <label className={LABEL}>Result Scale</label>
                <select
                  value={row.gpa}
                  onChange={(e) => {
                    const scale = e.target.value;
                    update(i, { gpa: scale, result: CATEGORICAL_RESULT[scale] ?? "" });
                  }}
                  disabled={!row.degree}
                  className={`${INPUT} ${!row.degree ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <option value="">— Select —</option>
                  {(BOARD_DEGREES.has(row.degree) ? SECONDARY_METRICS : UNIVERSITY_METRICS).map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Result Value */}
              <div>
                <label className={LABEL}>Result Value <span className="text-red-500">*</span></label>
                {NUMERIC_METRICS.has(row.gpa) ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={row.gpa === "out_of_5" ? "5" : "4"}
                    value={row.result}
                    onChange={(e) => update(i, { result: e.target.value })}
                    required={!!row.degree}
                    className={INPUT}
                    placeholder={row.gpa === "out_of_5" ? "0.00 – 5.00" : "0.00 – 4.00"}
                  />
                ) : (
                  <input
                    value={row.result}
                    readOnly
                    required={!!row.degree}
                    className={`${INPUT} bg-muted text-muted-foreground cursor-default`}
                    placeholder="— auto-filled —"
                  />
                )}
              </div>

              {/* Passing Year */}
              <div>
                <label className={LABEL}>Passing Year <span className="text-red-500">*</span></label>
                <input
                  value={row.passingYear}
                  onChange={(e) => update(i, { passingYear: e.target.value })}
                  required
                  className={INPUT}
                  placeholder="e.g. 2017"
                />
              </div>

              {/* Certificate upload placeholder */}
              <div className="col-span-3">
                <label className={LABEL}>Certificate Copy</label>
                <div className="border-2 border-dashed border-border rounded-lg px-4 py-3 text-center text-xs text-muted-foreground hover:border-slate-400 transition-colors cursor-pointer">
                  Upload certificate (placeholder — file upload coming soon)
                </div>
              </div>
            </div>
          );
        }}
      </RepeatingSection>

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
