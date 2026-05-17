import ModuleNavbar from "@/components/layout/ModuleNavbar";
import { Wallet, ArrowLeftRight, FileText, Banknote } from "lucide-react";

const navItems = [
  { label: "Dashboard",    href: "/accounts"                              },
  { label: "Transactions", href: "/accounts/transactions"                 },
  { label: "Invoices",     href: "/accounts/invoices",  hasDropdown: true },
  { label: "Payroll",      href: "/accounts/payroll"                      },
  { label: "Reports",      href: "/accounts/reports",   hasDropdown: true },
];

const cards = [
  { icon: Wallet,          label: "Financial Overview",  desc: "Real-time snapshot of revenues, expenses, and net profit."      },
  { icon: ArrowLeftRight,  label: "Transactions",        desc: "Record, categorise, and reconcile all financial transactions."   },
  { icon: FileText,        label: "Invoices",            desc: "Create, send, and track invoices with payment status updates."   },
  { icon: Banknote,        label: "Payroll",             desc: "Process employee salaries, deductions, and disbursements."       },
];

export default function AccountsPage() {
  return (
    <>
      <ModuleNavbar
        moduleName="Accounts"
        moduleSubtitle="BSTI e-Services"
        navItems={navItems}
      />
      <main>
        <section className="mx-auto max-w-[1440px] px-10 py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Financial Management</p>
          <h1 className="mt-2 font-display text-4xl font-medium">
            Accounts & Finance
          </h1>
          <p className="mt-3 max-w-xl text-body">
            Manage budgets, track expenditures, process payroll, and generate financial reports with full audit trails.
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
