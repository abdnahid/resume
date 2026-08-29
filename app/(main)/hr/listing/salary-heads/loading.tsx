import { SkeletonPage, SkeletonCards } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage actions={1}>
      <SkeletonCards count={4} />
    </SkeletonPage>
  );
}
