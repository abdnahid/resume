import PageContainer from "@/components/PageContainer";
import { SkeletonBlock, SkeletonLine } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageContainer>
      <div className="py-6">
        <SkeletonLine height="h-7" className="w-80" />
        <SkeletonLine className="mt-2 w-[32rem]" />
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-24" />
          ))}
        </div>
        <SkeletonBlock className="mt-6 h-[28rem]" />
      </div>
    </PageContainer>
  );
}
