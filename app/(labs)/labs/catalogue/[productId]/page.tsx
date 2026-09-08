import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPinned } from "lucide-react";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import PageContainer from "@/components/PageContainer";
import { requireInternal } from "@/lib/auth-guard";
import { productDetail } from "@/lib/labs/catalogue";
import { formatPoisha } from "@/lib/payments/money";
import { LABS_NAV } from "../../_components/nav";

export const dynamic = "force-dynamic";

const SECTION_LABEL: Record<string, string> = {
  textile: "Textile",
  "chemical-food": "Chemical (food)",
  "chemical-non-food": "Chemical (non-food)",
};

/**
 * One product and the packages beneath it.
 *
 * The sub-product is the level a test plan resolves against, and the level the
 * field officer records at the factory — the applicant applies against a
 * standard, and the officer writes down which variant he actually found. So
 * this page is the bridge between the published list and the testing: what
 * variants exist, what each is tested for and what each costs.
 */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await requireInternal("/labs/catalogue");
  const { productId } = await params;
  const id = Number(productId);
  if (!Number.isInteger(id)) notFound();

  const detail = await productDetail(id);
  if (!detail) notFound();
  const { product, subProducts } = detail;

  return (
    <>
      <ModuleNavbar
        moduleName="Laboratory"
        moduleSubtitle="BSTI e-Services"
        navItems={LABS_NAV}
        activeHref="/labs/catalogue"
      />
      <PageContainer>
        <Link
          href="/labs/catalogue"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" /> All products
        </Link>

        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Product {product.serial} of 315 · {product.category.nameEn}
          </p>
          <h1 className="mt-1 font-display text-3xl font-medium">{product.nameEn}</h1>
          {product.nameBn && <p className="font-bn text-lg text-muted-foreground">{product.nameBn}</p>}
          {product.genericNames.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              Also called {product.genericNames.join(", ")}
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Certified against{" "}
            {product.standards.length
              ? product.standards.map((s) => s.bds.number).join(", ")
              : "no standard on file"}
            {product.standards.length > 1 && (
              <>
                {" "}
                — <strong>all of them</strong>, not one: a multi-part standard is one
                specification split across catalogue rows.
              </>
            )}
          </p>
        </header>

        {!subProducts.length ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <strong>No wing has filed test parameters for this product.</strong> An application
            can still be made against it, and the test plan will resolve to nothing — no
            destinations, no test fee and no sampling grid. The wing that tests it needs to file
            its parameter list.
          </p>
        ) : (
          <section className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 font-medium">Sub-product</th>
                  <th className="px-4 py-2.5 font-medium">Standard as printed</th>
                  <th className="px-4 py-2.5 font-medium">Wings</th>
                  <th className="px-4 py-2.5 text-right font-medium">Tests</th>
                  <th className="px-4 py-2.5 text-right font-medium">Turnaround</th>
                  <th className="px-4 py-2.5 text-right font-medium">Normal</th>
                  <th className="px-4 py-2.5 text-right font-medium">Urgent</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {subProducts.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/40">
                    <td className="px-4 py-2">
                      <Link
                        href={`/labs/catalogue/sub-product/${s.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {s.nameEn}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {s.standardAsPrinted ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex flex-wrap gap-1">
                        {s.sections.map((x) => (
                          <span
                            key={x}
                            className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                          >
                            {SECTION_LABEL[x] ?? x}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.parameterCount}</td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">
                      {s.turnaroundNormalDays ?? "?"}d / {s.turnaroundUrgentDays ?? "?"}d
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPoisha(s.normalFeePoisha)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPoisha(s.urgentFeePoisha)}
                      {s.provisionalUrgent > 0 && (
                        <span
                          title="Some of these urgent fees are apportioned or unverified rather than published per test"
                          className="ml-1 cursor-help text-amber-600 dark:text-amber-400"
                        >
                          *
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/labs/mapping?subProduct=${s.id}`}
                        title="Where each of these tests is sent"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                      >
                        <MapPinned className="h-3.5 w-3.5" /> Map
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {subProducts.some((s) => s.provisionalUrgent > 0) && (
          <p className="text-xs text-muted-foreground">
            <span className="text-amber-600 dark:text-amber-400">*</span> The urgent fee is
            apportioned across the package rather than published per test. It is right for the
            package total — it matches what the wing charges — and it is not a per-test price
            anyone has confirmed. Open the sub-product to see which is which.
          </p>
        )}
      </PageContainer>
    </>
  );
}
