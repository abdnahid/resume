"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";

type RepeatingSectionProps<T> = {
  rows: T[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  addLabel?: string;
  children: (row: T, index: number) => React.ReactNode;
  emptyMessage?: string;
};

export default function RepeatingSection<T>({
  rows, onAdd, onRemove, addLabel = "+ Add", children, emptyMessage,
}: RepeatingSectionProps<T>) {
  return (
    <div className="space-y-4">
      {rows.length === 0 && emptyMessage && (
        <p className="text-sm text-muted-foreground italic py-4 text-center border border-dashed border-border rounded-lg">
          {emptyMessage}
        </p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="relative rounded-xl border border-border bg-card p-5 group">
          <div className="absolute top-3 left-3 text-muted-foreground/30 cursor-grab">
            <GripVertical size={14} />
          </div>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-red-500 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
          <div className="pl-3">
            {children(row, i)}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-slate-400 hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer w-full justify-center"
      >
        <Plus size={14} />
        {addLabel}
      </button>
    </div>
  );
}
