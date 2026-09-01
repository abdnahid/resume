import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { attachBds, detachBds, membershipFor } from "@/lib/cm/applications";

/** The access check both verbs share. */
async function guard(applicationId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized", status: 401 as const };
  const m = await membershipFor(userId, applicationId);
  if (!m) return { error: "Not found", status: 404 as const };
  if (m.role === "viewer")
    return { error: "You do not have permission to edit this application.", status: 403 as const };
  return { userId };
}

/** Attach a purchased standard (spec §3.3). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const g = await guard(id);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

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
    await attachBds(id, purchaseId, g.userId);
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

/**
 * Release a purchase from this application.
 *
 * Released, never consumed — an applicant who attached the wrong copy must not
 * lose the standard they paid for.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const g = await guard(id);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

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
    await detachBds(id, purchaseId, g.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not detach that standard." },
      { status: 409 },
    );
  }
}
