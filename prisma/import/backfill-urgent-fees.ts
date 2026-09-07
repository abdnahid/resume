/**
 * Fills `TestParameter.urgentFeePoisha` wherever it is null, by the rule the
 * client set on 2026-09-07:
 *
 *     urgent turnaround shorter than normal  →  twice the normal fee
 *     otherwise                              →  the normal fee
 *
 * **Why a backfill rather than a default.** D62 left the column nullable and
 * read null as "twice the normal fee" — a rule evaluated at read time. That was
 * fine while one wing priced one way, and stopped being fine the moment a
 * second wing priced differently: a null then means "double" in one row and
 * "nobody knows" in the next, with nothing to tell them apart. Storing the
 * number removes the ambiguity instead of managing it, and the reader becomes a
 * sum (D99).
 *
 * The chemical importer already writes both columns, so this exists for the
 * 713 textile rows that predate the rule — and for any wing whose file lands
 * before its importer does.
 *
 *     npm run backfill:urgent-fees -- --dry
 */
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const DRY = process.argv.includes("--dry");

async function main() {
  const rows = await prisma.testParameter.findMany({
    where: { urgentFeePoisha: null },
    select: {
      id: true, feePoisha: true, sourceSection: true,
      subProduct: { select: { turnaroundNormalDays: true, turnaroundUrgentDays: true } },
    },
  });

  const doubled: number[] = [];
  const same: number[] = [];
  let noDays = 0;
  for (const r of rows) {
    const { turnaroundNormalDays: n, turnaroundUrgentDays: u } = r.subProduct;
    // No turnaround recorded is not an invitation to guess: a sub-product that
    // never quoted an urgent date is not offering urgent service, so it is
    // charged at the normal fee rather than at a surcharge nobody published.
    if (n === null || u === null) { noDays++; same.push(r.id); continue; }
    (u < n ? doubled : same).push(r.id);
  }

  const bySection = new Map<string, number>();
  for (const r of rows) bySection.set(r.sourceSection, (bySection.get(r.sourceSection) ?? 0) + 1);

  console.log(`Parameters with no urgent fee   ${rows.length}`);
  for (const [s, n] of bySection) console.log(`   ${s.padEnd(20)} ${n}`);
  console.log(`  urgent turnaround is shorter  ${doubled.length}  → 2× the normal fee`);
  console.log(`  it is not, or is unquoted     ${same.length}  → the normal fee (${noDays} have no turnaround at all)`);

  if (DRY) { console.log("\n--dry: nothing written."); return; }
  if (!rows.length) { console.log("\nNothing to do."); return; }

  // One statement per rule rather than one per row: 713 round trips to
  // db.prisma.io is six minutes, and this is two.
  if (doubled.length)
    await prisma.$executeRawUnsafe(
      `UPDATE "TestParameter" SET "urgentFeePoisha" = "feePoisha" * 2 WHERE id = ANY($1::int[])`,
      doubled,
    );
  if (same.length)
    await prisma.$executeRawUnsafe(
      `UPDATE "TestParameter" SET "urgentFeePoisha" = "feePoisha" WHERE id = ANY($1::int[])`,
      same,
    );

  const left = await prisma.testParameter.count({ where: { urgentFeePoisha: null } });
  console.log(`\n✓ filled ${rows.length}; ${left} still null`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
