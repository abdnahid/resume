import { prisma } from "@/lib/prisma";
import LoginForm from "./_components/LoginForm";

/**
 * The office quick-login is a development convenience that signs in as an office
 * admin with a shared default password. This page is now reachable by the
 * public, so that button must never exist in a production build.
 */
const showQuickLogin = process.env.NODE_ENV !== "production";

export default async function LoginPage() {
  const offices = showQuickLogin
    ? await prisma.office.findMany({
        orderBy: { id: "asc" },
        include: {
          employees: {
            where: { user: { role: "officeadmin" } },
            select: { user: { select: { username: true } } },
            take: 1,
          },
        },
      })
    : [];

  const officeOptions = offices.map((o) => ({
    id: o.id,
    nameBn: o.nameBn,
    adminUsername: o.employees[0]?.user?.username ?? null,
  }));

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <LoginForm officeOptions={officeOptions} showQuickLogin={showQuickLogin} />
    </div>
  );
}
