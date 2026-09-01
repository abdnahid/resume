/**
 * Size types and their units (D51).
 *
 * The applicant picks a size type first and the unit list follows from it, so a
 * biscuit cannot be measured in litres. Data rather than an enum (D7) — the
 * labels are bilingual, they are ordered for display, and the Standards Wing
 * can add to the list without a deployment.
 *
 * **This is our list, not BSTI's.** It covers the shapes the 315 mandatory
 * products actually take — food by weight and volume, cable by cross-section,
 * garments by chart — and it is the applicant's own vocabulary rather than a
 * metrological standard. Which size types a given product may use is Phase G
 * reference data and does not exist yet, so all of them are offered.
 *
 * Idempotent: upserts on the natural keys, safe to re-run.
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type Seed = {
  slug: string;
  nameEn: string;
  nameBn: string;
  kind: "numeric" | "categorical";
  hintEn?: string;
  units: { code: string; nameEn: string; nameBn?: string }[];
};

const SIZE_TYPES: Seed[] = [
  {
    slug: "weight",
    nameEn: "Weight",
    nameBn: "ওজন",
    kind: "numeric",
    hintEn: "250 g, 1 kg",
    units: [
      { code: "mg", nameEn: "milligram", nameBn: "মিলিগ্রাম" },
      { code: "g", nameEn: "gram", nameBn: "গ্রাম" },
      { code: "kg", nameEn: "kilogram", nameBn: "কিলোগ্রাম" },
      { code: "t", nameEn: "metric tonne", nameBn: "মেট্রিক টন" },
    ],
  },
  {
    slug: "volume",
    nameEn: "Volume",
    nameBn: "আয়তন",
    kind: "numeric",
    hintEn: "200 ml, 1 litre",
    units: [
      { code: "ml", nameEn: "millilitre", nameBn: "মিলিলিটার" },
      { code: "L", nameEn: "litre", nameBn: "লিটার" },
    ],
  },
  {
    slug: "number-of-items",
    nameEn: "Number of items",
    nameBn: "সংখ্যা",
    kind: "numeric",
    hintEn: "100 pieces, 1 dozen",
    units: [
      { code: "pcs", nameEn: "piece", nameBn: "পিস" },
      { code: "pair", nameEn: "pair", nameBn: "জোড়া" },
      { code: "dozen", nameEn: "dozen", nameBn: "ডজন" },
      { code: "set", nameEn: "set", nameBn: "সেট" },
    ],
  },
  {
    slug: "length",
    nameEn: "Length",
    nameBn: "দৈর্ঘ্য",
    kind: "numeric",
    hintEn: "90 cm, 100 m",
    units: [
      { code: "mm", nameEn: "millimetre", nameBn: "মিলিমিটার" },
      { code: "cm", nameEn: "centimetre", nameBn: "সেন্টিমিটার" },
      { code: "m", nameEn: "metre", nameBn: "মিটার" },
      { code: "in", nameEn: "inch", nameBn: "ইঞ্চি" },
      { code: "ft", nameEn: "foot", nameBn: "ফুট" },
      { code: "yd", nameEn: "yard", nameBn: "গজ" },
    ],
  },
  {
    slug: "cross-section",
    nameEn: "Cross-section",
    nameBn: "প্রস্থচ্ছেদ",
    kind: "numeric",
    hintEn: "1.5 sq mm — cable, wire, rod",
    units: [
      { code: "sq mm", nameEn: "square millimetre", nameBn: "বর্গমিলিমিটার" },
      { code: "sq cm", nameEn: "square centimetre", nameBn: "বর্গসেন্টিমিটার" },
    ],
  },
  {
    slug: "surface-area",
    nameEn: "Surface area",
    nameBn: "পৃষ্ঠতলের ক্ষেত্রফল",
    kind: "numeric",
    hintEn: "600 × 600 mm tile — enter the area",
    units: [
      { code: "sq cm", nameEn: "square centimetre", nameBn: "বর্গসেন্টিমিটার" },
      { code: "sq m", nameEn: "square metre", nameBn: "বর্গমিটার" },
      { code: "sq ft", nameEn: "square foot", nameBn: "বর্গফুট" },
    ],
  },
  {
    slug: "diameter",
    nameEn: "Diameter",
    nameBn: "ব্যাস",
    kind: "numeric",
    hintEn: "12 mm rod, 110 mm pipe",
    units: [
      { code: "mm", nameEn: "millimetre", nameBn: "মিলিমিটার" },
      { code: "cm", nameEn: "centimetre", nameBn: "সেন্টিমিটার" },
      { code: "in", nameEn: "inch", nameBn: "ইঞ্চি" },
    ],
  },
  {
    slug: "thickness",
    nameEn: "Thickness",
    nameBn: "পুরুত্ব",
    kind: "numeric",
    hintEn: "0.5 mm sheet",
    units: [
      { code: "mm", nameEn: "millimetre", nameBn: "মিলিমিটার" },
      { code: "cm", nameEn: "centimetre", nameBn: "সেন্টিমিটার" },
      { code: "gauge", nameEn: "gauge", nameBn: "গেজ" },
    ],
  },
  {
    slug: "power",
    nameEn: "Power rating",
    nameBn: "ক্ষমতা",
    kind: "numeric",
    hintEn: "9 W lamp, 1.5 kW motor",
    units: [
      { code: "W", nameEn: "watt", nameBn: "ওয়াট" },
      { code: "kW", nameEn: "kilowatt", nameBn: "কিলোওয়াট" },
      { code: "hp", nameEn: "horsepower", nameBn: "অশ্বশক্তি" },
    ],
  },
  {
    slug: "voltage",
    nameEn: "Voltage rating",
    nameBn: "ভোল্টেজ",
    kind: "numeric",
    hintEn: "220 V, 11 kV",
    units: [
      { code: "V", nameEn: "volt", nameBn: "ভোল্ট" },
      { code: "kV", nameEn: "kilovolt", nameBn: "কিলোভোল্ট" },
    ],
  },
  {
    slug: "capacity",
    nameEn: "Capacity",
    nameBn: "ধারণক্ষমতা",
    kind: "numeric",
    hintEn: "1.5 ton air conditioner, 200 Ah battery",
    units: [
      { code: "ton", nameEn: "ton (refrigeration)", nameBn: "টন" },
      { code: "Ah", nameEn: "ampere-hour", nameBn: "অ্যাম্পিয়ার-আওয়ার" },
      { code: "L", nameEn: "litre", nameBn: "লিটার" },
    ],
  },
  {
    // The categorical one: there is no number, and asking for one would only get
    // an invented answer.
    slug: "size-chart",
    nameEn: "Size chart",
    nameBn: "সাইজ চার্ট",
    kind: "categorical",
    hintEn: "Garments and footwear sold by labelled size",
    units: [
      { code: "XS", nameEn: "Extra small" },
      { code: "S", nameEn: "Small" },
      { code: "M", nameEn: "Medium" },
      { code: "L", nameEn: "Large" },
      { code: "XL", nameEn: "Extra large" },
      { code: "XXL", nameEn: "Double extra large" },
      { code: "XXXL", nameEn: "Triple extra large" },
      { code: "Free", nameEn: "Free size", nameBn: "ফ্রি সাইজ" },
    ],
  },
];

async function main() {
  let types = 0;
  let units = 0;

  for (const [i, t] of SIZE_TYPES.entries()) {
    const row = await prisma.sizeType.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        nameEn: t.nameEn,
        nameBn: t.nameBn,
        kind: t.kind,
        hintEn: t.hintEn ?? null,
        sortOrder: i,
      },
      update: {
        nameEn: t.nameEn,
        nameBn: t.nameBn,
        kind: t.kind,
        hintEn: t.hintEn ?? null,
        sortOrder: i,
      },
    });
    types++;

    for (const [j, u] of t.units.entries()) {
      await prisma.sizeUnit.upsert({
        where: { sizeTypeId_code: { sizeTypeId: row.id, code: u.code } },
        create: {
          sizeTypeId: row.id,
          code: u.code,
          nameEn: u.nameEn,
          nameBn: u.nameBn ?? null,
          sortOrder: j,
        },
        update: { nameEn: u.nameEn, nameBn: u.nameBn ?? null, sortOrder: j },
      });
      units++;
    }
  }

  console.log(`Size types: ${types}, units: ${units}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
