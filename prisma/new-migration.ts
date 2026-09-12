/**
 * Write the next migration from the difference between the live database and
 * `schema.prisma`. **It does not apply it.**
 *
 *     npm run db:migration -- add-lab-notes
 *     # read prisma/migrations/<stamp>_add-lab-notes/migration.sql
 *     npm run db:deploy
 *
 * **Why not `prisma migrate dev`.** That command is built for a throwaway
 * development database: it can decide the database has drifted and offer to
 * reset it, and it needs a shadow database to replay history into. This project
 * has **one** database, shared by both machines, holding 731 real employees and
 * a live payroll. Nothing here should be able to drop it, and nothing here
 * should need a second one.
 *
 * So the split is generate → read → apply, which is the same discipline as the
 * `--dry` on every importer: the SQL is a file somebody looks at before it runs.
 *
 * It **refuses while a migration is pending**, because the diff is taken
 * against the live database — if an earlier migration has not been applied, its
 * changes would be written into this one as well and then applied twice.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const name = process.argv.slice(2).find((a) => !a.startsWith("-"));
if (!name) {
  console.error("Name the migration: npm run db:migration -- add-lab-notes");
  process.exit(1);
}
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const px = (args: string[]) =>
  execFileSync("npx", ["prisma", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// ── nothing pending ─────────────────────────────────────────────────────────
let status = "";
try {
  status = px(["migrate", "status"]);
} catch (e) {
  status = String((e as { stdout?: string }).stdout ?? e);
}
if (!/Database schema is up to date/.test(status)) {
  console.error(
    "Refusing: the database is not up to date with the migrations already in\n" +
      "prisma/migrations. Run `npm run db:deploy` first — otherwise this diff\n" +
      "would repeat their changes and apply them twice.\n\n" +
      status.split("\n").filter(Boolean).slice(-6).join("\n"),
  );
  process.exit(1);
}

// ── the difference ──────────────────────────────────────────────────────────
const sql = px([
  "migrate", "diff",
  "--from-config-datasource",
  "--to-schema", "prisma/schema.prisma",
  "--script",
]).trim();

if (!sql || /^-- This is an empty migration/i.test(sql)) {
  console.log("No difference between the database and schema.prisma — nothing to write.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const dir = path.join("prisma", "migrations", `${stamp}_${slug}`);
if (existsSync(dir)) { console.error(`${dir} already exists.`); process.exit(1); }
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "migration.sql"), sql + "\n");

console.log(`${dir}/migration.sql\n`);
console.log(sql.length > 4000 ? sql.slice(0, 4000) + `\n… (${sql.split("\n").length} lines)` : sql);

// The warnings worth reading twice, called out rather than left in the middle
// of two thousand lines of DDL.
const destructive = sql
  .split("\n")
  .filter((l) => /DROP (TABLE|COLUMN)|DROP NOT NULL|SET NOT NULL|DROP CONSTRAINT/i.test(l));
if (destructive.length) {
  console.log(`\n⚠ ${destructive.length} line(s) that can lose data or fail on existing rows:`);
  for (const l of destructive.slice(0, 15)) console.log("   " + l.trim());
  if (destructive.length > 15) console.log(`   … and ${destructive.length - 15} more`);
}

console.log(`\nRead it, then: npm run db:deploy`);
