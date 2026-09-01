/**
 * BDS store — the catalogue's shared vocabulary: facet definitions, the query
 * shape, and its URL encoding.
 *
 * Deliberately free of any Prisma import so client components can use it. The
 * database queries live in `./bds.ts` and are server-only — importing that from
 * a client component drags `pg` into the browser bundle and breaks the build.
 */
export const PAGE_SIZE = 12;

/** Price bands, matching the Standards Wing's published bands. */
export const PRICE_BANDS = [
  { slug: "below-100", label: "Below ৳ 100", min: null, max: 100 },
  { slug: "101-1000", label: "৳ 101 – ৳ 1,000", min: 101, max: 1000 },
  { slug: "1001-5000", label: "৳ 1,001 – ৳ 5,000", min: 1001, max: 5000 },
  { slug: "5001-10000", label: "৳ 5,001 – ৳ 10,000", min: 5001, max: 10000 },
  { slug: "10001-50000", label: "৳ 10,001 – ৳ 50,000", min: 10001, max: 50000 },
  { slug: "above-50000", label: "Above ৳ 50,000", min: 50001, max: null },
] as const;

export type PriceBand = (typeof PRICE_BANDS)[number];

export const DAY_RANGES = [10, 20, 30, 40, 50] as const;

export const SORT_LABELS = {
  newest: "Newest first",
  oldest: "Oldest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  number: "BDS number",
} as const;

export type SortKey = keyof typeof SORT_LABELS;
export const DEFAULT_SORT: SortKey = "newest";

/** Raw query string, already narrowed to the params we honour. */
export type BdsQuery = {
  q?: string;
  division?: string;
  from?: string;
  to?: string;
  days?: number;
  band?: string;
  min?: number;
  max?: number;
  /** "1" restricts to the 315 products under mandatory certification. */
  mandatory?: string;
  sort?: SortKey;
  page?: number;
};

/**
 * Parses `searchParams` into a `BdsQuery`, dropping anything malformed rather
 * than erroring — a hand-edited URL should degrade, not 500.
 */
export function parseBdsQuery(
  searchParams: Record<string, string | string[] | undefined>,
): BdsQuery {
  const one = (key: string) => {
    const value = searchParams[key];
    const found = Array.isArray(value) ? value[0] : value;
    return found?.trim() || undefined;
  };
  const int = (key: string) => {
    const value = Number(one(key));
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
  };
  const date = (key: string) => {
    const value = one(key);
    return value && !Number.isNaN(Date.parse(value)) ? value : undefined;
  };

  const sort = one("sort");
  const days = int("days");
  const band = one("band");
  const page = int("page");

  return {
    q: one("q"),
    division: one("division"),
    from: date("from"),
    to: date("to"),
    days: days && (DAY_RANGES as readonly number[]).includes(days) ? days : undefined,
    band: band && PRICE_BANDS.some((b) => b.slug === band) ? band : undefined,
    min: int("min"),
    max: int("max"),
    mandatory: one("mandatory") === "1" ? "1" : undefined,
    sort: sort && sort in SORT_LABELS ? (sort as SortKey) : undefined,
    page: page && page > 0 ? page : 1,
  };
}

/** Serialises a query back to a `?…` string, dropping empties and page 1. */
export function bdsQueryToString(query: BdsQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "" || (key === "page" && value === 1)) continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}


/** The projection the browse grid renders. */
export type BdsCard = {
  id: number;
  number: string;
  slug: string;
  titleEn: string;
  edition: string | null;
  year: number;
  publishedOn: Date | null;
  priceBdt: number;
  /// True when `priceBdt` is the importer's ৳0 stand-in rather than BSTI's
  /// price. Carried on the card so every surface can show the same figure the
  /// gateway will actually charge — see `salePricePolicy()` below.
  priceIsPlaceholder: boolean;
  isMandatory315: boolean;
  division: { slug: string; nameEn: string; nameBn: string };
};

export function formatTaka(amount: number): string {
  return `৳ ${amount.toLocaleString("en-IN")}`;
}

/**
 * What a standard actually sells for, and whether that figure is BSTI's.
 *
 * The published mandatory-certification list gives designations, not prices, so
 * the 375 catalogue rows the importer created carry a ৳0 stand-in and
 * `priceIsPlaceholder`. D45 refused to sell those at all — correct, but it left
 * every mandatory standard unbuyable and therefore every CM application
 * uncompletable.
 *
 * **D49: a demo price stands in while the platform runs on the sandbox
 * gateway**, where no real money can move and every payment is stamped
 * `isSandbox` for ever. A made-up price charged against no money is a working
 * flow; refusing outright is a flow nobody can walk. What D45 was protecting —
 * that nobody is quietly charged an invented amount — is kept by *labelling*:
 * `isProvisional` travels with the price to the buy button, the application, the
 * store card and the receipt.
 *
 * One function, per D8. When the Standards Wing's list lands, load it onto
 * `Bds.priceBdt` and clear `priceIsPlaceholder`; this stops applying by itself,
 * because it only ever substitutes for a placeholder row.
 */
export const DEMO_PRICE_BDT = 500;

export function salePricePolicy(bds: { priceBdt: number; priceIsPlaceholder: boolean }): {
  priceBdt: number;
  isProvisional: boolean;
  note?: string;
} {
  if (!bds.priceIsPlaceholder) return { priceBdt: bds.priceBdt, isProvisional: false };
  return {
    priceBdt: DEMO_PRICE_BDT,
    isProvisional: true,
    note: "BSTI has not published this standard's price to the system yet. A provisional price is shown so the application can be completed; it is not the price you will finally be charged.",
  };
}
