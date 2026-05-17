"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Search,
  ShoppingCart,
  ChevronDown,
  ArrowRight,
  Shield,
  Menu,
  X,
} from "lucide-react";
import Image from "next/image";

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
};

export default function ModuleNavbar({
  moduleName,
  moduleSubtitle,
  navItems,
  showCart = false,
}: Props) {
  const [activePath, setActivePath] = useState(navItems[0]?.href ?? "/");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartCount] = useState(2);

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
                  onClick={(e) => {
                    e.preventDefault();
                    setActivePath(item.href);
                  }}
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

            <Link
              href="/signin"
              className="hidden rounded-lg px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary hover:text-primary sm:inline-flex"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="hidden items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all duration-150 hover:-translate-y-px hover:bg-primary-hover hover:shadow-md sm:inline-flex"
            >
              Sign Up
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>

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
                    onClick={(e) => {
                      e.preventDefault();
                      setActivePath(item.href);
                      setMobileOpen(false);
                    }}
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
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
                  <Link
                    href="/signin"
                    className="rounded-lg border border-border px-4 py-2.5 text-center text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
                  >
                    Sign Up <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
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
