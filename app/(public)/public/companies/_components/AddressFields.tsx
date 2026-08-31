"use client";

import { BD_DIVISIONS } from "@/lib/bdGeoData";

export type Address = {
  addressLine: string;
  division: string;
  district: string;
  upazila: string;
  postCode: string;
};

export const EMPTY_ADDRESS: Address = {
  addressLine: "",
  division: "",
  district: "",
  upazila: "",
  postCode: "",
};

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const label = "mb-1.5 block text-xs font-medium text-muted-foreground";

/**
 * Division → district → upazila, cascading.
 *
 * Selecting a division clears the district beneath it: leaving ঢাকা's district
 * selected under a newly chosen বরিশাল would silently route the file to the
 * wrong office, which is the one mistake this form must not allow.
 */
export default function AddressFields({
  value,
  onChange,
  districtHint,
}: {
  value: Address;
  onChange: (next: Address) => void;
  districtHint?: string;
}) {
  const division = BD_DIVISIONS.find((d) => d.name === value.division);
  const district = division?.districts.find((d) => d.name === value.district);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={label}>Street address</label>
        <input
          className={field}
          value={value.addressLine}
          placeholder="Holding / road / area"
          onChange={(e) => onChange({ ...value, addressLine: e.target.value })}
        />
      </div>

      <div>
        <label className={label}>Division</label>
        <select
          className={field}
          value={value.division}
          onChange={(e) =>
            onChange({ ...value, division: e.target.value, district: "", upazila: "" })
          }
        >
          <option value="">Select a division</option>
          {BD_DIVISIONS.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={label}>District</label>
        <select
          className={field}
          value={value.district}
          disabled={!division}
          onChange={(e) => onChange({ ...value, district: e.target.value, upazila: "" })}
        >
          <option value="">{division ? "Select a district" : "Choose a division first"}</option>
          {division?.districts.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
        {districtHint && <p className="mt-1.5 text-xs text-muted-foreground">{districtHint}</p>}
      </div>

      <div>
        <label className={label}>Upazila / Thana</label>
        <select
          className={field}
          value={value.upazila}
          disabled={!district}
          onChange={(e) => onChange({ ...value, upazila: e.target.value })}
        >
          <option value="">{district ? "Select an upazila" : "Choose a district first"}</option>
          {district?.upazilas.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={label}>Post code</label>
        <input
          className={field}
          value={value.postCode}
          inputMode="numeric"
          onChange={(e) => onChange({ ...value, postCode: e.target.value })}
        />
      </div>
    </div>
  );
}
