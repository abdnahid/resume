import { SkeletonPage, SkeletonTable } from "@/components/Skeleton";

/** Fixation carries the most joins of any screen — employees plus every
 *  fixation version plus each office's processed months. */
export default function Loading() {
  return (
    <SkeletonPage actions={1} filters={5}>
      <SkeletonTable
        rows={10}
        columns={["w-24", "w-full", "w-10", "w-24", "w-24", "w-40", "w-16", "w-16"]}
      />
    </SkeletonPage>
  );
}
