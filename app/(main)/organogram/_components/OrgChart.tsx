"use client";

import DGNode from "./DGNode";
import CategoryColumn from "./CategoryColumn";
import { WINGS, DIVISIONAL_OFFICES, REGIONAL_OFFICES } from "./data";

const CATEGORIES = [
  {
    id:      "head",
    title:   "Head Office",
    titleBn: "প্রধান কার্যালয়",
    variant: "wing"       as const,
    entries: WINGS,
  },
  {
    id:      "divisional",
    title:   "Divisional Office",
    titleBn: "বিভাগীয় কার্যালয়",
    variant: "divisional" as const,
    entries: DIVISIONAL_OFFICES,
  },
  {
    id:      "regional",
    title:   "Regional Office",
    titleBn: "আঞ্চলিক কার্যালয়",
    variant: "regional"   as const,
    entries: REGIONAL_OFFICES,
  },
];

export default function OrgChart() {
  return (
    <div className="flex flex-col items-center px-6 py-10 min-w-[900px]">

      {/* ── Director General ── */}
      <DGNode />

      {/* ── Stem from DG down to the 3-way split ── */}
      <div className="w-0.5 h-8 bg-slate-300" />

      {/* ── 3-way connector + category columns ── */}
      <div className="relative w-full grid grid-cols-3 gap-6">

        {/* Horizontal bar spanning col-1-center → col-3-center */}
        <div
          className="absolute top-0 h-px bg-slate-300"
          style={{ left: "calc(100% / 6)", right: "calc(100% / 6)" }}
        />

        {/* Vertical stubs from horizontal bar down to each column */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute h-8 w-px bg-slate-300"
            style={{ top: 0, left: `calc(${16.667 + i * 33.333}%)` }}
          />
        ))}

        {/* 3 category columns — push content below the 32px stub */}
        {CATEGORIES.map((cat) => (
          <div key={cat.id} className="flex flex-col items-center pt-8">
            <CategoryColumn
              title={cat.title}
              titleBn={cat.titleBn}
              variant={cat.variant}
              entries={cat.entries}
            />
          </div>
        ))}
      </div>

    </div>
  );
}
