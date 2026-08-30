"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { useSidebar } from "@/components/layout/SidebarContext";
import { Users, DollarSign, FileText, Banknote, FileIcon, GitFork, CreditCard, Stamp, UserCircle, ClipboardCheck, Layers, Scale, Building2, ShieldCheck, CalendarClock } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  /**
   * Sub-items, rendered as a collapsible. A parent with children is a heading
   * rather than a destination — its own `href` is only used to decide whether
   * the group starts open.
   */
  children?: NavItem[];
};
type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "Management",
    items: [
      { label: "Employees",        href: "/hr/listing",               icon: Users      },
      {
        // Two pay regimes, two screens. Regular staff are fixated on a grade
        // and step; daily-basis staff have no fixation at all and are set up by
        // recording the days they worked.
        label: "Salary Fixation",
        href: "/hr/listing/fixation",
        icon: DollarSign,
        roles: ["superadmin", "officeadmin"],
        children: [
          { label: "Regular",     href: "/hr/listing/fixation",   icon: DollarSign },
          { label: "Daily basis", href: "/hr/listing/attendance", icon: CalendarClock },
        ],
      },
      { label: "Salary Heads",     href: "/hr/listing/salary-heads",  icon: Layers,     roles: ["superadmin"] },
      { label: "Case Register",    href: "/hr/listing/cases",         icon: Scale,      roles: ["superadmin", "case_officer"] },
      { label: "Processed Salary", href: "/hr/listing/salary",        icon: Banknote   },
      { label: "Bank Advice",      href: "/hr/listing/bank-advice",   icon: FileIcon   },
      { label: "ID Cards",         href: "/hr/listing/id-cards",      icon: CreditCard, roles: ["superadmin"] },
    ],
  },
  {
    title: "Organization",
    items: [
      { label: "Organogram",        href: "/hr/organogram",      icon: GitFork },
      { label: "Manage Structure",  href: "/hr/organogram/manage",  icon: GitFork, roles: ["superadmin"] },
      { label: "Director General",  href: "/hr/listing/director-general", icon: Stamp, roles: ["superadmin"] },
      { label: "Office Setup",      href: "/hr/listing/offices",   icon: Building2, roles: ["superadmin", "officeadmin"] },
      { label: "Roles",             href: "/hr/listing/roles",     icon: ShieldCheck, roles: ["superadmin"] },
    ],
  },
  {
    title: "Documents",
    items: [
      { label: "Personal Data Sheet", href: "/hr", icon: FileText },
      { label: "My Profile",          href: "/hr/profile",  icon: UserCircle },
      { label: "Profile Approvals",   href: "/hr/approvals", icon: ClipboardCheck, roles: ["superadmin"] },
    ],
  },
];

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  /**
   * The link that was clicked, held until the new page actually renders.
   *
   * `usePathname()` only changes once navigation completes, so without this the
   * sidebar keeps highlighting the page you are leaving for the whole wait —
   * about a second on the heavier screens — and nothing shows which link was
   * pressed.
   */
  const { open, close } = useSidebar();

  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    // The destination has rendered, so the highlight can move for real.
    setPending(null);
  }, [pathname]);

  return (
    <>
      {/*
        The backdrop only exists while the drawer is open, and only below the
        dock breakpoint — above it the sidebar sits in the gutter beside the
        centred content and covers nothing.
      */}
      {open && (
        <div
          onClick={close}
          aria-hidden
          className="absolute inset-0 z-30 bg-black/30 backdrop-blur-[1px] min-[1920px]:hidden print:hidden"
        />
      )}

      <aside
        aria-label="Sections"
        // Out of flow, so <main> spans the whole window. Below 1920px it slides
        // in over the content as a drawer; above it there is room for it to sit
        // permanently in the left gutter without covering anything.
        className={`absolute inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-card transition-transform duration-200 ease-out print:hidden min-[1920px]:translate-x-0 min-[1920px]:shadow-none ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full shadow-none"
        }`}
      >
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.roles || item.roles.includes(role),
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title}>
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.title}
                </p>
                <ul className="space-y-0.5">
                  {visibleItems.map((item) =>
                    item.children ? (
                      <NavBranch
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        pending={pending}
                        onNavigate={setPending}
                      />
                    ) : (
                      <NavLeaf
                        key={item.href}
                        item={item}
                        active={pending === item.href || (isActive(item.href) && !pending)}
                        pending={pending === item.href}
                        onNavigate={setPending}
                        currentPath={pathname}
                      />
                    ),
                  )}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

/** A single destination. */
function NavLeaf({
  item,
  active,
  pending,
  onNavigate,
  currentPath,
  nested = false,
}: {
  item: NavItem;
  active: boolean;
  pending: boolean;
  onNavigate: (href: string) => void;
  currentPath: string;
  nested?: boolean;
}) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        onClick={() => {
          if (item.href !== currentPath) onNavigate(item.href);
        }}
        aria-busy={pending}
        className={`flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors ${
          nested ? "pl-9 pr-3" : "px-3"
        } ${
          active
            ? "bg-secondary text-primary"
            : "text-body hover:bg-muted hover:text-foreground"
        }`}
      >
        {pending ? (
          <Loader2 size={16} className="shrink-0 animate-spin" />
        ) : (
          <Icon size={16} className="shrink-0" strokeWidth={active ? 2.25 : 1.75} />
        )}
        {item.label}
      </Link>
    </li>
  );
}

/**
 * A collapsible heading over its children.
 *
 * It opens itself when one of its children is the current page, so arriving by
 * any route — a link, a redirect, a reload — leaves the tree showing where you
 * are rather than collapsed over it.
 */
function NavBranch({
  item,
  pathname,
  pending,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  pending: string | null;
  onNavigate: (href: string) => void;
}) {
  const children = item.children ?? [];
  const holdsCurrent = children.some((c) => pathname === c.href);
  const holdsPending = children.some((c) => pending === c.href);
  const [open, setOpen] = useState(holdsCurrent);

  useEffect(() => {
    if (holdsCurrent) setOpen(true);
  }, [holdsCurrent]);

  const Icon = item.icon;
  // The heading is highlighted only while collapsed over the active child —
  // open, the child shows it and two highlights would be noise.
  const showParentActive = (holdsCurrent || holdsPending) && !open;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
          showParentActive
            ? "bg-secondary text-primary"
            : "text-body hover:bg-muted hover:text-foreground"
        }`}
      >
        <Icon size={16} className="shrink-0" strokeWidth={showParentActive ? 2.25 : 1.75} />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronRight
          size={14}
          className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <ul className="mt-0.5 space-y-0.5">
          {children.map((child) => (
            <NavLeaf
              key={child.href}
              item={child}
              nested
              active={pending === child.href || (pathname === child.href && !pending)}
              pending={pending === child.href}
              onNavigate={onNavigate}
              currentPath={pathname}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
