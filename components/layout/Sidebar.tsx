"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Users, DollarSign, FileText, Banknote, FileIcon, GitFork, CreditCard, Stamp, UserCircle, ClipboardCheck, Layers, Scale, Building2, ShieldCheck } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
};
type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "Management",
    items: [
      { label: "Employees",        href: "/hr/listing",               icon: Users      },
      { label: "Salary Fixation",  href: "/hr/listing/fixation",      icon: DollarSign, roles: ["superadmin", "officeadmin"] },
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
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    // The destination has rendered, so the highlight can move for real.
    setPending(null);
  }, [pathname]);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card print:hidden">
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
                {visibleItems.map((item) => {
                  const isPending = pending === item.href;
                  // Highlight the clicked link straight away; drop the old one.
                  const active = isPending || (isActive(item.href) && !pending);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => {
                          if (item.href !== pathname) setPending(item.href);
                        }}
                        aria-busy={isPending}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "bg-secondary text-primary"
                            : "text-body hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {isPending ? (
                          <Loader2 size={16} className="shrink-0 animate-spin" />
                        ) : (
                          <Icon
                            size={16}
                            className="shrink-0"
                            strokeWidth={active ? 2.25 : 1.75}
                          />
                        )}
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
