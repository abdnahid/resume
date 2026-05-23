import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "superadmin" && role !== "officeadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { unitId, nameEn, nameBn, sanctionedCount, sortOrder } = await req.json();
  if (!unitId || !nameEn || !nameBn) {
    return NextResponse.json({ error: "unitId, nameEn and nameBn are required" }, { status: 400 });
  }

  const post = await prisma.orgPost.create({
    data: {
      unitId,
      nameEn,
      nameBn,
      sanctionedCount: sanctionedCount ?? 1,
      sortOrder: sortOrder ?? 0,
    },
  });

  return NextResponse.json(post, { status: 201 });
}
