"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Boxes, Loader2, Lock, QrCode, Save } from "lucide-react";

/**
 * The FDO's sampling plan (D87).
 *
 * **Destinations are derived; counts are entered** (D69). The grid is not a
 * form the officer fills from nothing — every row is already resolved from the
 * routing map, so he cannot forget a lab or prepare a box nobody needs. The one
 * unknown is how many specimens each lab wants, which turns on sample quantity
 * and destructive testing: reference data BSTI has not collected. So he phones
 * the lab and types a number, and it is remembered for next time.
 *
 * **A remembered figure is shown as a suggestion, never filled in.** It was
 * agreed for a different consignment of the same sub-product; carrying it in
 * silently would make last month's quantity this month's decision.
 *
 * Sealing is irreversible and the panel says so: `commitSampling()` refuses to
 * run twice, because the specimens are about to leave in the applicant's hands.
 */

export type Cell = {
  applicationSubProductId: number;
  labId: number;
  subProductName: string;
  labName: string;
  labDiscipline: string;
  parameterNames: string[];
  variantCount: number;
  samplesPerVariant: number | null;
  sampleCount: number | null;
  routeIsPlaceholder: boolean;
  remembered: number | null;
};

export type Committed = {
  consignments: {
    id: number;
    code: string;
    sealNo: string | null;
    state: string;
    labName: string;
    specimens: {
      ref: string;
      specimenNo: number;
      subProductName: string;
      brand: string;
      variant: string | null;
      size: string;
    }[];
  }[];
};

export default function SamplingPanel({
  applicationId,
  cells,
  boxes,
  problems,
  committed,
  canEdit,
}: {
  applicationId: number;
  cells: Cell[];
  boxes: { labId: number; labName: string; sampleCount: number | null }[];
  problems: string[];
  committed: Committed | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      cells.map((c) => [
        `${c.applicationSubProductId}:${c.labId}`,
        c.samplesPerVariant === null ? "" : String(c.samplesPerVariant),
      ]),
    ),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // The running total, recomputed as he types — the arithmetic is the screen's
  // job, not his.
  const live = useMemo(() => {
    const perLab = new Map<number, number | null>();
    let total: number | null = 0;
    for (const c of cells) {
      const raw = draft[`${c.applicationSubProductId}:${c.labId}`];
      const n = raw.trim() === "" ? null : Number(raw);
      const count = n !== null && Number.isInteger(n) && n > 0 ? n * c.variantCount : null;
      const prev = perLab.get(c.labId);
      perLab.set(
        c.labId,
        count === null || prev === null ? (prev === undefined && count !== null ? count : null) : (prev ?? 0) + count,
      );
      total = count === null || total === null ? null : total + count;
    }
    return { perLab, total };
  }, [cells, draft]);

  async function send(action: string, extra: Record<string, unknown> = {}, key = action) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/applications/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "That did not work.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  // ── Sealed: the plan is history and the labels are the work ──────────────
  if (committed) {
    const total = committed.consignments.reduce((n, c) => n + c.specimens.length, 0);
    return (
      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-medium text-foreground">
          <Lock className="h-4 w-4 text-primary" strokeWidth={2} />
          Samples sealed
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} {total === 1 ? "specimen" : "specimens"} in{" "}
          {committed.consignments.length}{" "}
          {committed.consignments.length === 1 ? "box" : "boxes"}. The applicant carries each box to
          that lab&rsquo;s own counter; only the lab opens it.
        </p>

        <ul className="mt-3 space-y-2">
          {committed.consignments.map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-medium text-foreground">{c.labName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                box <span className="font-mono">{c.code}</span>
                {c.sealNo && (
                  <>
                    {" · seal "}
                    <span className="font-mono">{c.sealNo}</span>
                  </>
                )}
                {" · "}
                {c.specimens.length} {c.specimens.length === 1 ? "specimen" : "specimens"} ·{" "}
                {c.state.replace(/_/g, " ")}
              </p>
            </li>
          ))}
        </ul>

        <a
          href={`/workflow/${applicationId}/labels`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-card px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
        >
          <QrCode className="h-3.5 w-3.5" strokeWidth={1.8} />
          Print the labels
        </a>
      </section>
    );
  }

  const ready = problems.length === 0 && live.total !== null && live.total > 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-medium text-foreground">
        <Boxes className="h-4 w-4 text-primary" strokeWidth={2} />
        Sampling plan
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {canEdit
          ? "The labs and the tests are worked out from the routing map. What only you can say is how many specimens each lab wants — ask them, then type it."
          : "The visiting officer plans this and seals the samples. You are seeing it as it stands."}
      </p>

      {cells.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No sub-product on this file resolves to a laboratory yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-3 font-medium text-muted-foreground">Sub-product</th>
                <th className="pb-2 pr-3 font-medium text-muted-foreground">Laboratory</th>
                <th className="pb-2 pr-3 font-medium text-muted-foreground">Tests</th>
                <th className="pb-2 pr-3 text-right font-medium text-muted-foreground">Variants</th>
                <th className="pb-2 pr-3 font-medium text-muted-foreground">Per variant</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Specimens</th>
              </tr>
            </thead>
            <tbody>
              {cells.map((c) => {
                const key = `${c.applicationSubProductId}:${c.labId}`;
                const raw = draft[key];
                const n = raw.trim() === "" ? null : Number(raw);
                const count = n !== null && Number.isInteger(n) && n > 0 ? n * c.variantCount : null;
                return (
                  <tr key={key} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3">
                      <span className="text-foreground">{c.subProductName}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="text-foreground">{c.labName}</span>
                      <span className="block text-xs text-muted-foreground">{c.labDiscipline}</span>
                      {c.routeIsPlaceholder && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                          seeded route, not this office&rsquo;s decision
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {c.parameterNames.length} —{" "}
                      {c.parameterNames.slice(0, 3).join(", ")}
                      {c.parameterNames.length > 3 && `, +${c.parameterNames.length - 3} more`}
                    </td>
                    <td className="py-2 pr-3 text-right text-foreground">{c.variantCount}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          value={raw}
                          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                          inputMode="numeric"
                          disabled={!canEdit}
                          className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
                        />
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              send(
                                "sample-count",
                                {
                                  applicationSubProductId: c.applicationSubProductId,
                                  labId: c.labId,
                                  samplesPerVariant: Number(raw),
                                },
                                key,
                              )
                            }
                            disabled={busy !== null || n === null}
                            aria-label="Save this count"
                            className="cursor-pointer rounded-lg border border-border p-1 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
                          >
                            {busy === key ? (
                              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                            ) : (
                              <Save className="h-3 w-3" strokeWidth={2} />
                            )}
                          </button>
                        )}
                      </div>
                      {c.remembered !== null && c.samplesPerVariant === null && (
                        // A suggestion, not a default: it was agreed for a
                        // different consignment of the same sub-product.
                        <button
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, [key]: String(c.remembered) }))}
                          className="mt-1 block cursor-pointer text-[11px] text-primary underline-offset-2 hover:underline"
                        >
                          {c.remembered} last time — use it
                        </button>
                      )}
                    </td>
                    <td className="py-2 text-right font-medium text-foreground">{count ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td colSpan={5} className="pt-2 text-right text-muted-foreground">
                  {boxes.length} {boxes.length === 1 ? "box" : "boxes"}, one per laboratory · total
                </td>
                <td className="pt-2 text-right font-display text-lg font-medium text-foreground">
                  {live.total ?? "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {problems.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-xl bg-amber-500/5 p-3 text-xs text-muted-foreground">
          {problems.map((p) => (
            <li key={p}>• {p}</li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {canEdit && cells.length > 0 && (
        <div className="mt-4">
          {confirming ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="text-sm text-foreground">
                Sealing writes the specimens, the boxes and their codes, and cannot
                be undone from here — the jars go into the applicant&rsquo;s hands.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => send("seal-samples")}
                  disabled={busy !== null}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy === "seal-samples" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  Yes, seal them
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground"
                >
                  Not yet
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!ready}
              title={ready ? undefined : "Every cell needs a saved count first."}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Lock className="h-3.5 w-3.5" strokeWidth={2} />
              Seal and generate the tokens
            </button>
          )}
        </div>
      )}
    </section>
  );
}
