import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const employeeId = session.user.username ?? "";

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  if (employee.profileStatus === "approved") {
    // Re-submission after approval — allowed; sends it back for re-review
  }

  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      profileStatus: "submitted",
      profileSubmittedAt: new Date(),
      profileRevisionNote: null,
    },
  });

  return NextResponse.json({ ok: true });
}
