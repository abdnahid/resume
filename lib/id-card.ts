import { prisma } from "./prisma";
import type {
  DirectorGeneralRecord,
  IdCardBatchRecord,
  IdCardBatchDetail,
  IdCardRecord,
  IdCardAuthorization,
  IdCardBatchStatus,
  IdCardStatus,
} from "./types";
import type {
  DirectorGeneral as DbDirectorGeneral,
  IdCard as DbIdCard,
  Employee as DbEmployee,
  OrgPost as DbOrgPost,
  Posting as DbPosting,
} from "@/generated/prisma/client";

// ─── Date helper (storage format is DD-MM-YYYY, matching the rest of the app) ──

function todayDDMMYYYY(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapDirectorGeneral(dg: DbDirectorGeneral): DirectorGeneralRecord {
  return {
    id: dg.id,
    name: { bn: dg.nameBn, en: dg.nameEn },
    signatureUrl: dg.signatureUrl,
    photoUrl: dg.photoUrl,
    appointedAt: dg.appointedAt,
    relievedAt: dg.relievedAt,
    orderNo: dg.orderNo ?? "",
    orderDate: dg.orderDate ?? "",
    isCurrent: dg.relievedAt === null,
  };
}

type BatchWithMeta = {
  id: number;
  memoNo: string | null;
  status: IdCardBatchStatus;
  requestedAt: string;
  signedDate: string | null;
  directorGeneralId: number;
  directorGeneral: { nameBn: string; nameEn: string };
  createdAt: Date;
  _count: { cards: number };
};

function mapBatch(b: BatchWithMeta): IdCardBatchRecord {
  return {
    id: b.id,
    memoNo: b.memoNo ?? "",
    status: b.status,
    requestedAt: b.requestedAt,
    signedDate: b.signedDate,
    directorGeneralId: b.directorGeneralId,
    dgName: { bn: b.directorGeneral.nameBn, en: b.directorGeneral.nameEn },
    cardCount: b._count.cards,
    createdAt: b.createdAt.toISOString(),
  };
}

type CardWithEmployee = DbIdCard & {
  employee: DbEmployee & {
    office: { nameBn: string };
    postings: (DbPosting & { orgPost: DbOrgPost | null })[];
  };
};

function mapCard(c: CardWithEmployee): IdCardRecord {
  const cp = c.employee.postings[0] ?? null;
  const designation = cp?.orgPost?.nameBn ?? c.employee.designationBn ?? "";
  return {
    id: c.id,
    version: c.version,
    status: c.status as IdCardStatus,
    issueDate: c.issueDate,
    batchId: c.batchId,
    employee: {
      id: c.employee.id,
      name: { bn: c.employee.nameBn, en: c.employee.nameEn },
      designation_bn: designation,
      office_bn: c.employee.office.nameBn,
    },
  };
}

const CARD_EMPLOYEE_INCLUDE = {
  employee: {
    include: {
      office: { select: { nameBn: true } },
      postings: {
        where: { relievedAt: null },
        take: 1,
        include: { orgPost: true },
      },
    },
  },
} as const;

// ─── Director General — reads ──────────────────────────────────────────────────

export async function getCurrentDirectorGeneral(): Promise<DirectorGeneralRecord | null> {
  const dg = await prisma.directorGeneral.findFirst({
    where: { relievedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return dg ? mapDirectorGeneral(dg) : null;
}

export async function getDirectorGenerals(): Promise<DirectorGeneralRecord[]> {
  // Current DG first, then past tenures newest-first.
  const rows = await prisma.directorGeneral.findMany({
    orderBy: [{ relievedAt: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(mapDirectorGeneral);
}

// ─── Director General — mutations ──────────────────────────────────────────────

type AppointDgInput = {
  nameBn: string;
  nameEn: string;
  appointedAt: string;          // DD-MM-YYYY
  signatureUrl?: string | null;
  photoUrl?: string | null;
  orderNo?: string | null;
  orderDate?: string | null;
  previousRelievedAt?: string;  // DD-MM-YYYY; defaults to the new appointedAt
};

// Appoints a new DG: closes the current tenure (relievedAt) and creates the new
// one as current (relievedAt = null), atomically.
export async function appointDirectorGeneral(
  input: AppointDgInput,
): Promise<DirectorGeneralRecord> {
  const created = await prisma.$transaction(async (tx) => {
    const current = await tx.directorGeneral.findFirst({
      where: { relievedAt: null },
    });
    if (current) {
      await tx.directorGeneral.update({
        where: { id: current.id },
        data: { relievedAt: input.previousRelievedAt ?? input.appointedAt },
      });
    }
    return tx.directorGeneral.create({
      data: {
        nameBn: input.nameBn,
        nameEn: input.nameEn,
        appointedAt: input.appointedAt,
        relievedAt: null,
        signatureUrl: input.signatureUrl ?? null,
        photoUrl: input.photoUrl ?? null,
        orderNo: input.orderNo ?? null,
        orderDate: input.orderDate ?? null,
      },
    });
  });
  return mapDirectorGeneral(created);
}

type UpdateDgInput = Partial<{
  nameBn: string;
  nameEn: string;
  appointedAt: string;
  signatureUrl: string | null;
  photoUrl: string | null;
  orderNo: string | null;
  orderDate: string | null;
}>;

// Edits an existing DG's basic info / signature without changing tenure.
export async function updateDirectorGeneral(
  id: number,
  input: UpdateDgInput,
): Promise<DirectorGeneralRecord> {
  const updated = await prisma.directorGeneral.update({
    where: { id },
    data: input,
  });
  return mapDirectorGeneral(updated);
}

// ─── ID card batches — reads ────────────────────────────────────────────────────

export async function getIdCardBatches(): Promise<IdCardBatchRecord[]> {
  const rows = await prisma.idCardBatch.findMany({
    orderBy: { id: "desc" },
    include: {
      directorGeneral: { select: { nameBn: true, nameEn: true } },
      _count: { select: { cards: true } },
    },
  });
  return rows.map(mapBatch);
}

export async function getIdCardBatchById(
  id: number,
): Promise<IdCardBatchDetail | null> {
  const batch = await prisma.idCardBatch.findUnique({
    where: { id },
    include: {
      directorGeneral: { select: { nameBn: true, nameEn: true } },
      _count: { select: { cards: true } },
      cards: {
        orderBy: { id: "asc" },
        include: CARD_EMPLOYEE_INCLUDE,
      },
    },
  });
  if (!batch) return null;
  return { ...mapBatch(batch), cards: batch.cards.map(mapCard) };
}

// The current active card for an employee, with the authorizing DG + issue date,
// for rendering the printable ID card. null if the employee has no issued card.
export async function getActiveIdCard(
  employeeId: string,
): Promise<IdCardAuthorization | null> {
  const card = await prisma.idCard.findFirst({
    where: { employeeId, status: "active" },
    orderBy: { version: "desc" },
    include: {
      batch: { include: { directorGeneral: true } },
    },
  });
  if (!card || !card.issueDate) return null;
  const dg = card.batch.directorGeneral;
  return {
    issueDate: card.issueDate,
    version: card.version,
    dgName: { bn: dg.nameBn, en: dg.nameEn },
    signatureUrl: dg.signatureUrl,
  };
}

// ─── ID card batches — mutations ────────────────────────────────────────────────

type CreateBatchInput = {
  employeeIds: string[];
  memoNo?: string | null;
  requestedAt?: string;  // DD-MM-YYYY; defaults to today
};

// Places an authorization request: a pending batch addressed to the current DG,
// with one pending card per selected employee. Throws if there is no current DG
// or no employees. Returns the created batch summary.
export async function createIdCardBatch(
  input: CreateBatchInput,
): Promise<IdCardBatchRecord> {
  const employeeIds = [...new Set(input.employeeIds)].filter(Boolean);
  if (employeeIds.length === 0) {
    throw new Error("Select at least one employee");
  }

  const currentDg = await prisma.directorGeneral.findFirst({
    where: { relievedAt: null },
  });
  if (!currentDg) {
    throw new Error("No current Director General to authorize the request");
  }

  const created = await prisma.$transaction(async (tx) => {
    const batch = await tx.idCardBatch.create({
      data: {
        memoNo: input.memoNo ?? null,
        status: "pending",
        requestedAt: input.requestedAt ?? todayDDMMYYYY(),
        directorGeneralId: currentDg.id,
      },
    });
    await tx.idCard.createMany({
      data: employeeIds.map((employeeId) => ({
        employeeId,
        batchId: batch.id,
        status: "pending" as const,
      })),
    });
    return tx.idCardBatch.findUniqueOrThrow({
      where: { id: batch.id },
      include: {
        directorGeneral: { select: { nameBn: true, nameEn: true } },
        _count: { select: { cards: true } },
      },
    });
  });
  return mapBatch(created);
}

// Records the DG's signing date and issues the batch: every pending card becomes
// active (issueDate = signedDate, version = prior max + 1), and any previously
// active card for the same employee is superseded. Atomic. Requires the DG to
// have a signature on file.
export async function issueIdCardBatch(
  batchId: number,
  signedDate: string,  // DD-MM-YYYY
): Promise<IdCardBatchRecord> {
  if (!signedDate) throw new Error("Signing date is required");

  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.idCardBatch.findUnique({
      where: { id: batchId },
      include: { directorGeneral: true, cards: true },
    });
    if (!batch) throw new Error("Batch not found");
    if (batch.status === "issued") throw new Error("Batch already issued");
    if (!batch.directorGeneral.signatureUrl) {
      throw new Error("Director General signature is not uploaded yet");
    }

    const pendingCards = batch.cards.filter((c) => c.status === "pending");

    for (const card of pendingCards) {
      // Supersede the employee's current active card, if any.
      await tx.idCard.updateMany({
        where: { employeeId: card.employeeId, status: "active" },
        data: { status: "superseded" },
      });

      // Next version = highest existing version for this employee + 1.
      const latest = await tx.idCard.findFirst({
        where: { employeeId: card.employeeId, id: { not: card.id } },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (latest?.version ?? 0) + 1;

      await tx.idCard.update({
        where: { id: card.id },
        data: { status: "active", issueDate: signedDate, version: nextVersion },
      });
    }

    return tx.idCardBatch.update({
      where: { id: batchId },
      data: { status: "issued", signedDate },
      include: {
        directorGeneral: { select: { nameBn: true, nameEn: true } },
        _count: { select: { cards: true } },
      },
    });
  });
  return mapBatch(result);
}
