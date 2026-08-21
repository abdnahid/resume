import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrgPostsFlat, getOrgRoots, resolveOfficeRootId } from "@/lib/org";
import PostingForm from "./_components/PostingForm";

export const metadata = { title: "New Posting — BSTI" };

export default async function NewPostingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "superadmin" && role !== "officeadmin") redirect("/hr/listing");

  const { id } = await params;

  const [employee, orgPosts, orgRoots, rawOffices] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      include: {
        postings: {
          where: { relievedAt: null },
          take: 1,
          include: {
            orgPost: { include: { unit: { include: { parent: true } } } },
            office: true,
          },
        },
      },
    }),
    getOrgPostsFlat(),
    getOrgRoots(),
    prisma.office.findMany({ orderBy: { id: "asc" } }),
  ]);

  if (!employee) notFound();

  const currentPosting = employee.postings[0] ?? null;

  // Resolve which OrgUnit root each office maps to
  const offices = rawOffices.map((o) => ({
    id: o.id,
    nameBn: o.nameBn,
    nameEn: o.nameEn,
    type: o.type as string,
    rootId: resolveOfficeRootId(o.nameEn, o.type as string, orgRoots),
  }));

  const wings = orgRoots.filter((r) => r.category === "wing");

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">New Posting</p>
        <h1 className="text-xl font-bold text-foreground font-bn-serif">{employee.nameBn}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {currentPosting
            ? `Currently: ${currentPosting.orgPost?.nameBn ?? "—"} @ ${currentPosting.office.nameBn}`
            : "No active posting"}
        </p>
      </div>

      <PostingForm
        employeeId={id}
        orgPosts={orgPosts}
        wings={wings}
        offices={offices}
        defaultOfficeId={currentPosting?.officeId ?? employee.officeId}
        defaultGrade={currentPosting?.grade ?? employee.grade ?? ""}
      />
    </div>
  );
}
