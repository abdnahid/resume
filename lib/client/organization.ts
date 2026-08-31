/**
 * Company profiles — the client-side party registry.
 *
 * Server-only. The Prisma-free half is `lib/client/jurisdiction.ts`.
 */
import { prisma } from "@/lib/prisma";
import { resolveJurisdiction } from "@/lib/client/jurisdiction";

/**
 * What a profile still needs before it may submit an application.
 *
 * The field set is §2.3 of the CM spec and is marked there as an assumption
 * awaiting CM Wing confirmation, which is exactly why it lives in one named
 * function (D8): when the real set arrives, this is the only thing that moves.
 *
 * A draft profile can exist and hold draft applications with far less — the
 * ladder in §2.1 asks for nothing before the moment it is needed.
 */
export type Requirement = { field: string; label: string };

export function missingForSubmission(org: {
  type: string;
  nameEn: string;
  nameBn: string;
  legalForm: string | null;
  tradeLicenceNo: string | null;
  tradeLicenceAuthority: string | null;
  tradeLicenceExpiry: string | null;
  binNo: string | null;
  tinNo: string | null;
  addressLine: string | null;
  division: string | null;
  district: string | null;
  repName: string | null;
  repDesignation: string | null;
  repMobile: string | null;
  repNid: string | null;
  factories: { id: number }[];
}): Requirement[] {
  const missing: Requirement[] = [];

  // A mother organisation never submits an application — its member companies
  // do — so nothing about it gates anything, and listing thirteen "missing"
  // fields against it would be noise the client can never usefully act on.
  // If the CM Wing later requires the parent's papers alongside a member's,
  // that requirement belongs here.
  if (org.type === "group_parent") return missing;

  const need = (v: unknown, field: string, label: string) => {
    if (!v || String(v).trim() === "") missing.push({ field, label });
  };

  need(org.nameEn, "nameEn", "Legal name (English)");
  need(org.nameBn, "nameBn", "Legal name (Bangla)");
  need(org.legalForm, "legalForm", "Company type");
  need(org.tradeLicenceNo, "tradeLicenceNo", "Trade licence number");
  need(org.tradeLicenceAuthority, "tradeLicenceAuthority", "Trade licence issuing authority");
  need(org.tradeLicenceExpiry, "tradeLicenceExpiry", "Trade licence expiry");
  need(org.binNo, "binNo", "BIN / VAT registration");
  need(org.tinNo, "tinNo", "TIN");
  need(org.addressLine, "addressLine", "Registered office address");
  need(org.division, "division", "Division");
  need(org.district, "district", "District");
  need(org.repName, "repName", "Authorised representative — name");
  need(org.repDesignation, "repDesignation", "Authorised representative — designation");
  need(org.repMobile, "repMobile", "Authorised representative — mobile");
  need(org.repNid, "repNid", "Authorised representative — NID");

  if (org.factories.length === 0) {
    missing.push({ field: "factories", label: "At least one factory" });
  }
  return missing;
}

/** Only an entity may hold a licence — the parent is administrative (§2.4). */
export function canApply(type: string): boolean {
  return type !== "group_parent";
}

// ─── Reads ───────────────────────────────────────────────────────────────────

const ORG_INCLUDE = {
  factories: {
    include: { bstiOffice: { select: { id: true, nameEn: true, nameBn: true } } },
    orderBy: { id: "asc" as const },
  },
  documents: true,
  parent: { select: { id: true, nameEn: true, nameBn: true } },
  members: { select: { id: true, nameEn: true, nameBn: true, status: true } },
};

/** Every organization this user may act for, with their role in each. */
export async function organizationsFor(userId: string) {
  const memberships = await prisma.organizationMembership.findMany({
    where: { userId },
    include: { organization: { include: ORG_INCLUDE } },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
  });

  return memberships.map((m) => {
    const org = m.organization;
    const missing = missingForSubmission(org);
    return {
      id: org.id,
      type: org.type as string,
      status: org.status as string,
      nameEn: org.nameEn,
      nameBn: org.nameBn,
      role: m.role as string,
      isDefault: m.isDefault,
      canApply: canApply(org.type),
      missing,
      /** A profile is complete when nothing on the mandatory set is absent. */
      isComplete: missing.length === 0,
      parent: org.parent,
      members: org.members,
      factories: org.factories.map((f) => ({
        id: f.id,
        nameEn: f.nameEn,
        nameBn: f.nameBn,
        district: f.district,
        office: f.bstiOffice,
      })),
      documentCount: org.documents.length,
    };
  });
}

export type ClientOrganization = Awaited<ReturnType<typeof organizationsFor>>[number];

/**
 * Recompute and store `status`, so a profile that has just been completed stops
 * being treated as a draft. Called after any write that could change it.
 */
export async function refreshStatus(organizationId: number) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { factories: { select: { id: true } } },
  });
  if (!org || org.status === "archived") return;

  const complete = missingForSubmission(org).length === 0;
  const next = complete ? "complete" : "draft";
  if (org.status !== next) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: next },
    });
  }
  return next;
}

/**
 * Work out and store which BSTI office a factory belongs to.
 *
 * Stored rather than computed at application time: a jurisdiction redrawn later
 * must not silently re-route files already in flight.
 */
export async function assignJurisdiction(factoryId: number) {
  const [factory, offices] = await Promise.all([
    prisma.factory.findUnique({ where: { id: factoryId } }),
    prisma.office.findMany({ select: { id: true, nameEn: true, nameBn: true, type: true } }),
  ]);
  if (!factory) return null;

  const j = resolveJurisdiction(offices, factory.district);
  if (!j) return null;

  await prisma.factory.update({
    where: { id: factoryId },
    data: { bstiOfficeId: j.officeId },
  });
  return j;
}
