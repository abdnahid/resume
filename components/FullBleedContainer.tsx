/**
 * The full-bleed counterpart to `PageContainer`.
 *
 * Most screens sit in `PageContainer`, whose `max-w-[1440px]` box is centred in
 * a `<main>` that spans the whole window. At `min-[1920px]` — the breakpoint
 * where the sidebar stops being a drawer and stays docked — that leaves a
 * gutter of at least 240px on each side, exactly the sidebar's width. So those
 * screens clear the sidebar without knowing it exists.
 *
 * A screen that spans the window instead — a chart canvas, a wide editor — has
 * no gutter, so its left 240px renders *underneath* the docked sidebar. That is
 * the bug this exists to prevent.
 *
 * **The clearance cannot go on `<main>`.** Padding it would push
 * `PageContainer`'s centred box right by half the sidebar's width and break its
 * alignment with the navbar — which is the whole reason the sidebar is
 * positioned out of flow in the first place. So it belongs here, once, rather
 * than as a `pl-60` copied onto every full-bleed screen and forgotten on the
 * next one.
 *
 * Renders the page root itself (`flex h-full flex-col`), so use it *instead of*
 * a wrapper div, not around one.
 *
 * A server component: no hooks, no `"use client"`.
 */
export default function FullBleedContainer({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex h-full flex-col min-[1920px]:pl-60 ${className}`}>
      {children}
    </div>
  );
}
