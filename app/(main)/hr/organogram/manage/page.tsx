import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgTree } from "@/lib/org";
import ManageClient from "./_components/ManageClient";

export const metadata = { title: "Manage Organogram — BSTI" };

export default async function ManagePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "superadmin") redirect("/hr/organogram");

  const tree = await getOrgTree();

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b border-border bg-card px-8 py-5">
        <h1 className="text-lg font-bold text-foreground">Manage Organogram Structure</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Add, edit, or remove units and sanctioned posts. Changes take effect immediately.
        </p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <ManageClient initialTree={tree} />
      </div>
    </div>
  );
}
