"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check } from "lucide-react";
import {
  buildMatrix, cellLabel, labShortName, officeShortName,
  type MatrixLab,
} from "@/lib/labs/grid";

type Parameter = {
  id: number; nameEn: string; discipline: string; sourceSection: string;
  feePoisha: number; urgentFeePoisha: number;
};
type Routing = {
  officeId: number; parameterId: number; labId: number;
  mode: string; isPlaceholder: boolean; note: string | null;
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
  subProduct, parameters, routings, capabilities, offices, labs,
  editableOfficeIds, preselectedOfficeId,
}: {
  subProduct: { id: number; nameEn: string; product: { nameEn: string } };
  parameters: Parameter[];
  routings: Routing[];
  capabilities: { labId: number; parameterId: number }[];
  offices: { id: number; nameEn: string; labCount: number }[];
  labs: MatrixLab[];
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
      : (editable.includes(preselectedOfficeId ?? -1) ? preselectedOfficeId : editable[0]) ?? null;

  const [officeId, setOfficeId] = useState<number | null>(firstEditable);

  const labById = useMemo(() => new Map(labs.map((l) => [l.id, l])), [labs]);
  const capable = useMemo(
    () => new Set(capabilities.map((c) => `${c.labId}:${c.parameterId}`)),
    [capabilities],
  );
  const cells = useMemo(
    () => buildMatrix({ offices, parameters, routings, capable, labs: labById }),
    [offices, parameters, routings, capable, labById],
  );

  /** The destinations that could legitimately take a given test. */
  const optionsFor = (parameterId: number) =>
    labs.filter((l) => l.isActive && capable.has(`${l.id}:${parameterId}`));

  const brokenCount = [...cells.values()].filter((c) => c.broken).length;
  const placeholderTotal = [...cells.values()].filter((c) => c.isPlaceholder).length;

  async function assign(parameterIds: number[], labId: number) {
    if (!officeId) return;
    setError(null); setSaved(null);
    const res = await fetch("/api/labs/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ officeId, parameterIds, labId }),
    });
    const json = (await res.json()) as { error?: string; written?: number };
    if (!res.ok) { setError(json.error ?? "That did not save."); return; }
    setSaved(`${json.written} test${json.written === 1 ? "" : "s"} routed.`);
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
        <Legend className="bg-secondary text-secondary-foreground">tested here</Legend>
        <Legend className="bg-primary/10 text-primary">sent elsewhere</Legend>
        <Legend className="border border-dashed border-amber-400 text-amber-700 dark:text-amber-300">
          still the seeded stand-in
        </Legend>
        <Legend className="bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200">
          unusable
        </Legend>
        <span className="ml-auto tabular-nums">
          {placeholderTotal} of {offices.length * parameters.length} cells not yet decided
          {brokenCount > 0 && <> · {brokenCount} unusable</>}
        </span>
      </div>

      {/* ── the map ────────────────────────────────────────────────────────── */}
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
                  {officeShortName(o.nameEn)}
                  {o.labCount === 0 && (
                    <span className="ml-1 text-muted-foreground" title="This office has no laboratory">
                      ·
                    </span>
                  )}
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
                  const lab = c?.labId ? labById.get(c.labId) : null;
                  if (!c || !lab)
                    return (
                      <td key={o.id} className="px-2 py-1.5 text-muted-foreground">
                        —
                      </td>
                    );
                  return (
                    <td key={o.id} className={`px-1 py-1 ${o.id === officeId ? "bg-secondary/50" : ""}`}>
                      <span
                        title={`${lab.nameEn}${c.isPlaceholder ? " — seeded stand-in, not a decision" : ""}${
                          c.broken ? " — cannot run this test, or is closed" : ""
                        }`}
                        className={`block truncate rounded px-1.5 py-0.5 ${
                          c.broken
                            ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200"
                            : c.isPlaceholder
                              ? "border border-dashed border-amber-400 text-amber-700 dark:text-amber-300"
                              : c.away
                                ? "bg-primary/10 text-primary"
                                : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {cellLabel(lab, o.id)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── the one column somebody may change ─────────────────────────────── */}
      {!canEditAny ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          You can read the map but not change it. Where an office&rsquo;s samples go is decided
          by that office — its head or its lab in-charge — or by a superadmin.
        </p>
      ) : (
        <section className="rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Set destinations for</h2>
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
            <span className="text-xs text-muted-foreground">
              samples received at this office, for <strong>{subProduct.nameEn}</strong>
            </span>
          </div>

          <BulkBar
            parameters={parameters}
            labs={labs}
            capable={capable}
            officeId={officeId}
            pending={pending}
            onAssign={assign}
          />

          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-5 py-2 font-medium">Test</th>
                <th className="px-5 py-2 font-medium">Wing</th>
                <th className="px-5 py-2 font-medium">Sent to</th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((p) => {
                const c = officeId ? cells.get(`${officeId}:${p.id}`) : undefined;
                const opts = optionsFor(p.id);
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2">{p.nameEn}</td>
                    <td className="px-5 py-2 text-xs text-muted-foreground">{p.discipline}</td>
                    <td className="px-5 py-2">
                      {opts.length === 0 ? (
                        <span className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          No open laboratory has declared it can run this test
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={c?.labId ?? ""}
                            disabled={pending || !officeId}
                            onChange={(e) => assign([p.id], Number(e.target.value))}
                            className={`rounded-lg border bg-background px-2 py-1 text-sm ${
                              c?.isPlaceholder
                                ? "border-dashed border-amber-400"
                                : "border-border"
                            }`}
                          >
                            {!c && <option value="">— not routed —</option>}
                            {opts.map((l) => (
                              <option key={l.id} value={l.id}>
                                {labShortName(l.nameEn)} · {officeShortName(l.officeName)}
                              </option>
                            ))}
                          </select>
                          {c?.isPlaceholder && (
                            <span className="text-xs text-amber-700 dark:text-amber-300">
                              stand-in
                            </span>
                          )}
                          {c?.broken && (
                            <span className="text-xs text-red-700 dark:text-red-300">
                              unusable
                            </span>
                          )}
                        </div>
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

/**
 * "Send everything this lab can do to this lab."
 *
 * The realistic first move for an office: its own laboratory takes what it can
 * and the rest is decided one line at a time. Offering it saves ninety
 * dropdowns, and it cannot over-reach — a lab is only offered the tests it has
 * declared, and the service refuses the rest anyway.
 */
function BulkBar({
  parameters, labs, capable, officeId, pending, onAssign,
}: {
  parameters: Parameter[];
  labs: MatrixLab[];
  capable: Set<string>;
  officeId: number | null;
  pending: boolean;
  onAssign: (parameterIds: number[], labId: number) => void;
}) {
  const [labId, setLabId] = useState<number | "">("");
  const chosen = labs.find((l) => l.id === labId);
  const covered = chosen
    ? parameters.filter((p) => capable.has(`${chosen.id}:${p.id}`)).map((p) => p.id)
    : [];

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary/30 px-5 py-3 text-sm">
      <span className="text-muted-foreground">Send everything</span>
      <select
        value={labId}
        onChange={(e) => setLabId(e.target.value ? Number(e.target.value) : "")}
        className="rounded-lg border border-border bg-background px-2 py-1"
      >
        <option value="">choose a laboratory…</option>
        {labs
          .filter((l) => l.isActive)
          .map((l) => (
            <option key={l.id} value={l.id}>
              {labShortName(l.nameEn)} · {officeShortName(l.officeName)}
            </option>
          ))}
      </select>
      <span className="text-muted-foreground">can run to it</span>
      <button
        type="button"
        disabled={pending || !officeId || !covered.length}
        onClick={() => chosen && onAssign(covered, chosen.id)}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
      >
        Apply to {covered.length} test{covered.length === 1 ? "" : "s"}
      </button>
      {chosen && covered.length === 0 && (
        <span className="text-xs text-amber-700 dark:text-amber-300">
          {labShortName(chosen.nameEn)} has not declared any of this package&rsquo;s tests.
        </span>
      )}
    </div>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded px-1.5 py-0.5 ${className}`}>{children}</span>;
}
