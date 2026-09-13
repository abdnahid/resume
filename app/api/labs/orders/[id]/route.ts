import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { type LabActor, enterResult, passDown, receiveByWing } from "@/lib/labs/testing";
import {
  approveReport,
  authoriseReport,
  checkReport,
  returnReport,
  submitReport,
} from "@/lib/labs/report";
import { applicationIdForOrder, syncLabState } from "@/lib/cm/lab-progress";

/**
 * Every act on a test order, dispatched on `action` (D133).
 *
 * One route because they are one conversation with one desk, and because each
 * of them is a single verb whose rules already live in the service. Nothing
 * here decides anything: `lib/labs/testing.ts` and `lib/labs/report.ts` refuse,
 * so a rule holds for whoever calls and not only for whoever used the button.
 *
 * **The application state is synced here, on the CM side.** The lab modules
 * know nothing about applications (D70) and must not learn — see
 * `lib/cm/lab-progress.ts`.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!viewer.employeeId)
    return NextResponse.json({ error: "No employee record." }, { status: 403 });

  const orderId = Number((await context.params).id);
  if (!Number.isInteger(orderId))
    return NextResponse.json({ error: "Not a test order." }, { status: 400 });

  const me = await prisma.employee.findUnique({
    where: { id: viewer.employeeId },
    select: { officeId: true },
  });
  const actor: LabActor = {
    employeeId: viewer.employeeId,
    userId: viewer.id,
    officeId: me?.officeId ?? null,
    roles: viewer.roles,
    role: viewer.role,
  };

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;

  try {
    let result: unknown;
    switch (body.action) {
      case "receive":
        result = await receiveByWing({ orderId, actor, note });
        break;
      case "pass":
        if (typeof body.toEmployeeId !== "string")
          return NextResponse.json({ error: "Who to?" }, { status: 400 });
        result = await passDown({ orderId, toEmployeeId: body.toEmployeeId, actor, note });
        break;
      case "result": {
        const { orderItemId, sampleId, subParameterId, observedValue, verdict } = body as {
          orderItemId?: number;
          sampleId?: number;
          subParameterId?: number | null;
          observedValue?: string;
          verdict?: string;
        };
        if (!Number.isInteger(orderItemId) || !Number.isInteger(sampleId))
          return NextResponse.json({ error: "Which reading?" }, { status: 400 });
        if (!["pass", "fail", "inconclusive", "not_tested"].includes(String(verdict)))
          return NextResponse.json({ error: "Mark it pass or fail." }, { status: 400 });
        result = await enterResult({
          orderItemId: orderItemId!,
          sampleId: sampleId!,
          subParameterId: subParameterId ?? null,
          observedValue: typeof observedValue === "string" ? observedValue.trim() || null : null,
          verdict: verdict as "pass" | "fail" | "inconclusive" | "not_tested",
          actor,
        });
        break;
      }
      case "submit":
        result = await submitReport({
          orderId,
          actor,
          remarks: typeof body.remarks === "string" ? body.remarks.trim() || undefined : undefined,
        });
        break;
      case "check":
        result = await checkReport({ orderId, actor });
        break;
      case "authorise":
        result = await authoriseReport({ orderId, actor });
        break;
      case "approve":
        result = await approveReport({ orderId, actor });
        break;
      case "return":
        if (typeof body.note !== "string" || !body.note.trim())
          return NextResponse.json({ error: "Say what needs correcting." }, { status: 400 });
        result = await returnReport({ orderId, actor, note: body.note.trim() });
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    // Every act above can change what the FDO is shown. Failing to sync must
    // not undo the act itself, which has already happened.
    const applicationId = await applicationIdForOrder(orderId).catch(() => null);
    if (applicationId) await syncLabState(applicationId).catch(() => null);

    return NextResponse.json({ ok: true, ...(result as object) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
