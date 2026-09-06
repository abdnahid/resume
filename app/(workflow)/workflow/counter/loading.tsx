import { SkeletonBlock, SkeletonLine } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-12 lg:px-10">
      <SkeletonLine className="h-4 w-48" />
      <SkeletonLine className="mt-3 h-9 w-80" />
      <SkeletonLine className="mt-2 h-4 w-[28rem]" />
      <SkeletonLine className="mt-8 h-6 w-40" />
      <div className="mt-3 space-y-3">
        {[0, 1].map((i) => (
          <SkeletonBlock key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
