import { SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage filters={2}>
      <SkeletonTable
        rows={10}
        columns={["w-24", "w-full", "w-44", "w-16", "w-24", "w-32"]}
      />
    </SkeletonPage>
  );
}
