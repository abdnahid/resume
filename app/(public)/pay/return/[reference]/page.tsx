import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle, Clock, ArrowRight, Download, FlaskConical } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireClient } from "@/lib/auth-guard";
import { fulfilBdsPurchase } from "@/lib/store/purchase";
import { settlePayment } from "@/lib/payments/service";
import { formatPoisha } from "@/lib/payments/money";
import Footer from "@/components/layout/Footer";

export const metadata = { title: "Payment — BSTI e-Services" };

/**
 * Where the gateway sends the payer back to.
 *
 * **The URL is not evidence.** Anyone can navigate here, so this page settles
 * the payment by asking the gateway through `verify()` and renders whatever the
 * answer is. A payer who edits the address bar sees the true status, not a
 * receipt.
 */
export default async function PaymentReturnPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const viewer = await requireClient(`/pay/return/${encodeURIComponent(reference)}`);

  const existing = await prisma.payment.findUnique({
    where: { reference },
    select: { purpose: true, payerUserId: true },
  });
  if (!existing) notFound();

  // A receipt is not readable by reference alone. The reference is the
  // reconciliation key printed on demand notes (spec §6) and will travel by
  // email, SMS and paper — treating possession of it as proof of identity would
  // make every one of those a leak. 404 rather than 403: someone else's payment
  // should not be confirmed to exist.
  if (existing.payerUserId !== viewer.id) notFound();

  // Settling here as well as in the IPN handler is deliberate: whichever
  // arrives first does the work, and `newlyPaid` makes fulfilment happen once.
  const result =
    existing.purpose === "bds_purchase"
      ? await fulfilBdsPurchase(reference)
      : { ...(await settlePayment(reference)), purchase: null };

  const payment = await prisma.payment.findUniqueOrThrow({ where: { reference } });

  const paid = payment.status === "paid";
  const waiting = payment.status === "pending" || payment.status === "initiated";

  const Icon = paid ? CheckCircle2 : waiting ? Clock : XCircle;
  const tone = paid
    ? "text-emerald-600 dark:text-emerald-400"
    : waiting
      ? "text-amber-600 dark:text-amber-400"
      : "text-destructive";

  const heading = paid
    ? "Payment received"
    : payment.status === "cancelled"
      ? "Payment cancelled"
      : waiting
        ? "Waiting for the gateway"
        : "Payment failed";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-[720px] flex-1 px-5 py-14 lg:px-10">
        <div className="rounded-2xl border border-border bg-card p-8">
          <Icon className={`h-10 w-10 ${tone}`} strokeWidth={1.8} />
          <h1 className="mt-4 font-display text-2xl font-medium text-foreground">{heading}</h1>

          {payment.isSandbox && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              <FlaskConical className="h-3.5 w-3.5" strokeWidth={2} />
              Sandbox payment — no money moved
            </p>
          )}

          {result.reason && !paid && (
            <p className="mt-3 text-sm text-muted-foreground">{result.reason}</p>
          )}
          {payment.failureReason && !paid && (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {payment.failureReason}
            </p>
          )}

          <dl className="mt-6 divide-y divide-border rounded-xl border border-border">
            <Row k="Reference" v={payment.reference} mono />
            <Row k="Fee" v={formatPoisha(payment.incomePoisha)} />
            <Row k={`VAT (${payment.vatRateBp / 100}%)`} v={formatPoisha(payment.vatPoisha)} />
            <Row k="Total" v={formatPoisha(payment.totalPoisha)} strong />
            {payment.method && <Row k="Paid with" v={payment.method} />}
            {payment.providerRef && <Row k="Gateway reference" v={payment.providerRef} mono />}
          </dl>

          {paid && result.purchase && (
            <div className="mt-6 rounded-xl border border-primary/40 bg-secondary/40 p-5">
              <p className="text-sm font-medium text-foreground">
                {result.purchase.bds.number} — {result.purchase.bds.titleEn}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {result.purchase.purchaseNumber}
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
                The PDF download arrives with the kernel document store.
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/public/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              My account
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            {!paid && (
              <Link
                href="/store/bds"
                className="text-sm font-medium text-primary hover:underline"
              >
                Back to the catalogue
              </Link>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Row({ k, v, mono, strong }: { k: string; v: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3">
      <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
      <dd
        className={`text-sm sm:col-span-2 ${mono ? "font-mono text-xs" : ""} ${
          strong ? "font-semibold text-foreground" : "text-foreground"
        }`}
      >
        {v}
      </dd>
    </div>
  );
}
