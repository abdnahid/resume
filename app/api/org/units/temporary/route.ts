import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { createTemporaryUnit } from "@/lib/temporary-desks";

/**
 * Create a section outside the approved organogram (D157). Superadmin only,
 * for the same reason its posts are: an office that could mint its own sections
 * could grow its own sanctioned structure on paper.
 *
 * Body: `{ parentId, nameEn, nameBn, reason }`.
 */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasRole(viewer, "superadmin"))
    return NextResponse.json(
      { error: "Only a superadmin can create a section outside the organogram." },
      { status: 403 },
    );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await createTemporaryUnit({
        parentId: Number(body.parentId),
        nameEn: String(body.nameEn ?? ""),
        nameBn: String(body.nameBn ?? ""),
        reason: String(body.reason ?? ""),
      }),
      { status: 201 },
    );
  } catch (e) {
    const message = (e as Error).message;
    return NextResponse.json({ error: message }, { status: message.startsWith("No such") ? 404 : 409 });
  }
}
