"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Open or close one laboratory.
 *
 * Closing says how many routing rows it breaks rather than fixing them
 * silently — an office chose those destinations and repointing them would be
 * deciding on its behalf.
 */
export default function LabToggle({
  labId, isActive, canEdit,
}: {
  labId: number; isActive: boolean; canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  if (!canEdit)
    return (
      <span className="text-xs text-muted-foreground">{isActive ? "Open" : "Closed"}</span>
    );

  return (
    <div className="flex items-center justify-end gap-2">
      {note && <span className="text-xs text-amber-700 dark:text-amber-300">{note}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          const res = await fetch(`/api/labs/registry/${labId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !isActive }),
          });
          const json = (await res.json()) as { error?: string; affected?: number };
          if (!res.ok) { setNote(json.error ?? "That did not save."); return; }
          setNote(
            json.affected ? `${json.affected.toLocaleString("en-BD")} routing cells now unusable` : null,
          );
          start(() => router.refresh());
        }}
        className={`rounded-lg border px-3 py-1 text-xs disabled:opacity-50 ${
          isActive
            ? "border-border hover:border-red-400 hover:text-red-600"
            : "border-primary/40 text-primary hover:bg-primary/5"
        }`}
      >
        {isActive ? "Close" : "Open"}
      </button>
    </div>
  );
}
