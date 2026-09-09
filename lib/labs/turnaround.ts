/**
 * How long a package takes, now that the days belong to the tests.
 *
 * Prisma-free (D9). Turnaround moved from the sub-product down to the parameter
 * (D115), and a package's own duration is therefore **the longest of the tests
 * it actually contains** — which is what a turnaround is: the samples are run
 * in parallel and the report waits for the slowest bench.
 *
 * The gain is that a *partial* selection has a date. D62 recorded the opposite
 * as a limitation — "these are per package and not per parameter, so a partial
 * selection has no computable date yet" — and D101's parameter selection would
 * have made that bite. The figure each wing published for its whole package is
 * still kept verbatim on `SubProductPackageFee`, because it is what they
 * printed and ours is a derivation.
 */

export type PackageDays = { normalDays: number | null; urgentDays: number | null };

export function packageDays(
  parameters: { normalDays: number | null; urgentDays: number | null }[],
): PackageDays {
  const longest = (pick: (p: { normalDays: number | null; urgentDays: number | null }) => number | null) => {
    const days = parameters.map(pick).filter((d): d is number => d !== null);
    return days.length ? Math.max(...days) : null;
  };
  return { normalDays: longest((p) => p.normalDays), urgentDays: longest((p) => p.urgentDays) };
}

/**
 * Whether an urgent service exists for a set of tests.
 *
 * True only when the urgent turnaround is genuinely shorter — the same rule
 * `priceUrgent()` applies to the fee, so a package that cannot be hurried is
 * neither charged a surcharge nor promised a date it cannot meet.
 */
export function hasUrgentOption(days: PackageDays): boolean {
  return days.normalDays !== null && days.urgentDays !== null && days.urgentDays < days.normalDays;
}
