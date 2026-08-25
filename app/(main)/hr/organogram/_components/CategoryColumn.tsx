"use client";

import { useState } from "react";
import type { OrgEntry } from "./data";
import { sumStaff } from "./data";
import OrgNode from "./OrgNode";

type Variant = "wing" | "divisional" | "regional";

const HEADER_STYLES: Record<Variant, string> = {
  wing:       "border-amber-800   bg-amber-800",
  divisional: "border-emerald-800 bg-emerald-800",
  regional:   "border-blue-800    bg-blue-800",
};

const STEM_STYLES: Record<Variant, string> = {
  wing:       "bg-amber-400",
  divisional: "bg-emerald-400",
  regional:   "bg-blue-400",
};

const RAIL_STYLES: Record<Variant, string> = {
  wing:       "border-amber-300",
  divisional: "border-emerald-300",
  regional:   "border-blue-300",
};

const STUB_STYLES: Record<Variant, string> = {
  wing:       "bg-amber-300",
  divisional: "bg-emerald-300",
  regional:   "bg-blue-300",
};

const CHILD_RAIL_STYLES: Record<Variant, string> = {
  wing:       "border-amber-200",
  divisional: "border-emerald-200",
  regional:   "border-blue-200",
};

const CHILD_STUB_STYLES: Record<Variant, string> = {
  wing:       "bg-amber-200",
  divisional: "bg-emerald-200",
  regional:   "bg-blue-200",
};

const COUNT_STYLES: Record<Variant, string> = {
  wing:       "bg-amber-100   text-amber-900",
  divisional: "bg-emerald-100 text-emerald-900",
  regional:   "bg-blue-100    text-blue-900",
};

/* ── recursive entry row ── */
function EntryRow({
  entry,
  variant,
  depth = 0,
}: {
  entry: OrgEntry;
  variant: Variant;
  depth?: number;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = !!entry.children?.length;
  const stubStyle = depth === 0 ? STUB_STYLES[variant] : CHILD_STUB_STYLES[variant];

  return (
    <div>
      {/* stub + card */}
      <div className="flex items-center">
        <div className={`h-px w-4 shrink-0 ${stubStyle}`} />
        <div className="flex-1 min-w-0">
          <OrgNode
            entry={entry}
            variant={variant}
            isChild={depth > 0}
            isExpanded={open}
            onToggle={() => setOpen((v) => !v)}
          />
        </div>
      </div>

      {/* children — rendered recursively */}
      {hasChildren && open && (
        <div className={`ml-8 mt-1 mb-1 border-l-2 ${CHILD_RAIL_STYLES[variant]}`}>
          {entry.children!.map((child) => (
            <div key={child.id} className="mt-1">
              <EntryRow entry={child} variant={variant} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── main column ── */
type Props = {
  title: string;
  titleBn: string;
  entries: OrgEntry[];
  variant: Variant;
};

export default function CategoryColumn({ title, titleBn, entries, variant }: Props) {
  const totalManpower = entries.reduce((sum, e) => sum + sumStaff(e), 0);

  return (
    <div className="flex flex-col items-center w-full">
      {/* ── category header ── */}
      <div className={`w-full rounded-xl border-2 px-4 py-3 text-white shadow-md ${HEADER_STYLES[variant]}`}>
        <p className="text-center text-xl font-display font-bold leading-tight text-white">
          {title}
        </p>
        <p className="text-center opacity-80 mt-0.5 font-bn-serif text-gray-100">
          {titleBn}
        </p>
        <div className="mt-2 flex justify-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${COUNT_STYLES[variant]}`}>
            {entries.length} units
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold font-bn-serif ${COUNT_STYLES[variant]}`}>
            জনবল: {totalManpower}
          </span>
        </div>
      </div>

      {/* ── vertical stem ── */}
      <div className={`w-0.5 h-6 ${STEM_STYLES[variant]}`} />

      {/* ── rail + entry rows ── */}
      <div className={`w-full border-l-2 ${RAIL_STYLES[variant]}`}>
        <div className="flex flex-col gap-1.5 py-1 pl-0">
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} variant={variant} />
          ))}
        </div>
      </div>
    </div>
  );
}
