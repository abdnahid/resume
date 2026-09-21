"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Armchair, Check, Loader2, Search } from "lucide-react";
import PageContainer from "@/components/PageContainer";
import type { DeskProposal, ProposalConfidence, ProposalSummary } from "@/lib/desk-proposal";

/**
 * Reviewing proposed desk placements before they are written.
 *
 * **Confidence drives the default, and only the default.** `exact` rows — one
 * vacant post of the person's own rank and grade, in their own office — start
 * ticked, because checking those one at a time is the work the screen exists to
 * avoid. Everything else starts unticked and says why: a grade mismatch is a
 * judgement, several qualifying posts is a judgement, and no post of that rank
 * is not a seating problem at all but a gap in the organogram.
 *
 * **An ambiguous row is resolvable in place.** Picking one of its options ticks
 * it, so the screen does not send the administrator to the per-person picker
 * for the commonest case of all — thirteen vacant Deputy Director posts and a
 * Deputy Director to seat.
 */
const LABELS: Record<ProposalConfidence, string> = {
  exact: "Exact",
  rank: "Rank only",
  ambiguous: "Ambiguous",
  none: "No post",
};

const TONES: Record<ProposalConfidence, string> = {
  exact: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  rank: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  ambiguous: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  none: "bg-muted text-muted-foreground",
};

export default function AssignReview({
  offices,
  officeId,
  summary,
}: {
  offices: { id: number; nameEn: string }[];
  officeId: number | null;
  summary: ProposalSummary;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<ProposalConfidence>("exact");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ applied: number; failed: { employeeId: string; error: string }[] } | null>(null);

  /** employeeId → the post chosen for them. Seeded from the exact proposals. */
  const [picked, setPicked] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      summary.proposals
        .filter((p) => p.confidence === "exact" && p.proposed)
        .map((p) => [p.employeeId, p.proposed!.id]),
    ),
  );

  const rows: DeskProposal[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return summary.proposals
      .filter((p) => p.confidence === tab)
      .filter(
        (p) =>
          !needle ||
          p.name.toLowerCase().includes(needle) ||
          p.employeeId.includes(needle) ||
          (p.recorded ?? "").toLowerCase().includes(needle),
      );
  }, [summary.proposals, tab, q]);

  const chosen = Object.entries(picked).filter(([, v]) => v > 0);

  const apply = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/desks/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placements: chosen.map(([employeeId, orgPostId]) => ({ employeeId, orgPostId })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not apply.");
      setResult({ applied: data.applied.length, failed: data.failed });
      setPicked({});
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <div className="py-6">
        <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
          <Armchair className="h-5 w-5 text-primary" strokeWidth={1.8} />
          Bulk desk assignment
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Proposed seats for everybody who holds none, and for everybody whose guessed seat
          disagrees in rank with what HR recorded. Nothing is written until you apply. A confirmed
          seat is never touched — correcting one is{" "}
          <a href="/hr/listing/desks" className="text-primary hover:underline">
            the per-person picker
          </a>
          .
        </p>

        <form className="mt-4 flex flex-wrap items-center gap-2">
          <select
            name="office"
            defaultValue={officeId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              router.push(`/hr/listing/desks/assign${v ? `?office=${v}` : ""}`);
            }}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:border-primary/40 focus:outline-none"
          >
            <option value="">Every office</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nameEn}
              </option>
            ))}
          </select>
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, id or designation"
              className="w-64 rounded-lg border border-border bg-card py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
            />
          </label>
        </form>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {(Object.keys(LABELS) as ProposalConfidence[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                tab === k ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <p className="text-2xl font-semibold text-foreground">{summary.counts[k]}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{LABELS[k]}</p>
            </button>
          ))}
        </div>

        {tab === "none" && summary.missingRanks.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={1.8} />
              The organogram has no post of these ranks
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Nobody of these ranks can be seated until the post exists. Create it under{" "}
              <a href="/hr/organogram/manage" className="text-primary hover:underline">
                Manage Structure
              </a>
              , or give the person a designation the chart already carries under{" "}
              <a href="/hr/listing/desks" className="text-primary hover:underline">
                Desks &amp; Designations
              </a>
              .
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {summary.missingRanks.map((m) => (
                <li
                  key={m.rank}
                  className="rounded-full bg-card px-2 py-1 text-xs text-foreground ring-1 ring-border"
                >
                  {m.rank} <span className="text-muted-foreground">×{m.people}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            {error}
          </p>
        )}
        {result && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
            <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4" strokeWidth={1.8} />
              {result.applied} seated.
              {result.failed.length > 0 && ` ${result.failed.length} refused:`}
            </p>
            {result.failed.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                {result.failed.map((f) => (
                  <li key={f.employeeId}>
                    <span className="font-mono">{f.employeeId}</span> — {f.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Employee</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Recorded as</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Now on</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Proposed seat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr key={p.employeeId} className="align-top">
                  <td className="px-3 py-2">
                    {p.confidence !== "none" && (
                      <input
                        type="checkbox"
                        checked={!!picked[p.employeeId]}
                        disabled={!p.proposed && !picked[p.employeeId]}
                        onChange={(e) =>
                          setPicked((s) => {
                            const next = { ...s };
                            if (e.target.checked && p.proposed) next[p.employeeId] = p.proposed.id;
                            else delete next[p.employeeId];
                            return next;
                          })
                        }
                        className="mt-1 h-4 w-4 accent-[var(--primary)]"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {p.employeeId} · {p.officeName}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-foreground">{p.recorded ?? "—"}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      grade {p.grade ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.current ? (
                      <>
                        <span className="text-foreground">{p.current.nameEn}</span>
                        <span className="block text-muted-foreground">{p.current.unitEn}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">no seat</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[p.confidence]}`}>
                      {LABELS[p.confidence]}
                    </span>
                    {p.confidence === "ambiguous" ? (
                      <select
                        value={picked[p.employeeId] ?? ""}
                        onChange={(e) =>
                          setPicked((s) => {
                            const next = { ...s };
                            const v = Number(e.target.value);
                            if (v) next[p.employeeId] = v;
                            else delete next[p.employeeId];
                            return next;
                          })
                        }
                        className="mt-1 block w-full max-w-xs rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground focus:border-primary/40 focus:outline-none"
                      >
                        <option value="">Choose a section…</option>
                        {p.options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.nameEn} · {o.unitEn} ({o.vacancies} free)
                          </option>
                        ))}
                      </select>
                    ) : p.proposed ? (
                      <span className="mt-1 block text-xs">
                        <span className="text-foreground">{p.proposed.nameEn}</span>
                        <span className="block text-muted-foreground">{p.proposed.unitEn}</span>
                      </span>
                    ) : null}
                    <span className="mt-1 block text-[11px] text-muted-foreground">{p.reason}</span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Nothing in this group.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* The bar names the count rather than saying "apply", because the
            number is the thing worth checking before a batch write. */}
        <div className="sticky bottom-4 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{chosen.length}</span> placement
            {chosen.length === 1 ? "" : "s"} selected, across every group.
          </p>
          <button
            disabled={busy || chosen.length === 0}
            onClick={apply}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Check className="h-3.5 w-3.5" strokeWidth={2} />}
            Seat {chosen.length || ""} {chosen.length === 1 ? "person" : "people"}
          </button>
        </div>
      </div>
    </PageContainer>
  );
}
