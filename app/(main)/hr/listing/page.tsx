import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getEmployees, getUserOfficeId } from "@/lib/db";
import { getOrgPostsFlat, getOrgRoots, resolveOfficeRootId } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import EmployeeTable from "./_components/EmployeeTable";

export default async function ListingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as { role?: string; id?: string } | undefined;
  const role = user?.role ?? "employee";

  // Resolve office admin's own office
  let myOfficeId: number | null = null;
  if (role === "officeadmin" && user?.id) {
    myOfficeId = await getUserOfficeId(user.id);
  }

  const [employees, orgPosts, orgRoots, rawOffices] = await Promise.all([
    getEmployees({ role, officeId: myOfficeId ?? undefined }),
    getOrgPostsFlat(),
    getOrgRoots(),
    prisma.office.findMany({ orderBy: { id: "asc" } }),
  ]);

  const offices = rawOffices.map((o) => ({
    id: o.id,
    nameBn: o.nameBn,
    nameEn: o.nameEn,
    type: o.type as string,
    rootId: resolveOfficeRootId(o.nameEn, o.type as string, orgRoots),
  }));

  const wings = orgRoots.filter((r) => r.category === "wing");

  return (
    <div>
      <EmployeeTable
        employees={employees}
        role={role}
        myOfficeId={myOfficeId}
        orgPosts={orgPosts}
        wings={wings}
        offices={offices}
      />
    </div>
  );
}
