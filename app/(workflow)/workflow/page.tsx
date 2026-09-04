import { Inbox, FileText, MapPin, Building2, ArrowRight } from "lucide-react";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import { requireInternal } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { actorFor, inboxScope, unclaimed, inProgress, heldBy, candidates } from "@/lib/workflow/inbox";
import { ReceiveButton, PassPanel } from "./_components/FileActions";

export const dynamic = "force-dynamic";

const navItems = [{ label: "Files", href: "/workflow" }];

/**
 * The internal desk for licence applications.
 *
 * Three lists, and which of them a person sees depends on what they are rather
 * than on a menu: an office head sees their office's unclaimed files, anyone
 * holding a file sees it, and a superadmin sees everything.
 *
 * The previous page here advertised Projects, My Tasks, Team and Reports, none
 * of which existed — the dead links CLAUDE.md says not to ship.
 */
export default async function WorkflowPage() {
  const viewer = await requireInternal("/workflow");
  const actor = await actorFor(viewer);
  const scope = await inboxScope(actor);

  const [waiting, working, mine, office] = await Promise.all([
    scope ? unclaimed(scope.officeId) : Promise.resolve([]),
    scope ? inProgress(scope.officeId) : Promise.resolve([]),
    actor.employeeId ? heldBy(actor.employeeId) : Promise.resolve([]),
    actor.officeId
      ? prisma.office.findUnique({
          where: { id: actor.officeId },
          select: { nameEn: true, nameBn: true },
        })
      : Promise.resolve(null),
  ]);

  // The desks this person may hand a file to. One lookup for the whole page —
  // every file they hold is in the same office, so the chain is the same.
  const [down, up] =
    actor.employeeId && actor.officeId && mine.length > 0
      ? await Promise.all([
          candidates(actor.employeeId, actor.officeId, "down"),
          candidates(actor.employeeId, actor.officeId, "up"),
        ])
      : [[], []];

  return (
    <>
      <ModuleNavbar moduleName="Workflow" moduleSubtitle="BSTI e-Services" navItems={navItems} />
      <main className="mx-auto w-full max-w-[1440px] px-5 py-12 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Licence applications
        </p>
        <h1 className="mt-2 font-display text-3xl font-medium text-foreground">
          {scope?.pinned && office ? (
            <>
              <span className="font-bn">{office.nameBn ?? office.nameEn}</span>
              <span className="ml-2 text-lg text-muted-foreground">files</span>
            </>
          ) : scope ? (
            "Every office's files"
          ) : (
            "Your files"
          )}
        </h1>

        {!scope && mine.length === 0 && (
          <p className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-6 text-sm leading-relaxed text-muted-foreground">
            Nothing is waiting for you. Applications are received by the office head, who passes
            them down for processing — you will see a file here once one reaches your desk.
          </p>
        )}

        {mine.length > 0 && (
          <Section
            title="With you"
            blurb="You are holding these. Pass one down for processing, or send it back up when your part is done."
          >
            {mine.map((a) => (
              <Row key={a.id} app={a}>
                <PassPanel applicationId={a.id} down={down} up={up} />
              </Row>
            ))}
          </Section>
        )}

        {scope && (
          <Section
            title="Waiting to be received"
            blurb="Submitted and not yet picked up by anyone in the office."
          >
            {waiting.length === 0 ? (
              <Empty>No files are waiting.</Empty>
            ) : (
              waiting.map((a) => (
                <Row key={a.id} app={a}>
                  <ReceiveButton applicationId={a.id} />
                </Row>
              ))
            )}
          </Section>
        )}

        {scope && (
          <Section title="Being processed" blurb="Files somebody in the office is holding.">
            {working.length === 0 ? (
              <Empty>Nothing is in progress.</Empty>
            ) : (
              working.map((a) => (
                <Row key={a.id} app={a}>
                  <p className="text-right text-sm">
                    <span className="text-muted-foreground">with</span>{" "}
                    <span className="font-medium text-foreground">{a.holder?.nameEn}</span>
                    {a.holder?.designationEn && (
                      <span className="block text-xs text-muted-foreground">
                        {a.holder.designationEn}
                      </span>
                    )}
                  </p>
                </Row>
              ))
            )}
          </Section>
        )}
      </main>
    </>
  );
}

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

type Row = {
  id: number;
  applicationNo: string | null;
  submittedAt: Date | null;
  organization: { nameEn: string };
  factory: { nameEn: string; district: string };
  product: { serial: number; nameEn: string } | null;
  bstiOffice: { nameEn: string; nameBn: string | null } | null;
  _count: { subProducts: number };
};

function Row({ app, children }: { app: Row; children: React.ReactNode }) {
  return (
    <article className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <FileText className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
          <span className="font-mono text-sm font-medium text-foreground">
            {app.applicationNo ?? `Draft #${app.id}`}
          </span>
          {app.submittedAt && (
            <span className="text-xs text-muted-foreground">
              submitted{" "}
              {app.submittedAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </p>

        {app.product && (
          <p className="mt-1.5 text-sm text-foreground">
            {app.product.nameEn}
            <span className="ml-2 text-xs text-muted-foreground">
              #{app.product.serial} · {app._count.subProducts} sub-product
              {app._count.subProducts === 1 ? "" : "s"}
            </span>
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="h-3 w-3 text-primary" strokeWidth={1.8} />
            {app.organization.nameEn}
          </span>
          <span className="inline-flex items-center gap-1.5 font-bn">
            <MapPin className="h-3 w-3 shrink-0 text-primary" strokeWidth={1.8} />
            {app.factory.nameEn} · {app.factory.district}
          </span>
          {app.bstiOffice && (
            <span className="inline-flex items-center gap-1.5 font-bn">
              <ArrowRight className="h-3 w-3 shrink-0 text-primary" strokeWidth={1.8} />
              {app.bstiOffice.nameBn ?? app.bstiOffice.nameEn}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0">{children}</div>
    </article>
  );
}
