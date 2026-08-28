import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseHeadBody, requireSuperadmin } from "@/lib/salary/heads";

/**
 * Edit or remove one salary head.
 *
 * `code` is not editable — it is the natural key that past fixation lines are
 * read back through. Rename the labels instead.
 */

async function headId(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const g = await requireSuperadmin();
  if (!g.ok) return g.response;

  const id = await headId(context);
  if (id === null) {
    return NextResponse.json({ error: "Invalid head id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const existing = await prisma.salaryHead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Head not found" }, { status: 404 });
  }

  const parsed = parseHeadBody(body, { requireCode: false });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Changing the basis of a head already used on fixations would make those
  // saved lines unreadable against their own head. The lines snapshot their
  // basis, so the history stays correct — but the mismatch is confusing enough
  // to be worth refusing outright.
  if (parsed.data.basis !== existing.basis) {
    const used = await prisma.salaryFixationItem.count({ where: { headId: id } });
    if (used > 0) {
      return NextResponse.json(
        {
          error: `This head is used on ${used} fixation line(s), so how it is calculated can no longer change. Retire it and create a replacement instead.`,
        },
        { status: 409 },
      );
    }
  }

  const head = await prisma.salaryHead.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ head });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const g = await requireSuperadmin();
  if (!g.ok) return g.response;

  const id = await headId(context);
  if (id === null) {
    return NextResponse.json({ error: "Invalid head id" }, { status: 400 });
  }

  // A head named by a saved fixation is never deleted — that would leave the
  // line pointing at nothing. Retiring it (`isActive: false`) keeps the history
  // readable while removing it from new fixations.
  const used = await prisma.salaryFixationItem.count({ where: { headId: id } });
  if (used > 0) {
    return NextResponse.json(
      {
        error: `This head is used on ${used} fixation line(s) and cannot be deleted. Set it inactive to stop offering it on new fixations.`,
      },
      { status: 409 },
    );
  }

  await prisma.salaryHead.delete({ where: { id } });
  return NextResponse.json({ deleted: id });
}
