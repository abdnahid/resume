import { SkeletonBlock, SkeletonLine } from "@/components/Skeleton";
import PageContainer from "@/components/PageContainer";

/** The organogram is a chart, not a table — a tree of boxes. */
export default function Loading() {
  return (
    <PageContainer>
      <div className="mb-6 space-y-2">
        <SkeletonLine className="w-48" height="h-5" />
        <SkeletonLine className="w-72" height="h-3" />
      </div>
      <div className="flex flex-col items-center gap-6">
        <SkeletonBlock className="h-16 w-56" />
        <div className="flex gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-14 w-44" />
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-12 w-40" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
