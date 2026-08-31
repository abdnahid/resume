import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import Footer from "@/components/layout/Footer";
import ProfileWizard from "../_components/ProfileWizard";

export const metadata = { title: "Add a company — BSTI e-Services" };

export default async function NewCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ parent?: string }>;
}) {
  const viewer = await requireClient("/public/companies/new");
  const { parent } = await searchParams;

  // Adding beneath a group: confirm the caller actually belongs to it before
  // the wizard offers to write into it.
  let parentId: number | undefined;
  let parentName: string | undefined;
  if (parent) {
    const id = Number(parent);
    if (!Number.isInteger(id)) notFound();
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: viewer.id, organizationId: id } },
      include: { organization: { select: { nameEn: true, type: true } } },
    });
    if (!membership || membership.organization.type !== "group_parent") notFound();
    parentId = id;
    parentName = membership.organization.nameEn;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-[900px] flex-1 px-5 py-14 lg:px-10">
        <Link
          href="/public/companies"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          My companies
        </Link>
        <h1 className="mt-4 font-display text-3xl font-medium text-foreground">
          {parentName ? "Add a company to the group" : "Set up a company profile"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A company profile is what a CM quality licence is issued against. You need one before you
          can apply — buying standards from the store does not require it.
        </p>

        <div className="mt-10">
          <ProfileWizard parentId={parentId} parentName={parentName} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
