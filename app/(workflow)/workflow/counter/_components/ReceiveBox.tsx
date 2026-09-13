"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, PackageCheck, ShieldAlert } from "lucide-react";

/**
 * The counter takes a box in, or turns it away (D72, D93).
 *
 * **A broken seal is a refusal, not a note.** The samples are in the
 * applicant's own custody between the factory and this counter, so the seal is
 * the only control there is — accepting a box with a broken one and writing a
 * remark would put unaccountable jars on a bench.
 *
 * The testing fee is **read and never written** here (spec §5.2). Where it is
 * unpaid the controls do not render at all, and the service refuses as well:
 * a counter that could mark a file paid is a counter that can be argued with.
 */
export default function ReceiveBox({
  code,
  feePaid,
}: {
  code: string;
  feePaid: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  if (!feePaid) return null;

  async function send(sealIntact: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/consignments/${encodeURIComponent(code)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sealIntact, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not record it");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {error && (
        <p className="flex gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2 py-1.5 text-xs text-red-600">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {rejecting ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/40">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
            The seal is broken or the box is damaged. This refuses the sample —
            it cannot be undone, and the applicant has to be re-sampled.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="What was wrong with it?"
            className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => send(false)}
              className="cursor-pointer rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Refuse the box
            </button>
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                setNote("");
              }}
              className="cursor-pointer rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => send(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <PackageCheck size={14} strokeWidth={1.8} />
            Seal intact — receive
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setRejecting(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary disabled:opacity-50"
          >
            <ShieldAlert size={14} strokeWidth={1.8} />
            Seal broken
          </button>
        </div>
      )}
    </div>
  );
}
