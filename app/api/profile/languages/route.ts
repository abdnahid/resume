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
      await tx.language.deleteMany({ where: { employeeId } });
      if (rows.length > 0) {
        await tx.language.createMany({
          data: (rows as { name: string; proficiency?: string; comment?: string }[]).map((r, i) => ({
            employeeId,
            sl:          i + 1,
            name:        r.name,
            proficiency: r.proficiency || null,
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
