"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingBag,
  GitBranch,
  Users,
  Calculator,
  Package,
  ShieldCheck,
} from "lucide-react";

const modules = [
  { label: "HR", href: "/", icon: Users },
  { label: "Ecommerce", href: "/ec", icon: ShoppingBag },
  { label: "Workflow", href: "/workflow", icon: GitBranch },
  { label: "Accounts", href: "/accounts", icon: Calculator },
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Admin", href: "/admin", icon: ShieldCheck },
];

export default function Footer() {
  const pathname = usePathname();

  const activeModule = modules.find((m) =>
    m.href === "/"
      ? pathname === "/" || pathname.startsWith("/listing")
      : pathname.startsWith(m.href),
  );

  return (
    <footer className="bg-primary text-primary-foreground/75 shrink-0">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-2 text-[12px] tracking-wide lg:px-10">
        <span className="font-bn text-primary-foreground/50 text-sm hidden sm:inline">
          BSTI e-Services
        </span>

        <nav className="flex items-center gap-1">
          {modules.map(({ label, href, icon: Icon }) => {
            const isActive = activeModule?.href === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1 rounded px-2.5 py-1 transition-colors duration-150 ${
                  isActive
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "hover:bg-primary-foreground/10 hover:text-primary-foreground"
                }`}
              >
                <Icon className="h-3 w-3" strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <span className="hidden text-primary-foreground/40 sm:inline">
          © {new Date().getFullYear()} BSTI
        </span>
      </div>
    </footer>
  );
}
