import { SkeletonPage, SkeletonTable } from "@/components/Skeleton";

/**
 * The fallback for everything under /labs that does not override it. The
 * coverage query touches all 109,641 routing rows, so this is never instant.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonTable rows={6} columns={["w-40", "w-full", "w-20", "w-24"]} />
    </SkeletonPage>
  );
}
