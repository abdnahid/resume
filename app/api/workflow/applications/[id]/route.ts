import { NextResponse } from "next/server";
import { requireInternal } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { actorFor, receive, pass, canViewApplication } from "@/lib/workflow/inbox";
import { raiseShortfall, markReadyForProcessing } from "@/lib/cm/shortfall";
import {
  proposeInspection, approveInspection, requestPlanRevision, sendPlanForApproval,
} from "@/lib/cm/inspection";
import {
  saveReport, sendReportForApproval, approveReport,
  returnVisitToOfficer, demandFactoryDevelopment,
} from "@/lib/cm/inspection-report";
import { setRequirement, commitSampling } from "@/lib/samples/service";
import { addSubProduct, removeSubProduct, setSubProductInProduction } from "@/lib/cm/sub-products";
import { addSku, removeSku, setSkuInProduction } from "@/lib/cm/skus";
import { planFor } from "@/lib/cm/inspection";

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
      body.action === "approve-report" ||
      body.action === "return-visit" ||
      body.action === "demand-development"
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
            samplingRemarks:
              typeof body.samplingRemarks === "string" ? body.samplingRemarks : null,
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

      if (body.action === "return-visit") {
        const to = await returnVisitToOfficer({
          applicationId,
          employeeId: actor.employeeId,
          role: actor.role,
          note: typeof body.note === "string" ? body.note : "",
          actorUserId: actor.userId,
        });
        return NextResponse.json({ returnedTo: to });
      }

      if (body.action === "demand-development") {
        await demandFactoryDevelopment({
          applicationId,
          employeeId: actor.employeeId,
          role: actor.role,
          note: typeof body.note === "string" ? body.note : "",
          actorUserId: actor.userId,
        });
        return NextResponse.json({ ok: true });
      }

      const report = await approveReport({
        applicationId,
        employeeId: actor.employeeId,
        role: actor.role,
        actorUserId: actor.userId,
      });
      return NextResponse.json({ report });
    }

    // ── What the officer found at the factory (D89) ───────────────────────
    if (
      body.action === "found-sub-product" ||
      body.action === "found-sku" ||
      body.action === "unfound-sub-product" ||
      body.action === "unfound-sku" ||
      body.action === "in-production"
    ) {
      if (!(await canViewApplication(actor, applicationId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (!actor.employeeId) {
        return NextResponse.json({ error: "Only a member of staff can do that." }, { status: 403 });
      }
      // The visiting officer only: this is an amendment made *at the factory*,
      // and a desk that was not there cannot make it.
      const plan = await planFor(applicationId);
      if (plan?.proposedByEmployeeId !== actor.employeeId) {
        return NextResponse.json(
          { error: "Only the officer who made the visit can record what he found." },
          { status: 403 },
        );
      }

      if (body.action === "found-sub-product") {
        const row = await addSubProduct({
          applicationId,
          subProductId: Number(body.subProductId),
          userId: actor.userId,
          declaredBy: "fdo",
          employeeId: actor.employeeId,
        });
        return NextResponse.json({ subProduct: row });
      }

      if (body.action === "found-sku") {
        const sku = await addSku(
          applicationId,
          Number(body.applicationSubProductId),
          body.sku as never,
          actor.userId,
          { employeeId: actor.employeeId },
        );
        return NextResponse.json({ sku });
      }

      // Undoing his own amendment. The services refuse anything the applicant
      // declared, so this cannot be turned into a way to edit their file.
      if (body.action === "unfound-sub-product") {
        await removeSubProduct({
          applicationId,
          applicationSubProductId: Number(body.applicationSubProductId),
          userId: actor.userId,
          isFdo: true,
        });
        return NextResponse.json({ ok: true });
      }

      if (body.action === "unfound-sku") {
        await removeSku(applicationId, Number(body.skuId), actor.userId, {
          employeeId: actor.employeeId,
        });
        return NextResponse.json({ ok: true });
      }

      // Striking out a line the applicant declared but was not making (D91).
      const inProduction = body.inProduction === true;
      const note = typeof body.note === "string" ? body.note : null;
      if (body.skuId !== undefined) {
        await setSkuInProduction({
          applicationId,
          skuId: Number(body.skuId),
          inProduction,
          employeeId: actor.employeeId,
          userId: actor.userId,
          note,
        });
      } else {
        await setSubProductInProduction({
          applicationId,
          applicationSubProductId: Number(body.applicationSubProductId),
          inProduction,
          employeeId: actor.employeeId,
          userId: actor.userId,
          note,
        });
      }
      return NextResponse.json({ ok: true });
    }

    // ── Sampling (D87) ────────────────────────────────────────────────────
    if (body.action === "sample-count" || body.action === "seal-samples") {
      if (!(await canViewApplication(actor, applicationId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (!actor.employeeId) {
        return NextResponse.json({ error: "Only a member of staff can do that." }, { status: 403 });
      }
      // Sampling is the visiting officer's work, so it is guarded on holding
      // the file like every other act on it. The services check nothing about
      // who is asking, so this is the only gate.
      const app = await prisma.application.findUnique({
        where: { id: applicationId },
        select: { holderEmployeeId: true },
      });
      if (app?.holderEmployeeId !== actor.employeeId) {
        return NextResponse.json(
          { error: "Only whoever is holding this file can plan its sampling." },
          { status: 403 },
        );
      }

      if (body.action === "sample-count") {
        const asp = Number(body.applicationSubProductId);
        const labId = Number(body.labId);
        const n = Number(body.samplesPerVariant);
        if (!Number.isInteger(asp) || !Number.isInteger(labId)) {
          return NextResponse.json({ error: "Which cell?" }, { status: 400 });
        }
        await setRequirement({
          applicationSubProductId: asp,
          labId,
          samplesPerVariant: n,
          employeeId: actor.employeeId,
          note: typeof body.note === "string" ? body.note : undefined,
        });
        return NextResponse.json({ ok: true });
      }

      const result = await commitSampling(applicationId, actor.employeeId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not move the file." },
      { status: 400 },
    );
  }
}
