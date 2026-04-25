import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import officesData from "../utils/offices.json";
import employeesData from "../lib/employees.json";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── Fixation data ────────────────────────────────────────────────────────────
// null  → no fixation record (displayed as "not_found")
// "active"   stored + future validThru  → displayed "active"
// "inactive" stored                     → displayed "inactive" (admin override)
// "active"   stored + past   validThru  → displayed "expired"  (computed in code)

const FIXATION_DATA: Record<string, {
  grade: number; basicSalary: number;
  validFrom: string; validThru: string;
  salaryStatus: "active" | "inactive";
} | null> = {
  "20220010021": { grade: 1,  basicSalary: 78000, validFrom: "01-01-2024", validThru: "12-31-2026", salaryStatus: "active"   }, // active
  "19953010010": { grade: 5,  basicSalary: 43000, validFrom: "01-01-2022", validThru: "06-30-2026", salaryStatus: "active"   }, // active
  "20020030007": { grade: 5,  basicSalary: 42000, validFrom: "07-01-2022", validThru: "06-30-2026", salaryStatus: "active"   }, // active
  "20105010089": { grade: 9,  basicSalary: 35000, validFrom: "01-01-2023", validThru: "12-31-2026", salaryStatus: "active"   }, // active
  "20101030016": { grade: 9,  basicSalary: 33000, validFrom: "07-01-2023", validThru: "09-30-2026", salaryStatus: "active"   }, // active
  "20051030005": { grade: 11, basicSalary: 24000, validFrom: "01-01-2022", validThru: "12-31-2025", salaryStatus: "inactive" }, // inactive
  "20051030006": { grade: 11, basicSalary: 24000, validFrom: "01-01-2022", validThru: "12-31-2025", salaryStatus: "inactive" }, // inactive
  "20101030015": { grade: 16, basicSalary: 9300,  validFrom: "01-01-2022", validThru: "12-31-2024", salaryStatus: "active"   }, // expired (past validThru)
  "20220010022": { grade: 9,  basicSalary: 29000, validFrom: "01-01-2023", validThru: "06-30-2025", salaryStatus: "active"   }, // expired (past validThru)
  "20220010023": null,                                                                                                           // not_found
  "20150040012": { grade: 16, basicSalary: 9300,  validFrom: "01-01-2023", validThru: "12-31-2026", salaryStatus: "active"   }, // active
  "20180060003": { grade: 16, basicSalary: 9300,  validFrom: "01-01-2023", validThru: "12-31-2026", salaryStatus: "active"   }, // active
};

// ─── Role assignment ──────────────────────────────────────────────────────────

const ROLE_MAP: Record<string, string> = {
  "20220010021": "superadmin",
  "19953010010": "officeadmin",
  "20020030007": "officeadmin",
  "20150040012": "data_entry",
  "20180060003": "data_entry",
};

// ─── Blood group mapping ──────────────────────────────────────────────────────

const BLOOD_GROUP_MAP: Record<string, string> = {
  "A+": "A_pos", "A-": "A_neg",
  "B+": "B_pos", "B-": "B_neg",
  "AB+": "AB_pos", "AB-": "AB_neg",
  "O+": "O_pos", "O-": "O_neg",
};

function mapBloodGroup(bg: string | undefined | null): string | null {
  if (!bg) return null;
  return BLOOD_GROUP_MAP[bg] ?? null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Cleaning database...");

  await prisma.salaryProcess.deleteMany();
  await prisma.salaryFixation.deleteMany();
  await prisma.salaryHistory.deleteMany();
  await prisma.workHistory.deleteMany();
  await prisma.education.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.training.deleteMany();
  await prisma.foreignTraining.deleteMany();
  await prisma.publication.deleteMany();
  await prisma.award.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.address.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.office.deleteMany();

  // ── Offices ────────────────────────────────────────────────────────────────
  console.log("Seeding offices...");
  for (const office of officesData) {
    await prisma.office.create({
      data: {
        id: office.id,
        type: office.type as any,
        nameEn: office.nameEn,
        nameBn: office.nameBn,
        officeHead: office.officeHead,
        addressEn: office.addressEn,
        addressBn: office.addressBn,
        phone: office.phone ?? null,
        email: office.email ?? null,
      },
    });
  }
  console.log(`  Created ${officesData.length} offices`);

  // Build office lookup: nameEn → id
  const officeByName = new Map<string, number>(
    officesData.map((o) => [o.nameEn, o.id])
  );

  const password = await hashPassword("bsti@123");
  const now = new Date();

  // ── Employees ──────────────────────────────────────────────────────────────
  console.log("Seeding employees...");

  for (const emp of (employeesData as any).employees) {
    const role = ROLE_MAP[emp.id as string] ?? "employee";
    const officeId = officeByName.get(emp.current_job.office_en as string);

    if (!officeId) {
      console.warn(`  SKIP: office not found for "${emp.current_job.office_en}" (employee ${emp.id})`);
      continue;
    }

    const userId = `user_${emp.id}`;

    // User
    await prisma.user.create({
      data: {
        id: userId,
        name: emp.name.en,
        email: emp.email ?? `${emp.id}@bsti.gov.bd`,
        emailVerified: false,
        username: emp.id,
        role: role as any,
        createdAt: now,
        updatedAt: now,
      },
    });

    // Account (credential provider)
    await prisma.account.create({
      data: {
        id: `acc_${emp.id}`,
        accountId: emp.id,
        providerId: "credential",
        userId,
        password,
        createdAt: now,
        updatedAt: now,
      },
    });

    // Addresses
    let presentAddressId: number | undefined;
    let permanentAddressId: number | undefined;

    if (emp.addresses?.present) {
      const a = emp.addresses.present;
      const rec = await prisma.address.create({
        data: {
          village: a.line_en ?? null,
          postOffice: a.post_office ?? null,
          upazila: a.upazila ?? null,
          district: a.district ?? null,
        },
      });
      presentAddressId = rec.id;
    }

    if (emp.addresses?.permanent) {
      const a = emp.addresses.permanent;
      const rec = await prisma.address.create({
        data: {
          village: a.line_en ?? null,
          postOffice: a.post_office ?? null,
          upazila: a.upazila ?? null,
          district: a.district ?? null,
        },
      });
      permanentAddressId = rec.id;
    }

    // Employee (with nested creates)
    await prisma.employee.create({
      data: {
        id: emp.id,
        status: emp.status as any,
        nameEn: emp.name.en,
        nameBn: emp.name.bn,
        fatherNameEn: emp.father_name.en,
        fatherNameBn: emp.father_name.bn,
        motherNameEn: emp.mother_name.en,
        motherNameBn: emp.mother_name.bn,
        dateOfBirth: emp.date_of_birth,
        gender: (emp.gender as string).toLowerCase() as any,
        maritalStatus: (emp.marital_status as string).toLowerCase() as any,
        bloodGroup: mapBloodGroup(emp.blood_group) as any,
        nid: emp.nid ?? null,
        passportNo: emp.passport_no ?? null,
        email: emp.email ?? null,
        mobileHome: emp.mobile_home ?? null,
        mobileOffice: emp.mobile_office ?? null,
        phone: emp.phone ?? null,
        wing: emp.wing ?? null,
        emergencyName: emp.emergency_contact?.name ?? null,
        emergencyRelation: emp.emergency_contact?.relation ?? null,
        emergencyPhone: emp.emergency_contact?.phone ?? null,
        emergencyMobile: emp.emergency_contact?.mobile ?? null,
        designationEn: emp.current_job.designation_en,
        designationBn: emp.current_job.designation_bn,
        grade: emp.current_job.grade,
        division: emp.current_job.division ?? null,
        initialDesignationBn: emp.current_job.initial_designation_bn ?? null,
        dateOfJoining: emp.current_job.date_of_joining ?? null,
        postRetirementLeave: emp.current_job.post_retirement_leave ?? null,
        fullRetirement: emp.current_job.full_retirement ?? null,
        officeId,
        userId,
        presentAddressId: presentAddressId ?? null,
        permanentAddressId: permanentAddressId ?? null,

        fixation: (() => {
          const f = FIXATION_DATA[emp.id as string];
          if (!f) return undefined;
          return { create: { grade: f.grade, basicSalary: f.basicSalary, validFrom: f.validFrom, validThru: f.validThru, salaryStatus: f.salaryStatus as any } };
        })(),

        salaryHistory: emp.salary_history?.length ? {
          create: (emp.salary_history as any[]).map((h) => ({
            sl: h.sl,
            grade: h.grade,
            basic: h.basic,
            month: h.month,
            year: h.year,
          })),
        } : undefined,

        workHistory: emp.work_history?.length ? {
          create: (emp.work_history as any[]).map((w) => ({
            sl: w.sl,
            designationBn: w.designation_bn,
            designationEn: w.designation_en,
            grade: w.grade,
            office: w.office,
            start: w.start,
            end: w.end,
            orderNo: w.order_no ?? null,
            orderDate: w.order_date ?? null,
          })),
        } : undefined,

        educations: emp.education?.length ? {
          create: (emp.education as any[]).map((e) => ({
            sl: e.sl,
            degree: e.degree_primary,
            subject: e.subject ?? null,
            institution: e.institution,
            passingYear: e.year,
            result: e.result ?? null,
          })),
        } : undefined,

        promotions: emp.promotions?.length ? {
          create: (emp.promotions as any[]).map((p) => ({
            sl: p.sl,
            designationBn: p.designation_bn,
            designationEn: p.designation_en,
            grade: "",
            effectiveDate: p.joining_date,
            orderNo: p.order_no ?? null,
            orderDate: p.order_date ?? null,
          })),
        } : undefined,

        trainings: emp.trainings?.length ? {
          create: (emp.trainings as any[]).map((t) => ({
            sl: t.sl,
            title: t.course_name,
            institution: t.institution ?? null,
            duration: t.duration ?? null,
          })),
        } : undefined,

        foreignTrainings: emp.foreign_trainings?.length ? {
          create: (emp.foreign_trainings as any[]).map((ft) => ({
            sl: ft.sl,
            title: ft.course_name,
            country: ft.country ?? null,
            institution: ft.institution ?? null,
            duration: ft.duration ?? null,
          })),
        } : undefined,

        publications: emp.publications?.length ? {
          create: (emp.publications as any[]).map((pub) => ({
            sl: pub.sl,
            title: pub.title,
            publisher: pub.publisher ?? null,
            year: pub.year ?? null,
          })),
        } : undefined,

        awards: emp.awards?.length ? {
          create: (emp.awards as any[]).map((a) => ({
            sl: a.sl,
            title: a.title,
            awardedBy: a.org ?? null,
            year: a.date ?? null,
          })),
        } : undefined,
      },
    });

    console.log(`  Created: ${emp.name.en} (${emp.id}) — ${role}`);
  }

  // ── Salary processes ───────────────────────────────────────────────────────
  console.log("Seeding salary processes...");
  let spCount = 0;

  for (const sp of (employeesData as any).salary_processes) {
    // Skip if the employee wasn't seeded (e.g. unknown office)
    const exists = await prisma.employee.findUnique({ where: { id: sp.employee_id } });
    if (!exists) {
      console.warn(`  SKIP salary process: employee ${sp.employee_id} not in DB`);
      continue;
    }

    await prisma.salaryProcess.upsert({
      where: {
        employeeId_month_year: {
          employeeId: sp.employee_id,
          month: sp.month,
          year: sp.year,
        },
      },
      update: {},
      create: {
        employeeId: sp.employee_id,
        netSalary: sp.net_salary,
        issueDate: sp.issue_date,
        month: sp.month,
        year: sp.year,
      },
    });
    spCount++;
  }
  console.log(`  Created ${spCount} salary process records`);

  console.log("\nSeeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
