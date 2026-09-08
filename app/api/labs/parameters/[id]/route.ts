import { NextResponse } from "next/server";
import { labActor } from "../../_actor";
import { canEditCatalogue } from "@/lib/labs/access";
import { updateParameter } from "@/lib/labs/catalogue";

/**
 * Correct one test parameter — its name, fee, limit or method.
 *
 * **Superadmin only.** This is the wing's published fee schedule, and an office
 * that could edit it could reduce what its own applicants pay.
 *
 * A hand-entered urgent fee is stamped `manual` by the service and is then
 * never recomputed over (D99) — which is the whole reason the provenance is a
 * column rather than something inferred from the number.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await labActor();
  if (!canEditCatalogue(actor))
    return NextResponse.json({ error: "The fee schedule is not yours to change." }, { status: 403 });

  const { id } = await params;
  const parameterId = Number(id);
  if (!Number.isInteger(parameterId))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined);

  try {
    await updateParameter({
      parameterId,
      nameEn: typeof body.nameEn === "string" ? body.nameEn : undefined,
      feePoisha: num(body.feePoisha),
      urgentFeePoisha: num(body.urgentFeePoisha),
      limitText: "limitText" in body ? ((body.limitText as string | null) ?? null) : undefined,
      methodId: "methodId" in body ? ((body.methodId as number | null) ?? null) : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
