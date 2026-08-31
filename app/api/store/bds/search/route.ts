import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Search the BDS catalogue — the product list for a CM application.
 *
 * Public, like the store it searches. Withdrawn standards are excluded: nothing
 * can be certified against a withdrawn specification, so offering one as a
 * product would only produce a refusal two steps later.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const divisionId = Number(url.searchParams.get("division"));

  const results = await prisma.bds.findMany({
    where: {
      status: { not: "withdrawn" },
      ...(Number.isInteger(divisionId) ? { divisionId } : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: "insensitive" as const } },
              { titleEn: { contains: q, mode: "insensitive" as const } },
              { titleBn: { contains: q } },
            ],
          }
        : {}),
    },
    include: { division: { select: { nameEn: true, nameBn: true } } },
    orderBy: [{ isMandatory315: "desc" }, { number: "asc" }],
    take: 40,
  });

  return NextResponse.json({
    results: results.map((b) => ({
      id: b.id,
      number: b.number,
      titleEn: b.titleEn,
      titleBn: b.titleBn,
      status: b.status,
      priceBdt: b.priceBdt,
      isMandatory315: b.isMandatory315,
      division: b.division.nameEn,
    })),
  });
}
