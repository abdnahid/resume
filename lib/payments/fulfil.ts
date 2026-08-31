/**
 * What a settled payment *means* — the one place a purpose is turned into an
 * action.
 *
 * Both the browser return page and the IPN handler call this, and both may
 * arrive first or at the same moment, so every branch must be idempotent. The
 * underlying guards are conditional updates, not "have we done this already?"
 * checks, which is what makes that true under an actual race.
 */
import { prisma } from "@/lib/prisma";
import { settlePayment } from "./service";
import { fulfilBdsPurchase } from "@/lib/store/purchase";
import { submitApplication } from "@/lib/cm/applications";

export type Fulfilment = {
  status: string;
  reason?: string;
  /** Set for a BDS purchase. */
  purchase?: { purchaseNumber: string; bds: { number: string; titleEn: string } } | null;
  /** Set for an application fee. */
  application?: { id: number; applicationNo: string | null; state: string } | null;
};

export async function fulfilPayment(reference: string): Promise<Fulfilment> {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    select: { purpose: true, subjectId: true },
  });
  if (!payment) return { status: "pending", reason: "No such payment." };

  switch (payment.purpose) {
    case "bds_purchase": {
      const r = await fulfilBdsPurchase(reference);
      return { status: r.status, reason: r.reason, purchase: r.purchase ?? null };
    }

    case "application_fee": {
      const r = await settlePayment(reference);
      if (r.status !== "paid") return { status: r.status, reason: r.reason, application: null };

      // Submission is guarded on the fee being paid in the database, not on
      // this call having just settled it — so it is safe from either caller.
      const submitted = await submitApplication(Number(payment.subjectId));
      return {
        status: r.status,
        reason: submitted.reason,
        application: {
          id: Number(payment.subjectId),
          applicationNo: submitted.applicationNo,
          state: submitted.state,
        },
      };
    }

    default: {
      // Testing and licence fees settle but grant nothing yet — those stages
      // belong to the workflow engine.
      const r = await settlePayment(reference);
      return { status: r.status, reason: r.reason };
    }
  }
}
