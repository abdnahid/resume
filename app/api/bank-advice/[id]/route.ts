import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role ?? "employee";
  if (role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmin can delete bank advices" },
      { status: 403 }
    );
  }

  const numId = Number(params.id);
  if (isNaN(numId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await prisma.bankAdvice.delete({ where: { id: numId } });
  return NextResponse.json({ success: true });
}
