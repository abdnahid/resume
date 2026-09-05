import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileWarning, Paperclip } from "lucide-react";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, canViewApplication, movementsFor } from "@/lib/workflow/inbox";
import { describeMovement } from "@/lib/workflow/chain";
import { getApplication } from "@/lib/cm/applications";
import { testFeeFor } from "@/lib/cm/sub-products";
import { stageInfo } from "@/lib/cm/states";
import { CM_DOCUMENTS, CM_QUESTIONS, allShortfallTargets, shortfallLabel } from "@/lib/cm/policy";
import { roundsFor } from "@/lib/cm/shortfall";
import ReviewPanel from "./_components/ReviewPanel";
import { formatPoisha, takaToPoisha } from "@/lib/payments/money";
import { salePricePolicy } from "@/lib/store/bds-catalog";

export const dynamic = "force-dynamic";

const navItems = [{ label: "Files", href: "/workflow" }];

/**
 * One file, as the officers working it need to see it.
 *
 * **Read-only, and that is the point.** Every officer on the flow can open the
 * application, its attachments and what has been paid — spec §8 puts most of the
 * system's value in answering "where is my file and what is in it", and until
 * now an officer could see a summary row and nothing else. Nothing here mutates:
 * the actions stay on the board, keyed off *holding* the file.
 *
 * **A refusal is a 404, not a 403.** The same reasoning as `/s/<ref>` (D71) — a
 * distinguishable refusal would let any member of staff enumerate which
 * application numbers exist and which office holds them.
 */
export default async function WorkflowFilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) notFound();

  const viewer = await requireInternal(`/workflow/${id}`);
  const actor = await actorFor(viewer);
  if (!(await canViewApplication(actor, applicationId))) notFound();

  const app = await getApplication(applicationId);
  if (!app) notFound();

  const [movements, testFee, rounds] = await Promise.all([
    movementsFor(applicationId),
    testFeeFor(applicationId).catch(() => null),
    roundsFor(applicationId),
  ]);

  // The correction loop is between whoever holds the file and the applicant
  // (D81), so the panel only appears for the holder. The service re-checks.
  const isHolder = !!actor.employeeId && app.holderEmployeeId === actor.employeeId;
  const open = rounds.find((r) => r.respondedAt === null) ?? null;
  const stamp = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const stage = stageInfo(app.state);
  const heldDocs = new Map(app.documents.map((d) => [d.kind, d]));
  const answers = new Map(
    app.answers.map((a) => [
      a.questionKey,
      a.answerText ?? (a.answerNumber != null ? String(a.answerNumber) : null),
    ]),
  );
  const fee = app.applicationFeePayment;

  return (
    <>
      <ModuleNavbar moduleName="Workflow" moduleSubtitle="BSTI e-Services" navItems={navItems} />
      <main className="mx-auto w-full max-w-[1440px] px-5 py-12 lg:px-10">
        <Link
          href="/workflow"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
          All files
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-medium text-foreground">
            {app.applicationNo ?? `Application #${app.id}`}
          </h1>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            {stage.label}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {app.holder ? (
            <>
              with <span className="font-medium text-foreground">{app.holder.nameEn}</span>
              {app.holder.designationEn ? `, ${app.holder.designationEn}` : ""}
            </>
          ) : (
            "Held by nobody — waiting to be received."
          )}
          {app.bstiOffice && <> · {app.bstiOffice.nameEn}</>}
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            {isHolder && (
              <ReviewPanel
                applicationId={app.id}
                targets={allShortfallTargets().map((t) => ({ ...t, step: t.step }))}
                openRound={
                  open
                    ? { roundNo: open.roundNo, raisedAt: stamp(open.raisedAt), itemCount: open.items.length }
                    : null
                }
              />
            )}

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
                              {shortfallLabel(i.target)}
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
            {/* ── The application ─────────────────────────────────────── */}
            <Card title="Applicant">
              <Row label="Company" value={app.organization.nameEn} bn={app.organization.nameBn} />
              <Row
                label="Address"
                value={[app.organization.addressLine, app.organization.district]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Row label="Factory" value={app.factory.nameEn} bn={app.factory.nameBn} />
              <Row label="Factory district" value={app.factory.district} />
            </Card>

            <Card title="Product and standards">
              <Row
                label="Product"
                value={
                  app.product ? `#${app.product.serial} ${app.product.nameEn}` : "Not chosen"
                }
                bn={app.product?.nameBn ?? null}
              />
              {app.product?.standards.length ? (
                <div className="pt-1">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Standards — all of them are required
                  </p>
                  <ul className="space-y-1">
                    {app.product.standards.map((ps) => {
                      const attached = app.attachedPurchases.find((p) => p.bdsId === ps.bdsId);
                      return (
                        <li key={ps.bdsId} className="flex flex-wrap items-baseline gap-2 text-sm">
                          <span className="font-mono text-foreground">{ps.bds.number}</span>
                          <span className="text-muted-foreground">{ps.bds.titleEn}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              attached
                                ? "bg-primary/10 text-primary"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {attached ? "attached" : "not attached"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </Card>

            <Card title={`Sub-products and articles (${app.subProducts.length})`}>
              {app.subProducts.length === 0 ? (
                <Empty>None declared.</Empty>
              ) : (
                <ul className="space-y-4">
                  {app.subProducts.map((sp) => (
                    <li key={sp.id}>
                      <p className="text-sm font-medium text-foreground">
                        {sp.subProduct.nameEn}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          declared by {sp.declaredBy}
                        </span>
                      </p>
                      {sp.subProduct.standardAsPrinted && (
                        <p className="text-xs text-muted-foreground">
                          {sp.subProduct.standardAsPrinted}
                        </p>
                      )}
                      {sp.skus.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">No articles named.</p>
                      ) : (
                        <ul className="mt-1.5 space-y-1">
                          {sp.skus.map((sku) => (
                            <li key={sku.id} className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{sku.brandName}</span>
                              {[
                                sku.variant,
                                sku.sizeValue != null
                                  ? `${sku.sizeValue} ${sku.sizeUnit.code}`
                                  : sku.sizeUnit.code,
                                sku.packaging,
                                sku.grade,
                              ]
                                .filter(Boolean)
                                .map((bit) => ` · ${bit}`)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Production capacity">
              {app.production ? (
                <>
                  <Row
                    label="Annual capacity"
                    value={`${app.production.annualCapacityValue} ${app.production.capacityUnit.code}`}
                  />
                  <Row
                    label={`Produced ${app.production.currentYearLabel}`}
                    value={`${app.production.currentYearProduction} ${app.production.capacityUnit.code}`}
                  />
                  <Row label="Capacity stated by" value={app.production.authority} />
                  <Row label="Registration no" value={app.production.registrationNo} />
                </>
              ) : (
                <Empty>Not filled in.</Empty>
              )}
            </Card>

            <Card title="BSTI's questions">
              {answers.size === 0 ? (
                <Empty>Not answered.</Empty>
              ) : (
                <div className="space-y-4">
                  {CM_QUESTIONS.map((g) => {
                    const asked = g.questions.filter((q) => answers.get(q.key));
                    if (asked.length === 0) return null;
                    return (
                      <div key={g.key}>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {g.titleEn}
                        </p>
                        <dl className="space-y-2">
                          {asked.map((q) => (
                            <div key={q.key}>
                              <dt className="text-xs text-muted-foreground">{q.labelEn}</dt>
                              <dd className="whitespace-pre-wrap text-sm text-foreground">
                                {answers.get(q.key)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* ── Attachments, fee, flow ────────────────────────────────── */}
          <div className="space-y-5">
            <Card title="Attachments">
              {/* The kernel document store does not exist yet, so the bytes are
                  discarded on upload. Saying so here is the whole point: an
                  officer must not open this list believing BSTI holds the
                  applicant's trade licence when it does not. */}
              <p className="mb-3 flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                Only what was declared is recorded. The document store is not
                built, so no file can be opened from here.
              </p>
              <ul className="space-y-2">
                {CM_DOCUMENTS.map((req) => {
                  const held = heldDocs.get(req.kind);
                  return (
                    <li key={req.kind} className="flex items-start gap-2 text-sm">
                      <Paperclip
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${held ? "text-primary" : "text-muted-foreground/50"}`}
                        strokeWidth={1.8}
                      />
                      <span className="min-w-0">
                        <span className="block text-foreground">
                          {req.label}
                          {req.required && !held && (
                            <span className="ml-1.5 text-xs text-destructive">required</span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {held ? (held.fileName ?? "recorded") : "not provided"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card title="Fees">
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Application fee
                  </p>
                  {fee ? (
                    <>
                      <p className="text-sm text-foreground">
                        {formatPoisha(fee.totalPoisha)}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({formatPoisha(fee.incomePoisha)} + {formatPoisha(fee.vatPoisha)} VAT)
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-mono">{fee.reference}</span> · {fee.status}
                        {fee.paidAt && ` · ${fee.paidAt.toLocaleDateString("en-GB")}`}
                      </p>
                      {fee.isSandbox && (
                        <p className="mt-1 inline-block rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          sandbox — no money moved
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not raised yet.</p>
                  )}
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Test fee
                  </p>
                  {/* Quotable before inspection because the applicant chose the
                      sub-products (D67); it is the sum over every lab, and no
                      total is stored (D62). */}
                  <p className="text-sm text-foreground">
                    {testFee ? formatPoisha(testFee.totalPoisha) : "Not resolvable yet"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Provisional until the inspecting officer confirms the sub-product.
                  </p>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Standards purchased ({app.attachedPurchases.length})
                  </p>
                  {app.attachedPurchases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None attached.</p>
                  ) : (
                    <ul className="space-y-1">
                      {app.attachedPurchases.map((p) => {
                        const price = salePricePolicy(p.bds);
                        // `salePricePolicy` answers in taka; the fee block above
                        // is poisha, so convert rather than mixing the two.
                        return (
                          <li key={p.id} className="text-xs">
                            <span className="font-mono text-foreground">{p.bds.number}</span>{" "}
                            <span className="text-muted-foreground">
                              {formatPoisha(takaToPoisha(price.priceBdt))}
                              {price.isProvisional && " · provisional price"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </Card>

            <Card title={`Desk flow (${movements.length})`}>
              {movements.length === 0 ? (
                <Empty>Not yet received.</Empty>
              ) : (
                <ol className="space-y-3">
                  {movements.map((m, i) => (
                    <li key={m.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                            i === movements.length - 1 ? "bg-primary" : "bg-border"
                          }`}
                        />
                        {i < movements.length - 1 && (
                          <span className="mt-1 w-px flex-1 bg-border" />
                        )}
                      </div>
                      <div className="min-w-0 pb-1">
                        <p className="text-sm text-foreground">
                          {describeMovement({
                            direction: m.direction,
                            fromName: m.fromEmployee?.nameEn ?? null,
                            toName: m.toEmployee.nameEn,
                          })}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {m.toEmployee.designationEn ?? m.toEmployee.designationBn ?? ""}
                          {" · "}
                          {m.createdAt.toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {m.note && (
                          <p className="mt-1 text-xs italic text-muted-foreground">“{m.note}”</p>
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 font-display text-lg font-medium text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  bn,
}: {
  label: string;
  value: string | null;
  bn?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1">
      <span className="w-36 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 text-sm text-foreground">
        {value}
        {bn && <span className="ml-2 font-bn-serif text-sm text-muted-foreground">{bn}</span>}
      </span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
