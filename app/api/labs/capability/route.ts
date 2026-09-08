import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { labActor } from "../_actor";
import { canEditCapability } from "@/lib/labs/access";
import { setCapability } from "@/lib/labs/mapping";

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

  const labId = Number(body.labId);
  const parameterIds = Array.isArray(body.parameterIds)
    ? body.parameterIds.map(Number).filter(Number.isInteger)
    : [];
  if (!Number.isInteger(labId) || !parameterIds.length)
    return NextResponse.json({ error: "A laboratory and at least one test." }, { status: 400 });

  const lab = await prisma.lab.findUnique({ where: { id: labId }, select: { officeId: true } });
  if (!lab) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditCapability(actor, lab.officeId))
    return NextResponse.json(
      { error: "Only this laboratory's own office records what it can run." },
      { status: 403 },
    );

  try {
    const r = await setCapability({ labId, parameterIds, isActive: body.isActive !== false });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
