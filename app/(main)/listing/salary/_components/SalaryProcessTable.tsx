"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Eye, Download, CalendarDays } from "lucide-react";
import {
  FilterSearch,
  FilterSelect,
  FilterSelectOption,
} from "@/app/(main)/_components/filters";
import type { Employee, SalaryProcessRecord } from "@/lib/types";

// ─── Month ordering ───────────────────────────────────────────────────────────

const MONTH_ORDER: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4,
  May: 5, June: 6, July: 7, August: 8,
  September: 9, October: 10, November: 11, December: 12,
};

const ALL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Period dropdown (month or year, no clear/reset option) ───────────────────

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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
        <div className="absolute z-50 top-full mt-1.5 left-0 min-w-full w-max bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-100 py-1 max-h-64 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-emerald-600">
                {value === opt.value && <Check size={13} />}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBDT(amount: number) {
  return "৳ " + amount.toLocaleString("en-BD");
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  employees: Employee[];
  salaryProcesses: SalaryProcessRecord[];
};

export default function SalaryProcessTable({ employees, salaryProcesses }: Props) {
  // Unique years from data, newest first
  const years = [...new Set(salaryProcesses.map((r) => r.year))].sort(
    (a, b) => Number(b) - Number(a)
  );

  // Default: most recent processed month within the most recent year
  const defaultYear = years[0] ?? "";
  const defaultMonth = salaryProcesses
    .filter((r) => r.year === defaultYear)
    .reduce(
      (latest, r) =>
        !latest || MONTH_ORDER[r.month] > MONTH_ORDER[latest] ? r.month : latest,
      ""
    );

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [search, setSearch] = useState("");
  const [office, setOffice] = useState("");

  const monthOptions = ALL_MONTHS.map((m) => ({ label: m, value: m }));
  const yearOptions = years.map((y) => ({ label: y, value: y }));

  // Records for the selected month+year, joined with employee data
  const periodRecords = salaryProcesses
    .filter((r) => r.month === selectedMonth && r.year === selectedYear)
    .flatMap((r) => {
      const emp = employees.find((e) => e.id === r.employee_id);
      return emp ? [{ ...r, emp }] : [];
    });

  // Office options derived from employees in the selected period
  const periodEmployeeIds = new Set(periodRecords.map((r) => r.emp.id));
  const officeOptions: FilterSelectOption[] = [
    ...new Set(
      employees
        .filter((e) => periodEmployeeIds.has(e.id))
        .map((e) => e.current_job.office_bn)
    ),
  ].map((o) => ({ label: o, value: o, className: "font-bn-serif" }));

  // Apply search + office filters
  const filtered = periodRecords.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.emp.id.includes(q) ||
      r.emp.name.bn.includes(q) ||
      r.emp.name.en.toLowerCase().includes(q);
    const matchOffice = !office || r.emp.current_job.office_bn === office;
    return matchSearch && matchOffice;
  });

  if (years.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 font-sans flex items-start pt-24 justify-center">
        <p className="text-slate-400 text-sm">No salary has been processed yet.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Processed Salary</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {filtered.length} record{filtered.length !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>

        {/* ── Period + filters ────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2.5 mb-4">

          {/* Period selector — month and year independently */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
            <CalendarDays size={14} className="text-slate-400 shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 whitespace-nowrap">
              Period
            </span>
            <div className="w-px h-4 bg-slate-200" />
            <PeriodDropdown
              value={selectedMonth}
              onChange={(m) => { setSelectedMonth(m); setOffice(""); }}
              options={monthOptions}
              minWidth="min-w-32"
            />
            <PeriodDropdown
              value={selectedYear}
              onChange={(y) => { setSelectedYear(y); setOffice(""); }}
              options={yearOptions}
              minWidth="min-w-20"
            />
          </div>

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* Filters */}
          <FilterSearch
            value={search}
            onChange={setSearch}
            placeholder="Search by ID or name…"
            className="min-w-56"
          />
          <FilterSelect
            value={office}
            onChange={setOffice}
            options={officeOptions}
            placeholder="All offices"
            optionClassName="font-bn-serif"
            width="min-w-60"
          />
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <colgroup>
                <col className="w-36" />
                <col />
                <col className="w-56" />
                <col className="w-32" />
                <col className="w-32" />
                <col className="w-24" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["ID", "Employee", "Office", "Net Salary", "Issue Date", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length > 0 ? (
                  filtered.map((r) => (
                    <tr
                      key={r.emp.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* ID */}
                      <td className="px-4 py-4 align-top">
                        <span className="font-mono text-xs text-slate-400 tracking-tight">
                          {r.emp.id}
                        </span>
                      </td>

                      {/* Employee */}
                      <td className="px-4 py-4 align-top">
                        <p className="font-medium text-slate-800 leading-snug font-bn-serif text-base">
                          {r.emp.name.bn}
                        </p>
                        <p className="text-sm text-slate-400 mt-0.5 font-bn-serif">
                          {r.emp.current_job.designation_bn}
                        </p>
                      </td>

                      {/* Office */}
                      <td className="px-4 py-4 align-top">
                        <p className="text-sm text-slate-600 font-bn-serif leading-snug">
                          {r.emp.current_job.office_bn}
                        </p>
                      </td>

                      {/* Net Salary */}
                      <td className="px-4 py-4 align-top">
                        <span className="text-sm font-semibold text-slate-800 tabular-nums">
                          {formatBDT(r.net_salary)}
                        </span>
                      </td>

                      {/* Issue Date */}
                      <td className="px-4 py-4 align-top">
                        <span className="font-mono text-sm text-slate-500 tabular-nums">
                          {r.issue_date}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="View Slip"
                            onClick={() =>
                              console.log("View slip:", r.emp.id, selectedMonth, selectedYear)
                            }
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 transition-all duration-150 cursor-pointer"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            title="Download"
                            onClick={() =>
                              console.log("Download slip:", r.emp.id, selectedMonth, selectedYear)
                            }
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 transition-all duration-150 cursor-pointer"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center text-slate-400 text-sm py-16"
                    >
                      {periodRecords.length === 0
                        ? `No salary processed for ${selectedMonth} ${selectedYear}.`
                        : "No records match your filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
