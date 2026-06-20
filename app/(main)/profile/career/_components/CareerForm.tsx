"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import type { OrgPostFlat, OrgRoot } from "@/lib/org";
import SingleDatePopover from "../../../_components/DateScape/SingleDatePopover";
import { toDate, fromDate } from "@/lib/dateHelpers";

const INPUT = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-background transition-colors";
const LABEL = "block text-sm font-medium text-foreground mb-1.5";

type Office = { id: number; nameBn: string; nameEn: string; type: string; rootId: number | null };

type PostingSummary = {
  id: number; type: string; status: string; selfReported: boolean; grade: string;
  joinedAt: string; relievedAt: string; orderNo: string; orderDate: string;
  officeName: string; designationBn: string; designationEn: string;
};

type AddFormState = {
  officeId: string; wingId: number | null; orgPostId: string;
  type: string; joinedAt: string; relievedAt: string; orderNo: string; orderDate: string;
};

const EMPTY_FORM: AddFormState = {
  officeId: "", wingId: null, orgPostId: "",
  type: "initial", joinedAt: "", relievedAt: "", orderNo: "", orderDate: "",
};

const POSTING_TYPES = [
  { value: "initial",    label: "Initial Joining" },
  { value: "transfer",   label: "Transfer" },
  { value: "promotion",  label: "Promotion" },
  { value: "demotion",   label: "Demotion" },
  { value: "deputation", label: "Deputation" },
  { value: "lien",       label: "Lien" },
];

export default function CareerForm({
  postings: initial, orgPosts, wings, offices, locked, prevStep, nextStep,
}: {
  postings: PostingSummary[];
  orgPosts: OrgPostFlat[];
  wings: OrgRoot[];
  offices: Office[];
  locked: boolean;
  prevStep: string | null;
  nextStep: string | null;
}) {
  const router = useRouter();
  const [postings, setPostings]   = useState(initial);
  const [showForm, setShowForm]   = useState(false);
  const [form,     setForm]       = useState<AddFormState>(EMPTY_FORM);
  const [saving,   setSaving]     = useState(false);
  const [deleting, setDeleting]   = useState<number | null>(null);
  const [error,    setError]      = useState("");

  const selectedOffice = useMemo(
    () => offices.find((o) => o.id === Number(form.officeId)) ?? null,
    [offices, form.officeId],
  );
  const isHead = selectedOffice?.type === "head";
  const activeRootId: number | null = isHead ? form.wingId : (selectedOffice?.rootId ?? null);

  const grouped = useMemo(() => {
    if (activeRootId == null) return {} as Record<string, OrgPostFlat[]>;
    const filtered = orgPosts.filter((p) => p.rootId === activeRootId);
    const map: Record<string, OrgPostFlat[]> = {};
    for (const post of filtered) {
      const label = post.pathBn.length > 1 ? post.pathBn.slice(1).join(" › ") : post.pathBn[0];
      if (!map[label]) map[label] = [];
      map[label].push(post);
    }
    return map;
  }, [orgPosts, activeRootId]);

  const selectedPost = useMemo(
    () => orgPosts.find((p) => p.id === Number(form.orgPostId)) ?? null,
    [orgPosts, form.orgPostId],
  );

  function setF(patch: Partial<AddFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.officeId || !form.joinedAt) { setError("Office and Join Date are required"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/profile/career", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          officeId:  Number(form.officeId),
          orgPostId: form.orgPostId ? Number(form.orgPostId) : null,
          type:      form.type,
          joinedAt:  form.joinedAt || null,
          relievedAt:form.relievedAt || null,
          orderNo:   form.orderNo || null,
          orderDate: form.orderDate || null,
        }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
      const created = await res.json();
      setPostings((prev) => [...prev, {
        id: created.id, type: created.type, status: created.status,
        selfReported: true, grade: created.grade,
        joinedAt: created.joinedAt ?? "", relievedAt: created.relievedAt ?? "",
        orderNo: created.orderNo ?? "", orderDate: created.orderDate ?? "",
        officeName: created.office?.nameBn ?? "",
        designationBn: created.orgPost?.nameBn ?? "",
        designationEn: created.orgPost?.nameEn ?? "",
      }]);
      setForm(EMPTY_FORM); setShowForm(false); router.refresh();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/profile/career/${id}`, { method: "DELETE" });
      if (!res.ok) { setError((await res.json()).error ?? "Delete failed"); return; }
      setPostings((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    } finally { setDeleting(null); }
  }

  return (
    <div className="space-y-4">
      {postings.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground italic py-6 text-center border border-dashed border-border rounded-xl">
          No posting records yet.
        </p>
      )}

      {postings.map((p) => (
        <div key={p.id} className="rounded-xl border border-border bg-card px-4 py-3.5 flex items-start gap-3 group">
          <div className="mt-0.5 shrink-0">
            {p.status === "active"
              ? <CheckCircle2 size={16} className="text-emerald-500" />
              : <Clock size={16} className="text-amber-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground font-bn-serif">{p.designationBn || p.designationEn || "—"}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                p.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}>
                {p.status === "active" ? "Verified" : "Pending Verification"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-bn-serif">{p.officeName}</p>
            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
              {p.joinedAt  && <span>From: {p.joinedAt}</span>}
              {p.relievedAt ? <span>To: {p.relievedAt}</span> : <span className="text-emerald-600">Current</span>}
              {p.grade      && <span>Grade {p.grade}</span>}
            </div>
          </div>
          {p.selfReported && p.status === "pending" && !locked && (
            <button
              type="button"
              onClick={() => handleDelete(p.id)}
              disabled={deleting === p.id}
              className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {!locked && (
        showForm ? (
          <form onSubmit={handleAdd} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Add Posting Record</h3>

            <div>
              <label className={LABEL}>Office <span className="text-red-500">*</span></label>
              <select value={form.officeId} onChange={(e) => setF({ officeId: e.target.value, wingId: null, orgPostId: "" })} required className={INPUT + " font-bn-serif"}>
                <option value="">— Select Office —</option>
                {offices.map((o) => <option key={o.id} value={o.id}>{o.nameBn}</option>)}
              </select>
            </div>

            {isHead && (
              <div>
                <label className={LABEL}>Wing</label>
                <div className="flex flex-wrap gap-2">
                  {wings.map((w) => (
                    <button key={w.id} type="button" onClick={() => setF({ wingId: w.id, orgPostId: "" })}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer font-bn-serif ${
                        form.wingId === w.id ? "bg-slate-900 text-white border-slate-900" : "border-border text-foreground hover:border-slate-400"
                      }`}>
                      {w.nameBn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeRootId != null && Object.keys(grouped).length > 0 && (
              <div>
                <label className={LABEL}>Designation</label>
                <select size={8} value={form.orgPostId} onChange={(e) => setF({ orgPostId: e.target.value })} className={INPUT + " font-bn-serif"}>
                  <option value="">— Choose —</option>
                  {Object.entries(grouped).map(([group, posts]) => (
                    <optgroup key={group} label={group}>
                      {posts.map((p) => (
                        <option key={p.id} value={String(p.id)}>{p.nameBn}{p.grade ? ` (গ্রেড ${p.grade})` : ""}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {selectedPost && (
                  <p className="text-xs text-emerald-600 mt-1">✓ {selectedPost.nameBn}{selectedPost.grade ? ` — Grade ${selectedPost.grade}` : ""}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Posting Type</label>
                <select value={form.type} onChange={(e) => setF({ type: e.target.value })} className={INPUT}>
                  {POSTING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Order No</label>
                <input value={form.orderNo} onChange={(e) => setF({ orderNo: e.target.value })} className={INPUT} placeholder="Memo / order number" />
              </div>
              <div>
                <label className={LABEL}>Join Date <span className="text-red-500">*</span></label>
                <SingleDatePopover
                  defaultDate={toDate(form.joinedAt)}
                  getSelectedDate={(date) => setF({ joinedAt: date ? fromDate(date) : "" })}
                  placeholder="Pick date"
                />
              </div>
              <div>
                <label className={LABEL}>Relieve Date <span className="text-muted-foreground text-xs">(leave blank if current)</span></label>
                <SingleDatePopover
                  defaultDate={toDate(form.relievedAt)}
                  getSelectedDate={(date) => setF({ relievedAt: date ? fromDate(date) : "" })}
                  placeholder="Pick date"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex gap-2 text-xs text-amber-700">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              This posting will be submitted as <strong>Pending</strong> and verified by admin.
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 cursor-pointer transition-colors">
                {saving ? "Adding…" : "Add Posting"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(""); }} className="px-5 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted cursor-pointer transition-colors">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-slate-400 hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer w-full justify-center"
          >
            <Plus size={14} /> Add Posting Record
          </button>
        )
      )}

      {/* Step navigation */}
      <div className="flex items-center justify-between pt-4 pb-8">
        {prevStep ? <button type="button" onClick={() => router.push("/profile?step=" + prevStep)} className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer">← Previous</button> : <div />}
        {nextStep && <button type="button" onClick={() => router.push("/profile?step=" + nextStep)} className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors cursor-pointer">Continue →</button>}
      </div>
    </div>
  );
}
