import ModuleNavbar from "@/components/layout/ModuleNavbar";
import { Package, Layers, Truck, ClipboardList } from "lucide-react";

const navItems = [
  { label: "Dashboard",        href: "/inventory"                                  },
  { label: "Products",         href: "/inventory/products",  hasDropdown: true     },
  { label: "Stock",            href: "/inventory/stock"                            },
  { label: "Suppliers",        href: "/inventory/suppliers"                        },
  { label: "Purchase Orders",  href: "/inventory/orders"                           },
];

const cards = [
  { icon: Package,       label: "Products Catalogue",  desc: "Browse and manage your full product inventory with variants."   },
  { icon: Layers,        label: "Stock Levels",         desc: "Monitor real-time stock, set reorder points, and avoid stockouts." },
  { icon: Truck,         label: "Suppliers",            desc: "Manage supplier profiles, contracts, and delivery schedules."   },
  { icon: ClipboardList, label: "Purchase Orders",      desc: "Raise, approve, and track purchase orders end-to-end."          },
];

export default function InventoryPage() {
  return (
    <>
      <ModuleNavbar
        moduleName="Inventory"
        moduleSubtitle="BSTI e-Services"
        navItems={navItems}
      />
      <main>
        <section className="mx-auto max-w-[1440px] px-10 py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Stock & Supply Chain</p>
          <h1 className="mt-2 font-display text-4xl font-medium">
            Inventory Management
          </h1>
          <p className="mt-3 max-w-xl text-body">
            Track stock levels, manage suppliers, and automate reordering to keep your supply chain running smoothly.
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
