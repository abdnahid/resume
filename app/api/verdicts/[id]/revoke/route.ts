import { NextResponse } from "next/server";
import { requireCaseHandler } from "@/lib/salary/cases";
import { toStoredDate } from "@/lib/salary/dates";
import { revokeVerdict } from "@/lib/salary/verdicts";

/**
 * Lift a verdict — an appeal won, or the order withdrawn.
 *
 * Normal pay resumes from the revocation date. Where the order also directed
 * that withheld pay be made good, `arrearsOrdered` totals it and the next month
 * processed for the employee pays it.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const g = await requireCaseHandler();
  if (!g.ok) return g.response;

  const { id } = await context.params;
  const verdictId = Number(id);
  if (!Number.isInteger(verdictId)) {
    return NextResponse.json({ error: "Invalid verdict id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const revokedOn = toStoredDate(body.revokedOn);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!revokedOn) {
    return NextResponse.json({ error: "Revoked-on is not a real date." }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json(
      { error: "Say why the verdict is being lifted — it goes on the record." },
      { status: 400 },
    );
  }

  try {
    const result = await revokeVerdict(
      verdictId,
      { revokedOn, reason, arrearsOrdered: body.arrearsOrdered === true },
      g.username || null,
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not revoke the verdict." },
      { status: 409 },
    );
  }
}
