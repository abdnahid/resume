import ModuleNavbar from "@/components/layout/ModuleNavbar";
import { requireInternal } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  actorFor, inboxScope, unclaimed, inProgress, heldBy, touchedBy, flowsFor, candidates, deskOf,
} from "@/lib/workflow/inbox";
import { roundsForMany } from "@/lib/cm/shortfall";
import { plansForMany } from "@/lib/cm/inspection";
import { stageInfo } from "@/lib/cm/states";
import FileBoard, { type FlowStep } from "./_components/FileBoard";

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
 * **A file you have handled stays visible after you pass it on.** It used to
 * vanish, which is right for "what is on my desk" and wrong for everything
 * else: the officer who wrote the inspection report is the one the applicant
 * telephones, and he could not answer. Standing comes from the movement log, so
 * it is a fact about the file rather than a permission — and it carries no
 * power, because the actions still key off holding it.
 *
 * The rows are shaped here and filtered in the browser: an office holds tens of
 * files, and a round trip per tile would make the board feel slower than the
 * page it replaced.
 */
export default async function WorkflowPage() {
  const viewer = await requireInternal("/workflow");
  const actor = await actorFor(viewer);
  const scope = await inboxScope(actor);

  const [waiting, working, mine, handled, office] = await Promise.all([
    scope ? unclaimed(scope.officeId) : Promise.resolve([]),
    scope ? inProgress(scope.officeId) : Promise.resolve([]),
    actor.employeeId ? heldBy(actor.employeeId) : Promise.resolve([]),
    actor.employeeId ? touchedBy(actor.employeeId) : Promise.resolve([]),
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

  // **Why the lists are empty is two different facts.** `candidates()` returns
  // nothing both when the chain genuinely ends with you and when you hold no
  // organogram post at all — and the second is an administrative fault someone
  // has to fix, not a fact about the file. 251 of 731 employees hold no desk,
  // and an office head among them receives files and can pass them to nobody
  // (the D76 shape, arrived at by a missing seat rather than a retirement).
  // Faridpur's head sat exactly there on 2026-09-10 while the button's tooltip
  // said "no more junior desk in this section", which was true of nothing.
  const holderDesk =
    actor.employeeId && mine.length > 0 ? await deskOf(actor.employeeId) : null;
  const hasDesk = holderDesk?.sectionUnitId != null;

  // A file appears once. "With you" wins over every other reading of it, and a
  // file already listed as this office's is not repeated as one you handled —
  // an office head would otherwise see every file in the building twice.
  const seen = new Set<number>();
  const once = <T extends { id: number }>(list: T[]) =>
    list.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));

  const bucketed = [
    ...once(mine).map((a) => [a, "mine"] as const),
    ...once(waiting).map((a) => [a, "unclaimed"] as const),
    ...once(working).map((a) => [a, "working"] as const),
    ...once(handled).map((a) => [a, "handled"] as const),
  ];

  // Fetched before the rows are shaped, because the office order goes on the
  // row itself and `toRow` reads it.
  const ids = bucketed.map(([a]) => a.id);
  const [movements, rounds, plans] = await Promise.all([
    flowsFor(ids),
    roundsForMany(ids),
    plansForMany(ids),
  ]);
  const planOf = new Map(plans.map((p) => [p.applicationId, p]));
  const day = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  // One shape for the board, so it can filter across all three lists at once.
  const stamp = (d: Date | null) =>
    d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
  const toRow = (
    a: (typeof mine)[number],
    bucket: "mine" | "unclaimed" | "working" | "handled",
  ) => ({
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
    // While a round is open the file is with the applicant even though the
    // officer keeps the desk (D81), so the board must not say "with <officer>".
    withApplicant: stageInfo(a.state).holder === "applicant",
    // The office order is the visit's authority, so it belongs on the row
    // rather than one click inside the file (D82).
    orderNo: planOf.get(a.id)?.orderNo ?? null,
    // The button says what is actually waiting, so the holder does not have to
    // learn which page plans an inspection.
    processLabel: (() => {
      const p = planOf.get(a.id);
      if (p?.approvedAt) return "Office order";
      if (p) return "Inspection plan";
      if (a.state === "review_passed") return "Plan inspection";
      if (a.state === "shortfall_issued") return "Awaiting corrections";
      return "Review";
    })(),
    inspectionOn: (() => {
      const p = planOf.get(a.id);
      return p ? day(p.scheduledOn) : null;
    })(),
    holderName: a.holder?.nameEn ?? null,
    holderDesignation: a.holder?.designationEn ?? a.holder?.designationBn ?? null,
    bucket,
  });

  const rows = bucketed.map(([a, bucket]) => toRow(a, bucket));

  const flows: Record<number, FlowStep[]> = {};
  const sortKey: Record<number, { at: number; seq: number }[]> = {};

  for (const m of movements) {
    (flows[m.applicationId] ??= []).push({
      id: m.id,
      direction: m.direction as string,
      fromName: m.fromEmployee?.nameEn ?? null,
      toName: m.toEmployee.nameEn,
      toDesignation: m.toEmployee.designationEn ?? m.toEmployee.designationBn,
      note: m.note,
      at: day(m.createdAt),
    });
    (sortKey[m.applicationId] ??= []).push({ at: m.createdAt.getTime(), seq: 0 });
  }

  /**
   * A correction round is a leg of the journey, not a desk-to-desk hand-off, so
   * it cannot be an `ApplicationMovement` — that table's `toEmployeeId` is
   * required and the applicant is not an employee. It is merged in here instead,
   * because "where is the file" has to answer "with the applicant" when it is.
   */
  for (const r of rounds) {
    const n = r.items.length;
    (flows[r.applicationId] ??= []).push({
      id: -r.id * 2,
      direction: "shortfall",
      fromName: r.raisedBy.nameEn,
      toName: "the applicant",
      toDesignation: null,
      note: r.note,
      at: day(r.raisedAt),
      label: `Sent to the applicant for correction — round ${r.roundNo}, ${n} ${n === 1 ? "point" : "points"}`,
      external: true,
    });
    (sortKey[r.applicationId] ??= []).push({ at: r.raisedAt.getTime(), seq: 1 });
    if (r.respondedAt) {
      flows[r.applicationId]!.push({
        id: -r.id * 2 - 1,
        direction: "shortfall",
        fromName: null,
        toName: r.raisedBy.nameEn,
        toDesignation: null,
        note: r.response,
        at: day(r.respondedAt),
        label: `Applicant returned it — round ${r.roundNo}`,
        external: true,
      });
      sortKey[r.applicationId]!.push({ at: r.respondedAt.getTime(), seq: 2 });
    }
  }

  /**
   * The inspection is a leg too — proposed, then approved with an office order.
   * The order is what the factory is shown, so every desk on the flow sees it.
   */
  for (const p of plans) {
    const on = p.scheduledOn.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    (flows[p.applicationId] ??= []).push({
      id: -100000 - p.applicationId * 2,
      direction: "inspection",
      fromName: null,
      toName: p.proposedBy.nameEn,
      toDesignation: null,
      note: null,
      at: day(p.proposedAt),
      label: `Inspection proposed for ${on} — ${p._count.members} on the team`,
    });
    (sortKey[p.applicationId] ??= []).push({ at: p.proposedAt.getTime(), seq: 3 });
    if (p.approvedAt && p.orderNo) {
      flows[p.applicationId]!.push({
        id: -100001 - p.applicationId * 2,
        direction: "inspection",
        fromName: null,
        toName: p.approvedBy?.nameEn ?? "",
        toDesignation: null,
        note: null,
        at: day(p.approvedAt),
        label: `Inspection approved — office order ${p.orderNo}`,
      });
      sortKey[p.applicationId]!.push({ at: p.approvedAt.getTime(), seq: 4 });
    }
  }

  // Chronological, so a round sits between the hand-offs it happened between.
  for (const id of Object.keys(flows)) {
    const k = Number(id);
    const paired = flows[k].map((step, i) => ({ step, key: sortKey[k][i] }));
    paired.sort((a, b) => a.key.at - b.key.at || a.key.seq - b.key.seq);
    flows[k] = paired.map((p) => p.step);
  }

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
          <FileBoard rows={rows} flows={flows} down={down} up={up} hasDesk={hasDesk} canReceive={!!scope} />
        )}
      </main>
    </>
  );

}
