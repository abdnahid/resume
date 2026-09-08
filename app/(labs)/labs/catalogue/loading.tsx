import { SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage filters={2}>
      <SkeletonTable rows={12} columns={["w-8", "w-full", "w-32", "w-16", "w-16", "w-20", "w-20"]} />
    </SkeletonPage>
  );
}
