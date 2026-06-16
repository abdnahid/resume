import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EditEmployeeForm from "./_components/EditEmployeeForm";

export const metadata = { title: "Edit Employee — BSTI" };

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "superadmin") redirect("/listing");

  const [employee, offices] = await Promise.all([
    prisma.employee.findUnique({ where: { id } }),
    prisma.office.findMany({ orderBy: { id: "asc" } }),
  ]);

  if (!employee) notFound();

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Employee Management</p>
        <h1 className="text-xl font-bold text-foreground">Edit Employee</h1>
        <p className="text-sm text-muted-foreground mt-1 font-bn-serif">
          {employee.nameBn} <span className="font-mono text-xs text-slate-400 ml-2">{employee.id}</span>
        </p>
      </div>

      <EditEmployeeForm
        employee={{
          id: employee.id,
          nameEn: employee.nameEn,
          nameBn: employee.nameBn,
          fatherNameEn: employee.fatherNameEn,
          fatherNameBn: employee.fatherNameBn,
          motherNameEn: employee.motherNameEn,
          motherNameBn: employee.motherNameBn,
          dateOfBirth: employee.dateOfBirth,
          gender: employee.gender,
          maritalStatus: employee.maritalStatus,
          bloodGroup: employee.bloodGroup ?? "",
          nid: employee.nid ?? "",
          status: employee.status,
          email: employee.email ?? "",
          mobileHome: employee.mobileHome ?? "",
          mobileOffice: employee.mobileOffice ?? "",
          officeId: employee.officeId,
          dateOfJoining: employee.dateOfJoining ?? "",
          initialDesignationBn: employee.initialDesignationBn ?? "",
        }}
        offices={offices.map((o) => ({ id: o.id, nameBn: o.nameBn, nameEn: o.nameEn }))}
      />
    </div>
  );
}
