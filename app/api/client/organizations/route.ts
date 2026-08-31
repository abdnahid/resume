import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { organizationsFor, refreshStatus } from "@/lib/client/organization";

/**
 * A signed-in person's company profiles.
 *
 * Open to any account, internal or client: BSTI staff may browse every client
 * surface and are rendered there as customers (see Auth in CLAUDE.md), and a
 * member of staff applying on their own behalf is an ordinary applicant.
 */

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ? { id: session.user.id, name: session.user.name } : null;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ organizations: await organizationsFor(user.id) });
}

const TYPES = ["standalone", "group_parent", "group_member"] as const;
const LEGAL_FORMS = ["proprietorship", "partnership", "limited", "group_entity"] as const;

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function opt(v: unknown): string | null {
  return text(v) || null;
}

/**
 * Create a profile.
 *
 * Only a name and a type are required — the ladder in §2.1 says never ask for
 * more than the current action needs, and this action is "start a profile".
 * Everything else is filled in over the following steps, and
 * `missingForSubmission()` decides when it is enough to submit.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const type = text(body.type) as (typeof TYPES)[number];
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: "Choose what kind of organisation this is." }, { status: 400 });
  }

  const nameEn = text(body.nameEn);
  const nameBn = text(body.nameBn);
  if (!nameEn && !nameBn) {
    return NextResponse.json({ error: "A company name is required." }, { status: 400 });
  }

  const legalForm = text(body.legalForm);
  if (legalForm && !LEGAL_FORMS.includes(legalForm as (typeof LEGAL_FORMS)[number])) {
    return NextResponse.json({ error: "Unknown company type." }, { status: 400 });
  }

  // ── A member must name its parent, and the parent must be one ────────────
  let parentId: number | null = null;
  if (type === "group_member") {
    const n = Number(body.parentId);
    if (!Number.isInteger(n)) {
      return NextResponse.json(
        { error: "A company under a group must say which group it belongs to." },
        { status: 400 },
      );
    }
    const parent = await prisma.organization.findUnique({
      where: { id: n },
      select: { id: true, type: true, memberships: { where: { userId: user.id } } },
    });
    if (!parent || parent.memberships.length === 0) {
      return NextResponse.json({ error: "Parent organisation not found" }, { status: 404 });
    }
    // Depth is one level (§2.4). Without this a member could be given a member
    // and the group would quietly become a tree.
    if (parent.type !== "group_parent") {
      return NextResponse.json(
        { error: "Only a mother organisation can have companies under it." },
        { status: 409 },
      );
    }
    parentId = parent.id;
  }

  const created = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        type,
        parentId,
        nameEn: nameEn || nameBn,
        nameBn: nameBn || nameEn,
        legalForm: legalForm ? (legalForm as never) : null,
        tradeLicenceNo: opt(body.tradeLicenceNo),
        tradeLicenceAuthority: opt(body.tradeLicenceAuthority),
        tradeLicenceExpiry: opt(body.tradeLicenceExpiry),
        binNo: opt(body.binNo),
        tinNo: opt(body.tinNo),
        addressLine: opt(body.addressLine),
        division: opt(body.division),
        district: opt(body.district),
        upazila: opt(body.upazila),
        postCode: opt(body.postCode),
        repName: opt(body.repName) ?? user.name ?? null,
        repDesignation: opt(body.repDesignation),
        repMobile: opt(body.repMobile),
        repEmail: opt(body.repEmail),
        repNid: opt(body.repNid),
        createdBy: user.id,
      },
    });

    // Whoever creates a profile administers it, and it becomes their default if
    // they had none — otherwise a first-time applicant lands nowhere.
    const existing = await tx.organizationMembership.count({ where: { userId: user.id } });
    await tx.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "org_admin",
        isDefault: existing === 0,
      },
    });
    return org;
  });

  await refreshStatus(created.id);
  return NextResponse.json({ organization: created });
}
