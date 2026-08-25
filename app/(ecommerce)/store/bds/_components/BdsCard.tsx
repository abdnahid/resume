import Link from "next/link";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { formatTaka, type BdsCard as BdsCardData } from "@/lib/store/bds-catalog";

export default function BdsCard({ bds }: { bds: BdsCardData }) {
  return (
    <Link
      href={`/store/bds/${bds.slug}`}
      className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 text-[11.5px] font-semibold text-secondary-foreground">
          <FileText className="h-3 w-3" strokeWidth={2} />
          {bds.division.nameEn}
        </span>
        {bds.isMandatory315 && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/25 px-2 py-1 text-[11px] font-semibold text-primary"
            title="Under mandatory certification"
          >
            <ShieldCheck className="h-3 w-3" strokeWidth={2} />
            Mandatory
          </span>
        )}
      </div>

      <p className="mt-4 font-mono text-[13px] font-semibold tracking-tight text-primary">
        {bds.number}
      </p>
      <h3 className="mt-1.5 line-clamp-3 font-display text-[17px] font-medium leading-snug text-title">
        {bds.titleEn}
      </h3>

      <div className="mt-3 mb-auto flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
        <span>Edition {bds.edition ?? "—"}</span>
        {bds.publishedOn && (
          <span>
            Published{" "}
            {bds.publishedOn.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </div>

      <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
        <span className="font-display text-[22px] font-semibold text-title">
          {formatTaka(bds.priceBdt)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">
          View details
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
            strokeWidth={2}
          />
        </span>
      </div>
    </Link>
  );
}
