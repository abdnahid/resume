import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { regulariseDesk } from "@/lib/temporary-desks";

/**
 * The approval came through: a temporary desk joins the establishment (D155).
 * Superadmin only. Body: `{ memoNo, sanctionedCount? }`.
 *
 * Nothing moves — the holders and the work on the desk are attached to this
 * post id and stay attached. That is the reason this is a flag rather than a
 * new post people would have to be transferred onto.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasRole(viewer, "superadmin"))
    return NextResponse.json({ error: "Only a superadmin can regularise a desk." }, { status: 403 });

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await regulariseDesk({
        orgPostId: Number(id),
        memoNo: String(body.memoNo ?? ""),
        sanctionedCount:
          body.sanctionedCount === undefined ? undefined : Number(body.sanctionedCount),
      }),
    );
  } catch (e) {
    const message = (e as Error).message;
    return NextResponse.json({ error: message }, { status: message.startsWith("No such") ? 404 : 409 });
  }
}
