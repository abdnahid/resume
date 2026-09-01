import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sandboxSession } from "@/lib/payments/sandbox";
import SandboxCheckout from "./_components/SandboxCheckout";

export const metadata = { title: "Sandbox payment gateway" };

export default async function SandboxGatewayPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  const [payment, session] = await Promise.all([
    prisma.payment.findUnique({ where: { reference } }),
    sandboxSession(reference),
  ]);
  if (!payment || !session) notFound();

  // What is being paid for, resolved for display only.
  let description = payment.purpose.replace(/_/g, " ");
  if (payment.subjectType === "bds") {
    const bds = await prisma.bds.findUnique({ where: { id: Number(payment.subjectId) } });
    if (bds) description = `${bds.number} — ${bds.titleEn}`;
  }

  // Where the merchant asked the payer to be sent back to. Held by the gateway
  // since session creation, exactly as a real one holds it — inventing a bare
  // `/pay/return/<ref>` here is what dropped the `next` that carries an in-flow
  // buyer back to the application draft they were filling in.
  const returnUrl = session.returnUrl ?? `/pay/return/${encodeURIComponent(reference)}`;

  // A settled session is done; send the payer to the result rather than letting
  // them pay twice.
  if (session.outcome !== "created") {
    const { redirect } = await import("next/navigation");
    redirect(returnUrl);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-14 dark:bg-slate-950">
      <SandboxCheckout
        reference={reference}
        amountPoisha={payment.totalPoisha}
        description={description}
        returnUrl={returnUrl}
        cancelUrl={session.cancelUrl ?? returnUrl}
      />
    </div>
  );
}
