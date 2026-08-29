import { SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage actions={1} filters={2}>
      <SkeletonTable
        rows={6}
        columns={["w-40", "w-28", "w-44", "w-16", "w-28", "w-24", "w-24", "w-20"]}
      />
    </SkeletonPage>
  );
}
