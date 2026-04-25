"use client";

import { ArrowRight, PlusIcon, Zap } from "lucide-react";
import { useState } from "react";
import ProcessSalaryModal from "./ProcessSalaryModal";
import {
  FilterSearch,
  FilterSelect,
  FilterSelectOption,
  FilterGrade,
  FilterDateRange,
} from "@/app/(main)/_components/filters";
import type { Employee, SalaryStatus } from "@/lib/types";

// ─── Status config ────────────────────────────────────────────────────────────

const SALARY_STATUS_CONFIG: Record<
  SalaryStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
  expired: {
    label: "Expired",
    className: "bg-red-50    text-red-600    ring-1 ring-red-200",
  },
  not_found: {
    label: "Not Found",
    className: "bg-slate-100 text-slate-500  ring-1 ring-slate-200",
  },
  inactive: {
    label: "Inactive",
    className: "bg-amber-50  text-amber-700  ring-1 ring-amber-200",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(str: string): Date | null {
  if (!str) return null;
  const [m, d, y] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatBDT(amount: number) {
  return "৳ " + amount.toLocaleString("en-BD");
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const EditIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="w-3.5 h-3.5"
  >
    <path d="M11 2.5a1.5 1.5 0 012.1 2.1L5 13H3v-2L11 2.5z" />
  </svg>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SalaryFixationTable({
  employees,
  lastProcessed,
}: {
  employees: Employee[];
  lastProcessed: { month: string; year: string } | null;
}) {
  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [gradeExact, setGradeExact] = useState("");
  const [gradeFrom, setGradeFrom] = useState("");
  const [gradeTo, setGradeTo] = useState("");
  const [validFrom, setValidFrom] = useState<Date | undefined>(undefined);
  const [validTo, setValidTo] = useState<Date | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);

  const activeCount = employees.filter((e) => e.fixation.salaryStatus === "active").length;

  const OFFICES = [...new Set(employees.map((e) => e.current_job.office_bn))];

  const clearGrade = () => {
    setGradeExact("");
    setGradeFrom("");
    setGradeTo("");
  };

  const filtered = employees.filter((emp) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      emp.id.includes(q) ||
      emp.name.bn.includes(q) ||
      emp.name.en.toLowerCase().includes(q);

    const matchOffice = !officeFilter || emp.current_job.office_bn === officeFilter;

    const g = emp.fixation.grade;
    const matchGrade = gradeExact
      ? g === Number(gradeExact)
      : (!gradeFrom || g >= Number(gradeFrom)) &&
        (!gradeTo || g <= Number(gradeTo));

    const recFrom = parseDate(emp.fixation.validFrom);
    const recTo = parseDate(emp.fixation.validThru);
    const matchValidity =
      (!validFrom && !validTo) ||
      (recFrom && recTo
        ? (!validFrom || recTo >= validFrom) && (!validTo || recFrom <= validTo)
        : false);

    return matchSearch && matchOffice && matchGrade && matchValidity;
  });

  const officeOptions: FilterSelectOption[] = OFFICES.map((o) => ({
    label: o,
    value: o,
    className: "font-bn-serif",
  }));

  return (
    <>
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Salary Fixation
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {filtered.length} record{filtered.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink text-white text-sm font-medium hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Zap size={14} />
            Process Salary
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2.5 mb-4">
          <FilterSearch
            value={search}
            onChange={setSearch}
            placeholder="Search by ID or name…"
            className="flex-1 min-w-56"
          />
          <FilterSelect
            value={officeFilter}
            onChange={setOfficeFilter}
            options={officeOptions}
            placeholder="All offices"
            optionClassName="font-bn-serif"
            width="min-w-60"
          />
          <FilterGrade
            exact={gradeExact}
            rangeFrom={gradeFrom}
            rangeTo={gradeTo}
            onExactChange={setGradeExact}
            onRangeFromChange={setGradeFrom}
            onRangeToChange={setGradeTo}
            onClear={clearGrade}
          />
          <FilterDateRange
            startDate={validFrom}
            endDate={validTo}
            onStartChange={setValidFrom}
            onEndChange={setValidTo}
            name="validity-filter"
          />
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <colgroup>
                <col className="w-32" />
                <col />
                <col className="w-5" />
                <col className="w-32" />
                <col className="w-65" />
                <col className="w-10" />
                <col className="w-10" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {[
                    "ID",
                    "Employee",
                    "Grade",
                    "Basic Salary",
                    "Valid Through",
                    "Status",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length > 0 ? (
                  filtered.map((emp) => {
                    const { label, className } =
                      SALARY_STATUS_CONFIG[emp.fixation.salaryStatus];
                    return (
                      <tr
                        key={emp.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* ID */}
                        <td className="px-4 py-4 align-top">
                          <span className="font-mono text-sm text-slate-400 tracking-tight block">
                            {emp.id}
                          </span>
                        </td>

                        {/* Employee */}
                        <td className="px-4 py-4 align-top font-bn-serif text-base">
                          <p className="font-medium text-slate-800 leading-snug">
                            {emp.name.bn}
                          </p>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {emp.current_job.designation_bn}
                            {emp.wing && (
                              <span className="text-sm text-slate-400 mt-0.5">
                                {", "}{emp.wing}
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            {emp.current_job.office_bn}
                          </p>
                        </td>

                        {/* Grade */}
                        <td className="px-4 py-4 align-top">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold">
                            {emp.fixation.grade}
                          </span>
                        </td>

                        {/* Basic Salary */}
                        <td className="px-4 py-4 align-top">
                          <span className="text-sm font-medium text-slate-800 tabular-nums">
                            {formatBDT(emp.fixation.basicSalary)}
                          </span>
                        </td>

                        {/* Valid Through */}
                        <td className="px-4 py-4 align-top">
                          {emp.fixation.validFrom ? (
                            <div className="flex items-center gap-1.5 text-sm text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                              <span className="tabular-nums">
                                {emp.fixation.validFrom}
                              </span>
                              <ArrowRight size={18} />
                              <span className="tabular-nums">
                                {emp.fixation.validThru}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300 italic">
                              —
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}
                          >
                            {label}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-4 align-top">
                          <button
                            type="button"
                            onClick={() => console.log("Edit fixation for", emp.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${emp.fixation.validFrom && emp.fixation.validThru ? "text-slate-600" : "border-theme text-theme"} text-xs font-medium hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-all duration-150 cursor-pointer`}
                          >
                            {emp.fixation.validFrom && emp.fixation.validThru ? (
                              <>
                                <EditIcon />
                                Edit
                              </>
                            ) : (
                              <>
                                <PlusIcon size={18} />
                                Fix
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center text-slate-400 text-sm py-16"
                    >
                      No records match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <ProcessSalaryModal
      isOpen={modalOpen}
      onClose={() => setModalOpen(false)}
      lastProcessed={lastProcessed}
      activeCount={activeCount}
    />
    </>
  );
}
