import { NextResponse } from "next/server";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, receive, pass } from "@/lib/workflow/inbox";

/**
 * Move a file: receive it into an office, or pass it along the chain.
 *
 * Internal by default — `/api/workflow` is not in `PUBLIC_API_PREFIXES`, so a
 * client never reaches it. `requireInternal()` re-reads the database, so a
 * stale cookie cannot get in either.
 *
 * Every rule that decides *who* may move a file lives in the service, not here:
 * the route's job is to say who is asking.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireInternal();
  const applicationId = Number((await params).id);
  if (!Number.isInteger(applicationId))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const actor = await actorFor(viewer);

  try {
    if (body.action === "receive") {
      const app = await receive(applicationId, actor);
      return NextResponse.json({ application: app });
    }

    if (body.action === "pass") {
      const direction = body.direction === "up" ? "up" : "down";
      const to = typeof body.toEmployeeId === "string" ? body.toEmployeeId : "";
      if (!to) return NextResponse.json({ error: "Choose a desk." }, { status: 400 });
      const app = await pass(
        applicationId,
        to,
        direction,
        typeof body.note === "string" ? body.note : null,
        actor,
      );
      return NextResponse.json({ application: app });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not move the file." },
      { status: 400 },
    );
  }
}
