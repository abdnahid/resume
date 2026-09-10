"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Remove a hand-recorded laboratory.
 *
 * Offered only where it can actually work: a laboratory the organogram owns is
 * refused by the route because `seed:labs` would write it back, so the control
 * is not rendered for one at all — a button whose only outcome is a refusal is
 * worse than no button.
 *
 * It still asks twice, and the route still refuses by name when something
 * points at the bench. Closing is the ordinary act (D106); this is for the row
 * that should never have been written.
 */
export default function LabRemove({ labId, labName }: { labId: number; labName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [arming, setArming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (error)
    return (
      <div className="mt-1 text-right">
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setArming(false);
          }}
          className="mt-1 text-xs text-muted-foreground underline"
        >
          Dismiss
        </button>
      </div>
    );

  if (!arming)
    return (
      <button
        type="button"
        onClick={() => setArming(true)}
        className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:border-red-400 hover:text-red-600"
      >
        Remove
      </button>
    );

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Remove {labName}?</span>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          const res = await fetch(`/api/labs/registry/${labId}`, { method: "DELETE" });
          const json = (await res.json()) as { error?: string };
          if (!res.ok) {
            setError(json.error ?? "That did not save.");
            return;
          }
          start(() => router.refresh());
        }}
        className="rounded-lg border border-red-400 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => setArming(false)}
        className="rounded-lg border border-border px-2 py-1 text-xs"
      >
        No
      </button>
    </span>
  );
}
