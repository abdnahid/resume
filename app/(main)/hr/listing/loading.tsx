import { SkeletonPage, SkeletonTable } from "@/components/Skeleton";

/** 554 employees with filters — the slowest list in the app. */
export default function Loading() {
  return (
    <SkeletonPage actions={1} filters={4}>
      <SkeletonTable
        rows={10}
        columns={["w-24", "w-full", "w-48", "w-20", "w-20", "w-16"]}
      />
    </SkeletonPage>
  );
}
