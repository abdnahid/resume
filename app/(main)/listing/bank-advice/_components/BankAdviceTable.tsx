"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, Trash2, FileText } from "lucide-react";
import type { BankAdviceRecord, SalaryProcessMonth } from "@/lib/types";
import GenerateBankAdviceModal from "./GenerateBankAdviceModal";

// ─── Month ordering ───────────────────────────────────────────────────────────

const MONTH_ORDER: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

// ─── Period dropdown (reused from SalaryProcessTable pattern) ─────────────────

function PeriodDropdown({
  value,
  onChange,
  options,
  minWidth = "min-w-24",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  minWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-lg border border-primary/25 bg-accent-soft text-sm font-semibold text-primary hover:bg-accent-soft/70 transition-all duration-150 cursor-pointer ${minWidth}`}
      >
        <span className="flex-1 text-left">{value}</span>
        <ChevronDown
          size={13}
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-10 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto min-w-full">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                opt.value === value
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Delete confirm row state ─────────────────────────────────────────────────

function DeleteButton({
  id,
  onDeleted,
}: {
  id: number;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/bank-advice/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Delete failed");
        return;
      }
      onDeleted();
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 cursor-pointer"
        >
          {loading ? "…" : "Confirm"}
        </button>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-sm text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title="Delete"
      className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
    >
      <Trash2 size={18} />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BankAdviceTable({
  bankAdvices,
  salaryMonths,
  role,
}: {
  bankAdvices: BankAdviceRecord[];
  salaryMonths: SalaryProcessMonth[];
  role: string;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  // ── Period filter ──────────────────────────────────────────────────────────

  const years = [...new Set(bankAdvices.map((r) => r.year))].sort(
    (a, b) => Number(b) - Number(a),
  );

  const defaultYear = years[0] ?? "";
  const defaultMonth =
    bankAdvices
      .filter((r) => r.year === defaultYear)
      .sort((a, b) => MONTH_ORDER[b.month] - MONTH_ORDER[a.month])[0]?.month ??
    "";

  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  // When bank advices change (after generate/delete), recalculate defaults
  useEffect(() => {
    const newYears = [...new Set(bankAdvices.map((r) => r.year))].sort(
      (a, b) => Number(b) - Number(a),
    );
    const newDefaultYear = newYears[0] ?? "";
    const newDefaultMonth =
      bankAdvices
        .filter((r) => r.year === newDefaultYear)
        .sort((a, b) => MONTH_ORDER[b.month] - MONTH_ORDER[a.month])[0]
        ?.month ?? "";
    setSelectedYear(newDefaultYear);
    setSelectedMonth(newDefaultMonth);
  }, [bankAdvices]);

  const monthOptions = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ].map((m) => ({ label: m, value: m }));

  const yearOptions = years.map((y) => ({ label: y, value: y }));

  const filtered = bankAdvices.filter(
    (r) =>
      (!selectedMonth || r.month === selectedMonth) &&
      (!selectedYear || r.year === selectedYear),
  );

  const canGenerate = role === "superadmin" || role === "officeadmin";
  const canDelete = role === "superadmin";

  const generatedAdvices = bankAdvices.map((a) => ({
    month: a.month,
    year: a.year,
  }));

  return (
    <>
      <GenerateBankAdviceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        generatedAdvices={generatedAdvices}
        salaryMonths={salaryMonths}
      />

      <div className="min-h-screen bg-slate-50 p-6 font-sans">
        <div className="max-w-7xl mx-auto">
          {/* ── Header ────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Bank Advice
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {filtered.length} record{filtered.length !== 1 ? "s" : ""} found
              </p>
            </div>
            {canGenerate && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink text-white text-sm font-medium hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <FileText size={14} />
                Generate
              </button>
            )}
          </div>

          {/* ── Period filter ──────────────────────────────────────────── */}
          {bankAdvices.length > 0 && (
            <div className="flex flex-wrap gap-2.5 mb-4">
              <PeriodDropdown
                value={selectedMonth}
                onChange={(m) => setSelectedMonth(m)}
                options={monthOptions}
                minWidth="min-w-32"
              />
              <PeriodDropdown
                value={selectedYear}
                onChange={(y) => {
                  setSelectedYear(y);
                  setSelectedMonth("");
                }}
                options={yearOptions}
                minWidth="min-w-20"
              />
            </div>
          )}

          {/* ── Table ─────────────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {[
                      "Memo No",
                      "Period",
                      "Employees",
                      "Total (BDT)",
                      "Cheque No",
                      "Deposit Date",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left text-sm font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.length > 0 ? (
                    filtered.map((advice) => (
                      <tr
                        key={advice.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="px-4 py-4 align-top font-bn-serif text-sm text-slate-500">
                          #{advice.memoNo}
                        </td>
                        <td className="px-4 py-4 align-top font-medium text-slate-800">
                          {advice.month} {advice.year}
                        </td>
                        <td className="px-4 py-4 align-top text-slate-600 tabular-nums">
                          {advice.employeeCount}
                        </td>
                        <td className="px-4 py-4 align-top font-mono text-slate-800 tabular-nums">
                          ৳ {advice.totalAmount.toLocaleString("en-BD")}
                        </td>
                        <td className="px-4 py-4 align-top font-mono text-sm text-slate-600">
                          {advice.chequeNo}
                        </td>
                        <td className="px-4 py-4 align-top text-slate-600">
                          {advice.depositDate}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/listing/bank-advice/${advice.id}`)
                              }
                              title="View document"
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary hover:bg-secondary transition-colors cursor-pointer"
                            >
                              <Eye size={18} />
                            </button>
                            {canDelete && (
                              <DeleteButton
                                id={advice.id}
                                onDeleted={() => router.refresh()}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center text-slate-400 text-sm py-16"
                      >
                        {bankAdvices.length === 0
                          ? "No bank advices yet."
                          : "No records for the selected period."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
