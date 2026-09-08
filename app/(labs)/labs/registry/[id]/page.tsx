import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import PageContainer from "@/components/PageContainer";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor } from "@/lib/workflow/inbox";
import { canEditCapability } from "@/lib/labs/access";
import { labDetail } from "@/lib/labs/mapping";
import { productRows } from "@/lib/labs/catalogue";
import { prisma } from "@/lib/prisma";
import { LABS_NAV } from "../../_components/nav";
import CapabilityEditor from "./CapabilityEditor";

export const dynamic = "force-dynamic";

/**
 * One laboratory: what it can run, and what it has been sent.
 *
 * `LabCapability` is **sparse ground truth** (D64) — the list of tests this
 * bench can actually perform, maintained by this laboratory's own office
 * because nobody else can find out. An instrument out of service or an
 * unfilled post is not a fact head office discovers.
 *
 * Withdrawing a capability deliberately does **not** rewrite the offices
 * routing here. Their rows stay as they left them and start failing the check
 * in `resolveDestinations()`, which surfaces by name on the sampling screen.
 */
export default async function LabPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ product?: string; subProduct?: string }>;
}) {
  const viewer = await requireInternal("/labs/registry");
  const { id } = await params;
  const labId = Number(id);
  if (!Number.isInteger(labId)) notFound();

  const [detail, actor, products] = await Promise.all([
    labDetail(labId),
    actorFor(viewer),
    productRows(),
  ]);
  if (!detail) notFound();
  const { lab, packages, declared } = detail;

  const canEdit = canEditCapability(
    { role: actor.role, employeeId: actor.employeeId, officeId: actor.officeId },
    lab.office.id,
  );

  const sp = await searchParams;
  const subProductId = Number(sp.subProduct);
  const chosen = Number.isInteger(subProductId)
    ? await prisma.subProduct.findUnique({
        where: { id: subProductId },
        select: {
          id: true, nameEn: true,
          product: { select: { id: true, nameEn: true } },
          parameters: {
            orderBy: [{ ordinal: "asc" }, { id: "asc" }],
            select: {
              id: true, nameEn: true, discipline: true, sourceSection: true,
              capabilities: { where: { labId }, select: { isActive: true, isPlaceholder: true } },
            },
          },
        },
      })
    : null;

  const productId = chosen?.product.id ?? Number(sp.product);
  const siblings = Number.isInteger(productId)
    ? await prisma.subProduct.findMany({
        where: { productId, foldedAt: null },
        orderBy: [{ ordinal: "asc" }, { id: "asc" }],
        select: { id: true, nameEn: true, _count: { select: { parameters: true } } },
      })
    : [];

  // One package means nothing to choose, and a single-option select fires no
  // change event — see the note in the mapping page.
  if (!chosen && siblings.length === 1)
    redirect(`/labs/registry/${labId}?subProduct=${siblings[0].id}`);

  return (
    <>
      <ModuleNavbar
        moduleName="Laboratory"
        moduleSubtitle="BSTI e-Services"
        navItems={LABS_NAV}
        activeHref="/labs/registry"
      />
      <PageContainer>
        <Link
          href="/labs/registry"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" /> All laboratories
        </Link>

        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {lab.office.nameEn}
          </p>
          <h1 className="mt-1 flex items-center gap-3 font-display text-3xl font-medium">
            {lab.nameEn}
            {!lab.isActive && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-normal text-secondary-foreground">
                Closed
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {lab.discipline} discipline · {declared.toLocaleString("en-BD")} tests declared
            {lab._count.capabilities > declared && (
              <> (plus {(lab._count.capabilities - declared).toLocaleString("en-BD")} seeded stand-ins)</>
            )}{" "}
            · {lab._count.routings.toLocaleString("en-BD")} routing cells point here
            {lab.orgUnit && <> · organogram unit {lab.orgUnit.nameEn}</>}
          </p>
        </header>

        <CapabilityEditor
          labId={lab.id}
          labName={lab.nameEn}
          canEdit={canEdit}
          products={products.filter((p) => p.parameters > 0)}
          siblings={siblings}
          currentProductId={Number.isInteger(productId) ? productId : null}
          subProduct={
            chosen
              ? {
                  id: chosen.id,
                  nameEn: chosen.nameEn,
                  productName: chosen.product.nameEn,
                  parameters: chosen.parameters.map((p) => ({
                    id: p.id, nameEn: p.nameEn, discipline: p.discipline,
                    sourceSection: p.sourceSection,
                    // Only this laboratory's own answer counts as held. A seeded
                    // stand-in is what the box is there to replace, so showing
                    // it as already ticked would hide the entire job.
                    held: p.capabilities.some((c) => c.isActive && !c.isPlaceholder),
                    seeded: p.capabilities.some((c) => c.isActive && c.isPlaceholder),
                  })),
                }
              : null
          }
        />

        {declared === 0 && lab._count.capabilities > 0 && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <strong>Everything against this laboratory is a seeded stand-in.</strong> A test
            parameter belongs to no office — the catalogue is the same everywhere — and these
            rows exist only so the sampling flow resolved before anybody had answered. They are
            not this laboratory saying what it can run. Ticking a package below replaces them.
          </p>
        )}

        <section className="rounded-2xl border border-border bg-card">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
            What this laboratory has declared
          </h2>
          {packages.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nothing yet, so no office can send it a sample. Choose a package above and tick the
              tests this bench can run.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2 font-medium">Product</th>
                  <th className="px-5 py-2 font-medium">Sub-product</th>
                  <th className="px-5 py-2 text-right font-medium">Declared</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((p) => (
                  <tr key={p.subProductId} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2 text-muted-foreground">{p.product}</td>
                    <td className="px-5 py-2">
                      <Link
                        href={`/labs/registry/${lab.id}?subProduct=${p.subProductId}`}
                        className="hover:text-primary hover:underline"
                      >
                        {p.subProduct}
                      </Link>
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums">
                      {p.held} of {p.total}
                      {p.held < p.total && (
                        <span className="ml-2 text-xs text-muted-foreground">partial</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </PageContainer>
    </>
  );
}
