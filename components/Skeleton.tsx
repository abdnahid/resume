/**
 * Loading skeletons.
 *
 * Next renders a route's `loading.tsx` the instant a navigation starts, so
 * these are what stands in for a page while its server component runs. The
 * heavy screens here take 0.8–1.1s warm and longer cold, which is long enough
 * that a click with no feedback reads as a broken link.
 *
 * They deliberately echo the shape of the page they replace — a table skeleton
 * for a table, filter bars where the filters are — because a skeleton that
 * matches the eventual layout stops the content jumping when it arrives.
 *
 * Server components: no hooks, no `"use client"`, so they cost nothing at
 * runtime.
 */
import PageContainer from "@/components/PageContainer";

/** One shimmering bar. Width is a Tailwind class so callers can vary rhythm. */
export function SkeletonLine({
  className = "w-full",
  height = "h-4",
}: {
  className?: string;
  height?: string;
}) {
  return (
    <div className={`${height} ${className} animate-pulse rounded bg-slate-100`} />
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />;
}

/** The page heading every management screen opens with. */
export function SkeletonHeader({ actions = 0 }: { actions?: number }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <SkeletonLine className="w-52" height="h-5" />
        <SkeletonLine className="w-96" height="h-3" />
      </div>
      {actions > 0 && (
        <div className="flex gap-2 shrink-0">
          {Array.from({ length: actions }).map((_, i) => (
            <SkeletonBlock key={i} className="h-9 w-28" />
          ))}
        </div>
      )}
    </div>
  );
}

/** The filter row above most tables. */
export function SkeletonFilters({ count = 4 }: { count?: number }) {
  const widths = ["w-64", "w-44", "w-36", "w-40", "w-32", "w-48"];
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} className={`h-10 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

/**
 * A table stand-in. `columns` are Tailwind widths so the skeleton lines up with
 * the real header — the whole point is that nothing shifts when data lands.
 */
export function SkeletonTable({
  rows = 8,
  columns = ["w-24", "w-full", "w-20", "w-24", "w-28", "w-16"],
}: {
  rows?: number;
  columns?: string[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3">
        {columns.map((w, i) => (
          <SkeletonLine key={i} className={w} height="h-3" />
        ))}
      </div>
      <div className="divide-y divide-slate-50">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-4">
            {columns.map((w, c) => (
              <SkeletonLine key={c} className={w} height="h-4" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A stack of cards, for the screens that list records rather than tabulate. */
export function SkeletonCards({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <SkeletonBlock className="h-8 w-1.5 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="w-1/3" height="h-4" />
            <SkeletonLine className="w-2/3" height="h-3" />
          </div>
          <SkeletonBlock className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

/** The shell every management screen shares: padding, heading, then content. */
export function SkeletonPage({
  actions = 0,
  filters = 0,
  children,
}: {
  actions?: number;
  filters?: number;
  children?: React.ReactNode;
}) {
  // The same `PageContainer` the real screens use, so the skeleton occupies the
  // exact column the content will — the alignment does not shift when it lands.
  return (
    <PageContainer>
      <SkeletonHeader actions={actions} />
      {filters > 0 && <SkeletonFilters count={filters} />}
      {children}
    </PageContainer>
  );
}

/** A printed document — the payslip, the bank advice, a resume. */
export function SkeletonDocument() {
  return (
    <div className="min-h-screen bg-muted px-4 py-8">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-8 w-8" />
          <div className="space-y-2">
            <SkeletonLine className="w-40" height="h-4" />
            <SkeletonLine className="w-56" height="h-3" />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-9 w-24" />
          <SkeletonBlock className="h-9 w-32" />
        </div>
      </div>

      <div className="mx-auto max-w-3xl rounded border border-rule bg-paper px-12 py-8">
        {/* Letterhead */}
        <div className="mb-6 flex items-center gap-5 border-b-2 border-slate-200 pb-4">
          <SkeletonBlock className="h-20 w-20 rounded-full" />
          <div className="flex-1 space-y-2 text-center">
            <SkeletonLine className="mx-auto w-64" height="h-3" />
            <SkeletonLine className="mx-auto w-40" height="h-3" />
            <SkeletonLine className="mx-auto w-80" height="h-5" />
            <SkeletonLine className="mx-auto w-56" height="h-3" />
          </div>
          <SkeletonBlock className="h-20 w-20 rounded-full" />
        </div>

        <SkeletonLine className="mx-auto mb-6 w-48" height="h-5" />
        <div className="mb-6 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonLine key={i} className="w-full" height="h-3" />
          ))}
        </div>
        <SkeletonBlock className="h-56 w-full" />
      </div>
    </div>
  );
}
