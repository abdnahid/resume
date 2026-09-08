import { SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonTable rows={8} columns={["w-full", "w-32", "w-20"]} />
    </SkeletonPage>
  );
}
