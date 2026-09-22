import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { setDesignation } from "@/lib/desks-designations";
import { revalidateOffice } from "@/lib/hr-cache";

/** Set one employee's designation (D153). Superadmin only. Body: `{ designationId }`. */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasRole(viewer, "superadmin"))
    return NextResponse.json({ error: "Only a superadmin can change a designation." }, { status: 403 });

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const raw = body.designationId;
  const designationId = raw === null || raw === "" ? null : Number(raw);
  if (designationId !== null && !Number.isInteger(designationId))
    return NextResponse.json({ error: "designationId must be an id." }, { status: 400 });

  try {
    const result = await setDesignation({ employeeId: id, designationId });
    const e = await prisma.employee.findUnique({ where: { id }, select: { officeId: true } });
    revalidateOffice(e?.officeId);
    return NextResponse.json(result);
  } catch (e) {
    const message = (e as Error).message;
    return NextResponse.json({ error: message }, { status: message.startsWith("No such") ? 404 : 409 });
  }
}
