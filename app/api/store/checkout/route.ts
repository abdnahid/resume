import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startBdsPurchase } from "@/lib/store/purchase";
import { beginCheckout } from "@/lib/payments/service";
import { salePricePolicy } from "@/lib/cm/policy";

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

  // What it sells for, and whether that figure is BSTI's or a stand-in (D49).
  // The price is resolved here and again inside `startBdsPurchase()`, which is
  // the layer that actually charges — this one exists so the refusal, if the
  // policy ever returns one, is a 409 rather than a thrown error.
  const price = salePricePolicy(bds);
  if (price.priceBdt <= 0) {
    return NextResponse.json(
      {
        error:
          "This standard is not on sale yet — its price has not been published to the system. Please contact BSTI's Standards Wing to buy it.",
      },
      { status: 409 },
    );
  }

  // Bought from inside an application (D50)? Then the purchase attaches itself
  // to that application when the money settles, instead of leaving the
  // applicant to do by hand the thing they just paid for.
  //
  // Checked here, at the moment the payment is raised, against a session that
  // is already proven — not read back off the return URL, which anyone can
  // edit. A caller naming an application they have no standing on is refused
  // rather than quietly downgraded to an ordinary purchase.
  let attachToApplicationId: number | null = null;
  let applicationOrganizationId: number | null = null;
  if (body.applicationId !== undefined && body.applicationId !== null) {
    const applicationId = Number(body.applicationId);
    if (!Number.isInteger(applicationId))
      return NextResponse.json({ error: "Which application?" }, { status: 400 });

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, organizationId: true, state: true },
    });
    if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: app.organizationId } },
    });
    if (!membership || membership.role === "viewer")
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    if (app.state !== "draft" && app.state !== "pending_app_fee")
      return NextResponse.json(
        { error: "That application can no longer be edited." },
        { status: 409 },
      );

    attachToApplicationId = app.id;
    applicationOrganizationId = app.organizationId;
  }

  // Scope the purchase to the company being acted as (spec §2.5). Absent one,
  // it is a personal purchase.
  //
  // **Buying from inside an application scopes to *that application's*
  // company**, not to whichever profile happens to be the default. A purchase
  // is party-scoped and a group member may not use the parent's
  // (`purchaseOwnershipPolicy`, §10 #4) — so scoping an in-flow purchase to the
  // default profile bought the standard for one company and then refused it to
  // the company that was applying. Worse where the default profile is a group
  // parent, which D29 says never applies at all: the purchase would have been
  // unusable by anybody.
  const acting = applicationOrganizationId
    ? { organizationId: applicationOrganizationId }
    : await prisma.organizationMembership.findFirst({
        where: { userId: user.id, isDefault: true },
        select: { organizationId: true },
      });

  const { payment } = await startBdsPurchase({
    bdsId,
    userId: user.id,
    organizationId: acting?.organizationId ?? null,
    attachToApplicationId,
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
