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

  const labIds = [...new Set(plan.cells.map((c) => c.labId))];
  const parameterIds = [...new Set(plan.cells.flatMap((c) => c.parameterIds))];
  const [labs, parameters, app] = await Promise.all([
    prisma.lab.findMany({
      where: { id: { in: labIds } },
      select: { id: true, nameEn: true, discipline: true },
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
  const labName = new Map(labs.map((l) => [l.id, l.nameEn]));
  const labDiscipline = new Map(labs.map((l) => [l.id, String(l.discipline)]));
  const paramName = new Map(parameters.map((p) => [p.id, p.nameEn]));

  // Which cells rest on nothing but the seeded stand-in routing (D66). Shown on
  // the screen rather than assumed away: a destination nobody has chosen is not
  // the same fact as one an office decided.
  const placeholderByCell = new Map<string, boolean>();
  if (app?.bstiOfficeId) {
    for (const cell of plan.cells) {
      const rows = await prisma.labRouting.findMany({
        where: {
          officeId: app.bstiOfficeId,
          labId: cell.labId,
          parameterId: { in: cell.parameterIds },
        },
        select: { isPlaceholder: true },
      });
      placeholderByCell.set(
        `${cell.applicationSubProductId}:${cell.labId}`,
        rows.length > 0 && rows.every((r) => r.isPlaceholder),
      );
    }
  }

  // What each lab agreed for this sub-product last time. A suggestion the FDO
  // can accept or overrule — never written for him, because the number turns on
  // this consignment's quantity and what the tests destroy.
  const remembered = new Map<string, number>();
  const subProductIds = [...new Set(plan.cells.map((c) => c.subProductId))];
  if (subProductIds.length) {
    const rows = await prisma.labSampleRequirement.findMany({
      where: { subProductId: { in: subProductIds }, labId: { in: labIds } },
      select: { labId: true, subProductId: true, samplesPerVariant: true },
    });
    for (const r of rows) remembered.set(`${r.subProductId}:${r.labId}`, r.samplesPerVariant);
  }

  const cells: SamplingCell[] = plan.cells.map((c) => ({
    ...c,
    labName: labName.get(c.labId) ?? `Lab ${c.labId}`,
    labDiscipline: labDiscipline.get(c.labId) ?? "",
    parameterNames: c.parameterIds.map((id) => paramName.get(id) ?? `#${id}`),
    routeIsPlaceholder: placeholderByCell.get(`${c.applicationSubProductId}:${c.labId}`) ?? false,
    remembered: remembered.get(`${c.subProductId}:${c.labId}`) ?? null,
  }));

  const committedRows = await prisma.consignment.findMany({
    where: { applicationId },
    select: {
      id: true,
      code: true,
      sealNo: true,
      state: true,
      lab: { select: { nameEn: true } },
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
    boxes: plan.boxes.map((b) => ({ ...b, labName: labName.get(b.labId) ?? `Lab ${b.labId}` })),
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
            labName: c.lab.nameEn,
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
