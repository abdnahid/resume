import { SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage filters={3}>
      <SkeletonTable rows={8} columns={["w-24", "w-full", "w-20", "w-16", "w-24", "w-28"]} />
    </SkeletonPage>
  );
}
