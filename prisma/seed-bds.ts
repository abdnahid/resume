/**
 * Seeds the BDS store catalogue — divisions and standards.
 *
 * PROVENANCE, so nobody mistakes placeholder for record:
 *  - Jute & Textile and Electrical & Electronics rows are transcribed from the
 *    BSTI store sample (`utils/seed-sample.html`): number, title, price and
 *    edition are as given there.
 *  - The other four divisions are PLAUSIBLE PLACEHOLDERS invented to exercise
 *    the facets. Replace them when the real catalogue export arrives.
 *  - Publication *dates* are synthesised from the year in every case; only the
 *    year is real. They exist so the date and day-wise filters are testable.
 *
 * Idempotent: upserts on the natural keys (division slug, BDS number).
 *
 *   npm run seed:bds
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DIVISIONS = [
  { slug: "chemical", nameEn: "Chemical", nameBn: "রসায়ন", sortOrder: 1 },
  { slug: "agriculture-and-food", nameEn: "Agriculture and Food", nameBn: "কৃষি ও খাদ্য", sortOrder: 2 },
  { slug: "jute-and-textile", nameEn: "Jute and Textile", nameBn: "পাট ও বস্ত্র", sortOrder: 3 },
  { slug: "electrical-and-electronics", nameEn: "Electrical and Electronics", nameBn: "তড়িৎ ও ইলেকট্রনিক্স", sortOrder: 4 },
  { slug: "civil-and-mechanical-engineering", nameEn: "Civil and Mechanical Engineering", nameBn: "পুরকৌশল ও যন্ত্রকৌশল", sortOrder: 5 },
  { slug: "halal-standards", nameEn: "Halal Standards", nameBn: "হালাল মান", sortOrder: 6 },
];

type SeedBds = {
  number: string;
  titleEn: string;
  priceBdt: number;
  edition?: string;
  pages?: number;
  mandatory?: boolean;
  status?: "current" | "superseded" | "withdrawn";
};

const CATALOGUE: Record<string, SeedBds[]> = {
  // ── Real, from utils/seed-sample.html ──────────────────────────────────────
  "jute-and-textile": [
    { number: "BDS 2016:2023", titleEn: "Specification of Nonwoven Fabric for Wipes", priceBdt: 500, pages: 14 },
    { number: "BDS 1982:2020", titleEn: "Textiles — Polyester Blended Woven Shirting for Uniforms", priceBdt: 600, pages: 18 },
    { number: "BDS 1732:2020", titleEn: "Textiles — Woven Terry Toweling Fabrics and Towels Made of Man-Made Fibres and Their Blends — Specification", priceBdt: 600, pages: 22 },
    { number: "BDS 1715:2019", titleEn: "Woven Upholstery Fabrics — Plain, Tufted or Flocked — Specification", priceBdt: 600, pages: 20 },
    { number: "BDS 1940:2018", titleEn: "Women's and Girls' Woven Dress Fabrics made of Man-Made Fibres and their Blends — Specification", priceBdt: 600, pages: 24 },
    { number: "BDS 1799:2018", titleEn: "Grades of Raw Cotton", priceBdt: 500, pages: 12 },
    { number: "BDS 1739:2018", titleEn: "Specification for Teased Cotton Yarn Waste", priceBdt: 500, pages: 10 },
    { number: "BDS 1402:2018", titleEn: "Specification for Unteased Cotton Yarn Waste", priceBdt: 500, pages: 10 },
    { number: "BDS 1150:2018", titleEn: "Grading of Continuous Filament Viscose Rayon Yarn and Acetate Yarn, Bright and Dull", priceBdt: 800, pages: 32 },
    { number: "BDS 1889:2014", titleEn: "Specification for Woven Nylon Fabric for Umbrellas, Water Resistant", priceBdt: 700, pages: 16 },
    { number: "BDS 1561:2013", titleEn: "Glossary of Textile Terms — Natural Fibres", priceBdt: 1700, pages: 88 },
  ],
  "electrical-and-electronics": [
    { number: "BDS 1883:2014", titleEn: "Method of Electrical and Photometric Measurements of Solid-State Lighting (LED) Products", priceBdt: 700, edition: "1.0", pages: 26 },
    { number: "BDS 1812-3:2009", titleEn: "Code of Practice for Interior Illumination — Part 3: Calculation of Coefficients of Utilization by the BZ Method", priceBdt: 1100, edition: "1.0", pages: 44 },
    { number: "BDS 1790-11:2009", titleEn: "Methods of Test for Cables — Part 11: Thermal Ageing in Air", priceBdt: 500, edition: "1.0", pages: 12 },
    { number: "BDS 1778:2006", titleEn: "Valve-Regulated Sealed Type Lead-Acid Stationary Batteries", priceBdt: 700, edition: "1.0", pages: 28 },
    { number: "BDS 1742:2005", titleEn: "Specification for Satellite Signal Distribution on Cabled Distribution System", priceBdt: 500, edition: "1.0", pages: 18 },
    { number: "BDS 1741:2005", titleEn: "Synthetic Separators for Lead-Acid Batteries", priceBdt: 800, edition: "1.0", pages: 30 },
    { number: "BDS 1386:1993", titleEn: "Carriers and Bases Used in Rewirable Type Electric Fuses for Voltages up to 650 V", priceBdt: 900, edition: "1.0", pages: 34 },
  ],

  // ── Placeholders — replace with the real catalogue export ──────────────────
  chemical: [
    { number: "BDS 2104:2024", titleEn: "Liquid Hand Wash — Specification", priceBdt: 650, edition: "1.0", pages: 20, mandatory: true },
    { number: "BDS 2088:2023", titleEn: "Sanitary Napkins — Specification", priceBdt: 700, edition: "1.0", pages: 24, mandatory: true },
    { number: "BDS 1999:2022", titleEn: "Toilet Soap — Specification", priceBdt: 600, edition: "2.0", pages: 18, mandatory: true },
    { number: "BDS 1885:2021", titleEn: "Emulsion Paints for Interior Use — Specification", priceBdt: 900, pages: 36 },
    { number: "BDS 1770:2019", titleEn: "Methods of Sampling and Test for Paints, Varnishes and Related Products", priceBdt: 1400, pages: 72 },
    { number: "BDS 1602:2017", titleEn: "Detergent Powder for Household Use — Specification", priceBdt: 600, pages: 16, mandatory: true },
    { number: "BDS 1451:2015", titleEn: "Specification for Portland Cement Chemical Analysis", priceBdt: 1200, pages: 58 },
    { number: "BDS 1338:2012", titleEn: "Glossary of Terms Relating to Surface Coatings", priceBdt: 1800, pages: 96 },
    { number: "BDS 1201:2009", titleEn: "Hydrogen Peroxide for Industrial Use — Specification", priceBdt: 550, pages: 14 },
    { number: "BDS 1099:2006", titleEn: "Caustic Soda (Sodium Hydroxide) — Specification", priceBdt: 500, pages: 12 },
  ],
  "agriculture-and-food": [
    { number: "BDS 2131:2024", titleEn: "Ready-to-Eat Packaged Snacks — Specification", priceBdt: 750, edition: "1.0", pages: 26, mandatory: true },
    { number: "BDS 2045:2023", titleEn: "Packaged Drinking Water — Specification", priceBdt: 800, edition: "3.0", pages: 30, mandatory: true },
    { number: "BDS 1968:2022", titleEn: "Fortified Edible Soybean Oil — Specification", priceBdt: 700, pages: 22, mandatory: true },
    { number: "BDS 1876:2021", titleEn: "Powdered Milk for Infants — Specification", priceBdt: 1500, pages: 68, mandatory: true },
    { number: "BDS 1749:2019", titleEn: "Wheat Flour (Atta and Maida) — Specification", priceBdt: 600, pages: 18, mandatory: true },
    { number: "BDS 1688:2018", titleEn: "Methods of Test for Cereals and Pulses", priceBdt: 1300, pages: 64 },
    { number: "BDS 1512:2015", titleEn: "Iodized Edible Common Salt — Specification", priceBdt: 550, pages: 14, mandatory: true },
    { number: "BDS 1421:2013", titleEn: "Mustard Oil — Specification", priceBdt: 600, pages: 16, mandatory: true },
    { number: "BDS 1303:2010", titleEn: "Honey — Specification", priceBdt: 650, pages: 20 },
    { number: "BDS 1188:2007", titleEn: "Glossary of Terms Relating to Food Hygiene", priceBdt: 1600, pages: 84 },
  ],
  "civil-and-mechanical-engineering": [
    { number: "BDS 2140:2024", titleEn: "Autoclaved Aerated Concrete Blocks — Specification", priceBdt: 950, edition: "1.0", pages: 38 },
    { number: "BDS 2011:2023", titleEn: "Hot-Rolled Steel Bars for Concrete Reinforcement — Specification", priceBdt: 1400, edition: "2.0", pages: 70, mandatory: true },
    { number: "BDS 1924:2022", titleEn: "Ordinary Portland Cement — Specification", priceBdt: 1200, pages: 56, mandatory: true },
    { number: "BDS 1810:2020", titleEn: "Burnt Clay Bricks — Specification", priceBdt: 700, pages: 24, mandatory: true },
    { number: "BDS 1702:2019", titleEn: "Unplasticized PVC Pipes for Potable Water Supply — Specification", priceBdt: 900, pages: 34, mandatory: true },
    { number: "BDS 1655:2018", titleEn: "Methods of Test for Aggregates for Concrete", priceBdt: 1700, pages: 90 },
    { number: "BDS 1498:2015", titleEn: "Code of Practice for Structural Use of Concrete", priceBdt: 5200, pages: 260 },
    { number: "BDS 1377:2012", titleEn: "Mild Steel Tubes for Water and Gas — Specification", priceBdt: 850, pages: 30 },
    { number: "BDS 1244:2009", titleEn: "Cast Iron Manhole Covers and Frames — Specification", priceBdt: 600, pages: 18 },
    { number: "BDS 1156:2006", titleEn: "Glossary of Terms Relating to Cement and Concrete", priceBdt: 1900, pages: 102 },
  ],
  "halal-standards": [
    { number: "BDS 1938:2022", titleEn: "Halal Food — General Requirements", priceBdt: 1100, edition: "2.0", pages: 46 },
    { number: "BDS 1939:2022", titleEn: "Halal Cosmetics — General Requirements", priceBdt: 900, edition: "1.0", pages: 34 },
    { number: "BDS 1941:2022", titleEn: "General Guidelines for Halal Certification Bodies", priceBdt: 1300, edition: "1.0", pages: 58 },
    { number: "BDS 1942:2022", titleEn: "Halal Slaughtering Practice — Code of Practice", priceBdt: 1000, edition: "1.0", pages: 40 },
    { number: "BDS 1943:2023", titleEn: "Halal Pharmaceuticals — General Requirements", priceBdt: 1200, edition: "1.0", pages: 52 },
    { number: "BDS 1944:2023", titleEn: "Halal Supply Chain Management — Requirements for Transportation", priceBdt: 950, edition: "1.0", pages: 36 },
    { number: "BDS 1945:2024", titleEn: "Halal Logistics — Warehousing and Retail Requirements", priceBdt: 950, edition: "1.0", pages: 36 },
  ],
};

/** "BDS 1812-3:2009" → "bds-1812-3-2009" (decision D6 — slug from the number). */
function slugify(number: string): string {
  return number
    .toLowerCase()
    .replace(/[:\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function yearOf(number: string): number {
  const match = number.match(/:(\d{4})$/);
  if (!match) throw new Error(`No year in BDS number: ${number}`);
  return Number(match[1]);
}

/**
 * Synthesised publication date — deterministic so reseeding doesn't churn the
 * date filters. Only the year is real; replace when the catalogue export lands.
 */
function publishedOn(number: string, index: number): Date {
  const year = yearOf(number);
  const month = index % 12;
  const day = ((index * 7) % 27) + 1;
  return new Date(Date.UTC(year, month, day));
}

async function main() {
  const divisionIds = new Map<string, number>();

  for (const division of DIVISIONS) {
    const row = await prisma.bdsDivision.upsert({
      where: { slug: division.slug },
      update: division,
      create: division,
    });
    divisionIds.set(division.slug, row.id);
  }
  console.log(`✓ ${DIVISIONS.length} divisions`);

  let count = 0;
  for (const [divisionSlug, standards] of Object.entries(CATALOGUE)) {
    const divisionId = divisionIds.get(divisionSlug);
    if (!divisionId) throw new Error(`Unknown division: ${divisionSlug}`);

    for (const [index, bds] of standards.entries()) {
      const data = {
        number: bds.number,
        slug: slugify(bds.number),
        titleEn: bds.titleEn,
        year: yearOf(bds.number),
        publishedOn: publishedOn(bds.number, index),
        edition: bds.edition ?? null,
        pages: bds.pages ?? null,
        priceBdt: bds.priceBdt,
        status: bds.status ?? ("current" as const),
        isMandatory315: bds.mandatory ?? false,
        divisionId,
      };
      await prisma.bds.upsert({
        where: { number: bds.number },
        update: data,
        create: data,
      });
      count++;
    }
    console.log(`✓ ${standards.length.toString().padStart(2)} standards — ${divisionSlug}`);
  }
  console.log(`\n${count} standards seeded.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
