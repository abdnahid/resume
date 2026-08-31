"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Upload, X, FileText, Info } from "lucide-react";
import type { DocumentRequirement } from "@/lib/cm/policy";

type Held = { kind: string; fileName: string | null; sizeBytes: number | null };

function kb(bytes: number | null): string {
  if (!bytes) return "";
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function DocumentsStep({
  applicationId,
  requirements,
  held,
  editable,
}: {
  applicationId: number;
  requirements: readonly DocumentRequirement[];
  held: Held[];
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const heldByKind = new Map(held.map((h) => [h.kind, h]));

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="font-semibold text-foreground">Documents</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Missing documents are the most common reason a file is sent back.
      </p>

      {/* Said plainly rather than hidden: the bytes are not kept yet, and an
          applicant who believes BSTI holds their trade licence when it does not
          would find out at the worst possible moment. */}
      <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        <span>
          File storage is not live yet. Your document names are recorded against the application,
          but the files themselves are not kept — you will be asked to upload them again when
          storage opens.
        </span>
      </p>

      <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
        {requirements.map((req) => (
          <DocumentRow
            key={req.kind}
            applicationId={applicationId}
            req={req}
            held={heldByKind.get(req.kind)}
            editable={editable}
            busy={busy === req.kind}
            setBusy={setBusy}
            setError={setError}
            onDone={() => router.refresh()}
          />
        ))}
      </ul>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </section>
  );
}

function DocumentRow({
  applicationId,
  req,
  held,
  editable,
  busy,
  setBusy,
  setError,
  onDone,
}: {
  applicationId: number;
  req: DocumentRequirement;
  held?: Held;
  editable: boolean;
  busy: boolean;
  setBusy: (k: string | null) => void;
  setError: (e: string | null) => void;
  onDone: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(req.kind);
    setError(null);
    try {
      const body = new FormData();
      body.set("kind", req.kind);
      body.set("file", file);
      const res = await fetch(`/api/client/applications/${applicationId}/documents`, {
        method: "POST",
        body,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not attach that file.");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not attach.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy(req.kind);
    try {
      await fetch(
        `/api/client/applications/${applicationId}/documents?kind=${encodeURIComponent(req.kind)}`,
        { method: "DELETE" },
      );
      onDone();
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
            held ? "bg-primary text-primary-foreground" : "border border-border"
          }`}
        >
          {held && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {req.label}
            {!req.required && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">optional</span>
            )}
          </p>
          {held?.fileName ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3 w-3 shrink-0" strokeWidth={1.8} />
              <span className="truncate">{held.fileName}</span>
              <span>{kb(held.sizeBytes)}</span>
            </p>
          ) : (
            req.hint && <p className="mt-0.5 text-xs text-muted-foreground">{req.hint}</p>
          )}
        </div>
      </div>

      {editable && (
        <div className="flex shrink-0 items-center gap-2">
          <input
            ref={input}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
            ) : (
              <Upload className="h-3 w-3" strokeWidth={2} />
            )}
            {held ? "Replace" : "Attach"}
          </button>
          {held && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
              aria-label={`Remove ${req.label}`}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
