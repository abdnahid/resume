import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.username ?? "";
  const { rows } = await req.json();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.disciplinaryAction.deleteMany({ where: { employeeId } });
      if (rows.length > 0) {
        await tx.disciplinaryAction.createMany({
          data: (rows as { type: string; reason?: string; description?: string; startDate?: string; endDate?: string; comment?: string }[]).map((r, i) => ({
            employeeId, sl: i + 1,
            type:        r.type,
            reason:      r.reason      || null,
            description: r.description || null,
            startDate:   r.startDate   || null,
            endDate:     r.endDate     || null,
            comment:     r.comment     || null,
          })),
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
