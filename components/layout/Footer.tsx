import Link from "next/link";
import {
  ShoppingBag,
  GitBranch,
  Users,
  Calculator,
  Package,
  ShieldCheck,
} from "lucide-react";
import { MODULES, type ModuleKey } from "@/lib/modules";

const ICONS: Record<ModuleKey, typeof Users> = {
  hr: Users,
  store: ShoppingBag,
  workflow: GitBranch,
  accounts: Calculator,
  inventory: Package,
  admin: ShieldCheck,
};

/** `module` marks the active entry; omit it outside a module (landing page). */
export default function Footer({ module }: { module?: ModuleKey }) {
  return (
    <footer className="bg-primary text-primary-foreground/75 shrink-0 print:hidden">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-2 text-[12px] tracking-wide lg:px-10">
        <Link
          href="/"
          className="font-bn text-primary-foreground/50 hover:text-primary-foreground/80 text-sm hidden transition-colors sm:inline"
        >
          BSTI e-Services
        </Link>

        <nav className="flex items-center gap-1">
          {MODULES.map(({ key, path, label }) => {
            const Icon = ICONS[key];
            const isActive = key === module;
            return (
              <Link
                key={key}
                href={path}
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
