import OrgChart from "./_components/OrgChart";
import {
  WINGS,
  DIVISIONAL_OFFICES,
  REGIONAL_OFFICES,
} from "./_components/data";

export const metadata = { title: "Organogram — BSTI" };

export default function OrganogramPage() {
  const totalPosts =
    1 + WINGS.length + DIVISIONAL_OFFICES.length + REGIONAL_OFFICES.length;

  return (
    <div className="flex flex-col h-full">
      {/* ── Page header ── */}
      <div className="shrink-0 border-b border-border bg-card px-8 py-5">
        <h1 className="text-lg font-bold text-foreground">
          Organizational Structure
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          বিএসটিআই'র সাংগঠিনক কাঠামো — Approved by Ministry of Public
          Administration & Finance
        </p>

        {/* ── Stat pills ── */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            {
              label: "Director General",
              count: 1,
              color: "bg-violet-100 text-violet-700",
            },
            {
              label: "Wings (Head Office)",
              count: WINGS.length,
              color: "bg-indigo-100 text-indigo-700",
            },
            {
              label: "Divisional Offices",
              count: DIVISIONAL_OFFICES.length,
              color: "bg-emerald-100 text-emerald-700",
            },
            {
              label: "Regional Offices",
              count: REGIONAL_OFFICES.length,
              color: "bg-amber-100 text-amber-700",
            },
          ].map((s) => (
            <span
              key={s.label}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.color}`}
            >
              <span className="text-sm font-bold">{s.count}</span>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Chart canvas — scrollable ── */}
      <div className="flex-1 overflow-auto bg-background">
        <OrgChart />
      </div>
    </div>
  );
}
