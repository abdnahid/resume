"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, DollarSign, FileText } from "lucide-react";
import Image from "next/image";

type NavItem = { label: string; href: string; icon: React.ElementType };
type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "Management",
    items: [
      { label: "Employees", href: "/listing", icon: Users },
      { label: "Salary Fixation", href: "/listing/fixation", icon: DollarSign },
    ],
  },
  {
    title: "Documents",
    items: [{ label: "Personal Data Sheet", href: "/", icon: FileText }],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Branding */}
      <div className="flex h-14 items-center gap-3 border-b border-slate-200 px-4 bg-primary p-2 text-white">
        <div className="min-w-0 ">
          <p className="text-lg font-semibold font-bn-serif leading-tight text-white">
            BSTI
          </p>
          <p className="text-xs font-body uppercase tracking-widest text-slate-100 leading-tight">
            HR Management
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-accent-soft text-primary"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
        ))}
      </nav>
    </aside>
  );
}
