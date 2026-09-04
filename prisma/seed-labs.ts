/**
 * Seeds the testing laboratories and the lab-routing map.
 *
 *   npm run seed:labs -- --dry     report only, no writes
 *   npm run seed:labs              upsert
 *
 * **A lab is an organogram unit.** Head office splits its two testing wings
 * into sections (Textile, Organic Chemistry, Food & Bacteriology…); a branch
 * office has one flat `Physical Lab, <city>` and/or `Chemistry Lab, <city>`.
 * Both are OrgUnit rows, which is what lets one model cover the two shapes, so
 * this seed reads the organogram rather than carrying its own list.
 *
 * **The routing map is a placeholder and says so.** Every office × parameter
 * currently points at the head-office section that owns the parameter, with
 * `isPlaceholder` set. That is not a claim about where samples go — referral is
 * an administrative fact each office decides for itself (Barisal may send to
 * Cumilla rather than a nearer, capable Khulna), and the mapping module is
 * where those rows get corrected. The flag is what stops a stand-in being read
 * as a decision.
 *
 * **Capability is separate from routing, and sparse.** Only true rows exist:
 * the head-office Textile section can run the textile parameters because that
 * is whose file they came from. Nothing else claims a capability it has not
 * been given, which is what keeps the map from nominating a lab that cannot
 * run the test.
 *
 * Idempotent: upserts on natural keys and never deletes.
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { LabDiscipline } from "../generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DRY = process.argv.includes("--dry");
const HEAD_OFFICE_ID = 6;

/** Head office's lab sections, by organogram slug. The two `*-exec` units are
 *  the wing offices, not laboratories, so they are deliberately absent. */
const HEAD_SECTIONS: { slug: string; discipline: LabDiscipline }[] = [
  { slug: "pt-textile", discipline: "physical" },
  { slug: "pt-elec", discipline: "physical" },
  { slug: "pt-civil", discipline: "physical" },
  { slug: "pt-mech", discipline: "physical" },
  { slug: "ct-organic", discipline: "chemical" },
  { slug: "ct-inorganic", discipline: "chemical" },
  { slug: "ct-food", discipline: "chemical" },
  { slug: "ct-pmo", discipline: "chemical" },
];

/** Which head-office section owns each wing's parameter file. Extended as the
 *  other wings' files arrive. */
const SECTION_FOR_SOURCE: Record<string, string> = { textile: "pt-textile" };

/** The organogram writes Barisal; the office register writes Barishal. */
const CITY_ALIASES: Record<string, string> = { barisal: "barishal" };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

async function main() {
  const offices = await prisma.office.findMany({ select: { id: true, nameEn: true } });
  const officeByCity = new Map<string, { id: number; nameEn: string }>();
  for (const o of offices) {
    const city = o.nameEn.split(",").pop()?.trim() ?? "";
    if (city) officeByCity.set(norm(city), o);
  }

  const units = await prisma.orgUnit.findMany({
    select: { id: true, slug: true, nameEn: true, nameBn: true },
  });
  const unitBySlug = new Map(units.map((u) => [u.slug, u]));

  type LabSeed = {
    slug: string; nameEn: string; nameBn: string | null;
    discipline: LabDiscipline; officeId: number; orgUnitId: number;
  };
  const labs: LabSeed[] = [];
  const unmatched: string[] = [];

  for (const s of HEAD_SECTIONS) {
    const u = unitBySlug.get(s.slug);
    if (!u) { unmatched.push(`head-office section "${s.slug}" not in the organogram`); continue; }
    labs.push({
      slug: `lab-${u.slug}`, nameEn: `${u.nameEn}, Head Office`, nameBn: u.nameBn,
      discipline: s.discipline, officeId: HEAD_OFFICE_ID, orgUnitId: u.id,
    });
  }

  for (const u of units) {
    const m = u.nameEn.match(/^(Physical|Chemistry)\s+Lab,\s*(.+)$/i);
    if (!m) continue;
    const office = officeByCity.get(CITY_ALIASES[norm(m[2])] ?? norm(m[2]));
    if (!office) { unmatched.push(`no office for "${u.nameEn}"`); continue; }
    labs.push({
      slug: `lab-${u.slug}`, nameEn: u.nameEn, nameBn: u.nameBn,
      discipline: m[1].toLowerCase() === "physical" ? "physical" : "chemical",
      officeId: office.id, orgUnitId: u.id,
    });
  }

  const parameters = await prisma.testParameter.findMany({
    select: { id: true, sourceSection: true },
  });
  const sections = [...new Set(parameters.map((p) => p.sourceSection))];
  const unmapped = sections.filter((s) => !SECTION_FOR_SOURCE[s]);

  console.log(`Offices            ${offices.length}`);
  console.log(`Labs               ${labs.length}  (${labs.filter((l) => l.officeId === HEAD_OFFICE_ID).length} head office, ${labs.filter((l) => l.officeId !== HEAD_OFFICE_ID).length} branch)`);
  console.log(`  physical         ${labs.filter((l) => l.discipline === "physical").length}`);
  console.log(`  chemical         ${labs.filter((l) => l.discipline === "chemical").length}`);
  console.log(`Parameters         ${parameters.length}  from section(s): ${sections.join(", ") || "—"}`);
  console.log(`Routing rows       ${offices.length * parameters.length}  (${offices.length} offices × ${parameters.length} parameters)`);

  if (unmatched.length) {
    console.log(`\n${unmatched.length} organogram unit(s) not matched — left out rather than guessed:`);
    unmatched.forEach((u) => console.log("  •", u));
  }
  if (unmapped.length) {
    console.log(`\nNo head-office section mapped for parameter source(s): ${unmapped.join(", ")}`);
    console.log("Add them to SECTION_FOR_SOURCE. Nothing written.");
    process.exitCode = 1;
    return;
  }
  if (DRY) { console.log("\n--dry: no writes."); return; }

  for (const l of labs) {
    await prisma.lab.upsert({
      where: { slug: l.slug },
      create: l,
      update: { nameEn: l.nameEn, nameBn: l.nameBn, discipline: l.discipline, officeId: l.officeId, orgUnitId: l.orgUnitId },
    });
  }
  const labIdBySlug = new Map(
    (await prisma.lab.findMany({ select: { id: true, slug: true } })).map((l) => [l.slug, l.id]),
  );
  console.log(`\n✓ labs             ${labs.length}`);

  // Capability: the section whose file the parameter came from can run it.
  const capabilities = parameters.map((p) => ({
    labId: labIdBySlug.get(`lab-${SECTION_FOR_SOURCE[p.sourceSection]}`)!,
    parameterId: p.id,
  }));
  await prisma.labCapability.createMany({ data: capabilities, skipDuplicates: true });
  console.log(`✓ capabilities     ${capabilities.length}`);

  // The 2D map. Batched: a round trip to the remote database costs ~half a
  // second, so 16k single writes would be hours.
  const routings = offices.flatMap((o) =>
    parameters.map((p) => ({
      officeId: o.id, parameterId: p.id,
      labId: labIdBySlug.get(`lab-${SECTION_FOR_SOURCE[p.sourceSection]}`)!,
      mode: "in_house" as const, isPlaceholder: true,
      note: "Seeded stand-in — every office routes to the owning head-office section until the mapping module lands.",
    })),
  );
  const CHUNK = 2000;
  let written = 0;
  for (let i = 0; i < routings.length; i += CHUNK) {
    const r = await prisma.labRouting.createMany({ data: routings.slice(i, i + CHUNK), skipDuplicates: true });
    written += r.count;
    console.log(`  … routing ${Math.min(i + CHUNK, routings.length)}/${routings.length}`);
  }
  console.log(`✓ routing rows     ${written} written (${routings.length - written} already present)`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
