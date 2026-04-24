"use client";

import { X, CalendarDays } from "lucide-react";

interface FakeInputProps {
  value?: string;
  onClear: () => void;
  fieldTitle?: string;
}

export function FakeInput({ value, onClear, fieldTitle }: FakeInputProps) {
  return (
    <div className="w-full space-y-1">
      {fieldTitle && (
        <span className="block text-sm font-medium text-subtitle">
          {fieldTitle}
        </span>
      )}
      <div className="flex items-center gap-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-body cursor-pointer hover:border-primary transition-colors">
        <CalendarDays size={15} className="shrink-0 text-primary" />
        <span
          className={`flex-1 truncate text-left ${!value ? "text-muted-foreground" : ""}`}
        >
          {value || "Validity Range"}
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="shrink-0 text-muted-foreground hover:text-danger transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
