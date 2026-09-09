/**
 * What the FDO's sampling screen needs, assembled in one place (D87).
 *
 * `buildPlanFor()` answers "which labs, which parameters, how many variants";
 * this adds the names a person needs to read it — the labs, the sub-products,
 * the articles — and, once the plan is committed, the sealed specimens with the
 * one identifier that may be printed.
 *
 * Server half (D9). `plan.ts` holds the Prisma-free arithmetic.
 */
import { prisma } from "@/lib/prisma";
import { buildPlanFor } from "./service";
import { planProblems, type PlanCell } from "./plan";

export type SamplingCell = PlanCell & {
  labName: string;
  labDiscipline: string;
  parameterNames: string[];
  /** True while every routing row behind this cell is still a seeded stand-in. */
  routeIsPlaceholder: boolean;
  /** What the lab agreed last time, if anything — a suggestion, never a default. */
  remembered: number | null;
};

export type SamplingView = {
  cells: SamplingCell[];
  boxes: { labId: number; labName: string; sampleCount: number | null }[];
  totalSamples: number | null;
  problems: string[];
  /** Every cell still awaiting a number. */
  missingCount: number;
  /** Sealed already? Then the plan is history and the labels are the work. */
  committed: {
    consignments: {
      id: number;
      code: string;
      sealNo: string | null;
      state: string;
      labName: string;
      specimens: {
        ref: string;
        specimenNo: number;
        subProductName: string;
        brand: string;
        variant: string | null;
        size: string;
      }[];
    }[];
  } | null;
};

export async function samplingView(applicationId: number): Promise<SamplingView> {
  const { plan, problems } = await buildPlanFor(applicationId);

  const officeIds = [...new Set(plan.cells.map((c) => c.officeId))];
  const parameterIds = [...new Set(plan.cells.flatMap((c) => c.parameterIds))];
  const [labs, parameters, app] = await Promise.all([
    prisma.lab.findMany({
      where: { id: { in: officeIds } },
      select: { id: true, nameEn: true },
    }),
    prisma.testParameter.findMany({
      where: { id: { in: parameterIds } },
      select: { id: true, nameEn: true },
    }),
    prisma.application.findUnique({
      where: { id: applicationId },
      select: { bstiOfficeId: true, subProducts: { select: { id: true, subProductId: true } } },
    }),
  ]);
  const officeName = new Map(labs.map((o) => [o.id, o.nameEn]));
  const paramName = new Map(parameters.map((p) => [p.id, p.nameEn]));

  // How each destination came to be chosen: because the office runs the test
  // itself, because it is the only one that can, or because this office prefers
  // it. Shown rather than assumed away — a destination nobody chose is not the
  // same fact as one an office decided (the point D66's flag used to make).
  const preferredByCell = new Map<string, boolean>();
  if (app?.bstiOfficeId) {
    const prefs = await prisma.routingPreference.findMany({
      where: { officeId: app.bstiOfficeId, parameterId: { in: parameterIds } },
      select: { parameterId: true, toOfficeId: true },
    });
    const by = new Map(prefs.map((r) => [r.parameterId, r.toOfficeId]));
    for (const cell of plan.cells)
      preferredByCell.set(
        `${cell.applicationSubProductId}:${cell.officeId}`,
        cell.parameterIds.some((id) => by.get(id) === cell.officeId),
      );
  }

  // What each destination office agreed for this sub-product last time. A
  // suggestion the FDO can accept or overrule — never written for him, because
  // the number turns on this consignment's quantity and what the tests destroy.
  const remembered = new Map<string, number>();
  const subProductIds = [...new Set(plan.cells.map((c) => c.subProductId))];
  if (subProductIds.length) {
    const rows = await prisma.officeSampleRequirement.findMany({
      where: { subProductId: { in: subProductIds }, officeId: { in: officeIds } },
      select: { officeId: true, subProductId: true, samplesPerVariant: true },
    });
    for (const r of rows) remembered.set(`${r.subProductId}:${r.officeId}`, r.samplesPerVariant);
  }

  const cells: SamplingCell[] = plan.cells.map((c) => ({
    ...c,
    labName: officeName.get(c.officeId) ?? `Office ${c.officeId}`,
    labDiscipline: "",
    parameterNames: c.parameterIds.map((id) => paramName.get(id) ?? `#${id}`),
    routeIsPlaceholder: !(preferredByCell.get(`${c.applicationSubProductId}:${c.officeId}`) ?? false),
    remembered: remembered.get(`${c.subProductId}:${c.officeId}`) ?? null,
  }));

  const committedRows = await prisma.consignment.findMany({
    where: { applicationId },
    select: {
      id: true,
      code: true,
      sealNo: true,
      state: true,
      office: { select: { nameEn: true } },
      registry: {
        select: {
          sample: {
            select: {
              ref: true,
              specimenNo: true,
              labTestOrder: { select: { subProduct: { select: { nameEn: true } } } },
            },
          },
          applicationSku: {
            select: {
              brandName: true,
              variant: true,
              sizeValue: true,
              sizeUnit: { select: { code: true } },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });

  return {
    cells,
    boxes: plan.boxes.map((b) => ({
      ...b, labId: b.officeId,
      labName: officeName.get(b.officeId) ?? `Office ${b.officeId}`,
    })),
    totalSamples: plan.totalSamples,
    problems: [...problems, ...planProblems(plan)],
    missingCount: plan.missing.length,
    committed: committedRows.length
      ? {
          consignments: committedRows.map((c) => ({
            id: c.id,
            code: c.code,
            sealNo: c.sealNo,
            state: String(c.state),
            labName: c.office?.nameEn ?? "—",
            specimens: c.registry.map((s) => ({
              // `ref` and nothing else: it is the only one of the three
              // identifiers that may be printed (D68).
              ref: s.sample.ref,
              specimenNo: s.sample.specimenNo,
              subProductName: s.sample.labTestOrder.subProduct.nameEn,
              brand: s.applicationSku.brandName,
              variant: s.applicationSku.variant,
              size:
                s.applicationSku.sizeValue !== null
                  ? `${s.applicationSku.sizeValue} ${s.applicationSku.sizeUnit.code}`
                  : s.applicationSku.sizeUnit.code,
            })),
          })),
        }
      : null,
  };
}
