import { redirect } from "next/navigation";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import PageContainer from "@/components/PageContainer";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor } from "@/lib/workflow/inbox";
import { canEditCoverage, editableOffices } from "@/lib/labs/access";
import { productRows } from "@/lib/labs/catalogue";
import { coverageFor, scopeFor } from "@/lib/labs/coverage";
import { officeOptions } from "@/lib/labs/mapping";
import { prisma } from "@/lib/prisma";
import { LABS_NAV } from "../_components/nav";
import CoverageWizard from "./CoverageWizard";

export const dynamic = "force-dynamic";

/**
 * What this office can test, and where the rest goes.
 *
 * The data-entry path, as the client set it out: pick the products you handle,
 * confirm the variants, then answer *fully capable / partly / not here* for
 * each one — and where you are not, say which office the sample goes to. One
 * person per office fills it in; `lab_incharge` is the role for it (D105).
 *
 * **Three steps in one route, moved with `?step=`**, which is why the buttons
 * are `StepNavButton`: a same-route navigation never renders `loading.tsx`, so
 * a plain push would leave the button looking untouched for the whole wait.
 *
 * Step 3 saves **per package** rather than in one final submit. An office with
 * forty products has two hundred packages to answer, and that is several
 * sittings — a form that only commits at the end would lose an afternoon to a
 * closed laptop.
 */
export default async function CoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; office?: string; product?: string }>;
}) {
  const viewer = await requireInternal("/labs/coverage");
  const sp = await searchParams;
  const actor = await actorFor(viewer);
  const labActor = { role: actor.role, employeeId: actor.employeeId, officeId: actor.officeId };

  const allowed = editableOffices(labActor);
  const offices = await officeOptions();

  // A superadmin has no office of their own, so they name one; everybody else
  // is pinned to theirs whatever the query string says.
  const requested = Number(sp.office);
  const officeId =
    allowed === null
      ? (Number.isInteger(requested) ? requested : offices[0]?.id ?? null)
      : (allowed[0] ?? null);

  if (officeId === null || !canEditCoverage(labActor, officeId)) {
    return (
      <>
        <ModuleNavbar
          moduleName="Laboratory" moduleSubtitle="BSTI e-Services"
          navItems={LABS_NAV} activeHref="/labs/coverage"
        />
        <PageContainer>
          <h1 className="font-display text-3xl font-medium">Office coverage</h1>
          <p className="max-w-2xl rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
            This form is filled in by each office for itself — its head, or its lab in-charge.
            You are not attached to an office that has one, so there is nothing here for you to
            complete. Ask a superadmin to grant <strong>Lab in-charge</strong> at{" "}
            <span className="font-mono text-xs">/hr/listing/roles</span>.
          </p>
        </PageContainer>
      </>
    );
  }

  const step = sp.step === "2" ? 2 : sp.step === "3" ? 3 : 1;
  if (allowed === null && !Number.isInteger(requested))
    redirect(`/labs/coverage?step=${step}&office=${officeId}`);

  const office = offices.find((o) => o.id === officeId)!;

  // Only what the step in front of the user needs. Step 3 is the expensive one
  // — every parameter of every package in scope — so steps 1 and 2 do not pay
  // for it.
  const [products, scope, packages, ownLabs, allLabs] = await Promise.all([
    productRows(),
    scopeFor(officeId),
    step === 3 ? coverageFor(officeId) : Promise.resolve([]),
    prisma.lab.findMany({
      where: { officeId, isActive: true },
      select: { id: true, nameEn: true, discipline: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.lab.findMany({
      where: { isActive: true },
      select: { officeId: true, discipline: true },
    }),
  ]);

  // Which offices can receive which kind of test. Cox's Bazar, Cumilla,
  // Faridpur and Mymensingh have a chemistry bench and no physical one, so
  // offering them for a physical test is offering a destination that will be
  // refused on save — the picker filters on this instead.
  const disciplinesByOffice: Record<number, string[]> = {};
  for (const l of allLabs) {
    (disciplinesByOffice[l.officeId] ??= []).push(l.discipline);
  }

  const scopedProductIds = [...new Set(scope.map((s) => s.product.id))];
  const inScope = new Set(scope.map((s) => s.id));

  // Step 2 lists the variants of everything picked in step 1, so it needs the
  // full set beneath those products rather than only the selected ones.
  const candidates = step === 2 && scopedProductIds.length
    ? await prisma.subProduct.findMany({
        where: { productId: { in: scopedProductIds }, foldedAt: null },
        orderBy: [{ productId: "asc" }, { ordinal: "asc" }],
        select: {
          id: true, nameEn: true,
          product: { select: { id: true, nameEn: true } },
          _count: { select: { parameters: true } },
        },
      })
    : [];

  return (
    <>
      <ModuleNavbar
        moduleName="Laboratory" moduleSubtitle="BSTI e-Services"
        navItems={LABS_NAV} activeHref="/labs/coverage"
      />
      <PageContainer>
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Office coverage
          </p>
          <h1 className="mt-1 font-display text-3xl font-medium">{office.nameEn}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            A test parameter belongs to no office — the catalogue is the same everywhere. What
            differs is which of them <strong>your</strong> laboratory can run, and where the rest
            are sent. Answer that here once and the sampling plan, the destination letters and
            the test fee all follow from it.
          </p>
        </header>

        <CoverageWizard
          step={step}
          officeId={officeId}
          officeName={office.nameEn}
          offices={offices.map((o) => ({
            id: o.id,
            nameEn: o.nameEn,
            labCount: o._count.labs,
            disciplines: [...new Set(disciplinesByOffice[o.id] ?? [])],
          }))}
          ownLabs={ownLabs}
          products={products.filter((p) => p.parameters > 0)}
          scopedProductIds={scopedProductIds}
          candidates={candidates}
          inScope={[...inScope]}
          packages={packages}
          canPickOffice={allowed === null}
        />
      </PageContainer>
    </>
  );
}
