/**
 * The internal side of a licence application — server half (D9).
 *
 * A submitted file lands in an office. Its head picks it up, then it moves down
 * the organogram for processing and back up when that is done. This is the
 * first slice of the Phase D workflow engine, and it is kept generic where that
 * costs nothing: `holderEmployeeId` and `ApplicationMovement` say nothing about
 * CM, so the next service that needs a file to move can use them.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { employeesOfOffice } from "@/lib/salary/payroll";
import { eligibleDesks, rank, type Desk, type Direction } from "./chain";

/** Roles that may act on a file at all. */
export type WorkflowActor = {
  userId: string;
  role: string;
  employeeId: string | null;
  officeId: number | null;
};

/**
 * Turn the signed-in viewer into an actor, resolving which office they sit in.
 *
 * The **current posting** decides, with `Employee.officeId` as the fallback —
 * the same rule `employeesOfOffice()` uses, and for the same reason: a transfer
 * is recorded as a posting and the legacy column can be left behind. If the two
 * disagreed here, an office head would see one office's inbox while counting as
 * staff of another.
 */
export async function actorFor(viewer: {
  id: string;
  role: string;
  employeeId: string | null;
}): Promise<WorkflowActor> {
  if (!viewer.employeeId) {
    return { userId: viewer.id, role: viewer.role, employeeId: null, officeId: null };
  }
  const e = await prisma.employee.findUnique({
    where: { id: viewer.employeeId },
    select: {
      officeId: true,
      postings: { where: { relievedAt: null }, select: { officeId: true }, take: 1 },
    },
  });
  return {
    userId: viewer.id,
    role: viewer.role,
    employeeId: viewer.employeeId,
    officeId: e?.postings[0]?.officeId ?? e?.officeId ?? null,
  };
}

/**
 * The office whose inbox this user sees, or null if they have no inbox.
 *
 * A superadmin sees every office and must name one; an office head sees exactly
 * their own. Nobody else has an inbox — holding a file is separate, and is
 * decided by `holderEmployeeId`, not by role.
 */
export async function inboxScope(actor: WorkflowActor): Promise<{
  officeId: number | null;
  pinned: boolean;
} | null> {
  if (actor.role === "superadmin") return { officeId: null, pinned: false };
  if (actor.role === "office_head") {
    if (!actor.officeId) return null;
    return { officeId: actor.officeId, pinned: true };
  }
  return null;
}

/**
 * The section a desk belongs to — the wing or branch its unit hangs under.
 *
 * Walks up from the employee's unit to the nearest `wing`, `regional` or
 * `divisional` ancestor, because those are the units that mean "a part of BSTI
 * that runs its own files". A Director sits in the Executive *unit* of their
 * branch while the officers who do the work sit in sibling units, so comparing
 * units directly would put the head of a section outside it.
 */
async function sectionRoots(): Promise<Map<number, number>> {
  const units = await prisma.orgUnit.findMany({
    select: { id: true, parentId: true, category: true },
  });
  const byId = new Map(units.map((u) => [u.id, u]));
  const cache = new Map<number, number>();

  for (const u of units) {
    let cur: (typeof units)[number] | undefined = u;
    const seen = new Set<number>();
    while (cur && !["wing", "regional", "divisional"].includes(cur.category)) {
      if (seen.has(cur.id)) break; // a cycle in the tree must not hang the page
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    cache.set(u.id, cur?.id ?? u.id);
  }
  return cache;
}

const gradeOf = (g: string | null | undefined): number | null => {
  const n = Number(g);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Where a desk's unit and grade actually come from.
 *
 * **Not from the posting.** `Posting` carries the office and the grade but its
 * `orgPostId` is null on every row — the organogram link lives on
 * `Employee.orgPostId`, which is set for 439 of 624. Reading the posting's
 * org post therefore gave every desk a null section and no chain at all.
 *
 * **Grade is the person's, not the post's.** They differ in real data: an
 * employee on grade 9 may sit on a post graded 11. Seniority between officers
 * follows the officer, so `Employee.grade` wins and the post's grade is only a
 * fallback for someone whose own grade is not recorded.
 */
const EMPLOYEE_DESK_SELECT = {
  id: true,
  nameEn: true,
  designationEn: true,
  grade: true,
  orgPost: { select: { grade: true, unitId: true } },
} satisfies Prisma.EmployeeSelect;

type EmployeeDeskRow = {
  id: string;
  nameEn: string;
  designationEn: string | null;
  grade: string | null;
  orgPost: { grade: string | null; unitId: number } | null;
};

function toDesk(e: EmployeeDeskRow, roots: Map<number, number>): Desk {
  const unitId = e.orgPost?.unitId ?? null;
  return {
    employeeId: e.id,
    name: e.nameEn,
    designation: e.designationEn,
    grade: gradeOf(e.grade ?? e.orgPost?.grade),
    sectionUnitId: unitId === null ? null : (roots.get(unitId) ?? unitId),
  };
}

/** Every desk in an office, as the chain rules want them. */
export async function desksOfOffice(officeId: number): Promise<Desk[]> {
  // Sequential, not Promise.all: the pg adapter runs both on one client and
  // warns that concurrent queries on a busy client are deprecated. Two small
  // reads cost nothing to serialise.
  const roots = await sectionRoots();
  const employees = await prisma.employee.findMany({
    where: employeesOfOffice(officeId),
    select: EMPLOYEE_DESK_SELECT,
  });
  return employees.map((e) => toDesk(e, roots));
}

/** The desk one employee occupies. */
export async function deskOf(employeeId: string): Promise<Desk | null> {
  const roots = await sectionRoots();
  const e = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: EMPLOYEE_DESK_SELECT,
  });
  return e ? toDesk(e, roots) : null;
}

/**
 * Who this desk may hand the file to, in one direction.
 *
 * `asHead` exists because office head is a **role, not a designation**: when the
 * senior desk is vacant a more junior officer acts in it, and by grade alone
 * they could not pass a file to the DD sitting above them. Holding the role
 * makes them the top of their section for as long as they hold it, so they may
 * pass down to anyone in it — and, being the top, have nobody above them.
 */
export async function candidates(
  employeeId: string,
  officeId: number,
  direction: Direction,
  opts: { asHead?: boolean } = {},
): Promise<Desk[]> {
  // The sender is in the same office, so one query answers both. Fetching the
  // desk separately meant two concurrent reads of the whole OrgUnit tree.
  const all = await desksOfOffice(officeId);
  const sender = all.find((d) => d.employeeId === employeeId);
  if (!sender) return [];

  if (opts.asHead) {
    if (direction === "up") return [];
    return all
      .filter(
        (d) =>
          d.employeeId !== sender.employeeId &&
          d.sectionUnitId !== null &&
          d.sectionUnitId === sender.sectionUnitId,
      )
      .sort((a, b) => rank(a.grade) - rank(b.grade) || a.name.localeCompare(b.name));
  }
  return eligibleDesks(sender, all, direction);
}

const LIST_SELECT = {
  id: true,
  applicationNo: true,
  state: true,
  submittedAt: true,
  holderEmployeeId: true,
  holder: { select: { id: true, nameEn: true, designationEn: true } },
  organization: { select: { nameEn: true } },
  factory: { select: { nameEn: true, district: true } },
  product: { select: { serial: true, nameEn: true } },
  bstiOffice: { select: { id: true, nameEn: true, nameBn: true } },
  _count: { select: { subProducts: true } },
} satisfies Prisma.ApplicationSelect;

/**
 * Files waiting to be picked up in an office — submitted, and held by nobody.
 *
 * "Nobody holds it" is the definition of an unclaimed file, rather than a state
 * of its own: the state machine already says `submitted`, and adding a parallel
 * `unclaimed` state would be two facts that can disagree.
 */
export async function unclaimed(officeId: number | null) {
  return prisma.application.findMany({
    where: {
      state: "submitted",
      holderEmployeeId: null,
      ...(officeId ? { bstiOfficeId: officeId } : {}),
    },
    select: LIST_SELECT,
    orderBy: { submittedAt: "asc" },
  });
}

/** Files in this office that somebody is already working on. */
export async function inProgress(officeId: number | null) {
  return prisma.application.findMany({
    where: {
      holderEmployeeId: { not: null },
      ...(officeId ? { bstiOfficeId: officeId } : {}),
    },
    select: LIST_SELECT,
    orderBy: { updatedAt: "desc" },
  });
}

/** The files this particular desk is holding. */
export async function heldBy(employeeId: string) {
  return prisma.application.findMany({
    where: { holderEmployeeId: employeeId },
    select: LIST_SELECT,
    orderBy: { updatedAt: "desc" },
  });
}

export async function movementsFor(applicationId: number) {
  return prisma.applicationMovement.findMany({
    where: { applicationId },
    include: {
      fromEmployee: { select: { nameEn: true, designationEn: true } },
      toEmployee: { select: { nameEn: true, designationEn: true } },
    },
    orderBy: { id: "asc" },
  });
}

/**
 * The office head takes an unclaimed file.
 *
 * Guarded on `holderEmployeeId: null` inside the update itself, so two heads
 * clicking at once produce one winner rather than two receipts — the same
 * conditional-update lock the BDS attachment rule uses.
 */
export async function receive(applicationId: number, actor: WorkflowActor) {
  if (!actor.employeeId) throw new Error("Only a member of staff can receive a file.");
  const scope = await inboxScope(actor);
  if (!scope) throw new Error("You do not receive applications.");

  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { state: true, bstiOfficeId: true },
  });
  if (app.state !== "submitted") throw new Error("This file is not waiting to be received.");
  if (scope.pinned && app.bstiOfficeId !== scope.officeId) {
    throw new Error("That file belongs to another office.");
  }

  const claimed = await prisma.application.updateMany({
    where: { id: applicationId, holderEmployeeId: null },
    data: { holderEmployeeId: actor.employeeId },
  });
  if (claimed.count === 0) throw new Error("Someone in your office has already picked this up.");

  await prisma.applicationMovement.create({
    data: {
      applicationId,
      toEmployeeId: actor.employeeId,
      direction: "receive",
      actorUserId: actor.userId,
    },
  });
  return prisma.application.findUnique({ where: { id: applicationId }, select: LIST_SELECT });
}

/**
 * Hand the file on, down the chain or back up it.
 *
 * The holder is the only person who can move it, superadmin aside — a file that
 * anyone could redirect is not a file anyone can be accountable for. The target
 * is re-checked against `canPassTo()` here rather than trusted from the form,
 * because the picker is a convenience and not the rule.
 */
export async function pass(
  applicationId: number,
  toEmployeeId: string,
  direction: Direction,
  note: string | null,
  actor: WorkflowActor,
) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { holderEmployeeId: true, bstiOfficeId: true, state: true },
  });
  if (!app.holderEmployeeId) throw new Error("Nobody is holding this file yet.");
  if (!app.bstiOfficeId) throw new Error("This file has no office.");

  const isHolder = actor.employeeId === app.holderEmployeeId;
  if (!isHolder && actor.role !== "superadmin") {
    throw new Error("Only whoever is holding this file can pass it on.");
  }

  const asHead = actor.role === "office_head" && actor.employeeId === app.holderEmployeeId;
  const allowed = await candidates(app.holderEmployeeId, app.bstiOfficeId, direction, { asHead });
  const target = allowed.find((d) => d.employeeId === toEmployeeId);
  if (!target) {
    throw new Error(
      direction === "down"
        ? "You can only pass a file to a more junior desk in your own section."
        : "You can only send a file up to a more senior desk in your own section.",
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.application.update({
      where: { id: applicationId },
      data: { holderEmployeeId: toEmployeeId },
      select: LIST_SELECT,
    }),
    prisma.applicationMovement.create({
      data: {
        applicationId,
        fromEmployeeId: app.holderEmployeeId,
        toEmployeeId,
        direction,
        note: note?.trim() || null,
        actorUserId: actor.userId,
      },
    }),
  ]);
  return updated;
}
