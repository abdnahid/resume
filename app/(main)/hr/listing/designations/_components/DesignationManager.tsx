"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowRight, Check, Loader2, Merge, Pencil, Search, Tag, TriangleAlert,
} from "lucide-react";
import PageContainer from "@/components/PageContainer";
import type { DesignationCatalogue, DesignationGroup } from "@/lib/designation-service";

/**
 * Tidying the roster's job titles.
 *
 * **Three worklists, in the order they unblock each other.** Merging the
 * duplicates first shrinks the catalogue; the typo list is what merging cannot
 * find by rule; and the *no post* list is the one that explains the seating
 * problem, because a rank the organogram has no post of is a rank nobody can be
 * seated at.
 *
 * **A rename is shown before it is run.** It rewrites a column that decides
 * where somebody sits in every picker and which rung they hold in the
 * laboratory ladder, so the confirmation names the count and — when it changes
 * — the rank, which is the part that moves files.
 */
export default function DesignationManager({ catalogue }: { catalogue: DesignationCatalogue }) {
  const router = useRouter();
  const [tab, setTab] = useState<"duplicates" | "missing" | "all">("duplicates");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /** The group being renamed, and what to. */
  const [editing, setEditing] = useState<{ from: string; to: string } | null>(null);

  const missingPeople = catalogue.withoutPost.reduce((n, g) => n + g.total, 0);
  const duplicatePeople = catalogue.duplicates.reduce((n, g) => n + g.total, 0);

  const run = async (from: string, toEn: string) => {
    setBusy(from);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/designations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, toEn }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not rename.");
      setDone(
        `${data.changed} ${data.changed === 1 ? "person" : "people"} moved from "${data.from}" to "${data.toEn}"` +
          (data.rankChanged ? ` — rank changed from ${data.rankBefore} to ${data.rankAfter}.` : "."),
      );
      setEditing(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const shown: DesignationGroup[] = useMemo(() => {
    const base =
      tab === "duplicates" ? catalogue.duplicates : tab === "missing" ? catalogue.withoutPost : catalogue.groups;
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter(
      (g) =>
        g.primary.toLowerCase().includes(needle) ||
        g.variants.some((v) => v.value.toLowerCase().includes(needle)),
    );
  }, [tab, q, catalogue]);

  const Stat = ({ label, value, tone }: { label: string; value: string; tone?: "warn" }) => (
    <div
      className={`rounded-xl border p-4 ${
        tone === "warn" ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card"
      }`}
    >
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );

  return (
    <PageContainer>
      <div className="py-6">
        <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
          <Tag className="h-5 w-5 text-primary" strokeWidth={1.8} />
          Employee designations
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          The title each employee is recorded under. It decides their rank in every picker and
          their rung in the laboratory ladder, so a variant spelling splits one job into two.
          Organogram posts are maintained separately, under{" "}
          <a href="/hr/organogram/manage" className="text-primary hover:underline">
            Manage Structure
          </a>
          .
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Stat label="distinct designations" value={String(catalogue.distinct)} />
          <Stat label="active employees" value={String(catalogue.totalEmployees)} />
          <Stat
            label={`people in ${catalogue.duplicates.length} duplicated groups`}
            value={String(duplicatePeople)}
            tone={catalogue.duplicates.length ? "warn" : undefined}
          />
          <Stat
            label="people whose rank has no post"
            value={String(missingPeople)}
            tone={missingPeople ? "warn" : undefined}
          />
        </div>

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            {error}
          </p>
        )}
        {done && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
            <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            {done}
          </p>
        )}

        {catalogue.typos.length > 0 && tab === "duplicates" && (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={1.8} />
              Possible misspellings ({catalogue.typos.length})
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Near-identical titles that no rule can merge automatically. Check before acting —
              two similar words can be two real jobs.
            </p>
            <ul className="mt-2 space-y-1.5">
              {catalogue.typos.map((t) => (
                <li key={`${t.a}|${t.b}`} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-foreground">
                    {t.a} <span className="text-muted-foreground">({t.counts[0]})</span>
                  </span>
                  <span className="text-muted-foreground">~</span>
                  <span className="text-foreground">
                    {t.b} <span className="text-muted-foreground">({t.counts[1]})</span>
                  </span>
                  <button
                    onClick={() => setEditing({ from: t.b, to: t.a })}
                    className="ml-auto rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    Merge &ldquo;{t.b}&rdquo; into &ldquo;{t.a}&rdquo;
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(
            [
              ["duplicates", `Duplicates (${catalogue.duplicates.length})`],
              ["missing", `No post of this rank (${catalogue.withoutPost.length})`],
              ["all", `All (${catalogue.groups.length})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === k
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
          <label className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a title"
              className="w-56 rounded-lg border border-border bg-card py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
            />
          </label>
        </div>

        {tab === "missing" && (
          <p className="mt-3 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            These ranks have holders but no organogram post anywhere, so no correct seat exists for
            them and <code className="font-mono">import:desks</code> fell back to matching on grade
            alone — which is where the guessed seats came from. Either create the post under{" "}
            <a href="/hr/organogram/manage" className="text-primary hover:underline">
              Manage Structure
            </a>
            , or merge the designation into one the chart already has.
          </p>
        )}

        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Designation</th>
                <th className="w-20 px-3 py-2 text-left font-medium text-muted-foreground">People</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Variants</th>
                <th className="w-24 px-3 py-2 text-left font-medium text-muted-foreground">Grade</th>
                <th className="w-28 px-3 py-2 text-left font-medium text-muted-foreground">Post?</th>
                <th className="w-24 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((g) => (
                <tr key={g.key} className="align-top">
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground">{g.primary}</span>
                    {g.rankLabel !== g.primary && (
                      <span className="block text-xs text-muted-foreground">rank {g.rankLabel}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-foreground">{g.total}</td>
                  <td className="px-3 py-2">
                    {g.variants.length === 1 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {g.variants
                          .filter((v) => v.value !== g.primary)
                          .map((v) => (
                            <li key={v.value} className="flex flex-wrap items-center gap-1.5">
                              <span className="text-foreground">{v.value}</span>
                              <span className="text-xs text-muted-foreground">({v.count})</span>
                              <button
                                disabled={busy !== null}
                                onClick={() => run(v.value, g.primary)}
                                className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
                              >
                                {busy === v.value ? (
                                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                                ) : (
                                  <Merge className="h-3 w-3" strokeWidth={2} />
                                )}
                                merge
                              </button>
                            </li>
                          ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {g.variants[0].grades.join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {g.hasPost ? (
                      <span className="text-xs text-muted-foreground">yes</span>
                    ) : (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                        no post
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setEditing({ from: g.primary, to: g.primary })}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      <Pencil className="h-3 w-3" strokeWidth={2} />
                      rename
                    </button>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Nothing here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
              <h2 className="font-display text-lg font-medium text-foreground">Rename a designation</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Every active employee recorded as{" "}
                <span className="font-medium text-foreground">{editing.from}</span> takes the new
                title. If it already exists the two merge.
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="rounded-lg bg-muted px-2 py-1.5 text-foreground">{editing.from}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                <input
                  autoFocus
                  value={editing.to}
                  onChange={(e) => setEditing({ ...editing, to: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-foreground focus:border-primary/40 focus:outline-none"
                />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground"
                >
                  Cancel
                </button>
                <button
                  disabled={busy !== null || !editing.to.trim() || editing.to === editing.from}
                  onClick={() => run(editing.from, editing.to)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium text-primary disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : null}
                  Rename
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
