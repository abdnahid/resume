import { SkeletonBlock, SkeletonLine } from "@/components/Skeleton";

/** Echoes the process page's two columns, so nothing jumps when it lands. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-12 lg:px-10">
      <SkeletonLine className="h-4 w-20" />
      <SkeletonLine className="mt-4 h-9 w-72" />
      <SkeletonLine className="mt-2 h-4 w-96" />

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {[0, 1].map((i) => (
            <SkeletonBlock key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-5">
          <SkeletonBlock className="h-72 rounded-2xl" />
        </div>
      </div>
    </main>
  );
}
