"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Search,
  ShoppingCart,
  ChevronDown,
  Shield,
  Menu,
  X,
  UserRound,
  LogOut,
} from "lucide-react";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";

export type ModuleNavItem = {
  label: string;
  href: string;
  hasDropdown?: boolean;
};

type Props = {
  moduleName: string;
  moduleSubtitle: string;
  navItems: ModuleNavItem[];
  showCart?: boolean;
  /**
   * The href to highlight. Pages that filter via the query string pass this,
   * since the pathname alone cannot tell "All Standards" from "Just
   * Published" — both live at /store/bds. Omit it and the pathname decides.
   *
   * Deliberately a prop rather than a `useSearchParams()` call: that hook
   * opts the whole page out of static prerendering.
   */
  activeHref?: string;
};

export default function ModuleNavbar({
  moduleName,
  moduleSubtitle,
  navItems,
  showCart = false,
  activeHref,
}: Props) {
  const pathname = usePathname();
  /**
   * Read client-side rather than passing the viewer down from the page. The
   * store renders with ISR, and awaiting a session on the server would opt every
   * catalogue page out of static generation.
   */
  const { data: session, isPending } = authClient.useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const cartCount = 0;

  /**
   * Longest matching href wins, so "/store/bds" stays highlighted on a detail
   * page while "/store" does not steal it. Items carrying a query string only
   * match when the page names them via `activeHref`.
   */
  const activePath =
    activeHref ??
    navItems.reduce<string | null>((best, item) => {
      if (item.href.includes("?")) return best;
      const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (!matches) return best;
      return best === null || item.href.length > best.length ? item.href : best;
    }, null);

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/";
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      {/* ── Utility Bar ── */}
      <div className="bg-primary text-primary-foreground/85">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-2 text-[12.5px] tracking-wide lg:px-10">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" strokeWidth={1.8} />
              Official BSTI Portal
            </span>
            <span className="hidden opacity-60 md:inline">|</span>
            <span className="hidden md:inline">
              Bangladesh Standards &amp; Testing Institution
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/help" className="hover:text-primary-foreground">
              Help Center
            </Link>
            <Link href="/contact" className="hover:text-primary-foreground">
              Contact
            </Link>
            <span className="h-3 w-px bg-primary-foreground/25" />
            <button className="cursor-pointer hover:text-primary-foreground">EN</button>
            <button className="cursor-pointer opacity-55 hover:text-primary-foreground hover:opacity-100">
              বাং
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Nav ── */}
      <nav
        className={`border-b border-border bg-card transition-shadow ${
          scrolled ? "shadow-md" : "shadow-sm"
        }`}
      >
        <div className="mx-auto grid max-w-[1440px] grid-cols-[auto_1fr_auto] items-center gap-12 px-5 py-4 lg:px-10">

          {/* Brand */}
          <Link href="/" className="flex items-center gap-3.5">
            <Image src="/bsti.svg" alt="BSTI Logo" width={60} height={60} />
            <div className="hidden flex-col border-l-2 border-border pl-3.5 leading-tight md:flex">
              <span className="font-display text-base font-semibold tracking-tight text-foreground">
                {moduleName}
              </span>
              <span className="mt-0.5 font-bn-serif text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
                {moduleSubtitle}
              </span>
            </div>
          </Link>

          {/* Primary Nav (desktop) */}
          <div className="hidden justify-center gap-1 lg:flex">
            {navItems.map((item) => {
              const isActive = activePath === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[14.5px] font-medium transition-colors duration-150 ${
                    isActive
                      ? "text-primary"
                      : "text-foreground hover:bg-secondary hover:text-primary"
                  }`}
                >
                  {item.label}
                  {item.hasDropdown && (
                    <ChevronDown className="h-2.5 w-2.5 opacity-50" strokeWidth={2} />
                  )}
                  {isActive && (
                    <span className="absolute bottom-[-18px] left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-2">
            <IconBtn ariaLabel="Search">
              <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </IconBtn>

            {showCart && (
              <IconBtn ariaLabel="Cart" badge={cartCount}>
                <ShoppingCart className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </IconBtn>
            )}

            <span className="mx-2 hidden h-6 w-px bg-border sm:block" />

            {isPending ? (
              <span className="hidden h-10 w-24 animate-pulse rounded-lg bg-secondary sm:block" />
            ) : session ? (
              <div className="hidden items-center gap-1 sm:flex">
                <Link
                  href="/public/dashboard"
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary hover:text-primary"
                >
                  <UserRound className="h-4 w-4" strokeWidth={1.8} />
                  <span className="max-w-[10ch] truncate">
                    {session.user.name}
                  </span>
                </Link>
                <button
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-subtitle transition-colors hover:bg-secondary hover:text-primary cursor-pointer"
                >
                  <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </button>
              </div>
            ) : (
              <div className="hidden items-center gap-1 sm:flex">
                <Link
                  href="/login"
                  className="rounded-lg px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary hover:text-primary"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="ml-1 flex h-10 w-10 items-center justify-center rounded-lg text-subtitle hover:bg-secondary hover:text-primary lg:hidden"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-border bg-card lg:hidden">
            <div className="mx-auto max-w-[1440px] px-5 py-3">
              <div className="flex flex-col">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between rounded-lg px-3 py-3 text-[15px] font-medium ${
                      activePath === item.href
                        ? "bg-secondary text-primary"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.hasDropdown && (
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    )}
                  </Link>
                ))}
                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                  {session ? (
                    <>
                      <Link
                        href="/public/dashboard"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg border border-border px-4 py-2.5 text-center text-sm font-semibold text-foreground hover:bg-muted"
                      >
                        My account
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-subtitle hover:bg-muted cursor-pointer"
                      >
                        Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg border border-border px-4 py-2.5 text-center text-sm font-semibold text-foreground hover:bg-muted"
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/register"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
                      >
                        Sign Up
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

function IconBtn({
  children,
  ariaLabel,
  badge,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  badge?: number;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-body transition-colors duration-150 hover:border-secondary hover:bg-secondary hover:text-primary"
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-card bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {badge}
        </span>
      )}
    </button>
  );
}
