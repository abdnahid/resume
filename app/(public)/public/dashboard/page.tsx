import Link from "next/link";
import { ShoppingBag, FileText, Phone, Mail, ArrowRight, Building2 } from "lucide-react";
import { requireClient } from "@/lib/auth-guard";
import { purchasesFor } from "@/lib/store/purchase";
import { applicationsFor } from "@/lib/cm/applications";
import { stageInfo } from "@/lib/cm/states";
import { formatPoisha } from "@/lib/payments/money";
import Footer from "@/components/layout/Footer";

export const metadata = { title: "My account — BSTI e-Services" };

/**
 * Tier-1 client dashboard (§8.5). Purchases and applications are placeholders
 * with a stated reason rather than links that go nowhere — buying arrives in
 * step 3, applications with the CM module.
 *
 * Staff who land here are shown the same customer view (D13): on a client
 * surface an employee is a buyer who happens to have an employee ID.
 */
export default async function ClientDashboardPage() {
  const viewer = await requireClient("/public/dashboard");
  const [purchases, applications] = await Promise.all([
    purchasesFor(viewer.id),
    applicationsFor(viewer.id),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-14 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          My account
        </p>
        <h1 className="mt-2 font-display text-3xl font-medium text-foreground">
          {viewer.name}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {viewer.mobile && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
              {viewer.mobile}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
            {viewer.email ?? "No email on file"}
          </span>
          {viewer.accountType === "INTERNAL" && (
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-primary">
              BSTI staff — viewing as a customer
            </span>
          )}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Purchases */}
          <section className="rounded-2xl border border-border bg-card p-8">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
              <ShoppingBag className="h-5 w-5 text-primary" strokeWidth={1.8} />
            </div>
            <h2 className="font-semibold text-foreground">My standards</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Standards you buy will appear here to download, and can be attached
              to a certification application later.
            </p>
            {purchases.length === 0 ? (
              <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
                You have not bought any standards yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {purchases.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-border bg-background px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{p.bds.number}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatPoisha(p.payment.totalPoisha)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {p.bds.titleEn}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {p.purchaseNumber}
                      </span>
                      {p.payment.isSandbox && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          sandbox
                        </span>
                      )}
                      {p.organization && (
                        <span className="text-[11px] text-muted-foreground">
                          for {p.organization.nameEn}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/store/bds"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Browse the catalogue
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </section>

          {/* Companies */}
          <section className="rounded-2xl border border-border bg-card p-8">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
              <Building2 className="h-5 w-5 text-primary" strokeWidth={1.8} />
            </div>
            <h2 className="font-semibold text-foreground">My companies</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A CM quality licence is issued to a company for a product made at
              one of its factories. Set the profile up before you apply — buying
              standards does not need one.
            </p>
            <Link
              href="/public/companies"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Set up or manage companies
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </section>

          {/* Applications */}
          <section className="rounded-2xl border border-border bg-card p-8 lg:col-span-2">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
              <FileText className="h-5 w-5 text-primary" strokeWidth={1.8} />
            </div>
            <h2 className="font-semibold text-foreground">My applications</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Certification applications, the stage each file has reached and who
              is holding it.
            </p>
            {applications.length === 0 ? (
              <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
                You have no applications yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {applications.slice(0, 4).map((a) => {
                  const info = stageInfo(a.state);
                  return (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {a.applicationNo ?? "Draft application"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.product ? a.product.nameEn : "Product not chosen yet"} · {a.factory.nameEn}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          info.holder === "applicant"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : info.holder === "closed"
                              ? "bg-muted text-muted-foreground"
                              : "bg-secondary text-primary"
                        }`}
                      >
                        {info.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              href="/public/applications"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {applications.length === 0 ? "Apply for a CM licence" : "All applications"}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
