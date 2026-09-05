/**
 * Reading `utils/employee_bio.json` into the shape our schema wants.
 *
 * Pure: no database access, no side effects. That is what lets the dry-run
 * report show exactly what the import would do before it does it.
 */
import { gradeFor, type PostGrade } from "./grades";
import { loose, norm, opt, val } from "./text";

// ─── The employee id ─────────────────────────────────────────────────────────

/**
 * BSTI employee ids are `YYYY` + `CCC` + `NNNN`: joining year, entry code,
 * serial. The middle three digits are the series someone was recruited into.
 *
 * Checking the structure, not just the length, matters: Bangladeshi mobile
 * numbers are also eleven digits, and the export has four of them sitting in
 * the id field. A bare `\d{11}` test lets them through — which is the same
 * collision `D16` keeps employee ids and mobiles in separate columns for.
 */
export const ENTRY_CODES: Record<string, string> = {
  "101": "Administration",
  "102": "Staff",
  "103": "Daily basis",
  "201": "Standards wing",
  "301": "Certification Marks wing",
  "401": "Physical testing wing",
  "501": "Chemistry testing wing",
  "601": "Metrology wing",
  "701": "Management Systems Certification wing",
};

/** The daily-basis series. The one category the id decides on its own. */
export const DAILY_BASIS_CODE = "103";

/** What a name column says when the export did not carry one. */
export const UNKNOWN_EN = "Not recorded";
export const UNKNOWN_BN = "তথ্য নেই";

/**
 * A stand-in date of birth, from the joining year in the employee id.
 *
 * BSTI's entrants are typically 25–30 at joining, so the year is the joining
 * year less that. The offset is derived from the id rather than drawn at
 * random, so a re-import produces the same date instead of quietly moving
 * someone's birthday, and the day and month are fixed for the same reason.
 *
 * **This is not a retirement date.** `postRetirementLeave` and `fullRetirement`
 * are stored columns and are not computed from date of birth, so nothing is
 * calculated off this. It exists to satisfy a NOT NULL column, and
 * `identityIsProvisional` marks every row that carries one.
 */
export function provisionalBirthDate(id: string, joiningYear: number): string {
  const spread = 25 + (Number(id.slice(-4)) % 6); // 25…30, stable for an id
  return `01-01-${joiningYear - spread}`;
}

export type ParsedId = { year: number; code: string; serial: string };

export function parseEmployeeId(id: string): ParsedId | null {
  if (!/^\d{11}$/.test(id)) return null;
  const year = Number(id.slice(0, 4));
  const code = id.slice(4, 7);
  // 1970 is comfortably before the earliest joining year on the roster (1985);
  // anything outside the range is a mobile number or a typo.
  if (year < 1970 || year > new Date().getFullYear()) return null;
  if (!(code in ENTRY_CODES)) return null;
  return { year, code, serial: id.slice(7) };
}

// ─── Value vocabularies ──────────────────────────────────────────────────────

const GENDER: Record<string, "male" | "female" | "other"> = {
  "পুরুষ": "male",
  "মহিলা": "female",
  "male": "male",
  "female": "female",
};

const MARITAL: Record<string, "single" | "married" | "divorced" | "widowed"> = {
  "বিবাহিত": "married",
  "অবিবাহিত": "single",
  "তালাকপ্রাপ্ত": "divorced",
  "বিপত্নীক": "widowed",
  "বিধবা": "widowed",
};

const BLOOD: Record<string, string> = {
  "A+": "A_pos", "A-": "A_neg", "B+": "B_pos", "B-": "B_neg",
  "AB+": "AB_pos", "AB-": "AB_neg", "O+": "O_pos", "O-": "O_neg",
};

/**
 * Is this actually an address?
 *
 * The export puts junk in the email field — 56 employees carry the literal
 * string "00" and three carry "0". Stored as-is they would be offered as a
 * contact address, and `User.email` is unique, so the 56 would collide.
 */
export function isValidEmail(s: unknown): boolean {
  const t = val(s);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
}

/**
 * Honorifics that carry no identity. Stripped before building a demo address so
 * that half the roster does not come out as `md.islam`.
 */
const HONORIFICS = new Set([
  "MD", "MOHAMMAD", "MOHAMMED", "MOHD", "MUHAMMAD", "MUHAMMED",
  "MST", "MOSAMMAT", "MOSAMMAD", "MRS", "MR", "MS", "MISS", "DR", "ENGR", "ENG",
  "জনাব",
]);

/**
 * A stand-in address for someone whose email the export does not usefully
 * carry — 56 employees have the literal string "00" in that field and three
 * have "0".
 *
 * `first.last@example.com`, honorifics dropped. `example.com` is reserved by
 * RFC 2606 and can never receive mail, so a placeholder cannot be mistaken for
 * a real address or accidentally written to.
 *
 * Returns null when the name has no usable Latin letters — several names are
 * recorded only in Bengali — and the caller falls back to the employee id.
 */
export function demoEmailLocalPart(nameEn: string): string | null {
  const words = norm(nameEn)
    // Drop parenthesised nicknames — "ALI AHMED (BABUL)" is Ali Ahmed, and
    // taking the last word would make him ali.babul.
    .replace(/\([^)]*\)/g, " ")
    .toUpperCase()
    .replace(/[^A-Z\s.]/g, " ")
    .split(/[\s.]+/)
    .filter(Boolean);

  // Honorifics are only stripped from the front. "MD. MOKSEDUL ISLAM" is
  // Mokseduf Islam, but "NUR MOHAMMAD" is a whole name — dropping MOHAMMAD
  // wherever it appeared would leave him as just "nur".
  let i = 0;
  while (i < words.length - 1 && HONORIFICS.has(words[i])) i++;
  const rest = words.slice(i);

  if (!rest.length) return null;
  const first = rest[0].toLowerCase();
  const last = rest.length > 1 ? rest[rest.length - 1].toLowerCase() : "";
  return last ? `${first}.${last}` : first;
}

/** The export spells this seven ways; the column is free text, so settle it. */
export function normaliseNationality(s: unknown): string | null {
  return val(s) ? "Bangladeshi" : null;
}

// ─── Offices ─────────────────────────────────────────────────────────────────

/**
 * The export's `office_id` is its own id space — its 1 is head office, ours is
 * 6 — so offices are matched on the city in the name, in either language.
 *
 * Naogaon became Bogura, so 11 answers to both.
 */
const OFFICE_BY_CITY_EN: Record<string, number> = {
  dhaka: 6, chattogram: 3, chittagong: 3, rajshahi: 22, khulna: 18,
  barishal: 1, barisal: 1, sylhet: 2, rangpur: 4, mymensingh: 5, dmi: 19,
  cumilla: 7, comilla: 7, faridpur: 8, "cox'bazar": 9, "cox's bazar": 9,
  coxbazar: 9, kushtia: 10, bogura: 11, bogra: 11, naogaon: 11, gazipur: 12,
  patuakhali: 13, pabna: 14, gopalganj: 15, dinajpur: 16, noakhali: 17,
  narsingdi: 20, jashore: 21, jessore: 21, narayanganj: 23,
};

const OFFICE_BY_CITY_BN: Record<string, number> = {
  "ঢাকা": 6, "চট্টগ্রাম": 3, "রাজশাহী": 22, "খুলনা": 18, "বরিশাল": 1,
  "সিলেট": 2, "রংপুর": 4, "ময়মনসিংহ": 5, "ডিএমআই": 19, "কুমিল্লা": 7,
  "ফরিদপুর": 8, "কক্সবাজার": 9, "কুষ্টিয়া": 10, "বগুড়া": 11, "নওগাঁ": 11,
  "গাজীপুর": 12, "পটুয়াখালী": 13, "পাবনা": 14, "গোপালগঞ্জ": 15,
  "দিনাজপুর": 16, "নোয়াখালী": 17, "নরসিংদী": 20, "যশোর": 21, "নারায়ণগঞ্জ": 23,
};

export function resolveOffice(officeEn: string, officeBn: string): number | null {
  const en = norm(officeEn).toLowerCase();
  if (en) {
    // The head office is named for the institution itself, not a city.
    if (en.includes("bangladesh standards")) return 6;
    for (const [city, id] of Object.entries(OFFICE_BY_CITY_EN)) {
      if (en.includes(city)) return id;
    }
  }
  const bn = norm(officeBn);
  if (bn) {
    if (bn.includes("স্ট্যান্ডার্ডস")) return 6;
    for (const [city, id] of Object.entries(OFFICE_BY_CITY_BN)) {
      if (bn.includes(city)) return id;
    }
  }
  return null;
}

// ─── Dates ───────────────────────────────────────────────────────────────────

/** ISO `1996-04-13` or `Apr 13, 1996` → our stored `DD-MM-YYYY`. */
export function toStoredDate(input: unknown): string | null {
  const s = val(input);
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime()) && /\d{4}/.test(s)) {
    const d = String(parsed.getDate()).padStart(2, "0");
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    return `${d}-${m}-${parsed.getFullYear()}`;
  }
  return null;
}

// ─── The normalised record ───────────────────────────────────────────────────

export type Category = "officer" | "staff" | "daily_basis" | "outsourcing";

export type NormalisedEmployee = {
  id: string;
  parsed: ParsedId;
  category: Category;
  grade: number | null;
  gradeHow: string | null;
  officeId: number;
  nameEn: string;
  nameBn: string;
  fatherNameEn: string;
  fatherNameBn: string;
  motherNameEn: string;
  motherNameBn: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other" | "unspecified";
  maritalStatus: "single" | "married" | "divorced" | "widowed" | "unspecified";
  /** True when any of the five biographical fields above is a stand-in. */
  identityIsProvisional: boolean;
  bloodGroup: string | null;
  nid: string | null;
  nationality: string | null;
  email: string | null;
  mobileHome: string | null;
  mobileOffice: string | null;
  designationEn: string | null;
  designationBn: string | null;
  wing: string | null;
  dateOfJoining: string | null;
  postRetirementLeave: string | null;
  bankAccountNo: string | null;
  bankBranch: string | null;
  tinNo: string | null;
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyMobile: string | null;
};

export type Rejection = {
  id: string;
  nameEn: string;
  reason: string;
  detail?: string;
};

export type NormaliseResult =
  | { ok: true; employee: NormalisedEmployee }
  | { ok: false; rejection: Rejection };

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normaliseRecord(raw: any, table: PostGrade[]): NormaliseResult {
  const id = norm(raw?.employee_id);
  const nameTop = val(raw?.name_en) || val(raw?.name_bn) || "(no name)";

  const parsed = parseEmployeeId(id);
  if (!parsed) {
    const why = /^\d{11}$/.test(id)
      ? "eleven digits, but not a valid employee id — a mobile number or a test row"
      : "not an employee id (an email address)";
    return { ok: false, rejection: { id, nameEn: nameTop, reason: "bad id", detail: why } };
  }

  const bio = raw?.bio;
  if (!bio || typeof bio !== "object") {
    return {
      ok: false,
      rejection: { id, nameEn: nameTop, reason: "no bio", detail: String(raw?.source?.error ?? "") },
    };
  }

  const identity = bio.identity ?? {};
  const contact = bio.contact ?? {};
  const service = bio.service ?? {};

  /**
   * The five biographical columns are NOT NULL and used to hold people out of
   * the roster entirely. Nothing in `lib/salary/` or `lib/workflow/` reads any
   * of them — they are profile and display fields — so keeping someone out
   * meant they had no desk and no file could reach them, which is a working
   * problem traded for a cosmetic one.
   *
   * They are now filled with stand-ins, and `identityIsProvisional` says so, so
   * a placeholder is never mistaken for what HR actually holds.
   */
  const provided = {
    dateOfBirth: toStoredDate(identity.date_of_birth),
    gender: GENDER[val(identity.gender)],
    maritalStatus: MARITAL[val(identity.marital_status)],
    fatherNameEn: val(identity.father_name_en),
    motherNameEn: val(identity.mother_name_en),
  };
  const identityIsProvisional = Object.values(provided).some((v) => !v);

  const dateOfBirth = provided.dateOfBirth ?? provisionalBirthDate(id, parsed.year);
  // `unspecified` rather than a guess: inferring gender from a Bangladeshi name
  // is unreliable, and a wrong one is shown to that person on their own profile.
  const gender = provided.gender ?? "unspecified";
  const maritalStatus = provided.maritalStatus ?? "unspecified";
  const fatherNameEn = provided.fatherNameEn || UNKNOWN_EN;
  const motherNameEn = provided.motherNameEn || UNKNOWN_EN;

  const officeId = resolveOffice(val(service.office_en), val(raw?.office) || val(service.office_bn));
  if (officeId === null) {
    return {
      ok: false,
      rejection: { id, nameEn: nameTop, reason: "no office", detail: "no office named in the export" },
    };
  }

  const designationBn = val(service.designation_bn) || val(raw?.designation);
  const wing = val(service.wing_bn) || val(raw?.wing);

  // Daily-basis staff sit outside the national pay scale entirely, so their
  // grade is null however their designation would otherwise resolve —
  // নিরাপত্তা প্রহরী appears in the sanctioned list at grade 20, but a
  // daily-basis guard does not hold that post.
  const isDaily = parsed.code === DAILY_BASIS_CODE;
  const resolved = isDaily ? null : gradeFor(table, designationBn, wing);
  const grade = resolved?.grade ?? null;

  // With a grade, the band decides. Without one, fall back to the entry code:
  // 102 is the staff series, everything else is an officer series. The three
  // people whose designation reads "অফিস প্রধান" — a function, not a
  // sanctioned post — are officers heading an office, and defaulting them to
  // staff would be wrong.
  const OFFICER_SERIES = new Set(["101", "201", "301", "401", "501", "601", "701"]);
  const category: Category = isDaily
    ? "daily_basis"
    : grade === null
      ? OFFICER_SERIES.has(parsed.code)
        ? "officer"
        : "staff"
      : grade <= 11
        ? "officer"
        : "staff";

  const bank = Array.isArray(bio.bank) && bio.bank[0] ? bio.bank[0] : {};
  const emergency = identity.emergency_contact ?? contact.emergency_contact ?? {};

  return {
    ok: true,
    employee: {
      id,
      parsed,
      category,
      grade,
      gradeHow: isDaily ? "daily basis — no grade" : (resolved?.how ?? null),
      officeId,
      nameEn: val(identity.name_en) || val(raw?.name_en),
      nameBn: val(identity.name_bn) || val(raw?.name_bn),
      fatherNameEn,
      fatherNameBn:
        val(identity.father_name_bn) ||
        (provided.fatherNameEn ? fatherNameEn : UNKNOWN_BN),
      motherNameEn,
      motherNameBn:
        val(identity.mother_name_bn) ||
        (provided.motherNameEn ? motherNameEn : UNKNOWN_BN),
      dateOfBirth,
      gender,
      maritalStatus,
      identityIsProvisional,
      bloodGroup: BLOOD[val(identity.blood_group)] ?? null,
      nid: opt(identity.nid),
      nationality: normaliseNationality(identity.nationality),
      email: isValidEmail(contact.email) ? val(contact.email) : null,
      mobileHome: opt(contact.personal_mobile),
      mobileOffice: opt(contact.office_phone),
      designationEn: opt(service.designation_en),
      designationBn: opt(designationBn),
      wing: opt(wing),
      dateOfJoining: toStoredDate(service.joining_date),
      postRetirementLeave: toStoredDate(service.plr_lpr_date),
      bankAccountNo: opt(bank["Account No"]),
      bankBranch: opt(bank["Branch Name"]),
      tinNo: opt(bank["TIN No"]),
      emergencyName: opt(emergency.name),
      emergencyRelation: opt(emergency.relation),
      emergencyMobile: opt(emergency.mobile),
    },
  };
}

/** Names that are the same person seen twice — the export has one exact pair. */
export function dedupe(records: any[]): { kept: any[]; duplicates: string[] } {
  const seen = new Set<string>();
  const kept: any[] = [];
  const duplicates: string[] = [];
  for (const r of records) {
    const id = norm(r?.employee_id);
    if (seen.has(id)) {
      duplicates.push(id);
      continue;
    }
    seen.add(id);
    kept.push(r);
  }
  return { kept, duplicates };
}

export { loose };
