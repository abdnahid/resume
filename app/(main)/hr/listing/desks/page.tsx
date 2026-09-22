import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { cachedDesignations, cachedDesks, cachedStaff } from "@/lib/hr-cache";
import QueryProvider from "@/components/QueryProvider";
import StaffTitleManager from "./_components/StaffTitleManager";

export const dynamic = "force-dynamic";

/**
 * Desks and designations, managed together (D153/D154, superseding D152).
 *
 * **One designation, many desks.** A designation is one row from the sanctioned
 * catalogue — unique titles, taken from the organogram — and a desk is an
 * `OrgPost`, one per seat per section, so three offices' Assistant Director
 * (Chemical) desks are three different desks. A person holds one designation
 * and any number of desks, one primary and the rest additional charges.
 *
 * **The desk list is this office's organogram and nothing else**, which is both
 * what the client asked for and what `setDesks()` enforces: a post outside the
 * employee's own office subtree makes them unreachable by that office's routing.
 *
 * **The reads go straight to the database.** They were cached per office and
 * the cache outlived a write — see `lib/hr-cache.ts` for why it went. The
 * client still caches (D154), which is where the responsiveness anybody
 * notices actually comes from.
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

  // Read through the tagged server cache (D154) — the same entries the
  // client's refetch is served from, so a correction invalidates one thing.
  const [rows, desks, designations] = await Promise.all([
    cachedStaff(officeId),
    cachedDesks(officeId),
    cachedDesignations(),
  ]);

  return (
    <QueryProvider>
      <StaffTitleManager
        offices={offices}
        officeId={officeId}
        initial={{ rows, desks, designations }}
      />
    </QueryProvider>
  );
}
