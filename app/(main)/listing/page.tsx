import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getEmployees } from "@/lib/db";
import EmployeeTable from "./_components/EmployeeTable";

export default async function ListingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string })?.role ?? "employee";

  const employees = await getEmployees();

  return (
    <div>
      <EmployeeTable employees={employees} role={role} />
    </div>
  );
}
