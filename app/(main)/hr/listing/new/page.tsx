import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AddEmployeeForm from "./_components/AddEmployeeForm";

export const metadata = { title: "Add Employee — BSTI" };

export default async function NewEmployeePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "superadmin" && role !== "officeadmin") redirect("/hr/listing");

  const [orgPosts, offices] = await Promise.all([
    prisma.orgPost.findMany({
      where: { isActive: true },
      include: { unit: { include: { parent: true } } },
      orderBy: [{ unit: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    prisma.office.findMany({ orderBy: { id: "asc" } }),
  ]);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Employee Management</p>
        <h1 className="text-xl font-bold text-foreground">Add New Employee</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Creates a login account (username = Employee ID, default password: <code className="bg-muted px-1 rounded text-xs">bsti@123</code>) and optionally assigns an initial posting.
        </p>
      </div>

      <AddEmployeeForm
        orgPosts={orgPosts.map((p) => ({
          id: p.id,
          nameBn: p.nameBn,
          nameEn: p.nameEn,
          grade: p.grade ?? "",
          unitNameBn: p.unit.nameBn,
          unitParentBn: p.unit.parent?.nameBn ?? null,
        }))}
        offices={offices.map((o) => ({ id: o.id, nameBn: o.nameBn, nameEn: o.nameEn }))}
      />
    </div>
  );
}
