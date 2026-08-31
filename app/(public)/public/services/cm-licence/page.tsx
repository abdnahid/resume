import Link from "next/link";
import {
  ShieldCheck, FileText, Building2, Factory, CreditCard, ClipboardCheck,
  FlaskConical, Award, ArrowRight, Check,
} from "lucide-react";
import { CM_DOCUMENTS, APPLICATION_FEE_POISHA } from "@/lib/cm/policy";
import { splitFee, formatPoisha } from "@/lib/payments/money";
import Footer from "@/components/layout/Footer";

export const metadata = {
  title: "CM Quality Licence — BSTI e-Services",
  description:
    "What you need, what it costs and what happens after you apply for a BSTI CM quality certification licence.",
};

/**
 * The service detail page (spec §8.2).
 *
 * Public and static — no session is awaited here, which keeps it prerendered
 * (D14's neighbouring rule). The spec's claim about this page is worth taking
 * seriously: written well, it prevents a large share of shortfalls, because
 * nearly every shortfall is a document the applicant did not know to bring.
 */
const STEPS = [
  { icon: Building2, title: "Set up your company profile", body: "Legal name, trade licence, BIN and TIN, and the person authorised to sign. Done once." },
  { icon: Factory, title: "Register the factory", body: "The licence covers a product made at one named premises. Its district decides which BSTI office handles your file." },
  { icon: FileText, title: "Buy the Bangladesh Standard", body: "Your product is certified against a published BDS. Buy it from the store — one purchase covers one application." },
  { icon: ClipboardCheck, title: "Fill in the application", body: "Name the product and brand, and attach the documents listed below." },
  { icon: CreditCard, title: "Pay the application fee", body: "The file is submitted to BSTI the moment the fee is paid." },
  { icon: ShieldCheck, title: "Review and inspection", body: "An officer reviews the file, may raise a shortfall, then inspects the factory and seals a sample." },
  { icon: FlaskConical, title: "Testing", body: "You pay the testing fee and deliver the sealed sample. The laboratory tests it." },
  { icon: Award, title: "Licence", body: "If the product conforms, the CM licence is granted for the product at that factory." },
];

export default function CmLicenceServicePage() {
  const fee = splitFee(APPLICATION_FEE_POISHA);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <section className="border-b border-border bg-secondary/30">
          <div className="mx-auto w-full max-w-[1100px] px-5 py-14 lg:px-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Certification service
            </p>
            <h1 className="mt-2 font-display text-4xl font-medium text-foreground">
              CM Quality Licence
            </h1>
            <p className="font-bn text-xl text-muted-foreground">মান সনদ</p>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              A CM licence certifies that a product made at your factory conforms to the relevant
              Bangladesh Standard. It is mandatory for the 315 products under compulsory
              certification, and voluntary for others.
            </p>
            <Link
              href="/public/applications/new"
              className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Apply now
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[1100px] px-5 py-14 lg:px-10">
          <section>
            <h2 className="font-display text-2xl font-medium text-foreground">How it works</h2>
            <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.title} className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                        <Icon className="h-4.5 w-4.5 text-primary" strokeWidth={1.8} />
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        Step {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-3 font-semibold text-foreground">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
            <div>
              <h2 className="font-display text-2xl font-medium text-foreground">
                Documents to prepare
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Have these ready before you start. Missing documents are the most common reason a
                file is sent back.
              </p>
              <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
                {CM_DOCUMENTS.map((d) => (
                  <li key={d.kind} className="flex items-start gap-3 px-5 py-3.5">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${d.required ? "text-primary" : "text-muted-foreground"}`}
                      strokeWidth={2}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {d.label}
                        {!d.required && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            optional
                          </span>
                        )}
                      </p>
                      {d.hint && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{d.hint}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <aside className="space-y-5">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-semibold text-foreground">Fees</h3>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Application fee</dt>
                    <dd className="text-foreground">{formatPoisha(fee.incomePoisha)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">VAT ({fee.vatRateBp / 100}%)</dt>
                    <dd className="text-foreground">{formatPoisha(fee.vatPoisha)}</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
                    <dt className="text-foreground">Payable on submission</dt>
                    <dd className="text-foreground">{formatPoisha(fee.totalPoisha)}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  The <strong className="font-medium text-foreground">testing fee</strong> is
                  charged separately after inspection, and depends on the tests your product needs.
                  The standard itself is bought from the store at its own price.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-semibold text-foreground">Before you start</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>A company profile with trade licence, BIN and TIN</li>
                  <li>At least one registered factory</li>
                  <li>The Bangladesh Standard for your product, bought from the store</li>
                </ul>
                <Link
                  href="/public/companies"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  Set up a company profile
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </div>
            </aside>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
