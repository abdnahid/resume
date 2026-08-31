import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, Factory as FactoryIcon } from "lucide-react";
import { requireClient } from "@/lib/auth-guard";
import { organizationsFor } from "@/lib/client/organization";
import Footer from "@/components/layout/Footer";
import StartApplication from "../[id]/_components/StartApplication";

export const metadata = { title: "Apply for a CM licence — BSTI e-Services" };

/**
 * Choosing what to apply for: a company, then one of its factories.
 *
 * The factory choice is the consequential one — it decides which BSTI office
 * receives the file — so the receiving office is named beside each option
 * rather than revealed after submission.
 */
export default async function NewApplicationPage() {
  const viewer = await requireClient("/public/applications/new");
  const organizations = await organizationsFor(viewer.id);

  // Nothing to apply with: send them to build a profile rather than showing an
  // empty picker.
  if (organizations.length === 0) redirect("/public/companies/new");

  const eligible = organizations.filter((o) => o.canApply);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-[900px] flex-1 px-5 py-14 lg:px-10">
        <Link
          href="/public/services/cm-licence"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          CM Quality Licence
        </Link>
        <h1 className="mt-4 font-display text-3xl font-medium text-foreground">
          Apply for a CM licence
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          One application covers one product made at one factory. Choose the factory first — its
          location decides which BSTI office handles your file.
        </p>

        {eligible.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/60 p-8">
            <Building2 className="h-8 w-8 text-primary" strokeWidth={1.6} />
            <h2 className="mt-4 font-semibold text-foreground">No company can apply yet</h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
              A mother organisation cannot hold a licence itself — the companies under it apply for
              their own products. Add a company to your group to continue.
            </p>
            <Link
              href="/public/companies"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              My companies
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            {eligible.map((org) => (
              <section key={org.id} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">{org.nameEn}</h2>
                    {org.nameBn && org.nameBn !== org.nameEn && (
                      <p className="font-bn text-sm text-muted-foreground">{org.nameBn}</p>
                    )}
                  </div>
                  {!org.isComplete && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                      Profile incomplete
                    </span>
                  )}
                </div>

                {!org.isComplete && (
                  <p className="mt-3 rounded-lg bg-amber-500/5 px-3 py-2.5 text-sm text-muted-foreground">
                    You can start an application now, but it cannot be submitted until the profile
                    is complete —{" "}
                    <Link
                      href={`/public/companies/${org.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      finish it
                    </Link>
                    .
                  </p>
                )}

                {org.factories.length === 0 ? (
                  <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
                    No factory registered.{" "}
                    <Link
                      href={`/public/companies/${org.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      Add one
                    </Link>{" "}
                    to apply.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {org.factories.map((f) => (
                      <li
                        key={f.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium text-foreground">
                            <FactoryIcon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
                            {f.nameEn}
                          </p>
                          <p className="mt-1 font-bn text-sm text-muted-foreground">
                            {f.district}
                            {f.office && <> → {f.office.nameBn}</>}
                          </p>
                        </div>
                        <StartApplication organizationId={org.id} factoryId={f.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
