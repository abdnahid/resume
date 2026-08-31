/**
 * Buying a standard (spec §3.2).
 *
 * Server half (D9) — `lib/store/bds-catalog.ts` stays the Prisma-free one.
 */
import { prisma } from "@/lib/prisma";
import { takaToPoisha } from "@/lib/payments/money";
import { raisePayment, settlePayment } from "@/lib/payments/service";

/** `BDS-2026-000123`, printed on the invoice. */
function purchaseNumber(id: number, year: number): string {
  return `BDS-${year}-${String(id).padStart(6, "0")}`;
}

/**
 * Raise the payment for a standard. Nothing is granted yet — the purchase row
 * is only written once the money is verified.
 */
export async function startBdsPurchase(args: {
  bdsId: number;
  userId: string;
  organizationId?: number | null;
}) {
  const bds = await prisma.bds.findUniqueOrThrow({ where: { id: args.bdsId } });

  // Anyone may buy any BDS any number of times (spec §3.2), so there is
  // deliberately no "already bought" check here. The one-purchase-one-
  // application rule is enforced at attach time instead (§3.3).
  const payment = await raisePayment({
    purpose: "bds_purchase",
    subjectType: "bds",
    subjectId: String(bds.id),
    incomePoisha: takaToPoisha(bds.priceBdt),
    payerUserId: args.userId,
    organizationId: args.organizationId ?? null,
  });

  return { payment, bds };
}

/**
 * Settle the payment and, if it is genuinely paid, record the purchase.
 *
 * Fulfilment hangs off `newlyPaid`, which is true exactly once — so the browser
 * returning at the same moment the IPN lands cannot produce two purchases for
 * one payment. The unique index on `paymentId` is the backstop.
 */
export async function fulfilBdsPurchase(reference: string) {
  const result = await settlePayment(reference);

  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { purchase: { include: { bds: true } } },
  });
  if (!payment) return { ...result, purchase: null };

  if (payment.purpose !== "bds_purchase") return { ...result, purchase: payment.purchase };
  if (result.status !== "paid") return { ...result, purchase: null };
  if (payment.purchase) return { ...result, purchase: payment.purchase };

  const created = await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction: two settlements racing would both have
    // read `purchase: null` above.
    const existing = await tx.bdsPurchase.findUnique({ where: { paymentId: payment.id } });
    if (existing) return existing;

    const row = await tx.bdsPurchase.create({
      data: {
        purchaseNumber: `PENDING-${payment.reference}`,
        bdsId: Number(payment.subjectId),
        buyerUserId: payment.payerUserId,
        organizationId: payment.organizationId,
        paymentId: payment.id,
      },
    });
    // The number embeds the row id, so it is assigned once the id exists.
    return tx.bdsPurchase.update({
      where: { id: row.id },
      data: { purchaseNumber: purchaseNumber(row.id, new Date().getFullYear()) },
    });
  });

  const purchase = await prisma.bdsPurchase.findUnique({
    where: { id: created.id },
    include: { bds: true },
  });

  return { ...result, purchase };
}

/** Standards this user has bought, newest first. */
export async function purchasesFor(userId: string) {
  return prisma.bdsPurchase.findMany({
    where: { buyerUserId: userId },
    include: {
      bds: { include: { division: true } },
      payment: true,
      organization: { select: { id: true, nameEn: true } },
    },
    orderBy: { purchasedAt: "desc" },
  });
}
