"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Stamp, X, UserPlus, Pencil, Upload, CheckCircle2 } from "lucide-react";
import type { DirectorGeneralRecord } from "@/lib/types";

const INPUT =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-white";
const INPUT_BN = INPUT + " font-bn-serif";

// ─── Signature upload (file → data URL) ────────────────────────────────────────

function SignatureField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        Signature
      </label>
      <div className="flex items-center gap-3">
        <div className="h-16 w-32 shrink-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Signature" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[11px] text-slate-400">No signature</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Upload size={13} />
            {value ? "Replace" : "Upload"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors cursor-pointer text-left px-1"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Appoint / Edit modal ──────────────────────────────────────────────────────

type DgFormMode = { kind: "appoint" } | { kind: "edit"; dg: DirectorGeneralRecord };

function DgFormModal({ mode, onClose }: { mode: DgFormMode; onClose: () => void }) {
  const router = useRouter();
  const editing = mode.kind === "edit" ? mode.dg : null;

  const [nameBn, setNameBn] = useState(editing?.name.bn ?? "");
  const [nameEn, setNameEn] = useState(editing?.name.en ?? "");
  const [appointedAt, setAppointedAt] = useState(editing?.appointedAt ?? "");
  const [orderNo, setOrderNo] = useState(editing?.orderNo ?? "");
  const [orderDate, setOrderDate] = useState(editing?.orderDate ?? "");
  const [signatureUrl, setSignatureUrl] = useState<string | null>(editing?.signatureUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameBn || !nameEn || !appointedAt) {
      setError("Name (Bengali & English) and appointment date are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { nameBn, nameEn, appointedAt, orderNo, orderDate, signatureUrl };
      const res = editing
        ? await fetch(`/api/director-general/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/director-general`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to save");
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900">
              {editing ? "Edit Director General" : "Appoint New Director General"}
            </h3>
            {!editing && (
              <p className="text-xs text-slate-400 mt-0.5">
                This closes the current tenure and sets the new appointee as current.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Name (Bengali) <span className="text-red-500">*</span>
            </label>
            <input value={nameBn} onChange={(e) => setNameBn(e.target.value)} className={INPUT_BN} placeholder="মহাপরিচালকের নাম" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Name (English) <span className="text-red-500">*</span>
            </label>
            <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={INPUT} placeholder="Name in English" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Appointment Date <span className="text-red-500">*</span>
              </label>
              <input type="date" value={toIso(appointedAt)} onChange={(e) => setAppointedAt(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Order Date</label>
              <input type="date" value={toIso(orderDate)} onChange={(e) => setOrderDate(e.target.value)} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Appointment Memo No</label>
            <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} className={INPUT} placeholder="e.g. MoPA/..." />
          </div>

          <SignatureField value={signatureUrl} onChange={setSignatureUrl} />

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors">
              {saving ? "Saving…" : editing ? "Save Changes" : "Appoint"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// <input type="date"> wants YYYY-MM-DD; our stored format is DD-MM-YYYY.
function toIso(v: string): string {
  const m = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
}

// ─── Main ───────────────────────────────────────────────────────────────────────

export default function DirectorGeneralManager({
  directors,
}: {
  directors: DirectorGeneralRecord[];
}) {
  const [modal, setModal] = useState<DgFormMode | null>(null);
  const current = directors.find((d) => d.isCurrent) ?? null;
  const past = directors.filter((d) => !d.isCurrent);

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      {modal && <DgFormModal mode={modal} onClose={() => setModal(null)} />}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Director General</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              The appointed signatory who authorizes employee ID cards.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModal({ kind: "appoint" })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <UserPlus size={15} />
            Appoint New
          </button>
        </div>

        {/* Current DG card */}
        {current ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="h-12 w-12 shrink-0 rounded-full bg-secondary flex items-center justify-center">
                  <Stamp size={20} className="text-primary" />
                </span>
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 mb-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Current
                  </span>
                  <p className="font-bn-serif text-lg font-semibold text-slate-900 leading-snug">{current.name.bn}</p>
                  <p className="text-sm text-slate-500">{current.name.en}</p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                    <span>Appointed: <span className="font-medium text-slate-700">{current.appointedAt}</span></span>
                    {current.orderNo && <span>Memo: <span className="font-medium text-slate-700">{current.orderNo}</span></span>}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModal({ kind: "edit", dg: current })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
              >
                <Pencil size={13} />
                Edit
              </button>
            </div>

            {/* Signature */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Authorizing Signature</p>
              {current.signatureUrl ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <div className="h-16 w-40 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={current.signatureUrl} alt="DG signature" className="max-h-full max-w-full object-contain" />
                  </div>
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span>On file</span>
                </div>
              ) : (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
                  No signature uploaded — cards cannot be issued until a signature is on file. Use Edit to upload.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-10 text-center mb-6">
            <Stamp size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No Director General on record yet.</p>
            <p className="text-xs text-slate-400 mt-1">Appoint one to start authorizing ID cards.</p>
          </div>
        )}

        {/* History */}
        {past.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Past Tenures</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Tenure</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Memo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {past.map((dg) => (
                  <tr key={dg.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 align-top">
                      <p className="font-bn-serif font-medium text-slate-800">{dg.name.bn}</p>
                      <p className="text-xs text-slate-400">{dg.name.en}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600">
                      {dg.appointedAt} → {dg.relievedAt ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-500">{dg.orderNo || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
