/**
 * What `/s/<ref>` answers, and to whom.
 *
 * **The same jar, two answers.** A QR decodes without a session, so the token
 * printed on a specimen is readable by everyone who handles it. What protects
 * the applicant is not the string — it is that resolving it returns different
 * things depending on who is asking. The cut lives here.
 *
 * The gate is **role and relationship**, never role alone: a CM officer in
 * Dhaka has no business reading a Barisal file, and an examiner in one lab has
 * none reading another lab's bench.
 */
import { prisma } from "@/lib/prisma";

export type LabView = {
  side: "lab";
  labCode: string;
  specimenNo: number;
  state: string;
  subProduct: { nameEn: string; nameBn: string | null; standardAsPrinted: string | null };
  order: { code: string; isUrgent: boolean; dueOn: Date | null; state: string };
  /** Only the parameters this lab runs. Another lab's are not its business. */
  parameters: {
    id: number;
    nameEn: string;
    method: string | null;
    limitText: string | null;
    limitKind: string;
    subParameters: { id: number; label: string; limitText: string | null; limitKind: string }[];
  }[];
};

export type CmView = {
  side: "cm";
  cmCode: string;
  application: { id: number; applicationNo: string | null; state: string };
  organizationName: string;
  subProduct: string;
  sku: { brandName: string; variant: string | null; grade: string | null };
  consignment: { code: string; sealNo: string; state: string; labName: string };
  sampleState: string;
};

export type Resolution =
  | { ok: true; view: LabView }
  | { ok: true; view: CmView }
  | { ok: false; reason: "not_found" | "not_permitted" };

/**
 * A refusal is identical whether the token exists or not.
 *
 * Otherwise the response is an oracle: someone with a photographed label could
 * learn which tokens are live by watching 404 turn into 403.
 */
const refuse = (): Resolution => ({ ok: false, reason: "not_found" });

export async function resolveRef(ref: string, viewer: {
  userId: string;
  employeeId: string | null;
  role: string;
}): Promise<Resolution> {
  const sample = await prisma.sample.findUnique({
    where: { ref },
    select: {
      id: true,
      labCode: true,
      specimenNo: true,
      state: true,
      labTestOrder: {
        select: {
          id: true, code: true, isUrgent: true, dueOn: true, state: true, labId: true,
          holderEmployeeId: true,
          subProduct: { select: { nameEn: true, nameBn: true, standardAsPrinted: true } },
          items: {
            orderBy: { sortOrder: "asc" },
            select: {
              parameter: {
                select: {
                  id: true, nameEn: true, limitText: true, limitKind: true,
                  method: { select: { designation: true } },
                  subParameters: {
                    orderBy: { ordinal: "asc" },
                    select: { id: true, label: true, limitText: true, limitKind: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!sample) return refuse();

  // ── Testing side ────────────────────────────────────────────────────────────
  // Nothing in this branch touches SampleRegistration, so there is no path from
  // here to the applicant even if someone adds a careless `include` later.
  if (viewer.employeeId) {
    const inLab = await prisma.posting.findFirst({
      where: {
        employeeId: viewer.employeeId,
        status: "active",
        office: { labs: { some: { id: sample.labTestOrder.labId } } },
      },
      select: { id: true },
    });
    const holder = sample.labTestOrder.holderEmployeeId === viewer.employeeId;
    if (inLab || holder) {
      return {
        ok: true,
        view: {
          side: "lab",
          labCode: sample.labCode,
          specimenNo: sample.specimenNo,
          state: sample.state,
          subProduct: sample.labTestOrder.subProduct,
          order: {
            code: sample.labTestOrder.code,
            isUrgent: sample.labTestOrder.isUrgent,
            dueOn: sample.labTestOrder.dueOn,
            state: sample.labTestOrder.state,
          },
          parameters: sample.labTestOrder.items.map((i) => ({
            id: i.parameter.id,
            nameEn: i.parameter.nameEn,
            method: i.parameter.method?.designation ?? null,
            limitText: i.parameter.limitText,
            limitKind: i.parameter.limitKind,
            subParameters: i.parameter.subParameters,
          })),
        },
      };
    }
  }

  // ── CM side ─────────────────────────────────────────────────────────────────
  const reg = await prisma.sampleRegistration.findUnique({
    where: { sampleId: sample.id },
    select: {
      cmCode: true,
      applicationSku: { select: { brandName: true, variant: true, grade: true } },
      applicationSubProduct: {
        select: {
          subProduct: { select: { nameEn: true } },
          application: {
            select: {
              id: true, applicationNo: true, state: true, bstiOfficeId: true,
              holderEmployeeId: true,
              organization: { select: { nameEn: true } },
              movements: { select: { toEmployeeId: true } },
            },
          },
        },
      },
      consignment: {
        select: { code: true, sealNo: true, state: true, lab: { select: { nameEn: true } } },
      },
    },
  });
  if (!reg) return refuse();

  const app = reg.applicationSubProduct.application;
  const permitted =
    viewer.role === "superadmin" ||
    (viewer.employeeId !== null &&
      (app.holderEmployeeId === viewer.employeeId ||
        app.movements.some((m) => m.toEmployeeId === viewer.employeeId) ||
        (await inReceivingOffice(viewer.employeeId, app.bstiOfficeId))));

  if (!permitted) return refuse();

  return {
    ok: true,
    view: {
      side: "cm",
      cmCode: reg.cmCode,
      application: { id: app.id, applicationNo: app.applicationNo, state: app.state },
      organizationName: app.organization.nameEn,
      subProduct: reg.applicationSubProduct.subProduct.nameEn,
      sku: reg.applicationSku,
      consignment: {
        code: reg.consignment.code,
        sealNo: reg.consignment.sealNo,
        state: reg.consignment.state,
        labName: reg.consignment.lab.nameEn,
      },
      sampleState: sample.state,
    },
  };
}

/** Posted to the office that received the file. */
async function inReceivingOffice(employeeId: string, officeId: number | null) {
  if (officeId === null) return false;
  const p = await prisma.posting.findFirst({
    where: { employeeId, officeId, status: "active" },
    select: { id: true },
  });
  return p !== null;
}
