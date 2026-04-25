import { prisma } from "./prisma";
import type {
  Employee,
  EmployeeRecord,
  OrgInfo,
  SalaryProcessRecord,
  FixationRecord,
  SalaryStatus,
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

const ORG: OrgInfo = {
  header_lines_bn: [
    "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার",
    "বাংলাদেশ স্ট্যান্ডার্ডস অ্যান্ড টেস্টিং ইনস্টিটিউশন (বিএসটিআই)",
    "শিল্প মন্ত্রণালয়",
  ],
  address_bn: "মান ভবন, ১১৬/ক, তেজগাঁও শিল্প এলাকা, ঢাকা-১২০৮",
  website: "www.bsti.gov.bd",
  email: "dg@bsti.gov.bd",
  hotline: "16126",
};

export const DEFAULT_EMPLOYEE_ID = "20105010089"; // Shahed Reza (has full data)

// ─── Defaults for optional fields ─────────────────────────────────────────────

const DEFAULT_FIXATION: FixationRecord = {
  grade: 0,
  basicSalary: 0,
  validFrom: "",
  validThru: "",
  salaryStatus: "not_found",
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
  A_pos: "A+", A_neg: "A-",
  B_pos: "B+", B_neg: "B-",
  AB_pos: "AB+", AB_neg: "AB-",
  O_pos: "O+", O_neg: "O-",
};

// ─── Sub-table mappers ────────────────────────────────────────────────────────

function computeFixationStatus(validThru: string, stored: string): SalaryStatus {
  if (stored === "inactive") return "inactive";

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

function mapFixation(f: SalaryFixation): FixationRecord {
  return {
    grade: f.grade,
    basicSalary: f.basicSalary,
    validFrom: f.validFrom,
    validThru: f.validThru,
    salaryStatus: computeFixationStatus(f.validThru, f.salaryStatus),
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
  return { sl: r.sl, grade: r.grade, basic: r.basic, month: r.month, year: r.year };
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

// ─── Full DB row type (all relations included) ────────────────────────────────

type FullDbEmployee = DbEmployee & {
  office: DbOffice;
  fixation: SalaryFixation | null;
  salaryHistory: SalaryHistory[];
  workHistory: WorkHistory[];
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
  fixation: SalaryFixation | null;
};

// ─── Core mapper ──────────────────────────────────────────────────────────────

function mapEmployee(
  emp: ListingDbEmployee,
  full?: {
    salaryHistory: SalaryHistory[];
    workHistory: WorkHistory[];
    educations: Education[];
    promotions: Promotion[];
    trainings: Training[];
    foreignTrainings: ForeignTraining[];
    publications: Publication[];
    awards: Award[];
    presentAddress: Address | null;
    permanentAddress: Address | null;
  }
): Employee {
  return {
    id: emp.id,
    name: { bn: emp.nameBn, en: emp.nameEn },
    role_en: emp.designationEn,
    father_name: { bn: emp.fatherNameBn, en: emp.fatherNameEn },
    mother_name: { bn: emp.motherNameBn, en: emp.motherNameEn },
    date_of_birth: emp.dateOfBirth,
    blood_group: emp.bloodGroup ? (BLOOD_GROUP[emp.bloodGroup] ?? emp.bloodGroup) : "",
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
    wing: emp.wing ?? "",
    current_job: {
      designation_bn: emp.designationBn,
      designation_en: emp.designationEn,
      office_bn: emp.office.nameBn,
      office_en: emp.office.nameEn,
      office_address_bn: emp.office.addressBn,
      office_address_en: emp.office.addressEn,
      grade: emp.grade,
      division: emp.division ?? "",
      initial_designation_bn: emp.initialDesignationBn ?? "",
      date_of_joining: emp.dateOfJoining ?? "",
      post_retirement_leave: emp.postRetirementLeave ?? "",
      full_retirement: emp.fullRetirement ?? "",
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
    fixation: emp.fixation ? mapFixation(emp.fixation) : DEFAULT_FIXATION,
    salary_history: full ? full.salaryHistory.map(mapSalaryHistory) : [],
    work_history: full ? full.workHistory.map(mapWorkHistory) : [],
    education: full ? full.educations.map(mapEducation) : [],
    promotions: full ? full.promotions.map(mapPromotion) : [],
    trainings: full ? full.trainings.map(mapTraining) : [],
    foreign_trainings: full ? full.foreignTrainings.map(mapForeignTraining) : [],
    publications: full ? full.publications.map(mapPublication) : [],
    awards: full ? full.awards.map(mapAward) : [],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getEmployees(officeId?: number): Promise<Employee[]> {
  const rows = await prisma.employee.findMany({
    where: officeId !== undefined ? { officeId } : undefined,
    include: { office: true, fixation: true },
    orderBy: { id: "asc" },
  });
  return rows.map((emp) => mapEmployee(emp as ListingDbEmployee));
}

export async function getEmployeeRecord(id: string): Promise<EmployeeRecord> {
  const emp = await prisma.employee.findUnique({
    where: { id },
    include: {
      office: true,
      fixation: true,
      salaryHistory: { orderBy: { sl: "asc" } },
      workHistory: { orderBy: { sl: "asc" } },
      educations: { orderBy: { sl: "asc" } },
      promotions: { orderBy: { sl: "asc" } },
      trainings: { orderBy: { sl: "asc" } },
      foreignTrainings: { orderBy: { sl: "asc" } },
      publications: { orderBy: { sl: "asc" } },
      awards: { orderBy: { sl: "asc" } },
      presentAddress: true,
      permanentAddress: true,
    },
  });
  if (!emp) throw new Error(`Employee ${id} not found`);
  const full = emp as FullDbEmployee;
  const employee = mapEmployee(full, {
    salaryHistory: full.salaryHistory,
    workHistory: full.workHistory,
    educations: full.educations,
    promotions: full.promotions,
    trainings: full.trainings,
    foreignTrainings: full.foreignTrainings,
    publications: full.publications,
    awards: full.awards,
    presentAddress: full.presentAddress,
    permanentAddress: full.permanentAddress,
  });
  return { ...employee, org: ORG };
}

export async function getSalaryProcessRecords(filter?: {
  officeId?: number;
  employeeId?: string;
}): Promise<SalaryProcessRecord[]> {
  const where =
    filter?.officeId !== undefined   ? { employee: { officeId: filter.officeId } } :
    filter?.employeeId !== undefined ? { employeeId: filter.employeeId }            :
    undefined;

  const rows = await prisma.salaryProcess.findMany({
    where,
    orderBy: [{ year: "desc" }, { id: "asc" }],
  });
  return rows.map((r) => ({
    employee_id: r.employeeId,
    net_salary: r.netSalary,
    issue_date: r.issueDate,
    month: r.month,
    year: r.year,
  }));
}
