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
