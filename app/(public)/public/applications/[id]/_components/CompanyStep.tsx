import Link from "next/link";
import { Building2, Factory as FactoryIcon, MapPin, Pencil, AlertTriangle, Check } from "lucide-react";

type Field = { label: string; value: string | null | undefined; bn?: boolean };

/**
 * Step 1 — what BSTI already holds about the applicant, shown back to them.
 *
 * The company and factory details are not editable here on purpose: they belong
 * to the company profile and are shared by every application, so an edit made
 * inside one application would silently change the others. What this step does
 * is give the applicant the chance to *notice* before committing — the details
 * are read back, and anything wrong is one link away from the place that owns
 * it.
 *
 * It is first because it is the cheapest thing to get wrong: a licence issued
 * against a stale address or a superseded trade licence is a licence that has
 * to be reissued.
 */
export default function CompanyStep({
  organization,
  factory,
  office,
  incomplete,
}: {
  organization: {
    id: number;
    nameEn: string;
    nameBn: string | null;
    legalForm: string | null;
    tradeLicenceNo: string | null;
    tradeLicenceExpiry: string | null;
    binNo: string | null;
    tinNo: string | null;
    addressLine: string | null;
    district: string | null;
    repName: string | null;
    repDesignation: string | null;
    repMobile: string | null;
    repEmail: string | null;
  };
  factory: {
    nameEn: string;
    nameBn: string | null;
    addressLine: string;
    district: string;
    contactName: string | null;
    contactMobile: string | null;
  };
  office: { nameEn: string; nameBn: string | null } | null;
  incomplete: boolean;
}) {
  const company: Field[] = [
    { label: "Legal form", value: organization.legalForm?.replace(/_/g, " ") },
    { label: "Trade licence", value: organization.tradeLicenceNo },
    { label: "Licence expiry", value: organization.tradeLicenceExpiry },
    { label: "BIN", value: organization.binNo },
    { label: "TIN", value: organization.tinNo },
    { label: "Address", value: organization.addressLine, bn: true },
    { label: "District", value: organization.district, bn: true },
  ];

  const rep: Field[] = [
    { label: "Name", value: organization.repName },
    { label: "Designation", value: organization.repDesignation },
    { label: "Mobile", value: organization.repMobile },
    { label: "Email", value: organization.repEmail },
  ];

  const plant: Field[] = [
    { label: "Address", value: factory.addressLine, bn: true },
    { label: "District", value: factory.district, bn: true },
    { label: "Contact", value: factory.contactName },
    { label: "Contact mobile", value: factory.contactMobile },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">Check your details</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              This is what BSTI holds about you. It will be read by the officer who reviews the
              file, and the licence is issued against it — so correct anything wrong before you go
              on.
            </p>
          </div>
          <Link
            href={`/public/companies/${organization.id}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/50"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
            Edit company setup
          </Link>
        </div>

        {incomplete ? (
          <p className="mt-5 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-foreground">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500"
              strokeWidth={2}
            />
            <span>
              Your company profile is not complete yet, and this application cannot be submitted
              until it is. Open the company setup to see exactly what is missing.
            </span>
          </p>
        ) : (
          <p className="mt-5 flex items-center gap-2 rounded-xl border border-primary/25 bg-secondary/40 px-4 py-3 text-sm text-foreground">
            <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />
            Your company profile has everything BSTI needs.
          </p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Panel
            icon={<Building2 className="h-4 w-4 text-primary" strokeWidth={1.8} />}
            title={organization.nameEn}
            subtitle={organization.nameBn}
            fields={company}
          />
          <Panel
            icon={<FactoryIcon className="h-4 w-4 text-primary" strokeWidth={1.8} />}
            title={factory.nameEn}
            subtitle={factory.nameBn}
            fields={plant}
          />
        </div>

        <div className="mt-6">
          <Panel title="Authorised representative" fields={rep} />
        </div>
      </section>

      <p className="flex items-start gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
        <span className="text-muted-foreground">
          Because the plant is in{" "}
          <span className="font-bn font-medium text-foreground">{factory.district}</span>, this
          application goes to{" "}
          <span className="font-bn font-medium text-foreground">
            {office?.nameBn ?? office?.nameEn ?? "an office yet to be determined"}
          </span>
          . Change the factory and the office changes with it.
        </span>
      </p>
    </div>
  );
}

function Panel({
  icon,
  title,
  subtitle,
  fields,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string | null;
  fields: Field[];
}) {
  return (
    <div className="rounded-xl border border-border p-5">
      <p className="flex items-center gap-2 font-medium text-foreground">
        {icon}
        {title}
      </p>
      {subtitle && <p className="mt-0.5 font-bn text-sm text-muted-foreground">{subtitle}</p>}
      <dl className="mt-4 space-y-2">
        {fields.map((f) => (
          <div key={f.label} className="flex gap-3 text-sm">
            <dt className="w-32 shrink-0 text-muted-foreground">{f.label}</dt>
            <dd className={`min-w-0 flex-1 ${f.bn ? "font-bn" : ""} text-foreground`}>
              {f.value?.toString().trim() ? (
                f.value
              ) : (
                <span className="text-muted-foreground/70">— not given</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
