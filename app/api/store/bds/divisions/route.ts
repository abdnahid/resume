import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const divisions = await prisma.bdsDivision.findMany({
    select: { id: true, nameEn: true, nameBn: true },
    orderBy: { nameEn: "asc" },
  });
  return NextResponse.json({ divisions });
}
