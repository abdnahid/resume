"use client";

import { useState } from "react";
import type { OrgEntry } from "./data";
import { sumStaff } from "./data";

type Variant = "wing" | "divisional" | "regional";

const STYLES: Record<
  Variant,
  {
    card: string;
    childCard: string;
    dot: string;
    badge: string;
    postsBg: string;
    postsText: string;
    nameEn: string;
    nameBn: string;
  }
> = {
  wing: {
    card: "border-[#d4b896] bg-[#fdf8f2] hover:border-[#8b6545]",
    childCard: "border-[#eddbc0] bg-white     hover:border-[#c4a070]",
    dot: "bg-[#8b6545]",
    badge: "bg-[#f0e4d0] text-[#5c3d1e]",
    postsBg: "bg-[#fdf8f2] border-[#eddbc0]",
    postsText: "text-[#5c3d1e]",
    nameEn: "text-[#3a220d]",
    nameBn: "text-[#7a5535]",
  },
  divisional: {
    card: "border-[#b8c2d0] bg-[#f2f4f7] hover:border-[#556070]",
    childCard: "border-[#d4dae4] bg-white     hover:border-[#8090a0]",
    dot: "bg-[#556070]",
    badge: "bg-[#e4e8ef] text-[#2d3748]",
    postsBg: "bg-[#f2f4f7] border-[#d4dae4]",
    postsText: "text-[#2d3748]",
    nameEn: "text-[#1a222d]",
    nameBn: "text-[#445060]",
  },
  regional: {
    card: "border-[#b8c0d8] bg-[#eef0f8] hover:border-[#3d4d7a]",
    childCard: "border-[#d0d4e8] bg-white     hover:border-[#6070a0]",
    dot: "bg-[#3d4d7a]",
    badge: "bg-[#e0e4f0] text-[#1a2b5f]",
    postsBg: "bg-[#eef0f8] border-[#d0d4e8]",
    postsText: "text-[#1a2b5f]",
    nameEn: "text-[#09122c]",
    nameBn: "text-[#3d4d7a]",
  },
};

type Props = {
  entry: OrgEntry;
  variant: Variant;
  isChild?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
};

export default function OrgNode({
  entry,
  variant,
  isChild = false,
  isExpanded,
  onToggle,
}: Props) {
  const [postsOpen, setPostsOpen] = useState(false);
  const s = STYLES[variant];
  const hasChildren = !!entry.children?.length;
  const hasPosts = !!entry.posts?.length;
  const cardStyle = isChild ? s.childCard : s.card;
  const totalStaff = sumStaff(entry);

  return (
    <div
      className={`rounded-lg border transition-colors overflow-hidden ${cardStyle}`}
    >
      {/* ── name row ── */}
      <div
        className={`flex items-center gap-2.5 px-3 py-2 ${hasChildren ? "cursor-pointer select-none" : ""}`}
        onClick={hasChildren ? onToggle : undefined}
      >
        <span
          className={`size-1.5 shrink-0 rounded-full ${s.dot} ${isChild ? "opacity-50" : ""}`}
        />

        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-xl font-display font-semibold leading-tight ${s.nameEn}`}
          >
            {entry.nameEn}
          </p>
          <p
            className={`truncate text-base leading-tight font-bn-serif ${s.nameBn}`}
          >
            {entry.nameBn}
          </p>
        </div>

        {/* staff count badge */}
        {totalStaff > 0 && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 font-bold ${s.badge}`}
          >
            {totalStaff}
          </span>
        )}

        {/* children chevron */}
        {hasChildren && (
          <span
            className="shrink-0 text-muted-foreground transition-transform duration-200 text-xs"
            style={{
              transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
            }}
          >
            ▾
          </span>
        )}
      </div>

      {/* ── posts toggle row ── */}
      {hasPosts && (
        <>
          <button
            onClick={() => setPostsOpen((v) => !v)}
            className={`w-full flex items-center justify-between border-t px-3 py-1 text-sm font-semibold transition-colors ${s.postsBg} ${s.postsText}`}
          >
            <span className="font-bn-serif">
              জনবল: {entry.staffCount} — Designations
            </span>
            <span
              className="transition-transform duration-200"
              style={{
                display: "inline-block",
                transform: postsOpen ? "rotate(0deg)" : "rotate(-90deg)",
              }}
            >
              ▾
            </span>
          </button>

          {postsOpen && (
            <ul className={`border-t px-3 py-2 space-y-1 ${s.postsBg}`}>
              {entry.posts!.map((p, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 text-sm ${s.postsText}`}
                >
                  <span className="shrink-0 font-bold">{p.count}×</span>
                  <span className="font-bn-serif">{p.nameBn}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
