import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { membershipFor } from "@/lib/cm/applications";
import { addSubProduct, removeSubProduct } from "@/lib/cm/sub-products";

/**
 * The sub-products a licence is applied for (D67).
 *
 * The applicant picks the product, then which of its sub-products they actually
 * make. That choice resolves the test plan and therefore the test fee, so it
 * belongs on the form rather than waiting for the FDO's inspection.
 *
 * Standing is checked here and again in `lib/cm/sub-products.ts`, which every
 * caller goes through — the same layering as the SKU and BDS routes.
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

async function body(req: Request) {
  return (await req.json().catch(() => null)) as Record<string, unknown> | null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const g = await guard(id);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const b = await body(req);
  const subProductId = Number(b?.subProductId);
  if (!Number.isInteger(subProductId))
    return NextResponse.json({ error: "Choose a sub-product." }, { status: 400 });

  try {
    const row = await addSubProduct({ applicationId: id, subProductId, userId: g.userId });
    return NextResponse.json({ subProduct: { id: row.id } });
  } catch (e) {
    // The service's messages are what the applicant needs to read — that the
    // sub-product belongs to another product, for instance — so they pass
    // through rather than being flattened.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not add that sub-product." },
      { status: 400 },
    );
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const g = await guard(id);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const b = await body(req);
  const applicationSubProductId = Number(b?.applicationSubProductId);
  if (!Number.isInteger(applicationSubProductId))
    return NextResponse.json({ error: "Which sub-product?" }, { status: 400 });

  try {
    await removeSubProduct({ applicationId: id, applicationSubProductId, userId: g.userId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not remove that sub-product." },
      { status: 400 },
    );
  }
}
