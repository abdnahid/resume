import { SkeletonDocument } from "@/components/Skeleton";

/** A printed document — letterhead, then body. Shaped so the page does not
 *  jump when the real one renders. */
export default function Loading() {
  return <SkeletonDocument />;
}
