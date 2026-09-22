import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { manpowerByOffice } from "@/lib/temporary-desks";
import PageContainer from "@/components/PageContainer";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Manpower by office, with the establishment exceptions named (D155).
 *
 * **Three numbers, not one.** Sanctioned strength is what the government
 * approved; posted is who is actually there; posted-outside is the part of the
 * second the first does not cover. A report of the first two hides precisely
 * the thing a desk outside the organogram was created to make visible, which
 * would make the exception a way of losing people rather than of accounting
 * for them.
 */
export default async function ManpowerPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL") redirect("/");
  if (!hasRole(viewer, "superadmin") && !hasRole(viewer, "officeadmin")) redirect("/hr/listing");

  const [lines, temporary] = await Promise.all([
    manpowerByOffice(),
    prisma.orgPost.findMany({
      where: { isSanctioned: false },
      select: {
        id: true,
        nameEn: true,
        createdReason: true,
        createdAt: true,
        unit: { select: { nameEn: true } },
        createdBy: { select: { nameEn: true } },
        holders: {
          where: { releasedAt: null },
          select: { employee: { select: { id: true, nameEn: true } } },
        },
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const total = lines.reduce(
    (a, l) => ({
      sanctionedSeats: a.sanctionedSeats + l.sanctionedSeats,
      posted: a.posted + l.posted,
      postedOutside: a.postedOutside + l.postedOutside,
      overStrength: a.overStrength + l.overStrength,
    }),
    { sanctionedSeats: 0, posted: 0, postedOutside: 0, overStrength: 0 },
  );

  const cell = "px-3 py-2 text-right tabular-nums";

  return (
    <PageContainer>
      <div className="py-6">
        <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
          <Users className="h-5 w-5 text-primary" strokeWidth={1.8} />
          Manpower
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Sanctioned strength is what the organogram approves. Posted is who actually holds a desk.
          Where the two differ the difference is named rather than smoothed over — a desk created
          outside the organogram carries no sanctioned seat and appears here until it is
          regularised.
        </p>

        <div className="mt-5 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Office</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sanctioned posts</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sanctioned seats</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Posted</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Over strength</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Outside organogram</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((l) => (
                <tr key={l.officeId}>
                  <td className="px-3 py-2 text-foreground">{l.officeName}</td>
                  <td className={`${cell} text-muted-foreground`}>{l.sanctionedPosts}</td>
                  <td className={`${cell} text-muted-foreground`}>{l.sanctionedSeats}</td>
                  <td className={`${cell} font-medium text-foreground`}>{l.posted}</td>
                  <td className={`${cell} ${l.overStrength ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                    {l.overStrength || "—"}
                  </td>
                  <td className={`${cell} ${l.postedOutside ? "font-medium text-sky-700 dark:text-sky-400" : "text-muted-foreground"}`}>
                    {l.postedOutside || "—"}
                    {l.temporaryDesks > l.postedOutside && (
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        ({l.temporaryDesks} desks)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border bg-muted/40">
              <tr className="font-medium text-foreground">
                <td className="px-3 py-2">All offices</td>
                <td className={cell}>—</td>
                <td className={cell}>{total.sanctionedSeats}</td>
                <td className={cell}>{total.posted}</td>
                <td className={cell}>{total.overStrength || "—"}</td>
                <td className={cell}>{total.postedOutside || "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <h2 className="mt-8 font-display text-lg font-medium text-foreground">
          Desks outside the organogram ({temporary.length})
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each was created deliberately, with a reason, while the sanction is pending. Regularising
          one keeps its holder and everything on it — nothing moves.
        </p>

        {temporary.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            None. Every desk held today is on the approved establishment.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {temporary.map((p) => (
              <li key={p.id} className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{p.nameEn}</span>
                  <span className="text-xs text-muted-foreground">{p.unit.nameEn}</span>
                  {p.holders.map((h) => (
                    <span key={h.employee.id} className="rounded-full bg-card px-2 py-0.5 text-[11px] text-foreground ring-1 ring-border">
                      {h.employee.nameEn}
                    </span>
                  ))}
                  {!p.holders.length && (
                    <span className="text-[11px] text-muted-foreground">nobody seated</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{p.createdReason}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  created {p.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  {p.createdBy ? ` by ${p.createdBy.nameEn}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  );
}
