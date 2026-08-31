import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshStatus, missingForSubmission } from "@/lib/client/organization";

/** The membership row, or null when this user has no business here. */
async function membership(organizationId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return null;
  return prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
}

const EDITABLE = [
  "nameEn", "nameBn", "legalForm", "tradeLicenceNo", "tradeLicenceAuthority",
  "tradeLicenceExpiry", "binNo", "tinNo", "incorporationNo", "addressLine",
  "division", "district", "upazila", "postCode", "phone", "email", "website",
  "repName", "repDesignation", "repMobile", "repEmail", "repNid",
] as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const m = await membership(id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      factories: { include: { bstiOffice: { select: { nameEn: true, nameBn: true } } } },
      documents: true,
      members: { select: { id: true, nameEn: true, nameBn: true, status: true } },
      parent: { select: { id: true, nameEn: true } },
    },
  });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ organization: org, missing: missingForSubmission(org) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const m = await membership(id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // A viewer may read the profile but not rewrite it.
  if (m.role === "viewer")
    return NextResponse.json({ error: "You do not have permission to edit this profile." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const data: Record<string, string | null> = {};
  for (const key of EDITABLE) {
    if (!(key in body)) continue;
    const v = typeof body[key] === "string" ? (body[key] as string).trim() : "";
    data[key] = v || null;
  }
  // The two names are the profile's identity; blanking one is never intended.
  if (data.nameEn === null) delete data.nameEn;
  if (data.nameBn === null) delete data.nameBn;

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const org = await prisma.organization.update({ where: { id }, data: data as never });
  await refreshStatus(id);
  return NextResponse.json({ organization: org });
}
