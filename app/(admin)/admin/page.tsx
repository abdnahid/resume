import ModuleNavbar from "@/components/layout/ModuleNavbar";
import { UserCog, ShieldCheck, LayoutGrid, ScrollText } from "lucide-react";

const navItems = [
  { label: "Dashboard",  href: "/admin"                                  },
  { label: "Users",      href: "/admin/users",    hasDropdown: true      },
  { label: "Roles",      href: "/admin/roles"                            },
  { label: "Modules",    href: "/admin/modules",  hasDropdown: true      },
  { label: "Audit Logs", href: "/admin/logs"                             },
];

const cards = [
  { icon: UserCog,     label: "User Management",    desc: "Create, edit, and deactivate user accounts across all modules."  },
  { icon: ShieldCheck, label: "Roles & Permissions", desc: "Define roles and granular access controls for each module."      },
  { icon: LayoutGrid,  label: "Module Settings",     desc: "Enable or configure individual modules for your organisation."   },
  { icon: ScrollText,  label: "Audit Logs",          desc: "Full audit trail of all system events, logins, and changes."     },
];

export default function AdminPage() {
  return (
    <>
      <ModuleNavbar
        moduleName="Admin"
        moduleSubtitle="BSTI e-Services"
        navItems={navItems}
      />
      <main>
        <section className="mx-auto max-w-[1440px] px-10 py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">System Administration</p>
          <h1 className="mt-2 font-display text-4xl font-medium">
            Admin Control Panel
          </h1>
          <p className="mt-3 max-w-xl text-body">
            Manage users, define access roles, configure modules, and monitor the full system audit trail from one central place.
          </p>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="rounded-2xl border border-border bg-card p-8 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
                </div>
                <p className="font-semibold text-foreground">{label}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

      </main>
    </>
  );
}
