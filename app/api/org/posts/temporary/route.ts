import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { createTemporaryDesk } from "@/lib/temporary-desks";
import { revalidateOffice } from "@/lib/hr-cache";

/**
 * Create a desk outside the approved organogram (D155). Superadmin only.
 *
 * Body: `{ unitId, nameEn, nameBn, reason }`.
 *
 * **Superadmin, not officeadmin** — unlike ordinary post creation. An
 * establishment exception is an institution-level act; an office that could
 * mint its own desks could grow its own sanctioned strength on paper.
 */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasRole(viewer, "superadmin"))
    return NextResponse.json(
      { error: "Only a superadmin can create a desk outside the organogram." },
      { status: 403 },
    );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const post = await createTemporaryDesk({
      unitId: Number(body.unitId),
      nameEn: String(body.nameEn ?? ""),
      nameBn: String(body.nameBn ?? ""),
      reason: String(body.reason ?? ""),
      createdByEmployeeId: viewer.employeeId ?? null,
    });
    if (typeof body.officeId === "number") revalidateOffice(body.officeId);
    return NextResponse.json(post, { status: 201 });
  } catch (e) {
    const message = (e as Error).message;
    return NextResponse.json({ error: message }, { status: message.startsWith("No such") ? 404 : 409 });
  }
}
