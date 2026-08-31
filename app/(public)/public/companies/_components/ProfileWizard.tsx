"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Factory as FactoryIcon, Network, Check, ArrowRight, ArrowLeft,
  Loader2, AlertCircle, Plus, Trash2, MapPin,
} from "lucide-react";
import AddressFields, { type Address, EMPTY_ADDRESS } from "./AddressFields";

/**
 * The guided profile builder.
 *
 * The three shapes are the ones clients actually arrive in, described in the
 * client's own terms rather than the schema's — someone registering a single
 * plant should not have to work out that they are a `standalone`.
 *
 * Nothing is written until the last step, so abandoning the wizard leaves no
 * half-made company behind.
 */

type Shape = "group_parent" | "standalone" | "factory_cum_company";

const SHAPES: {
  key: Shape;
  icon: typeof Building2;
  title: string;
  blurb: string;
  example: string;
}[] = [
  {
    key: "group_parent",
    icon: Network,
    title: "A group with several companies",
    blurb:
      "A mother organisation with more than one company under it, each at its own address, and each with its own factories.",
    example: "You will create the group first, then add its companies one by one.",
  },
  {
    key: "standalone",
    icon: Building2,
    title: "One company with several factories",
    blurb:
      "A single company that manufactures at more than one plant, in different places.",
    example: "You will create the company, then register each factory.",
  },
  {
    key: "factory_cum_company",
    icon: FactoryIcon,
    title: "A single factory",
    blurb: "The company and the factory are the same premises at the same address.",
    example: "The address you give is used for both.",
  },
];

const LEGAL_FORMS = [
  { value: "proprietorship", label: "Sole proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "limited", label: "Limited company" },
  { value: "group_entity", label: "Group / holding entity" },
];

type FactoryDraft = { nameEn: string; nameBn: string; address: Address; contactName: string; contactMobile: string };

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const label = "mb-1.5 block text-xs font-medium text-muted-foreground";

export default function ProfileWizard({
  parentId,
  parentName,
}: {
  /** Set when adding a company beneath an existing group. */
  parentId?: number;
  parentName?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A company created under a group is a member by definition — its shape is
  // settled, so the first step is skipped rather than asked pointlessly.
  const [shape, setShape] = useState<Shape | null>(parentId ? "standalone" : null);

  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [legalForm, setLegalForm] = useState("");
  const [tradeLicenceNo, setTradeLicenceNo] = useState("");
  const [tradeLicenceAuthority, setTradeLicenceAuthority] = useState("");
  const [tradeLicenceExpiry, setTradeLicenceExpiry] = useState("");
  const [binNo, setBinNo] = useState("");
  const [tinNo, setTinNo] = useState("");

  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);

  const [repName, setRepName] = useState("");
  const [repDesignation, setRepDesignation] = useState("");
  const [repMobile, setRepMobile] = useState("");
  const [repEmail, setRepEmail] = useState("");
  const [repNid, setRepNid] = useState("");

  const [factories, setFactories] = useState<FactoryDraft[]>([]);

  const isGroup = shape === "group_parent";
  const isSingle = shape === "factory_cum_company";

  const steps = [
    ...(parentId ? [] : ["Type"]),
    "Company",
    "Address",
    "Representative",
    ...(isGroup ? [] : ["Factories"]),
    "Review",
  ];

  // ── What each step needs before it will let you past ─────────────────────
  function blockingReason(): string | null {
    const name = steps[step];
    if (name === "Type" && !shape) return "Choose which one describes you.";
    if (name === "Company") {
      if (!nameEn.trim() && !nameBn.trim()) return "The company name is required.";
      if (!legalForm) return "Choose the company type.";
    }
    if (name === "Address" && !address.district) return "The district is required.";
    if (name === "Representative" && !repName.trim())
      return "Name the person authorised to sign for the company.";
    if (name === "Factories" && factories.length === 0 && !isSingle)
      return "Add at least one factory — a licence is granted for a specific plant.";
    return null;
  }

  function next() {
    const reason = blockingReason();
    if (reason) return setError(reason);
    setError(null);
    // A single-premises company has already given its factory address as its
    // own, so the factory is built from it rather than asked for twice.
    if (steps[step] === "Representative" && isSingle && factories.length === 0) {
      setFactories([
        {
          nameEn: nameEn || nameBn,
          nameBn: nameBn || nameEn,
          address: { ...address },
          contactName: repName,
          contactMobile: repMobile,
        },
      ]);
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const type = parentId ? "group_member" : isGroup ? "group_parent" : "standalone";
      const res = await fetch("/api/client/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, parentId, nameEn, nameBn, legalForm,
          tradeLicenceNo, tradeLicenceAuthority, tradeLicenceExpiry, binNo, tinNo,
          ...address,
          repName, repDesignation, repMobile, repEmail, repNid,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the company.");

      const organizationId: number = data.organization.id;

      // Factories follow, one call each, so a single rejected address does not
      // discard the rest. The company already exists as a draft either way.
      const failed: string[] = [];
      for (const f of factories) {
        const r = await fetch("/api/client/factories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            nameEn: f.nameEn, nameBn: f.nameBn,
            ...f.address,
            contactName: f.contactName, contactMobile: f.contactMobile,
          }),
        });
        if (!r.ok) failed.push(f.nameEn || f.nameBn);
      }

      if (failed.length) {
        setError(
          `The company was created, but these factories were not saved: ${failed.join(", ")}. You can add them from the company page.`,
        );
        setBusy(false);
        router.refresh();
        return;
      }

      router.push(`/public/companies/${organizationId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const current = steps[step];

  return (
    <div>
      {/* Progress */}
      <ol className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
                i < step
                  ? "bg-secondary text-primary"
                  : i === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <span>{i + 1}</span>}
              {s}
            </span>
            {i < steps.length - 1 && <span className="text-border">—</span>}
          </li>
        ))}
      </ol>

      {parentName && (
        <p className="mb-6 rounded-lg bg-secondary/60 px-3 py-2.5 text-sm text-primary">
          Adding a company under <strong className="font-semibold">{parentName}</strong>.
        </p>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        {current === "Type" && (
          <>
            <h2 className="font-display text-xl font-medium text-foreground">
              Which one describes you?
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              This decides what we ask for next. You can add more companies and factories later.
            </p>
            <div className="mt-6 grid gap-3">
              {SHAPES.map((s) => {
                const Icon = s.icon;
                const active = shape === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setShape(s.key);
                      setError(null);
                    }}
                    className={`flex items-start gap-4 rounded-xl border p-5 text-left transition ${
                      active
                        ? "border-primary bg-secondary/50 ring-1 ring-primary/20"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"
                      }`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{s.title}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                        {s.blurb}
                      </span>
                      <span className="mt-2 block text-xs text-primary">{s.example}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {current === "Company" && (
          <>
            <h2 className="font-display text-xl font-medium text-foreground">
              {isGroup ? "About the group" : "About the company"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Names and registration numbers exactly as they appear on your trade licence.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Name (English)</label>
                <input className={field} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
              </div>
              <div>
                <label className={label}>নাম (বাংলা)</label>
                <input
                  className={`${field} font-bn`}
                  value={nameBn}
                  onChange={(e) => setNameBn(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Company type</label>
                <select className={field} value={legalForm} onChange={(e) => setLegalForm(e.target.value)}>
                  <option value="">Select</option>
                  {LEGAL_FORMS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Trade licence number</label>
                <input
                  className={field}
                  value={tradeLicenceNo}
                  onChange={(e) => setTradeLicenceNo(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Issued by</label>
                <input
                  className={field}
                  placeholder="City corporation / pourashava / union parishad"
                  value={tradeLicenceAuthority}
                  onChange={(e) => setTradeLicenceAuthority(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Licence valid through</label>
                <input
                  type="date"
                  className={field}
                  value={tradeLicenceExpiry}
                  onChange={(e) => setTradeLicenceExpiry(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>BIN / VAT registration</label>
                <input className={field} value={binNo} onChange={(e) => setBinNo(e.target.value)} />
              </div>
              <div>
                <label className={label}>TIN</label>
                <input className={field} value={tinNo} onChange={(e) => setTinNo(e.target.value)} />
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Only the name and company type are needed to start. The rest can wait until you apply
              for a licence — but you will not be able to submit an application without them.
            </p>
          </>
        )}

        {current === "Address" && (
          <>
            <h2 className="font-display text-xl font-medium text-foreground">
              {isSingle ? "Where is the premises?" : "Registered office address"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {isSingle
                ? "This address is used for both the company and the factory."
                : "The address on the trade licence. Factory addresses are asked for separately."}
            </p>
            <div className="mt-6">
              <AddressFields
                value={address}
                onChange={setAddress}
                districtHint={
                  isSingle
                    ? "This district decides which BSTI office receives your applications."
                    : undefined
                }
              />
            </div>
          </>
        )}

        {current === "Representative" && (
          <>
            <h2 className="font-display text-xl font-medium text-foreground">
              Authorised representative
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              The person who signs applications on behalf of the company, and whom BSTI contacts
              about them.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Full name</label>
                <input className={field} value={repName} onChange={(e) => setRepName(e.target.value)} />
              </div>
              <div>
                <label className={label}>Designation</label>
                <input
                  className={field}
                  placeholder="Managing Director, Proprietor…"
                  value={repDesignation}
                  onChange={(e) => setRepDesignation(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Mobile</label>
                <input
                  className={field}
                  inputMode="numeric"
                  placeholder="01XXXXXXXXX"
                  value={repMobile}
                  onChange={(e) => setRepMobile(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Email</label>
                <input
                  className={field}
                  type="email"
                  value={repEmail}
                  onChange={(e) => setRepEmail(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>National ID number</label>
                <input className={field} value={repNid} onChange={(e) => setRepNid(e.target.value)} />
              </div>
            </div>
          </>
        )}

        {current === "Factories" && (
          <FactoryStep
            factories={factories}
            setFactories={setFactories}
            singlePremises={isSingle}
          />
        )}

        {current === "Review" && (
          <>
            <h2 className="font-display text-xl font-medium text-foreground">Check and create</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Nothing has been saved yet. Everything here can be edited afterwards.
            </p>
            <dl className="mt-6 divide-y divide-border rounded-xl border border-border">
              <Row k="Name" v={[nameEn, nameBn].filter(Boolean).join(" · ") || "—"} />
              <Row k="Type" v={LEGAL_FORMS.find((f) => f.value === legalForm)?.label ?? "—"} />
              <Row
                k="Address"
                v={
                  [address.addressLine, address.upazila, address.district, address.division]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
              <Row k="Trade licence" v={tradeLicenceNo || "Not given yet"} />
              <Row k="BIN / TIN" v={[binNo, tinNo].filter(Boolean).join(" · ") || "Not given yet"} />
              <Row k="Representative" v={repName ? `${repName}${repDesignation ? `, ${repDesignation}` : ""}` : "—"} />
              <Row
                k="Factories"
                v={
                  isGroup
                    ? "None — factories belong to the companies under the group"
                    : factories.length
                      ? factories.map((f) => `${f.nameEn || f.nameBn} (${f.address.district})`).join("; ")
                      : "None"
                }
              />
            </dl>
            {isGroup && (
              <p className="mt-4 rounded-lg bg-secondary/60 px-3 py-2.5 text-sm text-primary">
                A mother organisation does not apply for licences itself. After creating it, add the
                companies under it — each of those applies for its own products.
              </p>
            )}
          </>
        )}

        {error && (
          <p className="mt-5 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            {error}
          </p>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
          <button
            type="button"
            onClick={back}
            disabled={step === 0 || busy}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground disabled:invisible"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Back
          </button>

          {current === "Review" ? (
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
              {busy ? "Creating…" : isGroup ? "Create the group" : "Create the company"}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Continue
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3">
      <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
      <dd className="text-sm text-foreground sm:col-span-2">{v}</dd>
    </div>
  );
}

/** Add factories one at a time, each with its own address. */
function FactoryStep({
  factories,
  setFactories,
  singlePremises,
}: {
  factories: FactoryDraft[];
  setFactories: (f: FactoryDraft[]) => void;
  singlePremises: boolean;
}) {
  const [draft, setDraft] = useState<FactoryDraft>({
    nameEn: "",
    nameBn: "",
    address: EMPTY_ADDRESS,
    contactName: "",
    contactMobile: "",
  });
  const [problem, setProblem] = useState<string | null>(null);

  function add() {
    if (!draft.nameEn.trim() && !draft.nameBn.trim()) return setProblem("The factory needs a name.");
    if (!draft.address.district) return setProblem("The factory's district is required.");
    if (!draft.address.addressLine.trim()) return setProblem("The factory address is required.");
    setProblem(null);
    setFactories([...factories, draft]);
    setDraft({ nameEn: "", nameBn: "", address: EMPTY_ADDRESS, contactName: "", contactMobile: "" });
  }

  return (
    <>
      <h2 className="font-display text-xl font-medium text-foreground">Factories</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        A licence covers a product made at one named factory, so every plant you want certified
        must be registered here.{" "}
        <strong className="font-medium text-foreground">
          The factory&apos;s district decides which BSTI office handles the application.
        </strong>
      </p>

      {singlePremises && factories.length > 0 && (
        <p className="mt-4 rounded-lg bg-secondary/60 px-3 py-2.5 text-sm text-primary">
          Your premises has been added from the address you gave. Add more only if you manufacture
          somewhere else too.
        </p>
      )}

      {factories.length > 0 && (
        <ul className="mt-5 space-y-2">
          {factories.map((f, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{f.nameEn || f.nameBn}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
                  <span className="font-bn">
                    {[f.address.addressLine, f.address.upazila, f.address.district]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFactories(factories.filter((_, j) => j !== i))}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove this factory"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 rounded-xl border border-dashed border-border p-5">
        <p className="mb-4 text-sm font-medium text-foreground">
          {factories.length ? "Add another factory" : "Add a factory"}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Factory name (English)</label>
            <input
              className={field}
              value={draft.nameEn}
              onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>কারখানার নাম (বাংলা)</label>
            <input
              className={`${field} font-bn`}
              value={draft.nameBn}
              onChange={(e) => setDraft({ ...draft, nameBn: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4">
          <AddressFields
            value={draft.address}
            onChange={(a) => setDraft({ ...draft, address: a })}
            districtHint="This decides which BSTI office receives applications from this factory."
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Contact person at the factory</label>
            <input
              className={field}
              value={draft.contactName}
              onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Contact mobile</label>
            <input
              className={field}
              inputMode="numeric"
              value={draft.contactMobile}
              onChange={(e) => setDraft({ ...draft, contactMobile: e.target.value })}
            />
          </div>
        </div>
        {problem && (
          <p className="mt-3 text-sm text-destructive">{problem}</p>
        )}
        <button
          type="button"
          onClick={add}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-primary bg-secondary/50 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-secondary"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Add this factory
        </button>
      </div>
    </>
  );
}
