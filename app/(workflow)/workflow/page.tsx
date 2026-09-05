import ModuleNavbar from "@/components/layout/ModuleNavbar";
import { requireInternal } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { actorFor, inboxScope, unclaimed, inProgress, heldBy, candidates } from "@/lib/workflow/inbox";
import { stageInfo } from "@/lib/cm/states";
import FileBoard from "./_components/FileBoard";

export const dynamic = "force-dynamic";

const navItems = [{ label: "Files", href: "/workflow" }];

/**
 * The internal desk for licence applications.
 *
 * A board, not three fixed lists. What a person can see still depends on what
 * they are rather than on a menu — an office head sees their office's unclaimed
 * files, anyone holding a file sees it, a superadmin sees everything — but the
 * counts are tiles and the tiles are the filter, so "what is sitting at the
 * test fee" is a click rather than a read of every row.
 *
 * The rows are shaped here and filtered in the browser: an office holds tens of
 * files, and a round trip per tile would make the board feel slower than the
 * page it replaced.
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

  // One shape for the board, so it can filter across all three lists at once.
  const stamp = (d: Date | null) =>
    d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
  const toRow = (a: (typeof mine)[number], bucket: "mine" | "unclaimed" | "working") => ({
    id: a.id,
    applicationNo: a.applicationNo,
    state: a.state as string,
    stateLabel: stageInfo(a.state).label,
    submittedAt: stamp(a.submittedAt),
    organizationName: a.organization.nameEn,
    factoryName: a.factory.nameEn,
    district: a.factory.district,
    productSerial: a.product?.serial ?? null,
    productName: a.product?.nameEn ?? null,
    subProductCount: a._count.subProducts,
    holderName: a.holder?.nameEn ?? null,
    holderDesignation: a.holder?.designationEn ?? null,
    bucket,
  });

  // A file held by the viewer appears once, under "with you", not twice.
  const mineIds = new Set(mine.map((a) => a.id));
  const rows = [
    ...mine.map((a) => toRow(a, "mine")),
    ...waiting.filter((a) => !mineIds.has(a.id)).map((a) => toRow(a, "unclaimed")),
    ...working.filter((a) => !mineIds.has(a.id)).map((a) => toRow(a, "working")),
  ];

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

        {rows.length === 0 ? (
          <p className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-6 text-sm leading-relaxed text-muted-foreground">
            {scope
              ? "No files have reached this office yet."
              : "Nothing is waiting for you. Applications are received by the office head, who passes them down for processing — you will see a file here once one reaches your desk."}
          </p>
        ) : (
          <FileBoard rows={rows} down={down} up={up} canReceive={!!scope} />
        )}
      </main>
    </>
  );

}
