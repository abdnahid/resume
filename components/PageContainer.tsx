/**
 * The content column every screen sits in.
 *
 * Its width and padding are the navbar's own — `max-w-[1440px]` with
 * `px-5 lg:px-10` — so the page lines up with the chrome above it instead of
 * each screen picking its own. Before this the management screens ranged over
 * `max-w-5xl`, `6xl` and `7xl`, some left-aligned and some centred, and the
 * loading skeletons matched none of them.
 *
 * A server component: no hooks, no `"use client"`.
 */
export default function PageContainer({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div
        className={`mx-auto w-full max-w-[1440px] space-y-5 px-5 py-6 lg:px-10 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
