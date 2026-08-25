import Link from "next/link";
import { ShoppingBag, FileText, Phone, Mail, ArrowRight, Lock } from "lucide-react";
import { requireClient } from "@/lib/auth-guard";
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
            <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
              You have not bought any standards yet.
            </p>
            <Link
              href="/store/bds"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Browse the catalogue
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </section>

          {/* Applications */}
          <section className="rounded-2xl border border-dashed border-border bg-card/60 p-8">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
              <FileText className="h-5 w-5 text-primary" strokeWidth={1.8} />
            </div>
            <h2 className="font-semibold text-foreground">My applications</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Certification applications, the stage each file has reached and who
              is holding it.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Lock className="h-3.5 w-3.5" strokeWidth={2} />
              Opens with the CM module.
            </span>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
