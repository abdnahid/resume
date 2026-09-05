import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/roles";
import { displayDesignation } from "@/lib/workflow/chain";

/**
 * Who the viewer is, for the navbar's account block.
 *
 * **Why an endpoint and not a prop.** `ModuleNavbar` reads the session
 * client-side on purpose: the store renders with ISR and awaiting a session on
 * the server would opt every catalogue page out of static generation (D10). So
 * the navbar has `session.user` and nothing else — a name and a role, no
 * designation, no desk. This supplies the rest.
 *
 * **Internal only, and that is deliberate rather than incidental.** It is not in
 * `PUBLIC_API_PREFIXES`, so a client is refused — which is correct, because
 * everything it returns is employment data a client does not have. The navbar
 * only calls it when the session says `INTERNAL`, so no client ever provokes
 * the refusal.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (viewer.accountType !== "INTERNAL" || !viewer.employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const e = await prisma.employee.findUnique({
    where: { id: viewer.employeeId },
    select: {
      id: true,
      nameEn: true,
      nameBn: true,
      designationEn: true,
      designationBn: true,
      status: true,
      office: { select: { nameEn: true, nameBn: true } },
      orgPost: {
        select: { id: true, nameEn: true, nameBn: true, unit: { select: { nameEn: true, nameBn: true } } },
      },
      actingOrgPost: {
        select: { id: true, nameEn: true, nameBn: true, unit: { select: { nameEn: true, nameBn: true } } },
      },
    },
  });
  if (!e) return NextResponse.json({ error: "No employee record" }, { status: 404 });

  /**
   * The desks this person occupies, most senior first.
   *
   * A post held in **additional charge** is a second desk, not a relabelling of
   * the first (D74) — the officer keeps their own and exercises the senior
   * post's authority — so both belong in the switcher. It is listed first
   * because it is the one they act from: `toDesk()` reads the acting post ahead
   * of the substantive one, so that is the desk the workflow actually uses.
   */
  const desks = [
    ...(e.actingOrgPost
      ? [{
          id: e.actingOrgPost.id,
          kind: "acting" as const,
          titleEn: e.actingOrgPost.nameEn,
          titleBn: e.actingOrgPost.nameBn,
          unitEn: e.actingOrgPost.unit.nameEn,
          unitBn: e.actingOrgPost.unit.nameBn,
        }]
      : []),
    ...(e.orgPost
      ? [{
          id: e.orgPost.id,
          kind: "substantive" as const,
          titleEn: e.orgPost.nameEn,
          titleBn: e.orgPost.nameBn,
          unitEn: e.orgPost.unit.nameEn,
          unitBn: e.orgPost.unit.nameBn,
        }]
      : []),
  ];

  // The desk is the job, so its title is what to show — but only where it agrees
  // in rank with what HR recorded, because most seats were inferred by grade.
  // See `displayDesignation`. The Bangla fallback is the picker's: 42 desked
  // employees carry only it, and a blank designation reads as missing data.
  const post = e.actingOrgPost ?? e.orgPost;
  const isActing = e.actingOrgPost !== null;
  const recordedEn = e.designationEn ?? e.designationBn;
  const recordedBn = e.designationBn ?? e.designationEn;

  return NextResponse.json({
    employeeId: e.id,
    nameEn: e.nameEn,
    nameBn: e.nameBn,
    designationEn: displayDesignation(recordedEn, post?.nameEn ?? null, isActing),
    designationBn: displayDesignation(recordedBn, post?.nameBn ?? null, isActing),
    /** What HR recorded, kept so the two can be told apart where they differ. */
    recordedDesignationEn: recordedEn,
    officeEn: e.office?.nameEn ?? null,
    officeBn: e.office?.nameBn ?? null,
    role: viewer.role,
    roleLabel: roleLabel(viewer.role),
    status: e.status,
    desks,
    /** The desk the workflow acts from — the charge if there is one. */
    activeDeskId: desks[0]?.id ?? null,
  });
}
