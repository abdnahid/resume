/**
 * The sanctioned post list, read from `utils/grades.ods`.
 *
 * 133 posts across ten wing sections. Used to give an employee a grade from
 * their designation, because the HR export carries a grade for only 101 of 700
 * people while it carries a designation for 674.
 *
 * One post is genuinely ambiguous: **পরীক্ষক is grade ১০ in প্রশাসন উইং and
 * grade ৯ in every other wing**, which is why resolution needs the wing too.
 */
import * as XLSX from "xlsx";
import * as path from "node:path";
import { loose, norm } from "./text";

export type PostGrade = { section: string; post: string; grade: number };

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** "গ্রেড-১০" → 10. Handles Bengali or Western digits. */
export function parseGrade(cell: string): number | null {
  const digits = [...String(cell)]
    .map((c) => (BN_DIGITS.includes(c) ? String(BN_DIGITS.indexOf(c)) : /\d/.test(c) ? c : ""))
    .join("");
  const n = Number(digits);
  return Number.isInteger(n) && n >= 1 && n <= 20 ? n : null;
}

export function loadPostGrades(
  file = path.join(process.cwd(), "utils", "grades.ods"),
): PostGrade[] {
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });

  const out: PostGrade[] = [];
  let section = "";
  for (const raw of rows) {
    const cells = raw.map((c) => (c === undefined || c === null ? "" : String(c)));
    if (!cells.length) continue;
    // Section headers look like "ক-অংশ : প্রশাসন উইং (কর্মকর্তা)".
    if (cells[0].includes("অংশ")) {
      section = norm(cells[0]);
      continue;
    }
    if (cells.length < 3) continue;
    const grade = parseGrade(cells[2]);
    const post = norm(cells[1]);
    if (grade === null || !post) continue;
    out.push({ section, post, grade });
  }
  return out;
}

/**
 * The grade for a designation, disambiguated by wing where it has to be.
 *
 * Matching is deliberately layered, widest last, because the HR export writes
 * bare designations ("সহকারী পরিচালক") where the sanctioned list qualifies them
 * ("সহকারী পরিচালক (সিএম)"), and writes variants that differ only in spacing or
 * hyphens ("গ্যাস ম্যান" vs "গ্যাসম্যান", "ল্যাব বাহক" vs "ল্যাব বেয়ারার /ল্যাব বাহক").
 */
/**
 * Designations the export uses that are a *different word* from the sanctioned
 * post, not a spelling of it — so no amount of folding will match them.
 *
 * Each is a judgement call and is listed here to be argued with rather than
 * buried in fuzzy matching. `অফিস প্রধান` ("office head") is deliberately
 * absent: it names a function, not a sanctioned post, and the three people
 * carrying it hold a real post elsewhere.
 */
export const DESIGNATION_ALIASES: Record<string, string> = {
  // Letter transposition in the source: ঊধ্বর্তন for ঊর্ধ্বতন.
  "ঊধ্বর্তন কারিগরী সহায়ক": "ঊর্ধ্বতন কারিগরী সহায়ক",
  // "Office assistant cum computer operator" vs the sanctioned "…cum computer
  // typist" — the same clerical post under a modernised name.
  "অফিস সহকারী কাম কম্পিউটার অপারেটর": "অফিস সহকারী-কাম-কম্পিউটার মুদ্রক্ষরিক",
  // মুদ্রাক্ষরিক / মুদ্রক্ষরিক — an inserted া, which folding leaves alone
  // because it only normalises vowel *length*, not inserted vowel signs.
  "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক": "অফিস সহকারী-কাম-কম্পিউটার মুদ্রক্ষরিক",
  // Stenographer / stenotypist, written in English loanwords rather than the
  // sanctioned Bengali.
  "স্টেনোগ্রাফার": "সাঁটলিপিকার- কাম-কম্পিউটার মুদ্রক্ষরিক",
  "সাঁটলিপিকার কাম কম্পিউটার অপারেটর": "সাঁটলিপিকার- কাম-কম্পিউটার মুদ্রক্ষরিক",
  "স্টেনোটাইপিস্ট": "সাঁটমুদ্রাক্ষরিক-কাম-কম্পিউটার মুদ্রক্ষরিক",
  // "Accountant" as a loanword for the sanctioned হিসাব রক্ষক.
  "একাউন্টেন্ট": "হিসাব রক্ষক",
};

/**
 * Does a section heading of the sanctioned list describe the wing an employee
 * works in?
 *
 * The list's sections *are* the wings — "ঙ-অংশ : রসায়ন পরীক্ষণ উইং" — while the
 * HR export writes the wing loosely: "রসায়ন পরীক্ষণ উইং", "অজৈব রসায়ন বিভাগ",
 * "সিএম বিভাগ", "প্রশাসন শাখা". Matching on any substantial shared word gets
 * all of those without hand-listing them.
 */
/** Words that appear in almost every wing name and so distinguish nothing. */
const WING_STOPWORDS = ["উইং", "শাখা", "বিভাগ", "সেল", "পরীক্ষণ", "কার্যালয়", "কর্মকর্তা", "কর্মচারী"];

function wingWords(wing: string): string[] {
  return norm(wing)
    .split(/[\s,()\-–—]+/)
    .filter((word) => word.length >= 3 && !WING_STOPWORDS.includes(word));
}

/**
 * How well a section heading matches an employee's wing — the count of
 * distinguishing words they share, 0 for no match.
 *
 * A score rather than a boolean because "রসায়ন পরীক্ষণ উইং" shares "পরীক্ষণ"
 * with the পদার্থ section too; both give grade 9, but the report would name the
 * wrong wing as the reason. Stopwords carry no weight, and the best-scoring
 * section wins.
 */
export function wingScore(section: string, wing: string): number {
  const sec = norm(section);
  if (!sec) return 0;
  return wingWords(wing).filter((word) => sec.includes(word)).length;
}

export function sectionMatchesWing(section: string, wing: string): boolean {
  return wingScore(section, wing) > 0;
}

/**
 * The grade for a designation, using the wing to choose between variants.
 *
 * Order matters, and the wing comes first on purpose. The sanctioned list has
 * exactly one bare "পরীক্ষক" — grade ১০, in প্রশাসন উইং — while every lab
 * examiner appears as a qualified variant at grade ৯. Matching the bare name
 * first would put all 88 examiners on the administrative grade.
 *
 * Matching then widens: exact, folded spelling, slash alternatives, substring.
 * Each result reports *how* it matched so the dry-run report can be audited.
 */
export function gradeFor(
  table: PostGrade[],
  designation: string,
  wing: string,
): { grade: number; how: string } | null {
  let d = norm(designation);
  if (!d) return null;

  // 0. A known different-word alias, applied before anything else.
  const alias = DESIGNATION_ALIASES[d];
  if (alias) {
    const hit = table.filter((r) => r.post === alias || loose(r.post) === loose(alias));
    if (hit.length) {
      const wingHit = hit.find((r) => sectionMatchesWing(r.section, wing));
      const pick = wingHit ?? hit[0];
      return { grade: pick.grade, how: `alias → "${alias}"` };
    }
    d = alias;
  }

  // 1. A variant qualified for this employee's wing — "পরীক্ষক" in রসায়ন is
  //    "পরীক্ষক (রসায়ন)", not the bare administrative post.
  const qualified = table.filter(
    (r) => r.post === d || r.post.startsWith(`${d} (`) || loose(r.post).startsWith(loose(d) + "("),
  );
  const scored = qualified
    .map((r) => ({ r, score: wingScore(r.section, wing) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.r.grade - b.r.grade);
  if (scored.length) {
    const best = scored[0];
    const tied = scored.filter((x) => x.score === best.score);
    const grades = [...new Set(tied.map((x) => x.r.grade))];
    return {
      grade: Math.min(...grades),
      how: `wing "${best.r.section.replace(/^[^:]*:?\s*/, "")}" → "${best.r.post}"${grades.length > 1 ? ` (${grades.length} grades tied — took lowest)` : ""}`,
    };
  }

  // 2. Exact post name in any wing.
  const exact = table.filter((r) => r.post === d);
  if (exact.length) {
    const grades = [...new Set(exact.map((r) => r.grade))];
    return {
      grade: Math.min(...grades),
      how: grades.length > 1 ? `exact, ${grades.length} grades — took lowest` : "exact",
    };
  }

  // 3. Any qualified variant, wing unmatched.
  if (qualified.length) {
    const grades = [...new Set(qualified.map((r) => r.grade))];
    return {
      grade: Math.min(...grades),
      how:
        grades.length > 1
          ? `qualified (wing unmatched), ${grades.length} grades — took lowest`
          : `qualified (wing unmatched) → "${qualified[0].post}"`,
    };
  }

  // 4. Fold separators and vowel length — "ইউডিসি কাম ক্যাশিয়ার" against
  //    "ইউডিসি-কাম-ক্যাশিয়ার", "গ্যাস ম্যান" against "গ্যাসম্যান".
  const folded = loose(d);
  const foldHit = table.filter((r) => loose(r.post) === folded);
  if (foldHit.length) {
    return { grade: Math.min(...foldHit.map((r) => r.grade)), how: `folded spelling ("${foldHit[0].post}")` };
  }

  // 5. The export writes alternatives with a slash — "কম্পিউটার
  //    মুদ্রাক্ষরিক/টাইপিস্ট" — so try each side of it.
  if (d.includes("/")) {
    for (const part of d.split("/").map((x) => norm(x)).filter(Boolean)) {
      const hit = table.filter((r) => r.post === part || loose(r.post) === loose(part));
      if (hit.length) {
        return { grade: Math.min(...hit.map((r) => r.grade)), how: `one side of "${d}" ("${hit[0].post}")` };
      }
    }
  }

  // 6. The post list writes alternatives with a slash too:
  //    "ল্যাব বেয়ারার /ল্যাব বাহক".
  const alternate = table.filter((r) => r.post.split("/").map((x) => loose(x)).includes(folded));
  if (alternate.length) {
    return { grade: Math.min(...alternate.map((r) => r.grade)), how: `slash-alternative ("${alternate[0].post}")` };
  }

  // 7. Last resort: the designation appears inside a post name. Named
  //    `substringHits`, not `loose` — a local of that name would shadow the
  //    imported `loose()` for the whole function body.
  const substringHits = table.filter((r) => r.post.includes(d));
  if (substringHits.length) {
    const grades = [...new Set(substringHits.map((r) => r.grade))];
    return {
      grade: Math.min(...grades),
      how: `substring of "${substringHits[0].post}"${grades.length > 1 ? ` (${grades.length} variants)` : ""}`,
    };
  }

  return null;
}
