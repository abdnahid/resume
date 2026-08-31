import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assignJurisdiction, refreshStatus, canApply } from "@/lib/client/organization";

/**
 * Register a factory against a profile.
 *
 * The district is the field that matters most: it decides which BSTI office
 * receives every application made from this factory, and it is resolved and
 * stored here rather than at application time.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const organizationId = Number(body.organizationId);
  if (!Number.isInteger(organizationId))
    return NextResponse.json({ error: "Which company is this factory under?" }, { status: 400 });

  const m = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { organization: { select: { type: true } } },
  });
  if (!m) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (m.role === "viewer")
    return NextResponse.json({ error: "You do not have permission to edit this profile." }, { status: 403 });

  // A mother organisation is administrative — factories belong to the companies
  // under it, and a licence is issued to the entity that owns the plant (§2.4).
  if (!canApply(m.organization.type)) {
    return NextResponse.json(
      { error: "A mother organisation does not hold factories directly. Add the factory to one of its companies." },
      { status: 409 },
    );
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const nameEn = str(body.nameEn);
  const nameBn = str(body.nameBn);
  const district = str(body.district);
  const addressLine = str(body.addressLine);

  if (!nameEn && !nameBn)
    return NextResponse.json({ error: "The factory needs a name." }, { status: 400 });
  if (!district)
    return NextResponse.json(
      { error: "The factory's district is required — it decides which BSTI office handles your applications." },
      { status: 400 },
    );
  if (!addressLine)
    return NextResponse.json({ error: "The factory address is required." }, { status: 400 });

  const factory = await prisma.factory.create({
    data: {
      organizationId,
      nameEn: nameEn || nameBn,
      nameBn: nameBn || nameEn,
      addressLine,
      division: str(body.division) || null,
      district,
      upazila: str(body.upazila) || null,
      postCode: str(body.postCode) || null,
      contactName: str(body.contactName) || null,
      contactMobile: str(body.contactMobile) || null,
    },
  });

  const jurisdiction = await assignJurisdiction(factory.id);
  await refreshStatus(organizationId);

  return NextResponse.json({ factory, jurisdiction });
}
