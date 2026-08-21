"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

const INPUT = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-background transition-colors";
const LABEL = "block text-sm font-medium text-foreground mb-1.5";

export default function BankForm({ bankAccountNo: initAcc, bankBranch: initBranch, tinNo: initTin, prevStep, nextStep }: {
  bankAccountNo: string; bankBranch: string; tinNo: string;
  prevStep: string | null; nextStep: string | null;
}) {
  const router = useRouter();
  const [bankAccountNo, setBankAccountNo] = useState(initAcc);
  const [bankBranch,    setBankBranch]    = useState(initBranch);
  const [tinNo,         setTinNo]         = useState(initTin);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/profile/bank", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankAccountNo: bankAccountNo || null, bankBranch: bankBranch || null, tinNo: tinNo || null }),
    }).finally(() => setSaving(false));
    if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
    setSaved(true);
    router.refresh();
    if (nextStep) router.push("/hr/profile?step=" + nextStep);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={LABEL}>Bank Account Number</label>
          <input value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} className={INPUT} placeholder="Account number" />
        </div>
        <div>
          <label className={LABEL}>Branch Name</label>
          <input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} className={INPUT} placeholder="Branch name" />
        </div>
        <div>
          <label className={LABEL}>E-TIN / TIN Number</label>
          <input value={tinNo} onChange={(e) => setTinNo(e.target.value)} className={INPUT} placeholder="Tax identification number" />
        </div>
      </div>
      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex items-center justify-between pb-8">
        {prevStep ? (
          <button type="button" onClick={() => router.push("/hr/profile?step=" + prevStep)} className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer">← Previous</button>
        ) : <div />}
        <div className="flex items-center gap-3">
          {saved && <span className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle2 size={16} /> Saved</span>}
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer">
            {saving ? "Saving…" : nextStep ? "Save & Next →" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
