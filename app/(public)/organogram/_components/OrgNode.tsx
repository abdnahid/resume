"use client";

import { useState } from "react";
import { Landmark, Building2, MapPin, ChevronDown, Users } from "lucide-react";
import type { OrgEntry } from "./data";
import { sumStaff } from "./data";

type Variant = "wing" | "divisional" | "regional";

const STYLES: Record<
  Variant,
  {
    card: string;
    childCard: string;
    iconColor: string;
    badge: string;
    postsBg: string;
    postsText: string;
    nameEn: string;
    nameBn: string;
    chevron: string;
    postDot: string;
  }
> = {
  wing: {
    card:      "border-amber-300  bg-amber-50   hover:border-amber-500",
    childCard: "border-amber-200  bg-white      hover:border-amber-400",
    iconColor: "text-amber-600",
    badge:     "bg-amber-100 text-amber-900",
    postsBg:   "bg-amber-50  border-amber-200",
    postsText: "text-amber-900",
    nameEn:    "text-amber-950",
    nameBn:    "text-amber-800",
    chevron:   "text-amber-400",
    postDot:   "bg-amber-500",
  },
  divisional: {
    card:      "border-emerald-300 bg-emerald-50  hover:border-emerald-500",
    childCard: "border-emerald-200 bg-white       hover:border-emerald-400",
    iconColor: "text-emerald-600",
    badge:     "bg-emerald-100 text-emerald-900",
    postsBg:   "bg-emerald-50  border-emerald-200",
    postsText: "text-emerald-900",
    nameEn:    "text-emerald-950",
    nameBn:    "text-emerald-800",
    chevron:   "text-emerald-400",
    postDot:   "bg-emerald-500",
  },
  regional: {
    card:      "border-blue-300 bg-blue-50   hover:border-blue-500",
    childCard: "border-blue-200 bg-white     hover:border-blue-400",
    iconColor: "text-blue-600",
    badge:     "bg-blue-100 text-blue-900",
    postsBg:   "bg-blue-50  border-blue-200",
    postsText: "text-blue-900",
    nameEn:    "text-blue-950",
    nameBn:    "text-blue-800",
    chevron:   "text-blue-400",
    postDot:   "bg-blue-500",
  },
};

const ICON: Record<Variant, React.FC<{ className?: string }>> = {
  wing:       ({ className }) => <Landmark   size={14} className={className} />,
  divisional: ({ className }) => <Building2  size={14} className={className} />,
  regional:   ({ className }) => <MapPin     size={14} className={className} />,
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
  const Icon = ICON[variant];
  const hasChildren = !!entry.children?.length;
  const hasPosts = !!entry.posts?.length;
  const cardStyle = isChild ? s.childCard : s.card;
  const totalStaff = sumStaff(entry);

  return (
    <div className={`rounded-lg border transition-colors overflow-hidden ${cardStyle}`}>
      {/* ── name row ── */}
      <div
        className={`flex items-center gap-2.5 px-3 py-2 ${hasChildren ? "cursor-pointer select-none" : ""}`}
        onClick={hasChildren ? onToggle : undefined}
      >
        <Icon className={`shrink-0 ${s.iconColor} ${isChild ? "opacity-50" : ""}`} />

        <div className="min-w-0 flex-1">
          <p className={`truncate text-xl font-display font-semibold leading-tight ${s.nameEn}`}>
            {entry.nameEn}
          </p>
          <p className={`truncate text-base leading-tight font-bn-serif ${s.nameBn}`}>
            {entry.nameBn}
          </p>
        </div>

        {/* staff count badge */}
        {totalStaff > 0 && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 font-bold ${s.badge}`}>
            {totalStaff}
          </span>
        )}

        {/* expand/collapse chevron */}
        {hasChildren && (
          <ChevronDown
            size={14}
            className={`shrink-0 transition-transform duration-200 ${s.chevron} ${isExpanded ? "rotate-0" : "-rotate-90"}`}
          />
        )}
      </div>

      {/* ── posts toggle row ── */}
      {hasPosts && (
        <>
          <button
            onClick={() => setPostsOpen((v) => !v)}
            className={`w-full flex items-center justify-between border-t px-3 py-1 text-sm font-semibold transition-colors ${s.postsBg} ${s.postsText}`}
          >
            <span className="flex items-center gap-1.5 font-bn-serif">
              <Users size={12} className="shrink-0 opacity-70" />
              জনবল: {entry.staffCount} — Designations
            </span>
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${postsOpen ? "rotate-0" : "-rotate-90"}`}
            />
          </button>

          {postsOpen && (
            <ul className={`border-t px-3 py-2 space-y-1 ${s.postsBg}`}>
              {entry.posts!.map((p, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${s.postsText}`}>
                  <span className={`shrink-0 rounded-full size-1.5 ${s.postDot} opacity-60 mt-1.5`} />
                  <span className="font-bn-serif">{p.nameBn}</span>
                  <span className="shrink-0 ml-auto font-bold opacity-70">{p.count}×</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
