import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Compact numbered pagination: first, last, and a window around the current
 * page, with `…` standing in for the gaps.
 */
export default function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  const pages: (number | "gap")[] = [];
  for (let n = 1; n <= pageCount; n++) {
    if (n === 1 || n === pageCount || Math.abs(n - page) <= 1) pages.push(n);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }

  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1">
      <Step href={hrefFor(page - 1)} disabled={page <= 1} label="Previous page">
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
      </Step>

      {pages.map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} className="px-2 text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={hrefFor(entry)}
            aria-current={entry === page ? "page" : undefined}
            className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-[13.5px] font-medium tabular-nums transition-colors ${
              entry === page
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-body hover:border-primary/30 hover:text-primary"
            }`}
          >
            {entry}
          </Link>
        ),
      )}

      <Step href={hrefFor(page + 1)} disabled={page >= pageCount} label="Next page">
        <ChevronRight className="h-4 w-4" strokeWidth={2} />
      </Step>
    </nav>
  );
}

function Step({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-border text-body";
  if (disabled) {
    return (
      <span aria-hidden className={`${className} cursor-not-allowed opacity-40`}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${className} bg-card transition-colors hover:border-primary/30 hover:text-primary`}
    >
      {children}
    </Link>
  );
}
