import Link from "next/link";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import FullBleedContainer from "@/components/FullBleedContainer";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor } from "@/lib/workflow/inbox";
import { editableOffices } from "@/lib/labs/access";
import { labOptions, mapFor, officeOptions } from "@/lib/labs/mapping";
import { productRows } from "@/lib/labs/catalogue";
import { prisma } from "@/lib/prisma";
import { LABS_NAV } from "../_components/nav";
import MapPicker from "./MapPicker";
import MapGrid from "./MapGrid";

export const dynamic = "force-dynamic";

/**
 * The 2D map: where each test goes, for a sample received at each office.
 *
 * **Full bleed, not `PageContainer`.** 23 office columns do not fit a 1440px
 * box, and the grid is the page — so it uses `FullBleedContainer`, which is
 * what carries the clearance for the docked sidebar at `min-[1920px]`.
 *
 * One package at a time, always: the whole map is 109,641 cells and nobody
 * works in it whole. The question people bring here is "for this product,
 * where does each test go", and that is one package wide and 23 offices
 * across.
 */
export default async function MappingPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; subProduct?: string; office?: string }>;
}) {
  const viewer = await requireInternal("/labs/mapping");
  const sp = await searchParams;
  const subProductId = Number(sp.subProduct);

  const [actor, offices, labs, products] = await Promise.all([
    actorFor(viewer),
    officeOptions(),
    labOptions(),
    productRows(),
  ]);
  const mayEdit = editableOffices({
    role: actor.role, employeeId: actor.employeeId, officeId: actor.officeId,
  });

  const chosen = Number.isInteger(subProductId) ? await mapFor(subProductId) : null;

  // The picker's second column: which packages exist under a product. Only
  // fetched once a product is in play, so opening the page costs nothing.
  // A product chosen without a package is a real state — that is the moment
  // between the two steps of the picker — so the product comes from the map
  // when there is one and from the query string when there is not.
  const productId = chosen?.subProduct.product.id ?? Number(sp.product);
  const siblings = Number.isInteger(productId)
    ? await prisma.subProduct.findMany({
        where: { productId, foldedAt: null },
        orderBy: [{ ordinal: "asc" }, { id: "asc" }],
        select: { id: true, nameEn: true, _count: { select: { parameters: true } } },
      })
    : [];

  return (
    <>
      <ModuleNavbar
        moduleName="Laboratory"
        moduleSubtitle="BSTI e-Services"
        navItems={LABS_NAV}
        activeHref="/labs/mapping"
      />
      <FullBleedContainer>
        <div className="mx-auto w-full max-w-[1800px] space-y-5 px-5 py-6 lg:px-10">
          <header>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Laboratory mapping
            </p>
            <h1 className="mt-1 font-display text-3xl font-medium">Where each test is sent</h1>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">
              An application can be filed at any office; the laboratory is chosen by who can
              actually run the test. A sample received at Khulna may have some parameters tested
              at Khulna, some sent to Faridpur and some to head office — and which is which is
              this office&rsquo;s own decision, not a rule about distance. Each office fills in
              its own column.
            </p>
          </header>

          <MapPicker
            products={products.filter((p) => p.parameters > 0)}
            siblings={siblings}
            currentProductId={Number.isInteger(productId) ? productId : null}
            currentSubProductId={chosen?.subProduct.id ?? null}
          />

          {!chosen ? (
            <p className="rounded-xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
              {siblings.length
                ? "Now choose one of its sub-products."
                : "Choose a product and a sub-product above to see and edit its map."}
            </p>
          ) : (
            <MapGrid
              subProduct={chosen.subProduct}
              parameters={chosen.parameters}
              routings={chosen.routings}
              capabilities={chosen.capabilities}
              offices={offices.map((o) => ({ id: o.id, nameEn: o.nameEn, labCount: o._count.labs }))}
              labs={labs}
              editableOfficeIds={mayEdit}
              preselectedOfficeId={Number(sp.office) || actor.officeId}
            />
          )}

          {chosen && (
            <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground">
              A destination has to hold the capability before it can be chosen — that is why
              capability and routing are two lists and not one map. Record what a laboratory can
              run on{" "}
              <Link href="/labs/registry" className="text-primary hover:underline">
                its own page
              </Link>
              , then point offices at it here.
            </p>
          )}
        </div>
      </FullBleedContainer>
    </>
  );
}
