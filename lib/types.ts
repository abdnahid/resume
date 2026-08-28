export type PersonName = {
  bn: string;
  en: string;
};

export type OrgInfo = {
  header_lines_bn: [string, string, string];
  /**
   * The specific office a document belongs to, printed under the institution
   * name. Omitted on documents that speak for BSTI as a whole.
   */
  office_bn?: string;
  address_bn: string;
  website: string;
  email: string;
  hotline: string;
};

export type EmployeeStatus = "active" | "retired" | "prl" | "inactive";
export type PostingStatus = "pending" | "active";
export type SalaryStatus = "active" | "expired" | "not_found" | "inactive";

/**
 * The fixation version in force for an employee today. Fixation is versioned —
 * an employee has many rows over their service — so this is the one that
 * currently decides their pay, not the only one that exists. The full list is
 * `getEmployeeFixations()` in `lib/salary/queries.ts`.
 */
export type FixationRecord = {
  /** Null when the employee has no fixation at all. */
  id: number | null;
  grade: number;
  /** Rung of the grade the basic came from; null when typed by hand. */
  step: number | null;
  basicSalary: number;
  validFrom: string;
  validThru: string;
  salaryStatus: SalaryStatus;
  reason: FixationReason;
  grossEarning: number;
  totalDeduction: number;
  netSalary: number;
  /** How many versions this employee has on record. */
  versionCount: number;
};

export type FixationReason =
  | "annual"
  | "initial"
  | "increment"
  | "promotion"
  | "punishment"
  | "correction";

export type WorkHistoryRow = {
  sl: number;
  designation_bn: string;
  designation_en: string;
  grade: string;
  office: string;
  start: string;
  end: string;
  order_no: string;
  order_date: string;
};

export type SalaryHistoryRow = {
  sl: number;
  grade: number;
  basic: number;
  month: string;
  year: string;
};

export type AddressBlock = {
  line_en: string;
  thana: string;
  thana_bn?: boolean;
  upazila: string;
  upazila_bn?: boolean;
  post_office: string;
  post_code: string;
  district: string;
  district_bn?: boolean;
};

export type EducationRow = {
  sl: number;
  degree_primary: string;
  degree_secondary?: string;
  is_bn: boolean;
  institution: string;
  subject: string;
  year: string;
  result: string;
  scale?: string | null;
};

export type PromotionRow = {
  sl: number;
  designation_bn: string;
  designation_en: string;
  joining_date: string;
  order_no: string;
  order_date: string;
};

export type TrainingRow = {
  sl: number;
  course_name: string;
  course_subtitle?: string;
  institution: string;
  duration: string;
  result: string;
};

export type ForeignTrainingRow = {
  sl: number;
  course_name: string;
  course_subtitle?: string;
  country: string;
  institution: string;
  duration: string;
};

export type PublicationRow = {
  sl: number;
  type: string;
  title: string;
  publisher: string;
  date: string;
};

export type AwardRow = {
  sl: number;
  title: string;
  type: string;
  country: string;
  org: string;
  date: string;
};

export type Employee = {
  // ─── Common identity ─────────────────────────────────────────────
  id: string;
  userId: string;
  name: PersonName;
  role_en: string;
  currentPostingId: number | null;
  postingStatus: PostingStatus | null;
  releasedAt: string | null;
  father_name: PersonName;
  mother_name: PersonName;
  date_of_birth: string;
  blood_group: string;
  gender: string;
  marital_status: string;
  nid: string;
  passport_no: string;
  mobile_home: string;
  mobile_office: string;
  phone: string;
  email: string;
  photo_label?: string;

  // ─── Employment ──────────────────────────────────────────────────
  status: EmployeeStatus;
  wing: string;

  // ─── Current position ────────────────────────────────────────────
  current_job: {
    designation_bn: string;
    designation_en: string;
    office_bn: string;
    office_en: string;
    office_address_bn: string;
    office_address_en: string;
    grade: string;
    division: string;
    initial_designation_bn: string;
    date_of_joining: string;
    post_retirement_leave: string;
    full_retirement: string;
  };

  // ─── Contact & location ──────────────────────────────────────────
  emergency_contact: {
    name: string;
    relation: string;
    phone: string;
    mobile: string;
  };
  addresses: {
    present: AddressBlock;
    permanent: AddressBlock;
  };

  // ─── Salary sub-objects ──────────────────────────────────────────
  fixation: FixationRecord;
  salary_history: SalaryHistoryRow[];

  // ─── Career history ──────────────────────────────────────────────
  work_history: WorkHistoryRow[];

  // ─── Biodata arrays ──────────────────────────────────────────────
  education: EducationRow[];
  promotions: PromotionRow[];
  trainings: TrainingRow[];
  foreign_trainings: ForeignTrainingRow[];
  publications: PublicationRow[];
  awards: AwardRow[];
};

// Augments Employee with org info required by the biodata page
export type EmployeeRecord = Employee & { org: OrgInfo };

export type SalaryProcessRecord = {
  employee_id: string;
  basic_salary: number;
  gross_earning: number;
  total_deduction: number;
  net_salary: number;
  issue_date: string; // MM-DD-YYYY
  month: string;
  year: string;
};

export type SalaryProcessMonth = {
  month: string;
  year: string;
  count: number;
  officeId: number;
  officeNameEn: string;
  /** True once the advice for this office-month has been issued. */
  hasAdvice: boolean;
};

export type BankAdviceRecord = {
  id: number;
  memoNo: string;
  month: string;
  year: string;
  chequeNo: string;
  chequeDate: string;   // dd-mm-yyyy
  depositDate: string;  // dd-mm-yyyy
  totalAmount: number;
  totalInWords: string;
  employeeCount: number;
  createdAt: string;    // ISO string
  /** Which office's staff this advice pays. Null only on pre-migration rows. */
  officeId: number | null;
  officeNameEn: string | null;
  officeNameBn: string | null;
  officeAddressBn: string | null;
};

export type BankAdviceEntry = {
  sl: number;
  name: string;
  designation: string;
  accountNo: string;
  /** Net pay for the month, arrears included — what the bank must transfer. */
  salaryAllowance: number;
  /** Arrears inside that figure, shown so the letter explains an odd total. */
  arrearAmount: number;
};

// ─── Director General ───────────────────────────────────────────────────────────

export type DirectorGeneralRecord = {
  id: number;
  name: PersonName;
  signatureUrl: string | null;
  photoUrl: string | null;
  appointedAt: string;        // DD-MM-YYYY
  relievedAt: string | null;  // null = current DG
  orderNo: string;
  orderDate: string;
  isCurrent: boolean;
};

// ─── ID Card authorization ────────────────────────────────────────────────────

export type IdCardBatchStatus = "pending" | "issued";
export type IdCardStatus = "pending" | "active" | "superseded";

export type IdCardBatchRecord = {
  id: number;
  memoNo: string;
  status: IdCardBatchStatus;
  requestedAt: string;             // DD-MM-YYYY
  signedDate: string | null;       // DD-MM-YYYY — the card's "Issued on" date
  directorGeneralId: number;
  dgName: PersonName;              // signatory at request time
  cardCount: number;
  createdAt: string;               // ISO string
};

// One card issuance, with the employee context needed for listings.
export type IdCardRecord = {
  id: number;
  version: number;
  status: IdCardStatus;
  issueDate: string | null;        // DD-MM-YYYY (set on issue)
  batchId: number;
  employee: {
    id: string;
    name: PersonName;
    designation_bn: string;
    office_bn: string;
  };
};

// A batch together with the employee cards it contains.
export type IdCardBatchDetail = IdCardBatchRecord & {
  cards: IdCardRecord[];
};

// The authorization context stamped on a printed card.
export type IdCardAuthorization = {
  issueDate: string;       // DD-MM-YYYY
  version: number;
  dgName: PersonName;
  signatureUrl: string | null;
};
