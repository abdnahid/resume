import type {
  Employee,
  Address,
  Education,
  Posting,
  WorkHistory,
  Promotion,
  Training,
  ForeignTraining,
  Spouse,
  Child,
  Language,
  Curricular,
  Publication,
  Award,
  DisciplinaryAction,
} from "@/generated/prisma/client";

export type StepKey =
  | "personal"
  | "address"
  | "bank"
  | "education"
  | "career"
  | "experience"
  | "promotions"
  | "training"
  | "family"
  | "languages"
  | "curriculars"
  | "publications"
  | "awards"
  | "disciplinary";

export type StepCompletion = {
  filled: number;
  total: number;
  pct: number;
  done: boolean;
};

export type ProfileCompletion = {
  required: { filled: number; total: number; pct: number };
  optional: { filled: number; total: number; pct: number };
  steps: Record<StepKey, StepCompletion>;
};

type CompletionInput = {
  employee: Employee & { presentAddress: Address | null; permanentAddress: Address | null };
  educations: Education[];
  postings: Posting[];
  workHistory: WorkHistory[];
  promotions: Promotion[];
  trainings: Training[];
  foreignTrainings: ForeignTraining[];
  spouse: Spouse | null;
  children: Child[];
  languages: Language[];
  curriculars: Curricular[];
  publications: Publication[];
  awards: Award[];
  disciplinaryActions: DisciplinaryAction[];
};

function filled(...vals: (string | null | undefined | boolean)[]): number {
  return vals.filter((v) => v !== null && v !== undefined && v !== "").length;
}

function bool(v: string | null | undefined): boolean {
  return v !== null && v !== undefined && v !== "";
}

export function getProfileCompletion(input: CompletionInput): ProfileCompletion {
  const { employee: e, educations, postings, workHistory, promotions,
    trainings, foreignTrainings, spouse, children, languages,
    curriculars, publications, awards, disciplinaryActions } = input;

  const addr = e.presentAddress;
  const permAddr = e.permanentAddress;

  // ─── Required fields ────────────────────────────────────────────────────────
  // Personal (12 required)
  const reqPersonal = [
    bool(e.nameEn), bool(e.nameBn),
    bool(e.fatherNameEn), bool(e.fatherNameBn),
    bool(e.motherNameEn), bool(e.motherNameBn),
    bool(e.dateOfBirth), bool(e.gender as string),
    bool(e.maritalStatus as string), bool(e.nid),
    bool(e.mobileHome), bool(e.nationality),
  ];
  // Emergency contact (3 required)
  const reqEmergency = [
    bool(e.emergencyName), bool(e.emergencyRelation), bool(e.emergencyMobile),
  ];
  // Present address (7 required)
  const reqAddress = [
    bool(addr?.division), bool(addr?.district), bool(addr?.upazila),
    bool(addr?.houseNo), bool(addr?.postOffice), bool(addr?.postCode),
    bool(addr?.thana),
  ];
  // Education: at least 1 record (1 required)
  const reqEducation = [educations.length > 0];
  // Career: has joining date or at least 1 posting (1 required)
  const hasCareer = postings.length > 0 || bool(e.dateOfJoining);
  const reqCareer = [hasCareer];

  const allRequired = [...reqPersonal, ...reqEmergency, ...reqAddress, ...reqEducation, ...reqCareer];
  const reqTotal = allRequired.length; // 24
  const reqFilled = allRequired.filter(Boolean).length;

  // ─── Optional fields ────────────────────────────────────────────────────────
  const optPersonal = [
    bool(e.bloodGroup as string), bool(e.passportNo),
    bool(e.email), bool(e.mobileOffice), bool(e.phone),
    bool(e.placeOfBirth), bool(e.signatureLabel),
  ];
  const optPermAddress = [
    bool(permAddr?.division) && bool(permAddr?.district) && bool(permAddr?.houseNo),
  ];
  const optBank = [bool(e.bankAccountNo), bool(e.bankBranch), bool(e.tinNo)];
  const optExperience = [workHistory.filter((w) => w.type === "previous").length > 0];
  const optPromotions = [promotions.length > 0];
  const optTraining = [(trainings.length + foreignTrainings.length) > 0];
  const optSpouse = [bool(spouse?.nameEn) || bool(spouse?.nameBn)];
  const optChildren = [children.length > 0];
  const optLanguages = [languages.length > 0];
  const optCurriculars = [curriculars.length > 0];
  const optPublications = [publications.length > 0];
  const optAwards = [awards.length > 0];

  const allOptional = [
    ...optPersonal, ...optPermAddress, ...optBank,
    ...optExperience, ...optPromotions, ...optTraining,
    ...optSpouse, ...optChildren, ...optLanguages, ...optCurriculars,
    ...optPublications, ...optAwards,
  ];
  const optTotal = allOptional.length;
  const optFilled = allOptional.filter(Boolean).length;

  // ─── Per-step completion ─────────────────────────────────────────────────────
  function step(filled: number, total: number): StepCompletion {
    const pct = total === 0 ? 100 : Math.round((filled / total) * 100);
    return { filled, total, pct, done: filled === total };
  }

  const personalFilled = [...reqPersonal, ...reqEmergency, ...optPersonal].filter(Boolean).length;
  const personalTotal = reqPersonal.length + reqEmergency.length + optPersonal.length;

  const addrFilled = [...reqAddress, ...optPermAddress].filter(Boolean).length;
  const addrTotal = reqAddress.length + optPermAddress.length;

  const bankFilled = optBank.filter(Boolean).length;

  const careerHasActive = postings.filter((p) => p.status === "active").length > 0;
  const careerHasPending = postings.filter((p) => p.status === "pending").length > 0;
  const careerFilled = (careerHasActive || careerHasPending || bool(e.dateOfJoining)) ? 1 : 0;

  const expRows = workHistory.filter((w) => w.type === "previous");

  const trainingRows = trainings.length + foreignTrainings.length;
  const spouseFilled = spouse ? filled(spouse.nameEn, spouse.nameBn, spouse.nid, spouse.mobile, spouse.occupation) : 0;
  const spouseTotal = 5;

  return {
    required: {
      filled: reqFilled,
      total: reqTotal,
      pct: Math.round((reqFilled / reqTotal) * 100),
    },
    optional: {
      filled: optFilled,
      total: optTotal,
      pct: optTotal === 0 ? 0 : Math.round((optFilled / optTotal) * 100),
    },
    steps: {
      personal:     step(personalFilled, personalTotal),
      address:      step(addrFilled, addrTotal),
      bank:         step(bankFilled, optBank.length),
      education:    step(Math.min(educations.length, 1), 1),
      career:       step(careerFilled, 1),
      experience:   step(expRows.length > 0 ? 1 : 0, 1),
      promotions:   step(promotions.length > 0 ? 1 : 0, 1),
      training:     step(trainingRows > 0 ? 1 : 0, 1),
      family:       step(spouseFilled, spouseTotal),
      languages:    step(languages.length > 0 ? 1 : 0, 1),
      curriculars:  step(curriculars.length > 0 ? 1 : 0, 1),
      publications: step(publications.length > 0 ? 1 : 0, 1),
      awards:       step(awards.length > 0 ? 1 : 0, 1),
      disciplinary: step(disciplinaryActions.length > 0 ? 1 : 0, 1),
    },
  };
}
