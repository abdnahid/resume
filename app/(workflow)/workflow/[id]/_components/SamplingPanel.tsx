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
  officeId: number;
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

export type OpenChoice = {
  applicationSubProductId: number;
  subProductName: string;
  parameterId: number;
  parameterName: string;
  offices: { officeId: number; officeName: string; manner: string }[];
};

export default function SamplingPanel({
  applicationId,
  cells,
  boxes,
  problems,
  openChoices,
  committed,
  canEdit,
}: {
  applicationId: number;
  cells: Cell[];
  boxes: { labId: number; labName: string; sampleCount: number | null }[];
  problems: string[];
  openChoices: OpenChoice[];
  committed: Committed | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      cells.map((c) => [
        `${c.applicationSubProductId}:${c.officeId}`,
        c.samplesPerVariant === null ? "" : String(c.samplesPerVariant),
      ]),
    ),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  /**
   * The typed value for a cell, falling back to what the server sent.
   *
   * `useState`'s initialiser runs once, so a cell that appears *after* mount —
   * which is exactly what happens when the officer records a sub-product he
   * found, since it brings its own lab — has no entry in `draft`. Reading it
   * directly gave `undefined.trim()` and crashed the render, while the row had
   * already been written; a full page reload then looked fine, which is the
   * worst kind of bug to be told about. Falling back to the prop keeps the two
   * in step without a `useEffect` that would fight the officer's typing.
   */
  const valueFor = (c: Cell) => {
    const key = `${c.applicationSubProductId}:${c.officeId}`;
    return draft[key] ?? (c.samplesPerVariant === null ? "" : String(c.samplesPerVariant));
  };

  // The running total, recomputed as he types — the arithmetic is the screen's
  // job, not his.
  const live = useMemo(() => {
    const perLab = new Map<number, number | null>();
    let total: number | null = 0;
    for (const c of cells) {
      const raw = valueFor(c);
      const n = raw.trim() === "" ? null : Number(raw);
      const count = n !== null && Number.isInteger(n) && n > 0 ? n * c.variantCount : null;
      const prev = perLab.get(c.officeId);
      perLab.set(
        c.officeId,
        count === null || prev === null ? (prev === undefined && count !== null ? count : null) : (prev ?? 0) + count,
      );
      total = count === null || total === null ? null : total + count;
    }
    return { perLab, total };
    // `valueFor` closes over `draft`, which is in the dependency list.
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
          ? "Where only one office can run a test, it is placed for you. Where several can, you choose. What nobody can work out is how many specimens each wants — ask them, then type it."
          : "The visiting officer plans this and seals the samples. You are seeing it as it stands."}
      </p>

      {openChoices.length > 0 && <DestinationPicker
        applicationId={applicationId}
        choices={openChoices}
        canEdit={canEdit}
      />}

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
                const key = `${c.applicationSubProductId}:${c.officeId}`;
                const raw = valueFor(c);
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
                                  officeId: c.officeId,
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


/**
 * The tests several offices can run, and nobody has placed.
 *
 * Capability says who *can*; a standing preference says who this office
 * normally picks. Where neither settles it, the officer chooses — he is the one
 * who knows that Khulna is three days behind this month (D125). Only offices
 * that have declared the test are offered, and the service refuses the rest.
 *
 * It sits above the grid rather than inside it because a cell cannot exist for
 * a test with no destination: the box it would belong to is exactly what is
 * being decided.
 */
function DestinationPicker({
  applicationId, choices, canEdit,
}: {
  applicationId: number;
  choices: OpenChoice[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(c: OpenChoice, officeId: number) {
    setBusy(c.parameterId);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/applications/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "parameter-destination",
          applicationSubProductId: c.applicationSubProductId,
          parameterId: c.parameterId,
          officeId,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) { setError(json.error ?? "That did not save."); return; }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/40">
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        {choices.length} test{choices.length === 1 ? "" : "s"} can be run at more than one
        office. {canEdit ? "Choose where each goes." : "The visiting officer chooses where each goes."}
      </p>
      <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
        Nothing can be sealed until every test has a destination — a specimen with nowhere to go
        is a jar nobody can account for.
      </p>

      {error && (
        <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {choices.map((c) => (
          <li
            key={`${c.applicationSubProductId}:${c.parameterId}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-foreground">{c.parameterName}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {c.subProductName}
              </span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {c.offices.map((o) => (
                <button
                  key={o.officeId}
                  type="button"
                  disabled={!canEdit || busy === c.parameterId}
                  onClick={() => choose(c, o.officeId)}
                  title={
                    o.manner === "third_party"
                      ? `${o.officeName} covers this by sending it to an accredited outside laboratory`
                      : `${o.officeName} runs this on its own bench`
                  }
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-40"
                >
                  {o.officeName.split(",").pop()?.trim()}
                  {o.manner === "third_party" && (
                    <span className="ml-1 text-[10px] text-muted-foreground">sent out</span>
                  )}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
