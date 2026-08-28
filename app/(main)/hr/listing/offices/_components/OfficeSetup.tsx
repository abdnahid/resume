"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, Check, Landmark, Pencil, X } from "lucide-react";
import { ZONE_LABEL, type HouseRentZone } from "@/lib/salary/compute";

/**
 * Office setup.
 *
 * The house rent zone is shown to everyone but only a superadmin can change it:
 * it multiplies every salary in the office, so it is not the office's own call.
 * Improvised bank details are flagged until someone confirms them — saving the
 * form is that confirmation.
 */

export type OfficeRow = {
  id: number;
  type: string;
  nameEn: string;
  nameBn: string;
  officeHead: string;
  addressEn: string;
  addressBn: string;
  phone: string | null;
  email: string | null;
  houseRentZone: HouseRentZone | null;
  bank: {
    bankId: number;
    bankNameBn: string;
    recipientDesignationBn: string;
    branchNameBn: string;
    branchAddressBn: string;
    accountNo: string;
    isPlaceholder: boolean;
  } | null;
};

const INPUT =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none";

const ZONES: HouseRentZone[] = ["dhaka", "divisional_city", "other_district"];

export default function OfficeSetup({
  offices,
  banks,
  isSuperadmin,
}: {
  offices: OfficeRow[];
  banks: { id: number; nameEn: string; nameBn: string }[];
  isSuperadmin: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<OfficeRow | null>(null);

  const unconfirmed = offices.filter((o) => o.bank?.isPlaceholder).length;

  function startEdit(o: OfficeRow) {
    setDraft(
      structuredClone({
        ...o,
        bank: o.bank ?? {
          bankId: banks[0]?.id ?? 0,
          bankNameBn: banks[0]?.nameBn ?? "",
          recipientDesignationBn: "সহকারী মহাব্যবস্থাপক",
          branchNameBn: "",
          branchAddressBn: "",
          accountNo: "",
          isPlaceholder: true,
        },
      }),
    );
    setEditing(o.id);
    setError(null);
    setNotice(null);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/offices/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressEn: draft.addressEn,
          addressBn: draft.addressBn,
          officeHead: draft.officeHead,
          phone: draft.phone ?? "",
          email: draft.email ?? "",
          ...(isSuperadmin ? { houseRentZone: draft.houseRentZone } : {}),
          bank: draft.bank,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save the office");
      setEditing(null);
      setNotice(`${draft.nameEn} updated.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-5xl">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Building2 size={18} /> Office setup
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Contact details, house rent zone, and the bank each office draws its
            salary cheque on. The bank block here is what the office&apos;s bank
            advice is addressed to.
          </p>
        </div>

        {unconfirmed > 0 && (
          <p className="flex gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              {unconfirmed} office{unconfirmed === 1 ? "" : "s"} still carry
              improvised branch details, seeded so the letter reads coherently.
              Confirm each against the bank — saving an office marks it
              confirmed.
            </span>
          </p>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        <div className="space-y-3">
          {offices.map((o) =>
            editing === o.id && draft ? (
              <div
                key={o.id}
                className="rounded-xl border border-slate-300 bg-white p-5 space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{o.nameEn}</h2>
                    <p className="text-xs text-slate-500 font-bn-serif">{o.nameBn}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Contact */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="block col-span-2">
                    <span className="text-xs font-medium text-slate-500">Address (Bengali)</span>
                    <input
                      value={draft.addressBn}
                      onChange={(e) => setDraft({ ...draft, addressBn: e.target.value })}
                      className={`${INPUT} mt-1 font-bn-serif`}
                    />
                    <span className="mt-1 block text-[11px] text-slate-400">
                      Printed on this office&apos;s salary slips and bank advice.
                    </span>
                  </label>
                  <label className="block col-span-2">
                    <span className="text-xs font-medium text-slate-500">Address (English)</span>
                    <input
                      value={draft.addressEn}
                      onChange={(e) => setDraft({ ...draft, addressEn: e.target.value })}
                      className={`${INPUT} mt-1`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-500">Office head</span>
                    <input
                      value={draft.officeHead}
                      onChange={(e) => setDraft({ ...draft, officeHead: e.target.value })}
                      className={`${INPUT} mt-1`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-500">Phone</span>
                    <input
                      value={draft.phone ?? ""}
                      onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                      className={`${INPUT} mt-1 font-mono`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-500">Email</span>
                    <input
                      value={draft.email ?? ""}
                      onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                      className={`${INPUT} mt-1`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-500">
                      House rent zone
                    </span>
                    <select
                      value={draft.houseRentZone ?? ""}
                      disabled={!isSuperadmin}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          houseRentZone: (e.target.value || null) as HouseRentZone | null,
                        })
                      }
                      className={`${INPUT} mt-1 cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
                    >
                      <option value="">Not set</option>
                      {ZONES.map((z) => (
                        <option key={z} value={z}>{ZONE_LABEL[z]}</option>
                      ))}
                    </select>
                    <span className="mt-1 block text-[11px] text-slate-400">
                      {isSuperadmin
                        ? "Decides house rent for every employee here."
                        : "Superadmin only — it changes every salary in this office."}
                    </span>
                  </label>
                </div>

                {/* Bank */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Landmark size={13} /> Salary bank account
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">Bank</span>
                      <select
                        value={draft.bank!.bankId}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            bank: { ...draft.bank!, bankId: Number(e.target.value) },
                          })
                        }
                        className={`${INPUT} mt-1 cursor-pointer`}
                      >
                        {banks.map((b) => (
                          <option key={b.id} value={b.id}>{b.nameEn}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">
                        Addressed to (designation)
                      </span>
                      <input
                        value={draft.bank!.recipientDesignationBn}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            bank: { ...draft.bank!, recipientDesignationBn: e.target.value },
                          })
                        }
                        className={`${INPUT} mt-1 font-bn-serif`}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">Branch</span>
                      <input
                        value={draft.bank!.branchNameBn}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            bank: { ...draft.bank!, branchNameBn: e.target.value },
                          })
                        }
                        className={`${INPUT} mt-1 font-bn-serif`}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">Branch address</span>
                      <input
                        value={draft.bank!.branchAddressBn}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            bank: { ...draft.bank!, branchAddressBn: e.target.value },
                          })
                        }
                        className={`${INPUT} mt-1 font-bn-serif`}
                      />
                    </label>
                    <label className="block col-span-2">
                      <span className="text-xs font-medium text-slate-500">
                        Current account no
                      </span>
                      <input
                        value={draft.bank!.accountNo}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            bank: { ...draft.bank!, accountNo: e.target.value },
                          })
                        }
                        className={`${INPUT} mt-1 font-mono`}
                      />
                      <span className="mt-1 block text-[11px] text-slate-400">
                        The account the salary cheque is drawn on, as printed in
                        the advice.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={save}
                    className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Check size={15} />
                    {saving ? "Saving…" : "Save office"}
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={o.id}
                className="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3 flex items-start gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-800">{o.nameEn}</p>
                    {o.houseRentZone ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {ZONE_LABEL[o.houseRentZone]}
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                        no house rent zone
                      </span>
                    )}
                    {o.bank?.isPlaceholder && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                        branch unconfirmed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-bn-serif mt-0.5">{o.addressBn}</p>
                  {o.bank ? (
                    <p className="text-xs text-slate-500 font-bn-serif mt-1">
                      {o.bank.bankNameBn} · {o.bank.branchNameBn} · হিসাব{" "}
                      <span className="font-mono">{o.bank.accountNo}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700 mt-1">
                      No bank account set — a bank advice cannot be addressed.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(o)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Pencil size={13} /> Edit
                </button>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
