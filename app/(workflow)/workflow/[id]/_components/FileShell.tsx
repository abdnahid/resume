import Link from "next/link";
import { ArrowLeft, Eye, ListChecks } from "lucide-react";

/**
 * The heading every view of a file shares, and the two tabs beneath it.
 *
 * **Reading the file and working it are different jobs**, so they are different
 * pages rather than one long column. An officer checking a declared capacity
 * against the questionnaire scrolls past the panel that issues an office order;
 * an officer approving a visit scrolls past six cards of sub-products to reach
 * it. Splitting them also means each side gets its own `loading.tsx` and the
 * URL says which one you are on.
 *
 * The header stays on both because "which file, at what stage, with whom" is
 * the question you carry from one to the other.
 */
export function FileHeader({
  applicationId,
  applicationNo,
  stageLabel,
  /** The stage says the applicant holds it, whoever holds the desk (D81). */
  withApplicant,
  holderName,
  holderDesignation,
  officeName,
  tab,
}: {
  applicationId: number;
  applicationNo: string | null;
  stageLabel: string;
  withApplicant: boolean;
  holderName: string | null;
  holderDesignation: string | null;
  officeName: string | null;
  tab: "preview" | "process";
}) {
  return (
    <>
      <Link
        href="/workflow"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
        All files
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-medium text-foreground">
          {applicationNo ?? `Application #${applicationId}`}
        </h1>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          {stageLabel}
        </span>
      </div>

      <p className="mt-1.5 text-sm text-muted-foreground">
        {withApplicant && holderName ? (
          <>
            with <span className="font-medium text-foreground">the applicant</span>
            {" — "}
            {holderName} is waiting on it
          </>
        ) : holderName ? (
          <>
            with <span className="font-medium text-foreground">{holderName}</span>
            {holderDesignation ? `, ${holderDesignation}` : ""}
          </>
        ) : (
          "Held by nobody — waiting to be received."
        )}
        {officeName && <> · {officeName}</>}
      </p>

      <nav className="mt-6 flex gap-1 border-b border-border">
        <Tab href={`/workflow/${applicationId}`} on={tab === "preview"} icon="eye">
          Preview
        </Tab>
        <Tab href={`/workflow/${applicationId}/process`} on={tab === "process"} icon="list">
          Process
        </Tab>
      </nav>
    </>
  );
}

function Tab({
  href,
  on,
  icon,
  children,
}: {
  href: string;
  on: boolean;
  icon: "eye" | "list";
  children: React.ReactNode;
}) {
  const Icon = icon === "eye" ? Eye : ListChecks;
  return (
    <Link
      href={href}
      className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        on
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      {children}
    </Link>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 font-display text-lg font-medium text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function Row({
  label,
  value,
  bn,
}: {
  label: string;
  value: string | null;
  bn?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1">
      <span className="w-36 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 text-sm text-foreground">
        {value}
        {bn && <span className="ml-2 font-bn-serif text-sm text-muted-foreground">{bn}</span>}
      </span>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
