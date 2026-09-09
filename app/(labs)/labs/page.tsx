import Link from "next/link";
import { FlaskConical, MapPinned, ListTree, TriangleAlert } from "lucide-react";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import PageContainer from "@/components/PageContainer";
import { requireInternal } from "@/lib/auth-guard";
import { coverage } from "@/lib/labs/mapping";
import { LABS_NAV } from "./_components/nav";

export const dynamic = "force-dynamic";

/**
 * Where the laboratory reference data stands.
 *
 * The two numbers that matter are how much of the catalogue exists and how much
 * of the map is a decision rather than a stand-in. Every one of the seeded
 * routing rows points at the owning head-office section and carries
 * `isPlaceholder` (D66) — 109,641 of them — so "how far have the offices got"
 * is not a thing anyone can eyeball, and it is the first thing this page says.
 */
export default async function LabsOverviewPage() {
  await requireInternal("/labs");
  const c = await coverage();

  // The number that matters is no longer "how much of a map is filled in" —
  // there is no map to fill (D116). It is how much of the catalogue anybody can
  // test at all, because a parameter no office covers is an application that
  // cannot resolve.
  const covered = c.parameters - c.parametersWithNoCapableOffice;
  const pct = c.parameters ? Math.round((covered / c.parameters) * 100) : 0;
  const labsWithNothing = c.labs.filter((l) => l.isActive && l.declared === 0);

  return (
    <>
      <ModuleNavbar moduleName="Laboratory" moduleSubtitle="BSTI e-Services" navItems={LABS_NAV} />
      <PageContainer>
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Testing reference data
          </p>
          <h1 className="mt-1 font-display text-3xl font-medium">Laboratory</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            What every product is tested for, what each test costs, what each laboratory can
            actually run, and where a sample goes when the receiving office cannot run it
            itself.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            icon={ListTree}
            label="Test parameters"
            value={c.parameters.toLocaleString("en-BD")}
            note={`across ${c.subProducts.toLocaleString("en-BD")} sub-products`}
            href="/labs/catalogue"
          />
          <Tile
            icon={FlaskConical}
            label="Laboratories"
            value={`${c.labsActive}`}
            note={c.labsActive === c.labsTotal ? "all open" : `${c.labsTotal - c.labsActive} closed`}
            href="/labs/registry"
          />
          <Tile
            icon={MapPinned}
            label="Tests coverable"
            value={`${pct}%`}
            note={`${covered.toLocaleString("en-BD")} of ${c.parameters.toLocaleString("en-BD")} have a capable office`}
            href="/labs/mapping"
          />
          <Tile
            icon={TriangleAlert}
            label="Labs yet to declare"
            value={`${labsWithNothing.length}`}
            note={`of ${c.labsActive} open — nothing of their own on record`}
            href="/labs/coverage"
          />
        </div>

        {c.capabilityRows === 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <p>
              <strong>Nothing on record is a laboratory&rsquo;s own answer yet.</strong> A test
              parameter belongs to no office — the catalogue is the same everywhere — but the
              old model demanded a destination for every one of 109,802 office × parameter cells
              before anything resolved, and none was ever filled in. It is gone: an office now
              lists only what it <em>can</em> test, and silence means it cannot.
            </p>
            <p className="mt-2">
              <Link href="/labs/coverage" className="font-medium underline">
                Each office fills in its own coverage
              </Link>{" "}
              — the products it handles, what its own bench can run, and where the rest goes.
            </p>
          </div>
        )}

        <section className="rounded-2xl border border-border bg-card">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
            How far each office has got
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2 font-medium">Office</th>
                  <th className="px-5 py-2 text-right font-medium">Own bench</th>
                  <th className="px-5 py-2 text-right font-medium">Sent out</th>
                  <th className="px-5 py-2 text-right font-medium">Preferences</th>
                  <th className="px-5 py-2 font-medium">Share of the catalogue</th>
                </tr>
              </thead>
              <tbody>
                {c.offices.map((o) => {
                  const p = c.parameters ? Math.round((o.total / c.parameters) * 100) : 0;
                  return (
                    <tr key={o.officeId} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-2">
                        <Link
                          href={`/labs/mapping?office=${o.officeId}`}
                          className="hover:text-primary hover:underline"
                        >
                          {o.office}
                        </Link>
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums">
                        {o.inHouse ? o.inHouse.toLocaleString("en-BD") : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums">
                        {o.thirdParty ? o.thirdParty.toLocaleString("en-BD") : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-muted-foreground">
                        {o.preferences || "—"}
                      </td>
                      <td className="px-5 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${p}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">{p}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
            What each laboratory has said it can run
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2 font-medium">Laboratory</th>
                  <th className="px-5 py-2 font-medium">Office</th>
                  <th className="px-5 py-2 text-right font-medium">Declared</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {c.labs.map((l) => (
                  <tr key={l.labId} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2">
                      <Link href={`/labs/registry/${l.labId}`} className="hover:text-primary hover:underline">
                        {l.lab}
                      </Link>
                    </td>
                    <td className="px-5 py-2 text-muted-foreground">{l.office}</td>
                    <td className="px-5 py-2 text-right tabular-nums">
                      {l.declared ? (
                        l.declared.toLocaleString("en-BD")
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-2">
                      {l.isActive ? (
                        <span className="text-xs text-muted-foreground">Open</span>
                      ) : (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                          Closed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </PageContainer>
    </>
  );
}

function Tile({
  icon: Icon, label, value, note, href,
}: {
  icon: typeof FlaskConical;
  label: string; value: string; note: string; href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-medium tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </Link>
  );
}
