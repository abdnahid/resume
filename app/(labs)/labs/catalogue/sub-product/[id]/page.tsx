import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPinned } from "lucide-react";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import PageContainer from "@/components/PageContainer";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor } from "@/lib/workflow/inbox";
import { canEditCatalogue } from "@/lib/labs/access";
import { methodOptions, subProductDetail } from "@/lib/labs/catalogue";
import { LABS_NAV } from "../../../_components/nav";
import PackageEditor from "./PackageEditor";

export const dynamic = "force-dynamic";

/**
 * One package — the level a test plan actually resolves against.
 *
 * Everything about the money and the limits lives here, because everything
 * about them is per parameter and per package: the fee is per parameter (D62),
 * the limit sits at the leaf (D61), and the urgent price is decided once for
 * the whole package and stored on each row (D99).
 *
 * **Reading is open; writing is superadmin's.** The catalogue is the wing's
 * published fee schedule, and an office able to edit it could reduce what its
 * own applicants pay. An officer planning a visit and an examiner expecting a
 * box both have reason to read it, and neither has a reason to be refused.
 */
export default async function SubProductPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireInternal("/labs/catalogue");
  const { id } = await params;
  const subProductId = Number(id);
  if (!Number.isInteger(subProductId)) notFound();

  const [sp, methods, actor] = await Promise.all([
    subProductDetail(subProductId),
    methodOptions(),
    actorFor(viewer),
  ]);
  if (!sp) notFound();

  const canEdit = canEditCatalogue({
    role: actor.role, roles: actor.roles, employeeId: actor.employeeId, officeId: actor.officeId,
  });

  return (
    <>
      <ModuleNavbar
        moduleName="Laboratory"
        moduleSubtitle="BSTI e-Services"
        navItems={LABS_NAV}
        activeHref="/labs/catalogue"
      />
      <PageContainer>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/labs/catalogue/${sp.product.id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" /> {sp.product.nameEn}
          </Link>
          <Link
            href={`/labs/mapping?subProduct=${sp.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:border-primary/40"
          >
            <MapPinned className="h-4 w-4" /> Where these tests are sent
          </Link>
        </div>

        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Sub-product of {sp.product.nameEn}
          </p>
          <h1 className="mt-1 font-display text-3xl font-medium">{sp.nameEn}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sp.standardAsPrinted ? (
              <>
                Tested against <strong>{sp.standardAsPrinted}</strong> as the wing&rsquo;s file
                prints it
                {sp.product.bds && sp.product.bds.number !== sp.standardAsPrinted && (
                  <>
                    {" "}
                    — the product is identified by <strong>{sp.product.bds.number}</strong>, and
                    both are kept rather than one being picked
                  </>
                )}
                .
              </>
            ) : (
              "No standard recorded for this package."
            )}
          </p>
        </header>

        {sp.foldedAt && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <strong>This row is no longer a package.</strong> {sp.foldedNote} It is kept because
            it is the name that wing&rsquo;s file actually prints — re-importing that file writes
            its parameters straight back onto this row, and{" "}
            <span className="font-mono text-xs">npm run labs:reconcile</span> folds them away
            again. It is offered nowhere.
          </p>
        )}

        <PackageEditor
          subProductId={sp.id}
          nameEn={sp.nameEn}
          packageFees={sp.packageFees}
          parameters={sp.parameters}
          methods={methods}
          canEdit={canEdit}
        />
      </PageContainer>
    </>
  );
}
