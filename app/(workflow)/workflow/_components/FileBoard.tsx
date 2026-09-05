"use client";

import { useMemo, useState } from "react";
import { Building2, FileText, Inbox, MapPin } from "lucide-react";
import { ReceiveButton, PassPanel } from "./FileActions";
import type { Desk } from "@/lib/workflow/chain";

/**
 * The desk a file arrives at, as a board rather than three fixed lists.
 *
 * An office head wants to ask "what is waiting", "what is with me", "what is
 * sitting at the test fee" — questions about *state*, which the previous
 * three-section page could not answer without reading every row. So the counts
 * are tiles, the tiles are the filter, and the list below is whatever is
 * selected.
 *
 * Filtering is client-side on purpose: the rows are already loaded, an office
 * holds tens of files rather than thousands, and a round trip per tile would
 * make the board feel slower than the page it replaced.
 */

export type BoardRow = {
  id: number;
  applicationNo: string | null;
  state: string;
  stateLabel: string;
  submittedAt: string | null;
  organizationName: string;
  factoryName: string;
  district: string;
  productSerial: number | null;
  productName: string | null;
  subProductCount: number;
  holderName: string | null;
  holderDesignation: string | null;
  /** Which list this row belongs to from the viewer's point of view. */
  bucket: "mine" | "unclaimed" | "working";
};

const BUCKETS = [
  { key: "mine", label: "With you", blurb: "You are holding these." },
  { key: "unclaimed", label: "Waiting to be received", blurb: "Submitted, not yet picked up." },
  { key: "working", label: "Being processed", blurb: "Held by someone in the office." },
] as const;

type BucketKey = (typeof BUCKETS)[number]["key"];

export default function FileBoard({
  rows,
  down,
  up,
  canReceive,
}: {
  rows: BoardRow[];
  down: Desk[];
  up: Desk[];
  canReceive: boolean;
}) {
  const [bucket, setBucket] = useState<BucketKey | "all">("all");
  const [state, setState] = useState<string | "all">("all");

  const inBucket = useMemo(
    () => (bucket === "all" ? rows : rows.filter((r) => r.bucket === bucket)),
    [rows, bucket],
  );

  // States are counted within the chosen bucket, so a count never promises rows
  // the current filter cannot show.
  const states = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const r of inBucket) {
      if (!m.has(r.state)) m.set(r.state, { label: r.stateLabel, n: 0 });
      m.get(r.state)!.n++;
    }
    return [...m].sort((a, b) => b[1].n - a[1].n || a[1].label.localeCompare(b[1].label));
  }, [inBucket]);

  const shown = state === "all" ? inBucket : inBucket.filter((r) => r.state === state);

  const count = (k: BucketKey | "all") =>
    k === "all" ? rows.length : rows.filter((r) => r.bucket === k).length;

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label="All files"
          n={count("all")}
          on={bucket === "all"}
          onClick={() => { setBucket("all"); setState("all"); }}
        />
        {BUCKETS.map((b) => (
          <Tile
            key={b.key}
            label={b.label}
            blurb={b.blurb}
            n={count(b.key)}
            on={bucket === b.key}
            onClick={() => { setBucket(b.key); setState("all"); }}
          />
        ))}
      </div>

      {states.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Stage
          </span>
          <Chip label={`All (${inBucket.length})`} on={state === "all"} onClick={() => setState("all")} />
          {states.map(([s, v]) => (
            <Chip key={s} label={`${v.label} (${v.n})`} on={state === s} onClick={() => setState(s)} />
          ))}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {shown.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Nothing here.
          </p>
        ) : (
          shown.map((a) => (
            <article
              key={a.id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {a.applicationNo ?? `#${a.id}`}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    {a.stateLabel}
                  </span>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
                  {a.organizationName}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.8} />
                    {a.factoryName}
                    {a.district ? `, ${a.district}` : ""}
                  </span>
                  {a.productName && (
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="h-3 w-3 shrink-0" strokeWidth={1.8} />
                      #{a.productSerial} {a.productName}
                      {a.subProductCount > 0 &&
                        ` · ${a.subProductCount} sub-product${a.subProductCount === 1 ? "" : "s"}`}
                    </span>
                  )}
                  {a.submittedAt && <span>submitted {a.submittedAt}</span>}
                </p>
              </div>

              <div className="shrink-0 sm:text-right">
                {a.bucket === "mine" ? (
                  <PassPanel applicationId={a.id} down={down} up={up} />
                ) : a.bucket === "unclaimed" && canReceive ? (
                  <ReceiveButton applicationId={a.id} />
                ) : a.holderName ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">with</span>{" "}
                    <span className="font-medium text-foreground">{a.holderName}</span>
                    {a.holderDesignation && (
                      <span className="block text-xs text-muted-foreground">
                        {a.holderDesignation}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Inbox className="h-3.5 w-3.5" strokeWidth={1.8} />
                    unclaimed
                  </p>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </>
  );
}

function Tile({
  label, blurb, n, on, onClick,
}: {
  label: string; blurb?: string; n: number; on: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        on ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <span className="block font-display text-2xl font-medium text-foreground">{n}</span>
      <span className="mt-0.5 block text-sm font-medium text-foreground">{label}</span>
      {blurb && <span className="mt-0.5 block text-xs text-muted-foreground">{blurb}</span>}
    </button>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
