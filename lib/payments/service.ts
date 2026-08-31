/**
 * The kernel payment service.
 *
 * Server-only half (D9). Every module raises money events through this — spec
 * §1: a module that reimplements payments means the kernel is wrong.
 *
 * The rule the whole file exists to hold: **only `settlePayment()` may mark a
 * payment paid, and only on the strength of a `verify()` answer from the
 * gateway.** Nothing that a browser can reach decides it.
 */
import { prisma } from "@/lib/prisma";
import { splitFee, buildReference } from "./money";
import { amountMatches, type PaymentPurposeKey } from "./provider";
import { activeProvider, providerByKey } from "./registry";
import type { PaymentStatus, Prisma } from "@/generated/prisma/client";

export type RaiseArgs = {
  purpose: PaymentPurposeKey;
  subjectType: string;
  subjectId: string;
  /** The fee before VAT, in poisha. */
  incomePoisha: number;
  payerUserId: string;
  organizationId?: number | null;
};

/** A unique reference, retried on the vanishing chance of a collision. */
async function uniqueReference(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const reference = buildReference();
    const clash = await prisma.payment.findUnique({ where: { reference }, select: { id: true } });
    if (!clash) return reference;
  }
  throw new Error("Could not generate a unique payment reference.");
}

/**
 * Create a pending payment. Does not contact the gateway — a demand note can be
 * raised and printed long before anyone pays it (spec §6: the payer may pay
 * "from anywhere").
 */
export async function raisePayment(args: RaiseArgs) {
  const split = splitFee(args.incomePoisha);
  const provider = activeProvider();
  const reference = await uniqueReference();

  const payment = await prisma.payment.create({
    data: {
      reference,
      purpose: args.purpose,
      subjectType: args.subjectType,
      subjectId: args.subjectId,
      incomePoisha: split.incomePoisha,
      vatPoisha: split.vatPoisha,
      totalPoisha: split.totalPoisha,
      vatRateBp: split.vatRateBp,
      provider: provider.key,
      isSandbox: provider.isSandbox,
      payerUserId: args.payerUserId,
      organizationId: args.organizationId ?? null,
      events: {
        create: {
          kind: "created",
          status: "pending",
          note: `${args.purpose} · ${args.subjectType}:${args.subjectId}`,
        },
      },
    },
  });

  return payment;
}

/** Open a gateway session and hand back where to send the payer. */
export async function beginCheckout(
  reference: string,
  origin: string,
  payer: { name: string; email?: string | null; mobile?: string | null },
  description: string,
) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { reference } });
  if (payment.status === "paid") {
    throw new Error("This payment has already been settled.");
  }

  const provider = providerByKey(payment.provider) ?? activeProvider();
  const session = await provider.createCheckout({
    reference: payment.reference,
    amountPoisha: payment.totalPoisha,
    purpose: payment.purpose as PaymentPurposeKey,
    description,
    payer,
    returnUrl: `${origin}/pay/return/${encodeURIComponent(payment.reference)}`,
    cancelUrl: `${origin}/pay/return/${encodeURIComponent(payment.reference)}?cancelled=1`,
    ipnUrl: `${origin}/api/payments/ipn/${provider.key}`,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: payment.status === "pending" ? "initiated" : payment.status,
      providerRef: session.providerRef ?? payment.providerRef,
      events: {
        create: { kind: "redirected", status: "initiated", note: session.redirectUrl },
      },
    },
  });

  return session;
}

export type SettleResult = {
  status: PaymentStatus;
  /** True only on the transition into `paid`, so callers fulfil exactly once. */
  newlyPaid: boolean;
  reason?: string;
};

/**
 * Ask the gateway what happened, and record it.
 *
 * Safe to call repeatedly and from anywhere — the browser return page, the IPN
 * handler, a reconciliation job. Settlement is idempotent: a payment already
 * `paid` returns `newlyPaid: false`, so fulfilment never runs twice.
 */
export async function settlePayment(reference: string): Promise<SettleResult> {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment) return { status: "pending", newlyPaid: false, reason: "No such payment." };

  if (payment.status === "paid") return { status: "paid", newlyPaid: false };

  const provider = providerByKey(payment.provider);
  if (!provider) {
    return { status: payment.status, newlyPaid: false, reason: "Unknown payment provider." };
  }

  const verified = await provider.verify(payment.reference, payment.providerRef);

  await prisma.paymentEvent.create({
    data: {
      paymentId: payment.id,
      kind: "verified",
      note: verified.outcome,
      raw: verified.raw as Prisma.InputJsonValue,
    },
  });

  if (verified.outcome === "pending" || verified.outcome === "unknown") {
    return { status: payment.status, newlyPaid: false, reason: "Still awaiting the gateway." };
  }

  if (verified.outcome !== "paid") {
    const status: PaymentStatus = verified.outcome === "cancelled" ? "cancelled" : "failed";
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status,
        providerRef: verified.providerRef ?? payment.providerRef,
        method: verified.method ?? payment.method,
        failureReason: `Gateway reported ${verified.outcome}.`,
        events: { create: { kind: "settled", status, note: verified.outcome } },
      },
    });
    return { status, newlyPaid: false };
  }

  // Paid — but only if the gateway collected what the demand note asked for.
  // A short payment must not release a standard or submit an application.
  if (!amountMatches(payment.totalPoisha, verified.amountPoisha)) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "failed",
        settledPoisha: verified.amountPoisha,
        failureReason: `Gateway reported ${verified.amountPoisha} poisha against a demand of ${payment.totalPoisha}.`,
        events: {
          create: {
            kind: "rejected",
            status: "failed",
            note: "Amount mismatch",
            raw: verified.raw as Prisma.InputJsonValue,
          },
        },
      },
    });
    return {
      status: "failed",
      newlyPaid: false,
      reason: "The amount the gateway collected does not match the demand note.",
    };
  }

  // `updateMany` on the still-unpaid row is the idempotency guard: two callers
  // racing (the browser returning while the IPN lands) both verify, but only
  // one update matches, so only one of them sees `newlyPaid`.
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: { not: "paid" } },
    data: {
      status: "paid",
      paidAt: new Date(),
      providerRef: verified.providerRef ?? payment.providerRef,
      method: verified.method ?? payment.method,
      settledPoisha: verified.amountPoisha,
      failureReason: null,
    },
  });

  if (claimed.count === 0) return { status: "paid", newlyPaid: false };

  await prisma.paymentEvent.create({
    data: { paymentId: payment.id, kind: "settled", status: "paid", note: verified.method ?? null },
  });

  return { status: "paid", newlyPaid: true };
}

export async function getPayment(reference: string) {
  return prisma.payment.findUnique({
    where: { reference },
    include: { events: { orderBy: { id: "asc" } }, purchase: { include: { bds: true } } },
  });
}
