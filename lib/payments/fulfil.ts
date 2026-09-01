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
import { submitApplication, attachBds } from "@/lib/cm/applications";

export type Fulfilment = {
  status: string;
  reason?: string;
  /** Set for a BDS purchase. */
  purchase?: { purchaseNumber: string; bds: { number: string; titleEn: string } } | null;
  /**
   * Set when the standard was bought from inside an application (D50): whether
   * it attached itself, and where to send the buyer back to.
   */
  attachedTo?: { applicationId: number; attached: boolean; reason?: string } | null;
  /** Set for an application fee. */
  application?: { id: number; applicationNo: string | null; state: string } | null;
};

export async function fulfilPayment(reference: string): Promise<Fulfilment> {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    select: {
      purpose: true,
      subjectId: true,
      payerUserId: true,
      attachToApplicationId: true,
    },
  });
  if (!payment) return { status: "pending", reason: "No such payment." };

  switch (payment.purpose) {
    case "bds_purchase": {
      const r = await fulfilBdsPurchase(reference);
      const base = { status: r.status, reason: r.reason, purchase: r.purchase ?? null };
      if (!r.purchase || !payment.attachToApplicationId) return base;

      // Bought from inside an application (D50) — attach it there rather than
      // asking the applicant to do by hand the thing they just paid for.
      //
      // `attachBds()` is the same call the Attach button makes, so every rule
      // holds: it must be a standard the product is certified against, and the
      // conditional claim is still what locks the purchase. It is idempotent —
      // re-attaching what this application already holds returns without
      // touching anything — which matters because the browser return and the
      // IPN both land here.
      //
      // A failure is not fatal and must not be swallowed either: the money is
      // taken and the purchase is the buyer's whatever happens next, so the
      // reason travels to the receipt instead of throwing away a paid-for
      // standard.
      try {
        await attachBds(payment.attachToApplicationId, r.purchase.id, payment.payerUserId);
        return {
          ...base,
          attachedTo: { applicationId: payment.attachToApplicationId, attached: true },
        };
      } catch (e) {
        return {
          ...base,
          attachedTo: {
            applicationId: payment.attachToApplicationId,
            attached: false,
            reason: e instanceof Error ? e.message : "Could not attach it automatically.",
          },
        };
      }
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
