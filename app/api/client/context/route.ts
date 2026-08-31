import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Switch which company the client is acting as.
 *
 * Stored on the membership rather than in a cookie: someone who signs in from a
 * second device should land on the same company they left off in.
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
    return NextResponse.json({ error: "Which company?" }, { status: 400 });

  const m = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.organizationMembership.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.organizationMembership.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { isDefault: true },
    }),
  ]);

  return NextResponse.json({ ok: true, organizationId });
}
