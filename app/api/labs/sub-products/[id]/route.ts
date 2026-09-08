import { NextResponse } from "next/server";
import { labActor } from "../../_actor";
import { canEditCatalogue } from "@/lib/labs/access";
import { repriceSubProduct, updateSubProduct } from "@/lib/labs/catalogue";

/**
 * The package's turnaround and printed standard.
 *
 * Changing the turnaround re-prices the package in the same call, because
 * whether an urgent service exists at all is decided by the urgent days being
 * shorter (D99). Saving one without the other would leave a package charging a
 * surcharge for a service it no longer offers.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await labActor();
  if (!canEditCatalogue(actor))
    return NextResponse.json({ error: "The fee schedule is not yours to change." }, { status: 403 });

  const { id } = await params;
  const subProductId = Number(id);
  if (!Number.isInteger(subProductId))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const days = (v: unknown) =>
    v === null ? null : typeof v === "number" && v > 0 && v < 400 ? Math.round(v) : undefined;

  try {
    if (body.reprice === true) {
      await repriceSubProduct(subProductId);
      return NextResponse.json({ ok: true });
    }
    await updateSubProduct({
      subProductId,
      turnaroundNormalDays: "turnaroundNormalDays" in body ? days(body.turnaroundNormalDays) : undefined,
      turnaroundUrgentDays: "turnaroundUrgentDays" in body ? days(body.turnaroundUrgentDays) : undefined,
      standardAsPrinted:
        "standardAsPrinted" in body ? ((body.standardAsPrinted as string | null) ?? null) : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
