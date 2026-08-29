/**
 * Import employees from `utils/employee_bio.json`.
 *
 * Run with: npm run import:employees
 *
 * **Upserts; never deletes.** Employees already on the roster are updated in
 * place, which is what keeps TAPAS SARKER's fixations, case and processed month
 * attached through the reseed. Demo accounts the file does not mention are left
 * alone here and removed by a separate, deliberate step — see
 * `npm run import:retire` — so there is never a moment where nobody can
 * administer the system.
 *
 * Read `utils/import-report.txt` first. This writes what that describes.
 */
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import "dotenv/config";
import { loadPostGrades } from "./grades";
import { dedupe, normaliseRecord, type NormalisedEmployee } from "./employee-bio";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** The account that gets `superadmin`, so the roster can be administered. */
const SUPERADMIN_ID = "20226010105";

/** Still the shared default. Flagged in the plan as an open item before launch. */
const DEFAULT_PASSWORD = "bsti@123";

/**
 * better-auth needs a valid address, and most staff have none on file, so a
 * placeholder is synthesised the same way client mobile sign-ups do it (D16).
 * `displayEmail()` hides these; never mail one.
 */
function placeholderEmail(id: string): string {
  return `${id}@employee.bsti.invalid`;
}

/**
 * `User.email` is unique, so an address two people share can only go to one of
 * them. Four pairs on the roster share a real address; rather than pick a
 * winner, everyone in a colliding set gets a placeholder and keeps the real
 * address on `Employee.email`, which is only a contact field.
 */
function loginEmails(employees: NormalisedEmployee[]): Map<string, string> {
  const seen = new Map<string, number>();
  for (const e of employees) {
    if (!e.email) continue;
    const k = e.email.toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  for (const e of employees) {
    const k = e.email?.toLowerCase();
    out.set(e.id, k && seen.get(k) === 1 ? e.email! : placeholderEmail(e.id));
  }
  return out;
}

async function main() {
  const src = path.join(process.cwd(), "utils", "employee_bio.json");
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const raw: any[] = JSON.parse(fs.readFileSync(src, "utf8"));
  const table = loadPostGrades();
  const { kept } = dedupe(raw);

  const employees: NormalisedEmployee[] = [];
  for (const r of kept) {
    const res = normaliseRecord(r, table);
    if (res.ok) employees.push(res.employee);
  }
  const logins = loginEmails(employees);
  const shared = employees.filter((e) => e.email && logins.get(e.id) !== e.email).length;
  console.log(`Importing ${employees.length} employees…`);
  if (shared) {
    console.log(`  ${shared} share an address with someone else — those get a placeholder login email.\n`);
  }

  const password = await hashPassword(DEFAULT_PASSWORD);
  const now = new Date();

  const before = new Set((await p.employee.findMany({ select: { id: true } })).map((e) => e.id));

  let created = 0;
  let updated = 0;
  const failures: { id: string; error: string }[] = [];

  for (const e of employees) {
    const userId = `user_${e.id}`;
    try {
      await p.$transaction(async (tx) => {
        // The user first — Employee.userId is required and unique.
        await tx.user.upsert({
          where: { id: userId },
          update: {
            name: e.nameBn || e.nameEn,
            username: e.id,
            // Role is deliberately not touched on update: roles are assigned in
            // the app, and an import must not silently demote an administrator.
          },
          create: {
            id: userId,
            name: e.nameBn || e.nameEn,
            email: logins.get(e.id)!,
            emailVerified: false,
            username: e.id,
            role: "employee",
            accountType: "INTERNAL",
            createdAt: now,
            updatedAt: now,
          },
        });

        await tx.account.upsert({
          where: { id: `acc_${e.id}` },
          update: {},
          create: {
            id: `acc_${e.id}`,
            accountId: e.id,
            providerId: "credential",
            userId,
            password,
            createdAt: now,
            updatedAt: now,
          },
        });

        const data = {
          nameEn: e.nameEn || e.nameBn,
          nameBn: e.nameBn || e.nameEn,
          fatherNameEn: e.fatherNameEn,
          fatherNameBn: e.fatherNameBn,
          motherNameEn: e.motherNameEn,
          motherNameBn: e.motherNameBn,
          dateOfBirth: e.dateOfBirth,
          gender: e.gender,
          maritalStatus: e.maritalStatus,
          bloodGroup: (e.bloodGroup ?? null) as never,
          nid: e.nid,
          nationality: e.nationality,
          email: e.email,
          mobileHome: e.mobileHome,
          mobileOffice: e.mobileOffice,
          designationEn: e.designationEn,
          designationBn: e.designationBn,
          wing: e.wing,
          // Grade is a string column; daily-basis staff keep it null.
          grade: e.grade === null ? null : String(e.grade),
          category: e.category,
          dateOfJoining: e.dateOfJoining,
          postRetirementLeave: e.postRetirementLeave,
          bankAccountNo: e.bankAccountNo,
          bankBranch: e.bankBranch,
          tinNo: e.tinNo,
          emergencyName: e.emergencyName,
          emergencyRelation: e.emergencyRelation,
          emergencyMobile: e.emergencyMobile,
          officeId: e.officeId,
        };

        await tx.employee.upsert({
          where: { id: e.id },
          update: data,
          create: { id: e.id, userId, ...data },
        });
      });

      if (before.has(e.id)) updated++;
      else created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Prisma's message is multi-line and starts blank; keep the first line
      // that actually says something.
      const first = msg.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? msg;
      failures.push({ id: e.id, error: first });
    }
  }

  console.log(`  created  ${created}`);
  console.log(`  updated  ${updated}`);
  if (failures.length) {
    console.log(`  FAILED   ${failures.length}`);
    for (const f of failures.slice(0, 20)) console.log(`    ${f.id}  ${f.error}`);
  }

  // ── Postings ──────────────────────────────────────────────────────────────
  // `employeesOfOffice()` prefers a live posting over `Employee.officeId`, so
  // demo postings would keep people in the wrong office's payroll. Rebuild one
  // current posting per imported employee from the file's office.
  const importedIds = employees.map((e) => e.id);
  const removed = await p.posting.deleteMany({ where: { employeeId: { in: importedIds } } });
  let postings = 0;
  for (const e of employees) {
    await p.posting.create({
      data: {
        employeeId: e.id,
        officeId: e.officeId,
        status: "active",
        type: "initial",
        // `Posting.grade` is a required string. Daily-basis staff have no
        // grade, so they carry an empty one rather than a fabricated number.
        grade: e.grade === null ? "" : String(e.grade),
        joinedAt: e.dateOfJoining ?? `01-01-${e.parsed.year}`,
        relievedAt: null,
      },
    });
    postings++;
  }
  console.log(`\n  postings  ${removed.count} demo rows replaced by ${postings} current ones`);

  // ── The superadmin ────────────────────────────────────────────────────────
  const su = await p.employee.findUnique({ where: { id: SUPERADMIN_ID }, select: { userId: true, nameEn: true } });
  if (!su) {
    console.log(`\n  ! ${SUPERADMIN_ID} was not imported — no superadmin was set.`);
  } else {
    await p.user.update({ where: { id: su.userId }, data: { role: "superadmin" } });
    console.log(`\n  superadmin  ${SUPERADMIN_ID} ${su.nameEn}`);
  }

  // ── What is left over ─────────────────────────────────────────────────────
  const stale = await p.employee.findMany({
    where: { id: { notIn: importedIds } },
    include: { user: { select: { role: true } }, fixations: true, cases: true },
    orderBy: { id: "asc" },
  });
  console.log(`\n  still on the roster but not in the file: ${stale.length}`);
  for (const s of stale) {
    console.log(`    ${s.id}  ${s.nameEn.padEnd(26)} role=${s.user?.role ?? "-"} fixations=${s.fixations.length} cases=${s.cases.length}`);
  }
  console.log("\n  These were NOT deleted. Sign in as the superadmin first, then run");
  console.log("  `npm run import:retire` to remove them.");

  const cats = await p.employee.groupBy({ by: ["category"], _count: true });
  console.log(`\n  categories: ${cats.map((c) => `${c.category} ${c._count}`).join(" · ")}`);
  console.log(`  employees: ${await p.employee.count()} · users: ${await p.user.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
