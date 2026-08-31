/**
 * Money, and the Income/VAT split.
 *
 * Prisma-free (D9) — imported by the checkout UI as well as the server.
 *
 * **Amounts are integer poisha, never taka floats.** 15% of a whole-taka price
 * is fractional for any price that is not a multiple of 20 (৳350 → ৳52.50), and
 * a float would eventually make the two account totals disagree with the amount
 * actually charged. Poisha makes the split exact by construction.
 */

export const POISHA_PER_TAKA = 100;

/** The government VAT rate, in basis points. 1500 = 15% (spec §6). */
export const VAT_RATE_BP = 1500;

export function takaToPoisha(taka: number): number {
  return Math.round(taka * POISHA_PER_TAKA);
}

/** "৳1,234.50" — always two decimals, because a fee is a money amount. */
export function formatPoisha(poisha: number): string {
  const sign = poisha < 0 ? "-" : "";
  const abs = Math.abs(poisha);
  const taka = Math.floor(abs / POISHA_PER_TAKA);
  const rest = abs % POISHA_PER_TAKA;
  return `${sign}৳${taka.toLocaleString("en-BD")}.${String(rest).padStart(2, "0")}`;
}

export type FeeSplit = {
  /** The Income Fee account's share. */
  incomePoisha: number;
  /** The VAT account's share. */
  vatPoisha: number;
  /** What the payer is charged. Always `income + vat`, by construction. */
  totalPoisha: number;
  /** Snapshot of the rate used, so a later rate change cannot restate an old
   *  payment — the same reason `SalaryFixationItem` snapshots its head. */
  vatRateBp: number;
};

/**
 * Split a fee into the Income Fee account and the VAT account (spec §6).
 *
 * **[ASSUMPTION — needs Finance confirmation]** The catalogue price is treated
 * as VAT-*exclusive*: it is the income fee, and 15% VAT is added on top. The
 * other reading — that the printed price already includes VAT — gives a
 * different total for the same BDS, so this is a real question and not a
 * rounding detail.
 *
 * Isolated behind this one function (D8), so the answer changes one place.
 * Whichever way it is settled, `income + vat === total` must keep holding: the
 * e-Challan splits one payment across two accounts, and they have to reconcile.
 */
export function splitFee(incomePoisha: number, vatRateBp = VAT_RATE_BP): FeeSplit {
  if (!Number.isInteger(incomePoisha) || incomePoisha < 0) {
    throw new Error(`splitFee: expected a non-negative integer poisha, got ${incomePoisha}`);
  }
  // Rounded half-up to the poisha; total is then derived rather than rounded
  // separately, so the two accounts always sum to what was charged.
  const vatPoisha = Math.round((incomePoisha * vatRateBp) / 10_000);
  return {
    incomePoisha,
    vatPoisha,
    totalPoisha: incomePoisha + vatPoisha,
    vatRateBp,
  };
}

/**
 * A human-readable payment reference, printed on the demand note and invoice.
 *
 * Spec §6 requires reconciliation to key on this and nothing else — not name,
 * not amount, not date — because the payer may pay "from anywhere" and those
 * three all collide in practice.
 *
 * Shape: `BSTI-YYMMDD-XXXXXXX`. The random tail is what makes it unguessable;
 * the date prefix is only there to make a reference readable over a phone.
 */
export function buildReference(random: () => number = Math.random, now = new Date()): string {
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  // Crockford-ish: no I, O, U, or digits that read as letters over a phone.
  const ALPHABET = "0123456789ACDEFGHJKLMNPQRSTVWXYZ";
  let tail = "";
  for (let i = 0; i < 7; i++) tail += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `BSTI-${yy}${mm}${dd}-${tail}`;
}
