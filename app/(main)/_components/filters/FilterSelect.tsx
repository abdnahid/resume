"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface FilterSelectOption {
  label: string;
  value: string;
  className?: string;
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  icon,
  width = "min-w-52",
  optionClassName = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: FilterSelectOption[];
  placeholder: string;
  icon?: React.ReactNode;
  width?: string;
  optionClassName?: string;
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

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all duration-150 cursor-pointer ${width}`}
      >
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
        <span className={`flex-1 text-left truncate ${selected?.className ?? optionClassName}`}>
          {label}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 w-full min-w-max bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-100 py-1 max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer ${optionClassName}`}
          >
            <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
              {!value && <Check size={13} />}
            </span>
            {placeholder}
          </button>
          <div className="my-1 border-t border-slate-100" />
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-emerald-600">
                {value === opt.value && <Check size={13} />}
              </span>
              <span className={`text-left ${opt.className ?? optionClassName}`}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
