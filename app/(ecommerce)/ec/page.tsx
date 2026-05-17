import Navbar from "./Navbar";
import { BookOpen, Download, BadgeCheck, PackageSearch } from "lucide-react";

const cards = [
  { icon: BookOpen,      label: "Browse Standards",     desc: "Access 12,000+ BDS and ISO standards across all industries."   },
  { icon: Download,      label: "Download Certificates", desc: "Download certified test reports and compliance documents."        },
  { icon: BadgeCheck,    label: "Get Certified",         desc: "Apply for BSTI product and process certification online."        },
  { icon: PackageSearch, label: "Track Your Order",      desc: "Check the status of your standard purchase or certificate."     },
];

export default function EcommercePage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="mx-auto max-w-[1440px] px-10 py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">BSTI Marketplace</p>
          <h1 className="mt-2 font-display text-4xl font-medium">
            Bangladesh Standards Shop
          </h1>
          <p className="mt-3 max-w-xl text-body">
            Purchase, download, and manage BDS and ISO standards. Official certifications and compliance documents at your fingertips.
          </p>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="group rounded-2xl border border-border bg-card p-8 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md"
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
