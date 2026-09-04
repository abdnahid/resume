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
