import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  FileText,
  Info,
  AlertTriangle,
} from "lucide-react";
import Navbar, { STORE_NAV } from "../../Navbar";
import BuyButton from "../_components/BuyButton";
import { activeProvider } from "@/lib/payments/registry";
import { getBdsBySlug, getRelatedBds, formatTaka } from "@/lib/store/bds";
import { salePricePolicy } from "@/lib/store/bds-catalog";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props) {
  const bds = await getBdsBySlug(params.slug);
  if (!bds) return { title: "Standard not found — BSTI Store" };
  return {
    title: `${bds.number} — ${bds.titleEn}`,
    description: `${bds.number}: ${bds.titleEn}. Published by BSTI, ${bds.division.nameEn} division.`,
  };
}

export default async function BdsDetailPage({ params }: Props) {
  const bds = await getBdsBySlug(params.slug);
  if (!bds) notFound();

  const related = await getRelatedBds(bds.divisionId, bds.id);

  // What it sells for, and whether that is BSTI's figure or the stand-in (D49).
  // Resolved once so the price on the page and the price the gateway charges
  // cannot drift — the same reason `computeSheet()` serves both the payroll
  // preview and the save route.
  const price = salePricePolicy(bds);

  return (
    <>
      <Navbar activeHref={STORE_NAV.all} />

      <div className="mx-auto max-w-[1440px] px-5 py-10 lg:px-10">
        <Link
          href={`/store/bds?division=${bds.division.slug}`}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          {bds.division.nameEn}
        </Link>

        <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
          {/* ── Main ── */}
          <article>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 text-[11.5px] font-semibold text-secondary-foreground">
                <FileText className="h-3 w-3" strokeWidth={2} />
                {bds.division.nameEn}
                <span className="font-bn font-normal opacity-70">{bds.division.nameBn}</span>
              </span>
              {bds.isMandatory315 && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-primary/25 px-2 py-1 text-[11px] font-semibold text-primary">
                  <ShieldCheck className="h-3 w-3" strokeWidth={2} />
                  Mandatory certification
                </span>
              )}
            </div>

            <p className="mt-4 font-mono text-[15px] font-semibold tracking-tight text-primary">
              {bds.number}
            </p>
            <h1 className="mt-2 font-display text-[32px] font-medium leading-tight text-title">
              {bds.titleEn}
            </h1>
            {bds.titleBn && (
              <p className="mt-2 font-bn text-lg text-body">{bds.titleBn}</p>
            )}

            {bds.status !== "current" && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-light px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2} />
                <div className="text-[13.5px] text-body">
                  <p className="font-semibold text-title">
                    This edition is {bds.status}.
                  </p>
                  {bds.supersededBy && (
                    <p className="mt-0.5">
                      Superseded by{" "}
                      <Link
                        href={`/store/bds/${bds.supersededBy.slug}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {bds.supersededBy.number}
                      </Link>
                      .
                    </p>
                  )}
                </div>
              </div>
            )}

            <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-border pt-6 sm:grid-cols-3">
              <Detail label="BDS number" value={bds.number} mono />
              <Detail label="Edition" value={bds.edition ?? "—"} />
              <Detail label="Year" value={String(bds.year)} />
              <Detail
                label="Published"
                value={
                  bds.publishedOn
                    ? bds.publishedOn.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "—"
                }
              />
              <Detail label="Pages" value={bds.pages ? String(bds.pages) : "—"} />
              <Detail label="Status" value={bds.status} capitalize />
            </dl>

            <section className="mt-8 border-t border-border pt-6">
              <h2 className="font-display text-lg font-medium text-title">About this standard</h2>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-body">
                {bds.titleEn} is published by the Bangladesh Standards and Testing Institution
                under the {bds.division.nameEn} division.
                {bds.isMandatory315
                  ? " Products covered by this standard fall under mandatory certification, so a BSTI quality licence is required before they may be sold."
                  : " It is available for reference and for use in quality-licence applications."}
              </p>
            </section>

            {related.length > 0 && (
              <section className="mt-10 border-t border-border pt-6">
                <h2 className="font-display text-lg font-medium text-title">
                  More from {bds.division.nameEn}
                </h2>
                <ul className="mt-4 divide-y divide-border">
                  {related.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/store/bds/${item.slug}`}
                        className="group flex items-center justify-between gap-4 py-3.5"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-[12.5px] font-semibold text-primary">
                            {item.number}
                          </p>
                          <p className="mt-0.5 truncate text-[14px] text-body group-hover:text-primary">
                            {item.titleEn}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-2 text-[14px] font-semibold text-title">
                          {formatTaka(salePricePolicy(item).priceBdt)}
                          <ArrowRight
                            className="h-3.5 w-3.5 text-primary transition-transform group-hover:translate-x-0.5"
                            strokeWidth={2}
                          />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>

          {/* ── Purchase panel ── */}
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                Price
              </p>
              <p className="mt-1 font-display text-[38px] font-semibold leading-none text-title">
                {formatTaka(price.priceBdt)}
              </p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Digital copy (PDF).
              </p>

              {/* A stand-in price is labelled wherever it is shown (D49). The
                  figure is real enough to charge on the sandbox gateway and not
                  real enough to quote as BSTI's. */}
              {price.isProvisional && (
                <p className="mt-3 rounded-xl bg-amber-500/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-300">
                  <strong className="font-semibold">Provisional price.</strong> {price.note}
                </p>
              )}

              <div className="mt-5">
                <BuyButton
                  bdsId={bds.id}
                  priceBdt={price.priceBdt}
                  isSandbox={activeProvider().isSandbox}
                />
              </div>

              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-muted px-3.5 py-3">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                <p className="text-[12.5px] leading-relaxed text-body">
                  The PDF download arrives with the kernel document store. Your purchase is recorded
                  against your account now.
                </p>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <p className="text-[12.5px] leading-relaxed text-body">
                  Buying this standard lets you attach it to{" "}
                  <span className="font-semibold text-title">one</span> new quality-licence
                  application. Buy again to apply for another product.
                </p>
                <Link
                  href="/store"
                  className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
                >
                  How licensing works
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function Detail({
  label,
  value,
  mono,
  capitalize,
}: {
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div>
      <dt className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1 text-[14.5px] text-title ${mono ? "font-mono" : ""} ${
          capitalize ? "capitalize" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
