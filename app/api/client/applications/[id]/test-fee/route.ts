import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { membershipFor, raiseTestFee } from "@/lib/cm/applications";
import { beginCheckout } from "@/lib/payments/service";

/**
 * Raise the **testing fee** and open a gateway session for it (D129).
 *
 * The demand was made when the sampling letters were issued; this turns it into
 * a payable row at the figure that was quoted and sends the payer to the
 * gateway. Same shape as the application fee, deliberately — there is one way
 * money is taken in this system.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await membershipFor(user.id, id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (m.role === "viewer")
    return NextResponse.json({ error: "You do not have permission to pay for this application." }, { status: 403 });

  try {
    const { payment } = await raiseTestFee(id, user.id);
    if (!payment) return NextResponse.json({ error: "Could not raise the testing fee." }, { status: 500 });

    const app = await prisma.application.findUniqueOrThrow({
      where: { id },
      include: { organization: { select: { nameEn: true } } },
    });

    const checkout = await beginCheckout(
      payment.reference,
      new URL(req.url).origin,
      { name: user.name, email: user.email, mobile: (user as { mobile?: string | null }).mobile ?? null },
      `CM testing fee — ${app.organization.nameEn}`,
    );

    return NextResponse.json({ reference: payment.reference, redirectUrl: checkout.redirectUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not raise the testing fee." },
      { status: 409 },
    );
  }
}
