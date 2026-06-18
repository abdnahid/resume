import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  getDirectorGenerals,
  appointDirectorGeneral,
} from "@/lib/id-card";

async function requireSuperadmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return false;
  return (session.user as { role?: string }).role === "superadmin";
}

// <input type="date"> gives YYYY-MM-DD; storage format is DD-MM-YYYY. Text inputs
// already in DD-MM-YYYY pass through unchanged.
function normalizeDate(v?: string | null): string | null {
  if (!v) return null;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? `${iso[3]}-${iso[2]}-${iso[1]}` : v;
}

// GET /api/director-general — tenure history (current first)
export async function GET() {
  if (!(await requireSuperadmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(await getDirectorGenerals());
}

// POST /api/director-general — appoint a new DG (closes the prior tenure)
// Body: { nameBn, nameEn, appointedAt, signatureUrl?, photoUrl?, orderNo?, orderDate?, previousRelievedAt? }
export async function POST(req: Request) {
  if (!(await requireSuperadmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { nameBn, nameEn, appointedAt } = body;
  if (!nameBn || !nameEn || !appointedAt) {
    return NextResponse.json(
      { error: "nameBn, nameEn and appointedAt are required" },
      { status: 400 },
    );
  }

  try {
    const dg = await appointDirectorGeneral({
      nameBn,
      nameEn,
      appointedAt: normalizeDate(appointedAt)!,
      signatureUrl: body.signatureUrl ?? null,
      photoUrl: body.photoUrl ?? null,
      orderNo: body.orderNo ?? null,
      orderDate: normalizeDate(body.orderDate),
      previousRelievedAt: normalizeDate(body.previousRelievedAt) ?? undefined,
    });
    return NextResponse.json(dg, { status: 201 });
  } catch (err) {
    console.error("[POST /api/director-general]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 400 },
    );
  }
}
