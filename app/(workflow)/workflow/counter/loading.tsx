import PageContainer from "@/components/PageContainer";
import { SkeletonBlock, SkeletonLine } from "@/components/Skeleton";

/**
 * The same container as the page, and cards the same height as the page's
 * (D139 folded the letter into them, so a 28-unit block now jumps). A skeleton
 * that does not echo its page moves the content when it lands, which is the one
 * thing it exists to prevent.
 */
export default function Loading() {
  return (
    <PageContainer>
      <div className="py-6">
        <SkeletonLine className="h-4 w-48" />
        <SkeletonLine className="mt-3 h-9 w-80" />
        <SkeletonLine className="mt-2 h-4 w-[28rem]" />
      </div>
      <SkeletonLine className="mt-8 h-6 w-40" />
      <div className="mt-3 space-y-3">
        {[0, 1].map((i) => (
          <SkeletonBlock key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    </PageContainer>
  );
}
