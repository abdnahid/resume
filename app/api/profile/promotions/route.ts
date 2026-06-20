import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PromRow = {
  designationBn: string; designationEn: string;
  grade: string; effectiveDate: string;
  orderNo?: string; orderDate?: string;
};

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.username ?? "";
  const { rows }: { rows: PromRow[] } = await req.json();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.promotion.deleteMany({ where: { employeeId } });
      if (rows.length > 0) {
        await tx.promotion.createMany({
          data: rows.map((r, i) => ({
            employeeId,
            sl:            i + 1,
            designationBn: r.designationBn,
            designationEn: r.designationEn,
            grade:         r.grade,
            effectiveDate: r.effectiveDate,
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
