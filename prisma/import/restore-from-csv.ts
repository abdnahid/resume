/**
 * Restore a database from the Prisma Studio CSV export in `utils/backup/`.
 *
 *     npm run db:restore -- --dry          # parse and check, write nothing
 *     npm run db:restore                   # write, into DATABASE_URL
 *
 * **Why this exists.** On 2026-09-12 the Prisma Postgres account hit a plan
 * limit and every connection began failing with `planLimitReached` — reads
 * included, so `pg_dump` was not available either. What survived was a
 * per-model CSV export taken through the web Studio: 95 files, 76 tables,
 * 14,587 rows. This turns that back into a database.
 *
 * **It is a logical restore, not a physical one**, and the difference matters:
 *
 * - Row values come back. Sequences do not, so every `autoincrement()` is reset
 *   afterwards to `max(id)`; without that the first insert into a restored
 *   table collides with an existing row.
 * - Studio exports a column per *relation* as well as per field — `Account`,
 *   `Employee`, `Application_createdBy` and so on, always empty. They are not
 *   columns and are dropped by name, by consulting the schema rather than by
 *   guessing from the header.
 * - Order is a topological sort over the **required** foreign keys, so a parent
 *   is always written before its children. Nullable ones do not constrain the
 *   order: where a nullable link points at a table written later it is
 *   **deferred** — inserted null and patched in a second pass. That is what
 *   makes `Application ⇄ Payment` restorable at all: an application names the
 *   payment that settled its fee and a payment names the application it was
 *   raised from, so neither can be written first.
 *
 * **It writes into whatever `DATABASE_URL` points at**, which is the point —
 * `prisma db push` a fresh database first, then run this.
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const DRY = process.argv.includes("--dry");
const DIR = path.join(process.cwd(), "utils/backup");

// ── the schema is the authority on what a column is ─────────────────────────

type Field = { name: string; type: string; isList: boolean; isOptional: boolean };
type Model = { name: string; fields: Field[]; fks: { column: string; target: string }[] };

function readSchema(): { models: Map<string, Model>; enums: Set<string> } {
  const src = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const enums = new Set([...src.matchAll(/^enum (\w+) \{/gm)].map((m) => m[1]));
  const modelNames = new Set([...src.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]));
  const models = new Map<string, Model>();

  for (const m of src.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const [, name, body] = m;
    const fields: Field[] = [];
    const fks: { column: string; target: string }[] = [];
    for (const line of body.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("//") || t.startsWith("@@")) continue;
      const f = t.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/);
      if (!f) continue;
      const [, fname, ftype, list, opt] = f;
      // A relation field is not a column; its scalar `fields: [x]` is.
      const rel = t.match(/@relation\([^)]*fields:\s*\[(\w+)\]/);
      if (rel) fks.push({ column: rel[1], target: ftype });
      if (modelNames.has(ftype)) continue;
      fields.push({ name: fname, type: ftype, isList: !!list, isOptional: !!opt });
    }
    models.set(name, { name, fields, fks });
  }
  return { models, enums };
}

// ── CSV, with quoted fields and embedded newlines ───────────────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(cell); cell = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r[0] ?? "") !== "");
}

/**
 * A cell to the value Prisma wants.
 *
 * An empty cell is null, which is right for every nullable column and is why a
 * required column holding one is reported rather than coerced — an empty string
 * silently standing in for a missing number is how a restore looks successful
 * and is not.
 */
function coerce(raw: string, f: Field, enums: Set<string>, problems: string[], where: string) {
  if (raw === "") {
    if (f.isList) return [];
    // **CSV cannot tell an empty string from NULL**, and for a required column
    // only one of them is possible. 120 `Posting.grade` cells are empty and the
    // column is a required `String`, so they were empty strings in the source —
    // reading them as null would refuse a restore over data that is perfectly
    // legal. For any other required type an empty cell really is missing.
    if (!f.isOptional) {
      if (f.type === "String") return "";
      problems.push(`${where}.${f.name} is empty but ${f.type} and not nullable`);
    }
    return null;
  }
  if (f.isList) {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) throw new Error("not an array");
      return arr;
    } catch {
      problems.push(`${where}.${f.name} is not a JSON array: ${raw.slice(0, 40)}`);
      return [];
    }
  }
  switch (f.type) {
    case "Int": {
      const n = Number(raw);
      if (!Number.isInteger(n)) { problems.push(`${where}.${f.name} is not an integer: ${raw}`); return null; }
      return n;
    }
    case "BigInt": return BigInt(raw);
    case "Float": case "Decimal": {
      const n = Number(raw);
      if (!Number.isFinite(n)) { problems.push(`${where}.${f.name} is not a number: ${raw}`); return null; }
      return n;
    }
    case "Boolean": return raw === "true";
    case "DateTime": {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) { problems.push(`${where}.${f.name} is not a date: ${raw}`); return null; }
      return d;
    }
    case "Json": try { return JSON.parse(raw); } catch { return raw; }
    default:
      // String, and every enum — passed through, and an unknown enum member
      // will be refused by the database rather than guessed at here.
      if (enums.has(f.type) || f.type === "String") return raw;
      problems.push(`${where}.${f.name} has unhandled type ${f.type}`);
      return raw;
  }
}

/**
 * Parents before children, over the **required** links only.
 *
 * A required foreign key genuinely constrains the order — the row cannot exist
 * without its parent. A nullable one does not: it can be written as null and
 * filled in afterwards, which is the only way to restore a pair of tables that
 * name each other.
 */
function topoSort(models: Map<string, Model>, present: Set<string>): string[] {
  const out: string[] = [], state = new Map<string, 0 | 1 | 2>();
  const visit = (name: string) => {
    if (state.get(name) === 2 || state.get(name) === 1) return;
    state.set(name, 1);
    const model = models.get(name);
    for (const fk of model?.fks ?? []) {
      const col = model!.fields.find((f) => f.name === fk.column);
      if (col?.isOptional) continue; // deferrable, so it does not constrain order
      if (present.has(fk.target) && fk.target !== name) visit(fk.target);
    }
    state.set(name, 2);
    out.push(name);
  };
  for (const n of present) visit(n);
  return out.filter((n) => present.has(n));
}

async function main() {
  const { models, enums } = readSchema();

  // ── gather the pages of each model ────────────────────────────────────────
  const byModel = new Map<string, { header: string[]; rows: string[][] }>();
  let files = 0;
  for (const file of readdirSync(DIR).sort()) {
    const m = file.match(/^public-(.+?)-selection(?: \(\d+\))?\.csv$/);
    if (!m) continue;
    const model = m[1];
    if (!models.has(model)) continue; // pg_stat_statements and friends
    const rows = parseCsv(readFileSync(path.join(DIR, file), "utf8"));
    if (!rows.length) continue;
    files++;
    const [header, ...data] = rows;
    const cur = byModel.get(model);
    if (!cur) byModel.set(model, { header, rows: data });
    else {
      if (cur.header.join("|") !== header.join("|"))
        console.log(`⚠ ${model}: pages disagree on their columns`);
      cur.rows.push(...data);
    }
  }

  const present = new Set(byModel.keys());
  const order = topoSort(models, present);
  const rank = new Map(order.map((n, i) => [n, i]));
  const problems: string[] = [];

  /**
   * Nullable links pointing at a table written later, per model. Inserted null
   * and patched once everything exists — `Application.applicationFeePaymentId`
   * and `Payment.attachToApplicationId` are the pair that needs it.
   */
  const deferred = new Map<string, string[]>();
  for (const name of order) {
    const model = models.get(name)!;
    const cols = model.fks
      .filter((fk) => present.has(fk.target) && (rank.get(fk.target) ?? -1) > (rank.get(name) ?? 0))
      .filter((fk) => model.fields.find((f) => f.name === fk.column)?.isOptional)
      .map((fk) => fk.column);
    if (cols.length) {
      if (!model.fields.some((f) => f.name === "id"))
        problems.push(`${name} needs ${cols.join(", ")} deferred but has no single \`id\` to patch by`);
      else deferred.set(name, cols);
    }
  }
  if (deferred.size)
    console.log(
      `Deferred links (written null, patched afterwards):\n` +
        [...deferred].map(([m, c]) => `   ${m}.${c.join(", ")}`).join("\n") + "\n",
    );

  // ── shape every row before writing anything ──────────────────────────────
  const payload = new Map<string, Record<string, unknown>[]>();
  for (const name of order) {
    const model = models.get(name)!;
    const { header, rows } = byModel.get(name)!;
    const byName = new Map(model.fields.map((f) => [f.name, f]));
    // Studio exports a column per relation too, always empty. Drop by name.
    const cols = header.map((h) => byName.get(h) ?? null);
    const unknown = header.filter((h, i) => cols[i] === null);
    const out: Record<string, unknown>[] = [];
    for (const [n, r] of rows.entries()) {
      const rec: Record<string, unknown> = {};
      cols.forEach((f, i) => {
        if (!f) return;
        const v = coerce(r[i] ?? "", f, enums, problems, `${name}[${n}]`);
        if (v !== null || f.isOptional) rec[f.name] = v;
      });
      out.push(rec);
    }
    payload.set(name, out);
    const dropped = unknown.length ? `  (dropped ${unknown.length} relation columns)` : "";
    console.log(`  ${name.padEnd(34)} ${String(out.length).padStart(6)} rows${dropped}`);
  }

  console.log(`\n${files} files · ${present.size} models · ${[...payload.values()].reduce((a, r) => a + r.length, 0).toLocaleString()} rows`);
  if (problems.length) {
    console.log(`\n⚠ ${problems.length} value problem(s):`);
    for (const p of problems.slice(0, 25)) console.log("   " + p);
    if (problems.length > 25) console.log(`   … and ${problems.length - 25} more`);
  }

  if (DRY) { console.log("\n--dry: nothing written."); return; }

  // ── write, parents first ─────────────────────────────────────────────────
  console.log(`\nWriting to ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "the database"} …`);
  for (const name of order) {
    const rows = payload.get(name)!;
    if (!rows.length) continue;
    const delegate = (prisma as unknown as Record<string, { createMany: (a: unknown) => Promise<{ count: number }> }>)[
      name.charAt(0).toLowerCase() + name.slice(1)
    ];
    const hold = deferred.get(name) ?? [];
    const toWrite = hold.length
      ? rows.map((r) => {
          const copy = { ...r };
          for (const c of hold) copy[c] = null;
          return copy;
        })
      : rows;
    let written = 0;
    for (let i = 0; i < toWrite.length; i += 500) {
      const r = await delegate.createMany({ data: toWrite.slice(i, i + 500), skipDuplicates: true });
      written += r.count;
    }
    console.log(`  ✓ ${name.padEnd(34)} ${written}/${rows.length}${hold.length ? `  (${hold.join(", ")} deferred)` : ""}`);
  }

  // ── the deferred links, now that both ends exist ─────────────────────────
  for (const [name, cols] of deferred) {
    const delegate = (prisma as unknown as Record<string, { update: (a: unknown) => Promise<unknown> }>)[
      name.charAt(0).toLowerCase() + name.slice(1)
    ];
    let patched = 0;
    for (const r of payload.get(name) ?? []) {
      const data = Object.fromEntries(cols.filter((c) => r[c] != null).map((c) => [c, r[c]]));
      if (!Object.keys(data).length) continue;
      await delegate.update({ where: { id: r.id }, data });
      patched++;
    }
    console.log(`  ✓ ${name}.${cols.join(", ")} filled in on ${patched} rows`);
  }

  // ── sequences ────────────────────────────────────────────────────────────
  // Restored rows carry their own ids, so every autoincrement sequence is still
  // at 1 and the next insert would collide. Nothing warns you: it fails weeks
  // later, on the first row somebody adds by hand.
  console.log(`\nResetting sequences…`);
  let bumped = 0;
  for (const name of order) {
    const model = models.get(name)!;
    const id = model.fields.find((f) => f.name === "id" && f.type === "Int");
    if (!id) continue;
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${name}"', 'id'),
                     COALESCE((SELECT MAX(id) FROM "${name}"), 0) + 1, false)`,
    );
    bumped++;
  }
  console.log(`  ✓ ${bumped} sequences set past their highest id`);
  console.log(`\nDone. Compare counts against utils/backup before trusting it.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
