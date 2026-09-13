import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { deskRank, displayDesignation } from "@/lib/workflow/chain";
import { postsForOffice } from "@/lib/desk-service";
import DeskManager, { type DeskRow, type PostChoice } from "./_components/DeskManager";

export const dynamic = "force-dynamic";

/**
 * Correcting who sits on which organogram post.
 *
 * **The screen CLAUDE.md kept pointing at.** Every desk was assigned by a
 * script and 322 of them are guesses `import:desks` cannot revisit — it only
 * ever fills a *null* `orgPostId`. Until this existed a wrong seat was
 * permanent, and a wrong seat is not cosmetic: the desk decides which section a
 * file routes to (D58) and which title the person is shown (D124).
 *
 * Superadmin only. The organogram is institution-wide, and an officeadmin who
 * could reseat their own staff could put somebody on the office head's desk.
 *
 * **Posts are loaded per office, not all at once.** 842 posts against 23
 * offices, and a post outside the employee's own office subtree is refused by
 * `setDesk()` anyway — so offering them would be offering a choice the save
 * rejects.
 */
export default async function DesksPage({
  searchParams,
}: {
  searchParams: Promise<{ office?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL") redirect("/");
  if (!hasRole(viewer, "superadmin")) redirect("/hr/listing");

  const { office } = await searchParams;

  const [offices, me] = await Promise.all([
    prisma.office.findMany({ select: { id: true, nameEn: true }, orderBy: { id: "asc" } }),
    viewer.employeeId
      ? prisma.employee.findUnique({
          where: { id: viewer.employeeId },
          select: { officeId: true },
        })
      : null,
  ]);

  // Default to the viewer's own office rather than to nothing: a superadmin
  // arrives here about somebody, and that somebody is usually local.
  const officeId = Number(office) || me?.officeId || offices[0]?.id;

  const [employees, posts] = await Promise.all([
    prisma.employee.findMany({
      where: { officeId, status: { not: "retired" } },
      select: {
        id: true,
        nameEn: true,
        nameBn: true,
        designationEn: true,
        designationBn: true,
        grade: true,
        category: true,
        status: true,
        orgPostIsInferred: true,
        orgPost: {
          select: { id: true, nameEn: true, grade: true, unit: { select: { nameEn: true } } },
        },
        actingOrgPost: {
          select: { id: true, nameEn: true, grade: true, unit: { select: { nameEn: true } } },
        },
      },
      orderBy: { id: "asc" },
    }),
    postsForOffice(officeId),
  ]);

  const rows: DeskRow[] = employees.map((e) => {
    const recorded = e.designationEn ?? e.designationBn;
    const postTitle = e.orgPost?.nameEn ?? null;
    // The same comparison `displayDesignation()` makes, surfaced as a column:
    // a rank disagreement on a guessed seat is the signal the guess was wrong,
    // and it is the whole correction list.
    const rankDisagrees =
      !!recorded && !!postTitle && deskRank(recorded).label !== deskRank(postTitle).label;
    return {
      id: e.id,
      nameEn: e.nameEn,
      nameBn: e.nameBn,
      recordedEn: e.designationEn,
      recordedBn: e.designationBn,
      grade: e.grade,
      category: e.category,
      status: e.status,
      inferred: e.orgPostIsInferred,
      rankDisagrees,
      shownEn:
        displayDesignation(
          e.designationEn,
          (e.actingOrgPost ?? e.orgPost)?.nameEn ?? null,
          e.actingOrgPost !== null,
          e.actingOrgPost === null && e.orgPostIsInferred,
        ) ?? null,
      post: e.orgPost
        ? {
            id: e.orgPost.id,
            nameEn: e.orgPost.nameEn,
            grade: e.orgPost.grade,
            unitEn: e.orgPost.unit.nameEn,
          }
        : null,
      acting: e.actingOrgPost
        ? {
            id: e.actingOrgPost.id,
            nameEn: e.actingOrgPost.nameEn,
            grade: e.actingOrgPost.grade,
            unitEn: e.actingOrgPost.unit.nameEn,
          }
        : null,
    };
  });

  const choices: PostChoice[] = posts.map((p) => ({
    id: p.id,
    nameEn: p.nameEn,
    grade: p.grade,
    unitEn: p.unitEn,
    sanctioned: p.sanctioned,
    held: p.held,
    holders: p.holders,
  }));

  return (
    <DeskManager
      offices={offices}
      officeId={officeId}
      rows={rows}
      posts={choices}
    />
  );
}
