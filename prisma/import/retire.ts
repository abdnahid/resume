/**
 * Remove the demo employees the HR export does not contain.
 *
 * Run with: npm run import:retire
 *
 * Deliberately separate from the import, and deliberately last. Deleting an
 * `Employee` cascades to their postings, education, ID cards, fixations, cases
 * and processed salary, so this refuses to run unless the roster can still be
 * administered without them — see the guards below.
 */
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "node:fs";
import * as path from "node:path";
import "dotenv/config";
import { loadPostGrades } from "./grades";
import { dedupe, normaliseRecord } from "./employee-bio";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const SUPERADMIN_ID = "20226010105";

async function main() {
  const dryRun = !process.argv.includes("--yes");

  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "utils", "employee_bio.json"), "utf8"),
  ) as unknown[];
  const table = loadPostGrades();
  const { kept } = dedupe(raw);
  const importedIds = new Set<string>();
  for (const r of kept) {
    const res = normaliseRecord(r, table);
    if (res.ok) importedIds.add(res.employee.id);
  }

  // ── Guard 1: the superadmin must have survived the import ────────────────
  const su = await p.employee.findUnique({
    where: { id: SUPERADMIN_ID },
    include: { user: { select: { role: true } } },
  });
  if (!su || su.user?.role !== "superadmin") {
    throw new Error(
      `${SUPERADMIN_ID} is not on the roster as a superadmin. Run the import first — deleting the demo accounts now would leave nobody able to administer the system.`,
    );
  }

  const stale = await p.employee.findMany({
    where: { id: { notIn: [...importedIds] } },
    include: {
      user: { select: { id: true, role: true } },
      fixations: { select: { id: true } },
      cases: { select: { id: true } },
      salaryProcesses: { select: { id: true } },
      idCards: { select: { id: true } },
    },
    orderBy: { id: "asc" },
  });

  // ── Guard 2: never delete something carrying real payroll history ────────
  const carrying = stale.filter(
    (s) => s.fixations.length || s.cases.length || s.salaryProcesses.length,
  );
  if (carrying.length) {
    console.log("These are not in the export but carry payroll or case history:");
    for (const c of carrying) {
      console.log(
        `  ${c.id}  ${c.nameEn}  fixations=${c.fixations.length} cases=${c.cases.length} months=${c.salaryProcesses.length}`,
      );
    }
    throw new Error(
      "Refusing to delete employees with payroll history. Move or remove that history first, deliberately.",
    );
  }

  const targets = stale.filter((s) => s.id !== SUPERADMIN_ID);

  console.log(`${targets.length} employees are on the roster but not in the export.\n`);
  const byRole = new Map<string, number>();
  for (const t of targets) {
    const r = t.user?.role ?? "-";
    byRole.set(r, (byRole.get(r) ?? 0) + 1);
  }
  console.log("  by role:", [...byRole].map(([k, v]) => `${k} ${v}`).join(" · "));
  console.log(`  ID cards that would go with them: ${targets.reduce((n, t) => n + t.idCards.length, 0)}`);

  if (dryRun) {
    console.log("\n  DRY RUN — nothing deleted. Re-run with --yes to remove them.");
    for (const t of targets.slice(0, 30)) {
      console.log(`    ${t.id}  ${t.nameEn.slice(0, 34).padEnd(35)} ${t.user?.role ?? "-"}`);
    }
    if (targets.length > 30) console.log(`    …and ${targets.length - 30} more`);
    return;
  }

  // Back it up first — the database has no migration history and no backup.
  const backup = path.join(process.cwd(), "utils", `retired-employees-${Date.now()}.json`);
  const full = await p.employee.findMany({ where: { id: { in: targets.map((t) => t.id) } } });
  fs.writeFileSync(backup, JSON.stringify(full, null, 2));
  console.log(`\n  backup written: ${path.relative(process.cwd(), backup)}`);

  const userIds = targets.map((t) => t.user?.id).filter((x): x is string => Boolean(x));
  const result = await p.$transaction(async (tx) => {
    // Employee cascades from User, so removing the user is enough — but be
    // explicit so the counts are honest.
    const emps = await tx.employee.deleteMany({ where: { id: { in: targets.map((t) => t.id) } } });
    const users = await tx.user.deleteMany({ where: { id: { in: userIds } } });
    return { employees: emps.count, users: users.count };
  });

  console.log(`  deleted: ${result.employees} employees, ${result.users} users`);
  console.log(`\n  roster now: ${await p.employee.count()} employees, ${await p.user.count()} users`);
}

main()
  .catch((e) => {
    console.error(`\nFAILED: ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
