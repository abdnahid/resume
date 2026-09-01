import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { membershipFor } from "@/lib/cm/applications";
import { addSku, updateSku, removeSku } from "@/lib/cm/skus";
import type { SkuInput } from "@/lib/cm/policy";

/**
 * The articles a licence would cover (D51).
 *
 * Standing on the file is checked here and again in `lib/cm/skus.ts`, which is
 * what every caller goes through — the same layering as `attachBds()`.
 */
async function guard(applicationId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized", status: 401 as const };
  const m = await membershipFor(userId, applicationId);
  if (!m) return { error: "Not found", status: 404 as const };
  if (m.role === "viewer")
    return { error: "You do not have permission to edit this application.", status: 403 as const };
  return { userId };
}

function readSku(body: Record<string, unknown>): SkuInput | null {
  const sizeTypeId = Number(body.sizeTypeId);
  const sizeUnitId = Number(body.sizeUnitId);
  if (!Number.isInteger(sizeTypeId) || !Number.isInteger(sizeUnitId)) return null;
  return {
    brandName: typeof body.brandName === "string" ? body.brandName : "",
    variant: typeof body.variant === "string" ? body.variant : null,
    sizeTypeId,
    sizeUnitId,
    sizeValue:
      body.sizeValue === null || body.sizeValue === undefined || body.sizeValue === ""
        ? null
        : (body.sizeValue as string | number),
    packaging: typeof body.packaging === "string" ? body.packaging : null,
    unitsPerPack:
      body.unitsPerPack === null || body.unitsPerPack === undefined || body.unitsPerPack === ""
        ? null
        : (body.unitsPerPack as string | number),
    grade: typeof body.grade === "string" ? body.grade : null,
  };
}

async function parse(req: Request) {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const g = await guard(id);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await parse(req);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const input = readSku(body);
  if (!input) return NextResponse.json({ error: "Choose a size type and unit." }, { status: 400 });

  try {
    const sku = await addSku(id, input, g.userId);
    return NextResponse.json({ sku: { id: sku.id } });
  } catch (e) {
    // The validation messages are what the applicant needs to read, so they are
    // passed through rather than flattened to "invalid".
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not add that variant." },
      { status: 409 },
    );
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const g = await guard(id);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await parse(req);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const skuId = Number(body.skuId);
  if (!Number.isInteger(skuId))
    return NextResponse.json({ error: "Which variant?" }, { status: 400 });

  const input = readSku(body);
  if (!input) return NextResponse.json({ error: "Choose a size type and unit." }, { status: 400 });

  try {
    await updateSku(id, skuId, input, g.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save that variant." },
      { status: 409 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const g = await guard(id);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await parse(req);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const skuId = Number(body.skuId);
  if (!Number.isInteger(skuId))
    return NextResponse.json({ error: "Which variant?" }, { status: 400 });

  try {
    await removeSku(id, skuId, g.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not remove that variant." },
      { status: 409 },
    );
  }
}
