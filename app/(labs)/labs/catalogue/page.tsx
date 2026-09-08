import ModuleNavbar from "@/components/layout/ModuleNavbar";
import PageContainer from "@/components/PageContainer";
import { requireInternal } from "@/lib/auth-guard";
import { productRows } from "@/lib/labs/catalogue";
import { LABS_NAV } from "../_components/nav";
import ProductTable from "./ProductTable";

export const dynamic = "force-dynamic";

/**
 * The catalogue, product by product.
 *
 * All 315 in one table on purpose. The question this page answers is not "find
 * me a product" — it is **"which products has nobody filed parameters for"**,
 * and that is only visible when the empty rows sit beside the full ones. 112 of
 * the 315 hold nothing at all today, and every one of them is a product a CM
 * application can be filed against with no test plan behind it.
 */
export default async function CataloguePage() {
  await requireInternal("/labs/catalogue");
  const rows = await productRows();

  return (
    <>
      <ModuleNavbar
        moduleName="Laboratory"
        moduleSubtitle="BSTI e-Services"
        navItems={LABS_NAV}
        activeHref="/labs/catalogue"
      />
      <PageContainer>
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Catalogue</p>
          <h1 className="mt-1 font-display text-3xl font-medium">Products and test parameters</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            The 315 products under mandatory certification, the sub-products beneath each, and
            what the wings charge to test them. A fee here is a wing&rsquo;s own published
            subtotal — an applicant pays the sum over every laboratory that runs part of the
            standard, so a product tested by two wings shows both.
          </p>
        </header>
        <ProductTable rows={rows} />
      </PageContainer>
    </>
  );
}
