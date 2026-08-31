import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Network } from "lucide-react";
import { requireClient } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { missingForSubmission } from "@/lib/client/organization";
import Footer from "@/components/layout/Footer";
import CompanyDetail from "../_components/CompanyDetail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return { title: "Company — BSTI e-Services" };
  const org = await prisma.organization.findUnique({ where: { id }, select: { nameEn: true } });
  return { title: `${org?.nameEn ?? "Company"} — BSTI e-Services` };
}

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const viewer = await requireClient(`/public/companies/${id}`);

  // Membership is the access check — a profile is only reachable by someone who
  // belongs to it, so a wrong id is a 404 rather than a 403.
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId: viewer.id, organizationId: id } },
  });
  if (!membership) notFound();

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      factories: {
        include: { bstiOffice: { select: { nameEn: true, nameBn: true } } },
        orderBy: { id: "asc" },
      },
      parent: { select: { id: true, nameEn: true } },
    },
  });
  if (!organization) notFound();

  const missing = missingForSubmission(organization);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-14 lg:px-10">
        <Link
          href="/public/companies"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          My companies
        </Link>

        <h1 className="mt-4 font-display text-3xl font-medium text-foreground">
          {organization.nameEn}
        </h1>
        {organization.nameBn && organization.nameBn !== organization.nameEn && (
          <p className="font-bn text-lg text-muted-foreground">{organization.nameBn}</p>
        )}
        {organization.parent && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Network className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
            A company under{" "}
            <Link
              href={`/public/companies/${organization.parent.id}`}
              className="font-medium text-primary hover:underline"
            >
              {organization.parent.nameEn}
            </Link>
          </p>
        )}

        <div className="mt-10">
          <CompanyDetail organization={organization} missing={missing} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
