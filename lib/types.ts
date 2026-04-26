export type PersonName = {
  bn: string;
  en: string;
};

export type OrgInfo = {
  header_lines_bn: [string, string, string];
  address_bn: string;
  website: string;
  email: string;
  hotline: string;
};

export type EmployeeStatus = "active" | "retired" | "prl" | "inactive";
export type SalaryStatus = "active" | "expired" | "not_found" | "inactive";

export type FixationRecord = {
  grade: number;
  basicSalary: number;
  validFrom: string;
  validThru: string;
  salaryStatus: SalaryStatus;
};

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
  name: PersonName;
  role_en: string;
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
  net_salary: number;
  issue_date: string; // MM-DD-YYYY
  month: string;
  year: string;
};

export type SalaryProcessMonth = {
  month: string;
  year: string;
  count: number;
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
};

export type BankAdviceEntry = {
  sl: number;
  name: string;
  designation: string;
  accountNo: string;
  salaryAllowance: number;
};
