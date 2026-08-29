import { SkeletonBlock, SkeletonLine, SkeletonPage } from "@/components/Skeleton";

/** The profile is a long form in sections, not a list. */
export default function Loading() {
  return (
    <SkeletonPage>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, s) => (
          <div key={s} className="rounded-xl border border-slate-200 bg-white p-5">
            <SkeletonLine className="mb-4 w-40" height="h-4" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, f) => (
                <div key={f} className="space-y-1.5">
                  <SkeletonLine className="w-24" height="h-3" />
                  <SkeletonBlock className="h-9 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
