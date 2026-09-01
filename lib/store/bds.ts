/**
 * BDS store — catalogue queries.
 *
 * SERVER ONLY: this module imports Prisma. Client components must import the
 * facet vocabulary from `./bds-catalog` instead.
 *
 * Everything the browse page needs comes from `searchBds()`: the page of
 * results, the total, and the counts for each facet value. Facet counts are
 * computed against the *other* active filters so a count never promises rows
 * that clicking it wouldn't return.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  PAGE_SIZE,
  PRICE_BANDS,
  SORT_LABELS,
  DEFAULT_SORT,
  type BdsQuery,
  type SortKey,
  type BdsCard,
} from "./bds-catalog";

export * from "./bds-catalog";

/** Sort definitions. Prisma-typed, so they cannot live in the shared module. */
export const SORT_ORDER_BY = {
  newest: [{ publishedOn: "desc" }, { number: "desc" }],
  oldest: [{ publishedOn: "asc" }, { number: "asc" }],
  "price-asc": [{ priceBdt: "asc" }, { number: "asc" }],
  "price-desc": [{ priceBdt: "desc" }, { number: "asc" }],
  number: [{ number: "asc" }],
} satisfies Record<SortKey, Prisma.BdsOrderByWithRelationInput[]>;

/** Sort key → label, for rendering the sort control. */
export const SORTS = SORT_LABELS;

/**
 * Builds the `where` clause. `omit` drops one filter so a facet can be counted
 * as if only the *other* filters applied — otherwise selecting one division
 * would zero out every other division's count.
 */
function buildWhere(query: BdsQuery, omit?: "division" | "price"): Prisma.BdsWhereInput {
  const where: Prisma.BdsWhereInput = { status: "current" };

  if (query.q) {
    where.OR = [
      { number: { contains: query.q, mode: "insensitive" } },
      { titleEn: { contains: query.q, mode: "insensitive" } },
      { titleBn: { contains: query.q, mode: "insensitive" } },
    ];
  }

  if (query.mandatory === "1") where.isMandatory315 = true;

  if (query.division && omit !== "division") {
    where.division = { slug: query.division };
  }

  // `days` is a shortcut for a lower date bound; an explicit `from` wins.
  const publishedOn: Prisma.DateTimeNullableFilter = {};
  if (query.from) {
    publishedOn.gte = new Date(query.from);
  } else if (query.days) {
    const since = new Date();
    since.setDate(since.getDate() - query.days);
    publishedOn.gte = since;
  }
  if (query.to) {
    // Inclusive of the chosen day.
    const until = new Date(query.to);
    until.setHours(23, 59, 59, 999);
    publishedOn.lte = until;
  }
  if (publishedOn.gte || publishedOn.lte) where.publishedOn = publishedOn;

  if (omit !== "price") {
    // An explicit min/max pair overrides the band, since typing a number is a
    // more specific act than leaving a band selected.
    const band = PRICE_BANDS.find((b) => b.slug === query.band);
    const min = query.min ?? band?.min ?? undefined;
    const max = query.max ?? band?.max ?? undefined;
    if (min !== undefined || max !== undefined) {
      where.priceBdt = {
        ...(min !== undefined ? { gte: min } : {}),
        ...(max !== undefined ? { lte: max } : {}),
      };
    }
  }

  return where;
}

export type BdsSearchResult = {
  items: BdsCard[];
  total: number;
  page: number;
  pageCount: number;
  divisionFacets: { slug: string; nameEn: string; nameBn: string; count: number }[];
  bandFacets: { slug: string; label: string; count: number }[];
};

export async function searchBds(query: BdsQuery): Promise<BdsSearchResult> {
  const where = buildWhere(query);
  const page = query.page ?? 1;
  const orderBy = SORT_ORDER_BY[query.sort ?? DEFAULT_SORT];

  const [items, total, divisions, divisionCounts] = await Promise.all([
    prisma.bds.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        number: true,
        slug: true,
        titleEn: true,
        edition: true,
        year: true,
        publishedOn: true,
        priceBdt: true,
        priceIsPlaceholder: true,
        isMandatory315: true,
        division: { select: { slug: true, nameEn: true, nameBn: true } },
      },
    }),
    prisma.bds.count({ where }),
    prisma.bdsDivision.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.bds.groupBy({
      by: ["divisionId"],
      where: buildWhere(query, "division"),
      _count: { _all: true },
    }),
  ]);

  const countByDivision = new Map(divisionCounts.map((row) => [row.divisionId, row._count._all]));

  // One count per band. Cheap at catalogue scale; revisit if it ever isn't.
  const priceWhere = buildWhere(query, "price");
  const bandFacets = await Promise.all(
    PRICE_BANDS.map(async (band) => ({
      slug: band.slug,
      label: band.label,
      count: await prisma.bds.count({
        where: {
          ...priceWhere,
          priceBdt: {
            ...(band.min !== null ? { gte: band.min } : {}),
            ...(band.max !== null ? { lte: band.max } : {}),
          },
        },
      }),
    })),
  );

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    divisionFacets: divisions.map((division) => ({
      slug: division.slug,
      nameEn: division.nameEn,
      nameBn: division.nameBn,
      count: countByDivision.get(division.id) ?? 0,
    })),
    bandFacets,
  };
}

export async function getBdsBySlug(slug: string) {
  return prisma.bds.findUnique({
    where: { slug },
    include: {
      division: true,
      supersededBy: { select: { slug: true, number: true, titleEn: true } },
    },
  });
}

/** Same division, excluding the standard itself. Used on the detail page. */
export async function getRelatedBds(divisionId: number, excludeId: number) {
  return prisma.bds.findMany({
    where: { divisionId, status: "current", id: { not: excludeId } },
    orderBy: { publishedOn: "desc" },
    take: 4,
    select: {
      slug: true,
      number: true,
      titleEn: true,
      priceBdt: true,
        priceIsPlaceholder: true,
      division: { select: { nameEn: true } },
    },
  });
}

export async function getFeaturedBds() {
  const [newest, mandatory] = await Promise.all([
    prisma.bds.findMany({
      where: { status: "current" },
      orderBy: { publishedOn: "desc" },
      take: 4,
      select: {
        slug: true, number: true, titleEn: true, priceBdt: true, priceIsPlaceholder: true, publishedOn: true,
        division: { select: { nameEn: true } },
      },
    }),
    prisma.bds.count({ where: { status: "current", isMandatory315: true } }),
  ]);
  const total = await prisma.bds.count({ where: { status: "current" } });
  return { newest, mandatoryCount: mandatory, total };
}

