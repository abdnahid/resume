"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Pencil, RefreshCw, X } from "lucide-react";
import { formatPoisha } from "@/lib/payments/money";
import { packageDays } from "@/lib/labs/turnaround";
import {
  URGENT_SOURCE_LABEL, URGENT_SOURCE_NOTE, urgentFeeIsProvisional,
  type UrgentFeeSource,
} from "@/lib/labs/urgent-fee";

type SubParameter = { id: number; label: string; limitText: string | null; limitKind: string };
type Parameter = {
  id: number;
  nameEn: string;
  feePoisha: number;
  urgentFeePoisha: number;
  urgentFeeSource: UrgentFeeSource;
  normalDays: number | null;
  urgentDays: number | null;
  discipline: string;
  sourceSection: string;
  limitText: string | null;
  limitKind: string;
  method: { id: number; designation: string } | null;
  subParameters: SubParameter[];
  _count: { officeCapabilities: number };
};
type PackageFee = {
  sourceSection: string;
  statedNormalFeePoisha: number | null;
  statedUrgentFeePoisha: number | null;
  summedNormalFeePoisha: number;
  turnaroundNormalDays: number | null;
  turnaroundUrgentDays: number | null;
};

const SECTION_LABEL: Record<string, string> = {
  textile: "Textile",
  "chemical-food": "Chemical (food)",
  "chemical-non-food": "Chemical (non-food)",
};
const LIMIT_KIND_NOTE: Record<string, string> = {
  rule: "a pass/fail limit from the standard",
  declared: "the manufacturer states the value and the test confirms it",
  cross_reference: "the limit is delegated to another standard",
  unspecified: "the source left this blank",
};

const taka = (poisha: number) => (poisha / 100).toString();
const toPoisha = (v: string) => Math.round(Number(v) * 100);

/**
 * The package: what it costs, how long it takes, and every test in it.
 *
 * Edits go one row at a time behind an explicit toggle rather than as
 * always-live inputs. A fee is money somebody will be charged, and a stray
 * keystroke in a table of ninety rows is not a thing anyone would notice.
 */
export default function PackageEditor({
  subProductId, nameEn, packageFees, parameters, methods, canEdit,
}: {
  subProductId: number;
  nameEn: string;
  packageFees: PackageFee[];
  parameters: Parameter[];
  methods: { id: number; designation: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  // A package's turnaround is the longest of the tests it contains (D115) —
  // they run in parallel and the report waits for the slowest bench.
  const { normalDays, urgentDays } = packageDays(parameters);

  const normalTotal = parameters.reduce((a, p) => a + p.feePoisha, 0);
  const urgentTotal = parameters.reduce((a, p) => a + p.urgentFeePoisha, 0);

  async function send(url: string, body: unknown) {
    setError(null);
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) { setError(json.error ?? "That did not save."); return false; }
    start(() => router.refresh());
    return true;
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      {/* ── What the wing published, beside what we hold ───────────────────── */}
      <section className="rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">What this package costs</h2>
          {canEdit && (
            <button
              type="button"
              disabled={pending}
              onClick={() => send(`/api/labs/sub-products/${subProductId}`, { reprice: true })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary/40 disabled:opacity-50"
              title="Re-derive every urgent fee from the turnaround and the wing's published total. Fees entered by hand are left alone."
            >
              <RefreshCw className="h-3.5 w-3.5" /> Re-price urgent fees
            </button>
          )}
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-3">
          <Figure label="Normal" value={formatPoisha(normalTotal)} note={`${parameters.length} tests`} />
          <Figure
            label="Urgent"
            value={formatPoisha(urgentTotal)}
            note={
              normalTotal > 0
                ? `${(urgentTotal / normalTotal).toFixed(2)}× the normal fee`
                : "no fees on file"
            }
          />
          <div className="bg-card px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Turnaround
            </p>
            <p className="mt-1 font-display text-2xl font-medium tabular-nums">
              {normalDays ?? "?"}d
              <span className="text-base text-muted-foreground"> / </span>
              {urgentDays ?? "?"}d
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              normal / urgent, and <strong>derived</strong>: the days belong to each test now, so
              a package takes as long as its slowest one. Edit a test below to change it — which
              also re-prices, since a package whose urgent turnaround is not shorter carries no
              surcharge.
            </p>
          </div>
        </div>

        {packageFees.length > 0 && (
          <div className="border-t border-border px-5 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              As each wing published it
            </p>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {packageFees.map((f) => {
                  const off =
                    f.statedNormalFeePoisha !== null &&
                    f.statedNormalFeePoisha !== f.summedNormalFeePoisha;
                  return (
                    <tr key={f.sourceSection} className="border-t border-border/60 first:border-0">
                      <td className="py-1.5 pr-4">{SECTION_LABEL[f.sourceSection] ?? f.sourceSection}</td>
                      <td className="py-1.5 pr-4 tabular-nums">
                        {f.statedNormalFeePoisha === null ? (
                          <span className="text-muted-foreground">no total published</span>
                        ) : (
                          <>stated {formatPoisha(f.statedNormalFeePoisha)} normal</>
                        )}
                      </td>
                      <td className="py-1.5 pr-4 tabular-nums">
                        {f.statedUrgentFeePoisha !== null && (
                          <>{formatPoisha(f.statedUrgentFeePoisha)} urgent</>
                        )}
                      </td>
                      <td className="py-1.5 tabular-nums text-muted-foreground">
                        our rows sum to {formatPoisha(f.summedNormalFeePoisha)}
                        {off && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                            disagrees — open with the wing
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── The tests ──────────────────────────────────────────────────────── */}
      <section className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 font-medium">Test</th>
              <th className="px-4 py-2.5 font-medium">Standard limit</th>
              <th className="px-4 py-2.5 font-medium">Method</th>
              <th className="px-4 py-2.5 text-right font-medium">Days</th>
              <th className="px-4 py-2.5 text-right font-medium">Normal</th>
              <th className="px-4 py-2.5 text-right font-medium">Urgent</th>
              <th className="px-4 py-2.5 font-medium">Offices</th>
              {canEdit && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {parameters.map((p) =>
              editing === p.id ? (
                <EditRow
                  key={p.id}
                  parameter={p}
                  methods={methods}
                  pending={pending}
                  onCancel={() => setEditing(null)}
                  onSave={async (body) => {
                    const ok = await send(`/api/labs/parameters/${p.id}`, body);
                    if (ok) setEditing(null);
                  }}
                />
              ) : (
                <tr key={p.id} className="border-b border-border/60 align-top last:border-0">
                  <td className="px-4 py-2">
                    <span className="font-medium">{p.nameEn}</span>
                    <span className="ml-2 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-secondary-foreground">
                      {p.discipline}
                    </span>
                    {p.subParameters.length > 0 && (
                      <ul className="mt-1 space-y-0.5 border-l border-border pl-3 text-xs text-muted-foreground">
                        {p.subParameters.map((s) => (
                          <li key={s.id}>
                            {s.label}
                            {s.limitText && <span className="ml-2 text-foreground/70">{s.limitText}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {p.subParameters.length ? (
                      <span className="text-muted-foreground">
                        per sub-parameter, above
                      </span>
                    ) : (
                      <>
                        {p.limitText ?? <span className="text-muted-foreground">—</span>}
                        {p.limitKind !== "rule" && (
                          <span
                            title={LIMIT_KIND_NOTE[p.limitKind]}
                            className="ml-2 cursor-help rounded-full bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-secondary-foreground"
                          >
                            {p.limitKind.replace("_", " ")}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {p.method?.designation ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {p.normalDays ?? "?"}d / {p.urgentDays ?? "?"}d
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatPoisha(p.feePoisha)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatPoisha(p.urgentFeePoisha)}
                    <span
                      title={URGENT_SOURCE_NOTE[p.urgentFeeSource]}
                      className={`ml-1.5 cursor-help rounded-full px-1.5 py-0.5 text-[10px] ${
                        urgentFeeIsProvisional(p.urgentFeeSource)
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {URGENT_SOURCE_LABEL[p.urgentFeeSource]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs tabular-nums">
                    {p._count.officeCapabilities ? (
                      `${p._count.officeCapabilities}`
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400" title="No office has said it can run this test, so an application naming it cannot resolve">
                        none
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(p.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        <strong>{nameEn}</strong> owns these parameters outright — the same test name under
        another sub-product is a different row with its own limit and its own fee, deliberately,
        because 94 of the 181 distinct textile parameter names carry more than one limit. Editing
        a fee here changes this package and nothing else. An urgent fee you type is marked{" "}
        <em>{URGENT_SOURCE_LABEL.manual}</em> and is never overwritten by a re-price.
      </p>
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function EditRow({
  parameter: p, methods, pending, onCancel, onSave,
}: {
  parameter: Parameter;
  methods: { id: number; designation: string }[];
  pending: boolean;
  onCancel: () => void;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const [nameEn, setName] = useState(p.nameEn);
  const [fee, setFee] = useState(taka(p.feePoisha));
  const [urgent, setUrgent] = useState(taka(p.urgentFeePoisha));
  const [limit, setLimit] = useState(p.limitText ?? "");
  const [methodId, setMethodId] = useState(p.method?.id ?? 0);

  return (
    <tr className="border-b border-border/60 bg-secondary/40 align-top last:border-0">
      <td className="px-4 py-2">
        <input
          value={nameEn}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-2">
        {p.subParameters.length ? (
          <span className="text-xs text-muted-foreground">
            The limit belongs to each sub-parameter, not here.
          </span>
        ) : (
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
          />
        )}
      </td>
      <td className="px-4 py-2">
        <select
          value={methodId}
          onChange={(e) => setMethodId(Number(e.target.value))}
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
        >
          <option value={0}>— none —</option>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>{m.designation}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2 text-right">
        <input
          type="number" step="0.01" min="0" value={fee}
          onChange={(e) => setFee(e.target.value)}
          className="w-24 rounded border border-border bg-background px-2 py-1 text-right text-sm tabular-nums"
        />
      </td>
      <td className="px-4 py-2 text-right">
        <input
          type="number" step="0.01" min="0" value={urgent}
          onChange={(e) => setUrgent(e.target.value)}
          className="w-24 rounded border border-border bg-background px-2 py-1 text-right text-sm tabular-nums"
        />
      </td>
      <td className="px-4 py-2" />
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-1">
          <button
            type="button" disabled={pending}
            onClick={() =>
              onSave({
                nameEn,
                feePoisha: toPoisha(fee),
                urgentFeePoisha: toPoisha(urgent),
                ...(p.subParameters.length ? {} : { limitText: limit.trim() || null }),
                methodId: methodId || null,
              })
            }
            className="rounded p-1 text-primary hover:bg-secondary disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
          </button>
          <button type="button" onClick={onCancel} className="rounded p-1 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
