"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Armchair, Check, Loader2, Search, Sparkles } from "lucide-react";
import PageContainer from "@/components/PageContainer";
// **The Prisma-free half.** Importing these from `lib/desks-designations.ts`
// would pull `pg` into the browser bundle — see `lib/desks-view.ts`.
import {
  NO_DESK_GROUP,
  PAYLOAD_SHAPE,
  STAFF_GROUP,
  staffSection,
  type DesignationOption,
  type DeskOption,
  type StaffRow,
} from "@/lib/desks-view";

type Payload = { rows: StaffRow[]; desks: DeskOption[]; designations: DesignationOption[] };

/**
 * How one seat reads in the picker.
 *
 * **Since the establishment was unpacked (D156) two rows can share a title**,
 * so a held count no longer distinguishes them — *Field Officer (CM) — 2/2
 * held* twice told you nothing about which one was free. A seat is named by its
 * number and, above all, by **who is sitting on it**: that is the fact somebody
 * choosing a desk actually needs.
 */
function deskLabel(d: DeskOption): string {
  const seat = `${d.titleEn}${d.seatNo > 1 ? ` #${d.seatNo}` : ""}`;
  const who = d.heldBy ? `held by ${d.heldBy}` : "vacant";
  const grade = d.grade ? ` · g${d.grade}` : "";
  return `${seat} — ${who}${grade}${d.isSanctioned === false ? " · outside organogram" : ""}`;
}

/**
 * Desks and designations, one row per person (D153/D154).
 *
 * **One designation, any number of desks.** The designation is a single select
 * from the sanctioned catalogue; the desks are a list, one marked primary and
 * the rest additional charges. That is the client's model and it is what
 * `EmployeeDesk` holds.
 *
 * **Both lists are scoped.** Desks are this office's organogram and nothing
 * else — *"When I am setting Khulna office employees, I only want to pick from
 * Khulna organogram desk"* — and designations are grouped by wing for officers
 * (grades 1–9) with everybody else under one Staff heading, because among 88
 * officer titles the wing is the distinction that matters and among 42 clerical
 * ones it means nothing.
 *
 * **Cached on the client only** (D154, amended). TanStack Query holds the
 * office's payload so switching offices and filters is instant, and a mutation
 * invalidates and refetches it. The server-side cache was removed after it
 * served a stale payload through a reload — see `lib/hr-cache.ts`; on a screen
 * whose purpose is correcting data, a write that appears not to have happened
 * costs more than three queries save.
 */
export default function StaffTitleManager({
  offices,
  officeId,
  initial,
}: {
  offices: { id: number; nameEn: string }[];
  officeId: number;
  initial: Payload;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "guessed" | "differs" | "noDesk" | "multi">("all");
  /** The row a save failed on, and why — shown on the row, not only at the top. */
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null);
  /**
   * What a save accepted but wants noticed — over strength, a grade
   * mismatch. The client's rule: posting more people to a desk than it
   * sanctions is ordinary, and the system should *say so*, not refuse.
   */
  const [notes, setNotes] = useState<{ id: string; messages: string[] } | null>(null);

  // The shape version travels in the key for the same reason it does on the
  // server: a payload cached before a field existed must not be handed to code
  // that expects it. One definition, shared — see `PAYLOAD_SHAPE`.
  const key = ["hr-desks", PAYLOAD_SHAPE, officeId] as const;
  const { data } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Payload> => {
      const res = await fetch(`/api/hr/desks?office=${officeId}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not load.");
      return res.json();
    },
    initialData: initial,
  });

  const { rows, desks, designations } = data;

  const mutate = useMutation({
    mutationFn: async (v: { url: string; method: "PATCH"; body: unknown }) => {
      const res = await fetch(v.url, {
        method: v.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v.body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save.");
      return json;
    },
    onMutate: () => {
      setFailed(null);
      setNotes(null);
    },
    onError: (e: Error, v) => {
      // **On the row.** A refusal about somebody 300 rows down is invisible in
      // a banner at the top of the page — and the commonest one here names the
      // people already on the desk, which is exactly what the reader needs to
      // see beside the select they just used.
      const id = v.url.split("/")[3] ?? "";
      setFailed({ id, message: e.message });
    },
    onSuccess: (data, v) => {
      setFailed(null);
      const messages: string[] = Array.isArray(data?.warnings) ? data.warnings : [];
      setNotes(messages.length ? { id: v.url.split("/")[3] ?? "", messages } : null);
      // **Refetch, and wait for it.** `invalidateQueries` alone marks the entry
      // stale; refetching is what replaces the rows the table is rendering, so
      // a desk that has just changed shows its new value rather than the one
      // the save superseded.
      qc.invalidateQueries({ queryKey: key, refetchType: "all" });
      router.refresh();
    },
  });

  /** Designations grouped by wing, with Staff last — the client's ordering. */
  const designationGroups = useMemo(() => {
    const m = new Map<string, DesignationOption[]>();
    for (const d of designations) {
      if (!m.has(d.group)) m.set(d.group, []);
      m.get(d.group)!.push(d);
    }
    return [...m.entries()].sort((a, b) =>
      a[0] === STAFF_GROUP ? 1 : b[0] === STAFF_GROUP ? -1 : a[0].localeCompare(b[0]),
    );
  }, [designations]);

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
      if (filter === "guessed" && !(r.designationIsInferred || r.deskIsInferred)) return false;
      if (filter === "differs" && !r.rankDiffers) return false;
      if (filter === "noDesk" && r.desks.length) return false;
      if (filter === "multi" && r.desks.length < 2) return false;
      if (!needle) return true;
      return (
        r.nameEn.toLowerCase().includes(needle) ||
        r.id.includes(needle) ||
        (r.recordedEn ?? "").toLowerCase().includes(needle) ||
        (r.nameBn ?? "").includes(needle)
      );
    });
  }, [rows, q, filter]);

  /**
   * The roster, by the organogram's own sections, ordered by grade (D158).
   *
   * **The chart's order, not the alphabet.** Sections follow `OrgUnit.sortOrder`
   * — the order somebody arranged the organogram in — so the page reads the way
   * the chart does. Inside a section, most senior grade first.
   *
   * **Grades 10–20 are one Staff group** (the client's rule), and **anybody
   * with no desk is the worklist**, so they sit under their own heading last
   * rather than scattered through sections they do not belong to yet.
   */
  const sections = useMemo(() => {
    const byName = new Map<string, { list: StaffRow[]; order: number }>();
    for (const r of shown) {
      const k = staffSection(r);
      const g = byName.get(k) ?? { list: [], order: r.sectionOrder };
      g.list.push(r);
      g.order = Math.min(g.order, r.sectionOrder);
      byName.set(k, g);
    }
    const grade = (r: StaffRow) => (r.grade ? Number(r.grade) : 99);
    for (const g of byName.values()) {
      g.list.sort((a, b) => grade(a) - grade(b) || a.nameEn.localeCompare(b.nameEn));
    }
    return [...byName.entries()]
      .map(([name, g]) => ({
        name,
        list: g.list,
        order: g.order,
        topGrade: Math.min(...g.list.map(grade)),
      }))
      .sort((a, b) => {
        // Staff after the sections, and the unseated last of all.
        const rank = (n: string) => (n === NO_DESK_GROUP ? 3 : n === STAFF_GROUP ? 2 : 1);
        return rank(a.name) - rank(b.name) || a.order - b.order || a.name.localeCompare(b.name);
      });
  }, [shown]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      guessed: rows.filter((r) => r.designationIsInferred || r.deskIsInferred).length,
      differs: rows.filter((r) => r.rankDiffers).length,
      noDesk: rows.filter((r) => !r.desks.length).length,
      multi: rows.filter((r) => r.desks.length > 1).length,
    }),
    [rows],
  );

  const select =
    "w-full rounded-lg border bg-card px-2 py-1.5 text-sm text-foreground focus:border-primary/40 focus:outline-none disabled:opacity-60";

  return (
    <PageContainer>
      <div className="py-6">
        <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
          <Armchair className="h-5 w-5 text-primary" strokeWidth={1.8} />
          Desks &amp; designations
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          A <strong>designation</strong> is one title from the sanctioned catalogue, held by
          everybody of that rank. A <strong>desk</strong> is an organogram post — a seat in a
          section, so three offices&rsquo; Assistant Director (Chemical) desks are three different
          desks. One person has one designation and may hold several desks: one primary, the rest
          additional charges. Posts are edited under{" "}
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
              ["multi", `Several desks (${counts.multi})`],
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
              className="w-60 rounded-lg border border-border bg-card py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
            />
          </label>
        </div>

        {failed && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>
              <span className="font-medium">
                {rows.find((r) => r.id === failed.id)?.nameEn ?? failed.id}
              </span>{" "}
              — {failed.message}
            </span>
          </p>
        )}

        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[70rem] text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="w-52 px-3 py-2 text-left font-medium text-muted-foreground">Employee</th>
                <th className="w-[26%] px-3 py-2 text-left font-medium text-muted-foreground">
                  Designation
                </th>
                <th className="w-[26%] px-3 py-2 text-left font-medium text-muted-foreground">
                  Primary desk
                </th>
                <th className="w-[26%] px-3 py-2 text-left font-medium text-muted-foreground">
                  Additional charge
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sections.map((section) => (
                <Fragment key={section.name}>
                  <tr className="bg-muted/40">
                    <td colSpan={4} className="px-3 py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {section.name}
                      </span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {section.list.length}
                        {section.name !== STAFF_GROUP && section.topGrade < 99
                          ? ` · from grade ${section.topGrade}`
                          : ""}
                      </span>
                    </td>
                  </tr>
                  {section.list.map((r) => {
                const busy = mutate.isPending && mutate.variables?.url.includes(r.id);
                const primary = r.desks.find((d) => d.isPrimary) ?? null;
                const charge = r.desks.find((d) => !d.isPrimary) ?? null;
                const primaryDesk = r.primaryPostId ? desks.find((d) => d.id === r.primaryPostId) : null;
                return (
                  <tr key={r.id} className={r.rankDiffers ? "bg-amber-500/5" : undefined}>
                    <td className="px-3 py-2 align-top">
                      <span className="font-medium text-foreground">{r.nameEn}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {r.id} · grade {r.grade ?? "—"}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        recorded: {r.recordedEn ?? "—"}
                      </span>
                      {busy && <Loader2 className="mt-1 h-3 w-3 animate-spin text-primary" strokeWidth={2} />}
                      {failed?.id === r.id && (
                        <span className="mt-1 block text-[11px] text-destructive">
                          {failed.message}
                        </span>
                      )}
                      {notes?.id === r.id &&
                        notes.messages.map((m) => (
                          <span
                            key={m}
                            className="mt-1 block text-[11px] text-amber-700 dark:text-amber-400"
                          >
                            {m}
                          </span>
                        ))}
                    </td>

                    <td className="px-3 py-2 align-top">
                      <select
                        disabled={busy}
                        value={r.designationId ?? ""}
                        onChange={(e) =>
                          mutate.mutate({
                            url: `/api/employees/${r.id}/designation`,
                            method: "PATCH",
                            body: {
                              designationId: e.target.value === "" ? null : Number(e.target.value),
                            },
                          })
                        }
                        className={`${select} ${
                          r.designationIsInferred ? "border-amber-500/40" : "border-border"
                        }`}
                      >
                        <option value="">— none —</option>
                        {designationGroups.map(([group, list]) => (
                          <optgroup key={group} label={group}>
                            {list.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.titleEn}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {r.designationIsInferred && r.designationId && (
                        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                          <Sparkles className="h-2.5 w-2.5" strokeWidth={2} /> guessed
                        </span>
                      )}
                      {r.rankDiffers && (
                        <span className="mt-0.5 block text-[11px] text-amber-700 dark:text-amber-400">
                          different rank from the primary desk
                        </span>
                      )}
                    </td>

                    {/* **A plain select, exactly like the designation beside
                        it.** It was a list with an *add* picker and a *make
                        primary* button, which made setting somebody's desk a
                        three-step dance — add, promote, remove the old one —
                        when the client's model was always "two picks side by
                        side". Both now save on change through the same route
                        the previous screen used. */}
                    <td className="px-3 py-2 align-top">
                      <select
                        disabled={busy}
                        value={r.primaryPostId ?? ""}
                        onChange={(e) =>
                          mutate.mutate({
                            url: `/api/employees/${r.id}/desk`,
                            method: "PATCH",
                            body: { orgPostId: e.target.value === "" ? null : Number(e.target.value) },
                          })
                        }
                        className={`${select} ${
                          r.deskIsInferred && r.primaryPostId ? "border-amber-500/40" : "border-border"
                        }`}
                      >
                        <option value="">— no desk —</option>
                        {deskGroups.map(([unit, list]) => (
                          <optgroup key={unit} label={unit}>
                            {list.map((d) => (
                              <option key={d.id} value={d.id}>
                                {deskLabel(d)}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {primary ? primary.unitEn : "no section — no file can reach them"}
                        {primaryDesk?.isSanctioned === false && (
                          <span className="ml-1 font-medium text-sky-700 dark:text-sky-400">
                            · outside organogram
                          </span>
                        )}
                        {r.deskIsInferred && r.primaryPostId && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
                            <Sparkles className="h-2.5 w-2.5" strokeWidth={2} /> guessed
                          </span>
                        )}
                      </span>
                    </td>

                    {/* A post held *in addition* to their own (D74/D153). */}
                    <td className="px-3 py-2 align-top">
                      <select
                        disabled={busy}
                        value={charge?.orgPostId ?? ""}
                        onChange={(e) =>
                          mutate.mutate({
                            url: `/api/employees/${r.id}/desk`,
                            method: "PATCH",
                            body: {
                              actingOrgPostId: e.target.value === "" ? null : Number(e.target.value),
                            },
                          })
                        }
                        className={`${select} border-border`}
                      >
                        <option value="">— none —</option>
                        {deskGroups.map(([unit, list]) => (
                          <optgroup key={unit} label={unit}>
                            {list
                              .filter((d) => d.id !== r.primaryPostId)
                              .map((d) => (
                                <option key={d.id} value={d.id}>
                                  {deskLabel(d)}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                      {charge && (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {charge.unitEn}
                        </span>
                      )}
                      {!r.primaryPostId && (
                        /* **Structure is created in Manage Structure** (D157),
                           not here. This screen could only ever offer sections
                           that already exist, so it could not solve the case
                           that matters — an office with no section of that
                           discipline at all. Assignment stays here; creation
                           lives where the chart does. */
                        <a
                          href="/hr/organogram/manage"
                          className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-dashed border-sky-500/50 px-2 py-1 text-[11px] font-medium text-sky-700 transition-colors hover:bg-sky-500/5 dark:text-sky-400"
                        >
                          no suitable desk — create one in Manage Structure
                        </a>
                      )}
                      {r.desks.filter((d) => !d.isPrimary).length > 1 && (
                        <span className="mt-0.5 block text-[11px] text-amber-700 dark:text-amber-400">
                          holds {r.desks.filter((d) => !d.isPrimary).length} charges; only the first
                          is shown
                        </span>
                      )}
                    </td>
                    </tr>
                  );
                  })}
                </Fragment>
              ))}
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

        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          Showing {shown.length} of {rows.length}. {designations.length} designations ·{" "}
          {desks.length} desks in this office.
          {mutate.isSuccess && !mutate.isPending && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" strokeWidth={2} /> saved
            </span>
          )}
        </p>
      </div>
    </PageContainer>
  );
}
