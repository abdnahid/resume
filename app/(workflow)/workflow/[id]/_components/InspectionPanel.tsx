"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Loader2, RotateCcw, Search, Users, X } from "lucide-react";
import { groupByRank, type Desk } from "@/lib/workflow/chain";

/**
 * The inspection plan — proposing it, correcting it, approving it (D82).
 *
 * One panel for all three because they are the same form seen by people at
 * different heights in the chain: whoever holds the file writes the date and the
 * team, a senior desk above rewrites them, and the office head approves. A desk
 * that could not correct a plan it is accountable for would have to send it back
 * instead, which is a round trip for a typed date.
 *
 * Once approved this shows the office order and nothing else is editable —
 * changing the date after the factory has been told means a fresh order, not an
 * edited one.
 */

/** A colleague who could join the team — a `Desk`, so it groups by rank. */
export type Candidate = Desk;

export type PlanView = {
  scheduledOn: string;
  note: string | null;
  proposedBy: string;
  proposedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  orderNo: string | null;
  members: { employeeId: string; name: string; designation: string | null; role: string | null }[];
};

export default function InspectionPanel({
  applicationId,
  plan,
  candidates,
  candidatesAreSectionOnly,
  proposerEmployeeId,
  canEdit,
  canApprove,
  officeName,
}: {
  applicationId: number;
  plan: PlanView | null;
  candidates: Candidate[];
  /** False when the proposer holds no desk, so the whole office is offered. */
  candidatesAreSectionOnly: boolean;
  /** Whoever is writing the plan — on the team by default; he is going. */
  proposerEmployeeId: string | null;
  /** True for whoever is holding the file while the plan is unapproved. */
  canEdit: boolean;
  /** True for the office head holding the file. */
  canApprove: boolean;
  officeName: string | null;
}) {
  const router = useRouter();
  const [date, setDate] = useState(plan?.scheduledOn ?? "");
  const [note, setNote] = useState(plan?.note ?? "");
  /**
   * The officer writing the plan starts on the team: he is the one going, and
   * making him tick his own name is a step that is wrong every time it is
   * skipped. Only for a plan that does not exist yet — once one is saved its
   * team is what it says, and quietly re-adding somebody a senior desk removed
   * would put him back on the visit.
   */
  const [team, setTeam] = useState<Record<string, string>>(() =>
    plan
      ? Object.fromEntries(plan.members.map((m) => [m.employeeId, m.role ?? ""]))
      : proposerEmployeeId
        ? { [proposerEmployeeId]: "Team leader" }
        : {},
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  async function send(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/applications/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "That did not work.");
      setPicking(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  // ── Approved: the office order, and nothing to edit ──────────────────────
  if (plan?.approvedAt) {
    return (
      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h2 className="font-display text-lg font-medium text-foreground">Office order</h2>
        <p className="mt-1 font-mono text-sm font-semibold text-foreground">{plan.orderNo}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Inspection on <span className="font-medium text-foreground">{plan.scheduledOn}</span>
          {officeName && <> · {officeName}</>}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Approved by {plan.approvedBy} on {plan.approvedAt}. Proposed by {plan.proposedBy} on{" "}
          {plan.proposedAt}.
        </p>
        {plan.note && <p className="mt-2 text-sm italic text-muted-foreground">“{plan.note}”</p>}
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Inspection team
          </p>
          <ul className="space-y-1">
            {plan.members.map((m) => (
              <li key={m.employeeId} className="text-sm text-foreground">
                {m.name}
                {m.designation && (
                  <span className="text-xs text-muted-foreground"> · {m.designation}</span>
                )}
                {m.role && <span className="text-xs text-primary"> · {m.role}</span>}
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  // ── Not yet approved ─────────────────────────────────────────────────────
  const chosen = Object.keys(team);

  const q = query.trim().toLowerCase();
  const groups = groupByRank(
    q
      ? candidates.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.designation ?? "").toLowerCase().includes(q) ||
            c.employeeId.includes(q),
        )
      : candidates,
  );

  if (!canEdit && !canApprove) {
    return plan ? (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-medium text-foreground">Inspection proposed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {plan.scheduledOn} · {plan.members.length}{" "}
          {plan.members.length === 1 ? "officer" : "officers"} · proposed by {plan.proposedBy}.
          Awaiting the office head's approval.
        </p>
      </section>
    ) : null;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-medium text-foreground">
        {plan ? "Inspection plan" : "Plan the inspection"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {canApprove
          ? "Correct anything that is wrong, then approve. Approving issues the office order."
          : "The date and the team travel up the chain with the file. Any desk above you can correct them; the office head approves."}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <CalendarDays className="h-3 w-3" strokeWidth={2} />
            Date of visit
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Note <span className="font-normal normal-case">(optional)</span>
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Users className="h-3 w-3" strokeWidth={2} />
            Team ({chosen.length})
          </span>
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="cursor-pointer text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            {picking ? "Done choosing" : "Add or remove officers"}
          </button>
        </div>

        {picking && !candidatesAreSectionOnly && (
          // Said out loud rather than silently widening the list: you hold no
          // organogram post, so there is no section to narrow it to.
          <p className="mt-1.5 text-xs text-muted-foreground">
            You hold no desk in the organogram, so every officer in the office is
            listed rather than just your section.
          </p>
        )}

        {chosen.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {chosen.map((id) => {
              const c = candidates.find((x) => x.employeeId === id);
              return (
                <li key={id} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-foreground">
                    {c?.name ?? id}
                    {c?.designation && (
                      <span className="text-xs text-muted-foreground"> · {c.designation}</span>
                    )}
                  </span>
                  <input
                    value={team[id]}
                    onChange={(e) => setTeam((t) => ({ ...t, [id]: e.target.value }))}
                    placeholder="role on the visit"
                    className="w-40 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setTeam((t) => {
                        const n = { ...t };
                        delete n[id];
                        return n;
                      })
                    }
                    className="cursor-pointer text-xs text-muted-foreground hover:text-destructive"
                  >
                    remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {picking && (
          <div className="mt-2 rounded-xl border border-border p-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.8}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or designation…"
                className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear the search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Grouped by the same rank table the pass-down picker uses, so 16
                officers on grade 9 do not run together as one undifferentiated
                list. */}
            <div className="mt-2 max-h-72 space-y-3 overflow-y-auto">
              {groups.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  Nobody in your section matches “{query}”.
                </p>
              ) : (
                groups.map((g) => (
                  <div key={g.label}>
                    <p className="px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {g.label}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {g.desks.map((c) => (
                        <li key={c.employeeId}>
                          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted">
                            <input
                              type="checkbox"
                              checked={c.employeeId in team}
                              onChange={(e) =>
                                setTeam((t) => {
                                  const n = { ...t };
                                  if (e.target.checked) n[c.employeeId] = "";
                                  else delete n[c.employeeId];
                                  return n;
                                })
                              }
                              className="h-3.5 w-3.5 accent-[var(--primary)]"
                            />
                            <span className="text-foreground">{c.name}</span>
                            {c.grade !== null && (
                              <span className="text-xs text-muted-foreground">grade {c.grade}</span>
                            )}
                            {c.employeeId === proposerEmployeeId && (
                              <span className="text-xs text-primary">you</span>
                            )}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            send("plan", {
              scheduledOn: date,
              note,
              members: chosen.map((id) => ({ employeeId: id, role: team[id] })),
            })
          }
          disabled={busy !== null || !date || chosen.length === 0}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "plan" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          {plan ? "Save the plan" : "Propose the inspection"}
        </button>

        {canApprove && plan && (
          <button
            type="button"
            onClick={() => send("approve-plan")}
            disabled={busy !== null}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/40 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/5 disabled:opacity-50"
          >
            {busy === "approve-plan" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Approve and issue the order
          </button>
        )}

        {plan && (
          <button
            type="button"
            onClick={() => send("revise-plan", { reason: note })}
            disabled={busy !== null}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 disabled:opacity-50"
          >
            {busy === "revise-plan" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Send back for rework
          </button>
        )}
      </div>
    </section>
  );
}
