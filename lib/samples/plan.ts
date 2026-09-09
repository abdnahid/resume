/**
 * The sampling plan — what the FDO has to collect, and how much of it.
 * Prisma-free (D9) so the inspection screen can recompute as he types.
 *
 * **Destinations are derived; counts are entered.** The routing map already
 * answers "an application received at Barisal, for sub-product A1 — which
 * offices run its parameters", so the FDO cannot forget a destination and cannot end up
 * packing a box nobody needs. What the map cannot say is how many specimens
 * each lab wants: that turns on sample quantity and whether a test destroys the
 * specimen, which is the A§1.2 reference data BSTI has not collected. So he
 * phones the lab and types a number, and `LabSampleRequirement` remembers it so
 * the next application arrives pre-filled.
 *
 * The arithmetic is here rather than in his head: a plan is
 * `Σ samplesPerVariant × variants` over every (sub-product, lab) cell.
 */

/** One parameter routed to one office, as capability and preference resolve it. */
export type RoutedParameter = {
  parameterId: number;
  parameterName: string;
  officeId: number;
};

export type PlanSubProduct = {
  applicationSubProductId: number;
  subProductId: number;
  subProductName: string;
  /** How many articles the licence would cover under this sub-product. */
  variantCount: number;
  routed: RoutedParameter[];
};

export type PlanCell = {
  applicationSubProductId: number;
  subProductId: number;
  subProductName: string;
  officeId: number;
  /** The parameters this office runs for this sub-product — its test order. */
  parameterIds: number[];
  variantCount: number;
  /** Null until the FDO enters it, or a learned default fills it in. */
  samplesPerVariant: number | null;
  /** `samplesPerVariant × variantCount`, null while the figure is missing. */
  sampleCount: number | null;
};

export type SamplePlan = {
  cells: PlanCell[];
  /** One box per destination office — derived, never typed (D72). */
  boxes: { officeId: number; sampleCount: number | null }[];
  totalSamples: number | null;
  /** Cells still awaiting a number. The plan cannot be committed while any remain. */
  missing: PlanCell[];
};

/**
 * Build the grid the FDO fills in.
 *
 * `perVariant` maps `applicationSubProductId:officeId` to the figure already known
 * — entered on this application, or carried forward from what the lab agreed
 * last time. Cells absent from it come back null and land in `missing`.
 */
export function buildPlan(
  subProducts: PlanSubProduct[],
  perVariant: Map<string, number>,
): SamplePlan {
  const cells: PlanCell[] = [];

  for (const sp of subProducts) {
    const byLab = new Map<number, number[]>();
    for (const r of sp.routed) {
      if (!byLab.has(r.officeId)) byLab.set(r.officeId, []);
      byLab.get(r.officeId)!.push(r.parameterId);
    }
    for (const [officeId, parameterIds] of [...byLab].sort((a, b) => a[0] - b[0])) {
      const n = perVariant.get(cellKey(sp.applicationSubProductId, officeId)) ?? null;
      cells.push({
        applicationSubProductId: sp.applicationSubProductId,
        subProductId: sp.subProductId,
        subProductName: sp.subProductName,
        officeId,
        // A parameter is routed once per office, but a parameter with
        // sub-parameters appears on several source rows, so de-duplicate.
        parameterIds: [...new Set(parameterIds)].sort((a, b) => a - b),
        variantCount: sp.variantCount,
        samplesPerVariant: n,
        sampleCount: n === null ? null : n * sp.variantCount,
      });
    }
  }

  const boxes = [...new Set(cells.map((c) => c.officeId))]
    .sort((a, b) => a - b)
    .map((officeId) => {
      const mine = cells.filter((c) => c.officeId === officeId);
      const known = mine.every((c) => c.sampleCount !== null);
      return {
        officeId,
        sampleCount: known ? mine.reduce((a, c) => a + (c.sampleCount ?? 0), 0) : null,
      };
    });

  const missing = cells.filter((c) => c.samplesPerVariant === null);
  const totalSamples = missing.length
    ? null
    : cells.reduce((a, c) => a + (c.sampleCount ?? 0), 0);

  return { cells, boxes, totalSamples, missing };
}

export const cellKey = (applicationSubProductId: number, officeId: number) =>
  `${applicationSubProductId}:${officeId}`;

/**
 * A variant with no specimens is a variant nobody tested, so the licence could
 * not name it. Guards the commit rather than the form: the FDO is allowed to
 * work through the grid a cell at a time.
 */
export function planProblems(plan: SamplePlan): string[] {
  const out: string[] = [];
  for (const c of plan.missing)
    out.push(`${c.subProductName}: no sample count agreed with office ${c.officeId}`);
  for (const c of plan.cells) {
    if (c.variantCount === 0)
      out.push(`${c.subProductName}: no variants recorded, so nothing to sample`);
    if (c.samplesPerVariant !== null && c.samplesPerVariant < 1)
      out.push(`${c.subProductName}: office ${c.officeId} asks for ${c.samplesPerVariant} samples per variant`);
  }
  return [...new Set(out)];
}
