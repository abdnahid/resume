import Link from "next/link";
import { Building2, Plus, ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/auth-guard";
import { organizationsFor } from "@/lib/client/organization";
import Footer from "@/components/layout/Footer";
import CompanyList from "./_components/CompanyList";

export const metadata = { title: "My companies — BSTI e-Services" };

export default async function CompaniesPage() {
  const viewer = await requireClient("/public/companies");
  const organizations = await organizationsFor(viewer.id);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-14 lg:px-10">
        <Link
          href="/public/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          My account
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-medium text-foreground">My companies</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              A CM quality licence is issued to a company for a product made at one of its
              factories. Set up a profile here before you apply.
            </p>
          </div>
          {organizations.length > 0 && (
            <Link
              href="/public/companies/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Add a company
            </Link>
          )}
        </div>

        <div className="mt-10">
          {organizations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
              <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                <Building2 className="h-6 w-6 text-primary" strokeWidth={1.8} />
              </span>
              <h2 className="font-semibold text-foreground">No company profile yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                You can browse and buy standards without one. A profile is needed only when you
                apply for a CM quality licence — we will ask for what we need step by step.
              </p>
              <Link
                href="/public/companies/new"
                className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Set up a company profile
              </Link>
            </div>
          ) : (
            <CompanyList organizations={organizations} />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
