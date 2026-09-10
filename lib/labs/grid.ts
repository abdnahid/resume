/**
 * Shaping for the 2D map — Prisma-free (D9), so the server page and the client
 * grid agree on what a cell means without either importing the other's half.
 *
 * **Offices across, tests down, and the cell says whether that office can run
 * that test** — on its own bench or by sending it out. That is the client's own
 * framing: an application filed at Faridpur may have some parameters testable
 * at Faridpur, some at any of Khulna, Dhaka or Chittagong, and some only
 * outside — and reading it as a grid is how you see which.
 *
 * It used to hold a single chosen destination per cell, which meant every one
 * of 109,802 had to be answered before anything resolved. It holds capability
 * now (D116), which is sparse: a cell is filled only where an office has said
 * something. One package at a time, always.
 */

export type MatrixLab = {
  id: number;
  nameEn: string;
  discipline: string;
  officeId: number;
  officeName: string;
  isActive: boolean;
};

/**
 * "Divisional Office, BSTI, Khulna" → "Khulna".
 *
 * The register spells every office as a type, the institution and a city, so
 * the city is the last segment and the only part that differs between columns.
 * A header 23 wide has room for nothing else.
 */
export function officeShortName(nameEn: string): string {
  const parts = nameEn.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || nameEn;
}

/**
 * Short names for a set of offices, **disambiguated**.
 *
 * The city alone is not unique: *Head Office, BSTI, Dhaka* and *DMI, BSTI,
 * Dhaka* both end in it, so the 23-column map had two columns headed "Dhaka" —
 * on the very screen where an office picks where its samples go. Where a city
 * is shared, the office's own first segment is used instead, which is what
 * distinguishes them in speech as well.
 */
export function officeShortNames(
  offices: { id: number; nameEn: string }[],
): Map<number, string> {
  const byCity = new Map<string, number[]>();
  for (const o of offices) {
    const city = officeShortName(o.nameEn);
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city)!.push(o.id);
  }
  const out = new Map<number, string>();
  for (const o of offices) {
    const city = officeShortName(o.nameEn);
    const first = o.nameEn.split(",")[0].trim();
    out.set(o.id, byCity.get(city)!.length > 1 && first ? first : city);
  }
  return out;
}

/** "Chemistry Lab, Khulna" → "Chemistry Lab"; the city is already the column. */
export function labShortName(nameEn: string): string {
  return nameEn.split(",")[0].trim() || nameEn;
}

export type MatrixCell = {
  /** How this office covers the test, or null where it does not. */
  manner: "in_house" | "third_party" | null;
  /** True when this is where the receiving office prefers to send it. */
  preferred: boolean;
};

export function buildMatrix(args: {
  capabilities: { officeId: number; parameterId: number; manner: string }[];
  preferences: { officeId: number; parameterId: number; toOfficeId: number }[];
  /** The office the application would be received at — whose preferences count. */
  fromOfficeId: number | null;
}): Map<string, MatrixCell> {
  const preferred = new Set(
    args.preferences
      .filter((p) => p.officeId === args.fromOfficeId)
      .map((p) => `${p.toOfficeId}:${p.parameterId}`),
  );
  const cells = new Map<string, MatrixCell>();
  for (const c of args.capabilities) {
    const key = `${c.officeId}:${c.parameterId}`;
    cells.set(key, {
      manner: c.manner === "third_party" ? "third_party" : "in_house",
      preferred: preferred.has(key),
    });
  }
  return cells;
}

/** How many of a package's tests this office covers. */
export function coveredCount(
  cells: Map<string, MatrixCell>,
  officeId: number,
  parameterIds: number[],
): number {
  return parameterIds.filter((p) => cells.get(`${officeId}:${p}`) !== undefined).length;
}

/**
 * The slug a hand-created laboratory gets — Prisma-free so the form can show it
 * before anything is saved.
 *
 * The 46 seeded labs are slugged `lab-<organogram unit slug>`, which is what
 * makes `seed:labs` idempotent: it upserts on that key and rewrites the row it
 * finds. A lab created here has no organogram unit to take a slug from, so it
 * is built from the office and the name instead — and, crucially, **cannot
 * collide with the shape the seed writes**, because no organogram unit slug is
 * an office city. That is what keeps a hand-created bench out of the seed's
 * reach rather than merely lucky.
 *
 * Uniqueness is still the database's to enforce; `createLab()` suffixes on
 * collision.
 */
export function labSlugBase(officeName: string, nameEn: string): string {
  const part = (s: string) =>
    s
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const city = part(officeShortName(officeName));
  const name = part(nameEn);
  // A name that already ends in the city — "Microbiology Lab, Khulna" — should
  // not become `lab-khulna-microbiology-lab-khulna`.
  const trimmed = city && name.endsWith(`-${city}`) ? name.slice(0, -(city.length + 1)) : name;
  return ["lab", city, trimmed].filter(Boolean).join("-");
}
