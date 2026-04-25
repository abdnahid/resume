"use client";

import { Search, X } from "lucide-react";

export function FilterSearch({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white focus-within:border-slate-400 transition-colors ${className}`}
    >
      <Search size={15} className="text-slate-400 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-sm text-slate-700 placeholder-slate-400 outline-none bg-transparent"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
