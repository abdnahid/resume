"use client";

import { DateRangePopover } from "@/app/(main)/_components/DateScape/DateRangePopover";
import { ArrowRight, PlusIcon } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type EmployeeStatus = "active" | "retired" | "prl" | "inactive";
type SalaryStatus = "active" | "expired" | "not_found" | "inactive";

interface Employee {
  id: string;
  name: string;
  designation: string;
  office: string;
  wing: string;
  status: EmployeeStatus;
}

interface SalaryRecord {
  id: string;
  employee: Employee;
  grade: number;
  basicSalary: number;
  validFrom: string; // mm-dd-yyyy
  validThru: string; // mm-dd-yyyy
  salaryStatus: SalaryStatus;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const EMPLOYEES: Employee[] = [
  {
    id: "19953010010",
    name: "মোঃ নুরুল আমিন",
    designation: "পরিচালক (প্রশাসন)",
    office: "প্রধান কার্যালয়, বিএসটিআই, ঢাকা",
    wing: "প্রশাসন উইং",
    status: "active",
  },
  {
    id: "20051030005",
    name: "মোঃ তাহসিন হাসান",
    designation: "পরিদর্শক(মেট্রোলজি)",
    office: "বিভাগীয় কার্যালয়, বিএসটিআই, খুলনা",
    wing: "মেট্রোলজি উইং",
    status: "active",
  },
  {
    id: "20051030006",
    name: "বিশ্বজিৎ দাস",
    designation: "গাড়িচালক",
    office: "আঞ্চলিক কার্যালয়, বিএসটিআই, নরসিংদী",
    wing: "রসায়ন উইং",
    status: "active",
  },
  {
    id: "20101030015",
    name: "মোঃ লিটন মিয়া",
    designation: "গাড়িচালক",
    office: "প্রধান কার্যালয়, বিএসটিআই, ঢাকা",
    wing: "প্রশাসন উইং",
    status: "prl",
  },
  {
    id: "20101030016",
    name: "মিজানুর রহমান",
    designation: "সহকারী পরিচালক (পুরঃ, পদার্থ)",
    office: "প্রধান কার্যালয়, বিএসটিআই, ঢাকা",
    wing: "পদার্থ পরীক্ষণ উইং",
    status: "active",
  },
  {
    id: "20220010021",
    name: "কামাল বিল্লাহ",
    designation: "মহাপরিচালক",
    office: "প্রধান কার্যালয়, বিএসটিআই, ঢাকা",
    wing: "মহাপরিচালক",
    status: "active",
  },
  {
    id: "20220010022",
    name: "রাকিব ইসলাম",
    designation: "পরিদর্শক (মেট্রোলজি)",
    office: "বিভাগীয় কার্যালয়, বিএসটিআই, চট্টগ্রাম",
    wing: "",
    status: "retired",
  },
  {
    id: "20220010023",
    name: "শাহীন সুলতানা",
    designation: "প্রোগ্রামার",
    office: "প্রধান কার্যালয়, বিএসটিআই, ঢাকা",
    wing: "মহাপরিচালক",
    status: "inactive",
  },
];

const SALARY_RECORDS: SalaryRecord[] = [
  {
    id: "SF-001",
    employee: EMPLOYEES[0],
    grade: 5,
    basicSalary: 43000,
    validFrom: "01-01-2022",
    validThru: "12-31-2024",
    salaryStatus: "active",
  },
  {
    id: "SF-002",
    employee: EMPLOYEES[1],
    grade: 9,
    basicSalary: 22000,
    validFrom: "03-15-2021",
    validThru: "03-14-2023",
    salaryStatus: "expired",
  },
  {
    id: "SF-003",
    employee: EMPLOYEES[2],
    grade: 16,
    basicSalary: 9300,
    validFrom: "06-01-2023",
    validThru: "05-31-2025",
    salaryStatus: "active",
  },
  {
    id: "SF-004",
    employee: EMPLOYEES[3],
    grade: 16,
    basicSalary: 9300,
    validFrom: "01-01-2020",
    validThru: "12-31-2021",
    salaryStatus: "expired",
  },
  {
    id: "SF-005",
    employee: EMPLOYEES[4],
    grade: 6,
    basicSalary: 35500,
    validFrom: "07-01-2023",
    validThru: "06-30-2025",
    salaryStatus: "active",
  },
  {
    id: "SF-006",
    employee: EMPLOYEES[5],
    grade: 1,
    basicSalary: 78000,
    validFrom: "01-01-2024",
    validThru: "12-31-2026",
    salaryStatus: "active",
  },
  {
    id: "SF-007",
    employee: EMPLOYEES[6],
    grade: 9,
    basicSalary: 22000,
    validFrom: "01-01-2019",
    validThru: "12-31-2020",
    salaryStatus: "inactive",
  },
  {
    id: "SF-008",
    employee: EMPLOYEES[7],
    grade: 9,
    basicSalary: 22000,
    validFrom: "",
    validThru: "",
    salaryStatus: "not_found",
  },
];

const OFFICES = [...new Set(EMPLOYEES.map((e) => e.office))];
const GRADES = Array.from({ length: 20 }, (_, i) => i + 1);

// ─── Status configs ────────────────────────────────────────────────────────────

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

/** Parse mm-dd-yyyy → Date (returns null if empty) */
function parseDate(str: string): Date | null {
  if (!str) return null;
  const [m, d, y] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatBDT(amount: number) {
  return "৳ " + amount.toLocaleString("en-BD");
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const ChevronDown = ({ className = "" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 6l4 4 4-4" />
  </svg>
);

const CheckIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    className="w-3.5 h-3.5"
  >
    <path d="M3 8l3.5 3.5L13 4.5" />
  </svg>
);

const SearchIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="w-4 h-4 text-slate-400 shrink-0"
  >
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
);

const BuildingIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="w-4 h-4 text-slate-400 shrink-0"
  >
    <rect x="2" y="3" width="12" height="11" rx="1" />
    <path d="M6 14V9h4v5" />
    <path d="M5 6h1m4 0h1M5 3v1m5-1v1" />
  </svg>
);

const GradeIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="w-4 h-4 text-slate-400 shrink-0"
  >
    <path d="M3 12h2M7 8h2M11 4h2" />
    <path d="M3 12V4" />
  </svg>
);

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

const XIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    className="w-3.5 h-3.5"
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

// ─── Reusable: click-outside hook ─────────────────────────────────────────────

function useClickOutside(callback: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) callback();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [callback]);
  return ref;
}

// ─── Select Dropdown (generic) ────────────────────────────────────────────────

interface SelectOption {
  label: string;
  value: string;
}

function SelectDropdown({
  value,
  onChange,
  options,
  placeholder,
  icon,
  width = "min-w-52",
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder: string;
  icon: React.ReactNode;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useClickOutside(close);
  const label = options.find((o) => o.value === value)?.label ?? placeholder;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all duration-150 cursor-pointer ${width}`}
      >
        {icon}
        <span className="flex-1 text-left truncate">{label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 w-full min-w-max bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-100 overflow-hidden py-1 max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
              {!value && <CheckIcon />}
            </span>
            {placeholder}
          </button>
          <div className="my-1 border-t border-slate-100" />
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
                {value === opt.value && <CheckIcon />}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Grade Range Dropdown ─────────────────────────────────────────────────────

function GradeFilterDropdown({
  exact,
  rangeFrom,
  rangeTo,
  onExactChange,
  onRangeFromChange,
  onRangeToChange,
  onClear,
}: {
  exact: string;
  rangeFrom: string;
  rangeTo: string;
  onExactChange: (v: string) => void;
  onRangeFromChange: (v: string) => void;
  onRangeToChange: (v: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"exact" | "range">("exact");
  const close = useCallback(() => setOpen(false), []);
  const ref = useClickOutside(close);

  const hasFilter = exact || rangeFrom || rangeTo;
  const label = exact
    ? `Grade ${exact}`
    : rangeFrom && rangeTo
      ? `Grade ${rangeFrom}–${rangeTo}`
      : rangeFrom
        ? `Grade ≥ ${rangeFrom}`
        : rangeTo
          ? `Grade ≤ ${rangeTo}`
          : "Grade";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-lg border bg-white text-sm transition-all duration-150 cursor-pointer min-w-36 ${
          hasFilter
            ? "border-slate-900 text-slate-900"
            : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        <GradeIcon />
        <span className="flex-1 text-left">{label}</span>
        {hasFilter ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            onKeyDown={(e) =>
              e.key === "Enter" && (e.stopPropagation(), onClear())
            }
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <XIcon />
          </span>
        ) : (
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 w-64 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-100 p-3">
          {/* Mode tabs */}
          <div className="flex rounded-lg overflow-hidden border border-slate-200 mb-3 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMode("exact");
                onRangeFromChange("");
                onRangeToChange("");
              }}
              className={`flex-1 py-1.5 transition-colors cursor-pointer ${mode === "exact" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Exact
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("range");
                onExactChange("");
              }}
              className={`flex-1 py-1.5 transition-colors cursor-pointer ${mode === "range" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Range
            </button>
          </div>

          {mode === "exact" ? (
            <div className="grid grid-cols-5 gap-1">
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    onExactChange(String(g));
                    setOpen(false);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    exact === String(g)
                      ? "bg-slate-900 text-white"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={rangeFrom}
                onChange={(e) => onRangeFromChange(e.target.value)}
                className="flex-1 h-8 px-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white outline-none cursor-pointer"
              >
                <option value="">From</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <span className="text-slate-400 text-sm">–</span>
              <select
                value={rangeTo}
                onChange={(e) => onRangeToChange(e.target.value)}
                className="flex-1 h-8 px-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white outline-none cursor-pointer"
              >
                <option value="">To</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SalaryFixationTable() {
  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [gradeExact, setGradeExact] = useState("");
  const [gradeFrom, setGradeFrom] = useState("");
  const [gradeTo, setGradeTo] = useState("");
  const [validFrom, setValidFrom] = useState<Date | undefined>(undefined);
  const [validTo, setValidTo] = useState<Date | undefined>(undefined);

  const clearGrade = () => {
    setGradeExact("");
    setGradeFrom("");
    setGradeTo("");
  };

  const filtered = SALARY_RECORDS.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.employee.id.includes(q) ||
      r.employee.name.toLowerCase().includes(q);

    const matchOffice = !officeFilter || r.employee.office === officeFilter;

    const g = r.grade;
    const matchGrade = gradeExact
      ? g === Number(gradeExact)
      : (!gradeFrom || g >= Number(gradeFrom)) &&
        (!gradeTo || g <= Number(gradeTo));

    // validity overlap: record's [validFrom..validThru] overlaps filter range
    const recFrom = parseDate(r.validFrom);
    const recTo = parseDate(r.validThru);
    const matchValidity =
      (!validFrom && !validTo) ||
      (recFrom && recTo
        ? (!validFrom || recTo >= validFrom) && (!validTo || recFrom <= validTo)
        : false);

    return matchSearch && matchOffice && matchGrade && matchValidity;
  });

  const officeOptions: SelectOption[] = OFFICES.map((o) => ({
    label: o,
    value: o,
  }));

  return (
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink text-white text-sm font-medium hover:bg-slate-700 transition-colors cursor-pointer"
          >
            + Add Record
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2.5 mb-4">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-56 h-9 px-3 rounded-lg border border-slate-200 bg-white focus-within:border-slate-400 transition-colors">
            <SearchIcon />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID or name…"
              className="flex-1 text-sm text-slate-700 placeholder-slate-400 outline-none bg-transparent"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XIcon />
              </button>
            )}
          </div>

          {/* Office */}
          <SelectDropdown
            value={officeFilter}
            onChange={setOfficeFilter}
            options={officeOptions}
            placeholder="All offices"
            icon={<BuildingIcon />}
            width="min-w-60"
          />

          {/* Grade */}
          <GradeFilterDropdown
            exact={gradeExact}
            rangeFrom={gradeFrom}
            rangeTo={gradeTo}
            onExactChange={setGradeExact}
            onRangeFromChange={setGradeFrom}
            onRangeToChange={setGradeTo}
            onClear={clearGrade}
          />

          {/* Validity */}
          <DateRangePopover
            name="validity-filter"
            startDate={validFrom}
            endDate={validTo}
            getStartDate={(d) => setValidFrom(d ? new Date(d) : undefined)}
            getEndDate={(d) => setValidTo(d ? new Date(d) : undefined)}
            lang="en-GB"
            width="w-64"
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
                  filtered.map((rec) => {
                    const { label, className } =
                      SALARY_STATUS_CONFIG[rec.salaryStatus];
                    return (
                      <tr
                        key={rec.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* ID */}
                        <td className="px-4 py-4 align-top">
                          <span className="font-mono text-sm text-slate-400 tracking-tight block">
                            {rec.employee.id}
                          </span>
                        </td>

                        {/* Employee */}
                        <td className="px-4 py-4 align-top font-bn-serif text-base">
                          <p className="font-medium text-slate-800 leading-snug">
                            {rec.employee.name}
                          </p>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {rec.employee.designation},{" "}
                            {rec.employee.wing && (
                              <span className="text-sm text-slate-400 mt-0.5">
                                {rec.employee.wing}
                              </span>
                            )}
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {rec.employee.office}
                            </p>
                          </p>
                        </td>

                        {/* Grade */}
                        <td className="px-4 py-4 align-top">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold">
                            {rec.grade}
                          </span>
                        </td>

                        {/* Basic Salary */}
                        <td className="px-4 py-4 align-top">
                          <span className="text-sm font-medium text-slate-800 tabular-nums">
                            {formatBDT(rec.basicSalary)}
                          </span>
                        </td>

                        {/* Valid Through */}
                        <td className="px-4 py-4 align-top">
                          {rec.validFrom ? (
                            <div className="flex items-center gap-1.5 text-sm text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                              <span className="tabular-nums">
                                {rec.validFrom}
                              </span>
                              <ArrowRight size={18} />
                              <span className="tabular-nums">
                                {rec.validThru}
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
                            onClick={() => console.log("Edit", rec.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${rec.validFrom && rec.validThru ? "text-slate-600" : "border-theme text-theme"} text-xs font-medium hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-all duration-150 cursor-pointer`}
                          >
                            {rec.validFrom && rec.validThru ? (
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
  );
}
