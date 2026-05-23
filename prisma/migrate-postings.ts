/**
 * Creates an initial Posting record for every employee who doesn't have one yet.
 * Uses the employee's existing designationBn/designationEn/grade/officeId/dateOfJoining
 * and tries to match to an OrgPost by nameBn.
 *
 * Run with: npm run migrate:postings
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const employees = await prisma.employee.findMany({
    include: { postings: { where: { relievedAt: null } } },
  });

  const allPosts = await prisma.orgPost.findMany({
    include: { unit: { include: { parent: true } } },
  });

  let created = 0;
  let skipped = 0;
  let unmatched: string[] = [];

  for (const emp of employees) {
    // Already has a current posting — skip
    if (emp.postings.length > 0) { skipped++; continue; }

    // Try exact match on nameBn, then nameEn
    const desigBn = emp.designationBn?.trim() ?? "";
    const desigEn = emp.designationEn?.trim() ?? "";

    let matched = allPosts.find(
      (p) => p.nameBn.trim() === desigBn && desigBn !== "",
    ) ?? allPosts.find(
      (p) => p.nameEn.trim() === desigEn && desigEn !== "",
    );

    if (!matched && desigBn) {
      // Fuzzy: post name contains the employee's designation
      matched = allPosts.find(
        (p) => p.nameBn.includes(desigBn) || desigBn.includes(p.nameBn),
      );
    }

    if (!matched) {
      unmatched.push(`${emp.id} — "${desigBn}" / "${desigEn}"`);
    }

    await prisma.posting.create({
      data: {
        employeeId: emp.id,
        officeId:   emp.officeId,
        orgPostId:  matched?.id ?? null,
        grade:      emp.grade ?? "0",
        joinedAt:   emp.dateOfJoining ?? "01-01-2000",
        type:       "initial",
        remarks:    matched ? undefined : "Auto-migrated — OrgPost not matched, please update",
      },
    });
    created++;
  }

  console.log(`✓ Created ${created} initial postings`);
  if (skipped)   console.log(`  ${skipped} employees already had a current posting`);
  if (unmatched.length) {
    console.log(`\n⚠ ${unmatched.length} employees could not be matched to an OrgPost:`);
    unmatched.forEach((m) => console.log("  •", m));
    console.log("\nOpen /organogram/manage to edit, or PATCH /api/postings/:id to fix.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
