/**
 * Imports BSTI's published list of 315 mandatory-certification products.
 *
 *   npm run import:products -- --dry     report only, no writes
 *   npm run import:products              upsert
 *
 * Source: `prisma/data/mandatory-315.json`, parsed from `utils/mandatory
 * list.pdf` by `parse-mandatory-315.py`. Real BSTI data.
 *
 * **The catalogue does not hold most of these standards.** The list names 376
 * designations; the seeded store catalogue holds 55 rows, of which all but one
 * are plausible placeholders invented to exercise the store facets. So this
 * importer *creates* the missing catalogue rows, and marks every one it creates
 * `isFromMandatoryList` + `priceIsPlaceholder`, because the one thing the
 * published list does not carry is the Standards Wing price. A created row is a
 * real designation with a made-up price, and the store must not sell it as
 * though the price were real.
 *
 * Idempotent: upserts on natural keys (category letter, product serial, BDS
 * number) and never deletes.
 */
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DRY = process.argv.includes("--dry");

type Item = {
  serial: number;
  category: string;
  categoryLetter: string;
  name: string;
  genericNames: string[];
  standards: string[];
};

/** The mandatory list's five headings onto the store's existing divisions. */
const DIVISION_BY_LETTER: Record<string, string> = {
  A: "agriculture-and-food",
  B: "chemical",
  C: "civil-and-mechanical-engineering",
  D: "jute-and-textile",
  E: "electrical-and-electronics",
};

const CATEGORY_BN: Record<string, string> = {
  A: "কৃষি ও খাদ্যজাত পণ্য",
  B: "রাসায়নিক পণ্য",
  C: "প্রকৌশল পণ্য",
  D: "পাট ও বস্ত্র পণ্য",
  E: "বৈদ্যুতিক ও ইলেকট্রনিক পণ্য",
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "item";

/**
 * "BDS 25:2015 Amendmentment-1:2020" -> "BDS 25:2015"
 *
 * The designation as printed carries the revision and amendment wording; the
 * catalogue's `number` is the bare designation, so the two must be reconciled
 * before matching or a row is created twice.
 */
function coreNumber(printed: string): string {
  const m = printed.match(/^BDS\s+((?:[A-Z]+\s+)*[\w\-().,/ ]*?\d[\w\-()./]*)\s*:\s*(\d{4})/);
  if (m) return `BDS ${m[1].replace(/\s+/g, " ").trim()}:${m[2]}`;
  return printed.replace(/\s+/g, " ").trim();
}

function yearOf(number: string): number {
  const m = number.match(/:(\d{4})/);
  return m ? Number(m[1]) : 0;
}

async function main() {
  const file = path.join(__dirname, "..", "data", "mandatory-315.json");
  const items: Item[] = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`${items.length} products read from ${path.relative(process.cwd(), file)}`);
  if (DRY) console.log("DRY RUN — no writes\n");

  const divisions = await prisma.bdsDivision.findMany({ select: { id: true, slug: true } });
  const divisionId = new Map(divisions.map((d) => [d.slug, d.id]));
  for (const slug of Object.values(DIVISION_BY_LETTER)) {
    if (!divisionId.has(slug)) throw new Error(`Division "${slug}" is missing — run npm run seed:bds first.`);
  }

  // ---- categories ----------------------------------------------------------
  const catId = new Map<string, number>();
  const letters = [...new Set(items.map((i) => i.categoryLetter))].sort();
  for (const letter of letters) {
    const name = items.find((i) => i.categoryLetter === letter)!.category;
    if (DRY) { console.log(`category ${letter}: ${name}`); continue; }
    const row = await prisma.productCategory.upsert({
      where: { letter },
      update: { nameEn: name, nameBn: CATEGORY_BN[letter] ?? null },
      create: {
        letter, slug: slugify(name), nameEn: name,
        nameBn: CATEGORY_BN[letter] ?? null, sortOrder: letters.indexOf(letter),
      },
    });
    catId.set(letter, row.id);
  }

  // ---- standards -----------------------------------------------------------
  const printedByCore = new Map<string, string>();
  const letterByCore = new Map<string, string>();
  for (const it of items) {
    for (const p of it.standards) {
      const c = coreNumber(p);
      if (!printedByCore.has(c)) { printedByCore.set(c, p); letterByCore.set(c, it.categoryLetter); }
    }
  }
  const existing = await prisma.bds.findMany({ select: { id: true, number: true } });
  const bdsId = new Map(existing.map((b) => [b.number, b.id]));
  const toCreate = [...printedByCore.keys()].filter((n) => !bdsId.has(n));

  console.log(`\n${printedByCore.size} distinct designations; ${printedByCore.size - toCreate.length} already in the catalogue, ${toCreate.length} to create`);

  if (!DRY && toCreate.length) {
    // The database is remote, so one round trip per row costs minutes. Every
    // write below is batched for that reason.
    const ownerOf = new Map<string, Item>();
    for (const it of items)
      for (const p of it.standards) {
        const c = coreNumber(p);
        if (!ownerOf.has(c)) ownerOf.set(c, it);
      }
    const usedBdsSlug = new Set((await prisma.bds.findMany({ select: { slug: true } })).map((b) => b.slug));
    await prisma.bds.createMany({
      skipDuplicates: true,
      data: toCreate.map((number) => {
        let slug = slugify(number);
        while (usedBdsSlug.has(slug)) slug = `${slug}-x`;
        usedBdsSlug.add(slug);
        return {
          number,
          slug,
          // The published list gives no title, only the product it certifies.
          // Naming the row after that product is the truest thing available and
          // is corrected when the Standards Wing catalogue arrives.
          titleEn: ownerOf.get(number)!.name,
          year: yearOf(number),
          priceBdt: 0,
          priceIsPlaceholder: true,
          isFromMandatoryList: true,
          divisionId: divisionId.get(DIVISION_BY_LETTER[letterByCore.get(number)!])!,
        };
      }),
    });
    for (const b of await prisma.bds.findMany({ select: { id: true, number: true } })) bdsId.set(b.number, b.id);
  }

  // ---- products ------------------------------------------------------------
  const usedSlug = new Set<string>();
  const rows = items.map((it) => {
    let slug = slugify(it.name);
    if (usedSlug.has(slug)) slug = `${slug}-${it.serial}`;
    usedSlug.add(slug);
    return {
      serial: it.serial, slug, nameEn: it.name,
      genericNames: it.genericNames,
      categoryId: catId.get(it.categoryLetter)!,
    };
  });

  let linked = 0;
  if (!DRY) {
    await prisma.product.createMany({ data: rows, skipDuplicates: true });
    // Re-running must pick up corrections to names and generic names, which
    // createMany's skipDuplicates deliberately will not do.
    const existingProducts = await prisma.product.findMany({
      select: { id: true, serial: true, nameEn: true, genericNames: true, categoryId: true },
    });
    const productId = new Map(existingProducts.map((p) => [p.serial, p.id]));
    const before = new Map(existingProducts.map((p) => [p.serial, p]));
    // Only rows whose content actually moved. On a first run createMany has
    // already written everything, so this is empty; on a re-run after a parser
    // fix it is the handful that changed. Updating all 315 in one transaction
    // exceeded Prisma's 5s interactive limit against the remote database.
    const changed = rows.filter((r) => {
      const b = before.get(r.serial);
      return (
        !b ||
        b.nameEn !== r.nameEn ||
        b.categoryId !== r.categoryId ||
        b.genericNames.join("\u0000") !== r.genericNames.join("\u0000")
      );
    });
    for (const r of changed) {
      await prisma.product.update({
        where: { serial: r.serial },
        data: { nameEn: r.nameEn, genericNames: r.genericNames, categoryId: r.categoryId },
      });
    }
    if (changed.length) console.log(`products refreshed: ${changed.length}`);

    const links = items.flatMap((it) =>
      it.standards
        .map((printed, idx) => ({
          productId: productId.get(it.serial)!,
          bdsId: bdsId.get(coreNumber(printed)),
          isPrimary: idx === 0,
          asPrinted: printed,
        }))
        .filter((l): l is typeof l & { bdsId: number } => typeof l.bdsId === "number"),
    );
    const res = await prisma.productStandard.createMany({ data: links, skipDuplicates: true });
    linked = links.length;
    console.log(`\nproducts upserted : ${rows.length}`);
    console.log(`standards linked  : ${linked} (${res.count} new)`);
  }

  if (!DRY) {
    // A standard is mandatory because it certifies a mandatory product — the
    // flag is derived here rather than maintained by hand.
    const ids = await prisma.productStandard.findMany({ select: { bdsId: true } });
    const unique = [...new Set(ids.map((r) => r.bdsId))];
    await prisma.bds.updateMany({ where: { id: { in: unique } }, data: { isMandatory315: true } });
    await prisma.bds.updateMany({ where: { id: { notIn: unique } }, data: { isMandatory315: false } });
    console.log(`BDS rows flagged mandatory: ${unique.length}`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
