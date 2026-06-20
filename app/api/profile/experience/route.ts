import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ExpRow = {
  designationBn: string; designationEn: string;
  grade: string; office: string; start: string; end: string;
  orderNo?: string; orderDate?: string;
};

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.username ?? "";
  const { rows }: { rows: ExpRow[] } = await req.json();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.workHistory.deleteMany({ where: { employeeId, type: "previous" } });
      if (rows.length > 0) {
        await tx.workHistory.createMany({
          data: rows.map((r, i) => ({
            employeeId,
            sl:            i + 1,
            type:          "previous",
            designationBn: r.designationBn,
            designationEn: r.designationEn,
            grade:         r.grade,
            office:        r.office,
            start:         r.start,
            end:           r.end,
            orderNo:       r.orderNo   || null,
            orderDate:     r.orderDate || null,
          })),
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
