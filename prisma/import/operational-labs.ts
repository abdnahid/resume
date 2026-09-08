/**
 * Close the laboratories that exist in the organogram but not in practice.
 *
 *     npm run labs:operational -- --dry
 *
 * **Two sources disagree, and the client's is the one about reality.**
 * `seed:labs` created 46 laboratories from the organogram with none invented —
 * 8 head-office sections under the two testing wings, and 38 branch labs
 * matched to their office by city, covering 22 of the 23 offices. The client
 * (2026-09-08) named the offices that actually have laboratories, and there are
 * **eleven** of them. The other eleven offices hold an organogram unit called a
 * laboratory with no working bench behind it.
 *
 * **Closed, never deleted.** The organogram unit is real even where the bench
 * is not, a lab closed this year may open next, and `Lab.isActive` is one
 * field to flip back — on this script or on the registry screen. Deleting would
 * take `LabCapability` and every `LabRouting` row with it.
 *
 * Nothing is silently repointed. An office still routing to a closed lab keeps
 * its rows and they start failing the check in `resolveDestinations()`, by
 * name. That matters not at all today, because every routing row still points
 * at a head-office section (D66) and head office is on the list.
 *
 * **If this list is wrong, it is one flip to correct** — say so rather than
 * working around it, because everything downstream reads `isActive`.
 */
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const DRY = process.argv.includes("--dry");

/**
 * The offices with laboratories, as the client stated them.
 *
 * Matched on the city — the office register spells every row as a type, the
 * institution and a city, so the city is the only part that differs. The
 * Barisal/Barishal alias is the same one `seed:labs` needed: the organogram
 * spells it one way and the register the other.
 */
const HAS_LABS = [
  "Dhaka",       // Head Office — its two testing wings, eight sections
  "Chittagong",
  "Khulna",
  "Rajshahi",
  "Rangpur",
  "Faridpur",
  "Cumilla",     // the client wrote "Comilla"
  "Sylhet",
  "Barishal",    // the client wrote "Barisal"
  "Mymensingh",
  "Cox's Bazar", // the client wrote "coxbazar"
];

const city = (nameEn: string) => {
  const parts = nameEn.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? nameEn;
};

async function main() {
  const labs = await prisma.lab.findMany({
    select: {
      id: true, nameEn: true, isActive: true,
      office: { select: { id: true, nameEn: true } },
      _count: { select: { capabilities: true, routings: true } },
    },
    orderBy: [{ officeId: "asc" }, { nameEn: "asc" }],
  });

  // A named office that holds no lab at all would mean the list and the
  // organogram disagree the other way round, which is worth saying out loud
  // rather than passing over.
  const officeCities = new Set(labs.map((l) => city(l.office.nameEn)));
  const namedWithNoLab = HAS_LABS.filter((c) => !officeCities.has(c));

  const keep = labs.filter((l) => HAS_LABS.includes(city(l.office.nameEn)));
  const close = labs.filter((l) => !HAS_LABS.includes(city(l.office.nameEn)));

  console.log(`Laboratories        ${labs.length} across ${officeCities.size} offices`);
  console.log(`On the client's list ${keep.length}  (${new Set(keep.map((l) => city(l.office.nameEn))).size} offices)`);
  console.log(`Not on it            ${close.length}\n`);

  if (namedWithNoLab.length) {
    console.log(`⚠ Named as having a laboratory, but the organogram has none there:`);
    for (const c of namedWithNoLab) console.log(`   ${c}`);
    console.log();
  }

  const toClose = close.filter((l) => l.isActive);
  const toOpen = keep.filter((l) => !l.isActive);

  if (toClose.length) {
    console.log(`To close (${toClose.length}):`);
    for (const l of toClose)
      console.log(
        `   ${l.nameEn.padEnd(34)} ${String(l._count.capabilities).padStart(5)} declared, ` +
          `${String(l._count.routings).padStart(6)} routing cells`,
      );
  }
  if (toOpen.length) {
    console.log(`\nTo re-open (${toOpen.length}):`);
    for (const l of toOpen) console.log(`   ${l.nameEn}`);
  }
  if (!toClose.length && !toOpen.length) console.log("Already in step with the list.");

  const brokenCells = toClose.reduce((a, l) => a + l._count.routings, 0);
  if (brokenCells)
    console.log(
      `\n${brokenCells} routing cells point at a laboratory about to close. They are left as they ` +
        `are — the office chose them — and will be refused by name rather than repointed.`,
    );

  if (DRY) { console.log(`\n--dry: nothing written.`); return; }
  if (!toClose.length && !toOpen.length) return;

  if (toClose.length)
    await prisma.lab.updateMany({ where: { id: { in: toClose.map((l) => l.id) } }, data: { isActive: false } });
  if (toOpen.length)
    await prisma.lab.updateMany({ where: { id: { in: toOpen.map((l) => l.id) } }, data: { isActive: true } });

  console.log(`\n✓ closed ${toClose.length}, re-opened ${toOpen.length}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
