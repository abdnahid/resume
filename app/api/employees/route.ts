import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "better-auth/crypto";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return false;
  const role = (session.user as { role?: string }).role ?? "";
  return role === "superadmin" || role === "officeadmin";
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    // Identity (required)
    id: employeeId,
    nameEn,
    nameBn,
    fatherNameEn,
    fatherNameBn,
    motherNameEn,
    motherNameBn,
    dateOfBirth,
    gender,
    maritalStatus,
    officeId,
    // Identity (optional)
    email,
    mobileHome,
    mobileOffice,
    nid,
    bloodGroup,
    status,
    role,
    dateOfJoining,
    initialDesignationBn,
    // Posting (optional but recommended)
    orgPostId,
    postingGrade,
    postingOfficeId,
    joinedAt,
    postingOrderNo,
    postingOrderDate,
  } = body;

  const required = { employeeId, nameEn, nameBn, fatherNameEn, fatherNameBn, motherNameEn, motherNameBn, dateOfBirth, gender, maritalStatus, officeId };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
  }

  const exists = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (exists) {
    return NextResponse.json({ error: "Employee ID already exists" }, { status: 409 });
  }

  const userId = `user_${employeeId}`;
  const password = await hashPassword("bsti@123");
  const now = new Date();
  const derivedEmail = email?.trim() || `${employeeId}@bsti.gov.bd`;

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: userId,
        name: nameEn,
        email: derivedEmail,
        emailVerified: false,
        username: employeeId,
        role: role ?? "employee",
        createdAt: now,
        updatedAt: now,
      },
    });

    await tx.account.create({
      data: {
        id: `acc_${employeeId}`,
        accountId: employeeId,
        providerId: "credential",
        userId,
        password,
        createdAt: now,
        updatedAt: now,
      },
    });

    await tx.employee.create({
      data: {
        id: employeeId,
        nameEn,
        nameBn,
        fatherNameEn,
        fatherNameBn,
        motherNameEn,
        motherNameBn,
        dateOfBirth,
        gender,
        maritalStatus,
        officeId: Number(officeId),
        userId,
        status: status ?? "active",
        email: email?.trim() || null,
        mobileHome: mobileHome || null,
        mobileOffice: mobileOffice || null,
        nid: nid || null,
        bloodGroup: bloodGroup || null,
        dateOfJoining: dateOfJoining || null,
        initialDesignationBn: initialDesignationBn || null,
      },
    });

    if (joinedAt) {
      await tx.posting.create({
        data: {
          employeeId,
          orgPostId: orgPostId ? Number(orgPostId) : null,
          officeId: Number(postingOfficeId ?? officeId),
          grade: postingGrade || "0",
          joinedAt,
          type: "initial",
          orderNo: postingOrderNo || null,
          orderDate: postingOrderDate || null,
        },
      });
    }
  });

  return NextResponse.json({ id: employeeId }, { status: 201 });
}
