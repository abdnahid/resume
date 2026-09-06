"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  Factory as FactoryIcon,
  Loader2,
  Network,
  Plus,
} from "lucide-react";
import type { ClientOrganization } from "@/lib/client/organization";
import FactoryForm from "../../../companies/_components/FactoryForm";
import StartApplication from "../../[id]/_components/StartApplication";

/**
 * Choosing what to apply for: a company, then one of its factories.
 *
 * All three routes in are on this page, because an applicant who discovers here
 * that the plant is not registered should not have to leave, find the company
 * page, add it, and navigate back:
 *
 * - **an existing factory** — pick it and start;
 * - **a new factory of an existing company** — the form is inline, and the
 *   factory then appears in the list with its BSTI office resolved;
 * - **a company that does not exist yet** — the profile wizard, which returns
 *   here when it is done rather than to the company page.
 *
 * The wizard is deliberately *not* duplicated inline. It asks for everything
 * `missingForSubmission()` will later demand, and a stripped-down second form
 * would create companies that cannot submit — the wall arriving after the
 * product, the SKUs and the fee rather than before them.
 *
 * The factory choice is the consequential one — it decides which BSTI office
 * receives the file — so the receiving office is named beside each option
 * rather than revealed after submission. A factory added here is no exception:
 * it is listed with its office named before the button beside it is worth
 * pressing.
 */

/** The wizard and the group link both come back to the picker. */
const RETURN_TO = "/public/applications/new";
const NEW_COMPANY = `/public/companies/new?next=${encodeURIComponent(RETURN_TO)}`;

export default function ApplyPicker({
  organizations,
}: {
  organizations: ClientOrganization[];
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  /** Which company's factory form is open — at most one at a time. */
  const [adding, setAdding] = useState<number | null>(null);
  /** The factory just registered here, so the list can point at it. */
  const [justAdded, setJustAdded] = useState<number | null>(null);

  const eligible = organizations.filter((o) => o.canApply);
  const parents = organizations.filter((o) => o.type === "group_parent");

  return (
    <div className="mt-10 space-y-6">
      {eligible.length === 0 && (
        <section className="rounded-2xl border border-dashed border-border bg-card/60 p-8">
          <Building2 className="h-8 w-8 text-primary" strokeWidth={1.6} />
          <h2 className="mt-4 font-semibold text-foreground">No company can apply yet</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            A mother organisation cannot hold a licence itself — the companies under it apply for
            their own products. Add a company to continue.
          </p>
        </section>
      )}

      {eligible.map((org) => {
        const isAdding = adding === org.id;
        return (
          <section key={org.id} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">{org.nameEn}</h2>
                {org.nameBn && org.nameBn !== org.nameEn && (
                  <p className="font-bn text-sm text-muted-foreground">{org.nameBn}</p>
                )}
                {org.parent && (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Network className="h-3 w-3 text-primary" strokeWidth={1.8} />
                    under {org.parent.nameEn}
                  </p>
                )}
              </div>
              {!org.isComplete && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                  Profile incomplete
                </span>
              )}
            </div>

            {!org.isComplete && (
              <p className="mt-3 rounded-lg bg-amber-500/5 px-3 py-2.5 text-sm text-muted-foreground">
                You can start an application now, but it cannot be submitted until the profile is
                complete —{" "}
                <Link
                  href={`/public/companies/${org.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  finish it
                </Link>
                .
              </p>
            )}

            {org.factories.length === 0 ? (
              <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
                No factory registered. A licence is granted for a product made at a specific plant,
                so you need one before you can apply.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {org.factories.map((f) => {
                  const isNew = justAdded === f.id;
                  return (
                    <li
                      key={f.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                        isNew
                          ? "border-primary bg-secondary/40 ring-1 ring-primary/20"
                          : "border-border bg-background"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium text-foreground">
                          <FactoryIcon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
                          {f.nameEn}
                          {isNew && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                              <Check className="h-3 w-3" strokeWidth={2.5} />
                              Just added
                            </span>
                          )}
                        </p>
                        <p className="mt-1 font-bn text-sm text-muted-foreground">
                          {f.district}
                          {f.office && <> → {f.office.nameBn}</>}
                        </p>
                      </div>
                      <StartApplication organizationId={org.id} factoryId={f.id} />
                    </li>
                  );
                })}
              </ul>
            )}

            {isAdding ? (
              <FactoryForm
                organizationId={org.id}
                onSaved={(factoryId) => {
                  setAdding(null);
                  setJustAdded(factoryId);
                  // Refresh rather than splice the row in: the BSTI office is
                  // resolved on the server from the district, and a factory
                  // shown without it hides the one fact that matters here.
                  startRefresh(() => router.refresh());
                }}
                onCancel={() => setAdding(null)}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setJustAdded(null);
                  setAdding(org.id);
                }}
                disabled={refreshing}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
              >
                {refreshing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                )}
                {org.factories.length === 0 ? "Register a factory" : "Register another factory"}
              </button>
            )}
          </section>
        );
      })}

      {/* A group parent cannot apply, but it is where a new member company goes. */}
      {parents.map((p) => (
        <section
          key={p.id}
          className="rounded-2xl border border-dashed border-border bg-card/60 p-6"
        >
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <Network className="h-4 w-4 text-primary" strokeWidth={1.8} />
            {p.nameEn}
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            A mother organisation does not hold a licence itself — the companies under it apply for
            their own products.
          </p>
          <Link
            href={`/public/companies/new?parent=${p.id}&next=${encodeURIComponent(RETURN_TO)}`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add a company to this group
          </Link>
        </section>
      ))}

      {/* The third route in: no profile for this business yet. */}
      <section className="rounded-2xl border border-dashed border-border bg-card/60 p-6">
        <h2 className="font-semibold text-foreground">Applying for a different company?</h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Set up its profile and register its factory, and you will come straight back here to
          apply.
        </p>
        <Link
          href={NEW_COMPANY}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Set up a company profile
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </section>
    </div>
  );
}
