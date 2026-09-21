"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Armchair, Check, Loader2, Search, Sparkles } from "lucide-react";
import PageContainer from "@/components/PageContainer";
import type { DeskOption, StaffRow, TitleOption } from "@/lib/job-titles";

/**
 * Desks and designations, side by side, one row per person (D152).
 *
 * **Two pickers, because they are two facts.** The desk is an organogram post —
 * a seat in a section, which is what routes a file (D58) — and the designation
 * is a title from the shared catalogue. They are allowed to differ, and the
 * client's own example is a person with `designationId=5, deskId=6`. A row
 * where they differ in *rank* is flagged rather than refused: an Inspector
 * (Metrology) on an Examiner (Chemical) desk because he knows chemistry is
 * D124's case and is deliberate.
 *
 * **Guessed values say so.** Everything here was matched by a script — the
 * desks by `import:desks`, the designations by `seed:job-titles` — and a guess
 * that does not announce itself is indistinguishable from a decision. Choosing
 * either one clears its flag, which is the whole point of the screen: it is the
 * act that makes "a script guessed this" untrue.
 *
 * **Saved on change, one field at a time.** No submit button and no batch:
 * these are corrections somebody makes while reading down a list, and a form
 * that loses forty of them because the forty-first was invalid is worse than
 * forty round trips.
 */
export default function StaffTitleManager({
  offices,
  officeId,
  rows,
  titles,
  desks,
}: {
  offices: { id: number; nameEn: string }[];
  officeId: number;
  rows: StaffRow[];
  titles: TitleOption[];
  desks: DeskOption[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "guessed" | "differs" | "noDesk">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, number>>({});

  const deskById = useMemo(() => new Map(desks.map((d) => [d.id, d])), [desks]);
  const titleById = useMemo(() => new Map(titles.map((t) => [t.id, t])), [titles]);

  /** Titles grouped by rank, so a 170-row select is navigable. */
  const titleGroups = useMemo(() => {
    const m = new Map<string, TitleOption[]>();
    for (const t of titles) {
      if (!m.has(t.rankLabel)) m.set(t.rankLabel, []);
      m.get(t.rankLabel)!.push(t);
    }
    return [...m.entries()];
  }, [titles]);

  /** Desks grouped by their unit — the section is what the choice is about. */
  const deskGroups = useMemo(() => {
    const m = new Map<string, DeskOption[]>();
    for (const d of desks) {
      if (!m.has(d.unitEn)) m.set(d.unitEn, []);
      m.get(d.unitEn)!.push(d);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [desks]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "guessed" && !(r.designationIsInferred || r.orgPostIsInferred)) return false;
      if (filter === "differs" && !r.rankDiffers) return false;
      if (filter === "noDesk" && r.orgPostId) return false;
      if (!needle) return true;
      return (
        r.nameEn.toLowerCase().includes(needle) ||
        r.id.includes(needle) ||
        (r.recordedEn ?? "").toLowerCase().includes(needle) ||
        (r.nameBn ?? "").includes(needle)
      );
    });
  }, [rows, q, filter]);

  const save = async (employeeId: string, url: string, body: unknown) => {
    setBusy(employeeId);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      setSaved((s) => ({ ...s, [employeeId]: Date.now() }));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const counts = useMemo(
    () => ({
      all: rows.length,
      guessed: rows.filter((r) => r.designationIsInferred || r.orgPostIsInferred).length,
      differs: rows.filter((r) => r.rankDiffers).length,
      noDesk: rows.filter((r) => !r.orgPostId).length,
    }),
    [rows],
  );

  const select =
    "w-full rounded-lg border bg-card px-2 py-1.5 text-sm text-foreground focus:border-primary/40 focus:outline-none";

  return (
    <PageContainer>
      <div className="py-6">
        <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
          <Armchair className="h-5 w-5 text-primary" strokeWidth={1.8} />
          Desks &amp; designations
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Both titles come from one catalogue. The <strong>desk</strong> is an organogram post — a
          seat in a section, which is what routes a file — and the{" "}
          <strong>designation</strong> is what the person is called. They may differ on purpose.
          Everything below was matched by a script until you change it; choosing a value is what
          marks it decided. Posts themselves are edited under{" "}
          <a href="/hr/organogram/manage" className="text-primary hover:underline">
            Manage Structure
          </a>
          .
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <select
            value={officeId}
            onChange={(e) => router.push(`/hr/listing/desks?office=${e.target.value}`)}
            className={`${select} w-auto border-border`}
          >
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nameEn}
              </option>
            ))}
          </select>

          {(
            [
              ["all", `All (${counts.all})`],
              ["guessed", `Guessed (${counts.guessed})`],
              ["differs", `Desk ≠ designation (${counts.differs})`],
              ["noDesk", `No desk (${counts.noDesk})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === k
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}

          <label className="relative ml-auto">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.8}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, id or recorded title"
              className="w-64 rounded-lg border border-border bg-card py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
            />
          </label>
        </div>

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            {error}
          </p>
        )}

        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[68rem] text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Employee</th>
                <th className="w-[26%] px-3 py-2 text-left font-medium text-muted-foreground">
                  Desk <span className="font-normal">(organogram post)</span>
                </th>
                <th className="w-[26%] px-3 py-2 text-left font-medium text-muted-foreground">
                  Designation <span className="font-normal">(title)</span>
                </th>
                <th className="w-28 px-3 py-2 text-left font-medium text-muted-foreground">
                  Recorded as
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((r) => {
                const desk = r.orgPostId ? deskById.get(r.orgPostId) : null;
                const title = r.designationTitleId ? titleById.get(r.designationTitleId) : null;
                const isBusy = busy === r.id;
                return (
                  <tr key={r.id} className={r.rankDiffers ? "bg-amber-500/5" : undefined}>
                    <td className="px-3 py-2 align-top">
                      <span className="font-medium text-foreground">{r.nameEn}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {r.id} · grade {r.grade ?? "—"}
                      </span>
                      {saved[r.id] && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3 w-3" strokeWidth={2} /> saved
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2 align-top">
                      <select
                        disabled={isBusy}
                        value={r.orgPostId ?? ""}
                        onChange={(e) =>
                          save(r.id, `/api/employees/${r.id}/desk`, {
                            orgPostId: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className={`${select} ${
                          r.orgPostIsInferred ? "border-amber-500/40" : "border-border"
                        }`}
                      >
                        <option value="">— no desk —</option>
                        {deskGroups.map(([unit, list]) => (
                          <optgroup key={unit} label={unit}>
                            {list.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.titleEn} — {d.held}/{d.sanctioned} held
                                {d.grade ? ` · g${d.grade}` : ""}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {desk ? desk.unitEn : "no section — no file can reach them"}
                        {r.orgPostIsInferred && desk && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
                            <Sparkles className="h-2.5 w-2.5" strokeWidth={2} /> guessed
                          </span>
                        )}
                      </span>
                    </td>

                    <td className="px-3 py-2 align-top">
                      <select
                        disabled={isBusy}
                        value={r.designationTitleId ?? ""}
                        onChange={(e) =>
                          save(r.id, `/api/employees/${r.id}/designation-title`, {
                            titleId: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className={`${select} ${
                          r.designationIsInferred ? "border-amber-500/40" : "border-border"
                        }`}
                      >
                        <option value="">— none —</option>
                        {titleGroups.map(([rank, list]) => (
                          <optgroup key={rank} label={rank}>
                            {list.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.titleEn}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {title?.titleBn ?? " "}
                        {r.designationIsInferred && title && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
                            <Sparkles className="h-2.5 w-2.5" strokeWidth={2} /> guessed
                          </span>
                        )}
                      </span>
                    </td>

                    <td className="px-3 py-2 align-top text-[11px] text-muted-foreground">
                      {r.recordedEn ?? r.recordedBn ?? "—"}
                      {r.rankDiffers && (
                        <span className="mt-0.5 block text-amber-700 dark:text-amber-400">
                          desk and designation are different ranks
                        </span>
                      )}
                      {isBusy && (
                        <Loader2 className="mt-1 h-3 w-3 animate-spin text-primary" strokeWidth={2} />
                      )}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Nobody matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Showing {shown.length} of {rows.length}. A row shaded amber has a desk and a designation
          of different ranks — sometimes right, and always worth a look.
        </p>
      </div>
    </PageContainer>
  );
}
