/**
 * The declared limits behind one test order — the crossing (D144).
 *
 * **It lives on the CM side for the same reason `lettersForWorkOrders()` does**
 * (D137). `SampleRegistration` is the cut (D71) and `lib/labs/` is blind by
 * construction: nothing there may join to an application. A declared limit is
 * per application, so reaching it means crossing, and the crossing belongs on
 * this side of the line.
 *
 * **Nothing identifying comes back.** What a manufacturer declared his tile's
 * breaking strength to be is a number, not a name — the bench learns what it is
 * testing against and still cannot say whose sample it holds.
 *
 * One query for the whole order, whatever its size.
 */
import { prisma } from "@/lib/prisma";

/** `parameterId:subParameterId|self` → what the applicant stated. */
export type DeclaredLimits = Map<string, string>;

export function declaredKey(parameterId: number, subParameterId: number | null) {
  return `${parameterId}:${subParameterId ?? "self"}`;
}

export async function declaredLimitsForOrder(orderId: number): Promise<DeclaredLimits> {
  const out: DeclaredLimits = new Map();

  // One specimen is enough: every specimen of an order is sealed against the
  // same application sub-product, which is what the order is *of*.
  const order = await prisma.labTestOrder.findUnique({
    where: { id: orderId },
    select: {
      specimens: {
        take: 1,
        select: { registry: { select: { applicationSubProductId: true } } },
      },
    },
  });
  const applicationSubProductId = order?.specimens[0]?.registry?.applicationSubProductId;
  // An order whose specimens are not sealed yet has no application behind it.
  if (!applicationSubProductId) return out;

  const rows = await prisma.applicationDeclaredLimit.findMany({
    where: { applicationSubProductId },
    select: { parameterId: true, subParameterId: true, declaredValue: true },
  });
  for (const r of rows) out.set(declaredKey(r.parameterId, r.subParameterId), r.declaredValue);
  return out;
}
