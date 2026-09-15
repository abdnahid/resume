"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, FlaskConical, PackageCheck, Send, Undo2 } from "lucide-react";
import { ORDER_STATE_LABELS, type LabOrderState } from "@/lib/labs/ladder";

/**
 * The bench: receive, pass down, record readings, and move the report up.
 *
 * **Every control is offered from a server-derived permission** and refused
 * again by the service — a rule enforced where the button is holds only for
 * people who used the button.
 */

type Verdict = "pass" | "fail" | "inconclusive" | "not_tested";

type Line = {
  orderItemId: number;
  parameterName: string;
  label: string;
  discipline: string;
  method: string | null;
  limit: string | null;
  limitKind: string;
  subParameterId: number | null;
  bySample: {
    sampleId: number;
    labCode: string;
    specimenNo: number;
    observedValue: string;
    verdict: Verdict;
  }[];
};

type Sig = { nameEn: string; nameBn: string; designation: string | null; at: string | null } | null;

export default function OrderWorkspace({
  order,
  specimens,
  lines,
  actions,
  gaps,
  candidates,
  signaturePlan,
  report,
  flow,
}: {
  order: {
    id: number;
    code: string;
    state: string;
    isUrgent: boolean;
    labName: string | null;
    discipline: string | null;
    officeName: string;
    productName: string;
    subProductName: string;
    standard: string | null;
    receivedByWingAt: string | null;
    receivedByWingName: string | null;
    holderName: string | null;
    holderRung: string | null;
  };
  specimens: { id: number; labCode: string; specimenNo: number; state: string }[];
  lines: Line[];
  actions: Awaited<ReturnType<typeof import("@/lib/labs/board").actionsFor>>;
  gaps: string[];
  candidates: {
    rung: string | null;
    rungLabel: string | null;
    desks: { employeeId: string; nameEn: string; designation: string | null; isTestingOfficer: boolean }[];
  };
  signaturePlan: { testedBy: string; checkedBy: string | null; authorisedBy: string };
  report: {
    reportNo: string | null;
    verdict: string;
    remarks: string | null;
    returnedNote: string | null;
    testedBy: Sig;
    checkedBy: Sig;
    authorisedBy: Sig;
    approvedBy: Sig;
  } | null;
  flow: { id: number; at: string; text: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [passTo, setPassTo] = useState("");
  const [remarks, setRemarks] = useState(report?.remarks ?? "");
  const [returnNote, setReturnNote] = useState("");
  const [returning, setReturning] = useState(false);

  async function act(body: Record<string, unknown>, ok?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/labs/orders/${order.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not do that");
      if (ok) setNotice(ok);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const a = actions;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-foreground">{order.code}</span>
          {order.isUrgent && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-red-200">
              urgent
            </span>
          )}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
            {ORDER_STATE_LABELS[order.state as LabOrderState] ?? order.state}
          </span>
        </p>
        <h1 className="mt-1 font-display text-2xl font-medium text-foreground">
          {order.productName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {order.subProductName}
          {order.standard ? ` · ${order.standard}` : ""}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
          <span>{order.labName ?? `${order.officeName} — sent out`}</span>
          {order.holderName && (
            <span>
              with <span className="font-medium text-foreground">{order.holderName}</span>
              {order.holderRung ? ` (${order.holderRung.replace(/_/g, " ")})` : ""}
            </span>
          )}
          {order.receivedByWingAt && (
            <span>
              received by the wing{" "}
              {new Date(order.receivedByWingAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {order.receivedByWingName ? ` · ${order.receivedByWingName}` : ""}
            </span>
          )}
        </p>
      </div>

      {error && (
        <p className="flex gap-2 whitespace-pre-line rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      {notice && (
        <p className="flex gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <Check size={15} className="mt-0.5 shrink-0" />
          {notice}
        </p>
      )}
      {report?.returnedNote && (
        <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <Undo2 size={15} className="mt-0.5 shrink-0" />
          Sent back: {report.returnedNote}
        </p>
      )}

      {/* ── Receive ────────────────────────────────────────────────────── */}
      {a?.canReceive && (
        <Card title="Samples">
          <p className="text-sm text-muted-foreground">
            The One Stop counter has the box. Marking it received starts this
            wing&rsquo;s work and is what the field officer sees next.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => act({ action: "receive" }, "Samples received by the wing.")}
            className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <PackageCheck size={15} strokeWidth={1.8} /> Mark samples received
          </button>
        </Card>
      )}

      {/* **Waiting on the counter, said rather than shown as a dead button.**
          A wing head who can otherwise receive sees why he cannot, and which
          box to chase — the refusal used to arrive only when he clicked. */}
      {a?.isHead && !a.canReceive && a.awaitingBoxes.length > 0 && (
        <Card title="Samples">
          <p className="text-sm text-muted-foreground">
            Not handed in at the One Stop counter yet, so this wing cannot take
            it in. Testing begins once the counter has the box.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {a.awaitingBoxes.map((code) => (
              <li
                key={code}
                className="rounded-md bg-secondary px-2 py-1 font-mono text-xs text-secondary-foreground"
              >
                {code}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Specimens ──────────────────────────────────────────────────── */}
      <Card title={`Specimens (${specimens.length})`}>
        <ul className="flex flex-wrap gap-2">
          {specimens.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
              title={s.state}
            >
              <span className="text-muted-foreground">#{s.specimenNo}</span>{" "}
              <span className="font-mono font-medium text-foreground">{s.labCode}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* ── Results ────────────────────────────────────────────────────── */}
      <Card title={`Parameters (${lines.length})`}>
        {a?.canEnterResults ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Record what you observed and mark it against the limit. The limit is
            printed as the standard states it — it is not always a number, so the
            pass/fail is yours.
          </p>
        ) : (
          <p className="mb-3 text-xs text-muted-foreground">
            Read only. {a?.isTO ? "This order is not on your bench." : "Results are entered by the testing officer."}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Parameter</th>
                <th className="py-2 pr-3 font-medium">Limit</th>
                {specimens.map((s) => (
                  <th key={s.id} className="py-2 pr-3 font-medium">
                    #{s.specimenNo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr
                  key={`${l.orderItemId}-${l.subParameterId ?? "self"}`}
                  className="border-b border-border/50 align-top"
                >
                  <td className="py-2 pr-3">
                    <p className="text-foreground">{l.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {l.discipline}
                      {l.method ? ` · ${l.method}` : ""}
                    </p>
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {l.limit ?? <span className="italic">not specified</span>}
                    {l.limitKind === "declared" && (
                      <span className="ml-1 rounded bg-secondary px-1 text-[10px]">declared</span>
                    )}
                  </td>
                  {l.bySample.map((s) => (
                    <td key={s.sampleId} className="py-2 pr-3">
                      <ResultCell
                        line={l}
                        cell={s}
                        editable={!!a?.canEnterResults}
                        busy={busy}
                        onSave={(observedValue, verdict) =>
                          act({
                            action: "result",
                            orderItemId: l.orderItemId,
                            sampleId: s.sampleId,
                            subParameterId: l.subParameterId,
                            observedValue,
                            verdict,
                          })
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Pass down ──────────────────────────────────────────────────── */}
      {a?.canPass && candidates.rung && candidates.desks.length > 0 && (
        <Card title={`Pass to ${candidates.rungLabel}`}>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-64 flex-1">
              <span className="text-xs font-medium text-foreground">Who</span>
              <select
                value={passTo}
                onChange={(e) => setPassTo(e.target.value)}
                className="mt-1 w-full cursor-pointer rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">Choose…</option>
                {candidates.desks.map((d) => (
                  <option key={d.employeeId} value={d.employeeId}>
                    {d.nameEn}
                    {d.designation ? ` — ${d.designation}` : ""}
                    {d.isTestingOfficer ? " · testing officer" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !passTo}
              onClick={() => act({ action: "pass", toEmployeeId: passTo }, "Passed on.")}
              className="cursor-pointer rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Pass down
            </button>
          </div>
          {!candidates.desks.some((d) => d.isTestingOfficer) && candidates.rung === "examiner" && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              None of these desks holds the testing officer role, so none of them
              can enter a result. Grant it at /hr/listing/roles.
            </p>
          )}
        </Card>
      )}

      {/* ── The report ─────────────────────────────────────────────────── */}
      <Card title="Test report">
        <p className="text-xs text-muted-foreground">
          Signed by {signaturePlan.testedBy} (tested)
          {signaturePlan.checkedBy ? `, ${signaturePlan.checkedBy} (checked)` : ""}, then{" "}
          {signaturePlan.authorisedBy} (authorised), and approved by the wing head.
          {signaturePlan.authorisedBy === signaturePlan.testedBy &&
            " This office staffs one rung below the wing head, so the officer who tests also authorises."}
        </p>

        {report && (
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <Signature label="Tested by" sig={report.testedBy} />
            {signaturePlan.checkedBy && <Signature label="Checked by" sig={report.checkedBy} />}
            <Signature label="Authorised by" sig={report.authorisedBy} />
            <Signature label="Approved by" sig={report.approvedBy} />
          </dl>
        )}

        {report?.reportNo && (
          <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-sm">
            <span className="font-mono">{report.reportNo}</span>
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                report.verdict === "fail"
                  ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              }`}
            >
              {report.verdict}
            </span>
          </p>
        )}

        {a?.canSubmit && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            {gaps.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-medium">Not ready to submit:</p>
                <ul className="mt-1 list-inside list-disc">
                  {gaps.slice(0, 8).map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                  {gaps.length > 8 && <li>…and {gaps.length - 8} more</li>}
                </ul>
              </div>
            )}
            <label className="block">
              <span className="text-xs font-medium text-foreground">
                Remarks <span className="text-muted-foreground">(optional)</span>
              </span>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Conditions, deviations, condition of the specimens on arrival…"
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy || gaps.length > 0}
              onClick={() => act({ action: "submit", remarks }, "Results submitted.")}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Send size={15} strokeWidth={1.8} /> Submit results
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          {a?.canCheck && (
            <Act busy={busy} onClick={() => act({ action: "check" }, "Checked.")}>
              Check and send up
            </Act>
          )}
          {a?.canAuthorise && (
            <Act busy={busy} onClick={() => act({ action: "authorise" }, "Authorised.")}>
              Authorise
            </Act>
          )}
          {a?.canApprove && (
            <Act busy={busy} onClick={() => act({ action: "approve" }, "Report approved.")}>
              <FlaskConical size={15} strokeWidth={1.8} /> Approve the report
            </Act>
          )}
          {a?.canReturn && !returning && (
            <button
              type="button"
              onClick={() => setReturning(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
            >
              <Undo2 size={15} strokeWidth={1.8} /> Send back
            </button>
          )}
        </div>

        {returning && (
          <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/40">
            <p className="text-xs text-amber-900 dark:text-amber-200">
              This clears the check and the authorisation with it — they were
              given to the draft as it stands, not to the one that comes back.
            </p>
            <textarea
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              rows={2}
              placeholder="What needs correcting?"
              className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs text-slate-800"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || !returnNote.trim()}
                onClick={async () => {
                  if (await act({ action: "return", note: returnNote }, "Sent back.")) {
                    setReturning(false);
                    setReturnNote("");
                  }
                }}
                className="cursor-pointer rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Send it back
              </button>
              <button
                type="button"
                onClick={() => setReturning(false)}
                className="cursor-pointer rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Desk flow ──────────────────────────────────────────────────── */}
      <Card title="Inside the laboratory">
        <p className="mb-2 text-xs text-muted-foreground">
          The wing&rsquo;s own record. None of this reaches the field officer.
        </p>
        {flow.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ol className="space-y-1.5">
            {flow.map((m) => (
              <li key={m.id} className="flex flex-wrap gap-x-3 text-sm">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {new Date(m.at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="text-foreground">{m.text}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

function ResultCell({
  line,
  cell,
  editable,
  busy,
  onSave,
}: {
  line: Line;
  cell: Line["bySample"][number];
  editable: boolean;
  busy: boolean;
  onSave: (observedValue: string, verdict: Verdict) => void;
}) {
  const [value, setValue] = useState(cell.observedValue);
  const [verdict, setVerdict] = useState<Verdict>(cell.verdict);

  if (!editable) {
    return (
      <div className="text-xs">
        <p className="text-foreground">{cell.observedValue || "—"}</p>
        <VerdictTag v={cell.verdict} />
      </div>
    );
  }

  return (
    <div className="min-w-36 space-y-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== cell.observedValue) onSave(value, verdict);
        }}
        placeholder="observed"
        className="w-full rounded border border-border bg-card px-1.5 py-1 text-xs"
      />
      <select
        value={verdict}
        disabled={busy}
        onChange={(e) => {
          const v = e.target.value as Verdict;
          setVerdict(v);
          onSave(value, v);
        }}
        className="w-full cursor-pointer rounded border border-border bg-card px-1.5 py-1 text-xs"
      >
        <option value="not_tested">not tested</option>
        <option value="pass">pass</option>
        <option value="fail">fail</option>
        <option value="inconclusive">inconclusive</option>
      </select>
    </div>
  );
}

function VerdictTag({ v }: { v: Verdict }) {
  const tone =
    v === "pass"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : v === "fail"
        ? "bg-red-50 text-red-700 ring-red-200"
        : "bg-secondary text-muted-foreground ring-border";
  return (
    <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] ring-1 ${tone}`}>
      {v.replace(/_/g, " ")}
    </span>
  );
}

function Signature({ label, sig }: { label: string; sig: Sig }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">
        {sig ? (
          <>
            <span className="font-medium text-foreground">{sig.nameEn}</span>
            {sig.designation && (
              <span className="block text-xs text-muted-foreground">{sig.designation}</span>
            )}
            {sig.at && (
              <span className="block text-[11px] text-muted-foreground">
                {new Date(sig.at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  );
}

function Act({
  children,
  busy,
  onClick,
}: {
  children: React.ReactNode;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
