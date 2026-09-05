"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2 } from "lucide-react";

/**
 * Replace one variant's packaging artwork, when BSTI has asked for that and
 * nothing else (D53, D81).
 *
 * **Deliberately not the variant editor.** Opening the full form for an artwork
 * correction would put the brand, size and packaging back in reach, and the
 * officer marked a label — not the article. The server enforces the same thing
 * independently: with only `artwork:<id>` open, `updateSku` writes the label
 * columns and ignores the rest of the payload.
 *
 * The bytes are still discarded — the document store does not exist — so this
 * records the file's name, type and size, and says so.
 */
export default function ArtworkFix({
  applicationId,
  skuId,
  label,
  comment,
  currentName,
}: {
  applicationId: number;
  skuId: number;
  label: string;
  comment: string;
  currentName: string | null;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/applications/${applicationId}/skus`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skuId,
          labelImageName: file.name,
          labelImageSizeBytes: file.size,
          labelImageMime: file.type,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not save the artwork.");
      setFile(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the artwork.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-card p-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{comment}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {currentName ? (
          <>
            On file: <span className="font-mono">{currentName}</span>
          </>
        ) : (
          "No artwork on file for this variant."
        )}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="max-w-full text-xs text-muted-foreground file:mr-2 file:rounded-lg file:border file:border-border file:bg-secondary file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
        />
        <button
          type="button"
          onClick={save}
          disabled={!file || busy}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
          ) : (
            <ImageUp className="h-3 w-3" strokeWidth={2} />
          )}
          Replace artwork
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        Only the file name, type and size are recorded — BSTI's document store is
        not built yet, so the image itself is not kept.
      </p>
    </div>
  );
}
