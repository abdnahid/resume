import { notFound } from "next/navigation";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, canViewApplication, movementsFor } from "@/lib/workflow/inbox";
import { describeMovement } from "@/lib/workflow/chain";
import { getApplication } from "@/lib/cm/applications";
import { stageInfo } from "@/lib/cm/states";
import { allShortfallTargets, shortfallLabel } from "@/lib/cm/policy";
import { roundsFor, artworkTargetsFor } from "@/lib/cm/shortfall";
import { planFor, teamCandidates, reviewIsClosed } from "@/lib/cm/inspection";
import ReviewPanel from "../_components/ReviewPanel";
import InspectionPanel from "../_components/InspectionPanel";
import { FileHeader, Card, Empty } from "../_components/FileShell";

export const dynamic = "force-dynamic";

const navItems = [{ label: "Files", href: "/workflow" }];

/**
 * Working the file: the corrections asked for, the inspection plan, the office
 * order, and where the file has been.
 *
 * **Separate from the preview on purpose.** Reading what was filed and acting on
 * it are different jobs — an officer approving a visit should not scroll past
 * six cards of sub-products to reach the button, and one checking a declared
 * capacity should not scroll past the control that issues an office order.
 * Splitting them also gives each side its own `loading.tsx`.
 *
 * Standing to open it is `canViewApplication()` (D80), the same as the preview:
 * reading is not acting, and every action here re-checks on the server that the
 * caller is *holding* the file.
 */
export default async function ProcessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) notFound();

  const viewer = await requireInternal(`/workflow/${id}/process`);
  const actor = await actorFor(viewer);
  if (!(await canViewApplication(actor, applicationId))) notFound();

  const app = await getApplication(applicationId);
  if (!app) notFound();

  const [movements, rounds, artworkTargets, plan, team] = await Promise.all([
    movementsFor(applicationId),
    roundsFor(applicationId),
    artworkTargetsFor(applicationId),
    planFor(applicationId),
    app.bstiOfficeId
      ? teamCandidates(app.bstiOfficeId, actor.employeeId)
      : Promise.resolve({ scopedToSection: false, candidates: [] }),
  ]);

  const stage = stageInfo(app.state);
  const isHolder = !!actor.employeeId && app.holderEmployeeId === actor.employeeId;
  const open = rounds.find((r) => r.respondedAt === null) ?? null;
  const stamp = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  /**
   * The journey, hand-offs and correction rounds together.
   *
   * A round is a leg but not a desk-to-desk move — `ApplicationMovement`
   * requires an employee on the receiving end and the applicant is not one — so
   * the two are merged here rather than in the table.
   */
  const flow = [
    ...movements.map((m) => ({
      key: `m${m.id}`,
      at: stamp(m.createdAt),
      when: m.createdAt.getTime(),
      seq: 0,
      external: false,
      text: describeMovement({
        direction: m.direction,
        fromName: m.fromEmployee?.nameEn ?? null,
        toName: m.toEmployee.nameEn,
      }),
      sub: m.toEmployee.designationEn ?? m.toEmployee.designationBn ?? "",
      note: m.note,
    })),
    ...rounds.flatMap((r) => [
      {
        key: `s${r.id}`,
        at: stamp(r.raisedAt),
        when: r.raisedAt.getTime(),
        seq: 1,
        external: true,
        text: `Sent to the applicant for correction — round ${r.roundNo}, ${r.items.length} ${r.items.length === 1 ? "point" : "points"}`,
        sub: r.raisedBy.nameEn,
        note: r.note,
      },
      ...(r.respondedAt
        ? [{
            key: `r${r.id}`,
            at: stamp(r.respondedAt),
            when: r.respondedAt.getTime(),
            seq: 2,
            external: true,
            text: `Applicant returned it — round ${r.roundNo}`,
            sub: "",
            note: r.response,
          }]
        : []),
    ]),
    ...(plan
      ? [
          {
            key: `p${plan.id}`,
            at: stamp(plan.proposedAt),
            when: plan.proposedAt.getTime(),
            seq: 3,
            external: false,
            text: `Inspection proposed for ${stamp(plan.scheduledOn)} — ${plan.members.length} on the team`,
            sub: plan.proposedBy.nameEn,
            note: plan.note,
          },
          ...(plan.approvedAt && plan.orderNo
            ? [{
                key: `pa${plan.id}`,
                at: stamp(plan.approvedAt),
                when: plan.approvedAt.getTime(),
                seq: 4,
                external: false,
                text: `Inspection approved — office order ${plan.orderNo}`,
                sub: plan.approvedBy?.nameEn ?? "",
                note: null as string | null,
              }]
            : []),
        ]
      : []),
  ].sort((a, b) => a.when - b.when || a.seq - b.seq);

  return (
    <>
      <ModuleNavbar moduleName="Workflow" moduleSubtitle="BSTI e-Services" navItems={navItems} />
      <main className="mx-auto w-full max-w-[1440px] px-5 py-12 lg:px-10">
        <FileHeader
          applicationId={app.id}
          applicationNo={app.applicationNo}
          stageLabel={stage.label}
          withApplicant={stage.holder === "applicant"}
          holderName={app.holder?.nameEn ?? null}
          holderDesignation={app.holder?.designationEn ?? null}
          officeName={app.bstiOffice?.nameEn ?? null}
        />

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            {/* The review closes when the file is marked ready: no shortfall
                may follow, so the panel that raises one goes away rather than
                offering a button the service would refuse (D82). */}
            {isHolder && !reviewIsClosed(app.state) && (
              <ReviewPanel
                applicationId={app.id}
                targets={[
                  ...allShortfallTargets().map((t) => ({ ...t, step: t.step })),
                  // Artwork is per variant (D53), so the officer picks the jar
                  // rather than reopening every wrapper on the licence.
                  ...artworkTargets.map((a) => ({
                    target: a.target,
                    label: `Artwork — ${a.label}`,
                    hint: `${a.subProduct}. ${a.hasArtwork ? "A label is on file." : "No label has been provided."}`,
                    step: 2 as const,
                  })),
                ]}
                openRound={
                  open
                    ? { roundNo: open.roundNo, raisedAt: stamp(open.raisedAt), itemCount: open.items.length }
                    : null
                }
              />
            )}

            {reviewIsClosed(app.state) && (
              <InspectionPanel
                applicationId={app.id}
                officeName={app.bstiOffice?.nameEn ?? null}
                plan={
                  plan
                    ? {
                        scheduledOn: plan.scheduledOn.toISOString().slice(0, 10),
                        note: plan.note,
                        proposedBy: plan.proposedBy.nameEn,
                        proposedAt: stamp(plan.proposedAt),
                        approvedBy: plan.approvedBy?.nameEn ?? null,
                        approvedAt: plan.approvedAt ? stamp(plan.approvedAt) : null,
                        orderNo: plan.orderNo,
                        members: plan.members.map((m) => ({
                          employeeId: m.employeeId,
                          name: m.employee.nameEn,
                          designation: m.employee.designationEn ?? m.employee.designationBn,
                          role: m.role,
                        })),
                      }
                    : null
                }
                candidates={team.candidates}
                candidatesAreSectionOnly={team.scopedToSection}
                proposerEmployeeId={actor.employeeId}
                canEdit={isHolder && !plan?.approvedAt}
                // Approval is the proposer's senior, not the office head
                // (D83). The service re-checks the seniority; this only decides
                // whether to draw the button.
                canApprove={
                  isHolder &&
                  !!plan &&
                  !plan.approvedAt &&
                  plan.proposedByEmployeeId !== actor.employeeId
                }
              />
            )}

            {/* ── The application ─────────────────────────────────────── */}
          </div>

          {/* The record of what has happened, beside the controls rather than
              among them: once the review has closed the correction rounds are
              history, and reading them next to the inspection plan made them
              look like part of it. */}
          <div className="space-y-5">
            {rounds.length > 0 && (
              <Card title={`Corrections asked for (${rounds.length})`}>
                <ol className="space-y-4">
                  {rounds.map((r) => (
                    <li key={r.id} className="rounded-xl border border-border p-3">
                      <p className="text-sm font-medium text-foreground">
                        Round {r.roundNo}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {r.raisedBy.nameEn} · {stamp(r.raisedAt)}
                        </span>
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            r.respondedAt
                              ? "bg-secondary text-muted-foreground"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {r.respondedAt ? `answered ${stamp(r.respondedAt)}` : "awaiting the applicant"}
                        </span>
                      </p>
                      {r.note && (
                        <p className="mt-1 text-xs italic text-muted-foreground">“{r.note}”</p>
                      )}
                      <ul className="mt-2 space-y-1.5">
                        {r.items.map((i) => (
                          <li key={i.id} className="text-sm">
                            <span className="font-medium text-foreground">
                              {artworkTargets.find((a) => a.target === i.target)
                                ? `Artwork — ${artworkTargets.find((a) => a.target === i.target)!.label}`
                                : shortfallLabel(i.target)}
                            </span>
                            <span className="block text-xs text-muted-foreground">{i.comment}</span>
                          </li>
                        ))}
                      </ul>
                      {r.response && (
                        <p className="mt-2 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Applicant: </span>
                          {r.response}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </Card>
            )}
            <Card title={`Desk flow (${flow.length})`}>
              {flow.length === 0 ? (
                <Empty>Not yet received.</Empty>
              ) : (
                <ol className="space-y-3">
                  {flow.map((f, i) => (
                    <li key={f.key} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                            f.external
                              ? "bg-amber-500"
                              : i === flow.length - 1
                                ? "bg-primary"
                                : "bg-border"
                          }`}
                        />
                        {i < flow.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                      </div>
                      <div className="min-w-0 pb-1">
                        <p className="text-sm text-foreground">{f.text}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {f.sub ? `${f.sub} · ` : ""}
                          {f.at}
                        </p>
                        {f.note && (
                          <p className="mt-1 text-xs italic text-muted-foreground">“{f.note}”</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
