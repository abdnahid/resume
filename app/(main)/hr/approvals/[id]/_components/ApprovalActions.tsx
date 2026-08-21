"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function ApprovalActions({
  employeeId, currentStatus, revisionNote: initNote,
}: {
  employeeId: string; currentStatus: string; revisionNote: string;
}) {
  const router = useRouter();
  const [showNote, setShowNote]   = useState(false);
  const [note, setNote]           = useState(initNote);
  const [loading, setLoading]     = useState<"approve" | "revision" | null>(null);
  const [error, setError]         = useState("");

  if (currentStatus !== "submitted") return null;

  async function act(action: "approve" | "revision") {
    if (action === "revision" && !note.trim()) { setError("Add a revision note first."); return; }
    setLoading(action); setError("");
    const res = await fetch(`/api/admin/profile/${employeeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    }).finally(() => setLoading(null));
    if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
    router.push("/hr/approvals");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setShowNote((v) => !v); setError(""); }}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <AlertCircle size={13} />
          {loading === "revision" ? "Sending…" : "Request Revision"}
        </button>
        <button
          onClick={() => act("approve")}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <CheckCircle2 size={13} />
          {loading === "approve" ? "Approving…" : "Approve"}
        </button>
      </div>

      {/* Inline revision note panel */}
      {showNote && (
        <div className="flex flex-col gap-1.5 w-72">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            autoFocus
            className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-slate-400 bg-background resize-none"
            placeholder="Describe what needs to be corrected…"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={() => act("revision")}
            disabled={!!loading}
            className="self-end px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading === "revision" ? "Sending…" : "Send Revision Request"}
          </button>
        </div>
      )}
    </div>
  );
}
