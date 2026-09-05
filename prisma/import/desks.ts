/**
 * Places employees on organogram posts — the desks a file can be handed to.
 *
 *   npm run import:desks -- --dry     report only, no writes
 *   npm run import:desks              assign, and write the report
 *
 * **Why this is not part of the employee import.** The HR export says which
 * office and which wing someone belongs to; it does not name a sanctioned post.
 * The organogram does. Joining the two is a matching problem with judgement in
 * it, so it is a separate, reviewable step that writes a report of every
 * assignment it makes.
 *
 * **Matching, in order:**
 *   office → the organogram root for that office (head office is its wings)
 *   wing   → the unit inside that root whose Bengali name matches
 *   grade  → the posts in that unit's subtree at the employee's grade
 *   title  → among those, the one whose name best matches the employee's own
 *            designation, with a seat free under `sanctionedCount`
 *
 * **Grade alone is not enough to pick a post.** সিএম ঢাকা has Field Officer (CM)
 * and Assistant Director (CM) both at grade 9; taking whichever came first put
 * an Assistant Director on a Field Officer's desk. Seniority for routing reads
 * the *employee's* grade, so nothing broke — but the desk a person is shown
 * sitting at should be the job they hold.
 *
 * **The two systems spell the same section differently**, with typos on both
 * sides — the export writes টেক্সটাইল and the organogram ট্রেক্সটাইল, the export
 * ব্যাকটেরিলিওজি and the organogram ব্যাকটেরিওলজি. So the wing is matched by edit
 * distance, and anything below `EXACT` is reported as a close match for a human
 * to read rather than being presented as certain.
 *
 * **Daily-basis workers are skipped on purpose.** They are not on the
 * sanctioned strength — there is no post for them to hold — and giving them one
 * would overstate the establishment.
 *
 * Idempotent: only ever fills a null `orgPostId`, and never moves someone who
 * already has a desk.
 */
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const DRY = process.argv.includes("--dry");

/** Below this a match is reported as needing an eye; below `FLOOR` it is not made. */
const EXACT = 0.999;
const FLOOR = 0.72;

/** The organogram writes Barisal; the office register writes Barishal. */
const CITY_ALIASES: Record<string, string> = { barishal: "barisal" };

/** Words every unit name carries, which therefore distinguish nothing. */
const GENERIC = ["উইং", "বিভাগ", "শাখা", "সেল", "অধিশাখা", "নির্বাহী"];

const norm = (s: string) => {
  let t = s.replace(/[\s(),]/g, "");
  for (const g of GENERIC) t = t.split(g).join("");
  return t;
};

/** Levenshtein similarity, 0..1. The spellings differ by a conjunct or two. */
function sim(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

type Row = {
  employeeId: string; name: string; office: string; wing: string;
  grade: string; unit: string; post: string; postId: number; score: number;
};

async function main() {
  const units = await prisma.orgUnit.findMany({
    select: { id: true, nameEn: true, nameBn: true, parentId: true, category: true },
  });
  const kids = new Map<number | null, number[]>();
  for (const u of units) {
    if (!kids.has(u.parentId)) kids.set(u.parentId, []);
    kids.get(u.parentId)!.push(u.id);
  }
  const byId = new Map(units.map((u) => [u.id, u]));
  const subtree = (root: number) => {
    const out: number[] = [];
    const walk = (id: number) => { out.push(id); for (const c of kids.get(id) ?? []) walk(c); };
    walk(root);
    return out;
  };
  const roots = units.filter((u) => u.parentId === null);

  const offices = await prisma.office.findMany({ select: { id: true, nameEn: true, type: true } });
  const officeName = new Map(offices.map((o) => [o.id, o.nameEn]));
  const officeRoot = new Map<number, number | null>();
  for (const o of offices) {
    if (o.type === "head") { officeRoot.set(o.id, null); continue; }
    if (o.type === "dmi") {
      officeRoot.set(o.id, roots.find((r) => r.nameEn.includes("DMI"))?.id ?? null);
      continue;
    }
    const city0 = o.nameEn.split(",").pop()!.trim().toLowerCase();
    const city = CITY_ALIASES[city0] ?? city0;
    officeRoot.set(o.id, roots.find((r) => r.nameEn.toLowerCase() === city)?.id ?? null);
  }
  const orphanOffices = offices.filter((o) => o.type !== "head" && !officeRoot.get(o.id));

  const posts = await prisma.orgPost.findMany({
    select: {
      id: true, nameEn: true, nameBn: true, grade: true, sanctionedCount: true, unitId: true,
      _count: { select: { employees: true } },
    },
  });
  const postsByUnit = new Map<number, typeof posts>();
  for (const q of posts) {
    if (!postsByUnit.has(q.unitId)) postsByUnit.set(q.unitId, []);
    postsByUnit.get(q.unitId)!.push(q);
  }
  // Seats already taken. 54 posts are over their sanctioned count from an
  // earlier seeding that did not check — those simply offer nothing here.
  const free = new Map(posts.map((q) => [q.id, q.sanctionedCount - q._count.employees]));

  const deskless = await prisma.employee.findMany({
    where: { orgPostId: null },
    select: {
      id: true, nameEn: true, officeId: true, wing: true, grade: true, category: true,
      designationEn: true, designationBn: true,
    },
    orderBy: { id: "asc" },
  });

  const exact: Row[] = [];
  const close: Row[] = [];
  const skipped = new Map<string, { n: number; who: string[] }>();
  const miss = (why: string, who: string) => {
    if (!skipped.has(why)) skipped.set(why, { n: 0, who: [] });
    const s = skipped.get(why)!;
    s.n++;
    if (s.who.length < 40) s.who.push(who);
  };

  for (const e of deskless) {
    const who = `${e.id}  ${e.nameEn.slice(0, 30).padEnd(30)} ${(officeName.get(e.officeId) ?? "?").split(",").pop()!.trim().padEnd(12)} ${e.wing ?? "—"} g${e.grade ?? "—"}`;
    if (e.category === "daily_basis") { miss("daily basis — not on the sanctioned strength", who); continue; }
    if (!e.grade) { miss("no grade", who); continue; }
    if (!e.wing) { miss("no wing recorded in the export", who); continue; }

    const root = officeRoot.get(e.officeId);
    if (root === undefined) { miss("office has no organogram root", who); continue; }
    const scope =
      root === null
        ? roots.filter((r) => r.category === "wing").flatMap((r) => subtree(r.id))
        : subtree(root);

    const w = norm(e.wing);
    let best: { id: number; score: number } | null = null;
    for (const id of scope) {
      const n = norm(byId.get(id)!.nameBn);
      const score = n === w ? 1 : n.includes(w) || w.includes(n) ? 0.95 : sim(n, w);
      if (!best || score > best.score) best = { id, score };
    }
    if (!best || best.score < FLOOR) { miss("wing matches no unit in that office", who); continue; }

    const candidates = subtree(best.id)
      .flatMap((id) => postsByUnit.get(id) ?? [])
      .filter((q) => q.grade === e.grade);
    if (candidates.length === 0) { miss("no post at that grade in that unit", who); continue; }

    // Prefer the post that matches what they actually are. `designationEn`
    // sometimes holds Bengali, so both sides are compared both ways.
    const titles = [e.designationEn, e.designationBn].filter(Boolean).map((x) => norm(x!));
    const titleScore = (q: (typeof candidates)[number]) =>
      titles.length === 0
        ? 0
        : Math.max(...titles.flatMap((t) => [sim(norm(q.nameEn), t), sim(norm(q.nameBn), t)]));
    const seat = candidates
      .filter((q) => (free.get(q.id) ?? 0) > 0)
      .sort((a, b) => titleScore(b) - titleScore(a))[0];
    if (!seat) { miss("every post at that grade is full", who); continue; }

    free.set(seat.id, free.get(seat.id)! - 1);
    const row: Row = {
      employeeId: e.id, name: e.nameEn, office: officeName.get(e.officeId) ?? "?",
      wing: e.wing, grade: e.grade, unit: byId.get(best.id)!.nameBn,
      post: seat.nameEn, postId: seat.id, score: best.score,
    };
    (best.score >= EXACT ? exact : close).push(row);
  }

  const lines: string[] = [];
  const say = (s = "") => { lines.push(s); console.log(s); };
  const rule = () => say("─".repeat(78));

  say(`desk assignment — ${new Date().toISOString()}`);
  say(DRY ? "NOTHING WAS WRITTEN TO THE DATABASE." : "");
  rule();
  say(`  employees without a desk   ${deskless.length}`);
  say(`  exact wing match           ${exact.length}`);
  say(`  close wing match           ${close.length}  ← read these`);
  say(`  left without a desk        ${deskless.length - exact.length - close.length}`);
  if (orphanOffices.length) say(`  offices with no organogram root: ${orphanOffices.map((o) => o.nameEn).join(", ")}`);
  rule();
  say("LEFT WITHOUT A DESK — and why");
  rule();
  for (const [why, s] of [...skipped].sort((a, b) => b[1].n - a[1].n)) {
    say(`  ${why} — ${s.n}`);
    s.who.forEach((x) => say(`    ${x}`));
    if (s.n > s.who.length) say(`    …and ${s.n - s.who.length} more`);
    say();
  }
  rule();
  say("CLOSE MATCHES — the two systems spell these differently");
  rule();
  for (const r of close)
    say(`  ${r.score.toFixed(2)}  ${r.employeeId}  ${r.name.slice(0, 28).padEnd(28)} "${r.wing}" → "${r.unit}" / ${r.post}`);
  rule();
  say("EXACT MATCHES");
  rule();
  for (const r of exact)
    say(`  ${r.employeeId}  ${r.name.slice(0, 28).padEnd(28)} "${r.wing}" → "${r.unit}" / ${r.post}`);

  const out = path.join(process.cwd(), "utils", "desk-assignment-report.txt");
  fs.writeFileSync(out, lines.join("\n") + "\n");
  console.log(`\n…report written to ${out}`);

  if (DRY) { console.log("--dry: no writes."); return; }

  // Guarded on `orgPostId: null`, so a re-run cannot move anyone who has since
  // been placed by hand.
  let written = 0;
  for (const r of [...exact, ...close]) {
    const res = await prisma.employee.updateMany({
      where: { id: r.employeeId, orgPostId: null },
      data: { orgPostId: r.postId },
    });
    written += res.count;
  }
  console.log(`✓ desks assigned  ${written}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
