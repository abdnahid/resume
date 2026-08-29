import { SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage actions={1} filters={3}>
      <SkeletonTable
        rows={10}
        columns={["w-24", "w-full", "w-40", "w-20", "w-20", "w-24", "w-24", "w-20"]}
      />
    </SkeletonPage>
  );
}
