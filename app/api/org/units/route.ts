import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrgTree } from "@/lib/org";

function slug(nameEn: string): string {
  return (
    nameEn
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Date.now()
  );
}

export async function GET() {
  const tree = await getOrgTree();
  return NextResponse.json(tree);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "superadmin" && role !== "officeadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { nameEn, nameBn, category, parentId, sortOrder } = await req.json();
  if (!nameEn || !nameBn) {
    return NextResponse.json({ error: "nameEn and nameBn are required" }, { status: 400 });
  }

  const unit = await prisma.orgUnit.create({
    data: {
      slug: slug(nameEn),
      nameEn,
      nameBn,
      category: category ?? "unit",
      parentId: parentId ?? null,
      sortOrder: sortOrder ?? 0,
    },
  });

  return NextResponse.json(unit, { status: 201 });
}
