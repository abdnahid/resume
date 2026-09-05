import { NextResponse } from "next/server";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, receive, pass, canViewApplication } from "@/lib/workflow/inbox";
import { raiseShortfall, markReadyForProcessing } from "@/lib/cm/shortfall";
import {
  proposeInspection, approveInspection, requestPlanRevision, sendPlanForApproval,
} from "@/lib/cm/inspection";
import { saveReport, sendReportForApproval, approveReport } from "@/lib/cm/inspection-report";

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
        // No target in the body: the approver is whoever handed the file down
        // (D84), which the movement log already knows.
        const to = await sendPlanForApproval({
          applicationId,
          employeeId: actor.employeeId,
          note: typeof body.note === "string" ? body.note : null,
          actorUserId: actor.userId,
        });
        return NextResponse.json({ sentTo: to });
      }

      if (body.action === "approve-plan") {
        const plan = await approveInspection({
          applicationId,
          employeeId: actor.employeeId,
          role: actor.role,
          actorUserId: actor.userId,
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

    // ── The inspection report (D86) ───────────────────────────────────────
    if (
      body.action === "report" ||
      body.action === "send-report" ||
      body.action === "approve-report"
    ) {
      if (!(await canViewApplication(actor, applicationId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (!actor.employeeId) {
        return NextResponse.json({ error: "Only a member of staff can do that." }, { status: 403 });
      }

      if (body.action === "report") {
        const num = (v: unknown) =>
          typeof v === "number" && Number.isFinite(v) ? v : null;
        const list = <T,>(v: unknown, pick: (x: Record<string, unknown>) => T | null): T[] =>
          Array.isArray(v)
            ? v.flatMap((x) =>
                x && typeof x === "object" ? ([pick(x as Record<string, unknown>)].filter(Boolean) as T[]) : [],
              )
            : [];

        const report = await saveReport({
          applicationId,
          employeeId: actor.employeeId,
          input: {
            applicantName: typeof body.applicantName === "string" ? body.applicantName : null,
            applicantDesignation:
              typeof body.applicantDesignation === "string" ? body.applicantDesignation : null,
            govtApprovalOk: typeof body.govtApprovalOk === "boolean" ? body.govtApprovalOk : null,
            govtApprovalNote:
              typeof body.govtApprovalNote === "string" ? body.govtApprovalNote : null,
            foundCapacityValue: num(body.foundCapacityValue),
            foundCapacityUnitId: num(body.foundCapacityUnitId),
            utilisationPercent: num(body.utilisationPercent),
            unitCostPoisha: num(body.unitCostPoisha),
            remarks: typeof body.remarks === "string" ? body.remarks : null,
            conditions: list(body.conditions, (x) =>
              typeof x.key === "string" && typeof x.satisfactory === "boolean"
                ? { key: x.key, satisfactory: x.satisfactory, note: typeof x.note === "string" ? x.note : null }
                : null,
            ),
            markings: list(body.markings, (x) =>
              typeof x.key === "string" && typeof x.present === "boolean"
                ? { key: x.key, present: x.present }
                : null,
            ),
            answers: list(body.answers, (x) =>
              typeof x.key === "string" && typeof x.text === "string"
                ? { key: x.key, text: x.text }
                : null,
            ),
          },
        });
        return NextResponse.json({ report });
      }

      if (body.action === "send-report") {
        const to = await sendReportForApproval({
          applicationId,
          employeeId: actor.employeeId,
          note: typeof body.note === "string" ? body.note : null,
          actorUserId: actor.userId,
        });
        return NextResponse.json({ sentTo: to });
      }

      const report = await approveReport({
        applicationId,
        employeeId: actor.employeeId,
        role: actor.role,
      });
      return NextResponse.json({ report });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not move the file." },
      { status: 400 },
    );
  }
}
