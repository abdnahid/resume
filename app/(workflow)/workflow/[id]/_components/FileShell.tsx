import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The heading every view of a file shares.
 *
 * **Reading the file and working it are different jobs**, so they are different
 * pages reached by their own buttons on the board — not two tabs on one screen,
 * which reads as "the process lives inside the preview" when it does not. Each
 * side gets its own `loading.tsx`, and the URL says which you are on.
 *
 * The header is shared because "which file, at what stage, with whom" is the
 * question you carry into either of them.
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
}: {
  applicationId: number;
  applicationNo: string | null;
  stageLabel: string;
  withApplicant: boolean;
  holderName: string | null;
  holderDesignation: string | null;
  officeName: string | null;
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

    </>
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
