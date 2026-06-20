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
      await tx.award.deleteMany({ where: { employeeId } });
      if (rows.length > 0) {
        await tx.award.createMany({
          data: (rows as { type?: string; title: string; awardedBy?: string; country?: string; subject?: string; reason?: string; year?: string }[]).map((r, i) => ({
            employeeId, sl: i + 1,
            type:      r.type      || null,
            title:     r.title,
            awardedBy: r.awardedBy || null,
            country:   r.country   || null,
            subject:   r.subject   || null,
            reason:    r.reason    || null,
            year:      r.year      || null,
          })),
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
