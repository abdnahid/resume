import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { cachedDesignations, cachedDesks, cachedStaff } from "@/lib/hr-cache";

/**
 * The desks screen's data, for TanStack Query (D154).
 *
 * **The same three reads the page renders from**, straight from the database.
 * This is what the client refetches after every save, so it must never be
 * served from anything that a write could leave behind.
 */
export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasRole(viewer, "superadmin"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const officeId = Number(new URL(req.url).searchParams.get("office"));
  if (!Number.isInteger(officeId) || officeId <= 0)
    return NextResponse.json({ error: "office is required" }, { status: 400 });

  const [rows, desks, designations] = await Promise.all([
    cachedStaff(officeId),
    cachedDesks(officeId),
    cachedDesignations(),
  ]);
  return NextResponse.json({ rows, desks, designations });
}
