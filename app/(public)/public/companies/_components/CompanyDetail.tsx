"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check, AlertTriangle, Loader2, Plus, MapPin, Building2, Pencil, X,
} from "lucide-react";
import AddressFields, { type Address, EMPTY_ADDRESS } from "./AddressFields";
import type { Requirement } from "@/lib/client/organization";

type Org = {
  id: number;
  type: string;
  nameEn: string;
  nameBn: string;
  legalForm: string | null;
  tradeLicenceNo: string | null;
  tradeLicenceAuthority: string | null;
  tradeLicenceExpiry: string | null;
  binNo: string | null;
  tinNo: string | null;
  addressLine: string | null;
  division: string | null;
  district: string | null;
  upazila: string | null;
  postCode: string | null;
  repName: string | null;
  repDesignation: string | null;
  repMobile: string | null;
  repEmail: string | null;
  repNid: string | null;
  factories: {
    id: number;
    nameEn: string;
    district: string;
    addressLine: string;
    upazila: string | null;
    bstiOffice: { nameEn: string; nameBn: string } | null;
  }[];
};

const LEGAL_FORMS = [
  { value: "proprietorship", label: "Sole proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "limited", label: "Limited company" },
  { value: "group_entity", label: "Group / holding entity" },
];

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const label = "mb-1.5 block text-xs font-medium text-muted-foreground";

export default function CompanyDetail({
  organization,
  missing,
}: {
  organization: Org;
  missing: Requirement[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [addingFactory, setAddingFactory] = useState(false);

  const canApply = organization.type !== "group_parent";

  return (
    <div className="space-y-6">
      {/* What is still needed. Named fields, not a percentage — a bar tells you
          how far along you are but not what to do next. */}
      {missing.length > 0 ? (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6">
          <h2 className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" strokeWidth={2} />
            Still needed before you can apply
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {missing.map((m) => (
              <li key={m.field} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {m.label}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-amber-800/80 dark:text-amber-300/80">
            You can leave these for now — nothing is lost. They are only checked when you submit an
            application.
          </p>
        </section>
      ) : (
        <section className="flex items-center gap-2 rounded-2xl border border-primary/40 bg-secondary/40 p-5 text-sm font-medium text-primary">
          <Check className="h-4 w-4" strokeWidth={2.5} />
          {canApply
            ? "This profile is complete and can be used to apply for a CM quality licence."
            : "This group's details are complete. Licences are applied for by the companies under it."}
        </section>
      )}

      {/* Details */}
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-foreground">Company details</h2>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
          >
            {editing ? <X className="h-3.5 w-3.5" strokeWidth={2} /> : <Pencil className="h-3.5 w-3.5" strokeWidth={2} />}
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>

        {editing ? (
          <EditForm
            organization={organization}
            onDone={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        ) : (
          <dl className="divide-y divide-border">
            <Row k="Name" v={organization.nameEn} bn={organization.nameBn} />
            <Row k="Company type" v={LEGAL_FORMS.find((f) => f.value === organization.legalForm)?.label} />
            <Row
              k="Trade licence"
              v={
                organization.tradeLicenceNo &&
                [
                  organization.tradeLicenceNo,
                  organization.tradeLicenceAuthority,
                  organization.tradeLicenceExpiry ? `valid to ${organization.tradeLicenceExpiry}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              }
            />
            <Row k="BIN / VAT" v={organization.binNo} />
            <Row k="TIN" v={organization.tinNo} />
            <Row
              k="Registered office"
              bn={[organization.addressLine, organization.upazila, organization.district, organization.division]
                .filter(Boolean)
                .join(", ")}
            />
            <Row
              k="Representative"
              v={
                organization.repName &&
                [organization.repName, organization.repDesignation].filter(Boolean).join(", ")
              }
            />
            <Row
              k="Representative contact"
              v={[organization.repMobile, organization.repEmail].filter(Boolean).join(" · ")}
            />
            <Row k="Representative NID" v={organization.repNid} />
          </dl>
        )}
      </section>

      {/* Factories */}
      {canApply && (
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-foreground">Factories</h2>
            {!addingFactory && (
              <button
                type="button"
                onClick={() => setAddingFactory(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Add a factory
              </button>
            )}
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            Each factory&apos;s district decides which BSTI office receives applications made from
            it.
          </p>

          {organization.factories.length === 0 ? (
            <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
              No factories registered yet. You need at least one to apply for a licence.
            </p>
          ) : (
            <ul className="space-y-3">
              {organization.factories.map((f) => (
                <li key={f.id} className="rounded-xl border border-border bg-background p-4">
                  <p className="font-medium text-foreground">{f.nameEn}</p>
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
                    <span className="font-bn">
                      {[f.addressLine, f.upazila, f.district].filter(Boolean).join(", ")}
                    </span>
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
                    <span className="text-muted-foreground">Applications go to</span>
                    <span className="font-bn font-medium text-foreground">
                      {f.bstiOffice?.nameBn ?? "not yet determined"}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}

          {addingFactory && (
            <AddFactory
              organizationId={organization.id}
              onDone={() => {
                setAddingFactory(false);
                router.refresh();
              }}
              onCancel={() => setAddingFactory(false)}
            />
          )}
        </section>
      )}
    </div>
  );
}

function Row({ k, v, bn }: { k: string; v?: string | null; bn?: string | null }) {
  const shown = v || bn;
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3">
      <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
      <dd className={`text-sm sm:col-span-2 ${shown ? "text-foreground" : "text-muted-foreground"}`}>
        {v && <span>{v}</span>}
        {v && bn && bn !== v && <span className="font-bn"> · {bn}</span>}
        {!v && bn && <span className="font-bn">{bn}</span>}
        {!shown && <span className="italic">Not given yet</span>}
      </dd>
    </div>
  );
}

function EditForm({ organization, onDone }: { organization: Org; onDone: () => void }) {
  const [form, setForm] = useState({
    nameEn: organization.nameEn ?? "",
    nameBn: organization.nameBn ?? "",
    legalForm: organization.legalForm ?? "",
    tradeLicenceNo: organization.tradeLicenceNo ?? "",
    tradeLicenceAuthority: organization.tradeLicenceAuthority ?? "",
    tradeLicenceExpiry: organization.tradeLicenceExpiry ?? "",
    binNo: organization.binNo ?? "",
    tinNo: organization.tinNo ?? "",
    repName: organization.repName ?? "",
    repDesignation: organization.repDesignation ?? "",
    repMobile: organization.repMobile ?? "",
    repEmail: organization.repEmail ?? "",
    repNid: organization.repNid ?? "",
  });
  const [address, setAddress] = useState<Address>({
    addressLine: organization.addressLine ?? "",
    division: organization.division ?? "",
    district: organization.district ?? "",
    upazila: organization.upazila ?? "",
    postCode: organization.postCode ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...address }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not save.");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Name (English)</label>
          <input className={field} value={form.nameEn} onChange={set("nameEn")} />
        </div>
        <div>
          <label className={label}>নাম (বাংলা)</label>
          <input className={`${field} font-bn`} value={form.nameBn} onChange={set("nameBn")} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Company type</label>
          <select className={field} value={form.legalForm} onChange={set("legalForm")}>
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
          <input className={field} value={form.tradeLicenceNo} onChange={set("tradeLicenceNo")} />
        </div>
        <div>
          <label className={label}>Issued by</label>
          <input className={field} value={form.tradeLicenceAuthority} onChange={set("tradeLicenceAuthority")} />
        </div>
        <div>
          <label className={label}>Licence valid through</label>
          <input type="date" className={field} value={form.tradeLicenceExpiry} onChange={set("tradeLicenceExpiry")} />
        </div>
        <div>
          <label className={label}>BIN / VAT</label>
          <input className={field} value={form.binNo} onChange={set("binNo")} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>TIN</label>
          <input className={field} value={form.tinNo} onChange={set("tinNo")} />
        </div>
      </div>

      <p className="mb-3 mt-6 text-sm font-medium text-foreground">Registered office</p>
      <AddressFields value={address} onChange={setAddress} />

      <p className="mb-3 mt-6 text-sm font-medium text-foreground">Authorised representative</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Full name</label>
          <input className={field} value={form.repName} onChange={set("repName")} />
        </div>
        <div>
          <label className={label}>Designation</label>
          <input className={field} value={form.repDesignation} onChange={set("repDesignation")} />
        </div>
        <div>
          <label className={label}>Mobile</label>
          <input className={field} inputMode="numeric" value={form.repMobile} onChange={set("repMobile")} />
        </div>
        <div>
          <label className={label}>Email</label>
          <input className={field} type="email" value={form.repEmail} onChange={set("repEmail")} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>National ID number</label>
          <input className={field} value={form.repNid} onChange={set("repNid")} />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
        {busy ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function AddFactory({
  organizationId,
  onDone,
  onCancel,
}: {
  organizationId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [contactName, setContactName] = useState("");
  const [contactMobile, setContactMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/client/factories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, nameEn, nameBn, ...address, contactName, contactMobile }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not save the factory.");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the factory.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-dashed border-border p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Factory name (English)</label>
          <input className={field} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </div>
        <div>
          <label className={label}>কারখানার নাম (বাংলা)</label>
          <input className={`${field} font-bn`} value={nameBn} onChange={(e) => setNameBn(e.target.value)} />
        </div>
      </div>
      <div className="mt-4">
        <AddressFields
          value={address}
          onChange={setAddress}
          districtHint="This decides which BSTI office receives applications from this factory."
        />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Contact person</label>
          <input className={field} value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div>
          <label className={label}>Contact mobile</label>
          <input
            className={field}
            inputMode="numeric"
            value={contactMobile}
            onChange={(e) => setContactMobile(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
          {busy ? "Saving…" : "Save factory"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
