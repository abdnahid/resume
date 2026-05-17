import ModuleNavbar from "@/components/layout/ModuleNavbar";
import { CheckSquare, FolderKanban, Users, BarChart3 } from "lucide-react";

const navItems = [
  { label: "Dashboard",  href: "/workflow"           },
  { label: "Projects",   href: "/workflow/projects",  hasDropdown: true },
  { label: "My Tasks",   href: "/workflow/tasks"      },
  { label: "Team",       href: "/workflow/team"       },
  { label: "Reports",    href: "/workflow/reports"    },
];

const cards = [
  { icon: CheckSquare,   label: "My Tasks",            desc: "View and manage your assigned tasks and deadlines."             },
  { icon: FolderKanban,  label: "Active Projects",      desc: "Track progress across all ongoing projects and milestones."    },
  { icon: Users,         label: "Team Collaboration",   desc: "Coordinate with your team, assign roles, and share updates."   },
  { icon: BarChart3,     label: "Analytics & Reports",  desc: "Measure performance, velocity, and on-time delivery rates."    },
];

export default function WorkflowPage() {
  return (
    <>
      <ModuleNavbar
        moduleName="Workflow"
        moduleSubtitle="BSTI e-Services"
        navItems={navItems}
      />
      <main>
        <section className="mx-auto max-w-[1440px] px-10 py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Project Management</p>
          <h1 className="mt-2 font-display text-4xl font-medium">
            Workflow & Task Management
          </h1>
          <p className="mt-3 max-w-xl text-body">
            Plan projects, assign tasks, and track progress across your entire organisation — all in one place.
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
