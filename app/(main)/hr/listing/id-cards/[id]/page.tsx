import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ORG } from "@/lib/db";
import { getIdCardBatchById } from "@/lib/id-card";
import AuthorizationListDocument from "./_components/AuthorizationListDocument";

export default async function AuthorizationListPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role ?? "employee";
  if (role !== "superadmin") redirect("/hr/listing");

  const numId = Number(params.id);
  if (Number.isNaN(numId)) notFound();

  const batch = await getIdCardBatchById(numId);
  if (!batch) notFound();

  return <AuthorizationListDocument batch={batch} org={ORG} />;
}
