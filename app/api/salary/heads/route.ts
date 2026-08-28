import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSalaryHeads } from "@/lib/salary/queries";
import { parseHeadBody, requireSuperadmin } from "@/lib/salary/heads";

/**
 * The salary head catalogue — the allowances and deductions that can be
 * attached to a fixation.
 *
 * Reading is open to any internal user (the fixation form needs it); creating
 * and editing is superadmin only. The gate and the payload validation live in
 * `lib/salary/heads.ts`, because a Next route module may only export route
 * handlers.
 */

// ─── GET: the catalogue ─────────────────────────────────────────────────────

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (
    !session ||
    (session.user as { accountType?: string }).accountType !== "INTERNAL"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeOnly = new URL(req.url).searchParams.get("activeOnly") === "1";
  return NextResponse.json({ heads: await getSalaryHeads({ activeOnly }) });
}

// ─── POST: create a head ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const g = await requireSuperadmin();
  if (!g.ok) return g.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = parseHeadBody(body, { requireCode: true });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existing = await prisma.salaryHead.findUnique({
    where: { code: parsed.data.code! },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `A head with code ${parsed.data.code} already exists.` },
      { status: 409 },
    );
  }

  const head = await prisma.salaryHead.create({
    data: parsed.data as typeof parsed.data & { code: string },
  });
  return NextResponse.json({ head });
}
