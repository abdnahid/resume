"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";

/**
 * Whether the sidebar drawer is open.
 *
 * The sidebar is taken out of flow so the main column can span the whole
 * window and centre its content at 1440px — the same box the navbar uses, which
 * is the only way the two actually line up. That means the sidebar overlays the
 * content on any window narrower than roughly 1920px, so below that it behaves
 * as a drawer and needs a toggle living in the navbar. Hence shared state
 * rather than local.
 */
type SidebarState = {
  open: boolean;
  toggle: () => void;
  close: () => void;
};

const Ctx = createContext<SidebarState | null>(null);

/** The width at which a docked sidebar stops covering the centred content. */
export const DOCK_BREAKPOINT = 1920;

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navigating from inside the drawer should close it — otherwise it sits over
  // the page you just asked for.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes it, as any overlay should.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // A window widened past the dock breakpoint no longer needs the drawer, and
  // leaving it "open" would strand the backdrop over a docked sidebar.
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DOCK_BREAKPOINT}px)`);
    const sync = () => {
      if (mq.matches) setOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const value = useMemo<SidebarState>(
    () => ({
      open,
      toggle: () => setOpen((v) => !v),
      close: () => setOpen(false),
    }),
    [open],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSidebar(): SidebarState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useSidebar must be used inside <SidebarProvider>");
  }
  return ctx;
}

/** For components that may render outside the provider (print views). */
export function useOptionalSidebar(): SidebarState | null {
  return useContext(Ctx);
}
