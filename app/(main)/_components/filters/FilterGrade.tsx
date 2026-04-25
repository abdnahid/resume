"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

const DEFAULT_GRADES = Array.from({ length: 20 }, (_, i) => i + 1);

export function FilterGrade({
  exact,
  rangeFrom,
  rangeTo,
  onExactChange,
  onRangeFromChange,
  onRangeToChange,
  onClear,
  grades = DEFAULT_GRADES,
}: {
  exact: string;
  rangeFrom: string;
  rangeTo: string;
  onExactChange: (v: string) => void;
  onRangeFromChange: (v: string) => void;
  onRangeToChange: (v: string) => void;
  onClear: () => void;
  grades?: number[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"exact" | "range">("exact");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
        {/* Bar-chart style grade icon — no good lucide equivalent */}
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4 text-slate-400 shrink-0">
          <path d="M3 12h2M7 8h2M11 4h2" /><path d="M3 12V4" />
        </svg>
        <span className="flex-1 text-left">{label}</span>
        {hasFilter ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X size={13} />
          </button>
        ) : (
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 w-64 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-100 p-3">
          <div className="flex rounded-lg overflow-hidden border border-slate-200 mb-3 text-xs font-medium">
            <button
              type="button"
              onClick={() => { setMode("exact"); onRangeFromChange(""); onRangeToChange(""); }}
              className={`flex-1 py-1.5 transition-colors cursor-pointer ${mode === "exact" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Exact
            </button>
            <button
              type="button"
              onClick={() => { setMode("range"); onExactChange(""); }}
              className={`flex-1 py-1.5 transition-colors cursor-pointer ${mode === "range" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Range
            </button>
          </div>

          {mode === "exact" ? (
            <div className="grid grid-cols-5 gap-1">
              {grades.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => { onExactChange(String(g)); setOpen(false); }}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    exact === String(g) ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
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
                {grades.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <span className="text-slate-400 text-sm">–</span>
              <select
                value={rangeTo}
                onChange={(e) => onRangeToChange(e.target.value)}
                className="flex-1 h-8 px-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white outline-none cursor-pointer"
              >
                <option value="">To</option>
                {grades.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
