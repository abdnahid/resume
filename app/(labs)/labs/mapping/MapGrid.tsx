"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { buildMatrix, officeShortNames } from "@/lib/labs/grid";

type Parameter = {
  id: number; nameEn: string; discipline: string; sourceSection: string;
  feePoisha: number; urgentFeePoisha: number;
  normalDays: number | null; urgentDays: number | null;
};

/**
 * The grid, and the one column somebody is allowed to change.
 *
 * Reading is the whole map — every office at once, because "who else sends
 * this to Faridpur" is a question the map should answer at a glance. Writing
 * is one office's column, because that is the unit of the decision: an office
 * decides where *its* samples go, and nobody redraws another office's
 * referrals (D64).
 *
 * A cell that names a laboratory which cannot run the test, or which has
 * closed, is drawn as broken rather than quietly dropped. That row will be
 * refused when a field officer tries to seal jars against it, and finding out
 * here is days earlier than finding out there.
 */
export default function MapGrid({
  subProduct, parameters, capabilities, preferences, offices,
  editableOfficeIds, preselectedOfficeId,
}: {
  subProduct: { id: number; nameEn: string; product: { nameEn: string } };
  parameters: Parameter[];
  capabilities: { officeId: number; parameterId: number; manner: string; labId: number | null }[];
  preferences: { officeId: number; parameterId: number; toOfficeId: number }[];
  offices: { id: number; nameEn: string; labCount: number }[];
  /** null means every office (superadmin); [] means none. */
  editableOfficeIds: number[] | null;
  preselectedOfficeId: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const editable = editableOfficeIds;
  const canEditAny = editable === null || editable.length > 0;
  const firstEditable =
    editable === null
      ? (preselectedOfficeId ?? offices[0]?.id ?? null)
      : ((editable.includes(preselectedOfficeId ?? -1) ? preselectedOfficeId : editable[0]) ?? null);

  const [officeId, setOfficeId] = useState<number | null>(firstEditable);

  const cells = useMemo(
    () => buildMatrix({ capabilities, preferences, fromOfficeId: officeId }),
    [capabilities, preferences, officeId],
  );
  // The city alone is not unique — Head Office and DMI are both "Dhaka" — and
  // two identical column headings on the screen that picks a destination is
  // the worst place for it.
  const shortName = useMemo(() => officeShortNames(offices), [offices]);
  const short = (o: { id: number; nameEn: string }) => shortName.get(o.id) ?? o.nameEn;

  /** Which offices can take a given test — the list the client asked for. */
  const capableFor = (parameterId: number) =>
    offices.filter((o) => cells.has(`${o.id}:${parameterId}`));

  const prefBy = useMemo(
    () =>
      new Map(
        preferences.filter((p) => p.officeId === officeId).map((p) => [p.parameterId, p.toOfficeId]),
      ),
    [preferences, officeId],
  );

  const uncoverable = parameters.filter((p) => capableFor(p.id).length === 0);

  async function prefer(parameterIds: number[], toOfficeId: number | null) {
    if (!officeId) return;
    setError(null); setSaved(null);
    const res = await fetch("/api/labs/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ officeId, parameterIds, toOfficeId }),
    });
    const json = (await res.json()) as { error?: string; written?: number; pending?: number };
    if (!res.ok) { setError(json.error ?? "That did not save."); return; }
    setSaved(
      toOfficeId === null
        ? `Preference cleared — the field officer will choose.`
        : json.pending
          ? `Saved, but that office has not said it can run ${json.pending} of these, so those will be refused until it does.`
          : `Preference saved for ${json.written} test${json.written === 1 ? "" : "s"}.`,
    );
    start(() => router.refresh());
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
      {saved && (
        <p className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
          <Check className="h-4 w-4 text-primary" /> {saved}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <Legend className="bg-secondary text-secondary-foreground">own bench</Legend>
        <Legend className="bg-primary/10 text-primary">sent out</Legend>
        <Legend className="ring-2 ring-primary ring-offset-1">preferred</Legend>
        <span className="ml-auto tabular-nums">
          {capabilities.length} of {offices.length * parameters.length} cells covered
          {uncoverable.length > 0 && (
            <span className="ml-2 text-amber-700 dark:text-amber-300">
              · {uncoverable.length} test{uncoverable.length === 1 ? "" : "s"} nobody can run
            </span>
          )}
        </span>
      </div>

      {/* ── who can test what ─────────────────────────────────────────────── */}
      <section className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 min-w-64 bg-card px-3 py-2 text-left font-medium">
                Test
              </th>
              {offices.map((o) => (
                <th
                  key={o.id}
                  className={`whitespace-nowrap px-2 py-2 text-left font-medium ${
                    o.id === officeId ? "bg-secondary" : ""
                  }`}
                  title={o.nameEn}
                >
                  {short(o)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parameters.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                  <span className="line-clamp-1" title={p.nameEn}>{p.nameEn}</span>
                </td>
                {offices.map((o) => {
                  const c = cells.get(`${o.id}:${p.id}`);
                  if (!c)
                    return (
                      <td key={o.id} className={`px-2 py-1.5 text-muted-foreground ${o.id === officeId ? "bg-secondary/50" : ""}`}>
                        —
                      </td>
                    );
                  return (
                    <td key={o.id} className={`px-1 py-1 ${o.id === officeId ? "bg-secondary/50" : ""}`}>
                      <span
                        title={
                          c.manner === "third_party"
                            ? `${o.nameEn} covers this by sending it to an accredited outside laboratory`
                            : `${o.nameEn} runs this on its own bench`
                        }
                        className={`block truncate rounded px-1.5 py-0.5 ${
                          c.manner === "third_party"
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary text-secondary-foreground"
                        } ${c.preferred ? "ring-2 ring-primary ring-offset-1" : ""}`}
                      >
                        {c.manner === "third_party" ? "sent out" : "own"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {uncoverable.length > 0 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>
            {uncoverable.length} test{uncoverable.length === 1 ? "" : "s"} in this package no
            office has claimed.
          </strong>{" "}
          An application naming this sub-product cannot resolve until one does —{" "}
          {uncoverable.slice(0, 3).map((p) => `“${p.nameEn}”`).join(", ")}
          {uncoverable.length > 3 && `, and ${uncoverable.length - 3} more`}.
        </p>
      )}

      {/* ── one office's preferences ──────────────────────────────────────── */}
      {!canEditAny ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          You can read the map but not change it. Where an office&rsquo;s samples go is decided by
          that office — its head or its lab entry officer — or by a superadmin.
        </p>
      ) : (
        <section className="rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Where should</h2>
            <select
              value={officeId ?? ""}
              onChange={(e) => setOfficeId(Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            >
              {offices
                .filter((o) => editable === null || editable.includes(o.id))
                .map((o) => (
                  <option key={o.id} value={o.id}>{o.nameEn}</option>
                ))}
            </select>
            <h2 className="text-sm font-semibold">send each of these?</h2>
          </div>

          <p className="border-b border-border bg-secondary/30 px-5 py-2.5 text-xs text-muted-foreground">
            A preference only breaks a tie. Leave it unset and the field officer picks from the
            capable offices when he seals the samples — which is right where there is nothing to
            choose between them, and wrong where this office has always sent a test to one
            particular place.
          </p>

          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-5 py-2 font-medium">Test</th>
                <th className="px-5 py-2 font-medium">Can be run at</th>
                <th className="px-5 py-2 font-medium">Preferred</th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((p) => {
                const capable = capableFor(p.id);
                const here = officeId !== null && cells.has(`${officeId}:${p.id}`);
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2">{p.nameEn}</td>
                    <td className="px-5 py-2 text-xs text-muted-foreground">
                      {capable.length === 0 ? (
                        <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="h-3.5 w-3.5" /> nobody
                        </span>
                      ) : (
                        capable.map((o) => short(o)).join(", ")
                      )}
                    </td>
                    <td className="px-5 py-2">
                      {here ? (
                        <span className="text-xs text-muted-foreground">
                          run here — nothing to choose
                        </span>
                      ) : (
                        <select
                          value={prefBy.get(p.id) ?? ""}
                          disabled={pending || !officeId || capable.length === 0}
                          onChange={(e) =>
                            prefer([p.id], e.target.value ? Number(e.target.value) : null)
                          }
                          className="rounded-lg border border-border bg-background px-2 py-1 text-sm disabled:opacity-40"
                        >
                          <option value="">— the officer chooses —</option>
                          {capable.map((o) => (
                            <option key={o.id} value={o.id}>{short(o)}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded px-1.5 py-0.5 ${className}`}>{children}</span>;
}
