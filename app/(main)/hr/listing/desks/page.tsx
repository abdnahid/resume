import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { deskOptions, staffOfOffice, titleOptions } from "@/lib/job-titles";
import StaffTitleManager from "./_components/StaffTitleManager";

export const dynamic = "force-dynamic";

/**
 * Desks and designations, managed together (D152, superseding D131's screen).
 *
 * **One screen because it is one decision.** It was two — a per-person desk
 * picker here and a designation catalogue next door — and an administrator
 * looking at a person wants to set both at once. The client's own shape:
 * *"Each employee should have two pick side by side. One for desk select and
 * other for designation select."*
 *
 * **Both titles now come from one catalogue** (`JobTitle`), taking the
 * organogram's post titles as the baseline. The desk itself is still an
 * `OrgPost` and not merely a title, because the post carries the unit and the
 * unit is what routes a file to a section (D58).
 *
 * **Posts are loaded per office.** A post outside the employee's own office
 * subtree is refused by `setDesk()` anyway, so offering them would be offering
 * a choice the save rejects.
 *
 * Superadmin only. The organogram is institution-wide, and an officeadmin who
 * could reseat their own staff could put somebody on the office head's desk.
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

  const [rows, titles, desks] = await Promise.all([
    staffOfOffice(officeId),
    titleOptions(),
    deskOptions(officeId),
  ]);

  return (
    <StaffTitleManager
      offices={offices}
      officeId={officeId}
      rows={rows}
      titles={titles}
      desks={desks}
    />
  );
}
