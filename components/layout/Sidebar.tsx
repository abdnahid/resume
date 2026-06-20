"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, DollarSign, FileText, Banknote, FileIcon, GitFork, CreditCard, Stamp, UserCircle, ClipboardCheck } from "lucide-react";

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
      { label: "Employees",        href: "/listing",               icon: Users      },
      { label: "Salary Fixation",  href: "/listing/fixation",      icon: DollarSign, roles: ["superadmin", "officeadmin"] },
      { label: "Processed Salary", href: "/listing/salary",        icon: Banknote   },
      { label: "Bank Advice",      href: "/listing/bank-advice",   icon: FileIcon   },
      { label: "ID Cards",         href: "/listing/id-cards",      icon: CreditCard, roles: ["superadmin"] },
    ],
  },
  {
    title: "Organization",
    items: [
      { label: "Organogram",        href: "/organogram",         icon: GitFork },
      { label: "Manage Structure",  href: "/organogram/manage",  icon: GitFork, roles: ["superadmin"] },
      { label: "Director General",  href: "/listing/director-general", icon: Stamp, roles: ["superadmin"] },
    ],
  },
  {
    title: "Documents",
    items: [
      { label: "Personal Data Sheet", href: "/", icon: FileText },
      { label: "My Profile",          href: "/profile",  icon: UserCircle },
      { label: "Profile Approvals",   href: "/approvals", icon: ClipboardCheck, roles: ["superadmin"] },
    ],
  },
];

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

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
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "bg-secondary text-primary"
                            : "text-body hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Icon
                          size={16}
                          className="shrink-0"
                          strokeWidth={active ? 2.25 : 1.75}
                        />
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
