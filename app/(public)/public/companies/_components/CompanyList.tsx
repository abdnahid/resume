"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2, Network, Plus, Check, MapPin, AlertTriangle, Loader2,
  ArrowRight, FileText,
} from "lucide-react";
import type { ClientOrganization } from "@/lib/client/organization";

/**
 * The company list, doubling as the profile switcher.
 *
 * "Acting as" is a real stored choice, not a visual highlight — it is the
 * company an application will be filed under, so switching writes through to
 * the server rather than living in component state.
 */
export default function CompanyList({ organizations }: { organizations: ClientOrganization[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [switching, setSwitching] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(id: number) {
    setSwitching(id);
    setError(null);
    try {
      const res = await fetch("/api/client/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: id }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not switch.");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch.");
    } finally {
      setSwitching(null);
    }
  }

  // Members are shown nested under their group rather than as siblings, because
  // that is the shape the client described their business in.
  const parents = organizations.filter((o) => o.type === "group_parent");
  const memberIds = new Set(parents.flatMap((p) => p.members.map((m) => m.id)));
  const loose = organizations.filter((o) => o.type !== "group_parent" && !memberIds.has(o.id));

  return (
    <div>
      {error && (
        <p className="mb-5 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-8">
        {parents.map((p) => {
          const children = organizations.filter((o) => p.members.some((m) => m.id === o.id));
          return (
            <section key={p.id}>
              <Card org={p} onSwitch={switchTo} switching={switching} pending={pending} />
              <div className="mt-3 space-y-3 border-l-2 border-border pl-5 sm:ml-6">
                {children.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    No companies under this group yet. A group does not apply for licences itself —
                    add the companies that do.
                  </p>
                ) : (
                  children.map((c) => (
                    <Card key={c.id} org={c} onSwitch={switchTo} switching={switching} pending={pending} />
                  ))
                )}
                <Link
                  href={`/public/companies/new?parent=${p.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                  Add a company to this group
                </Link>
              </div>
            </section>
          );
        })}

        {loose.map((o) => (
          <Card key={o.id} org={o} onSwitch={switchTo} switching={switching} pending={pending} />
        ))}
      </div>
    </div>
  );
}

function Card({
  org,
  onSwitch,
  switching,
  pending,
}: {
  org: ClientOrganization;
  onSwitch: (id: number) => void;
  switching: number | null;
  pending: boolean;
}) {
  const isGroup = org.type === "group_parent";
  const Icon = isGroup ? Network : Building2;
  const busy = switching === org.id || (pending && org.isDefault);

  return (
    <article
      className={`rounded-2xl border bg-card p-6 transition ${
        org.isDefault ? "border-primary ring-1 ring-primary/20" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
            <Icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">{org.nameEn}</h2>
            {org.nameBn && org.nameBn !== org.nameEn && (
              <p className="font-bn text-sm text-muted-foreground">{org.nameBn}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {org.isDefault && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 font-medium text-primary-foreground">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                  Acting as this company
                </span>
              )}
              {isGroup && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground">
                  Mother organisation
                </span>
              )}
              {org.isComplete ? (
                <span className="rounded-full bg-secondary px-2.5 py-0.5 font-medium text-primary">
                  Profile complete
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                  {org.missing.length} item{org.missing.length === 1 ? "" : "s"} still needed
                </span>
              )}
            </div>
          </div>
        </div>

        {!org.isDefault && (
          <button
            type="button"
            onClick={() => onSwitch(org.id)}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {switching === org.id && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />}
            Act as this company
          </button>
        )}
      </div>

      {org.factories.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-border pt-4">
          {org.factories.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
              <span className="font-medium text-foreground">{f.nameEn}</span>
              <span className="font-bn text-muted-foreground">{f.district}</span>
              {f.office && (
                <span className="font-bn text-xs text-muted-foreground">→ {f.office.nameBn}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-sm">
        <Link
          href={`/public/companies/${org.id}`}
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          {org.isComplete ? "View profile" : "Finish this profile"}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
        {org.canApply && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <FileText className="h-3.5 w-3.5" strokeWidth={1.8} />
            {org.isComplete
              ? "Ready to apply for a CM licence"
              : "Complete the profile to apply for a licence"}
          </span>
        )}
      </div>
    </article>
  );
}
