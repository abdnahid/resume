/**
 * Shaping for the 2D map — Prisma-free (D9), so the server page and the client
 * grid agree on what a cell means without either importing the other's half.
 *
 * **The map is offices down one axis and parameters down the other**, and the
 * cell is the laboratory that runs that test for a sample received at that
 * office. That is the client's own framing: an application filed at Khulna may
 * have some parameters testable at Khulna, some that must go to Faridpur and
 * some that only head office can run — and which is which is an
 * administrative decision, not a derivable one (D64).
 *
 * The whole map is 23 offices × 4,767 parameters = 109,641 cells, so it is
 * never rendered whole. One package at a time is the unit anybody actually
 * works in.
 */

export type MatrixLab = {
  id: number;
  nameEn: string;
  discipline: string;
  officeId: number;
  officeName: string;
  isActive: boolean;
};

export type MatrixCell = {
  labId: number | null;
  isPlaceholder: boolean;
  mode: string;
  /** True when the sample leaves the receiving office. The point of the map. */
  away: boolean;
  /** True when the named lab cannot actually run this test, or is closed. */
  broken: boolean;
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
 * "Chemistry Lab, Khulna" → "Chemistry Lab"; "Textile, Head Office" →
 * "Textile". The city is already the column, so it is dropped from the cell —
 * except when the sample is going somewhere else, where it is the whole point.
 */
export function labShortName(nameEn: string): string {
  return nameEn.split(",")[0].trim() || nameEn;
}

/** What a cell reads when the sample stays put, and when it travels. */
export function cellLabel(lab: MatrixLab, atOfficeId: number): string {
  const short = labShortName(lab.nameEn);
  return lab.officeId === atOfficeId ? short : `→ ${officeShortName(lab.officeName)}`;
}

export function buildMatrix(args: {
  offices: { id: number }[];
  parameters: { id: number }[];
  routings: { officeId: number; parameterId: number; labId: number; mode: string; isPlaceholder: boolean }[];
  /** `labId:parameterId` for every capability a lab actually holds. */
  capable: Set<string>;
  labs: Map<number, MatrixLab>;
}): Map<string, MatrixCell> {
  const cells = new Map<string, MatrixCell>();

  for (const r of args.routings) {
    const lab = args.labs.get(r.labId);
    cells.set(`${r.officeId}:${r.parameterId}`, {
      labId: r.labId,
      isPlaceholder: r.isPlaceholder,
      mode: r.mode,
      away: lab ? lab.officeId !== r.officeId : false,
      // A row pointing at a lab that has since dropped the capability, or been
      // closed, is not followed — `resolveDestinations()` refuses it. Showing
      // that here is how somebody finds out before a field officer does.
      broken: !lab || !lab.isActive || !args.capable.has(`${r.labId}:${r.parameterId}`),
    });
  }
  return cells;
}

/** Cells still resting on the seed, per office (D66). */
export function placeholderCount(
  cells: Map<string, MatrixCell>,
  officeId: number,
  parameterIds: number[],
): number {
  return parameterIds.filter((p) => cells.get(`${officeId}:${p}`)?.isPlaceholder ?? true).length;
}
