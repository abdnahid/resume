import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productEligibilityPolicy, salePricePolicy } from "@/lib/cm/policy";

/**
 * Search the CM product list — the 315 products under mandatory certification.
 *
 * Public, like the store it draws on. **This is a search over products, not
 * standards** (D44): a manufacturer knows they make toilet soap, not that they
 * make BDS 13:2021, so the product is what they pick and the standard follows
 * from it.
 *
 * The whole list is 315 rows, so it is read once and filtered in memory rather
 * than pushed into SQL. That is not a shortcut — `genericNames` is a text
 * array, and Postgres cannot do a substring match inside one through Prisma's
 * query API. Filtering here also lets an exact-prefix match rank above a match
 * buried mid-word, which is what makes typing "suji" find "Suji (Semolina)".
 */
type Row = Awaited<ReturnType<typeof load>>[number];

async function load() {
  return prisma.product.findMany({
    include: {
      category: { select: { letter: true, nameEn: true, nameBn: true } },
      standards: {
        include: { bds: { select: { id: true, number: true, titleEn: true, status: true, priceBdt: true, priceIsPlaceholder: true } } },
        orderBy: [{ isPrimary: "desc" as const }, { bdsId: "asc" as const }],
      },
    },
    orderBy: { serial: "asc" },
  });
}

/** Where the needle hit, so a prefix beats a mid-word match. */
function score(p: Row, q: string): number {
  if (!q) return 0;
  const fields = [p.nameEn, p.nameBn ?? "", ...p.genericNames].map((f) => f.toLowerCase());
  const numbers = p.standards.map((s) => s.bds.number.toLowerCase());

  let best = -1;
  for (const f of fields) {
    if (f.startsWith(q)) best = Math.max(best, 3);
    else if (f.includes(q)) best = Math.max(best, 2);
  }
  for (const n of numbers) {
    if (n.includes(q)) best = Math.max(best, 1);
  }
  return best;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  // `Number(null)` is 0 and `Number.isInteger(0)` is true, so an absent
  // parameter must be tested for as an absent parameter. Reading it the other
  // way is what made the old standard picker return nothing at all, for every
  // search: it silently filtered on a category that does not exist.
  const rawCategory = url.searchParams.get("category");
  const categoryLetter = rawCategory && rawCategory.trim() !== "" ? rawCategory.trim() : null;

  const [all, categories] = await Promise.all([
    load(),
    // Five rows. Returned with every search so the picker can offer the
    // category filter without a second round trip.
    prisma.productCategory.findMany({
      select: { letter: true, nameEn: true, nameBn: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const matched = all
    .filter((p) => (categoryLetter ? p.category.letter === categoryLetter : true))
    .map((p) => ({ p, s: score(p, q) }))
    .filter(({ s }) => s >= 0)
    .sort((a, b) => b.s - a.s || a.p.serial - b.p.serial)
    .slice(0, 40)
    .map(({ p }) => p);

  return NextResponse.json({
    total: all.length,
    categories,
    results: matched.map((p) => {
      const eligible = productEligibilityPolicy(p);
      return {
        id: p.id,
        serial: p.serial,
        nameEn: p.nameEn,
        nameBn: p.nameBn,
        genericNames: p.genericNames,
        category: { letter: p.category.letter, nameEn: p.category.nameEn },
        standards: p.standards.map((s) => ({
          id: s.bds.id,
          number: s.bds.number,
          titleEn: s.bds.titleEn,
          status: s.bds.status as string,
          asPrinted: s.asPrinted,
          isPrimary: s.isPrimary,
          price: salePricePolicy(s.bds),
        })),
        eligible: eligible.allowed,
        ineligibleReason: eligible.reason ?? null,
      };
    }),
  });
}
