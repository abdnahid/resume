import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getEmployeeRecord, getUserOfficeId } from "@/lib/db";
import { getActiveIdCard } from "@/lib/id-card";
import { prisma } from "@/lib/prisma";
import IdCardDocument from "./_components/IdCardDocument";

export default async function IdCardPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role ?? "employee";
  const username = session.user?.username ?? "";
  const { id } = params;

  // Access: superadmin → any. officeadmin → view-only, own office only.
  // employee → own card only. Only superadmin can generate/modify cards.
  const isSuper = role === "superadmin";
  if (!isSuper) {
    if (role === "officeadmin") {
      const myOfficeId = await getUserOfficeId(session.user.id);
      const emp = await prisma.employee.findUnique({
        where: { id },
        select: {
          officeId: true,
          postings: { where: { relievedAt: null }, take: 1, select: { officeId: true } },
        },
      });
      const empOfficeId = emp?.postings[0]?.officeId ?? emp?.officeId ?? null;
      if (!myOfficeId || empOfficeId !== myOfficeId) redirect("/hr/listing");
    } else if (username !== id) {
      redirect("/hr");
    }
  }

  const record = await getEmployeeRecord(id).catch(() => null);
  if (!record) notFound();

  const authorization = await getActiveIdCard(id);

  return (
    <IdCardDocument record={record} authorization={authorization} canManage={isSuper} />
  );
}
