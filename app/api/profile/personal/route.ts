import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.username ?? "";
  const body = await req.json();

  const {
    nameEn, nameBn, fatherNameEn, fatherNameBn, motherNameEn, motherNameBn,
    dateOfBirth, gender, maritalStatus, bloodGroup, nid, passportNo,
    nationality, placeOfBirth, signatureLabel, photoLabel,
    email, mobileHome, mobileOffice, phone,
    emergencyName, emergencyRelation, emergencyPhone, emergencyMobile,
  } = body;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          nameEn:           nameEn        ?? undefined,
          nameBn:           nameBn        ?? undefined,
          fatherNameEn:     fatherNameEn  ?? undefined,
          fatherNameBn:     fatherNameBn  ?? undefined,
          motherNameEn:     motherNameEn  ?? undefined,
          motherNameBn:     motherNameBn  ?? undefined,
          dateOfBirth:      dateOfBirth   ?? undefined,
          gender:           gender        ?? undefined,
          maritalStatus:    maritalStatus ?? undefined,
          bloodGroup:       bloodGroup    || null,
          nid:              nid           || null,
          passportNo:       passportNo    || null,
          nationality:      nationality   || null,
          placeOfBirth:     placeOfBirth  || null,
          signatureLabel:   signatureLabel|| null,
          photoLabel:       photoLabel    || null,
          email:            email         || null,
          mobileHome:       mobileHome    || null,
          mobileOffice:     mobileOffice  || null,
          phone:            phone         || null,
          emergencyName:    emergencyName    || null,
          emergencyRelation:emergencyRelation|| null,
          emergencyPhone:   emergencyPhone   || null,
          emergencyMobile:  emergencyMobile  || null,
        },
      });

      // Keep User.name and User.email in sync
      const employee = await tx.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
      if (employee) {
        const userUpdate: Record<string, unknown> = { updatedAt: new Date() };
        if (nameEn) userUpdate.name = nameEn;
        if (email)  userUpdate.email = email;
        await tx.user.update({ where: { id: employee.userId }, data: userUpdate });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
