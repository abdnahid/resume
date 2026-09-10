import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { setRoles } from "@/lib/roles-service";

/**
 * Set an employee's roles. Superadmin only.
 *
 * The `[id]` is the **employee id**, not the user id — that is what an
 * administrator knows and what every other screen is keyed on.
 *
 * Takes the **whole set** (D122). A single `role` is still accepted so that an
 * older caller keeps working, and means "these and nothing else".
 */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasRole(viewer, "superadmin"))
    return NextResponse.json({ error: "Only a superadmin can assign roles." }, { status: 403 });

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const roles = Array.isArray(body.roles)
    ? body.roles.map(String)
    : typeof body.role === "string"
      ? [body.role]
      : [];
  if (!roles.length)
    return NextResponse.json({ error: "Which roles?" }, { status: 400 });

  try {
    const r = await setRoles({
      employeeId: id,
      roles,
      actingEmployeeId: viewer.employeeId ?? "",
    });
    return NextResponse.json(r);
  } catch (e) {
    const message = (e as Error).message;
    return NextResponse.json(
      { error: message },
      { status: message.includes("not found") ? 404 : 409 },
    );
  }
}
