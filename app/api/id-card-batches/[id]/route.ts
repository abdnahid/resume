import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getIdCardBatchById, issueIdCardBatch } from "@/lib/id-card";

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

// GET /api/id-card-batches/[id] — batch detail with its employee cards
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireSuperadmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseInt((await params).id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const batch = await getIdCardBatchById(id);
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }
  return NextResponse.json(batch);
}

// PATCH /api/id-card-batches/[id] — record the DG's signing date and issue the
// batch (activates cards, supersedes prior ones).
// Body: { signedDate }
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
  const signedDate = normalizeDate(body.signedDate);
  if (!signedDate) {
    return NextResponse.json({ error: "signedDate is required" }, { status: 400 });
  }

  try {
    const batch = await issueIdCardBatch(id, signedDate);
    return NextResponse.json(batch);
  } catch (err) {
    console.error("[PATCH /api/id-card-batches/[id]]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.toLowerCase().includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
