/**
 * The payment gateway boundary (D4).
 *
 * Prisma-free (D9): the shapes here are shared by the server, the checkout UI
 * and any future provider.
 *
 * **The interface is shaped after SSLCommerz and the government e-Challan, not
 * after the sandbox.** Both real candidates work the same way, and it is a way
 * that constrains the design:
 *
 *   1. the merchant creates a session server-side and gets back a URL;
 *   2. the payer's *browser* is redirected to the gateway and back;
 *   3. the gateway independently notifies the merchant server (IPN);
 *   4. the merchant asks the gateway to **validate** before honouring anything.
 *
 * Step 4 is the one that matters. The browser redirect is attacker-controlled —
 * anyone can navigate to a success URL — so a payment is never marked paid on
 * the strength of a return trip. `verify()` is the only thing that may settle a
 * payment, and the sandbox implements it too, so the discipline is in the code
 * from the start rather than bolted on when a real gateway lands.
 */

export type PaymentPurposeKey =
  | "bds_purchase"
  | "application_fee"
  | "testing_fee"
  | "licence_fee";

/** What the gateway needs to open a checkout session. */
export type PaymentIntent = {
  /** Our reference — the reconciliation key (spec §6). */
  reference: string;
  /** Integer poisha, the full amount the payer is charged. */
  amountPoisha: number;
  purpose: PaymentPurposeKey;
  /** Shown on the gateway's own page, e.g. "BDS 1982:2020". */
  description: string;
  payer: {
    name: string;
    email?: string | null;
    mobile?: string | null;
  };
  /** Absolute URLs. The gateway sends the browser to one of these. */
  returnUrl: string;
  cancelUrl: string;
  /** Absolute URL the gateway calls server-to-server. */
  ipnUrl: string;
};

export type CheckoutSession = {
  /** Where to send the payer's browser. */
  redirectUrl: string;
  /** The gateway's own id for the session, if it issues one at this point. */
  providerRef?: string | null;
};

/** The gateway's settled view of a payment. Only `verify()` produces one. */
export type VerifiedPayment = {
  reference: string;
  providerRef: string | null;
  /** `paid` is the only outcome that may settle a payment. */
  outcome: "paid" | "failed" | "cancelled" | "pending" | "unknown";
  /** Integer poisha the gateway says was actually collected. */
  amountPoisha: number | null;
  /** "bkash", "nagad", "visa"… as the gateway names it. */
  method?: string | null;
  /** Whatever the gateway returned, kept verbatim for the audit trail. */
  raw: unknown;
};

export interface PaymentProvider {
  /** Stored on the payment row, so a record always says who processed it. */
  readonly key: string;
  readonly label: string;
  /** True when no real money can move. Surfaced in the UI — never hidden. */
  readonly isSandbox: boolean;

  createCheckout(intent: PaymentIntent): Promise<CheckoutSession>;

  /**
   * Ask the gateway what actually happened. The **only** call whose answer may
   * mark a payment paid.
   */
  verify(reference: string, providerRef?: string | null): Promise<VerifiedPayment>;

  /** Normalise an IPN body into the same shape `verify()` returns. */
  parseCallback(body: Record<string, unknown>): { reference: string; providerRef: string | null };
}

/**
 * Does the gateway's settled amount match what we asked for?
 *
 * Checked on every settlement: a gateway that reports a smaller amount than the
 * demand note must not release a standard or submit an application. Kept here
 * rather than in each provider so no provider can forget it.
 */
export function amountMatches(expectedPoisha: number, reportedPoisha: number | null): boolean {
  // A provider that does not report an amount cannot be checked; treat the
  // verified outcome as authoritative but record that we could not confirm.
  if (reportedPoisha === null) return true;
  return reportedPoisha === expectedPoisha;
}
