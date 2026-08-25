import Link from "next/link";
import {
  ShoppingBag,
  GitBranch,
  Users,
  Calculator,
  Package,
  ShieldCheck,
  BadgeCheck,
  SearchCheck,
  Home,
} from "lucide-react";
import { MODULES, type ModuleKey } from "@/lib/modules";
import { CITIZEN_SERVICES, type CitizenService } from "@/lib/services";

const MODULE_ICONS: Record<ModuleKey, typeof Users> = {
  hr: Users,
  store: ShoppingBag,
  workflow: GitBranch,
  accounts: Calculator,
  inventory: Package,
  admin: ShieldCheck,
};

const SERVICE_ICONS: Record<CitizenService["icon"], typeof Users> = {
  standards: ShoppingBag,
  certificate: BadgeCheck,
  verify: SearchCheck,
};

type Entry = { key: string; href: string; label: string; Icon: typeof Users };

/**
 * The public switcher lists what a visitor can actually open. Offering them the
 * internal module list would advertise five destinations they are refused at
 * (D14) — the dead-link problem one step worse, because the link resolves and
 * then turns them away.
 */
const publicEntries = (): Entry[] => [
  { key: "home", href: "/", label: "Home", Icon: Home },
  ...CITIZEN_SERVICES.filter((s) => s.status.kind === "live").map((s) => ({
    key: s.key,
    href: s.status.kind === "live" ? s.status.href : "/",
    label: s.label,
    Icon: SERVICE_ICONS[s.icon],
  })),
];

const internalEntries = (): Entry[] =>
  MODULES.map(({ key, path, label }) => ({
    key,
    href: path,
    label,
    Icon: MODULE_ICONS[key],
  }));

export default function Footer({
  module,
  /**
   * Which switcher to show. Defaults to `public` so a new public surface can
   * never leak the internal list by forgetting the prop. Staff browsing the
   * store see the public one too — there they are a customer (D13).
   */
  audience = "public",
}: {
  /** Marks the active entry; omit it outside a module (landing page). */
  module?: ModuleKey;
  audience?: "public" | "internal";
}) {
  const entries = audience === "internal" ? internalEntries() : publicEntries();

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
          {entries.map(({ key, href, label, Icon }) => {
            const isActive = key === module;
            return (
              <Link
                key={key}
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
