import FullBleedContainer from "@/components/FullBleedContainer";
import { SkeletonHeader, SkeletonBlock, SkeletonTable } from "@/components/Skeleton";

/**
 * **`FullBleedContainer`, not `SkeletonPage`.** The map spans the window, and a
 * skeleton in `PageContainer`'s centred 1440px box would sit somewhere else
 * entirely — the grid would jump sideways as it landed, which is the one thing
 * a skeleton exists to prevent. The organogram had exactly this bug.
 */
export default function Loading() {
  return (
    <FullBleedContainer>
      <div className="mx-auto w-full max-w-[1800px] space-y-5 px-5 py-6 lg:px-10">
        <SkeletonHeader />
        <SkeletonBlock className="h-24" />
        <SkeletonTable rows={10} columns={["w-56", "w-16", "w-16", "w-16", "w-16", "w-16", "w-16"]} />
      </div>
    </FullBleedContainer>
  );
}
