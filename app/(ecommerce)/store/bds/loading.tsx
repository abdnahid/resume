import { SkeletonBlock, SkeletonLine } from "@/components/Skeleton";

/**
 * The BDS catalogue: a facet sidebar and a card grid. Shaped to match so the
 * grid does not jump when the standards arrive.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 space-y-2">
        <SkeletonLine className="w-64" height="h-6" />
        <SkeletonLine className="w-96" height="h-3" />
      </div>
      <div className="flex gap-6">
        <aside className="hidden w-64 shrink-0 space-y-5 lg:block">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonLine className="w-32" height="h-4" />
              {Array.from({ length: 4 }).map((_, j) => (
                <SkeletonLine key={j} className="w-full" height="h-3" />
              ))}
            </div>
          ))}
        </aside>
        <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-44" />
          ))}
        </div>
      </div>
    </div>
  );
}
