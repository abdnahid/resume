import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getIdCardBatches, createIdCardBatch } from "@/lib/id-card";

async function requireSuperadmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return false;
  return (session.user as { role?: string }).role === "superadmin";
}

// GET /api/id-card-batches — all authorization batches (newest first)
export async function GET() {
  if (!(await requireSuperadmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(await getIdCardBatches());
}

// POST /api/id-card-batches — place an authorization request for a set of
// employees (also used for regeneration: a single employee whose data changed).
// Body: { employeeIds: string[], memoNo? }
export async function POST(req: Request) {
  if (!(await requireSuperadmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!Array.isArray(body.employeeIds) || body.employeeIds.length === 0) {
    return NextResponse.json(
      { error: "employeeIds must be a non-empty array" },
      { status: 400 },
    );
  }

  try {
    const batch = await createIdCardBatch({
      employeeIds: body.employeeIds,
      memoNo: body.memoNo ?? null,
    });
    return NextResponse.json(batch, { status: 201 });
  } catch (err) {
    console.error("[POST /api/id-card-batches]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 400 },
    );
  }
}
