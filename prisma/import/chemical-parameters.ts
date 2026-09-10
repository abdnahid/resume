/**
 * The Chemical Testing Wing's parameter catalogue → the Phase G tables.
 *
 *     npm run import:chemical-parameters -- --dry            # report, write nothing
 *     npm run import:chemical-parameters -- --file=food      # one file only
 *     npm run import:chemical-parameters
 *
 * Two Word documents, 412 product blocks and 4,339 parameter rows between them
 * — six times the textile file, and the first test of whether the Phase G shape
 * holds across wings. It does: **no schema change was needed.**
 *
 * Five things this reader has to get right, each of which cost a survey to find
 * (the workings are in `docs/BUILD-PLAN.md` under Phase G):
 *
 * 1. **The published list owns the product name.** The wing's own name column is
 *    read for its *standard*, and the name comes from `Product`. Matching on the
 *    number reaches 92% where matching on the name reaches 5%.
 * 2. **The standard's identity is (prefix, number) and never the year.** The
 *    list says `BDS 25:2015 Amendmentment-1:2020` where the wing says
 *    `BDS 25:2015`. Same standard. Requiring the year to agree loses a third of
 *    the file.
 * 3. **The sub-product is the residue.** Take away the serial, the standard and
 *    the listed product name, and what is left is what BSTI actually tests —
 *    `Sweetmeats (Rasogolla)` → product *Sweetmeats*, sub-product *Rasogolla*.
 *    Which is also what turns `Milk Chocolate` and `White Chocolate` into two
 *    sub-products of `Chocolate`.
 * 4. **A row with no fee, no limit and no method is a category title.** It is
 *    not a parameter — it has nothing to charge and nothing to test against — so
 *    it becomes a bracketed qualifier on the rows beneath it:
 *    `Total Plate Count, per gm, Max (Microbiological Requirements)`. This is
 *    also what stops `pH` under *Dye* from overwriting `pH` under *Developer*
 *    on the `(subProductId, nameEn)` key: 42 such collisions become 5.
 * 5. **The remaining 5 are duplicated source rows**, and the wing's own stated
 *    total proves it — Poultry Feed (Layer-4) states 20,000 against a sum of
 *    20,700, and 700 is the repeated Phosphorous row to the taka. They are
 *    dropped, and every dropped row is reported.
 */
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  priceUrgent, URGENT_SOURCE_NOTE, type UrgentFeeSource,
} from "../../lib/labs/urgent-fee";
import path from "node:path";
import { readTables, fillGrid } from "./docx-grid";
import type { LabDiscipline, LimitKind } from "../../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DRY = process.argv.includes("--dry");
const arg = (k: string) => {
  const p = process.argv.find((a) => a.startsWith(`--${k}=`));
  return p ? p.slice(k.length + 3) : null;
};
const ONLY = arg("file");

/**
 * One entry per file, because discipline and provenance come from the file and
 * never from the row (D63). `section` must also appear in `SECTION_FOR_SOURCE`
 * in `prisma/seed-labs.ts`, which refuses to write a routing row for a section
 * it does not know.
 */
const SOURCES = [
  {
    key: "food",
    file: "utils/Chemical-food-param.docx",
    section: "chemical-food",
    discipline: "chemical" as LabDiscipline,
  },
  {
    key: "non-food",
    file: "utils/chemical-non-food-param.docx",
    section: "chemical-non-food",
    discipline: "chemical" as LabDiscipline,
  },
];

/** Header text → column index. Found by header, never by position. */
const HEADERS = {
  serial: /^sl\s*no/i,
  product: /product\s*name/i,
  parameter: /test\s*parameter/i,
  limit: /standard\s*limit/i,
  method: /method/i,
  fee: /testing\s*fee/i,
  normalDays: /duration.*normal/i,
  normalTotal: /total\s*fee.*normal/i,
  urgentDays: /duration.*urgent/i,
  urgentTotal: /total\s*fee.*urgent/i,
} as const;
type ColKey = keyof typeof HEADERS;

function resolveColumns(header: string[]): Record<ColKey, number> {
  const out = {} as Record<ColKey, number>;
  for (const key of Object.keys(HEADERS) as ColKey[]) {
    const i = header.findIndex((h) => HEADERS[key].test(h.replace(/\s*\/\s*/g, " ")));
    if (i < 0) throw new Error(`column "${key}" not found in header: ${header.join(" | ")}`);
    out[key] = i;
  }
  return out;
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);

const subProductSlug = (serial: number, subName: string) =>
  `p${serial}-${slugify(subName)}`.slice(0, 100);

const normalizeMethod = (s: string) => s.replace(/[:\-–—\s]+$/, "").trim();

/** Taka in the file, poisha in the database. Never a float. */
function toPoisha(raw: string): number | null {
  const n = raw.replace(/[^0-9.]/g, "");
  if (!n) return null;
  return Math.round(Number(n) * 100);
}

function toDays(raw: string): number | null {
  const m = raw.match(/\d+/);
  return m ? Number(m[0]) : null;
}

function classifyLimit(raw: string): { kind: LimitKind; refNumber: string | null } {
  const v = raw.trim();
  if (!v) return { kind: "unspecified", refNumber: null };
  if (/^\*?-?\s*text\s*field\s*-?\*?$/i.test(v) || /as\s+declared/i.test(v))
    return { kind: "declared", refNumber: null };
  const ref = v.match(/as\s+per\s+(BDS\s*[0-9:\s-]+)/i);
  if (ref) return { kind: "cross_reference", refNumber: ref[1].replace(/\s+/g, " ").trim() };
  return { kind: "rule", refNumber: null };
}

// ── the standard, and what identifies one ──────────────────────────────────
const STD = /BDS[\s\-/]*((?:[A-Z]{2,4}[\s\-/]*)*?)(\d+)/i;

/** `(prefix, number)`, never the year — see the header note. */
function stdKey(text: string): string | null {
  const m = STD.exec(text ?? "");
  if (!m) return null;
  return `${m[1].replace(/[\s\-/]/g, "").toUpperCase()}${m[2]}`;
}

/** The designation as printed, year and all, for `standardAsPrinted`. */
function stdAsPrinted(text: string): string | null {
  const m = STD.exec(text ?? "");
  if (!m) return null;
  const tail = text.slice(m.index + m[0].length);
  const year = tail.match(/^\s*[:：]\s*\d{4}[^)/]*/);
  return (m[0] + (year ? year[0] : "")).replace(/\s+/g, " ").trim();
}

const norm = (s: string) =>
  s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Every serial shape the two files use, and there are many: `1.`, `4.h)`,
 * `1(1)`, `7.(a)`, `28 a)`, `39a.`, `69.u)21)`. Anchored to the start and
 * requiring a closing `.` or `)` so it cannot bite into a real name.
 */
const SERIAL = /^\s*\d+\s*(?:\.\s*\(\s*[a-z]\s*\)|\(\s*[a-z\d]+\s*\)|[a-z]?\s*[.)]|\.)\s*/i;
const LEAD_LETTER = /^\s*[a-z]\s*[.)]\s*/i;

/**
 * The sub-product is the product cell with everything we already know taken
 * away — the serial, the standard, and the listed product's own name.
 *
 * The removals have to be tried in several shapes, because the wing writes the
 * name loosely: the list's `Suji (Semolina)` appears in the file as plain
 * `Suji`, so removing only the exact listed name leaves `Suji (Small particle
 * grade` behind — the product's name *and* an unclosed bracket. So each
 * candidate is tried with its parentheticals stripped as well, and the bracket
 * repair runs last.
 */
function subProductName(
  cell: string,
  printed: string | null,
  product: { nameEn: string; genericNames: string[] },
): string {
  let s = cell;
  if (printed) s = s.split(printed).join(" ");
  s = s.replace(/\//g, " ");

  // Serials come in half a dozen shapes and sometimes two deep — `100(a).`,
  // `69.u)21)`, `25a)`. Strip until nothing more comes off.
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s.replace(SERIAL, "").replace(LEAD_LETTER, "").replace(/^\s*\d+\s*[,)]\s*/, "");
    if (s === before) break;
  }

  const candidates = new Set<string>();
  for (const n of [product.nameEn, ...product.genericNames]) {
    candidates.add(n);
    const bare = n.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
    if (bare) candidates.add(bare);
  }
  for (const n of [...candidates].sort((a, b) => b.length - a.length))
    s = s.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");

  // An amendment or revision tail is part of the standard, not of the variant,
  // and often sits in its own paragraph where `stdAsPrinted` cannot reach it.
  s = s.replace(/\b(amendment|amd|revision|rev)\b[^,;]*/gi, " ");
  s = s.replace(/\)\s*\(/g, ", ").replace(/\bBDS\b/gi, " ").replace(/\s+/g, " ");

  // Trim the edges *before* repairing brackets, not after: trimming a trailing
  // ")" is what leaves the "(" it belonged to stranded, which is how
  // "(Type-Layer, Starter)" became "(Type-Layer, Starter".
  s = s.replace(/^[\s\-–,:;.]+|[\s\-–,:;.]+$/g, "");
  // A pair wrapping the whole thing says nothing.
  const wrapped = s.match(/^\((.*)\)$/);
  if (wrapped && !wrapped[1].includes("(")) s = wrapped[1].trim();

  // Drop brackets that lost their partner when the name came out.
  let depth = 0;
  let out = "";
  for (const ch of s) {
    if (ch === "(") { depth++; out += ch; continue; }
    if (ch === ")") { if (depth === 0) continue; depth--; out += ch; continue; }
    out += ch;
  }
  if (depth > 0) out = out.replace(/\(/g, " ");

  // Removing the name and the standard leaves punctuation with nothing between
  // it: "(Type-Layer, )" and "( )" and a bare stranded year.
  out = out
    .replace(/,\s*\)/g, ")")
    .replace(/\(\s*,/g, "(")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s*,\s*,\s*/g, ", ")
    .replace(/\s+/g, " ");
  // Brackets are balanced by now, so the closing trim must leave them alone —
  // stripping a trailing ")" here is what stranded the "(" it belonged to.
  out = out.replace(/^[\s\-–,:;.]+|[\s\-–,:;.]+$/g, "");
  if (/^\d{4}$/.test(out)) out = "";
  return (out || product.nameEn).slice(0, 180);
}

type Row = {
  parameter: string; limit: string; method: string;
  feePoisha: number | null; normalDays: number | null; urgentDays: number | null;
  normalTotal: number | null; urgentTotal: number | null;
};
type Block = { cell: string; rows: Row[] };

function parseFile(file: string): { blocks: Block[]; dataRows: number } {
  const tables = readTables(path.resolve(process.cwd(), file));
  if (!tables.length) throw new Error(`${file}: no tables found`);
  const table = tables[0];

  const header = table[0].flatMap((c) => Array(c.span).fill(c.text) as string[]);
  const cols = resolveColumns(header);

  // Fill down every column that carries a block-level fact; never the
  // parameter, limit, method or fee, which are per row and whose blankness is
  // meaningful (a caption row has no fee *because* it is not a test).
  const grid = fillGrid(table.slice(1), {
    carryDown: [cols.serial, cols.product, cols.normalDays, cols.normalTotal, cols.urgentDays, cols.urgentTotal],
  });

  const blocks: Block[] = [];
  let current: Block | null = null;
  for (let i = 0; i < grid.length; i++) {
    const g = grid[i];
    const raw = table[i + 1];
    // A block begins where the product cell is *written*, not where a merge
    // restarts — the wing uses blanks and merges interchangeably.
    const written = raw[1]?.text.trim() ?? "";
    if (written) { current = { cell: written, rows: [] }; blocks.push(current); }
    if (!current) continue;
    current.rows.push({
      parameter: g[cols.parameter]?.trim() ?? "",
      limit: g[cols.limit]?.trim() ?? "",
      method: normalizeMethod(g[cols.method]?.trim() ?? ""),
      feePoisha: toPoisha(g[cols.fee] ?? ""),
      normalDays: toDays(g[cols.normalDays] ?? ""),
      urgentDays: toDays(g[cols.urgentDays] ?? ""),
      normalTotal: toPoisha(g[cols.normalTotal] ?? ""),
      urgentTotal: toPoisha(g[cols.urgentTotal] ?? ""),
    });
  }
  return { blocks, dataRows: grid.length };
}

/** A caption: named, but with nothing to charge and nothing to test against. */
const isCaption = (r: Row) => !!r.parameter && !r.feePoisha && !r.limit && !r.method;

/**
 * Two published totals for one package add up; one published and one absent is
 * the published one. Null + null stays null — an absent total is not a zero,
 * and treating it as one would make an unpublished package look like a free one.
 */
const addStated = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : a + b;

export type Resolved = {
  productId: number; productSerial: number; productName: string;
  /** The file this block came from — provenance, and never inferred (D63). */
  section: string;
  subProduct: string; standard: string | null;
  normalDays: number | null; urgentDays: number | null;
  /** The wing's own stated totals for this package, kept as printed (D99). */
  statedNormalTotal: number | null; statedUrgentTotal: number | null;
  /** What our parsed rows actually sum to. */
  summedNormalTotal: number;
  /** How the urgent fees below were arrived at, and the multiplier if scaled. */
  urgentSource: UrgentFeeSource; multiplier: number | null;
  params: {
    name: string; limit: string; method: string;
    feePoisha: number; urgentFeePoisha: number; ordinal: number;
  }[];
};

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true, serial: true, nameEn: true, genericNames: true,
      standards: { select: { bds: { select: { number: true } } } },
    },
  });

  const byStd = new Map<string, (typeof products)[number]>();
  for (const p of products)
    for (const s of p.standards) {
      const k = stdKey(s.bds.number);
      if (k && !byStd.has(k)) byStd.set(k, p);
    }
  const byName = new Map<string, (typeof products)[number]>();
  for (const p of products)
    for (const n of [p.nameEn, ...p.genericNames]) {
      const k = norm(n);
      if (k && !byName.has(k)) byName.set(k, p);
    }
  // Longest first: "Coconut Oil" must win over "Oil" inside the same cell.
  const containment = [...products.flatMap((p) => [p.nameEn, ...p.genericNames].map((n) => [norm(n), p] as const))]
    .filter(([n]) => n.length > 3)
    .sort((a, b) => b[0].length - a[0].length);

  const resolved: Resolved[] = [];
  const unmatched: { file: string; cell: string }[] = [];
  const dropped: { sub: string; name: string }[] = [];
  const checksum: { sub: string; stated: number; summed: number }[] = [];
  const anomalies: { sub: string; why: string }[] = [];
  let dataRows = 0, captionRows = 0, lumpBlocks = 0;

  for (const src of SOURCES) {
    if (ONLY && src.key !== ONLY) continue;
    const { blocks, dataRows: n } = parseFile(src.file);
    dataRows += n;
    console.log(`\n${src.file}`);
    console.log(`  section ${src.section} (${src.discipline})  blocks ${blocks.length}  rows ${n}`);

    for (const b of blocks) {
      const key = stdKey(b.cell);
      let product = key ? byStd.get(key) : undefined;
      let matchedName: string | null = null;

      if (!product) {
        const bare = norm(b.cell.replace(SERIAL, "").split("(")[0]);
        product = byName.get(bare);
        if (product) matchedName = bare;
      }
      if (!product) {
        const hay = ` ${norm(b.cell)} `;
        const hit = containment.find(([n]) => hay.includes(` ${n} `));
        if (hit) { product = hit[1]; matchedName = hit[0]; }
      }
      if (!product) { unmatched.push({ file: src.key, cell: b.cell }); continue; }

      // The sub-product is what is left over.
      const printed = stdAsPrinted(b.cell);
      const sub = subProductName(b.cell, printed, product);

      const rows = b.rows.filter((r) => r.parameter);
      if (!rows.length || rows.every((r) => !r.feePoisha)) { lumpBlocks++; continue; }

      // Captions qualify the rows beneath them.
      const params: Resolved["params"] = [];
      const seen = new Set<string>();
      let caption: string | null = null;
      for (const r of rows) {
        if (isCaption(r)) {
          caption = r.parameter.replace(/[:：]\s*$/, "").trim();
          captionRows++;
          continue;
        }
        const name = (caption ? `${r.parameter} (${caption})` : r.parameter).slice(0, 300);
        const dupKey = `${name}|${r.limit}|${r.feePoisha}`;
        if (seen.has(dupKey)) { dropped.push({ sub, name }); continue; }
        seen.add(dupKey);

        params.push({
          name, limit: r.limit, method: r.method,
          feePoisha: r.feePoisha ?? 0, urgentFeePoisha: 0, ordinal: params.length,
        });
      }
      if (!params.length) { lumpBlocks++; continue; }

      const head = rows[0];
      const summed = params.reduce((a, p) => a + p.feePoisha, 0);
      if (head.normalTotal && head.normalTotal !== summed)
        checksum.push({ sub, stated: head.normalTotal, summed });

      // **The urgent price is decided per package, not per row** (D99). The
      // package total is the only urgent figure the wing published, so it is
      // the only one that can be checked — and where doubling does not
      // reproduce it, the surcharge is apportioned across the rows so that it
      // does. A block is exactly one published package, which is why this
      // happens here and not after the merge below.
      const priced = priceUrgent({
        normalFees: params.map((p) => p.feePoisha),
        statedUrgentTotal: head.urgentTotal,
        normalDays: head.normalDays,
        urgentDays: head.urgentDays,
      });
      for (const [i, p] of params.entries()) p.urgentFeePoisha = priced.urgentFees[i];
      if (priced.anomaly) anomalies.push({ sub, why: priced.anomaly });

      resolved.push({
        productId: product.id, productSerial: product.serial, productName: product.nameEn,
        section: src.section,
        subProduct: sub, standard: printed,
        normalDays: head.normalDays, urgentDays: head.urgentDays,
        statedNormalTotal: head.normalTotal, statedUrgentTotal: head.urgentTotal,
        summedNormalTotal: summed,
        urgentSource: priced.source, multiplier: priced.multiplier,
        params,
      });
    }
  }

  // Two blocks may resolve to the same (product, sub-product) — the wing lists
  // Coconut Oil twice, once per grade. Merge rather than let the upsert fight.
  const merged = new Map<string, Resolved>();
  for (const r of resolved) {
    const k = `${r.productId}|${r.subProduct.toLowerCase()}`;
    const prior = merged.get(k);
    if (!prior) { merged.set(k, r); continue; }
    const have = new Set(prior.params.map((p) => p.name));
    for (const p of r.params) if (!have.has(p.name)) prior.params.push({ ...p, ordinal: prior.params.length });
    // The wing published a total per block, so two blocks under one
    // sub-product state two halves of one package (Coconut Oil, once per
    // grade). Add them, and recompute the summed figure over what survived the
    // name dedup rather than trusting either block's own.
    prior.statedNormalTotal = addStated(prior.statedNormalTotal, r.statedNormalTotal);
    prior.statedUrgentTotal = addStated(prior.statedUrgentTotal, r.statedUrgentTotal);
    prior.summedNormalTotal = prior.params.reduce((a, p) => a + p.feePoisha, 0);
    // Two blocks priced differently leave the package mixed. Say so rather
    // than picking one: `apportioned` is the weaker claim, so it wins.
    if (prior.urgentSource !== r.urgentSource) {
      prior.urgentSource = "apportioned";
      prior.multiplier = null;
    }
  }
  const subProducts = [...merged.values()];
  const allParams = subProducts.flatMap((s) => s.params);

  console.log(`\n── summary ─────────────────────────────────────────────`);
  console.log(`Data rows         ${dataRows}`);
  console.log(`Products covered  ${new Set(subProducts.map((s) => s.productId)).size} of ${products.length}`);
  console.log(`Sub-products      ${subProducts.length}`);
  console.log(`Parameters        ${allParams.length}`);
  console.log(`Methods           ${new Set(allParams.map((p) => p.method).filter(Boolean)).size}`);
  for (const src of SOURCES)
    console.log(`  ${src.section.padEnd(17)} ${subProducts.filter((s) => s.section === src.section).length} sub-products, ${subProducts.filter((s) => s.section === src.section).reduce((a, s) => a + s.params.length, 0)} parameters`);
  console.log(`Caption rows      ${captionRows} (folded into the names beneath them)`);
  console.log(`Duplicate rows    ${dropped.length} dropped`);
  console.log(`Lump-priced       ${lumpBlocks} blocks skipped (a total, no parameters)`);
  console.log(`Unmatched         ${unmatched.length} blocks (no product in the published list)`);
  const bySource = new Map<UrgentFeeSource, number>();
  for (const s2 of subProducts)
    bySource.set(s2.urgentSource, (bySource.get(s2.urgentSource) ?? 0) + s2.params.length);
  console.log(`Urgent fees       ${allParams.length} parameters, by how each was priced:`);
  for (const [k, n] of [...bySource].sort((a, b) => b[1] - a[1]))
    console.log(`   ${k.padEnd(17)} ${n}  ${URGENT_SOURCE_NOTE[k]}`);
  console.log(`Checksum failures ${checksum.length}  (stated total ≠ sum of its parameters)`);
  const suspect = subProducts.filter((s2) => /^\s*\d/.test(s2.subProduct) || /\(/.test(s2.subProduct) !== /\)/.test(s2.subProduct));
  console.log(`Names to eyeball  ${suspect.length}  (leading digit or an unmatched bracket — run with --names)`);

  if (unmatched.length) {
    console.log(`\nUnmatched blocks — not imported:`);
    for (const u of unmatched) console.log(`  • [${u.file}] ${u.cell.slice(0, 88)}`);
  }
  if (checksum.length) {
    console.log(`\nChecksum failures — imported, but the wing should confirm:`);
    for (const c of checksum.slice(0, 30))
      console.log(`  • ${c.sub.slice(0, 46)}  stated ${c.stated / 100}  summed ${c.summed / 100}`);
    if (checksum.length > 30) console.log(`  … and ${checksum.length - 30} more`);
  }
  if (anomalies.length) {
    console.log(`\nPackages whose own figures do not agree — priced by the 2× rule instead:`);
    for (const a of anomalies) console.log(`  • ${a.sub.slice(0, 46)} — ${a.why}`);
  }
  if (dropped.length) {
    console.log(`\nDuplicate rows dropped:`);
    for (const d of dropped) console.log(`  • ${d.sub.slice(0, 40)} — ${d.name.slice(0, 60)}`);
  }

  console.log(`\n── a sample of what would be written ───────────────────`);
  for (const s of subProducts.slice(0, 3)) {
    console.log(`  ${s.productName}  »  ${s.subProduct}   [${s.standard ?? "no standard"}]  ${s.normalDays}d / ${s.urgentDays}d`);
    for (const p of s.params.slice(0, 4))
      console.log(`      ${p.name.slice(0, 58).padEnd(58)} ${(p.feePoisha / 100).toString().padStart(7)} → ${(p.urgentFeePoisha / 100).toString().padStart(7)}`);
    if (s.params.length > 4) console.log(`      … ${s.params.length - 4} more`);
  }

  if (process.argv.includes("--names")) {
    console.log(`\n── every sub-product name, for review ──────────────────`);
    for (const s2 of subProducts)
      console.log(`  ${s2.productName.slice(0, 42).padEnd(42)} » ${s2.subProduct}`);
  }

  if (DRY) { console.log(`\n--dry: nothing written.`); return; }

  // ── write ────────────────────────────────────────────────────────────────
  // Batched throughout: a round trip to db.prisma.io costs ~half a second, and
  // 4,000 of them is an hour.
  const bdsRows = await prisma.bds.findMany({ select: { id: true, number: true } });
  const bdsByKey = new Map<string, number>();
  for (const b of bdsRows) { const k = stdKey(b.number); if (k && !bdsByKey.has(k)) bdsByKey.set(k, b.id); }
  const resolveBds = (d: string | null) => (d ? bdsByKey.get(stdKey(d) ?? "") ?? null : null);

  const methodNames = [...new Set(allParams.map((p) => p.method).filter(Boolean))];
  const existingMethods = new Map(
    (await prisma.testMethod.findMany({ select: { id: true, slug: true } })).map((m) => [m.slug, m.id]),
  );
  const newMethods = methodNames
    .filter((d) => !existingMethods.has(slugify(d)))
    // Two designations that slugify alike would collide on the unique slug.
    .filter((d, i, a) => a.findIndex((x) => slugify(x) === slugify(d)) === i);
  for (let i = 0; i < newMethods.length; i += 200) {
    await prisma.testMethod.createMany({
      data: newMethods.slice(i, i + 200).map((designation) => ({
        designation, slug: slugify(designation), bdsId: resolveBds(designation),
      })),
      skipDuplicates: true,
    });
  }
  const methodId = new Map(
    (await prisma.testMethod.findMany({ select: { id: true, slug: true } })).map((m) => [m.slug, m.id]),
  );
  console.log(`\n✓ methods       ${methodNames.length} (${newMethods.length} new)`);

  const productIds = [...new Set(subProducts.map((s) => s.productId))];
  const existingSubs = new Map(
    (await prisma.subProduct.findMany({
      where: { productId: { in: productIds } },
      select: { id: true, productId: true, nameEn: true },
    })).map((s) => [`${s.productId}|${s.nameEn}`, s.id]),
  );

  const toCreate = subProducts.filter((s) => !existingSubs.has(`${s.productId}|${s.subProduct}`));
  // The slug is globally unique, so a collision across two products has to be
  // broken rather than left to throw mid-batch.
  const usedSlugs = new Set(
    (await prisma.subProduct.findMany({ select: { slug: true } })).map((s) => s.slug),
  );
  const slugFor = (s: Resolved) => {
    let base = subProductSlug(s.productSerial, s.subProduct);
    let slug = base, n = 2;
    while (usedSlugs.has(slug)) slug = `${base.slice(0, 96)}-${n++}`;
    usedSlugs.add(slug);
    return slug;
  };
  for (let i = 0; i < toCreate.length; i += 100) {
    await prisma.subProduct.createMany({
      data: toCreate.slice(i, i + 100).map((s, j) => ({
        productId: s.productId, nameEn: s.subProduct, slug: slugFor(s),
        standardAsPrinted: s.standard,
        ordinal: i + j,
      })),
      skipDuplicates: true,
    });
  }
  const subId = new Map(
    (await prisma.subProduct.findMany({
      where: { productId: { in: productIds } },
      select: { id: true, productId: true, nameEn: true },
    })).map((s) => [`${s.productId}|${s.nameEn}`, s.id]),
  );
  console.log(`✓ sub-products  ${subProducts.length} (${toCreate.length} new)`);

  const subIds = subProducts
    .map((s) => subId.get(`${s.productId}|${s.subProduct}`))
    .filter((x): x is number => x !== undefined);
  const haveParam = new Set(
    (await prisma.testParameter.findMany({
      where: { subProductId: { in: subIds } },
      select: { subProductId: true, nameEn: true },
    })).map((p) => `${p.subProductId}|${p.nameEn}`),
  );

  const paramRows: {
    subProductId: number; nameEn: string; slug: string; methodId: number | null;
    feePoisha: number; urgentFeePoisha: number; urgentFeeSource: UrgentFeeSource;
    normalDays: number | null; urgentDays: number | null;
    discipline: LabDiscipline;
    sourceSection: string; ordinal: number; limitText: string | null; limitKind: LimitKind;
  }[] = [];
  for (const s of subProducts) {
    const id = subId.get(`${s.productId}|${s.subProduct}`);
    if (id === undefined) continue;
    for (const p of s.params) {
      if (haveParam.has(`${id}|${p.name}`)) continue;
      const c = classifyLimit(p.limit);
      paramRows.push({
        subProductId: id, nameEn: p.name, slug: slugify(p.name),
        methodId: p.method ? methodId.get(slugify(p.method)) ?? null : null,
        feePoisha: p.feePoisha, urgentFeePoisha: p.urgentFeePoisha,
        urgentFeeSource: s.urgentSource,
        // Turnaround belongs to the test (D115); the file states one duration
        // per package, so every test in it inherits that.
        normalDays: s.normalDays, urgentDays: s.urgentDays,
        discipline: "chemical", sourceSection: s.section,
        ordinal: p.ordinal, limitText: p.limit || null, limitKind: c.kind,
      });
    }
  }
  for (let i = 0; i < paramRows.length; i += 500) {
    await prisma.testParameter.createMany({ data: paramRows.slice(i, i + 500), skipDuplicates: true });
    process.stdout.write(`\r  … ${Math.min(i + 500, paramRows.length)}/${paramRows.length} parameters`);
  }
  console.log(`\n✓ parameters    ${allParams.length} (${paramRows.length} new)`);

  // ── the wing's own published figures, kept ────────────────────────────────
  // Written every run, not only when the parameters are new: this is what the
  // recompute divides by (D99) and what makes the 23 open checksum questions
  // answerable in SQL rather than only in a dry run somebody has to re-do.
  // Replaced rather than upserted, because the key is (sub-product, section)
  // and this run is the authority for the sections it just read.
  const sections = SOURCES.filter((x) => !ONLY || x.key === ONLY).map((x) => x.section);
  await prisma.subProductPackageFee.deleteMany({
    where: { sourceSection: { in: sections }, subProductId: { in: subIds } },
  });
  const feeRows = subProducts
    .map((s) => {
      const id = subId.get(`${s.productId}|${s.subProduct}`);
      return id === undefined ? null : {
        subProductId: id, sourceSection: s.section,
        statedNormalFeePoisha: s.statedNormalTotal,
        statedUrgentFeePoisha: s.statedUrgentTotal,
        summedNormalFeePoisha: s.summedNormalTotal,
        turnaroundNormalDays: s.normalDays, turnaroundUrgentDays: s.urgentDays,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  for (let i = 0; i < feeRows.length; i += 500)
    await prisma.subProductPackageFee.createMany({ data: feeRows.slice(i, i + 500), skipDuplicates: true });
  console.log(`✓ package fees  ${feeRows.length}`);

  console.log(`
Next: npm run labs:reconcile -- --dry
  A wing that tests an article as a whole leaves a sub-product named after the
  product itself, which is the same article another wing filed under its real
  variant names. Reconciling folds one into the other; until it runs, an
  applicant can pick a package that is tested for half the standard.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
