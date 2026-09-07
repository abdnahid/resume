/**
 * Reads the tables out of a `.docx`, the way `xlsx-grid.ts` reads a spreadsheet.
 *
 * The Chemical Testing Wing publishes its parameter catalogue as Word documents
 * rather than spreadsheets, so this is the counterpart of the grid reader — and
 * it exists for the same reason: **the hierarchy is carried by cells that are
 * empty on purpose**, and a reader that does not fill them downward sees a
 * table that is 90% blank.
 *
 * Two things about Word tables that a naive reader gets wrong:
 *
 * - **A "same as above" cell is expressed two different ways.** Sometimes it is
 *   a real vertical merge (`vMerge`), sometimes the author simply left the cell
 *   blank. In the chemical files 2,294 rows are merged and 1,627 are blank, so
 *   honouring merges alone splits one product into dozens. Both are treated as
 *   "carry the value down".
 * - **A horizontally merged cell occupies several columns** (`gridSpan`), so
 *   cell *index* is not column *number*. Read by index and every column after
 *   the first merge is off by one.
 *
 * Prisma-free and side-effect free (D9), so it can be unit-tested against a
 * file without a database.
 */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

// ── the container ──────────────────────────────────────────────────────────
// A .docx is an ordinary ZIP. Only one entry is ever needed, so the reader
// walks the central directory rather than pulling in a zip dependency for a
// format that has not changed since 1993.

const EOCD = 0x06054b50;
const CEN = 0x02014b50;

function readZipEntry(file: string, want: string): Buffer {
  const buf = readFileSync(file);

  // The end-of-central-directory record is last, after a comment of unknown
  // length, so it is found by scanning backwards for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error(`${file}: not a zip archive (no end-of-central-directory record)`);

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== CEN) throw new Error(`${file}: corrupt central directory at ${p}`);
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);

    if (name === want) {
      // The local header repeats the name and extra fields, and its extra
      // length may differ from the central directory's — so the data offset is
      // computed from the local header, never from the central one.
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(start, start + compressedSize);
      if (method === 0) return Buffer.from(raw);
      if (method === 8) return inflateRawSync(raw);
      throw new Error(`${file}: ${want} uses unsupported compression method ${method}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${file}: ${want} not found in the archive`);
}

// ── the document ───────────────────────────────────────────────────────────
// WordprocessingML is verbose but shallow for our purposes: a table is <w:tbl>,
// a row <w:tr>, a cell <w:tc>, and text lives in <w:t> inside <w:r> inside
// <w:p>. Rather than a general XML parser this walks the tag stream, which is
// enough for a document that is one table and is what keeps this file free of
// dependencies.

const TAG = /<(\/?)w:(tbl|tr|tc|p|t|br|cr|tab|gridSpan|vMerge)\b([^>]*)>/g;

function attr(raw: string, name: string): string | null {
  const m = raw.match(new RegExp(`w:${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

export type DocxCell = {
  /** Every paragraph in the cell, joined — the wing splits one fact over several. */
  text: string;
  /** How many grid columns this cell occupies. */
  span: number;
  /** "restart" begins a vertical merge, "continue" carries the one above down. */
  vMerge: "restart" | "continue" | null;
};

export type DocxTable = DocxCell[][];

/** Every table in the document, in order. */
export function readTables(file: string): DocxTable[] {
  const xml = readZipEntry(file, "word/document.xml").toString("utf8");

  const tables: DocxTable[] = [];
  let table: DocxTable | null = null;
  let row: DocxCell[] | null = null;
  let cell: DocxCell | null = null;
  let paras: string[] = [];
  let text: string[] = [];
  let inText = false;
  let textStart = 0;
  // Depth guards: a nested table would otherwise close its parent's row.
  let depth = 0;

  TAG.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG.exec(xml))) {
    const [full, close, tag, rest] = m;
    const isClose = close === "/";
    const selfClosing = rest.trimEnd().endsWith("/");

    if (inText && tag === "t" && isClose) {
      text.push(unescapeXml(xml.slice(textStart, m.index)));
      inText = false;
      continue;
    }
    if (inText) continue;

    switch (tag) {
      case "tbl":
        if (isClose) { depth--; if (depth === 0 && table) { tables.push(table); table = null; } }
        else { depth++; if (depth === 1) table = []; }
        break;
      case "tr":
        if (depth !== 1) break;
        if (isClose) { if (row && table) table.push(row); row = null; }
        else row = [];
        break;
      case "tc":
        if (depth !== 1) break;
        if (isClose) {
          if (cell && row) {
            if (text.length) paras.push(text.join(""));
            cell.text = paras.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean).join(" / ");
            row.push(cell);
          }
          cell = null; paras = []; text = [];
        } else { cell = { text: "", span: 1, vMerge: null }; paras = []; text = []; }
        break;
      case "p":
        if (!cell) break;
        if (isClose) { paras.push(text.join("")); text = []; }
        break;
      case "t":
        if (!cell || isClose || selfClosing) break;
        inText = true; textStart = m.index + full.length;
        break;
      case "br": case "cr": case "tab":
        if (cell && !isClose) text.push(" ");
        break;
      case "gridSpan":
        if (cell && !isClose) cell.span = Number(attr(rest, "val")) || 1;
        break;
      case "vMerge":
        if (cell && !isClose) {
          const v = attr(rest, "val");
          cell.vMerge = v === "restart" ? "restart" : "continue";
        }
        break;
    }
  }
  return tables;
}

/**
 * One table as a rectangular grid of strings, with **every blank carried down
 * from the row above** — merged or simply left empty, which the wing's files
 * use interchangeably.
 *
 * `gridSpan` is expanded so a cell that covers three columns appears in all
 * three: reading by cell index instead would put every column after a merge
 * one place to the left.
 */
export function fillGrid(table: DocxTable, opts: { carryDown?: number[] } = {}): string[][] {
  const carry = opts.carryDown ?? null;
  const out: string[][] = [];
  let previous: string[] = [];

  for (const row of table) {
    const flat: string[] = [];
    for (const c of row) for (let i = 0; i < c.span; i++) flat.push(i === 0 ? c.text : "");

    const resolved = flat.map((v, i) => {
      const mayCarry = carry === null || carry.includes(i);
      return v.trim() === "" && mayCarry ? (previous[i] ?? "") : v;
    });
    out.push(resolved);
    previous = resolved;
  }
  return out;
}
