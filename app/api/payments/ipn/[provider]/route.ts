import { NextResponse } from "next/server";
import { providerByKey } from "@/lib/payments/registry";
import { fulfilPayment } from "@/lib/payments/fulfil";
import { prisma } from "@/lib/prisma";

/**
 * Server-to-server notification from the gateway.
 *
 * Unauthenticated by nature — the caller is the gateway, not a signed-in user —
 * which is precisely why the body is never trusted. It is read only for the
 * reference; the outcome comes from asking the gateway back through `verify()`.
 * A forged IPN therefore achieves nothing beyond causing us to re-check.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: key } = await params;
  const provider = providerByKey(key);
  if (!provider) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    try {
      body = Object.fromEntries((await req.formData()).entries()) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }

  const { reference } = provider.parseCallback(body);
  if (!reference) return NextResponse.json({ error: "No reference" }, { status: 400 });

  const payment = await prisma.payment.findUnique({
    where: { reference },
    select: { id: true },
  });
  if (!payment) return NextResponse.json({ error: "Unknown reference" }, { status: 404 });

  // Fulfilment runs here as well as on the return page: an IPN arrives even when
  // the payer closes the tab on the gateway and never comes back.
  const result = await fulfilPayment(reference);

  return NextResponse.json({ ok: true, status: result.status });
}
