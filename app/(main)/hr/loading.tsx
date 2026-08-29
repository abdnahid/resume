import { SkeletonPage, SkeletonCards } from "@/components/Skeleton";

/**
 * The fallback loading state for every route under `/hr`.
 *
 * A `loading.tsx` covers its own segment and all nested ones that lack a closer
 * file, so this alone removes the dead click from every screen. The heavier
 * tables get their own below, shaped like the table they replace.
 */
export default function Loading() {
  return (
    <SkeletonPage actions={1} filters={2}>
      <SkeletonCards count={4} />
    </SkeletonPage>
  );
}
