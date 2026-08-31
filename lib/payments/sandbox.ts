/**
 * The built-in sandbox gateway.
 *
 * No API keys, no network, no external account — it works offline and on a
 * machine that has never been registered with anyone. That is the point: the
 * gateway question (spec §6 — is Sonali Bank legally mandatory, or may an
 * aggregator sit in front of it?) is still open, and nothing about the platform
 * should wait on the answer.
 *
 * It simulates the *shape* of a real gateway rather than shortcutting it:
 * a session is opened server-side, the payer's browser is sent to a hosted
 * page, the gateway writes its own ledger row, and settlement happens only when
 * the merchant calls back to `verify()`. Swapping in SSLCommerz replaces this
 * file and nothing else.
 */
import { prisma } from "@/lib/prisma";
import type {
  PaymentProvider,
  PaymentIntent,
  CheckoutSession,
  VerifiedPayment,
} from "./provider";

/** Mirrors a real gateway's transaction id — visibly not a production one. */
function gatewayTxnId(): string {
  return `SBX${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export const sandboxProvider: PaymentProvider = {
  key: "sandbox",
  label: "Sandbox gateway (demo — no real money)",
  isSandbox: true,

  async createCheckout(intent: PaymentIntent): Promise<CheckoutSession> {
    const txnId = gatewayTxnId();

    // The gateway opens its own record. A real one does this inside its
    // infrastructure; here it is a row we are forbidden to read from anywhere
    // but this file.
    await prisma.sandboxGatewayTxn.upsert({
      where: { reference: intent.reference },
      create: {
        reference: intent.reference,
        gatewayTxnId: txnId,
        amountPoisha: intent.amountPoisha,
      },
      // Re-opening checkout on an unsettled payment is normal — the payer went
      // back. Settled rows are never reopened.
      update: {},
    });

    const txn = await prisma.sandboxGatewayTxn.findUniqueOrThrow({
      where: { reference: intent.reference },
    });

    return {
      redirectUrl: `/pay/sandbox/${encodeURIComponent(intent.reference)}`,
      providerRef: txn.gatewayTxnId,
    };
  },

  async verify(reference: string): Promise<VerifiedPayment> {
    const txn = await prisma.sandboxGatewayTxn.findUnique({ where: { reference } });

    if (!txn) {
      return { reference, providerRef: null, outcome: "unknown", amountPoisha: null, raw: null };
    }

    const outcome =
      txn.outcome === "paid"
        ? "paid"
        : txn.outcome === "failed"
          ? "failed"
          : txn.outcome === "cancelled"
            ? "cancelled"
            : "pending";

    return {
      reference,
      providerRef: txn.gatewayTxnId,
      outcome,
      // Reported independently of what we asked for, so the amount check in
      // `amountMatches()` is a real check and not a tautology.
      amountPoisha: txn.amountPoisha,
      method: txn.method,
      raw: { gatewayTxnId: txn.gatewayTxnId, outcome: txn.outcome, settledAt: txn.settledAt },
    };
  },

  parseCallback(body: Record<string, unknown>) {
    return {
      reference: String(body.reference ?? ""),
      providerRef: body.gatewayTxnId ? String(body.gatewayTxnId) : null,
    };
  },
};

/**
 * What the hosted page calls when the payer picks an outcome.
 *
 * This is *inside* the simulated gateway — it is what would happen on
 * SSLCommerz's servers, not on ours, which is why it lives here beside the
 * provider and not in the payment service.
 */
export async function sandboxSettle(
  reference: string,
  outcome: "paid" | "failed" | "cancelled",
  method: string | null,
) {
  const txn = await prisma.sandboxGatewayTxn.findUnique({ where: { reference } });
  if (!txn) throw new Error("No sandbox session for that reference.");
  // A gateway does not un-settle a transaction.
  if (txn.outcome !== "created") return txn;

  return prisma.sandboxGatewayTxn.update({
    where: { reference },
    data: { outcome, method, settledAt: new Date() },
  });
}

export async function sandboxSession(reference: string) {
  return prisma.sandboxGatewayTxn.findUnique({ where: { reference } });
}
