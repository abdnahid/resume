/**
 * Reads a worksheet into a merge-resolved grid.
 *
 * The wings' parameter files carry their hierarchy in merged cells — a product,
 * a sub-product, a standard, a fee and a duration are each written once and
 * span the rows beneath. Read without filling the merges, every column but the
 * sub-parameter and the limit looks 90% empty.
 */
import * as XLSX from "xlsx";

export type Grid = {
  /** Merge-resolved value at a 0-based row and column. Never null. */
  at(row: number, col: number): string;
  /** 0-based index of the last row holding any value. */
  lastRow: number;
  sheetName: string;
};

const clean = (v: string) => v.replace(/\s+/g, " ").trim();

export function readGrid(file: string, sheetMatch?: (n: string) => boolean): Grid {
  const wb = XLSX.readFile(file);
  const sheetName = sheetMatch
    ? (wb.SheetNames.find(sheetMatch) ?? wb.SheetNames[0])
    : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws?.["!ref"]) throw new Error(`sheet ${sheetName} in ${file} is empty`);

  const range = XLSX.utils.decode_range(ws["!ref"]);
  const cells = new Map<string, string>();
  const key = (r: number, c: number) => `${r},${c}`;

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const raw = cell.w !== undefined ? String(cell.w) : String(cell.v ?? "");
      const v = clean(raw);
      if (v) cells.set(key(r, c), v);
    }
  }

  for (const m of ws["!merges"] ?? []) {
    const v = cells.get(key(m.s.r, m.s.c));
    if (!v) continue;
    for (let r = m.s.r; r <= m.e.r; r++)
      for (let c = m.s.c; c <= m.e.c; c++) cells.set(key(r, c), v);
  }

  let lastRow = 0;
  for (const k of cells.keys()) lastRow = Math.max(lastRow, Number(k.split(",")[0]));

  return { at: (r, c) => cells.get(key(r, c)) ?? "", lastRow, sheetName };
}

/**
 * How to find one column by its header text.
 *
 * `exact` matches the normalised header outright; `prefix` is for headers that
 * carry a typo or a trailing note — "Sub-Product /Product Varient" is spelled
 * differently between files and only its opening is dependable.
 */
export type ColumnSpec = {
  exact?: string[];
  prefix?: string[];
  /** A column the file may legitimately not have. */
  optional?: boolean;
};

/** Lower-cased, punctuation and whitespace removed: `Total Test Fee` → `totaltestfee`. */
export const normalizeHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Resolve column positions from the header row instead of trusting their order.
 *
 * **The wings' files do not agree on order.** The textile list is
 * `… Standard Limit | Method | Test Fee …`; `lab-format-setup.xlsx` is
 * `… Standard Limit | Test Fee | Method …`. Reading by position imported one
 * file's methods as the other's fees — silently, because both columns are
 * populated and neither is obviously wrong afterwards. Headers are what the
 * wings actually keep stable, so they are what we key on.
 *
 * Throws rather than guessing: a missing or duplicated header means the file is
 * not the format we think it is, and continuing writes wrong money.
 */
export function resolveColumns<K extends string>(
  grid: Grid,
  specs: Record<K, ColumnSpec>,
  headerRow = 0,
  maxCol = 64,
): Record<K, number> {
  const headers: { col: number; raw: string; norm: string }[] = [];
  for (let c = 0; c < maxCol; c++) {
    const raw = grid.at(headerRow, c);
    if (raw) headers.push({ col: c, raw, norm: normalizeHeader(raw) });
  }

  const out = {} as Record<K, number>;
  const problems: string[] = [];

  for (const key of Object.keys(specs) as K[]) {
    const spec = specs[key];
    const hits = headers.filter(
      (h) =>
        (spec.exact ?? []).some((e) => h.norm === normalizeHeader(e)) ||
        (spec.prefix ?? []).some((pfx) => h.norm.startsWith(normalizeHeader(pfx))),
    );
    if (hits.length === 1) {
      out[key] = hits[0].col;
      continue;
    }
    if (hits.length === 0) {
      if (spec.optional) continue;
      problems.push(
        `no column headed ${(spec.exact ?? spec.prefix ?? []).map((x) => `"${x}"`).join(" or ")} (for "${key}")`,
      );
    } else {
      problems.push(
        `"${key}" matches ${hits.length} columns: ${hits.map((h) => `${h.raw}`).join(", ")}`,
      );
    }
  }

  if (problems.length)
    throw new Error(
      `Cannot read ${grid.sheetName}:\n` +
        problems.map((p) => `  • ${p}`).join("\n") +
        `\n  headers found: ${headers.map((h) => h.raw).join(" | ")}`,
    );

  return out;
}
