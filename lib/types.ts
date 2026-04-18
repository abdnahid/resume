export type PersonName = {
  bn: string;
  en: string;
};

export type EmployeeRecord = {
  org: {
    header_lines_bn: [string, string, string];
    address_bn: string;
    website: string;
    email: string;
    hotline: string;
  };
  personal: {
    employee_id: string;
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
    photo_label: string;
  };
  emergency_contact: {
    name: string;
    relation: string;
    phone: string;
    mobile: string;
  };
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
  addresses: {
    present: AddressBlock;
    permanent: AddressBlock;
  };
  education: EducationRow[];
  postings: PostingRow[];
  promotions: PromotionRow[];
  trainings: TrainingRow[];
  foreign_trainings: ForeignTrainingRow[];
  publications: PublicationRow[];
  awards: AwardRow[];
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

export type PostingRow = {
  sl: number;
  designation_bn: string;
  designation_en: string;
  office: string;
  start: string;
  end: string;
  order_no: string;
  order_date: string;
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
