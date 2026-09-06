"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import AddressFields, { type Address, EMPTY_ADDRESS } from "./AddressFields";

/**
 * Register a factory against a company profile.
 *
 * One form, two places: the company page (`CompanyDetail`) and the apply page,
 * where an applicant whose plant is not yet registered can add it without
 * losing the thread. A second copy would drift, and the district field is the
 * one that must not — it decides which BSTI office receives every application
 * made from this factory.
 */

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const label = "mb-1.5 block text-xs font-medium text-muted-foreground";

export default function FactoryForm({
  organizationId,
  submitLabel = "Save factory",
  onSaved,
  onCancel,
}: {
  organizationId: number;
  submitLabel?: string;
  /** The new factory's id, so the caller can point at the row it just created. */
  onSaved: (factoryId: number) => void;
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
        body: JSON.stringify({
          organizationId,
          nameEn,
          nameBn,
          ...address,
          contactName,
          contactMobile,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save the factory.");
      onSaved(data.factory.id as number);
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
          <input
            className={`${field} font-bn`}
            value={nameBn}
            onChange={(e) => setNameBn(e.target.value)}
          />
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
          <input
            className={field}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
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
          {busy ? "Saving…" : submitLabel}
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
