import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { updateDirectorGeneral } from "@/lib/id-card";

async function requireSuperadmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return false;
  return (session.user as { role?: string }).role === "superadmin";
}

function normalizeDate(v?: string | null): string | null {
  if (!v) return null;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? `${iso[3]}-${iso[2]}-${iso[1]}` : v;
}

// PATCH /api/director-general/[id] — edit basic info / upload signature
// Body: any subset of { nameBn, nameEn, appointedAt, signatureUrl, photoUrl, orderNo, orderDate }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireSuperadmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseInt((await params).id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.nameBn !== undefined) data.nameBn = body.nameBn;
  if (body.nameEn !== undefined) data.nameEn = body.nameEn;
  if (body.appointedAt !== undefined) data.appointedAt = normalizeDate(body.appointedAt);
  if (body.signatureUrl !== undefined) data.signatureUrl = body.signatureUrl;
  if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl;
  if (body.orderNo !== undefined) data.orderNo = body.orderNo || null;
  if (body.orderDate !== undefined) data.orderDate = normalizeDate(body.orderDate);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const dg = await updateDirectorGeneral(id, data);
    return NextResponse.json(dg);
  } catch (err) {
    console.error("[PATCH /api/director-general/[id]]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 400 },
    );
  }
}
