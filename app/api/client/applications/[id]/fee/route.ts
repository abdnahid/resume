import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { membershipFor, raiseApplicationFee } from "@/lib/cm/applications";
import { beginCheckout } from "@/lib/payments/service";

/** Raise the application fee and open a gateway session for it. */
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
    const { payment } = await raiseApplicationFee(id, user.id);
    if (!payment) return NextResponse.json({ error: "Could not raise the fee." }, { status: 500 });

    const app = await prisma.application.findUniqueOrThrow({
      where: { id },
      include: { organization: { select: { nameEn: true } } },
    });

    const checkout = await beginCheckout(
      payment.reference,
      new URL(req.url).origin,
      { name: user.name, email: user.email, mobile: (user as { mobile?: string | null }).mobile ?? null },
      `CM licence application fee — ${app.organization.nameEn}`,
    );

    return NextResponse.json({ reference: payment.reference, redirectUrl: checkout.redirectUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not raise the fee." },
      { status: 409 },
    );
  }
}
