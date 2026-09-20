import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { proposeDesks } from "@/lib/desk-proposal";
import AssignReview from "./_components/AssignReview";

export const dynamic = "force-dynamic";

/**
 * Bulk desk assignment — the seating half of D149.
 *
 * **Propose, review, apply** (the client's call, 2026-09-20). 249 active
 * employees hold no post and 322 more sit on one a script guessed; the
 * per-person picker next door is about 570 interactions, which is not a
 * workflow anybody finishes.
 *
 * **Nothing is written by loading this page.** `proposeDesks()` only reads —
 * it returns what it would do and why, and the administrator ticks what to
 * apply. Only `exact` rows are ticked to begin with.
 *
 * Superadmin only, like the picker: the organogram is institution-wide and an
 * officeadmin who could reseat their own staff could seat somebody on the
 * office head's desk.
 */
export default async function AssignPage({
  searchParams,
}: {
  searchParams: Promise<{ office?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL") redirect("/");
  if (!hasRole(viewer, "superadmin")) redirect("/hr/listing");

  const { office } = await searchParams;
  const officeId = Number(office) || undefined;

  const [offices, summary] = await Promise.all([
    prisma.office.findMany({ select: { id: true, nameEn: true }, orderBy: { id: "asc" } }),
    proposeDesks(officeId),
  ]);

  return <AssignReview offices={offices} officeId={officeId ?? null} summary={summary} />;
}
