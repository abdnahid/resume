/**
 * Re-price every package's urgent fee from what the wing published.
 *
 *     npm run fees:urgent -- --dry
 *
 * **Why this exists as a script.** The urgent price is decided per package and
 * stored per parameter (D99), so the decision has to be made *somewhere* — and
 * the right somewhere is a script whose output a person reads, not a rule
 * evaluated on every page load. `SubProductPackageFee` holds the wing's own
 * stated totals, so re-pricing after a fee is corrected in the catalogue screen
 * costs one query rather than re-parsing a Word document.
 *
 * It replaces `backfill:urgent-fees`, which filled nulls by the flat 2× rule.
 * There are no nulls to fill any more — the column is NOT NULL — and the rule
 * has grown a third case: a package whose published urgent total is not twice
 * its normal total is **apportioned** to match what the wing actually charges.
 * Poultry Feed (Layer-4) is the case that prompted it: ৳20,000 normal, ৳25,000
 * urgent published, ৳40,000 by doubling.
 *
 * **A fee typed by hand is never recomputed over.** `urgentFeeSource = manual`
 * is excluded, and its figure is subtracted from the package's published total
 * before the rest is apportioned — so one corrected test does not silently
 * shift the price of every other test in its package.
 */
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  priceUrgent, URGENT_SOURCE_NOTE, type UrgentFeeSource,
} from "../../lib/labs/urgent-fee";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const DRY = process.argv.includes("--dry");
const taka = (p: number) => `৳${(p / 100).toLocaleString("en-BD")}`;

async function main() {
  const packages = await prisma.subProductPackageFee.findMany({
    select: {
      subProductId: true, sourceSection: true,
      statedNormalFeePoisha: true, statedUrgentFeePoisha: true,
      turnaroundNormalDays: true, turnaroundUrgentDays: true,
      subProduct: { select: { nameEn: true, product: { select: { nameEn: true } } } },
    },
    orderBy: [{ subProductId: "asc" }, { sourceSection: "asc" }],
  });

  const params = await prisma.testParameter.findMany({
    select: {
      id: true, subProductId: true, sourceSection: true, nameEn: true,
      feePoisha: true, urgentFeePoisha: true, urgentFeeSource: true, ordinal: true,
    },
    orderBy: [{ ordinal: "asc" }, { id: "asc" }],
  });
  const byPackage = new Map<string, typeof params>();
  for (const p of params) {
    const k = `${p.subProductId}|${p.sourceSection}`;
    if (!byPackage.has(k)) byPackage.set(k, []);
    byPackage.get(k)!.push(p);
  }

  const ids: number[] = [], fees: number[] = [], sources: string[] = [];
  const bySource = new Map<UrgentFeeSource, number>();
  const anomalies: { pkg: string; why: string }[] = [];
  const mismatch: { pkg: string; stated: number; summed: number }[] = [];
  let changed = 0, manualKept = 0, orphaned = 0;

  for (const pkg of packages) {
    const label = `${pkg.subProduct.product.nameEn} » ${pkg.subProduct.nameEn} [${pkg.sourceSection}]`;
    const rows = byPackage.get(`${pkg.subProductId}|${pkg.sourceSection}`) ?? [];
    if (!rows.length) continue;

    const manual = rows.filter((r) => r.urgentFeeSource === "manual");
    const auto = rows.filter((r) => r.urgentFeeSource !== "manual");
    manualKept += manual.length;
    if (!auto.length) continue;

    // A hand-entered fee is a decision about that test, so it comes off the
    // published total before the remainder is shared out. Apportioning the
    // whole total over the rest would make one corrected test quietly re-price
    // every other test beside it.
    let statedUrgent = pkg.statedUrgentFeePoisha;
    if (statedUrgent !== null && manual.length) {
      statedUrgent -= manual.reduce((a, r) => a + r.urgentFeePoisha, 0);
      if (statedUrgent <= 0) {
        anomalies.push({ pkg: label, why: "hand-entered fees already exceed the published urgent total" });
        statedUrgent = null;
      }
    }

    const priced = priceUrgent({
      normalFees: auto.map((r) => r.feePoisha),
      statedUrgentTotal: statedUrgent,
      normalDays: pkg.turnaroundNormalDays,
      urgentDays: pkg.turnaroundUrgentDays,
    });
    if (priced.anomaly) anomalies.push({ pkg: label, why: priced.anomaly });

    const summed = rows.reduce((a, r) => a + r.feePoisha, 0);
    if (pkg.statedNormalFeePoisha !== null && pkg.statedNormalFeePoisha !== summed)
      mismatch.push({ pkg: label, stated: pkg.statedNormalFeePoisha, summed });

    bySource.set(priced.source, (bySource.get(priced.source) ?? 0) + auto.length);
    for (const [i, r] of auto.entries()) {
      const fee = priced.urgentFees[i];
      if (fee === r.urgentFeePoisha && priced.source === r.urgentFeeSource) continue;
      changed++;
      ids.push(r.id); fees.push(fee); sources.push(priced.source);
    }
  }

  // A parameter with no package row cannot be priced from a published total.
  // It is not silently left alone: an importer that forgot to write its
  // package fees would otherwise look like a clean run.
  const known = new Set(packages.map((p) => `${p.subProductId}|${p.sourceSection}`));
  for (const [k, rows] of byPackage) if (!known.has(k)) orphaned += rows.length;

  console.log(`Packages          ${packages.length}`);
  console.log(`Parameters        ${params.length}`);
  console.log(`Repriced          ${changed}`);
  console.log(`Left alone        ${manualKept} entered by hand`);
  if (orphaned) console.log(`⚠ No package row  ${orphaned} parameters — re-run their wing's importer`);
  console.log(`\nBy how each was priced:`);
  for (const [k, n] of [...bySource].sort((a, b) => b[1] - a[1]))
    console.log(`   ${k.padEnd(17)} ${n}  ${URGENT_SOURCE_NOTE[k]}`);

  if (anomalies.length) {
    console.log(`\nPackages whose own figures do not agree — priced by the 2× rule instead:`);
    for (const a of anomalies) console.log(`  • ${a.pkg.slice(0, 60)} — ${a.why}`);
  }
  if (mismatch.length) {
    console.log(`\nStated normal total ≠ the sum of its parameters (${mismatch.length}) — open with the wing:`);
    for (const m of mismatch.slice(0, 30))
      console.log(`  • ${m.pkg.slice(0, 56).padEnd(56)} stated ${taka(m.stated)}  summed ${taka(m.summed)}`);
    if (mismatch.length > 30) console.log(`  … and ${mismatch.length - 30} more`);
  }

  if (DRY) { console.log(`\n--dry: nothing written.`); return; }
  if (!ids.length) { console.log(`\nNothing to change.`); return; }

  // One statement per chunk rather than one per row: 4,767 round trips to
  // db.prisma.io is forty minutes, and this is seconds.
  const CHUNK = 1000;
  for (let i = 0; i < ids.length; i += CHUNK) {
    await prisma.$executeRawUnsafe(
      `UPDATE "TestParameter" AS t
          SET "urgentFeePoisha" = v.fee,
              "urgentFeeSource" = v.src::"UrgentFeeSource",
              "updatedAt"       = now()
         FROM (SELECT unnest($1::int[]) AS id,
                      unnest($2::int[]) AS fee,
                      unnest($3::text[]) AS src) v
        WHERE t.id = v.id`,
      ids.slice(i, i + CHUNK), fees.slice(i, i + CHUNK), sources.slice(i, i + CHUNK),
    );
    process.stdout.write(`\r  … ${Math.min(i + CHUNK, ids.length)}/${ids.length}`);
  }
  console.log(`\n✓ repriced ${ids.length} parameters`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
