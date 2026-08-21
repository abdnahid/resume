import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBag,
  GitBranch,
  Users,
  Calculator,
  Package,
  ShieldCheck,
  ArrowRight,
  GlobeIcon,
  MailIcon,
  PhoneIcon,
  GitFork,
  LogIn,
} from "lucide-react";
import Footer from "@/components/layout/Footer";
import { MODULES, type ModuleKey } from "@/lib/modules";

const ICONS: Record<ModuleKey, typeof Users> = {
  hr: Users,
  store: ShoppingBag,
  workflow: GitBranch,
  accounts: Calculator,
  inventory: Package,
  admin: ShieldCheck,
};

const ORG = {
  headerBn: [
    "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার",
    "শিল্প মন্ত্রণালয়",
    "বাংলাদেশ স্ট্যান্ডার্ডস এন্ড টেস্টিং ইনস্টিটিউশন",
  ],
  addressBn: "মান ভবন, ১১৬/ক, তেজগাঁও শিল্প এলাকা, ঢাকা-১২০৮",
  website: "www.bsti.gov.bd",
  email: "dg@bsti.gov.bd",
  hotline: "16119",
};

// Placeholder figures — wire these to real queries when the dashboards land.
const STATS = [
  { value: "12,000+", label: "Bangladesh Standards published" },
  { value: "৩,২০০", label: "কর্মকর্তা ও কর্মচারী", bn: true },
  { value: "৬৪", label: "জেলায় সেবা কার্যক্রম", bn: true },
  { value: "24 / 7", label: "Hotline 16119" },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Government strip ── */}
      <div className="bg-primary text-primary-foreground/85">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-2 text-[12.5px] tracking-wide lg:px-10">
          <span className="font-bn">{ORG.headerBn[0]}</span>
          <div className="hidden items-center gap-5 md:flex">
            <span className="inline-flex items-center gap-1.5">
              <PhoneIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
              {ORG.hotline}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MailIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
              {ORG.email}
            </span>
          </div>
        </div>
      </div>

      {/* ── Masthead ── */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-5 py-5 lg:px-10">
          <div className="flex items-center gap-4">
            <Image
              src="/bsti.svg"
              alt="BSTI"
              width={56}
              height={56}
              className="shrink-0"
            />
            <div className="flex flex-col border-l-2 border-border pl-4 leading-tight">
              <span className="font-bn-serif text-[15px] font-semibold text-foreground sm:text-lg">
                {ORG.headerBn[2]}
              </span>
              <span className="mt-0.5 text-xs tracking-wide text-muted-foreground">
                Bangladesh Standards &amp; Testing Institution
              </span>
            </div>
          </div>

          <Link
            href="/login"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <LogIn className="h-4 w-4" strokeWidth={1.8} />
            <span className="hidden sm:inline">Sign in</span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="border-b border-border bg-secondary/40">
          <div className="mx-auto max-w-[1440px] px-5 py-20 lg:px-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              BSTI e-Services
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-medium leading-tight text-foreground sm:text-5xl">
              One portal for every BSTI service
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Standards, certification, personnel records and internal
              operations — brought together in a single place for officers,
              partners and the public.
            </p>
            <p className="font-bn mt-2 max-w-2xl leading-relaxed text-muted-foreground">
              মান, সনদায়ন, কর্মকর্তা তথ্য ও অভ্যন্তরীণ কার্যক্রম — সবকিছু এক
              ঠিকানায়।
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/store"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                Browse standards
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
              <Link
                href="/organogram"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-muted"
              >
                <GitFork className="h-4 w-4" strokeWidth={1.8} />
                View organogram
              </Link>
            </div>
          </div>
        </section>

        {/* ── Modules ── */}
        <section className="mx-auto max-w-[1440px] px-5 py-20 lg:px-10">
          <h2 className="font-display text-2xl font-medium text-foreground">
            Services
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in is required for internal modules.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(({ key, path, label, labelBn, blurb, theme }) => {
              const Icon = ICONS[key];
              return (
                <Link
                  key={key}
                  href={path}
                  className={`${theme} group flex flex-col rounded-2xl border border-border bg-card p-8 shadow-sm transition-all duration-200 hover:border-primary/25 hover:shadow-md`}
                >
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
                    <Icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
                  </div>
                  <p className="font-semibold text-foreground">{label}</p>
                  <p className="font-bn text-sm text-primary">{labelBn}</p>
                  <p className="mt-2.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {blurb}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    Open
                    <ArrowRight
                      className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                      strokeWidth={2}
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="border-y border-border bg-muted/50">
          <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-8 px-5 py-14 lg:grid-cols-4 lg:px-10">
            {STATS.map(({ value, label, bn }) => (
              <div key={label}>
                <p
                  className={`font-display text-3xl font-medium text-primary ${
                    bn ? "font-bn-serif" : ""
                  }`}
                >
                  {value}
                </p>
                <p
                  className={`mt-1 text-sm text-muted-foreground ${
                    bn ? "font-bn" : ""
                  }`}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Contact ── */}
        <section className="mx-auto max-w-[1440px] px-5 py-16 lg:px-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-medium text-foreground">
                Head office
              </h2>
              <p className="font-bn mt-2 text-muted-foreground">
                {ORG.addressBn}
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <GlobeIcon className="h-4 w-4 text-primary" strokeWidth={1.8} />
                {ORG.website}
              </span>
              <span className="inline-flex items-center gap-2">
                <MailIcon className="h-4 w-4 text-primary" strokeWidth={1.8} />
                {ORG.email}
              </span>
              <span className="inline-flex items-center gap-2">
                <PhoneIcon className="h-4 w-4 text-primary" strokeWidth={1.8} />
                Hotline {ORG.hotline}
              </span>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
