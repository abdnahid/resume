import { prisma } from "./prisma";
import { employeesOfOffice } from "./salary/payroll";
import type {
  Employee,
  EmployeeRecord,
  OrgInfo,
  SalaryProcessRecord,
  SalaryProcessMonth,
  BankAdviceRecord,
  BankAdviceEntry,
  FixationRecord,
  SalaryStatus,
  PostingStatus,
  AddressBlock,
  SalaryHistoryRow,
  WorkHistoryRow,
  EducationRow,
  PromotionRow,
  TrainingRow,
  ForeignTrainingRow,
  PublicationRow,
  AwardRow,
} from "./types";
import type {
  Employee as DbEmployee,
  Office as DbOffice,
  OrgPost,
  OrgUnit,
  Posting,
  SalaryFixation,
  SalaryHistory,
  WorkHistory,
  Education,
  Promotion,
  Training,
  ForeignTraining,
  Publication,
  Award,
  Address,
} from "@/generated/prisma/client";

// ─── Fixed organisational info (head office) ──────────────────────────────────

export const ORG: OrgInfo = {
  header_lines_bn: [
    "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার",
    "শিল্প মন্ত্রণালয়",
    "বাংলাদেশ স্ট্যান্ডার্ডস অ্যান্ড টেস্টিং ইনস্টিটিউশন",
  ],
  address_bn: "মান ভবন, ১১৬/ক, তেজগাঁও শিল্প এলাকা, ঢাকা-১২০৮",
  website: "www.bsti.gov.bd",
  email: "dg@bsti.gov.bd",
  hotline: "16126",
};

/**
 * The letterhead for a document issued by one office, rather than by BSTI as a
 * whole — its own name, address and email, with the national hotline kept.
 *
 * A salary slip printed in Barishal that carried the Dhaka address would be
 * wrong on its face.
 */
export function orgForOffice(office: {
  nameBn: string;
  addressBn: string;
  email?: string | null;
}): OrgInfo {
  return {
    ...ORG,
    office_bn: office.nameBn,
    address_bn: office.addressBn,
    email: office.email || ORG.email,
  };
}

export const DEFAULT_EMPLOYEE_ID = "20105010089"; // Shahed Reza (has full data)

// ─── Defaults for optional fields ─────────────────────────────────────────────

const DEFAULT_FIXATION: FixationRecord = {
  id: null,
  grade: 0,
  step: null,
  basicSalary: 0,
  validFrom: "",
  validThru: "",
  salaryStatus: "not_found",
  reason: "annual",
  grossEarning: 0,
  totalDeduction: 0,
  netSalary: 0,
  versionCount: 0,
};

const EMPTY_ADDRESS: AddressBlock = {
  line_en: "",
  thana: "",
  upazila: "",
  post_office: "",
  post_code: "",
  district: "",
};

// ─── Blood group display mapping ──────────────────────────────────────────────

const BLOOD_GROUP: Record<string, string> = {
  A_pos: "A+",
  A_neg: "A-",
  B_pos: "B+",
  B_neg: "B-",
  AB_pos: "AB+",
  AB_neg: "AB-",
  O_pos: "O+",
  O_neg: "O-",
};

// ─── Sub-table mappers ────────────────────────────────────────────────────────

function computeFixationStatus(
  validThru: string,
  stored: string,
  supersededAt: Date | null,
): SalaryStatus {
  if (stored === "inactive") return "inactive";
  if (supersededAt) return "expired";

  // Parse MM-DD-YYYY (employees.json / seed format) or YYYY-MM-DD
  let expiry: Date | null = null;
  const mdy = validThru.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const ymd = validThru.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mdy) expiry = new Date(`${mdy[3]}-${mdy[1]}-${mdy[2]}`);
  else if (ymd) expiry = new Date(validThru);

  if (expiry) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expiry < today) return "expired";
  }

  return "active";
}

/** `MM-DD-YYYY` → a comparable integer. Returns 0 for an unparseable string. */
function fixationDateKey(stored: string): number {
  const m = stored.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return 0;
  return Number(m[3]) * 10000 + Number(m[1]) * 100 + Number(m[2]);
}

/**
 * Pick the fixation version in force today out of an employee's history, and
 * flatten it to the single record the listing screens expect.
 *
 * "In force" is: not superseded, not inactive, and today falls inside its
 * date range. If nothing covers today — the usual case for an employee whose
 * last fixation lapsed — the most recent version is returned instead, so the
 * table can show it as Expired rather than pretending no fixation exists.
 */
function mapFixation(rows: SalaryFixation[]): FixationRecord {
  if (!rows.length) return DEFAULT_FIXATION;

  const today = fixationDateKey(
    (() => {
      const t = new Date();
      return `${String(t.getMonth() + 1).padStart(2, "0")}-${String(
        t.getDate(),
      ).padStart(2, "0")}-${t.getFullYear()}`;
    })(),
  );

  const byRecency = [...rows].sort(
    (a, b) => fixationDateKey(b.validFrom) - fixationDateKey(a.validFrom) || b.id - a.id,
  );

  const inForce =
    byRecency.find(
      (f) =>
        !f.supersededAt &&
        f.salaryStatus !== "inactive" &&
        fixationDateKey(f.validFrom) <= today &&
        today <= fixationDateKey(f.validThru),
    ) ?? byRecency[0];

  return {
    id: inForce.id,
    grade: inForce.grade,
    step: inForce.step,
    basicSalary: inForce.basicSalary,
    validFrom: inForce.validFrom,
    validThru: inForce.validThru,
    salaryStatus: computeFixationStatus(
      inForce.validThru,
      inForce.salaryStatus,
      inForce.supersededAt,
    ),
    reason: inForce.reason,
    grossEarning: inForce.grossEarning,
    totalDeduction: inForce.totalDeduction,
    netSalary: inForce.netSalary,
    versionCount: rows.length,
  };
}

function mapAddress(a: Address | null | undefined): AddressBlock {
  if (!a) return EMPTY_ADDRESS;
  return {
    line_en: a.village ?? "",
    thana: "",
    upazila: a.upazila ?? "",
    post_office: a.postOffice ?? "",
    post_code: "",
    district: a.district ?? "",
  };
}

function mapSalaryHistory(r: SalaryHistory): SalaryHistoryRow {
  return {
    sl: r.sl,
    grade: r.grade,
    basic: r.basic,
    month: r.month,
    year: r.year,
  };
}

function mapWorkHistory(r: WorkHistory): WorkHistoryRow {
  return {
    sl: r.sl,
    designation_bn: r.designationBn,
    designation_en: r.designationEn,
    grade: r.grade,
    office: r.office,
    start: r.start,
    end: r.end,
    order_no: r.orderNo ?? "",
    order_date: r.orderDate ?? "",
  };
}

function mapEducation(r: Education): EducationRow {
  return {
    sl: r.sl,
    degree_primary: r.degree,
    is_bn: false,
    institution: r.institution,
    subject: r.subject ?? "",
    year: r.passingYear,
    result: r.result ?? "",
  };
}

function mapPromotion(r: Promotion): PromotionRow {
  return {
    sl: r.sl,
    designation_bn: r.designationBn,
    designation_en: r.designationEn,
    joining_date: r.effectiveDate,
    order_no: r.orderNo ?? "",
    order_date: r.orderDate ?? "",
  };
}

function mapTraining(r: Training): TrainingRow {
  return {
    sl: r.sl,
    course_name: r.title,
    institution: r.institution ?? "",
    duration: r.duration ?? "",
    result: "",
  };
}

function mapForeignTraining(r: ForeignTraining): ForeignTrainingRow {
  return {
    sl: r.sl,
    course_name: r.title,
    country: r.country ?? "",
    institution: r.institution ?? "",
    duration: r.duration ?? "",
  };
}

function mapPublication(r: Publication): PublicationRow {
  return {
    sl: r.sl,
    type: "",
    title: r.title,
    publisher: r.publisher ?? "",
    date: r.year ?? "",
  };
}

function mapAward(r: Award): AwardRow {
  return {
    sl: r.sl,
    title: r.title,
    type: "",
    country: "",
    org: r.awardedBy ?? "",
    date: r.year ?? "",
  };
}

// ─── Posting helpers ──────────────────────────────────────────────────────────

type CurrentPosting = Posting & {
  orgPost: (OrgPost & { unit: OrgUnit & { parent: OrgUnit | null } }) | null;
  office: DbOffice;
};

function mapPostingToWorkHistory(p: Posting & {
  orgPost: OrgPost | null;
  office: DbOffice;
}, sl: number): WorkHistoryRow {
  return {
    sl,
    designation_bn: p.orgPost?.nameBn ?? "",
    designation_en: p.orgPost?.nameEn ?? "",
    grade: p.grade,
    office: p.office.nameBn,
    start: p.joinedAt ?? "",
    end: p.relievedAt ?? "",
    order_no: p.orderNo ?? "",
    order_date: p.orderDate ?? "",
  };
}

// ─── Full DB row type (all relations included) ────────────────────────────────

type FullDbEmployee = DbEmployee & {
  office: DbOffice;
  currentPosting: CurrentPosting | null;
  fixations: SalaryFixation[];
  salaryHistory: SalaryHistory[];
  workHistory: WorkHistory[];
  postings: (Posting & { orgPost: OrgPost | null; office: DbOffice })[];
  educations: Education[];
  promotions: Promotion[];
  trainings: Training[];
  foreignTrainings: ForeignTraining[];
  publications: Publication[];
  awards: Award[];
  presentAddress: Address | null;
  permanentAddress: Address | null;
};

type ListingDbEmployee = DbEmployee & {
  office: DbOffice;
  currentPosting: CurrentPosting | null;
  fixations: SalaryFixation[];
};

// ─── Core mapper ──────────────────────────────────────────────────────────────

function mapEmployee(
  emp: ListingDbEmployee,
  full?: {
    salaryHistory: SalaryHistory[];
    workHistory: WorkHistory[];
    postings: (Posting & { orgPost: OrgPost | null; office: DbOffice })[];
    educations: Education[];
    promotions: Promotion[];
    trainings: Training[];
    foreignTrainings: ForeignTraining[];
    publications: Publication[];
    awards: Award[];
    presentAddress: Address | null;
    permanentAddress: Address | null;
  },
): Employee {
  // Resolve current job from active Posting; fall back to legacy Employee fields
  const cp = emp.currentPosting;
  const designationBn = cp?.orgPost?.nameBn ?? emp.designationBn ?? "";
  const designationEn = cp?.orgPost?.nameEn ?? emp.designationEn ?? "";
  const grade         = cp?.grade            ?? emp.grade          ?? "";
  const officeRecord  = cp?.office           ?? emp.office;

  // Derive wing from OrgUnit hierarchy: grandparent (top-level unit name)
  const unitChain = cp?.orgPost
    ? [cp.orgPost.unit.parent?.nameEn, cp.orgPost.unit.nameEn].filter(Boolean).join(" › ")
    : (emp.wing ?? "");

  // Build chronological posting history (structured postings first, then legacy WorkHistory)
  const postingRows: WorkHistoryRow[] = (full?.postings ?? [])
    .sort((a, b) => (a.joinedAt ?? "").localeCompare(b.joinedAt ?? ""))
    .map((p, i) => mapPostingToWorkHistory(p, i + 1));

  const legacyRows: WorkHistoryRow[] = (full?.workHistory ?? []).map(mapWorkHistory);

  return {
    id: emp.id,
    userId: emp.userId,
    name: { bn: emp.nameBn, en: emp.nameEn },
    role_en: designationEn,
    currentPostingId: cp?.id ?? null,
    postingStatus: cp ? (cp.status as PostingStatus) : null,
    releasedAt: null,
    father_name: { bn: emp.fatherNameBn, en: emp.fatherNameEn },
    mother_name: { bn: emp.motherNameBn, en: emp.motherNameEn },
    date_of_birth: emp.dateOfBirth,
    blood_group: emp.bloodGroup
      ? (BLOOD_GROUP[emp.bloodGroup] ?? emp.bloodGroup)
      : "",
    gender: emp.gender,
    marital_status: emp.maritalStatus,
    nid: emp.nid ?? "",
    passport_no: emp.passportNo ?? "",
    mobile_home: emp.mobileHome ?? "",
    mobile_office: emp.mobileOffice ?? "",
    phone: emp.phone ?? "",
    email: emp.email ?? "",
    photo_label: emp.photoLabel ?? undefined,
    status: emp.status as Employee["status"],
    category: emp.category,
    wing: unitChain,
    current_job: {
      designation_bn: designationBn,
      designation_en: designationEn,
      office_id:      officeRecord.id,
      office_bn:      officeRecord.nameBn,
      office_en:      officeRecord.nameEn,
      office_address_bn: officeRecord.addressBn,
      office_address_en: officeRecord.addressEn,
      grade,
      division: emp.division ?? "",
      initial_designation_bn: emp.initialDesignationBn ?? "",
      date_of_joining:        emp.dateOfJoining ?? "",
      post_retirement_leave:  emp.postRetirementLeave ?? "",
      full_retirement:        emp.fullRetirement ?? "",
    },
    emergency_contact: {
      name: emp.emergencyName ?? "",
      relation: emp.emergencyRelation ?? "",
      phone: emp.emergencyPhone ?? "",
      mobile: emp.emergencyMobile ?? "",
    },
    addresses: {
      present: mapAddress(full?.presentAddress),
      permanent: mapAddress(full?.permanentAddress),
    },
    fixation: mapFixation(emp.fixations),
    salary_history: full ? full.salaryHistory.map(mapSalaryHistory) : [],
    work_history: full ? [...postingRows, ...legacyRows] : [],
    education: full ? full.educations.map(mapEducation) : [],
    promotions: full ? full.promotions.map(mapPromotion) : [],
    trainings: full ? full.trainings.map(mapTraining) : [],
    foreign_trainings: full
      ? full.foreignTrainings.map(mapForeignTraining)
      : [],
    publications: full ? full.publications.map(mapPublication) : [],
    awards: full ? full.awards.map(mapAward) : [],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

const CURRENT_POSTING_INCLUDE = {
  where: { relievedAt: null },
  take: 1,
  include: {
    orgPost: { include: { unit: { include: { parent: true } } } },
    office: true,
  },
} as const;

export async function getUserOfficeId(userId: string): Promise<number | null> {
  const emp = await prisma.employee.findUnique({
    where: { userId },
    select: { officeId: true },
  });
  return emp?.officeId ?? null;
}

export async function getEmployees(options?: {
  role?: string;
  officeId?: number;
  /** Scope to one employee — what a non-admin may see of the roster. */
  employeeId?: string;
}): Promise<Employee[]> {
  // Scoped whenever an officeId is given — it used to require `role` to be
  // passed as well, so a caller that supplied only an officeId (the fixation
  // screen) silently listed every employee in the institute.
  //
  // `employeesOfOffice()` is the shared definition: current posting first,
  // falling back to the legacy `Employee.officeId` for anyone without one.
  const where =
    options?.officeId !== undefined
      ? employeesOfOffice(options.officeId)
      : options?.employeeId !== undefined
        ? { id: options.employeeId }
        : undefined;

  const rows = await prisma.employee.findMany({
    where,
    include: {
      office: true,
      fixations: true,
      postings: CURRENT_POSTING_INCLUDE,
    },
    orderBy: { id: "asc" },
  });

  // Bulk-fetch the most recently closed posting for each employee so the
  // Approve modal can show when they were released from their previous office.
  const employeeIds = rows.map((r) => r.id);
  const previousPostings = await prisma.posting.findMany({
    where: { employeeId: { in: employeeIds }, relievedAt: { not: null } },
    select: { employeeId: true, relievedAt: true },
    orderBy: { createdAt: "desc" },
    distinct: ["employeeId"],
  });
  const releasedAtMap = new Map(previousPostings.map((p) => [p.employeeId, p.relievedAt]));

  return rows.map((emp) => {
    const listing = { ...emp, currentPosting: emp.postings[0] ?? null } as ListingDbEmployee;
    const result = mapEmployee(listing);
    result.releasedAt = releasedAtMap.get(emp.id) ?? null;
    return result;
  });
}

export async function getEmployeeRecord(id: string): Promise<EmployeeRecord> {
  const emp = await prisma.employee.findUnique({
    where: { id },
    include: {
      office: true,
      fixations: true,
      postings: {
        include: {
          orgPost: { include: { unit: { include: { parent: true } } } },
          office: true,
        },
        orderBy: { joinedAt: "asc" },
      },
      salaryHistory:   { orderBy: { sl: "asc" } },
      workHistory:     { orderBy: { sl: "asc" } },
      educations:      { orderBy: { sl: "asc" } },
      promotions:      { orderBy: { sl: "asc" } },
      trainings:       { orderBy: { sl: "asc" } },
      foreignTrainings:{ orderBy: { sl: "asc" } },
      publications:    { orderBy: { sl: "asc" } },
      awards:          { orderBy: { sl: "asc" } },
      presentAddress:  true,
      permanentAddress:true,
    },
  });
  if (!emp) throw new Error(`Employee ${id} not found`);
  const currentPosting = emp.postings.find((p) => p.relievedAt === null) ?? null;
  const full = { ...emp, currentPosting } as unknown as FullDbEmployee;
  const employee = mapEmployee(full, {
    salaryHistory:    full.salaryHistory,
    workHistory:      full.workHistory,
    postings:         emp.postings as (Posting & { orgPost: OrgPost | null; office: DbOffice })[],
    educations:       full.educations,
    promotions:       full.promotions,
    trainings:        full.trainings,
    foreignTrainings: full.foreignTrainings,
    publications:     full.publications,
    awards:           full.awards,
    presentAddress:   full.presentAddress,
    permanentAddress: full.permanentAddress,
  });
  return { ...employee, org: ORG };
}

export async function getSalaryProcessRecords(filter?: {
  officeId?: number;
  employeeId?: string;
}): Promise<SalaryProcessRecord[]> {
  const where =
    filter?.officeId !== undefined
      ? { employee: employeesOfOffice(filter.officeId) }
      : filter?.employeeId !== undefined
        ? { employeeId: filter.employeeId }
        : undefined;

  const rows = await prisma.salaryProcess.findMany({
    where,
    orderBy: [{ year: "desc" }, { id: "asc" }],
  });
  return rows.map((r) => ({
    employee_id: r.employeeId,
    basic_salary: r.basicSalary,
    gross_earning: r.grossEarning,
    total_deduction: r.totalDeduction,
    net_salary: r.netSalary,
    issue_date: r.issueDate,
    month: r.month,
    year: r.year,
  }));
}

// ─── Salary process months (distinct month+year with employee counts) ─────────

const MONTH_ORDER: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

/**
 * Processed months, broken down **by office** — payroll and the bank advice are
 * both per office, so a month is only "done" for one office at a time.
 */
export async function getSalaryProcessMonths(filter?: {
  officeId?: number;
}): Promise<SalaryProcessMonth[]> {
  const [all, advices] = await Promise.all([
    prisma.salaryProcess.findMany({
      where: filter?.officeId !== undefined
        ? { employee: employeesOfOffice(filter.officeId) }
        : undefined,
      select: {
        month: true,
        year: true,
        employee: {
          select: {
            officeId: true,
            office: { select: { nameEn: true } },
            postings: {
              where: { relievedAt: null },
              select: { officeId: true, office: { select: { nameEn: true } } },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.bankAdvice.findMany({ select: { month: true, year: true, officeId: true } }),
  ]);

  const issued = new Set(advices.map((a) => `${a.month}|${a.year}|${a.officeId}`));

  const map = new Map<string, SalaryProcessMonth>();
  for (const r of all) {
    const posting = r.employee.postings[0] ?? null;
    const officeId = posting?.officeId ?? r.employee.officeId;
    const officeName = posting?.office.nameEn ?? r.employee.office.nameEn;
    const key = `${r.month}|${r.year}|${officeId}`;
    const entry = map.get(key);
    if (entry) entry.count++;
    else
      map.set(key, {
        month: r.month,
        year: r.year,
        count: 1,
        officeId,
        officeNameEn: officeName,
        hasAdvice: issued.has(key),
      });
  }
  return [...map.values()].sort(
    (a, b) =>
      Number(b.year) - Number(a.year) ||
      MONTH_ORDER[b.month] - MONTH_ORDER[a.month] ||
      a.officeId - b.officeId,
  );
}

// ─── Bank advice queries ──────────────────────────────────────────────────────

function mapAdvice(r: {
  id: number;
  memoNo: string;
  month: string;
  year: string;
  chequeNo: string;
  chequeDate: string;
  depositDate: string;
  totalAmount: number;
  totalInWords: string;
  employeeCount: number;
  createdAt: Date;
  officeId: number | null;
  office: {
    nameEn: string;
    nameBn: string;
    addressBn: string;
    email: string | null;
    bankAccount: {
      branchNameBn: string;
      branchAddressBn: string;
      recipientDesignationBn: string;
      accountNo: string;
      bank: { nameBn: string };
    } | null;
  } | null;
  bankNameBn: string | null;
  branchNameBn: string | null;
  branchAddressBn: string | null;
  recipientDesignationBn: string | null;
  drawnOnAccountNo: string | null;
}): BankAdviceRecord {
  return {
    id: r.id,
    memoNo: r.memoNo,
    month: r.month,
    year: r.year,
    chequeNo: r.chequeNo,
    chequeDate: r.chequeDate,
    depositDate: r.depositDate,
    totalAmount: r.totalAmount,
    totalInWords: r.totalInWords,
    employeeCount: r.employeeCount,
    createdAt: r.createdAt.toISOString(),
    officeId: r.officeId,
    officeNameEn: r.office?.nameEn ?? null,
    officeNameBn: r.office?.nameBn ?? null,
    officeAddressBn: r.office?.addressBn ?? null,
    officeEmail: r.office?.email ?? null,
    // Prefer what was snapshotted at issue; fall back to the office's current
    // details only for advices issued before the snapshot existed.
    bankNameBn: r.bankNameBn ?? r.office?.bankAccount?.bank.nameBn ?? null,
    branchNameBn: r.branchNameBn ?? r.office?.bankAccount?.branchNameBn ?? null,
    branchAddressBn:
      r.branchAddressBn ?? r.office?.bankAccount?.branchAddressBn ?? null,
    recipientDesignationBn:
      r.recipientDesignationBn ??
      r.office?.bankAccount?.recipientDesignationBn ??
      null,
    drawnOnAccountNo:
      r.drawnOnAccountNo ?? r.office?.bankAccount?.accountNo ?? null,
  };
}

const ADVICE_OFFICE = {
  office: {
    select: {
      nameEn: true,
      nameBn: true,
      addressBn: true,
      email: true,
      bankAccount: { include: { bank: { select: { nameBn: true } } } },
    },
  },
};

export async function getBankAdvices(filter?: {
  officeId?: number;
}): Promise<BankAdviceRecord[]> {
  const rows = await prisma.bankAdvice.findMany({
    where: filter?.officeId !== undefined ? { officeId: filter.officeId } : undefined,
    include: ADVICE_OFFICE,
    orderBy: [{ year: "desc" }, { id: "desc" }],
  });
  return rows.map(mapAdvice);
}

export async function getBankAdviceById(
  id: number,
): Promise<BankAdviceRecord | null> {
  const r = await prisma.bankAdvice.findUnique({
    where: { id },
    include: ADVICE_OFFICE,
  });
  return r ? mapAdvice(r) : null;
}

/**
 * The payment list behind one advice. Scoped to the office — an advice pays its
 * own office's staff, never the institute's.
 */
export async function getBankAdviceEntries(
  month: string,
  year: string,
  officeId?: number | null,
): Promise<BankAdviceEntry[]> {
  const records = await prisma.salaryProcess.findMany({
    where: {
      month,
      year,
      ...(officeId != null ? { employee: employeesOfOffice(officeId) } : {}),
    },
    include: {
      employee: {
        include: {
          postings: {
            where: { relievedAt: null },
            take: 1,
            include: { orgPost: true },
          },
        },
      },
    },
    orderBy: { employee: { id: "asc" } },
  });
  return records.map((r, i) => {
    const cp = r.employee.postings[0] ?? null;
    const designation = cp?.orgPost?.nameBn ?? r.employee.designationBn ?? "";
    return {
      sl: i + 1,
      name: r.employee.nameBn,
      designation,
      accountNo: r.employee.bankAccountNo ?? "",
      salaryAllowance: r.netSalary,
      arrearAmount: r.arrearAmount,
    };
  });
}
