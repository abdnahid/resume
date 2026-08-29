import { SkeletonPage, SkeletonCards } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage actions={1} filters={2}>
      <SkeletonCards count={5} />
    </SkeletonPage>
  );
}
