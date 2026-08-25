"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, Minus, Plus, Circle, CircleDot, X } from "lucide-react";
import { DAY_RANGES } from "@/lib/store/bds-catalog";

type Facet = { slug: string; count: number };

type Props = {
  divisions: (Facet & { nameEn: string; nameBn: string })[];
  bands: (Facet & { label: string })[];
};

export default function FilterSidebar({ divisions, bands }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");

  // Keep the inputs in step when navigation changes the URL (back button,
  // "Clear all"), without fighting the user while they type.
  useEffect(() => {
    setQ(params.get("q") ?? "");
    setMin(params.get("min") ?? "");
    setMax(params.get("max") ?? "");
  }, [params]);

  /** Builds a URL with `changes` applied, always resetting to page 1. */
  function hrefWith(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    const encoded = next.toString();
    return `/store/bds${encoded ? `?${encoded}` : ""}`;
  }

  function apply(changes: Record<string, string | null>) {
    router.push(hrefWith(changes));
  }

  /** A radio-style facet: clicking the selected value clears it. */
  function toggle(key: string, value: string) {
    return hrefWith({ [key]: params.get(key) === value ? null : value });
  }

  const hasFilters = [
    "q", "division", "from", "to", "days", "band", "min", "max", "mandatory",
  ].some((key) => params.has(key));

  return (
    <aside className="lg:sticky lg:top-24">
      <div className="flex h-10 items-center justify-between">
        <h2 className="font-display text-base font-semibold text-title">Filters</h2>
        {hasFilters && (
          <Link
            href="/store/bds"
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
            Clear all
          </Link>
        )}
      </div>

      {/* ── Search ── */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q: q.trim() || null });
        }}
        className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/15"
      >
        <input
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search BDS number or title"
          aria-label="Search standards"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
        />
        <button type="submit" aria-label="Search" className="text-muted-foreground hover:text-primary">
          <Search className="h-4 w-4" strokeWidth={2} />
        </button>
      </form>

      {/* ── Publication date ── */}
      <Section title="Publication Date">
        <div className="flex flex-col gap-2">
          <DateInput
            label="From"
            value={params.get("from") ?? ""}
            onChange={(value) => apply({ from: value || null })}
          />
          <DateInput
            label="To"
            value={params.get("to") ?? ""}
            onChange={(value) => apply({ to: value || null })}
          />
        </div>
      </Section>

      {/* ── Day wise ── */}
      <Section title="Day Wise">
        <label className="flex h-11 items-center justify-between gap-3 rounded-xl border border-border bg-card px-3">
          <span className="text-[13px] text-body">Last</span>
          <select
            value={params.get("days") ?? ""}
            onChange={(event) => apply({ days: event.target.value || null, from: null })}
            className="cursor-pointer bg-transparent pr-1 text-[13px] outline-none"
          >
            <option value="">Any time</option>
            {DAY_RANGES.map((days) => (
              <option key={days} value={days}>
                {days} days
              </option>
            ))}
          </select>
        </label>
      </Section>

      {/* ── Division ── */}
      <Section title="Division">
        <ul>
          {divisions.map((division) => (
            <FacetRow
              key={division.slug}
              href={toggle("division", division.slug)}
              selected={params.get("division") === division.slug}
              label={division.nameEn}
              sublabel={division.nameBn}
              count={division.count}
            />
          ))}
        </ul>
      </Section>

      {/* ── Price ── */}
      <Section title="Price Range">
        <ul>
          {bands.map((band) => (
            <FacetRow
              key={band.slug}
              href={toggle("band", band.slug)}
              selected={params.get("band") === band.slug}
              label={band.label}
              count={band.count}
            />
          ))}
        </ul>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            // An explicit range supersedes a selected band (see buildWhere).
            apply({ min: min || null, max: max || null, band: null });
          }}
          className="mt-3 flex items-center gap-2"
        >
          <TakaInput value={min} onChange={setMin} placeholder="0" label="Minimum price" />
          <span className="text-muted-foreground">–</span>
          <TakaInput value={max} onChange={setMax} placeholder="1000" label="Maximum price" />
          <button
            type="submit"
            className="h-10 shrink-0 rounded-xl bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Go
          </button>
        </form>
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-5 border-t border-border pt-4">
      <button
        onClick={() => setOpen((value) => !value)}
        className="mb-2 flex w-full items-center justify-between text-[12px] font-semibold uppercase tracking-wider text-subtitle"
        aria-expanded={open}
      >
        {title}
        {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      </button>
      {open && children}
    </div>
  );
}

function FacetRow({
  href,
  selected,
  label,
  sublabel,
  count,
}: {
  href: string;
  selected: boolean;
  label: string;
  sublabel?: string;
  count: number;
}) {
  const disabled = count === 0 && !selected;
  return (
    <li>
      <Link
        href={href}
        aria-disabled={disabled}
        className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[13.5px] transition-colors ${
          disabled
            ? "pointer-events-none text-muted-foreground/60"
            : selected
              ? "text-primary"
              : "text-body hover:bg-secondary hover:text-primary"
        }`}
      >
        {selected ? (
          <CircleDot className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
        ) : (
          <Circle className="h-4 w-4 shrink-0 text-border" strokeWidth={2} />
        )}
        <span className="min-w-0 flex-1 truncate">
          {label}
          {sublabel && <span className="ml-1.5 font-bn text-[12px] text-muted-foreground">{sublabel}</span>}
        </span>
        <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{count}</span>
      </Link>
    </li>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex h-11 items-center gap-3 rounded-xl border border-border bg-card px-3">
      <span className="w-11 shrink-0 text-[13px] text-body">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
      />
    </label>
  );
}

function TakaInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="flex h-10 min-w-0 flex-1 items-center overflow-hidden rounded-xl border border-border bg-card">
      <span className="flex h-full w-8 shrink-0 items-center justify-center bg-muted text-[13px] text-body">৳</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13px] outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
