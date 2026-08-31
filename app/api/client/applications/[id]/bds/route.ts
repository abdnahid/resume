import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { attachBds, membershipFor } from "@/lib/cm/applications";

/** Attach a purchased standard (spec §3.3). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await membershipFor(userId, id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (m.role === "viewer")
    return NextResponse.json({ error: "You do not have permission to edit this application." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const purchaseId = Number(body.purchaseId);
  if (!Number.isInteger(purchaseId))
    return NextResponse.json({ error: "Which standard?" }, { status: 400 });

  try {
    await attachBds(id, purchaseId, userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // The attachment rule's refusals are all things the applicant needs to read,
    // so the message is passed through rather than flattened.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not attach that standard." },
      { status: 409 },
    );
  }
}
