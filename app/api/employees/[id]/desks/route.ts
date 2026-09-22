import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { setDesks } from "@/lib/desks-designations";
import { revalidateOffice } from "@/lib/hr-cache";

/**
 * Replace the whole set of desks an employee holds (D153). Superadmin only.
 *
 * Body: `{ desks: [{ orgPostId, isPrimary, note? }] }`. **The whole set**, not
 * a diff — a list merged row by row leaves somebody on a desk because nobody
 * remembered to take them off it.
 */
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasRole(viewer, "superadmin"))
    return NextResponse.json({ error: "Only a superadmin can change desks." }, { status: 403 });

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const raw = Array.isArray(body.desks) ? body.desks : [];
  const desks = raw
    .map((d) => d as { orgPostId?: unknown; isPrimary?: unknown; note?: unknown })
    .filter((d) => Number.isInteger(Number(d.orgPostId)))
    .map((d) => ({
      orgPostId: Number(d.orgPostId),
      isPrimary: d.isPrimary === true,
      note: typeof d.note === "string" ? d.note : null,
    }));

  try {
    const result = await setDesks({ employeeId: id, desks });
    const e = await prisma.employee.findUnique({ where: { id }, select: { officeId: true } });
    revalidateOffice(e?.officeId);
    return NextResponse.json(result);
  } catch (e) {
    const message = (e as Error).message;
    return NextResponse.json({ error: message }, { status: message.startsWith("No such") ? 404 : 409 });
  }
}
