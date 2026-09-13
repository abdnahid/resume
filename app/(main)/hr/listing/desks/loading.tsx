import { SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage filters={2}>
      <SkeletonTable
        rows={12}
        columns={["w-24", "w-full", "w-72", "w-32", "w-20"]}
      />
    </SkeletonPage>
  );
}
