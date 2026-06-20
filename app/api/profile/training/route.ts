import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type TrainingRow = {
  isLocal: boolean;
  title: string; institution?: string; result?: string;
  startDate?: string; endDate?: string; duration?: string;
  country?: string;
};

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.username ?? "";
  const { rows }: { rows: TrainingRow[] } = await req.json();

  const local   = rows.filter((r) => r.isLocal);
  const foreign = rows.filter((r) => !r.isLocal);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.training.deleteMany({ where: { employeeId } });
      await tx.foreignTraining.deleteMany({ where: { employeeId } });

      if (local.length > 0) {
        await tx.training.createMany({
          data: local.map((r, i) => ({
            employeeId,
            sl:          i + 1,
            title:       r.title,
            institution: r.institution || null,
            result:      r.result      || null,
            startDate:   r.startDate   || null,
            endDate:     r.endDate     || null,
            duration:    r.duration    || null,
          })),
        });
      }
      if (foreign.length > 0) {
        await tx.foreignTraining.createMany({
          data: foreign.map((r, i) => ({
            employeeId,
            sl:          i + 1,
            title:       r.title,
            country:     r.country     || null,
            institution: r.institution || null,
            result:      r.result      || null,
            startDate:   r.startDate   || null,
            endDate:     r.endDate     || null,
            duration:    r.duration    || null,
          })),
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
