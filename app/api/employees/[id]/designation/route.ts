import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { setDesignation } from "@/lib/designation-service";

/**
 * Change one employee's recorded designation. Superadmin only.
 *
 * Keyed on the **employee id**, like `/api/employees/[id]/desk` and
 * `/api/roles/[id]` — that is what an administrator knows.
 *
 * Body: `{ designationEn?, designationBn? }`. An absent key is left alone; an
 * empty string clears that language. The service refuses to leave somebody with
 * neither.
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

  const read = (key: string) =>
    key in body ? (typeof body[key] === "string" ? (body[key] as string) : null) : undefined;

  try {
    return NextResponse.json(
      await setDesignation({
        employeeId: id,
        designationEn: read("designationEn"),
        designationBn: read("designationBn"),
      }),
    );
  } catch (e) {
    const message = (e as Error).message;
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("No such") ? 404 : 409 },
    );
  }
}
