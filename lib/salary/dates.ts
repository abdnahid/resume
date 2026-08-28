/**
 * Date handling for salary fixation.
 *
 * Fixation dates are stored `MM-DD-YYYY` — the format every pre-existing row in
 * this database already uses. `lib/dateHelpers.ts` handles `DD-MM-YYYY` for the
 * PDS documents; the two are deliberately separate so neither silently parses
 * the other's strings.
 *
 * Prisma-free (D9): imported by the edge of the client bundle as well as the
 * route handler.
 */

/** `MM-DD-YYYY`, the stored form. */
export type StoredDate = string;

/**
 * Accepts `MM-DD-YYYY` (stored) or `YYYY-MM-DD` (what `<input type="date">`
 * emits) and returns the stored form. Null when the string is not a real
 * calendar date — 02-31 and friends, which `Date` otherwise rolls over.
 */
export function toStoredDate(input: unknown): StoredDate | null {
  if (typeof input !== "string") return null;

  let y: number, m: number, d: number;
  const ymd = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const mdy = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (ymd) [y, m, d] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
  else if (mdy) [m, d, y] = [Number(mdy[1]), Number(mdy[2]), Number(mdy[3])];
  else return null;

  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }

  return `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}-${y}`;
}

/** Stored `MM-DD-YYYY` → the `YYYY-MM-DD` an `<input type="date">` wants. */
export function toInputDate(stored: string): string {
  const m = stored.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : "";
}

/** Stored date → a sortable/comparable integer. Assumes a validated string. */
export function dateKey(stored: string): number {
  const [m, d, y] = stored.split("-").map(Number);
  return y * 10000 + m * 100 + d;
}

/** Today in stored form, in local time. */
export function todayStored(): StoredDate {
  const t = new Date();
  return `${String(t.getMonth() + 1).padStart(2, "0")}-${String(
    t.getDate(),
  ).padStart(2, "0")}-${t.getFullYear()}`;
}

/** The day before `stored`. Used to close the version a new one supersedes. */
export function dayBefore(stored: StoredDate): StoredDate {
  const [m, d, y] = stored.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - 1);
  return `${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(
    t.getUTCDate(),
  ).padStart(2, "0")}-${t.getUTCFullYear()}`;
}

/**
 * The Bangladeshi fiscal year containing `on` — 1 July to 30 June.
 * A fixation raised in, say, March 2027 belongs to FY 2026-27, which began on
 * 1 July 2026.
 */
export function fiscalYear(on: Date = new Date()): {
  from: StoredDate;
  thru: StoredDate;
  label: string;
} {
  const y = on.getMonth() >= 6 ? on.getFullYear() : on.getFullYear() - 1;
  return {
    from: `07-01-${y}`,
    thru: `06-30-${y + 1}`,
    label: `${y}-${String((y + 1) % 100).padStart(2, "0")}`,
  };
}

/** Last day of a named month, in stored form. Months are English names. */
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthIndex(name: string): number {
  return MONTHS.indexOf(name) + 1;
}

export function lastDayOfMonth(month: string, year: string): StoredDate | null {
  const m = monthIndex(month);
  const y = Number(year);
  if (m < 1 || !Number.isInteger(y)) return null;
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}-${y}`;
}

/** Does `[from, thru]` cover `on`? All three are stored dates. */
export function covers(from: string, thru: string, on: string): boolean {
  const k = dateKey(on);
  return dateKey(from) <= k && k <= dateKey(thru);
}

/** The day after `stored`. The mirror of `dayBefore`. */
export function nextDay(stored: StoredDate): StoredDate {
  const [m, d, y] = stored.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + 1);
  return `${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(
    t.getUTCDate(),
  ).padStart(2, "0")}-${t.getUTCFullYear()}`;
}
