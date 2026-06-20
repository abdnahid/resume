import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.username ?? "";
  const { bankAccountNo, bankBranch, tinNo } = await req.json();

  try {
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        bankAccountNo: bankAccountNo || null,
        bankBranch:    bankBranch    || null,
        tinNo:         tinNo         || null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
