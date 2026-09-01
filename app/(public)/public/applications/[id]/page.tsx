import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Factory as FactoryIcon } from "lucide-react";
import { requireClient } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { getApplication, gapsFor, requirementsFor, membershipFor } from "@/lib/cm/applications";
import { sizeVocabulary } from "@/lib/cm/skus";
import { prefillableAnswers } from "@/lib/cm/practice";
import { CM_DOCUMENTS, FORM_STEPS, stepProgress, type FormStep } from "@/lib/cm/policy";
import { missingForSubmission as companyGaps } from "@/lib/client/organization";
import { isEditable, stageInfo } from "@/lib/cm/states";
import Footer from "@/components/layout/Footer";
import StageTracker from "./_components/StageTracker";
import FormProgress, { StepGaps, StepNav } from "./_components/FormProgress";
import CompanyStep from "./_components/CompanyStep";
import BdsStep from "./_components/BdsStep";
import SkuStep from "./_components/SkuStep";
import ProductStep from "./_components/ProductStep";
import ProductionStep from "./_components/ProductionStep";
import PracticeStep from "./_components/PracticeStep";
import DocumentsStep from "./_components/DocumentsStep";
import SubmitStep from "./_components/SubmitStep";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return { title: "Application — BSTI e-Services" };
  const app = await prisma.application.findUnique({
    where: { id },
    select: { applicationNo: true },
  });
  return { title: `${app?.applicationNo ?? "Draft application"} — BSTI e-Services` };
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

  const [gaps, requirements, sizeTypes, prefill, organization] = await Promise.all([
    gapsFor(id),
    requirementsFor(id, viewer.id),
    sizeVocabulary(),
    prefillableAnswers(id),
    prisma.organization.findUnique({
      where: { id: app.organization.id },
      include: { factories: { select: { id: true } } },
    }),
  ]);

  const editable = isEditable(app.state) && membership.role !== "viewer";
  const info = stageInfo(app.state);

  const raw = Number((await searchParams).step);
  const step = (FORM_STEPS.some((s) => s.step === raw) ? raw : 1) as FormStep;
  const progress = stepProgress(gaps ?? []);
  const stepGaps = (gaps ?? []).filter((g) => g.step === step);

  // Required questions still unanswered — the declaration waits on these.
  const answerGaps = (gaps ?? []).filter((g) => g.field.startsWith("q:")).length;

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
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
                {app.organization.nameEn}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FactoryIcon className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
                {app.factory.nameEn}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
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
                  editable={editable}
                />

                <SkuStep
                  applicationId={app.id}
                  productName={app.product?.nameEn ?? null}
                  skus={app.skus.map((s) => ({
                    id: s.id,
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
                  editable={editable}
                />

                <BdsStep
                  applicationId={app.id}
                  productName={app.product?.nameEn ?? null}
                  requirements={requirements}
                  editable={editable}
                />

                <DocumentsStep
                  applicationId={app.id}
                  requirements={CM_DOCUMENTS}
                  held={app.documents.map((d) => ({
                    kind: d.kind,
                    fileName: d.fileName,
                    sizeBytes: d.sizeBytes,
                  }))}
                  editable={editable}
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
                editable={editable}
              />
            )}

            {step === 4 && (
              <>
                <PracticeStep
                  applicationId={app.id}
                  answers={app.answers.map((a) => ({
                    questionKey: a.questionKey,
                    answerText: a.answerText,
                    answerNumber: a.answerNumber,
                  }))}
                  consentAcceptedAt={app.consentAcceptedAt?.toISOString() ?? null}
                  prefill={prefill}
                  editable={editable}
                  outstanding={answerGaps}
                />

                {editable && (
                  <SubmitStep
                    applicationId={app.id}
                    gaps={gaps ?? []}
                    feeStatus={app.applicationFeePayment?.status ?? null}
                    feeReference={app.applicationFeePayment?.reference ?? null}
                  />
                )}
              </>
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
              <StageTracker state={app.state} />
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

            {!editable && info.holder !== "closed" && (
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
