"use client";

import { Loader, UserCheck } from "lucide-react";
import { useState, useRef, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Status = "active" | "retired" | "prl" | "inactive";

interface Employee {
  id: string;
  name: string;
  designation: string;
  office: string;
  wing: string;
  status: Status;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const EMPLOYEES: Employee[] = [
  {
    id: "19953010010",
    name: "মোঃ নুরুল আমিন",
    designation: "পরিচালক (প্রশাসন)",
    office: "প্রধান কার্যালয়, বিএসটিআই, ঢাকা",
    wing: "প্রশাসন উইং",
    status: "active",
  },
  {
    id: "20051030005",
    name: "মোঃ তাহসিন হাসান",
    designation: "পরিদর্শক(মেট্রোলজি)",
    office: "বিভাগীয় কার্যালয়, বিএসটিআই, খুলনা",
    wing: "মেট্রোলজি উইং",
    status: "active",
  },
  {
    id: "20051030006",
    name: "বিশ্বজিৎ দাস",
    designation: "গাড়িচালক",
    office: "আঞ্চলিক কার্যালয়, বিএসটিআই, নরসিংদী",
    wing: "রসায়ন উইং",
    status: "active",
  },
  {
    id: "20101030015",
    name: "মোঃ লিটন মিয়া",
    designation: "গাড়িচালক",
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

const OFFICES = [
  "প্রধান কার্যালয়, বিএসটিআই, ঢাকা",
  "বিভাগীয় কার্যালয়, বিএসটিআই, চট্টগ্রাম",
  "আঞ্চলিক কার্যালয়, বিএসটিআই, নরসিংদী",
];
const STATUS = ["prl", "active", "inactive", "retired"];

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
  retired: {
    label: "Retired",
    className: "bg-slate-100  text-slate-600   ring-1 ring-slate-200",
  },
  prl: {
    label: "PRL",
    className: "bg-amber-50   text-amber-700   ring-1 ring-amber-200",
  },
  inactive: {
    label: "Inactive",
    className: "bg-red-50     text-red-600     ring-1 ring-red-200",
  },
};

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
    strokeWidth="2"
    strokeLinecap="round"
    className="w-3.5 h-3.5"
  >
    <path d="M3 8l3.5 3.5L13 4.5" />
  </svg>
);

const OfficeIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="w-3.5 h-3.5 shrink-0"
  >
    <rect x="2" y="4" width="12" height="10" rx="1.5" />
    <path d="M5 4V3a3 3 0 016 0v1" />
  </svg>
);

const ProfileIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="w-3.5 h-3.5 shrink-0"
  >
    <circle cx="8" cy="5.5" r="3" />
    <path d="M2 14c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
  </svg>
);

const ResumeIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="w-3.5 h-3.5 shrink-0"
  >
    <rect x="3" y="2" width="10" height="12" rx="1.5" />
    <line x1="6" y1="6" x2="10" y2="6" />
    <line x1="6" y1="8.5" x2="10" y2="8.5" />
    <line x1="6" y1="11" x2="8.5" y2="11" />
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

// ─── Office Select ────────────────────────────────────────────────────────────

function OfficeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
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

  const label = value || "সকল অফিস";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all duration-150 min-w-56 cursor-pointer"
      >
        <OfficeIcon />
        <span className="flex-1 text-left truncate font-bn-serif">{label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 w-full min-w-64 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-100 overflow-hidden py-1">
          {/* All offices option */}
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="font-bn-serif w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
              {!value && <CheckIcon />}
            </span>
            <span>সকল অফিস</span>
          </button>

          <div className="my-1 border-t border-slate-100" />

          {OFFICES.map((office) => (
            <button
              key={office}
              type="button"
              onClick={() => {
                onChange(office);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-emerald-600">
                {value === office && <CheckIcon />}
              </span>
              <span className="text-left font-bn-serif">{office}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Office Select ────────────────────────────────────────────────────────────

function StatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
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

  const label = value || "All Status";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all duration-150 min-w-56 cursor-pointer"
      >
        <UserCheck size={18} />
        <span className="flex-1 text-left truncate">{label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 w-full min-w-64 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-100 overflow-hidden py-1">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
              {!value && <CheckIcon />}
            </span>
            <span>All</span>
          </button>

          <div className="my-1 border-t border-slate-100" />

          {STATUS.map((stat) => (
            <button
              key={stat}
              type="button"
              onClick={() => {
                onChange(stat);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-emerald-600">
                {value === stat && <CheckIcon />}
              </span>
              <span className="text-left uppercase">{stat}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Action Menu ──────────────────────────────────────────────────────────────

const ACTIONS = [
  { key: "office-assign", label: "Office assign", icon: <OfficeIcon /> },
  { key: "profile", label: "Profile", icon: <ProfileIcon /> },
  { key: "resume", label: "Resume", icon: <ResumeIcon /> },
];

function ActionMenu({ employeeId }: { employeeId: string }) {
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

  const handleAction = (key: string) => {
    console.log(`Action: ${key} for employee ${employeeId}`);
    setOpen(false);
    // Wire up real handlers here
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all duration-150 cursor-pointer"
      >
        Actions
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 right-0 top-full mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-100 py-1">
          {ACTIONS.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleAction(key)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="text-slate-400">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: Status }) {
  const { label, className } = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

// ─── Main Table ───────────────────────────────────────────────────────────────

export default function EmployeeTable() {
  const [search, setSearch] = useState("");
  const [office, setOffice] = useState("");
  const [stat, setStat] = useState("");

  const filtered = EMPLOYEES.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q || e.id.includes(q) || e.name.toLowerCase().includes(q);
    const matchOffice = !office || e.office === office;
    const matchStat = !stat || e.status === stat;
    return matchSearch && matchOffice && matchStat;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-">Employees</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {filtered.length} employee{filtered.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors cursor-pointer"
          >
            + Add Employee
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 h-9 px-3 rounded-lg border border-slate-200 bg-white focus-within:border-slate-400 transition-colors">
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
                ✕
              </button>
            )}
          </div>

          {/* Office select */}
          <OfficeSelect value={office} onChange={setOffice} />
          <StatusSelect value={stat} onChange={setStat} />
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <colgroup>
              <col className="w-36" />
              <col />
              <col className="w-28" />
              <col className="w-32" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">
                  ID
                </th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
                  Employee
                </th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length > 0 ? (
                filtered.map((emp) => (
                  <tr
                    key={emp.id}
                    className="group hover:bg-slate-50/70 transition-colors"
                  >
                    {/* ID */}
                    <td className="px-5 py-4 align-top">
                      <span className="font-mono text-xs text-slate-400 tracking-tight">
                        {emp.id}
                      </span>
                    </td>

                    {/* Employee */}
                    <td className="px-4 py-4 align-top">
                      <p className="font-medium text-slate-800 leading-snug font-bn-serif text-base">
                        {emp.name}
                      </p>
                      <p className="text-sm text-slate-500 mt-0.5 font-bn-serif">
                        {emp.wing
                          ? `${emp.designation} — ${emp.wing}`
                          : emp.designation}
                      </p>
                      <p className="text-sm text-slate-400 mt-0.5 font-bn-serif">
                        {emp.office}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4 align-top">
                      <StatusPill status={emp.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 align-top">
                      <ActionMenu employeeId={emp.id} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center text-slate-400 text-sm py-16"
                  >
                    No employees match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
