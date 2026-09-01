import Link from "next/link";
import { ArrowLeft, ArrowRight, Plus, FileText, Building2, Factory as FactoryIcon } from "lucide-react";
import { requireClient } from "@/lib/auth-guard";
import { applicationsFor } from "@/lib/cm/applications";
import { stageInfo } from "@/lib/cm/states";
import Footer from "@/components/layout/Footer";

export const metadata = { title: "My applications — BSTI e-Services" };

export default async function ApplicationsPage() {
  const viewer = await requireClient("/public/applications");
  const applications = await applicationsFor(viewer.id);

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
            <h1 className="font-display text-3xl font-medium text-foreground">My applications</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              CM quality licence applications and the stage each one has reached.
            </p>
          </div>
          {applications.length > 0 && (
            <Link
              href="/public/applications/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              New application
            </Link>
          )}
        </div>

        <div className="mt-10">
          {applications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
              <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                <FileText className="h-6 w-6 text-primary" strokeWidth={1.8} />
              </span>
              <h2 className="font-semibold text-foreground">No applications yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                A CM licence certifies a product made at one of your factories against a Bangladesh
                Standard.
              </p>
              <Link
                href="/public/services/cm-licence"
                className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                About the CM licence
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {applications.map((a) => {
                const info = stageInfo(a.state);
                return (
                  <li key={a.id}>
                    <Link
                      href={`/public/applications/${a.id}`}
                      className="block rounded-2xl border border-border bg-card p-6 transition hover:border-primary/50"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">
                            {a.applicationNo ?? "Draft application"}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {a.product ? a.product.nameEn : "Product not chosen yet"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 text-primary" strokeWidth={1.8} />
                              {a.organization.nameEn}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <FactoryIcon className="h-3 w-3 text-primary" strokeWidth={1.8} />
                              {a.factory.nameEn}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                              info.holder === "applicant"
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                : info.holder === "closed"
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-secondary text-primary"
                            }`}
                          >
                            {info.label}
                          </span>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {info.holder === "applicant" ? "Waiting on you" : info.holder === "closed" ? "Closed" : "With BSTI"}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
