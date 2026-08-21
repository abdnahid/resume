import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDirectorGenerals } from "@/lib/id-card";
import DirectorGeneralManager from "./_components/DirectorGeneralManager";

export default async function DirectorGeneralPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role ?? "employee";
  if (role !== "superadmin") redirect("/hr/listing");

  const directors = await getDirectorGenerals();

  return <DirectorGeneralManager directors={directors} />;
}
