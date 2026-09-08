import { SkeletonPage, SkeletonBlock, SkeletonCards } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="h-10" />
      <SkeletonCards count={5} />
    </SkeletonPage>
  );
}
