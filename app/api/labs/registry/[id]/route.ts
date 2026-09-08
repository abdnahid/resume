import { NextResponse } from "next/server";
import { labActor } from "../../_actor";
import { canEditRegistry } from "@/lib/labs/access";
import { setLabActive } from "@/lib/labs/mapping";

/**
 * Open or close a laboratory.
 *
 * Superadmin, because closing one redirects nothing and refuses everything: an
 * office still routing there finds out when the field officer tries to seal
 * jars. That is a statement about the institution rather than about one
 * office's arrangements.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await labActor();
  if (!canEditRegistry(actor))
    return NextResponse.json({ error: "Not yours to change." }, { status: 403 });

  const { id } = await params;
  const labId = Number(id);
  if (!Number.isInteger(labId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  try {
    const r = await setLabActive(labId, body.isActive === true);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
