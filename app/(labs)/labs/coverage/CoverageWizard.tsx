"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check, ChevronDown, Search, X } from "lucide-react";
import StepNavButton from "@/components/StepNavButton";
import { officeShortName } from "@/lib/labs/grid";
import type { ProductRow } from "@/lib/labs/catalogue";
import type { PackageState, ParameterState } from "@/lib/labs/coverage";

type Office = {
  id: number; nameEn: string; labCount: number;
  /** The kinds of test its open benches can actually receive. */
  disciplines: string[];
};
type Candidate = {
  id: number; nameEn: string;
  product: { id: number; nameEn: string };
  _count: { parameters: number };
};

const STEPS = [
  { n: 1, label: "Products you handle" },
  { n: 2, label: "Their variants" },
  { n: 3, label: "What you can test" },
];

export default function CoverageWizard(props: {
  step: number;
  officeId: number;
  officeName: string;
  offices: Office[];
  ownLabs: { id: number; nameEn: string; discipline: string }[];
  products: ProductRow[];
  scopedProductIds: number[];
  candidates: Candidate[];
  inScope: number[];
  packages: PackageState[];
  canPickOffice: boolean;
}) {
  const { step, officeId, canPickOffice, offices } = props;
  const router = useRouter();
  const [, start] = useTransition();
  const q = `&office=${officeId}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <ol className="flex flex-1 flex-wrap items-center gap-2 text-sm">
          {STEPS.map((s) => (
            <li key={s.n}>
              <StepNavButton
                href={`/labs/coverage?step=${s.n}${q}`}
                className={`rounded-lg border px-3 py-1.5 ${
                  s.n === step
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <span className="tabular-nums opacity-70">{s.n}</span> {s.label}
              </StepNavButton>
            </li>
          ))}
        </ol>
        {canPickOffice && (
          <select
            value={officeId}
            onChange={(e) =>
              start(() => router.push(`/labs/coverage?step=${step}&office=${e.target.value}`))
            }
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
          >
            {offices.map((o) => (
              <option key={o.id} value={o.id}>{o.nameEn}</option>
            ))}
          </select>
        )}
      </div>

      {props.ownLabs.length === 0 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>{props.officeName} has no laboratory.</strong> You can still say which products
          you handle, and every one of their tests will have to be sent to another office —
          which is exactly what this form is for. Twelve offices are in this position.
        </p>
      )}

      {step === 1 && <StepProducts {...props} />}
      {step === 2 && <StepVariants {...props} />}
      {step === 3 && <StepCapability {...props} />}
    </div>
  );
}

// ── Step 1 ──────────────────────────────────────────────────────────────────

/**
 * Pick the products this office handles.
 *
 * Searchable by name **and by BDS number**, because the standard is what is
 * written on the file in front of whoever is doing the entry. Selecting a
 * product takes on every variant beneath it; step 2 is where the odd one comes
 * back off.
 */
function StepProducts({
  officeId, products, scopedProductIds,
}: {
  officeId: number; products: ProductRow[]; scopedProductIds: number[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selected = useMemo(() => new Set(scopedProductIds), [scopedProductIds]);

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return products.filter((p) => !selected.has(p.id)).slice(0, 40);
    return products
      .filter(
        (p) =>
          !selected.has(p.id) &&
          (p.nameEn.toLowerCase().includes(n) ||
            String(p.serial) === n ||
            p.standards.some((s) => s.toLowerCase().includes(n))),
      )
      .slice(0, 40);
  }, [products, q, selected]);

  async function change(add: number[], remove: number[]) {
    setError(null);
    const res = await fetch("/api/labs/coverage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "products", officeId, add, remove }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? "That did not save.");
      return;
    }
    start(() => router.refresh());
  }

  const chosen = products.filter((p) => selected.has(p.id));

  return (
    <>
      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">
            Which products do clients apply for at this office?
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Search by product name, by serial number, or by the standard — &ldquo;BDS 1221&rdquo;
            finds it as readily as &ldquo;sewing thread&rdquo;.
          </p>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search 203 products with test parameters on file"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-border">
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={pending}
                onClick={() => change([p.id], [])}
                className="flex w-full items-center gap-3 border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-secondary disabled:opacity-50"
              >
                <span className="w-8 shrink-0 tabular-nums text-xs text-muted-foreground">
                  {p.serial}
                </span>
                <span className="flex-1">{p.nameEn}</span>
                <span className="text-xs text-muted-foreground">
                  {p.standards.slice(0, 2).join(", ")}
                </span>
                <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                  {p.subProducts} variant{p.subProducts === 1 ? "" : "s"}
                </span>
              </button>
            ))}
            {!matches.length && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {q ? "Nothing matches." : "Everything is already on your list."}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">
            On this office&rsquo;s list
            <span className="ml-2 font-normal text-muted-foreground">{chosen.length}</span>
          </h2>
          {chosen.length > 0 && (
            <StepNavButton
              href={`/labs/coverage?step=2&office=${officeId}`}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white"
            >
              Next — check the variants
            </StepNavButton>
          )}
        </div>
        {chosen.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nothing chosen yet.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 p-4">
            {chosen.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => change([], [p.id])}
                  title="Take off the list"
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground hover:bg-secondary/70 disabled:opacity-50"
                >
                  {p.nameEn}
                  <X className="h-3.5 w-3.5 opacity-60" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// ── Step 2 ──────────────────────────────────────────────────────────────────

/** All on by default; take off what this office does not see. */
function StepVariants({
  officeId, candidates, inScope,
}: {
  officeId: number; candidates: Candidate[]; inScope: number[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<number, boolean>>({});
  const base = useMemo(() => new Set(inScope), [inScope]);
  const on = (id: number) => draft[id] ?? base.has(id);

  const byProduct = useMemo(() => {
    const m = new Map<number, { name: string; rows: Candidate[] }>();
    for (const c of candidates) {
      if (!m.has(c.product.id)) m.set(c.product.id, { name: c.product.nameEn, rows: [] });
      m.get(c.product.id)!.rows.push(c);
    }
    return [...m.values()];
  }, [candidates]);

  async function toggle(subProductId: number, selected: boolean) {
    setDraft((d) => ({ ...d, [subProductId]: selected }));
    await fetch("/api/labs/coverage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "sub-product", officeId, subProductId, selected }),
    });
    start(() => router.refresh());
  }

  const total = candidates.filter((c) => on(c.id)).length;

  if (!candidates.length)
    return (
      <p className="rounded-xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
        No products on the list yet — go back to step 1.
      </p>
    );

  return (
    <>
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3">
        <p className="text-sm">
          <strong>{total}</strong> variants selected of {candidates.length}.{" "}
          <span className="text-muted-foreground">
            A product with none selected drops off your list.
          </span>
        </p>
        <StepNavButton
          href={`/labs/coverage?step=3&office=${officeId}`}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white"
        >
          Next — what you can test
        </StepNavButton>
      </div>

      {byProduct.map((g) => (
        <section key={g.name} className="rounded-2xl border border-border bg-card">
          <h2 className="border-b border-border px-5 py-2.5 text-sm font-semibold">{g.name}</h2>
          <ul className="divide-y divide-border/60">
            {g.rows.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={on(c.id)}
                  disabled={pending}
                  onChange={(e) => toggle(c.id, e.target.checked)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <span className={on(c.id) ? "" : "text-muted-foreground line-through"}>
                  {c.nameEn}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {c._count.parameters} tests
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

// ── Step 3 ──────────────────────────────────────────────────────────────────

/**
 * Fully capable / partly / not here — and where the rest goes.
 *
 * Saved a package at a time, because an office with forty products has two
 * hundred of these and that is several sittings.
 */
/**
 * Full, partial, or nothing yet — and the drill-down only where it is partial.
 *
 * Saved a package at a time, because an office with forty products has two
 * hundred of these and that is several sittings.
 */
function StepCapability({
  officeId, ownLabs, packages,
}: {
  officeId: number;
  ownLabs: { id: number; nameEn: string; discipline: string }[];
  packages: PackageState[];
}) {
  if (!packages.length)
    return (
      <p className="rounded-xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
        Nothing on your list yet — start at step 1.
      </p>
    );

  const answered = packages.filter((p) => p.level !== "unanswered").length;

  return (
    <>
      <div className="rounded-xl border border-border bg-card px-5 py-3 text-sm">
        <strong>{answered}</strong> of {packages.length} packages answered.{" "}
        <span className="text-muted-foreground">
          Each one saves on its own, so you can stop and come back. You only say what you{" "}
          <em>can</em> test — anything you leave out is simply not yours, and the system finds an
          office that can.
        </span>
      </div>
      {packages.map((p) => (
        <PackageRow key={p.subProductId} pkg={p} officeId={officeId} ownLabs={ownLabs} />
      ))}
    </>
  );
}

const LEVEL_STYLE: Record<string, string> = {
  full: "bg-secondary text-secondary-foreground",
  partial: "bg-primary/10 text-primary",
  unanswered: "border border-dashed border-amber-400 text-amber-700 dark:text-amber-300",
};
const LEVEL_LABEL: Record<string, string> = {
  full: "All of it",
  partial: "Some of it",
  unanswered: "Not answered",
};

/** What an office does with one test. Absence of a row is the third answer. */
type Cover = "in_house" | "third_party" | "none";

function PackageRow({
  pkg, officeId, ownLabs,
}: {
  pkg: PackageState;
  officeId: number;
  ownLabs: { id: number; nameEn: string; discipline: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(pkg.level === "unanswered");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [choice, setChoice] = useState<"full" | "partial">(
    pkg.level === "partial" ? "partial" : "full",
  );
  // Per-test answers, seeded from what is recorded. A test the office has no
  // bench for defaults to "sent out" rather than to nothing: that is Faridpur's
  // case exactly, and it is the answer the model exists to allow.
  const [cover, setCover] = useState<Record<number, Cover>>(
    Object.fromEntries(
      pkg.parameters.map((p) => [
        p.id,
        (p.manner ?? (p.ownLabId ? "in_house" : "third_party")) as Cover,
      ]),
    ),
  );

  const effective = (p: ParameterState): Cover =>
    choice === "full"
      ? (cover[p.id] === "none" ? (p.ownLabId ? "in_house" : "third_party") : cover[p.id])
      : (cover[p.id] ?? "none");

  const noBench = pkg.parameters.filter((p) => p.ownLabId === null);

  async function save() {
    setError(null); setNote(null);
    const inHouse = pkg.parameters.filter((p) => effective(p) === "in_house").map((p) => p.id);
    const thirdParty = pkg.parameters.filter((p) => effective(p) === "third_party").map((p) => p.id);
    const res = await fetch("/api/labs/coverage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "package", officeId, subProductId: pkg.subProductId, inHouse, thirdParty }),
    });
    const json = (await res.json()) as {
      error?: string; inHouse?: number; thirdParty?: number; notCovered?: number;
    };
    if (!res.ok) { setError(json.error ?? "That did not save."); return; }
    setNote(
      `Saved — ${json.inHouse} on your own bench, ${json.thirdParty} sent out` +
        (json.notCovered ? `, ${json.notCovered} not yours.` : "."),
    );
    start(() => router.refresh());
  }

  return (
    <section className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-3 text-left"
      >
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{pkg.subProductName}</span>
          <span className="block truncate text-xs text-muted-foreground">{pkg.productName}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{pkg.parameters.length} tests</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${LEVEL_STYLE[pkg.level] ?? LEVEL_STYLE.unanswered}`}>
          {LEVEL_LABEL[pkg.level] ?? LEVEL_LABEL.unanswered}
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["full", "We can cover all of these"],
                ["partial", "Only some of them"],
              ] as const
            ).map(([k, label]) => (
              <label
                key={k}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                  choice === k ? "border-primary bg-primary/5 text-primary" : "border-border"
                }`}
              >
                <input
                  type="radio" className="sr-only"
                  checked={choice === k}
                  onChange={() => setChoice(k)}
                />
                {label}
              </label>
            ))}
          </div>

          {noBench.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              {noBench.length} of these are {noBench[0]?.discipline} tests and this office has no{" "}
              {noBench[0]?.discipline} laboratory, so covering them means sending them to an
              accredited outside laboratory and entering the result here.
              {ownLabs.length > 0 && <> Your benches: {ownLabs.map((l) => l.nameEn).join(", ")}.</>}
            </p>
          )}

          {choice === "partial" && (
            <table className="mt-4 w-full text-sm">
              <tbody>
                {pkg.parameters.map((p) => {
                  const v = effective(p);
                  return (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="py-1.5 pr-3">{p.nameEn}</td>
                      <td className="w-12 py-1.5 text-xs text-muted-foreground">{p.discipline}</td>
                      <td className="w-72 py-1.5 text-right">
                        <div className="flex justify-end gap-1">
                          {(
                            [
                              ["in_house", "Our bench", p.ownLabId !== null],
                              ["third_party", "Sent out", true],
                              ["none", "Not ours", true],
                            ] as const
                          ).map(([k, label, allowed]) => (
                            <button
                              key={k}
                              type="button"
                              disabled={!allowed}
                              onClick={() => setCover((c) => ({ ...c, [p.id]: k }))}
                              title={
                                allowed
                                  ? undefined
                                  : `This office has no ${p.discipline} laboratory.`
                              }
                              className={`rounded-md border px-2 py-0.5 text-xs disabled:opacity-30 ${
                                v === k
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {choice === "full" && (
            <p className="mt-3 text-xs text-muted-foreground">
              All {pkg.parameters.length} tests recorded as yours —{" "}
              {pkg.parameters.filter((p) => effective(p) === "in_house").length} on your own bench
              and {pkg.parameters.filter((p) => effective(p) === "third_party").length} sent out.
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          )}
          {note && (
            <p className="mt-3 flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {note}
            </p>
          )}

          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Save this package
          </button>
        </div>
      )}
    </section>
  );
}
