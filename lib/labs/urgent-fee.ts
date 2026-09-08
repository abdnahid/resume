/**
 * What an urgent test costs, decided once per package and stored per parameter.
 *
 * Prisma-free (D9) so the importers, the recompute script and the catalogue
 * screen all price the same way. Nothing here touches the database.
 *
 * **The rule, as the client set it (2026-09-08).**
 *
 * 1. A parameter's urgent fee is **twice** its normal fee — the shorter
 *    turnaround is what is being paid for.
 * 2. Unless the package's urgent turnaround is **not** shorter than its normal
 *    one, in which case there is nothing to charge for and urgent = normal.
 * 3. Unless the wing published an urgent total for the package that the
 *    doubling does not reproduce — Poultry Feed (Layer-4) states ৳25,000 urgent
 *    against ৳20,000 normal, where doubling gives ৳40,000. Then the surcharge
 *    is **apportioned**: every parameter is scaled by the same multiplier
 *    (25,000 ÷ 20,000 = 1.25) so the package total is exactly what the wing
 *    published.
 *
 * **Why a flat multiplier and not a per-test decision.** D100 records strong
 * evidence that the real surcharge falls on some tests and not others — for 121
 * of the 124 non-2× packages, `urgent − normal` is exactly a subset-sum of the
 * parameter fees, and the tests left at single fee are a coherent set (Aldrin
 * and Dieldrin, aflatoxin, heavy metals by AAS, microbiological counts — all
 * tests with a floor on their turnaround). But subset-sum is **ambiguous where
 * fees repeat**: Moisture reads as single in 7 packages and doubled in 97, so
 * the decomposition identifies *a* subset and not *the* subset. Writing
 * per-parameter fees from it would invent precision the file does not carry.
 * A flat multiplier is right in aggregate — the package total matches the
 * wing's own published figure to the poisha — and honest about being an
 * apportionment rather than a price list. `urgentFeeSource` is what keeps the
 * two apart, and `WHERE urgentFeeSource = 'apportioned'` is the list to correct
 * when the wing answers D100.
 *
 * **Money is integer poisha**, as everywhere else, and the apportioned parts
 * sum to the published total exactly — see `distribute()`.
 */

/** Where a stored urgent fee came from. Mirrors the `UrgentFeeSource` enum. */
export type UrgentFeeSource =
  /** The wing's published urgent total is exactly twice its normal total. */
  | "doubled"
  /** No published urgent total to check against; the 2× rule stands unverified. */
  | "doubled_assumed"
  /** Scaled so the package matches the wing's published urgent total. */
  | "apportioned"
  /** The urgent turnaround is not shorter, so there is no surcharge to make. */
  | "same_as_normal"
  /** Typed by hand in the catalogue screen, and never recomputed over. */
  | "manual";

export type PackagePricing = {
  urgentFees: number[];
  source: UrgentFeeSource;
  /** `statedUrgentTotal ÷ normalTotal`, only when apportioned. For display. */
  multiplier: number | null;
  /**
   * Set when the package's own figures do not make sense together, in which
   * case the rule falls back to doubling and this says why. Never silently
   * swallowed: the importers print these and the screen shows them.
   */
  anomaly: string | null;
};

/**
 * Price one wing's package.
 *
 * `normalFees` is that wing's parameters for one sub-product, in order, and
 * `statedUrgentTotal` is the "Total Fee (Urgent)" it printed for them — null
 * where the file carries no such column, which is the textile file's case.
 *
 * A package is priced as a whole because that is the only figure the wing
 * published (D62): the file's totals are per lab, so a sub-product tested by
 * two wings has two packages, priced independently and summed at read time.
 */
export function priceUrgent(args: {
  normalFees: number[];
  statedUrgentTotal: number | null;
  normalDays: number | null;
  urgentDays: number | null;
}): PackagePricing {
  const { normalFees, statedUrgentTotal, normalDays, urgentDays } = args;
  const double = (): number[] => normalFees.map((f) => f * 2);

  // A turnaround that cannot be shortened is not an urgent service. No
  // turnaround recorded at all is treated the same way rather than as an
  // invitation to guess: a package that never quoted an urgent date is not
  // offering one, and charging a surcharge nobody published is worse than
  // charging none.
  const normalTotal = normalFees.reduce((a, f) => a + f, 0);

  if (normalDays === null || urgentDays === null || urgentDays >= normalDays)
    return {
      urgentFees: [...normalFees],
      source: "same_as_normal",
      multiplier: null,
      // The turnaround rule wins — it is the client's — but a package that
      // publishes an urgent price it has no urgent service for is saying two
      // things, and the disagreement is the wing's to settle, not ours to
      // smooth over. Two packages are in this state today and both are already
      // on the checksum list, which is a fair sign their totals are stale.
      anomaly:
        statedUrgentTotal !== null && statedUrgentTotal !== normalTotal
          ? `publishes an urgent total of ${taka(statedUrgentTotal)} but its urgent turnaround is not shorter than its normal one`
          : null,
    };

  if (statedUrgentTotal === null)
    return { urgentFees: double(), source: "doubled_assumed", multiplier: null, anomaly: null };

  if (normalTotal === 0)
    return {
      urgentFees: double(), source: "doubled_assumed", multiplier: null,
      anomaly: "the package's parameters carry no fee, so there is nothing to apportion against",
    };

  if (statedUrgentTotal === normalTotal * 2)
    return { urgentFees: double(), source: "doubled", multiplier: 2, anomaly: null };

  // An urgent price below the normal price is a source error, not a discount.
  // Doubling is the rule the client set; applying it and saying so beats
  // storing a figure that would undercut the ordinary fee.
  if (statedUrgentTotal < normalTotal)
    return {
      urgentFees: double(), source: "doubled_assumed", multiplier: null,
      anomaly: `stated urgent total ${taka(statedUrgentTotal)} is below the normal total ${taka(normalTotal)}`,
    };

  return {
    urgentFees: distribute(normalFees, statedUrgentTotal, normalTotal),
    source: "apportioned",
    multiplier: statedUrgentTotal / normalTotal,
    anomaly: null,
  };
}

/**
 * Split `total` across the parts in proportion to `weights`, in whole poisha,
 * summing to `total` exactly.
 *
 * Largest remainder: give everyone their floor, then hand the shortfall to the
 * parts with the largest fractional claim. Rounding each part on its own would
 * leave the package a few poisha off the figure the wing published, and "our
 * total does not match yours" is the one thing this apportionment exists to
 * avoid. Ties go to the larger fee, then to the earlier parameter, so the
 * result does not depend on the sort being stable.
 */
export function distribute(weights: number[], total: number, weightTotal: number): number[] {
  const base = weights.map((w) => Math.floor((w * total) / weightTotal));
  let short = total - base.reduce((a, b) => a + b, 0);

  const order = weights
    .map((w, i) => ({ i, rem: (w * total) % weightTotal, w }))
    .sort((a, b) => b.rem - a.rem || b.w - a.w || a.i - b.i);

  for (let k = 0; short > 0 && k < order.length; k++, short--) base[order[k].i] += 1;
  return base;
}

const taka = (poisha: number) => `৳${(poisha / 100).toLocaleString("en-BD")}`;

/** Short label for a screen. */
export const URGENT_SOURCE_LABEL: Record<UrgentFeeSource, string> = {
  doubled: "Doubled",
  doubled_assumed: "Doubled (unverified)",
  apportioned: "Apportioned",
  same_as_normal: "No surcharge",
  manual: "Entered by hand",
};

/** The one-line reason, for a tooltip, a report line or a column footnote. */
export const URGENT_SOURCE_NOTE: Record<UrgentFeeSource, string> = {
  doubled: "the wing's published urgent total is exactly twice its normal total",
  doubled_assumed: "the file publishes no urgent total, so the 2× rule is unchecked",
  apportioned: "scaled so the package matches the urgent total the wing published",
  same_as_normal: "the urgent turnaround is not shorter, so there is no surcharge",
  manual: "typed in the catalogue screen; the recompute leaves it alone",
};

/**
 * A figure nobody has confirmed. The same discipline as `LabRouting.isPlaceholder`
 * and `Bds.priceIsPlaceholder`: a stand-in that looks identical to a decision is
 * the failure mode, so the flag travels with the number to wherever it is shown.
 */
export function urgentFeeIsProvisional(source: UrgentFeeSource): boolean {
  return source === "doubled_assumed" || source === "apportioned";
}
