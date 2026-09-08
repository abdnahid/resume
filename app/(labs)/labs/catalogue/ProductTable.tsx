"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { formatPoisha } from "@/lib/payments/money";
import type { ProductRow } from "@/lib/labs/catalogue";

const SECTION_LABEL: Record<string, string> = {
  textile: "Textile",
  "chemical-food": "Chemical (food)",
  "chemical-non-food": "Chemical (non-food)",
};

/**
 * Filtered in the browser, not by a round trip.
 *
 * 315 rows is small enough to hold, and the two filters people actually use —
 * a name and "show me the ones with nothing" — are both instant that way. A
 * server round trip per keystroke would make a list this size feel slower than
 * the spreadsheet it replaced.
 */
export default function ProductTable({ rows }: { rows: ProductRow[] }) {
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "empty" | "filed">("all");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (only === "empty" && r.parameters > 0) return false;
      if (only === "filed" && r.parameters === 0) return false;
      if (!needle) return true;
      return r.nameEn.toLowerCase().includes(needle) || String(r.serial) === needle;
    });
  }, [rows, q, only]);

  const empty = rows.filter((r) => r.parameters === 0).length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or serial number"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex rounded-lg border border-border bg-card p-0.5 text-sm">
          {([
            ["all", `All ${rows.length}`],
            ["filed", `With parameters ${rows.length - empty}`],
            ["empty", `Nothing filed ${empty}`],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setOnly(k)}
              className={`rounded-md px-3 py-1.5 ${
                only === k ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium">Wings that have filed</th>
              <th className="px-4 py-2.5 text-right font-medium">Sub-products</th>
              <th className="px-4 py-2.5 text-right font-medium">Parameters</th>
              <th className="px-4 py-2.5 text-right font-medium">Normal</th>
              <th className="px-4 py-2.5 text-right font-medium">Urgent</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/40">
                <td className="px-4 py-2 tabular-nums text-muted-foreground">{r.serial}</td>
                <td className="px-4 py-2">
                  <Link href={`/labs/catalogue/${r.id}`} className="font-medium hover:text-primary hover:underline">
                    {r.nameEn}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  {r.sections.length ? (
                    <span className="flex flex-wrap gap-1">
                      {r.sections.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                        >
                          {SECTION_LABEL[s] ?? s}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">none yet</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{r.subProducts || "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.parameters || "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                  {r.parameters ? formatPoisha(r.normalFeePoisha) : "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                  {r.parameters ? formatPoisha(r.urgentFeePoisha) : "—"}
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nothing matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        The totals are the sum over every parameter of every sub-product — the whole product, not
        one package. An application is tested against the sub-products it names, so what an
        applicant pays is always less than the figure here unless they make every variant.
      </p>
    </section>
  );
}
