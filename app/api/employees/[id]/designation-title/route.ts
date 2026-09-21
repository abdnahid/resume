import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { setDesignationTitle } from "@/lib/job-titles";

/**
 * Set one employee's designation from the shared title catalogue (D152).
 * Superadmin only, like the desk it sits beside.
 *
 * Body: `{ titleId }` — a `JobTitle` id, or null to unset.
 */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasRole(viewer, "superadmin"))
    return NextResponse.json(
      { error: "Only a superadmin can change a designation." },
      { status: 403 },
    );

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const raw = body.titleId;
  const titleId = raw === null || raw === "" ? null : Number(raw);
  if (titleId !== null && !Number.isInteger(titleId))
    return NextResponse.json({ error: "titleId must be a job title id." }, { status: 400 });

  try {
    return NextResponse.json(await setDesignationTitle({ employeeId: id, titleId }));
  } catch (e) {
    const message = (e as Error).message;
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("No such") ? 404 : 409 },
    );
  }
}
