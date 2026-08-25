import Link from "next/link";
import { SlidersHorizontal, SearchX } from "lucide-react";
import Navbar, { STORE_NAV } from "../Navbar";
import FilterSidebar from "./_components/FilterSidebar";
import BdsCard from "./_components/BdsCard";
import Pagination from "./_components/Pagination";
import {
  searchBds,
  parseBdsQuery,
  bdsQueryToString,
  SORTS,
  DEFAULT_SORT,
  PAGE_SIZE,
} from "@/lib/store/bds";

export const metadata = {
  title: "Bangladesh Standards — BSTI Store",
  description: "Browse and purchase Bangladesh Standards (BDS) published by BSTI.",
};

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function BdsCataloguePage({ searchParams }: Props) {
  const query = parseBdsQuery(searchParams);
  const { items, total, page, pageCount, divisionFacets, bandFacets } = await searchBds(query);

  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  const activeSort = query.sort ?? DEFAULT_SORT;

  // Which nav item this URL corresponds to — the three catalogue links differ
  // only by query string, so the page has to say.
  const activeHref =
    query.mandatory === "1"
      ? STORE_NAV.mandatory
      : query.sort === "newest" && query.days === 50
        ? STORE_NAV.justPublished
        : STORE_NAV.all;

  return (
    <>
      <Navbar activeHref={activeHref} />

      <div className="mx-auto max-w-[1440px] px-5 py-10 lg:px-10">
        <header>
          <p className="text-[11.5px] font-semibold uppercase tracking-widest text-primary">
            BSTI Standards Store
          </p>
          <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-title">
            Bangladesh Standards
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-body">
            Browse every published BDS by division, publication date and price. A purchased
            standard can be attached to one quality-licence application.
          </p>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-[260px_1fr]">
          <FilterSidebar divisions={divisionFacets} bands={bandFacets} />

          <section>
            {/* ── Result bar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[13.5px] text-body">
                {total === 0 ? (
                  "No standards match these filters"
                ) : (
                  <>
                    Showing <span className="font-semibold text-title">{first}–{last}</span> of{" "}
                    <span className="font-semibold text-title">{total}</span> standards
                  </>
                )}
              </p>

              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
                <label htmlFor="sort" className="text-[13px] text-muted-foreground">
                  Sort
                </label>
                {/* A plain form so sorting works without JavaScript; the other
                    filters are already in the URL and ride along as hidden inputs. */}
                <form method="get" id="sort-form" className="contents">
                  {Object.entries(query).map(([key, value]) =>
                    key === "sort" || key === "page" || value === undefined ? null : (
                      <input key={key} type="hidden" name={key} value={String(value)} />
                    ),
                  )}
                  <select
                    id="sort"
                    name="sort"
                    defaultValue={activeSort}
                    className="cursor-pointer rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] text-body outline-none focus:border-primary/40"
                  >
                    {Object.entries(SORTS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-body hover:border-primary/30 hover:text-primary"
                  >
                    Apply
                  </button>
                </form>
              </div>
            </div>

            {/* ── Results ── */}
            {items.length === 0 ? (
              <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
                <SearchX className="h-9 w-9 text-muted-foreground" strokeWidth={1.5} />
                <p className="mt-4 font-display text-lg font-medium text-title">
                  Nothing found
                </p>
                <p className="mt-1.5 max-w-sm text-[14px] text-body">
                  Try a broader price range, a different division, or clear the date filter.
                </p>
                <Link
                  href="/store/bds"
                  className="mt-5 rounded-lg bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  Clear all filters
                </Link>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((bds) => (
                  <BdsCard key={bds.id} bds={bds} />
                ))}
              </div>
            )}

            <Pagination
              page={page}
              pageCount={pageCount}
              hrefFor={(target) => `/store/bds${bdsQueryToString({ ...query, page: target })}`}
            />
          </section>
        </div>
      </div>
    </>
  );
}
