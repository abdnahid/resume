import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Factory as FactoryIcon, MapPin } from "lucide-react";
import { requireClient } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { getApplication, gapsFor, attachableBds, membershipFor } from "@/lib/cm/applications";
import { CM_DOCUMENTS } from "@/lib/cm/policy";
import { isEditable, stageInfo } from "@/lib/cm/states";
import Footer from "@/components/layout/Footer";
import StageTracker from "./_components/StageTracker";
import BdsStep from "./_components/BdsStep";
import ProductStep from "./_components/ProductStep";
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

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
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

  const [gaps, bdsOptions] = await Promise.all([
    gapsFor(id),
    attachableBds(app.organizationId, viewer.id),
  ]);

  const editable = isEditable(app.state) && membership.role !== "viewer";
  const info = stageInfo(app.state);

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
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
                {app.organization.nameEn}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FactoryIcon className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
                {app.factory.nameEn}
              </span>
              <span className="inline-flex items-center gap-1.5 font-bn">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
                {app.factory.district}
              </span>
            </div>
          </div>
        </div>

        {/* Which office has it — named whether or not it has been sent, so the
            applicant knows where their file goes before they commit. */}
        <p className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {app.bstiOffice ? "Handled by" : "Will be handled by"}
          </span>{" "}
          <span className="font-bn font-medium text-foreground">
            {(app.bstiOffice ?? app.factory.bstiOffice)?.nameBn ?? "an office yet to be determined"}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            — decided by the factory&apos;s district
          </span>
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <ProductStep
              applicationId={app.id}
              productName={app.productName}
              brandName={app.brandName}
              productDetails={app.productDetails}
              editable={editable}
            />

            <BdsStep
              applicationId={app.id}
              options={bdsOptions}
              attachedPurchaseId={app.bdsPurchaseId}
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

            {editable && (
              <SubmitStep
                applicationId={app.id}
                gaps={gaps ?? []}
                feeStatus={app.applicationFeePayment?.status ?? null}
                feeReference={app.applicationFeePayment?.reference ?? null}
              />
            )}
          </div>

          <aside className="space-y-6">
            <StageTracker state={app.state} />

            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-semibold text-foreground">History</h2>
              <ul className="mt-4 space-y-3">
                {app.events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="font-medium text-foreground">
                      {e.kind.replace(/_/g, " ")}
                    </p>
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
