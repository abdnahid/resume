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
      await tx.publication.deleteMany({ where: { employeeId } });
      if (rows.length > 0) {
        await tx.publication.createMany({
          data: (rows as { type?: string; title: string; publisher?: string; writers?: string; year?: string; description?: string }[]).map((r, i) => ({
            employeeId, sl: i + 1,
            type:        r.type        || null,
            title:       r.title,
            publisher:   r.publisher   || null,
            writers:     r.writers     || null,
            year:        r.year        || null,
            description: r.description || null,
          })),
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
