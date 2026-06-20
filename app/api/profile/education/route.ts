import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type EduRow = {
  id?: number;
  degree: string; institution: string; subject?: string;
  board?: string; gpa?: string; result?: string; passingYear: string;
};

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.username ?? "";
  const { rows }: { rows: EduRow[] } = await req.json();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.education.deleteMany({ where: { employeeId } });
      if (rows.length > 0) {
        await tx.education.createMany({
          data: rows.map((r, i) => ({
            employeeId,
            sl:          i + 1,
            degree:      r.degree,
            institution: r.institution,
            subject:     r.subject     || null,
            board:       r.board       || null,
            gpa:         r.gpa         || null,
            result:      r.result      || null,
            passingYear: r.passingYear,
          })),
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
