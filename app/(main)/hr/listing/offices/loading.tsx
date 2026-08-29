import { SkeletonPage, SkeletonCards } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonCards count={6} />
    </SkeletonPage>
  );
}
