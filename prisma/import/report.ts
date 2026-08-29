/**
 * Dry run: read `utils/employee_bio.json`, classify every record, and write a
 * report. **Touches no database.**
 *
 * Run with: npm run import:report
 *
 * Read the report before running the import. It is the only chance to catch a
 * bad office mapping or a wrong grade before 555 people are created with it.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { loadPostGrades } from "./grades";
import {
  dedupe,
  ENTRY_CODES,
  normaliseRecord,
  type NormalisedEmployee,
  type Rejection,
} from "./employee-bio";
import officesData from "../../utils/offices.json";

const OFFICE_NAME = new Map<number, string>(
  (officesData as { id: number; nameEn: string }[]).map((o) => [o.id, o.nameEn]),
);

function bar(label: string) {
  return `\n${"─".repeat(78)}\n${label}\n${"─".repeat(78)}`;
}

function main() {
  const src = path.join(process.cwd(), "utils", "employee_bio.json");
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const raw: any[] = JSON.parse(fs.readFileSync(src, "utf8"));
  const table = loadPostGrades();

  const { kept, duplicates } = dedupe(raw);
  const employees: NormalisedEmployee[] = [];
  const rejections: Rejection[] = [];

  for (const r of kept) {
    const res = normaliseRecord(r, table);
    if (res.ok) employees.push(res.employee);
    else rejections.push(res.rejection);
  }

  const out: string[] = [];
  out.push("BSTI employee import — dry run");
  out.push(`source   utils/employee_bio.json (${raw.length} records)`);
  out.push(`grades   utils/grades.ods (${table.length} sanctioned posts)`);
  out.push(`run at   ${new Date().toISOString()}`);
  out.push("");
  out.push("NOTHING WAS WRITTEN TO THE DATABASE.");

  // ── Summary ──
  out.push(bar("SUMMARY"));
  out.push(`  records in file        ${raw.length}`);
  out.push(`  exact duplicates       ${duplicates.length}${duplicates.length ? ` (${duplicates.join(", ")})` : ""}`);
  out.push(`  rejected               ${rejections.length}`);
  out.push(`  would import           ${employees.length}`);

  const byCat = new Map<string, number>();
  for (const e of employees) byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
  out.push("");
  out.push("  by category");
  for (const [k, v] of [...byCat].sort((a, b) => b[1] - a[1])) {
    out.push(`    ${k.padEnd(14)} ${v}`);
  }

  // ── Rejections, grouped ──
  const byReason = new Map<string, Rejection[]>();
  for (const r of rejections) {
    byReason.set(r.reason, [...(byReason.get(r.reason) ?? []), r]);
  }
  out.push(bar("REJECTED — and why"));
  for (const [reason, list] of [...byReason].sort((a, b) => b[1].length - a[1].length)) {
    out.push(`\n  ${reason} — ${list.length}`);
    for (const r of list.slice(0, 400)) {
      out.push(`    ${r.id.padEnd(13)} ${(r.nameEn || "").slice(0, 34).padEnd(35)} ${r.detail ?? ""}`);
    }
  }

  // ── Offices ──
  out.push(bar("OFFICE MAPPING — check these"));
  const byOffice = new Map<number, number>();
  for (const e of employees) byOffice.set(e.officeId, (byOffice.get(e.officeId) ?? 0) + 1);
  for (const [id, n] of [...byOffice].sort((a, b) => b[1] - a[1])) {
    out.push(`  ${String(n).padStart(4)}  office ${String(id).padStart(2)}  ${OFFICE_NAME.get(id) ?? "?"}`);
  }
  const empty = [...OFFICE_NAME.keys()].filter((id) => !byOffice.has(id));
  out.push(`\n  offices receiving nobody: ${empty.length ? empty.map((i) => `${i} ${OFFICE_NAME.get(i)}`).join(", ") : "none"}`);

  // ── Entry codes ──
  out.push(bar("ENTRY CODE (digits 5-7 of the id)"));
  const byCode = new Map<string, Map<string, number>>();
  for (const e of employees) {
    const m = byCode.get(e.parsed.code) ?? new Map<string, number>();
    m.set(e.category, (m.get(e.category) ?? 0) + 1);
    byCode.set(e.parsed.code, m);
  }
  for (const [code, cats] of [...byCode].sort()) {
    const total = [...cats.values()].reduce((a, b) => a + b, 0);
    const split = [...cats].map(([k, v]) => `${k} ${v}`).join(", ");
    out.push(`  ${code}  ${String(total).padStart(4)}  ${(ENTRY_CODES[code] ?? "?").padEnd(38)} ${split}`);
  }

  // ── Grades ──
  out.push(bar("GRADE RESOLUTION — check these"));
  const gradeCount = new Map<string, number>();
  for (const e of employees) {
    const key = e.grade === null ? "no grade" : `grade ${e.grade}`;
    gradeCount.set(key, (gradeCount.get(key) ?? 0) + 1);
  }
  const gradeKeys = [...gradeCount.keys()].sort((a, b) => {
    const na = Number(a.replace(/\D/g, "")) || 99;
    const nb = Number(b.replace(/\D/g, "")) || 99;
    return na - nb;
  });
  for (const k of gradeKeys) out.push(`  ${k.padEnd(12)} ${gradeCount.get(k)}`);

  out.push("\n  how each designation resolved:");
  const byDesig = new Map<string, { grade: number | null; how: string | null; n: number; cat: string }>();
  for (const e of employees) {
    const key = `${e.designationBn ?? "(none)"} | ${e.wing ?? ""}`;
    const cur = byDesig.get(key);
    if (cur) cur.n++;
    else byDesig.set(key, { grade: e.grade, how: e.gradeHow, n: 1, cat: e.category });
  }
  for (const [key, v] of [...byDesig].sort((a, b) => b[1].n - a[1].n)) {
    const [desig, wing] = key.split(" | ");
    out.push(
      `    ${String(v.n).padStart(4)}  ${String(v.grade ?? "—").padStart(3)}  ${v.cat.padEnd(12)} ${desig.slice(0, 42).padEnd(43)} ${(wing || "").slice(0, 24).padEnd(25)} ${v.how ?? "UNRESOLVED"}`,
    );
  }

  const ungraded = employees.filter((e) => e.grade === null && e.category !== "daily_basis");
  out.push(`\n  NOT daily-basis but no grade resolved: ${ungraded.length}`);
  for (const e of ungraded) {
    out.push(`    ${e.id}  ${(e.nameEn || "").slice(0, 30).padEnd(31)} ${e.designationBn ?? ""} / ${e.wing ?? ""}`);
  }

  // ── Field completeness ──
  out.push(bar("FIELD COMPLETENESS across the imported"));
  const fields: (keyof NormalisedEmployee)[] = [
    "nameBn", "fatherNameBn", "motherNameBn", "bloodGroup", "nid", "email",
    "mobileHome", "designationBn", "wing", "dateOfJoining", "postRetirementLeave",
    "bankAccountNo", "tinNo", "emergencyName",
  ];
  for (const f of fields) {
    const n = employees.filter((e) => e[f] !== null && e[f] !== "").length;
    out.push(`  ${String(f).padEnd(22)} ${String(n).padStart(4)}/${employees.length}`);
  }

  // ── Sample ──
  out.push(bar("SAMPLE — first 5 as they would be written"));
  for (const e of employees.slice(0, 5)) {
    out.push(`\n  ${e.id}  ${e.nameEn}  (${e.nameBn})`);
    out.push(`    category ${e.category} · grade ${e.grade ?? "—"} · office ${e.officeId} ${OFFICE_NAME.get(e.officeId)}`);
    out.push(`    joined ${e.parsed.year} code ${e.parsed.code} · dob ${e.dateOfBirth} · ${e.gender} · ${e.maritalStatus}`);
    out.push(`    ${e.designationBn ?? "?"} / ${e.wing ?? "?"} · grade via: ${e.gradeHow ?? "—"}`);
  }

  const dest = path.join(process.cwd(), "utils", "import-report.txt");
  fs.writeFileSync(dest, out.join("\n") + "\n");

  console.log(out.slice(0, 40).join("\n"));
  console.log(`\n…full report written to ${path.relative(process.cwd(), dest)} (${out.length} lines)`);
}

main();
