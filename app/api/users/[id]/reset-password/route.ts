import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "better-auth/crypto";

// POST /api/users/[id]/reset-password
// Superadmin only. Resets the user's credential password to "12345678".
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const hashed = await hashPassword("12345678");

  const result = await prisma.account.updateMany({
    where: { userId: id, providerId: "credential" },
    data: { password: hashed },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
