"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Briefcase, Check, ChevronDown, LogOut, UserRound } from "lucide-react";

/**
 * The signed-in person, in the navbar.
 *
 * **The identity is text, not a link.** It used to be a button to
 * `/public/dashboard` — the *client* account page — so a member of staff
 * clicking their own name was thrown onto the citizen-facing surface. A name is
 * a label; the actions belong behind the caret beside it.
 *
 * Staff get `Name (employee id)` over their designation, because those are the
 * two things a colleague asks for on the phone. Clients have neither, so they
 * get their name and the account link they actually want.
 */

export type MeDesk = {
  id: number;
  kind: "acting" | "substantive";
  titleEn: string;
  titleBn: string;
  unitEn: string;
  unitBn: string;
};

export type Me = {
  employeeId: string;
  nameEn: string;
  nameBn: string;
  designationEn: string | null;
  designationBn: string | null;
  officeEn: string | null;
  officeBn: string | null;
  role: string;
  roleLabel: string;
  status: string;
  desks: MeDesk[];
  activeDeskId: number | null;
};

/**
 * Fetch the viewer's designation and desks.
 *
 * Staff only: `/api/me` is internal by default, so asking on a client's behalf
 * earns a 403 for nothing — a client has no designation and no desk. Aborted on
 * unmount, so a fast navigation cannot set state on a navbar that has gone.
 */
export function useMe(isInternal: boolean): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    if (!isInternal) {
      setMe(null);
      return;
    }
    const ac = new AbortController();
    fetch("/api/me", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d))
      .catch(() => {});
    return () => ac.abort();
  }, [isInternal]);
  return me;
}

export default function AccountMenu({
  fallbackName,
  me,
  isInternal,
  onSignOut,
}: {
  /** `session.user.name` — all we have before `/api/me` answers, and all a client ever has. */
  fallbackName: string;
  me: Me | null;
  isInternal: boolean;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape. Without both, the menu survives a
  // navigation click landing behind it and hangs over the next page.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = me?.nameEn || fallbackName;
  const designation = me?.designationEn ?? me?.designationBn ?? null;

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1">
        {/* Identity — deliberately not interactive. */}
        <div className="hidden min-w-0 flex-col text-right leading-tight sm:flex">
          <span className="truncate text-sm font-semibold text-foreground">
            {name}
            {me && (
              <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">
                ({me.employeeId})
              </span>
            )}
          </span>
          {designation ? (
            <span className="truncate text-xs text-muted-foreground">{designation}</span>
          ) : isInternal ? (
            // Held open rather than collapsed, so the navbar does not jump by a
            // line when /api/me answers a moment after the session does.
            <span className="h-4" />
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Account menu"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-subtitle transition-colors hover:bg-secondary hover:text-primary"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={1.8}
          />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-xl shadow-black/5"
        >
          <div className="border-b border-border px-4 py-3">
            {me ? (
              <>
                <p className="font-bn-serif text-base font-semibold leading-snug text-foreground">
                  {me.nameBn}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {me.nameEn} · <span className="font-mono">{me.employeeId}</span>
                </p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                  {me.roleLabel}
                </p>
                {me.officeBn && (
                  <p className="mt-2 font-bn-serif text-xs leading-snug text-muted-foreground">
                    {me.officeBn}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm font-semibold text-foreground">{fallbackName}</p>
            )}
          </div>

          {isInternal && <DeskSwitcher me={me} />}

          <div className="px-2 py-1.5">
            {!isInternal && (
              <Link
                href="/public/dashboard"
                onClick={() => setOpen(false)}
                role="menuitem"
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                My account
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The desks this person may act from.
 *
 * Today nobody holds two. `User.role` is a single enum so there is no second
 * role to switch to, and a post held in additional charge (D74) is the only way
 * to occupy a second desk — one person does, and they gave up their substantive
 * seat when it went to somebody else, so even they have just the one.
 *
 * So this **shows** what you hold and marks what you are acting from, and does
 * not offer a switch that would do nothing. When somebody genuinely holds two,
 * the extra row appears here on its own and the choice becomes real; wiring the
 * selection through to `toDesk()` is the work that waits for that day, and it is
 * a behaviour change rather than a display one.
 */
function DeskSwitcher({ me }: { me: Me | null }) {
  if (!me) {
    return (
      <div className="border-b border-border px-4 py-3">
        <p className="h-4 w-32 animate-pulse rounded bg-secondary" />
      </div>
    );
  }

  return (
    <div className="border-b border-border px-4 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {me.desks.length > 1 ? "Your desks" : "Your desk"}
      </p>

      {me.desks.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          No organogram post is recorded against you, so no file can be handed to
          you yet. An administrator assigns one.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {me.desks.map((d) => {
            const active = d.id === me.activeDeskId;
            return (
              <li key={d.id} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">
                  {active ? (
                    <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.2} />
                  ) : (
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm leading-snug text-foreground">
                    {d.titleEn}
                    {d.kind === "acting" && (
                      <span className="ml-1 text-xs font-medium text-primary">
                        additional charge
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">{d.unitEn}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
