import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.username ?? "";
  const { spouse, children } = await req.json();

  try {
    await prisma.$transaction(async (tx) => {
      // Upsert spouse
      if (spouse) {
        const s = spouse as Record<string, string | null>;
        const spouseData = {
          nid:                  s.nid                  || null,
          mobile:               s.mobile               || null,
          nameBn:               s.nameBn               || null,
          nameEn:               s.nameEn               || null,
          motherNameBn:         s.motherNameBn         || null,
          motherNameEn:         s.motherNameEn         || null,
          fatherNameBn:         s.fatherNameBn         || null,
          fatherNameEn:         s.fatherNameEn         || null,
          dateOfBirth:          s.dateOfBirth          || null,
          occupation:           s.occupation           || null,
          bloodGroup:           (s.bloodGroup as Parameters<typeof prisma.spouse.create>[0]["data"]["bloodGroup"]) || null,
          nationality:          s.nationality          || null,
          passportNo:           s.passportNo           || null,
          passportReceivePlace: s.passportReceivePlace || null,
          passportReceiveDate:  s.passportReceiveDate  || null,
          passportIssueDate:    s.passportIssueDate    || null,
          passportExpiryDate:   s.passportExpiryDate   || null,
        };
        await tx.spouse.upsert({
          where:  { employeeId },
          update: spouseData,
          create: { employeeId, ...spouseData },
        });
      }

      // Replace children
      await tx.child.deleteMany({ where: { employeeId } });
      const childRows = (children as Record<string, string | boolean | null>[]) ?? [];
      if (childRows.length > 0) {
        await tx.child.createMany({
          data: childRows.map((c, i) => ({
            employeeId,
            sl:          i + 1,
            nameBn:      (c.nameBn as string)   || null,
            nameEn:      (c.nameEn as string)   || null,
            dateOfBirth: (c.dateOfBirth as string) || null,
            bloodGroup:  (c.bloodGroup as Parameters<typeof prisma.child.create>[0]["data"]["bloodGroup"]) || null,
            brn:         (c.brn as string)      || null,
            nid:         (c.nid as string)      || null,
            gender:      (c.gender as Parameters<typeof prisma.child.create>[0]["data"]["gender"]) || null,
            isSpecial:   Boolean(c.isSpecial),
          })),
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
