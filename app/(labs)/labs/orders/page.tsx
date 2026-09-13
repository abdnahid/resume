import Link from "next/link";
import { FlaskConical, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/auth-guard";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import PageContainer from "@/components/PageContainer";
import { LABS_NAV } from "../_components/nav";
import { ORDER_STATE_LABELS, type LabOrderState } from "@/lib/labs/ladder";
import { ladderHealth, ordersForViewer } from "@/lib/labs/board";
import { type LabActor } from "@/lib/labs/testing";

export const dynamic = "force-dynamic";

/**
 * The laboratory's board — the wing's own work, and the start of D133.
 *
 * **Not a variant of `/workflow`.** A file moves through the institution by
 * seniority; a laboratory receives boxes, distributes specimens and reports on
 * them, and the thing that moves is a `LabTestOrder` which carries no
 * application at all (D70). So this board names packages and specimen counts,
 * and there is nowhere on it to learn whose they are.
 */
export default async function LabOrdersPage() {
  const viewer = await requireInternal("/labs/orders");
  const me = viewer.employeeId
    ? await prisma.employee.findUnique({
        where: { id: viewer.employeeId },
        select: { officeId: true, office: { select: { nameEn: true, nameBn: true } } },
      })
    : null;

  const actor: LabActor = {
    employeeId: viewer.employeeId ?? "",
    userId: viewer.id,
    officeId: me?.officeId ?? null,
    roles: viewer.roles,
    role: viewer.role,
  };

  const [orders, health] = await Promise.all([
    ordersForViewer(actor),
    me?.officeId ? ladderHealth(me.officeId) : Promise.resolve(null),
  ]);

  const waiting = orders.filter((o) => o.state === "awaiting_sample");
  const live = orders.filter((o) => !["awaiting_sample", "reported", "cancelled"].includes(o.state));
  const done = orders.filter((o) => ["reported", "cancelled"].includes(o.state));

  return (
    <>
      <ModuleNavbar moduleName="Laboratory" moduleSubtitle="BSTI e-Services" navItems={LABS_NAV} />
    <PageContainer>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Laboratory
        </p>
        <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-medium text-foreground">
          <FlaskConical size={20} strokeWidth={1.8} /> Test orders
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {me?.office?.nameEn ?? "Your office"} — the packages sent here, and where each has got to.
        </p>
      </div>

      {/* Said on the board rather than discovered when somebody tries to act:
          an office with no wing head cannot receive a sample at all, and one
          with no testing officer cannot record a reading. */}
      {health?.problems.length ? (
        <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          {health.problems.map((p) => (
            <p key={p} className="flex gap-2 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {p}
            </p>
          ))}
          <p className="pt-1 text-xs text-amber-800 dark:text-amber-300">
            Granted at <span className="font-medium">/hr/listing/roles</span>.
          </p>
        </div>
      ) : null}

      <Section title="Expected" orders={waiting} empty="Nothing on its way here." />
      <Section title="On the bench" orders={live} empty="Nothing under test." />
      <Section title="Reported" orders={done} empty="No approved reports yet." />
    </PageContainer>
    </>
  );
}

function Section({
  title,
  orders,
  empty,
}: {
  title: string;
  orders: Awaited<ReturnType<typeof ordersForViewer>>;
  empty: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">
        {title}
        <span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">
          {orders.length}
        </span>
      </h2>
      {orders.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/labs/orders/${o.id}`}
                className="flex flex-col gap-2 px-4 py-3 hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">{o.code}</span>
                    {o.isUrgent && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-red-200">
                        urgent
                      </span>
                    )}
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                      {ORDER_STATE_LABELS[o.state as LabOrderState] ?? o.state}
                    </span>
                  </p>
                  <p className="mt-1 truncate text-sm text-foreground">
                    {o.subProduct.product.nameEn}
                    <span className="text-muted-foreground"> · {o.subProduct.nameEn}</span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                    <span>{o.lab?.nameEn ?? "sent out"}</span>
                    <span>
                      {o._count.items} {o._count.items === 1 ? "parameter" : "parameters"}
                    </span>
                    <span>
                      {o._count.specimens} {o._count.specimens === 1 ? "specimen" : "specimens"}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-xs sm:text-right">
                  {o.holder && (
                    <p className="text-muted-foreground">
                      with <span className="font-medium text-foreground">{o.holder.nameEn}</span>
                    </p>
                  )}
                  {o.report?.reportNo && (
                    <p className="mt-0.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          o.report.verdict === "fail"
                            ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                            : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        }`}
                      >
                        {o.report.verdict}
                      </span>
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
