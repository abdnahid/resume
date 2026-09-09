import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { labActor } from "../_actor";
import { canEditCapability } from "@/lib/labs/access";
import { dropCapability, setCapability } from "@/lib/labs/mapping";

/**
 * Record — or withdraw — what a laboratory can run.
 *
 * Its own office decides, because only the lab knows: an instrument out of
 * service or an unfilled bench is not a fact head office can find out. The
 * lab's office is looked up here rather than taken from the request, since the
 * request is what is being authorised.
 *
 * Withdrawing does not repoint the offices that route here. It leaves their
 * rows failing the check in `resolveDestinations()`, which surfaces by name on
 * the sampling screen — silently moving somebody else's samples would be worse
 * than telling them.
 */
export async function POST(req: Request) {
  const actor = await labActor();
  const body = (await req.json()) as Record<string, unknown>;

  // The office may be named directly, or reached through one of its labs —
  // the registry screen works from a bench, the coverage form from the office.
  let officeId = Number(body.officeId);
  if (!Number.isInteger(officeId)) {
    const lab = await prisma.lab.findUnique({
      where: { id: Number(body.labId) }, select: { officeId: true },
    });
    if (!lab) return NextResponse.json({ error: "Not found" }, { status: 404 });
    officeId = lab.officeId;
  }
  const parameterIds = Array.isArray(body.parameterIds)
    ? body.parameterIds.map(Number).filter(Number.isInteger)
    : [];
  if (!parameterIds.length)
    return NextResponse.json({ error: "At least one test." }, { status: 400 });

  if (!canEditCapability(actor, officeId))
    return NextResponse.json(
      { error: "Only this office records what it can test." },
      { status: 403 },
    );

  try {
    if (body.isActive === false) {
      const r = await dropCapability(officeId, parameterIds);
      return NextResponse.json({ ok: true, ...r });
    }
    const r = await setCapability({
      officeId, parameterIds,
      manner: body.manner === "third_party" ? "third_party" : "in_house",
      employeeId: actor.employeeId,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
