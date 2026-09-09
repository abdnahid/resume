/**
 * The sampling report as a document (D96).
 *
 * The visit produces two papers, not one: what was seen at the factory
 * (`inspection-report.ts`) and what was drawn from it. They are one visit and
 * are approved together (D92) — so this report carries **no state of its own**.
 * It has no submitted flag, no approver, no serial: it reads the inspection
 * report's, because a sampling report that could be approved separately would
 * be a second thing to disagree with the first.
 *
 * Almost every line is already a row. The specimens, seals and destination labs
 * were written when the officer sealed the boxes (D87); asking him to type them
 * again would only create a copy that could drift. What he writes is
 * `samplingRemarks` — quantity drawn, condition of the goods, whatever the seal
 * numbers do not say.
 *
 * Server half (D9).
 */
import { prisma } from "@/lib/prisma";

export type SamplingReportBox = {
  code: string;
  sealNo: string | null;
  labName: string;
  discipline: string;
  officeName: string;
  specimens: {
    subProductName: string;
    brand: string;
    variant: string | null;
    size: string;
    specimenNo: number;
    parameterCount: number;
  }[];
};

/**
 * The sealed boxes behind an application, in the shape the document prints.
 * Empty when nothing has been sealed — which is exactly when there is no
 * sampling report to show.
 */
export async function samplingBoxesFor(applicationId: number): Promise<SamplingReportBox[]> {
  const rows = await prisma.consignment.findMany({
    where: { applicationId },
    select: {
      code: true,
      sealNo: true,
      office: { select: { nameBn: true, nameEn: true } },
      registry: {
        select: {
          sample: {
            select: {
              specimenNo: true,
              labTestOrder: {
                select: {
                  subProduct: { select: { nameEn: true, nameBn: true } },
                  _count: { select: { items: true } },
                },
              },
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

  return rows.map((c) => ({
    code: c.code,
    sealNo: c.sealNo,
    labName: c.office?.nameEn ?? "—",
    discipline: "",
    officeName: c.office?.nameBn ?? c.office?.nameEn ?? "—",
    specimens: c.registry.map((s) => ({
      subProductName: s.sample.labTestOrder.subProduct.nameBn ?? s.sample.labTestOrder.subProduct.nameEn,
      brand: s.applicationSku.brandName,
      variant: s.applicationSku.variant,
      size:
        s.applicationSku.sizeValue !== null
          ? `${s.applicationSku.sizeValue} ${s.applicationSku.sizeUnit.code}`
          : s.applicationSku.sizeUnit.code,
      specimenNo: s.sample.specimenNo,
      parameterCount: s.sample.labTestOrder._count.items,
    })),
  }));
}
