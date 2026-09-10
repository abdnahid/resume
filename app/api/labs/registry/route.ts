import { NextResponse } from "next/server";
import { labActor } from "../_actor";
import { canEditRegistry } from "@/lib/labs/access";
import { createLab } from "@/lib/labs/mapping";

/**
 * Record a laboratory the organogram does not know about.
 *
 * Superadmin, for the reason the toggle beside it is: which benches BSTI has is
 * a statement about the institution, and a new one becomes a destination every
 * other office can be told to send samples to. An office that has opened a lab
 * asks for it to be recorded; it does not record it itself.
 */
export async function POST(req: Request) {
  const actor = await labActor();
  if (!canEditRegistry(actor))
    return NextResponse.json({ error: "Not yours to change." }, { status: 403 });

  const body = (await req.json()) as Record<string, unknown>;
  const officeId = Number(body.officeId);
  if (!Number.isInteger(officeId))
    return NextResponse.json({ error: "Which office?" }, { status: 400 });
  if (body.discipline !== "physical" && body.discipline !== "chemical")
    return NextResponse.json({ error: "Physical or chemical." }, { status: 400 });

  try {
    const r = await createLab({
      officeId,
      nameEn: String(body.nameEn ?? ""),
      nameBn: body.nameBn === undefined || body.nameBn === null ? null : String(body.nameBn),
      discipline: body.discipline,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
