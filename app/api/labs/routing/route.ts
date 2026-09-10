import { NextResponse } from "next/server";
import { labActor } from "../_actor";
import { canEditRouting } from "@/lib/labs/access";
import { setPreference } from "@/lib/labs/mapping";

/**
 * Point a set of an office's parameters at a laboratory.
 *
 * The office's own decision (D64), so the gate is that office: a superadmin, or
 * its own head or lab entry officer. Nobody redraws another office's referrals.
 *
 * The service refuses a destination that has not declared the capability, and
 * refuses a closed lab — that check is deliberately not in this route, because
 * it is also the rule for anything else that ever writes a routing row, and a
 * rule enforced only where the button is holds only for people who use the
 * button.
 */
export async function POST(req: Request) {
  const actor = await labActor();
  const body = (await req.json()) as Record<string, unknown>;

  const officeId = Number(body.officeId);
  const toOfficeId = body.toOfficeId === null ? null : Number(body.toOfficeId);
  const parameterIds = Array.isArray(body.parameterIds)
    ? body.parameterIds.map(Number).filter(Number.isInteger)
    : [];

  if (!Number.isInteger(officeId) || !parameterIds.length)
    return NextResponse.json({ error: "An office and at least one test." }, { status: 400 });
  if (toOfficeId !== null && !Number.isInteger(toOfficeId))
    return NextResponse.json({ error: "Where should it go?" }, { status: 400 });

  if (!canEditRouting(actor, officeId))
    return NextResponse.json(
      { error: "Only this office can decide where its own samples are sent." },
      { status: 403 },
    );

  try {
    const r = await setPreference({
      officeId,
      toOfficeId,
      parameterIds,
      note: typeof body.note === "string" ? body.note : null,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
