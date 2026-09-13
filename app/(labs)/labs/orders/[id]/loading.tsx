import { SkeletonPage, SkeletonTable } from "@/components/Skeleton";

/**
 * The bench screen reads the order, its specimens, every result-bearing leaf
 * and the movement log, so it is never instant — and a skeleton should echo the
 * shape of the page it stands in for, or content jumps when it lands.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonTable rows={8} columns={["w-full", "w-40", "w-28", "w-28"]} />
    </SkeletonPage>
  );
}
