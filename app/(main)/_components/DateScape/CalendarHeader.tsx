"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { monthNames } from "./dateScapeDatabase";

interface CalendarHeaderProps {
  period: number;
  annualYear: number;
  setPeriod: (month: number) => void;
  setAnnualYear: (year: number) => void;
}

const YEARS = Array.from({ length: 151 }, (_, i) => 1950 + i);

export function CalendarHeader({
  period,
  annualYear,
  setPeriod,
  setAnnualYear,
}: CalendarHeaderProps) {
  const [openPicker, setOpenPicker] = useState<"month" | "year" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedYearRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenPicker(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (openPicker === "year") {
      selectedYearRef.current?.scrollIntoView({ block: "center" });
    }
  }, [openPicker]);

  return (
    <div ref={containerRef} className="flex items-center justify-center gap-0.5">
      {/* Month picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenPicker(openPicker === "month" ? null : "month")}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
            openPicker === "month"
              ? "bg-primary/10 text-primary"
              : "hover:bg-primary/10 hover:text-primary text-foreground"
          }`}
        >
          {monthNames[period]}
          <ChevronDown
            size={12}
            className={`transition-transform duration-200 ${openPicker === "month" ? "rotate-180" : ""}`}
          />
        </button>

        {openPicker === "month" && (
          <div className="absolute z-50 top-full mt-1.5 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-xl shadow-black/10 p-2 w-52">
            <div className="grid grid-cols-3 gap-1">
              {monthNames.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setPeriod(i);
                    setOpenPicker(null);
                  }}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    i === period
                      ? "bg-primary text-primary-foreground"
                      : "text-body hover:bg-accent hover:text-primary"
                  }`}
                >
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <span className="text-muted-foreground text-sm font-medium">,</span>

      {/* Year picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenPicker(openPicker === "year" ? null : "year")}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
            openPicker === "year"
              ? "bg-primary/10 text-primary"
              : "hover:bg-primary/10 hover:text-primary text-foreground"
          }`}
        >
          {annualYear}
          <ChevronDown
            size={12}
            className={`transition-transform duration-200 ${openPicker === "year" ? "rotate-180" : ""}`}
          />
        </button>

        {openPicker === "year" && (
          <div className="absolute z-50 top-full mt-1.5 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-xl shadow-black/10 py-1.5 w-24 max-h-52 overflow-y-auto">
            {YEARS.map((y) => (
              <button
                key={y}
                ref={y === annualYear ? selectedYearRef : undefined}
                type="button"
                onClick={() => {
                  setAnnualYear(y);
                  setOpenPicker(null);
                }}
                className={`w-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  y === annualYear
                    ? "bg-primary text-primary-foreground"
                    : "text-body hover:bg-accent hover:text-primary"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
