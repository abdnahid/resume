import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Factory as FactoryIcon } from "lucide-react";
import { requireClient } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { getApplication, gapsFor, requirementsFor, membershipFor } from "@/lib/cm/applications";
import { sizeVocabulary } from "@/lib/cm/skus";
import { choicesFor } from "@/lib/cm/sub-products";
import { prefillableAnswers } from "@/lib/cm/practice";
import { CM_DOCUMENTS, FORM_STEPS, stepProgress, type FormStep } from "@/lib/cm/policy";
import { missingForSubmission as companyGaps } from "@/lib/client/organization";
import { canEditAnyDocument, canEditTarget, stageInfo } from "@/lib/cm/states";
import { editScopeFor, openRound } from "@/lib/cm/shortfall";
import { allShortfallTargets, shortfallLabel } from "@/lib/cm/policy";
import ShortfallNotice from "./_components/ShortfallNotice";
import ArtworkFix from "./_components/ArtworkFix";
import { artworkSkuIdOf } from "@/lib/cm/policy";
import Footer from "@/components/layout/Footer";
import StageTracker from "./_components/StageTracker";
import FormProgress, { StepGaps, StepNav } from "./_components/FormProgress";
import CompanyStep from "./_components/CompanyStep";
import BdsStep from "./_components/BdsStep";
import SkuStep from "./_components/SkuStep";
import ProductStep from "./_components/ProductStep";
import SubProductStep from "./_components/SubProductStep";
import ProductionStep from "./_components/ProductionStep";
import DocumentsStep from "./_components/DocumentsStep";
import Step4 from "./_components/Step4";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return { title: "Application — BSTI e-Services" };
  const app = await prisma.application.findUnique({
    where: { id },
    select: { applicationNo: true },
  });
  return { title: `${app?.applicationNo ?? "Draft application"} — BSTI e-Services` };
}

/**
 * `Plot 4, Tejgaon I/A · Dhaka · 1208` — the parts that are set, in order, with
 * the ones that are not silently dropped rather than leaving stray separators.
 */
function addressOf(x: {
  addressLine?: string | null;
  upazila?: string | null;
  district?: string | null;
  postCode?: string | null;
}): string {
  return [x.addressLine, x.upazila, x.district, x.postCode]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" · ");
}

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const viewer = await requireClient(`/public/applications/${id}`);

  // Membership is the access check, as on the company pages — a wrong id is a
  // 404 rather than a 403, so someone else's application is not confirmed to
  // exist.
  const membership = await membershipFor(viewer.id, id);
  if (!membership) notFound();

  const app = await getApplication(id);
  if (!app) notFound();

  const [gaps, requirements, sizeTypes, prefill, organization, subProductChoices] =
    await Promise.all([
      gapsFor(id),
      requirementsFor(id, viewer.id),
      sizeVocabulary(),
      prefillableAnswers(id),
      prisma.organization.findUnique({
        where: { id: app.organization.id },
        include: { factories: { select: { id: true } } },
      }),
      // Empty until a product is chosen, and empty for the products whose test
      // parameters BSTI has not published yet — the step says so rather than
      // showing a picker with nothing in it.
      app.productId ? choicesFor(app.productId) : Promise.resolve([]),
    ]);

  /**
   * What is open to edit, point by point.
   *
   * Before submission everything is; while a correction round is open only the
   * points BSTI marked are (D81); otherwise nothing. `editScopeFor()` is the
   * same call the write routes make, so what is greyed out here and what is
   * refused there cannot disagree.
   */
  const [rawScope, round] = await Promise.all([editScopeFor(app.id), openRound(app.id)]);
  const scope = membership.role === "viewer" ? ({ kind: "none" } as const) : rawScope;
  const can = (target: string) => canEditTarget(scope, target);

  /**
   * The variants whose artwork BSTI asked to be replaced, with the officer's
   * comment beside each. Resolved here because only the page holds the SKUs.
   */
  const artworkFixes = (round?.items ?? []).flatMap((i) => {
    const skuId = artworkSkuIdOf(i.target);
    if (skuId === null || !can(i.target)) return [];
    const sku = app.subProducts.flatMap((sp) => sp.skus).find((k) => k.id === skuId);
    if (!sku) return [];
    return [{
      skuId,
      comment: i.comment,
      currentName: sku.labelImageName,
      label: [
        sku.brandName,
        sku.variant,
        sku.sizeValue !== null ? `${sku.sizeValue} ${sku.sizeUnit.code}` : sku.sizeUnit.code,
        sku.packaging,
        sku.grade,
      ].filter(Boolean).join(" · "),
    }];
  });
  /** True while the whole form is open — before submission. */
  const editable = scope.kind === "all";
  const info = stageInfo(app.state);

  const raw = Number((await searchParams).step);
  const step = (FORM_STEPS.some((s) => s.step === raw) ? raw : 1) as FormStep;
  const progress = stepProgress(gaps ?? []);
  const stepGaps = (gaps ?? []).filter((g) => g.step === step);


  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-14 lg:px-10">
        <Link
          href="/public/applications"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          My applications
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              CM Quality Licence
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-medium text-foreground">
              {app.applicationNo ?? "Draft application"}
            </h1>
            {app.product && (
              <p className="mt-1 text-sm text-muted-foreground">
                {app.product.nameEn}
                <span className="ml-2 font-mono text-xs">
                  {app.product.standards.map((s) => s.asPrinted ?? s.bds.number).join(" · ")}
                </span>
              </p>
            )}
            {/*
              Name and address for both, because a group with several companies
              and several plants cannot tell one file from another by name
              alone — and the factory's address is what decided which BSTI
              office receives it.
            */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
                <span>
                  <span className="block text-foreground">{app.organization.nameEn}</span>
                  {addressOf(app.organization) && (
                    <span className="block text-xs">{addressOf(app.organization)}</span>
                  )}
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <FactoryIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
                <span>
                  <span className="block text-foreground">{app.factory.nameEn}</span>
                  {addressOf(app.factory) && (
                    <span className="block text-xs">{addressOf(app.factory)}</span>
                  )}
                  {app.factory.bstiOffice && (
                    <span className="block text-xs">
                      Received by {app.factory.bstiOffice.nameEn}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {/* Above the form, not beside it: the marked points are the only
                thing that can be edited, so they are the page (D81). There is
                no notification channel yet — no mail, no SMS — so this panel is
                the notice. */}
            {/* Artwork is marked per variant (D53), and replacing one is a
                narrower permission than editing the article — so it gets its
                own control rather than reopening the variant editor. */}
            {artworkFixes.length > 0 && (
              <section className="space-y-2 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
                <h2 className="font-display text-lg font-medium text-foreground">
                  Packaging artwork to replace
                </h2>
                {artworkFixes.map((a) => (
                  <ArtworkFix
                    key={a.skuId}
                    applicationId={app.id}
                    skuId={a.skuId}
                    label={a.label}
                    comment={a.comment}
                    currentName={a.currentName}
                  />
                ))}
              </section>
            )}

            {round && (
              <ShortfallNotice
                applicationId={app.id}
                roundNo={round.roundNo}
                raisedAt={round.raisedAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                raisedBy={round.raisedBy.nameEn}
                note={round.note}
                items={round.items.map((i) => {
                  // Artwork points name a jar, so say which one.
                  const art = artworkFixes.find((a) => `artwork:${a.skuId}` === i.target);
                  return {
                    id: i.id,
                    label: art ? `Packaging artwork — ${art.label}` : shortfallLabel(i.target),
                    comment: i.comment,
                    step: allShortfallTargets().find((t) => t.target === i.target)?.step ?? 2,
                  };
                })}
                canRespond={membership.role !== "viewer"}
              />
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Step {step} of {FORM_STEPS.length}
              </p>
              <h2 className="mt-1 font-display text-xl font-medium text-foreground">
                {FORM_STEPS[step - 1].titleEn}
              </h2>
            </div>

            {step === 1 && (
              <CompanyStep
                organization={{
                  id: organization!.id,
                  nameEn: organization!.nameEn,
                  nameBn: organization!.nameBn,
                  legalForm: organization!.legalForm,
                  tradeLicenceNo: organization!.tradeLicenceNo,
                  tradeLicenceExpiry: organization!.tradeLicenceExpiry,
                  binNo: organization!.binNo,
                  tinNo: organization!.tinNo,
                  addressLine: organization!.addressLine,
                  district: organization!.district,
                  repName: organization!.repName,
                  repDesignation: organization!.repDesignation,
                  repMobile: organization!.repMobile,
                  repEmail: organization!.repEmail,
                }}
                factory={{
                  nameEn: app.factory.nameEn,
                  nameBn: app.factory.nameBn,
                  addressLine: app.factory.addressLine,
                  district: app.factory.district,
                  contactName: app.factory.contactName,
                  contactMobile: app.factory.contactMobile,
                }}
                office={app.bstiOffice ?? app.factory.bstiOffice}
                incomplete={companyGaps(organization!).length > 0}
              />
            )}

            {step === 2 && (
              <>
                <ProductStep
                  applicationId={app.id}
                  chosen={
                    app.product
                      ? {
                          id: app.product.id,
                          serial: app.product.serial,
                          nameEn: app.product.nameEn,
                          nameBn: app.product.nameBn,
                          genericNames: app.product.genericNames,
                          category: {
                            letter: app.product.category.letter,
                            nameEn: app.product.category.nameEn,
                            nameBn: app.product.category.nameBn,
                          },
                          standards: app.product.standards.map((s) => ({
                            id: s.bds.id,
                            number: s.bds.number,
                            titleEn: s.bds.titleEn,
                            asPrinted: s.asPrinted,
                          })),
                        }
                      : null
                  }
                  editable={can("product")}
                />

                {/*
                  The sub-products follow from the product, and the variants
                  follow from the sub-products — so the three sit in that order
                  (D67). Choosing here is what makes the test fee quotable.
                */}
                <SubProductStep
                  applicationId={app.id}
                  productName={app.product?.nameEn ?? null}
                  choices={subProductChoices}
                  chosen={app.subProducts.map((sp) => ({
                    id: sp.id,
                    subProductId: sp.subProductId,
                    nameEn: sp.subProduct.nameEn,
                    variantCount: sp.skus.length,
                    declaredByFdo: sp.declaredBy === "fdo",
                  }))}
                  editable={can("sub_products")}
                />

                <SkuStep
                  applicationId={app.id}
                  productName={app.product?.nameEn ?? null}
                  subProducts={app.subProducts.map((sp) => ({
                    id: sp.id,
                    nameEn: sp.subProduct.nameEn,
                    nameBn: sp.subProduct.nameBn,
                  }))}
                  skus={app.subProducts.flatMap((sp) => sp.skus).map((s) => ({
                    id: s.id,
                    applicationSubProductId: s.applicationSubProductId,
                    brandName: s.brandName,
                    variant: s.variant,
                    sizeValue: s.sizeValue === null ? null : String(s.sizeValue),
                    packaging: s.packaging,
                    unitsPerPack: s.unitsPerPack,
                    grade: s.grade,
                    labelImageName: s.labelImageName,
                    labelImageSizeBytes: s.labelImageSizeBytes,
                    sizeType: {
                      id: s.sizeType.id,
                      nameEn: s.sizeType.nameEn,
                      kind: s.sizeType.kind as string,
                    },
                    sizeUnit: { id: s.sizeUnit.id, code: s.sizeUnit.code },
                  }))}
                  sizeTypes={sizeTypes.map((t) => ({
                    id: t.id,
                    slug: t.slug,
                    nameEn: t.nameEn,
                    nameBn: t.nameBn,
                    kind: t.kind as string,
                    hintEn: t.hintEn,
                    units: t.units.map((u) => ({ id: u.id, code: u.code, nameEn: u.nameEn })),
                  }))}
                  editable={can("skus")}
                />

                <BdsStep
                  applicationId={app.id}
                  productName={app.product?.nameEn ?? null}
                  requirements={requirements}
                  returnStep={step}
                  // The standards follow from the product, so reopening the
                  // product is what reopens which standards must be attached.
                  editable={can("product")}
                />

                <DocumentsStep
                  applicationId={app.id}
                  requirements={CM_DOCUMENTS}
                  held={app.documents.map((d) => ({
                    kind: d.kind,
                    fileName: d.fileName,
                    sizeBytes: d.sizeBytes,
                  }))}
                  // Papers are marked one at a time, so the step opens when any
                  // one of them is and the route decides which.
                  editable={canEditAnyDocument(scope)}
                />
              </>
            )}

            {step === 3 && (
              <ProductionStep
                applicationId={app.id}
                existing={
                  app.production
                    ? {
                        authority: app.production.authority as string,
                        registrationNo: app.production.registrationNo,
                        annualCapacityValue: String(app.production.annualCapacityValue),
                        capacityUnitId: app.production.capacityUnitId,
                        currentYearLabel: app.production.currentYearLabel,
                        currentYearProduction: String(app.production.currentYearProduction),
                      }
                    : null
                }
                sizeTypes={sizeTypes.map((t) => ({
                  id: t.id,
                  nameEn: t.nameEn,
                  kind: t.kind as string,
                  units: t.units.map((u) => ({ id: u.id, code: u.code, nameEn: u.nameEn })),
                }))}
                editable={can("production")}
              />
            )}

            {step === 4 && (
              <Step4
                applicationId={app.id}
                answers={app.answers.map((a) => ({
                  questionKey: a.questionKey,
                  answerText: a.answerText,
                  answerNumber: a.answerNumber,
                }))}
                consentAcceptedAt={app.consentAcceptedAt?.toISOString() ?? null}
                prefill={prefill}
                gaps={gaps ?? []}
                feeStatus={app.applicationFeePayment?.status ?? null}
                feeReference={app.applicationFeePayment?.reference ?? null}
                editable={can("answers")}
              />
            )}

            {editable && stepGaps.length > 0 && step !== 4 && <StepGaps gaps={stepGaps} />}


            <StepNav applicationId={app.id} current={step} last={FORM_STEPS.length} />
          </div>

          <aside className="space-y-6">
            {/* While the form is being filled the useful question is what is
                still missing; once it is submitted it becomes who holds the
                file. So the two trackers swap over at submission. */}
            {editable ? (
              <FormProgress applicationId={app.id} steps={progress} current={step} />
            ) : (
              <StageTracker
                state={app.state}
                holder={
                  app.holder
                    ? { name: app.holder.nameEn, designation: app.holder.designationEn }
                    : null
                }
              />
            )}

            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-semibold text-foreground">History</h2>
              <ul className="mt-4 space-y-3">
                {app.events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="font-medium text-foreground">{e.kind.replace(/_/g, " ")}</p>
                    {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
                    <p className="text-xs text-muted-foreground">
                      {e.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            {!editable && !round && info.holder !== "closed" && (
              <p className="rounded-xl bg-muted/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                This application has been submitted and can no longer be edited. If BSTI needs
                anything more, you will be asked for it here.
              </p>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
