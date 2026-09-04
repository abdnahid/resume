import { SkeletonBlock, SkeletonLine } from "@/components/Skeleton";
import FullBleedContainer from "@/components/FullBleedContainer";

/**
 * The organogram is a chart, not a table — a tree of boxes.
 *
 * Full-bleed like the page it stands in for. It used to sit in
 * `PageContainer`, so the skeleton cleared the docked sidebar and the real
 * chart then slid underneath it: the content jumped sideways on load, which is
 * exactly what a skeleton is supposed to prevent.
 */
export default function Loading() {
  return (
    <FullBleedContainer>
      {/* Echoes the page header — same border, background and padding. */}
      <div className="shrink-0 space-y-2 border-b border-border bg-card px-8 py-5">
        <SkeletonLine className="w-48" height="h-5" />
        <SkeletonLine className="w-72" height="h-3" />
        <div className="flex flex-wrap gap-2 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-6 w-36 rounded-full" />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-background px-8 py-6">
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
      </div>
    </FullBleedContainer>
  );
}
