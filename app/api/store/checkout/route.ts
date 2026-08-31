import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startBdsPurchase } from "@/lib/store/purchase";
import { beginCheckout } from "@/lib/payments/service";

/**
 * Buy a standard: raise the payment, open a gateway session, hand back where to
 * send the browser.
 *
 * Open to any signed-in account (D13) — an employee buying a standard is a
 * buyer who happens to have an employee ID.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const bdsId = Number(body.bdsId);
  if (!Number.isInteger(bdsId))
    return NextResponse.json({ error: "Which standard?" }, { status: 400 });

  const bds = await prisma.bds.findUnique({ where: { id: bdsId } });
  if (!bds) return NextResponse.json({ error: "Standard not found" }, { status: 404 });

  // A standard created from the mandatory-certification list carries a
  // stand-in price, because the published list gives the designation and not
  // the Standards Wing's fee. Selling one would charge a made-up amount — and
  // at the ৳0 stand-in, would hand out a purchase for nothing. Refused until a
  // real price is loaded.
  if (bds.priceIsPlaceholder) {
    return NextResponse.json(
      {
        error:
          "This standard is not on sale yet — its price has not been published to the system. Please contact BSTI's Standards Wing to buy it.",
      },
      { status: 409 },
    );
  }

  // Scope the purchase to the company being acted as, when there is one
  // (spec §2.5). Absent one, it is a personal purchase.
  const acting = await prisma.organizationMembership.findFirst({
    where: { userId: user.id, isDefault: true },
    select: { organizationId: true },
  });

  const { payment } = await startBdsPurchase({
    bdsId,
    userId: user.id,
    organizationId: acting?.organizationId ?? null,
  });

  const origin = new URL(req.url).origin;
  const checkout = await beginCheckout(
    payment.reference,
    origin,
    {
      name: user.name,
      email: user.email,
      mobile: (user as { mobile?: string | null }).mobile ?? null,
    },
    `${bds.number} — ${bds.titleEn}`,
    typeof body.next === "string" ? body.next : null,
  );

  return NextResponse.json({ reference: payment.reference, redirectUrl: checkout.redirectUrl });
}
