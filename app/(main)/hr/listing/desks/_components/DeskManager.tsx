"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Armchair, Check, Info, Search, X } from "lucide-react";
import PageContainer from "@/components/PageContainer";

/**
 * Correct who sits on which organogram post.
 *
 * **Filters first, because the list is the problem.** 322 of 480 seats are
 * guesses and every one disagrees in rank with the recorded designation, so
 * "needs review" is not a corner of this screen — it is most of it. The counts
 * on the filter chips are what make the size of the job visible.
 */

export type PostRef = { id: number; nameEn: string; grade: string | null; unitEn: string };

export type DeskRow = {
  id: string;
  nameEn: string;
  nameBn: string;
  recordedEn: string | null;
  recordedBn: string | null;
  grade: string | null;
  category: string;
  status: string;
  inferred: boolean;
  rankDisagrees: boolean;
  shownEn: string | null;
  post: PostRef | null;
  acting: PostRef | null;
};

export type PostChoice = {
  id: number;
  nameEn: string;
  grade: string | null;
  unitEn: string;
  sanctioned: number;
  held: number;
  holders: { id: string; nameEn: string }[];
};

type Filter = "all" | "guessed" | "none" | "acting" | "confirmed";

const INPUT =
  "rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none";

export default function DeskManager({
  offices,
  officeId,
  rows,
  posts,
}: {
  offices: { id: number; nameEn: string }[];
  officeId: number;
  rows: DeskRow[];
  posts: PostChoice[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      // A daily-basis employee holds no sanctioned post by definition, so they
      // are not part of "nobody has seated this person".
      none: rows.filter((r) => !r.post && !r.acting && r.category !== "daily_basis").length,
      guessed: rows.filter((r) => r.post && r.inferred).length,
      acting: rows.filter((r) => r.acting).length,
      confirmed: rows.filter((r) => r.post && !r.inferred).length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (filter === "guessed" && !(r.post && r.inferred)) return false;
        if (filter === "none" && !(!r.post && !r.acting && r.category !== "daily_basis"))
          return false;
        if (filter === "acting" && !r.acting) return false;
        if (filter === "confirmed" && !(r.post && !r.inferred)) return false;
        if (!q) return true;
        return (
          r.id.includes(q) ||
          r.nameEn.toLowerCase().includes(q) ||
          r.nameBn.includes(search.trim()) ||
          (r.recordedEn ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 250);
  }, [rows, search, filter]);

  async function save(
    row: DeskRow,
    body: Record<string, unknown>,
    { overfillPrompt = true }: { overfillPrompt?: boolean } = {},
  ) {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/employees/${row.id}/desk`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      // The one refusal that has a legitimate override: the post is full, and
      // the administrator may know that is the real arrangement. Everything
      // else is a fault and stays refused.
      if (overfillPrompt && typeof data.error === "string" && data.error.includes("seat this person anyway")) {
        if (confirm(`${data.error}\n\nSeat them anyway?`)) {
          return save(row, { ...body, allowOverfill: true }, { overfillPrompt: false });
        }
        return;
      }
      setError(data.error ?? "Could not change the desk");
      return;
    }
    const where = data.post ? `${data.post.nameEn} · ${data.post.unitEn}` : "no desk";
    const charge = data.acting ? `, acting ${data.acting.nameEn}` : "";
    setNotice(
      [`${data.name}: ${where}${charge}.`, ...(data.warnings ?? [])].join("  "),
    );
    setEditing(null);
    router.refresh();
  }

  return (
    <PageContainer>
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Armchair size={18} /> Desk assignments
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Which organogram post each person holds. The desk decides the section a
          file routes to, and the title shown on their own screen — so a seat a
          script guessed is worth correcting. Choosing a post here marks it as
          decided, and the post&rsquo;s own name then becomes their designation.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={officeId}
          onChange={(e) => router.push(`/hr/listing/desks?office=${e.target.value}`)}
          className={`${INPUT} w-72 cursor-pointer`}
        >
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nameEn}
            </option>
          ))}
        </select>
        <div className="relative min-w-64 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee ID, name or designation…"
            className={`${INPUT} w-full pl-9`}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Everyone"],
            ["guessed", "Guessed seat"],
            ["none", "No desk"],
            ["acting", "Additional charge"],
            ["confirmed", "Confirmed"],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === value
                ? "bg-slate-900 text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
            <span className="ml-1.5 tabular-nums opacity-70">{counts[value]}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="flex gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      {notice && (
        <p className="flex gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <Check size={15} className="mt-0.5 shrink-0" />
          {notice}
        </p>
      )}

      <div className="divide-y divide-slate-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-400">
            Nobody matches those filters.
          </p>
        ) : (
          filtered.map((r) => (
            <Row
              key={r.id}
              row={r}
              posts={posts}
              open={editing === r.id}
              onOpen={() => {
                setEditing(editing === r.id ? null : r.id);
                setError(null);
              }}
              onSave={(body) => save(r, body)}
            />
          ))
        )}
      </div>

      {filtered.length === 250 && (
        <p className="text-xs text-slate-400">
          Showing the first 250. Narrow the search to see the rest.
        </p>
      )}
    </PageContainer>
  );
}

function Row({
  row,
  posts,
  open,
  onOpen,
  onSave,
}: {
  row: DeskRow;
  posts: PostChoice[];
  open: boolean;
  onOpen: () => void;
  onSave: (body: Record<string, unknown>) => void;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-4">
        <span className="w-28 shrink-0 font-mono text-xs text-slate-400">{row.id}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{row.nameEn}</p>
          <p className="truncate font-bn-serif text-xs text-slate-500">
            {row.nameBn}
            {row.recordedEn ? ` · ${row.recordedEn}` : ""}
            {row.grade ? ` · grade ${row.grade}` : ""}
          </p>
        </div>

        <div className="w-[22rem] shrink-0">
          {row.post ? (
            <>
              <p className="truncate text-sm text-slate-700">
                {row.post.nameEn}
                {row.post.grade ? (
                  <span className="ml-1 text-xs text-slate-400">g{row.post.grade}</span>
                ) : null}
              </p>
              <p className="truncate text-xs text-slate-400">{row.post.unitEn}</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">
              {row.category === "daily_basis" ? "daily basis — no sanctioned post" : "no desk"}
            </p>
          )}
          {row.acting && (
            <p className="mt-0.5 truncate text-xs text-violet-700">
              {row.acting.nameEn} — additional charge
            </p>
          )}
        </div>

        <div className="flex w-40 shrink-0 flex-wrap gap-1">
          {row.post && row.inferred && (
            <Tag tone="amber" title="import:desks placed this by matching on grade — nobody has confirmed it">
              guessed
            </Tag>
          )}
          {row.post && row.inferred && row.rankDisagrees && (
            <Tag
              tone="red"
              title={`The post is a different rank from "${row.recordedEn ?? row.recordedBn}", so the recorded title is shown instead`}
            >
              rank differs
            </Tag>
          )}
          {row.post && !row.inferred && (
            <Tag tone="emerald" title="Confirmed by hand — the post's name is used as the designation">
              confirmed
            </Tag>
          )}
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {open ? "Cancel" : "Change"}
        </button>
      </div>

      {open && (
        /* Keyed on the seat as the server last reported it, so a refresh after
           a save resets the two selects instead of leaving them on values that
           are no longer true. A `useState` initialiser runs once. */
        <Editor
          key={`${row.post?.id ?? 0}-${row.acting?.id ?? 0}`}
          row={row}
          posts={posts}
          onSave={onSave}
        />
      )}
    </div>
  );
}

function Editor({
  row,
  posts,
  onSave,
}: {
  row: DeskRow;
  posts: PostChoice[];
  onSave: (body: Record<string, unknown>) => void;
}) {
  const [post, setPost] = useState<string>(row.post ? String(row.post.id) : "");
  const [acting, setActing] = useState<string>(row.acting ? String(row.acting.id) : "");

  return (
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
          <p className="flex gap-2 text-xs text-slate-500">
            <Info size={13} className="mt-0.5 shrink-0" />
            Shown as <strong className="font-medium text-slate-700">{row.shownEn ?? "—"}</strong>{" "}
            today. Only posts in this employee&rsquo;s own office are offered — a
            seat outside it would be unreachable by their office&rsquo;s routing.
          </p>

          <Picker
            label="Desk"
            hint="The post they hold substantively. Choosing one marks the seat as decided."
            value={post}
            onChange={setPost}
            posts={posts}
            selfId={row.id}
          />
          <Picker
            label="Additional charge"
            hint="A second post they run while it is vacant. Its grade and section win for routing (D74)."
            value={acting}
            onChange={setActing}
            posts={posts}
            selfId={row.id}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                onSave({
                  orgPostId: post === "" ? null : Number(post),
                  actingOrgPostId: acting === "" ? null : Number(acting),
                })
              }
              className="cursor-pointer rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
            >
              Save
            </button>
            {(row.post || row.acting) && (
              <button
                type="button"
                onClick={() => onSave({ orgPostId: null, actingOrgPostId: null })}
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
              >
                <X size={13} /> Release both
              </button>
            )}
          </div>
        </div>
  );
}

function Picker({
  label,
  hint,
  value,
  onChange,
  posts,
  selfId,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  posts: PostChoice[];
  selfId: string;
}) {
  // Grouped by unit so a section reads as a section. Occupancy is on the option
  // itself: 54 posts are already over their sanctioned count, so "is there
  // room" has to be answerable before the choice rather than after the refusal.
  const groups = useMemo(() => {
    const m = new Map<string, PostChoice[]>();
    for (const p of posts) {
      if (!m.has(p.unitEn)) m.set(p.unitEn, []);
      m.get(p.unitEn)!.push(p);
    }
    return [...m].sort((a, b) => a[0].localeCompare(b[0]));
  }, [posts]);

  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT} mt-1 w-full cursor-pointer`}
      >
        <option value="">— none —</option>
        {groups.map(([unit, list]) => (
          <optgroup key={unit} label={unit}>
            {list.map((p) => {
              const others = p.holders.filter((h) => h.id !== selfId).map((h) => h.nameEn);
              const room =
                p.held >= p.sanctioned
                  ? `${p.held} of ${p.sanctioned} held`
                  : p.held === 0
                    ? "vacant"
                    : `${p.held} of ${p.sanctioned} held`;
              return (
                <option key={p.id} value={p.id}>
                  {p.nameEn}
                  {p.grade ? ` · g${p.grade}` : ""} · {room}
                  {others.length ? ` · ${others.slice(0, 2).join(", ")}` : ""}
                </option>
              );
            })}
          </optgroup>
        ))}
      </select>
      <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>
    </label>
  );
}

function Tag({
  children,
  tone,
  title,
}: {
  children: React.ReactNode;
  tone: "amber" | "red" | "emerald";
  title?: string;
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  return (
    <span
      title={title}
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
