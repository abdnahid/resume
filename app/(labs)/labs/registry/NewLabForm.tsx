"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { labSlugBase } from "@/lib/labs/grid";

/**
 * Record a laboratory the organogram does not know about.
 *
 * The 46 seeded benches came from the organogram with none invented, which was
 * right for a starting position and wrong as a permanent one: an office opens a
 * bench, or closes one for good, and until now neither could be said. This is
 * where it is said.
 *
 * It shows the slug it is about to write, because that string is what
 * `seed:labs` keys on and what keeps a hand-recorded bench out of the seed's
 * reach — worth being able to see rather than trust.
 */
export default function NewLabForm({
  offices,
}: {
  offices: { officeId: number; office: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [officeId, setOfficeId] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [discipline, setDiscipline] = useState<"physical" | "chemical">("chemical");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const officeName = offices.find((o) => String(o.officeId) === officeId)?.office ?? "";
  const slug = useMemo(
    () => (officeName && nameEn.trim().length >= 3 ? labSlugBase(officeName, nameEn) : null),
    [officeName, nameEn],
  );

  if (!open)
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
        >
          Add a laboratory
        </button>
      </div>
    );

  const submit = async () => {
    setError(null);
    setNote(null);
    const res = await fetch("/api/labs/registry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        officeId: Number(officeId),
        nameEn: nameEn.trim(),
        nameBn: nameBn.trim() || null,
        discipline,
      }),
    });
    const json = (await res.json()) as {
      error?: string;
      lab?: { nameEn: string };
      ambiguity?: string[];
    };
    if (!res.ok) {
      setError(json.error ?? "That did not save.");
      return;
    }
    // `labFor()` picks an office's bench by discipline and takes the first
    // match. A second bench of the same discipline is a question only this
    // office can answer, so it is said here rather than found on a consignment.
    setNote(
      json.ambiguity?.length
        ? `Saved. ${officeName} now has more than one open ${discipline} bench — ${[
            json.lab?.nameEn,
            ...json.ambiguity,
          ].join(", ")} — so a test of that kind will be named against whichever was recorded first until somebody says otherwise.`
        : null,
    );
    setNameEn("");
    setNameBn("");
    start(() => router.refresh());
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">Add a laboratory</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        For a bench the organogram does not carry. It is recorded without an organogram unit on
        purpose — that is what keeps <code className="font-mono">npm run seed:labs</code> from
        rewriting it, and it is what makes it removable again while nothing points at it.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs">
          <span className="font-medium">Office</span>
          <select
            value={officeId}
            onChange={(e) => setOfficeId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Choose an office…</option>
            {offices.map((o) => (
              <option key={o.officeId} value={o.officeId}>
                {o.office}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="font-medium">Discipline</span>
          <select
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value as "physical" | "chemical")}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="chemical">Chemical</option>
            <option value="physical">Physical</option>
          </select>
        </label>

        <label className="text-xs">
          <span className="font-medium">Name</span>
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="Microbiology Lab, Khulna"
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>

        <label className="text-xs">
          <span className="font-medium">
            Name in Bangla <span className="font-normal text-muted-foreground">optional</span>
          </span>
          <input
            value={nameBn}
            onChange={(e) => setNameBn(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-bn"
          />
        </label>
      </div>

      {slug && (
        <p className="mt-3 text-xs text-muted-foreground">
          Will be recorded as <code className="font-mono">{slug}</code>
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {note && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">{note}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={pending || !officeId || nameEn.trim().length < 3}
          onClick={submit}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          Record it
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setNote(null);
          }}
          className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
