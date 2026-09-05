import { NextResponse } from "next/server";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, receive, pass, canViewApplication } from "@/lib/workflow/inbox";
import { raiseShortfall, markReadyForProcessing } from "@/lib/cm/shortfall";
import {
  proposeInspection, approveInspection, requestPlanRevision, sendPlanForApproval,
} from "@/lib/cm/inspection";

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

    if (body.action === "shortfall") {
      // Standing to read is not standing to write: `raiseShortfall` demands the
      // caller be *holding* the file. The 404 here only keeps a stranger from
      // learning the file exists at all.
      if (!(await canViewApplication(actor, applicationId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (!actor.employeeId) {
        return NextResponse.json({ error: "Only a member of staff can do that." }, { status: 403 });
      }
      const raw = Array.isArray(body.items) ? body.items : [];
      const items = raw.flatMap((i) =>
        i && typeof i === "object" &&
        typeof (i as { target?: unknown }).target === "string" &&
        typeof (i as { comment?: unknown }).comment === "string"
          ? [{ target: (i as { target: string }).target, comment: (i as { comment: string }).comment }]
          : [],
      );
      const round = await raiseShortfall({
        applicationId,
        employeeId: actor.employeeId,
        note: typeof body.note === "string" ? body.note : null,
        items,
      });
      return NextResponse.json({ round });
    }

    if (body.action === "ready") {
      if (!(await canViewApplication(actor, applicationId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (!actor.employeeId) {
        return NextResponse.json({ error: "Only a member of staff can do that." }, { status: 403 });
      }
      const app = await markReadyForProcessing({ applicationId, employeeId: actor.employeeId });
      return NextResponse.json({ application: app });
    }

    // ── The inspection plan (D82) ─────────────────────────────────────────
    if (
      body.action === "plan" ||
      body.action === "send-plan" ||
      body.action === "approve-plan" ||
      body.action === "revise-plan"
    ) {
      if (!(await canViewApplication(actor, applicationId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (!actor.employeeId) {
        return NextResponse.json({ error: "Only a member of staff can do that." }, { status: 403 });
      }

      if (body.action === "plan") {
        const raw = Array.isArray(body.members) ? body.members : [];
        const members = raw.flatMap((m) =>
          m && typeof m === "object" && typeof (m as { employeeId?: unknown }).employeeId === "string"
            ? [{
                employeeId: (m as { employeeId: string }).employeeId,
                role: typeof (m as { role?: unknown }).role === "string" ? (m as { role: string }).role : null,
              }]
            : [],
        );
        const plan = await proposeInspection({
          applicationId,
          employeeId: actor.employeeId,
          scheduledOn: new Date(String(body.scheduledOn ?? "")),
          note: typeof body.note === "string" ? body.note : null,
          members,
        });
        return NextResponse.json({ plan });
      }

      if (body.action === "send-plan") {
        const to = typeof body.toEmployeeId === "string" ? body.toEmployeeId : "";
        if (!to) return NextResponse.json({ error: "Choose who to send it to." }, { status: 400 });
        const app = await sendPlanForApproval({
          applicationId,
          toEmployeeId: to,
          note: typeof body.note === "string" ? body.note : null,
          actor,
        });
        return NextResponse.json({ application: app });
      }

      if (body.action === "approve-plan") {
        const plan = await approveInspection({
          applicationId,
          employeeId: actor.employeeId,
          role: actor.role,
        });
        return NextResponse.json({ plan });
      }

      const plan = await requestPlanRevision({
        applicationId,
        employeeId: actor.employeeId,
        reason: typeof body.reason === "string" ? body.reason : null,
      });
      return NextResponse.json({ plan });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not move the file." },
      { status: 400 },
    );
  }
}
