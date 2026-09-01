import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ShieldCheck,
  Search,
  FileCheck2,
} from "lucide-react";
import Navbar from "./Navbar";
import { prisma } from "@/lib/prisma";
import { getFeaturedBds, formatTaka } from "@/lib/store/bds";
import { salePricePolicy } from "@/lib/store/bds-catalog";

/**
 * The landing page reads live catalogue counts, so it cannot be frozen at
 * build time. Hourly revalidation: the catalogue changes rarely, but a reseed
 * or a new publication should surface without a redeploy.
 */
export const revalidate = 3600;

export const metadata = {
  title: "BDS Store — BSTI e-Services",
  description:
    "Browse and purchase Bangladesh Standards published by the Bangladesh Standards and Testing Institution.",
};

export default async function StorePage() {
  const [{ newest, mandatoryCount, total }, divisions] = await Promise.all([
    getFeaturedBds(),
    prisma.bdsDivision.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        nameEn: true,
        nameBn: true,
        _count: { select: { standards: true } },
      },
    }),
  ]);

  return (
    <>
      <Navbar />

      {/* ── Hero ── */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1440px] px-5 py-16 lg:px-10 lg:py-20">
          <p className="text-[11.5px] font-semibold uppercase tracking-widest text-primary">
            BSTI Standards Store
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-[44px] font-medium leading-[1.1] text-title">
            Every Bangladesh Standard, in one place
          </h1>
          <p className="mt-3 font-bn text-lg text-body">
            বাংলাদেশ স্ট্যান্ডার্ডস — এক ঠিকানায়
          </p>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-body">
            Search the published BDS catalogue by division, publication date or price. A
            purchased standard can be attached to one quality-licence application, so buy the
            edition that matches the product you intend to certify.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/store/bds"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-[15px] font-semibold text-primary-foreground transition-all duration-150 hover:-translate-y-px hover:bg-primary-hover hover:shadow-md"
            >
              Browse all standards
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link
              href="/store/bds?mandatory=1"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3.5 text-[15px] font-semibold text-body transition-colors hover:border-primary/30 hover:text-primary"
            >
              <ShieldCheck className="h-4 w-4" strokeWidth={2} />
              Mandatory certification list
            </Link>
          </div>

          <dl className="mt-12 flex flex-wrap gap-x-12 gap-y-5 border-t border-border pt-8">
            <Stat value={total.toLocaleString("en-IN")} label="Standards published" />
            <Stat value={divisions.length.toString()} label="Divisions" />
            <Stat value={mandatoryCount.toString()} label="Under mandatory certification" />
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 py-14 lg:px-10">
        {/* ── Divisions ── */}
        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-[26px] font-medium text-title">
                Browse by division
              </h2>
              <p className="mt-1.5 text-[15px] text-body">
                Standards are grouped by the technical division that publishes them.
              </p>
            </div>
            <Link
              href="/store/bds"
              className="hidden shrink-0 items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline sm:inline-flex"
            >
              All standards
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {divisions.map((division) => (
              <Link
                key={division.slug}
                href={`/store/bds?division=${division.slug}`}
                className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
                    <BookOpen className="h-5 w-5 text-primary" strokeWidth={1.8} />
                  </div>
                  <span className="text-[13px] tabular-nums text-muted-foreground">
                    {division._count.standards} standards
                  </span>
                </div>
                <p className="mt-4 font-display text-[18px] font-medium text-title group-hover:text-primary">
                  {division.nameEn}
                </p>
                <p className="mt-0.5 font-bn text-[14px] text-body">{division.nameBn}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Just published ── */}
        {newest.length > 0 && (
          <section className="mt-16">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-[26px] font-medium text-title">Just published</h2>
              <Link
                href="/store/bds?sort=newest"
                className="hidden shrink-0 items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline sm:inline-flex"
              >
                See more
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>

            <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card px-6">
              {newest.map((bds) => (
                <li key={bds.slug}>
                  <Link
                    href={`/store/bds/${bds.slug}`}
                    className="group flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[12.5px] font-semibold text-primary">
                          {bds.number}
                        </span>
                        <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                          {bds.division.nameEn}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[15px] text-body group-hover:text-primary">
                        {bds.titleEn}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-3 font-display text-[17px] font-semibold text-title">
                      {formatTaka(salePricePolicy(bds).priceBdt)}
                      <ArrowRight
                        className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5"
                        strokeWidth={2}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── How it works ── */}
        <section className="mt-16 rounded-2xl border border-border bg-card p-8 lg:p-10">
          <h2 className="font-display text-[26px] font-medium text-title">
            Buying a standard for a licence application
          </h2>
          <p className="mt-1.5 max-w-2xl text-[15px] text-body">
            If you are here to apply for a BSTI quality licence, the standard comes first.
          </p>

          <ol className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <Step
              n={1}
              icon={Search}
              title="Find the right standard"
              body="Search by product name or BDS number. Products under mandatory certification are marked."
            />
            <Step
              n={2}
              icon={BookOpen}
              title="Buy your copy"
              body="Pay online and download the PDF immediately. Purchases stay in your account."
            />
            <Step
              n={3}
              icon={FileCheck2}
              title="Attach it to your application"
              body="Each purchase can be attached to one new licence application. Buy again for another product."
            />
          </ol>
        </section>
      </div>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-[30px] font-semibold leading-none text-title">{value}</dd>
      <p className="mt-1.5 text-[13px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  body,
}: {
  n: number;
  icon: typeof Search;
  title: string;
  body: string;
}) {
  return (
    <li>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
        </div>
        <span className="font-mono text-[12px] font-semibold text-muted-foreground">
          Step {n}
        </span>
      </div>
      <p className="mt-3.5 font-display text-[17px] font-medium text-title">{title}</p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-body">{body}</p>
    </li>
  );
}
