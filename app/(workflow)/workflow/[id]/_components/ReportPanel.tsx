"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardList, FileText, Loader2, SendHorizontal } from "lucide-react";

/**
 * The initial inspection report — প্রারম্ভিক পরিদর্শন প্রতিবেদন (D86).
 *
 * **Nothing is asked for that the file already holds.** The product, the BDS
 * numbers, the company and factory and the declared capacity are shown as
 * context, not as fields — the wing's paper form asks for them because paper
 * cannot look them up. What is asked for is only what an officer learns by
 * being there.
 *
 * The declared capacity sits beside the found one on purpose: "did they
 * under-declare" is the question an inspection answers, and it cannot be asked
 * of a form with one box.
 */

export type ReportContext = {
  productName: string | null;
  standards: string[];
  companyName: string;
  factoryName: string;
  factoryDistrict: string | null;
  declaredCapacity: string | null;
  declaredYearProduction: string | null;
};

export type Catalogue = { key: string; labelBn: string; labelEn: string }[];

export type ExistingReport = {
  applicantName: string | null;
  applicantDesignation: string | null;
  govtApprovalOk: boolean | null;
  govtApprovalNote: string | null;
  foundCapacityValue: string | null;
  foundCapacityUnitId: number | null;
  utilisationPercent: string | null;
  unitCostTaka: string | null;
  remarks: string | null;
  conditions: Record<string, { satisfactory: boolean; note: string | null }>;
  markings: Record<string, boolean>;
  answers: Record<string, string>;
  submittedAt: string | null;
  approvedAt: string | null;
  reportNo: string | null;
  preparedBy: string;
};

export default function ReportPanel({
  applicationId,
  context,
  conditions,
  markings,
  narrative,
  units,
  report,
  gaps,
  canEdit,
  canApprove,
  approverName,
}: {
  applicationId: number;
  context: ReportContext;
  conditions: Catalogue;
  markings: Catalogue;
  narrative: Catalogue;
  units: { id: number; code: string; nameEn: string }[];
  report: ExistingReport | null;
  gaps: string[];
  canEdit: boolean;
  canApprove: boolean;
  approverName: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    applicantName: report?.applicantName ?? "",
    applicantDesignation: report?.applicantDesignation ?? "",
    govtApprovalOk: report?.govtApprovalOk ?? null,
    govtApprovalNote: report?.govtApprovalNote ?? "",
    foundCapacityValue: report?.foundCapacityValue ?? "",
    foundCapacityUnitId: report?.foundCapacityUnitId ? String(report.foundCapacityUnitId) : "",
    utilisationPercent: report?.utilisationPercent ?? "",
    unitCostTaka: report?.unitCostTaka ?? "",
    remarks: report?.remarks ?? "",
  });
  const [cond, setCond] = useState<Record<string, { satisfactory: boolean; note: string }>>(
    Object.fromEntries(
      conditions.map((c) => [
        c.key,
        {
          satisfactory: report?.conditions[c.key]?.satisfactory ?? true,
          note: report?.conditions[c.key]?.note ?? "",
        },
      ]),
    ),
  );
  const [mark, setMark] = useState<Record<string, boolean>>(
    Object.fromEntries(markings.map((m) => [m.key, report?.markings[m.key] ?? true])),
  );
  const [ans, setAns] = useState<Record<string, string>>(
    Object.fromEntries(narrative.map((n) => [n.key, report?.answers[n.key] ?? ""])),
  );

  async function send(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/applications/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "That did not work.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  const num = (v: string) => {
    const n = Number(v);
    return v.trim() !== "" && Number.isFinite(n) ? n : null;
  };

  const payload = () => ({
    ...form,
    foundCapacityValue: num(form.foundCapacityValue),
    foundCapacityUnitId: num(form.foundCapacityUnitId),
    utilisationPercent: num(form.utilisationPercent),
    // Money is integer poisha everywhere; the officer types taka.
    unitCostPoisha:
      num(form.unitCostTaka) === null ? null : Math.round((num(form.unitCostTaka) as number) * 100),
    conditions: conditions.map((c) => ({
      key: c.key,
      satisfactory: cond[c.key].satisfactory,
      note: cond[c.key].note,
    })),
    markings: markings.map((m) => ({ key: m.key, present: mark[m.key] })),
    answers: narrative.map((n) => ({ key: n.key, text: ans[n.key] })),
  });

  // ── Approved: the report is a document now ───────────────────────────────
  if (report?.approvedAt) {
    return (
      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h2 className="font-display text-lg font-medium text-foreground">Inspection report</h2>
        <p className="mt-1 font-mono text-sm font-semibold text-foreground">{report.reportNo}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Written by {report.preparedBy}, approved {report.approvedAt}.
        </p>
        <a
          href={`/workflow/${applicationId}/inspection-report`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-card px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
        >
          <FileText className="h-3.5 w-3.5" strokeWidth={1.8} />
          Open the report
        </a>
      </section>
    );
  }

  if (!canEdit && !canApprove) {
    return report ? (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-medium text-foreground">Inspection report</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Written by {report.preparedBy}
          {report.submittedAt ? `, sent for approval ${report.submittedAt}` : ", still being written"}.
        </p>
      </section>
    ) : null;
  }

  const field =
    "mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";
  const label = "text-xs font-semibold uppercase tracking-widest text-muted-foreground";

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-medium text-foreground">
        <ClipboardList className="h-4 w-4 text-primary" strokeWidth={2} />
        প্রারম্ভিক পরিদর্শন প্রতিবেদন
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Only what you learned at the factory. The product, the standards, the
        company and the factory are printed from the file — you do not retype them.
      </p>

      {/* §1 — what the file already knows, shown so the officer can check it
          against what he saw rather than copy it out. */}
      <dl className="mt-4 grid gap-x-6 gap-y-1.5 rounded-xl bg-secondary/60 p-3 text-sm sm:grid-cols-2">
        <Ctx label="পণ্য" value={context.productName} />
        <Ctx label="বিডিএস নং" value={context.standards.join(", ") || null} />
        <Ctx label="প্রতিষ্ঠান" value={context.companyName} />
        <Ctx
          label="কারখানা"
          value={[context.factoryName, context.factoryDistrict].filter(Boolean).join(", ")}
        />
        <Ctx label="ঘোষিত উৎপাদন ক্ষমতা" value={context.declaredCapacity} />
        <Ctx label="ঘোষিত চলতি বছরের উৎপাদন" value={context.declaredYearProduction} />
      </dl>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>খ) দরখাস্তকারীর নাম</span>
          <input
            value={form.applicantName}
            onChange={(e) => setForm((f) => ({ ...f, applicantName: e.target.value }))}
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>পদবি</span>
          <input
            value={form.applicantDesignation}
            onChange={(e) => setForm((f) => ({ ...f, applicantDesignation: e.target.value }))}
            className={field}
          />
        </label>
      </div>

      <div className="mt-4">
        <span className={label}>ঙ) সরকারি অনুমোদন</span>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <Radio
            name="govt"
            checked={form.govtApprovalOk === true}
            onChange={() => setForm((f) => ({ ...f, govtApprovalOk: true }))}
            label="সঠিক"
          />
          <Radio
            name="govt"
            checked={form.govtApprovalOk === false}
            onChange={() => setForm((f) => ({ ...f, govtApprovalOk: false }))}
            label="সঠিক নয়"
          />
          <input
            value={form.govtApprovalNote}
            onChange={(e) => setForm((f) => ({ ...f, govtApprovalNote: e.target.value }))}
            placeholder="মন্তব্য"
            className="min-w-40 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <Heading>২(খ) স্বাস্থ্য ও পরিবেশগত অবস্থা</Heading>
      <ul className="space-y-2">
        {conditions.map((c) => (
          <li key={c.key} className="flex flex-wrap items-center gap-2">
            <span className="w-52 shrink-0 text-sm text-foreground">{c.labelBn}</span>
            <Radio
              name={`c-${c.key}`}
              checked={cond[c.key].satisfactory}
              onChange={() => setCond((s) => ({ ...s, [c.key]: { ...s[c.key], satisfactory: true } }))}
              label="সন্তোষজনক"
            />
            <Radio
              name={`c-${c.key}`}
              checked={!cond[c.key].satisfactory}
              onChange={() => setCond((s) => ({ ...s, [c.key]: { ...s[c.key], satisfactory: false } }))}
              label="সন্তোষজনক নয়"
            />
            <input
              value={cond[c.key].note}
              onChange={(e) => setCond((s) => ({ ...s, [c.key]: { ...s[c.key], note: e.target.value } }))}
              placeholder="মন্তব্য"
              className="min-w-32 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
            />
          </li>
        ))}
      </ul>

      <Heading>২(ঙ–ছ) উৎপাদন — যা পাওয়া গেল</Heading>
      <div className="grid gap-4 sm:grid-cols-4">
        <label className="block">
          <span className={label}>ক্ষমতা</span>
          <input
            value={form.foundCapacityValue}
            onChange={(e) => setForm((f) => ({ ...f, foundCapacityValue: e.target.value }))}
            inputMode="decimal"
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>একক</span>
          <select
            value={form.foundCapacityUnitId}
            onChange={(e) => setForm((f) => ({ ...f, foundCapacityUnitId: e.target.value }))}
            className={field}
          >
            <option value="">—</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} · {u.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>উৎপাদনের হার (%)</span>
          <input
            value={form.utilisationPercent}
            onChange={(e) => setForm((f) => ({ ...f, utilisationPercent: e.target.value }))}
            inputMode="decimal"
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>ইউনিট প্রতি মূল্য (৳)</span>
          <input
            value={form.unitCostTaka}
            onChange={(e) => setForm((f) => ({ ...f, unitCostTaka: e.target.value }))}
            inputMode="decimal"
            className={field}
          />
        </label>
      </div>

      <Heading>২(জ) মোড়কীকরণ এবং চিহ্নিতকরণ</Heading>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {markings.map((m, i) => (
          <li key={m.key} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 odd:bg-secondary/40">
            <span className="text-sm text-foreground">
              <span className="mr-1.5 text-xs text-muted-foreground">{i + 1}.</span>
              {m.labelBn}
            </span>
            <span className="flex shrink-0 gap-2">
              <Radio name={`m-${m.key}`} checked={mark[m.key]} onChange={() => setMark((s) => ({ ...s, [m.key]: true }))} label="আছে" />
              <Radio name={`m-${m.key}`} checked={!mark[m.key]} onChange={() => setMark((s) => ({ ...s, [m.key]: false }))} label="নাই" />
            </span>
          </li>
        ))}
      </ul>

      <Heading>বিবরণ</Heading>
      <div className="space-y-3">
        {narrative.map((n) => (
          <label key={n.key} className="block">
            <span className="text-sm text-foreground">{n.labelBn}</span>
            <textarea
              value={ans[n.key]}
              onChange={(e) => setAns((s) => ({ ...s, [n.key]: e.target.value }))}
              rows={2}
              className={field}
            />
          </label>
        ))}
        <label className="block">
          <span className={label}>মন্তব্য</span>
          <textarea
            value={form.remarks}
            onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
            rows={2}
            className={field}
          />
        </label>
      </div>

      {gaps.length > 0 && report && (
        <ul className="mt-4 space-y-1 rounded-xl bg-amber-500/5 p-3 text-xs text-muted-foreground">
          {gaps.map((g) => (
            <li key={g}>• {g}</li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {canEdit && (
          <button
            type="button"
            onClick={() => send("report", payload())}
            disabled={busy !== null}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy === "report" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Save the report
          </button>
        )}

        {canEdit && report && approverName && (
          <button
            type="button"
            onClick={() => send("send-report")}
            disabled={busy !== null || gaps.length > 0}
            title={gaps.length > 0 ? "Finish the report first." : undefined}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "send-report" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <SendHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Send to {approverName} for approval
          </button>
        )}

        {canApprove && report && (
          <button
            type="button"
            onClick={() => send("approve-report")}
            disabled={busy !== null}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/40 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/5 disabled:opacity-50"
          >
            {busy === "approve-report" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Approve the report
          </button>
        )}
      </div>
    </section>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 mt-6 border-t border-border pt-4 text-sm font-semibold text-foreground">
      {children}
    </h3>
  );
}

function Ctx({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

function Radio({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-foreground">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}
