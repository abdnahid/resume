import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrgPostsFlat, getOrgRoots, resolveOfficeRootId } from "@/lib/org";

import PersonalForm    from "./personal/_components/PersonalForm";
import AddressForm     from "./address/_components/AddressForm";
import BankForm        from "./bank/_components/BankForm";
import EducationForm   from "./education/_components/EducationForm";
import CareerForm      from "./career/_components/CareerForm";
import ExperienceForm  from "./experience/_components/ExperienceForm";
import PromotionsForm  from "./promotions/_components/PromotionsForm";
import TrainingForm    from "./training/_components/TrainingForm";
import FamilyForm      from "./family/_components/FamilyForm";
import LanguagesForm   from "./languages/_components/LanguagesForm";
import CurricularsForm from "./curriculars/_components/CurricularsForm";
import PublicationsForm from "./publications/_components/PublicationsForm";
import AwardsForm      from "./awards/_components/AwardsForm";
import DisciplinaryForm from "./disciplinary/_components/DisciplinaryForm";

const STEPS = [
  { key: "personal",     label: "Personal Info",        desc: "Name, NID, contact, emergency contact" },
  { key: "address",      label: "Address",              desc: "Present and permanent address" },
  { key: "bank",         label: "Bank Details",         desc: "Account number, branch, TIN number" },
  { key: "education",    label: "Education",            desc: "Academic qualifications and degrees" },
  { key: "career",       label: "BSTI Service History", desc: "Posting and transfer history within BSTI" },
  { key: "experience",   label: "Previous Experience",  desc: "Work history outside BSTI" },
  { key: "promotions",   label: "Promotions",           desc: "Promotion and grade change records" },
  { key: "training",     label: "Training",             desc: "Local and foreign training courses" },
  { key: "family",       label: "Family",               desc: "Spouse and children details" },
  { key: "languages",    label: "Languages",            desc: "Language proficiency records" },
  { key: "curriculars",  label: "Curriculars",          desc: "Extra-curricular activities" },
  { key: "publications", label: "Publications",         desc: "Books, papers, and other publications" },
  { key: "awards",       label: "Awards",               desc: "Awards and recognitions" },
  { key: "disciplinary", label: "Disciplinary",         desc: "Disciplinary action records (if any)" },
] as const;

type StepKey = typeof STEPS[number]["key"];

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const sp       = await searchParams;
  const rawStep  = sp.step ?? "personal";
  const stepIdx  = STEPS.findIndex((s) => s.key === rawStep);
  const idx      = stepIdx >= 0 ? stepIdx : 0;
  const current  = STEPS[idx];
  const prevStep = idx > 0 ? STEPS[idx - 1].key : null;
  const nextStep = idx < STEPS.length - 1 ? STEPS[idx + 1].key : null;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const employeeId = session.user.username ?? "";

  const isCareer = current.key === "career";

  const [employee, orgPosts, orgRoots, rawOffices] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        presentAddress: true,
        permanentAddress: true,
        educations: { orderBy: { sl: "asc" } },
        postings: isCareer
          ? { include: { orgPost: { include: { unit: { include: { parent: true } } } }, office: true }, orderBy: { createdAt: "asc" } }
          : false,
        workHistory: { where: { type: "previous" }, orderBy: { sl: "asc" } },
        promotions: { orderBy: { sl: "asc" } },
        trainings: { orderBy: { sl: "asc" } },
        foreignTrainings: { orderBy: { sl: "asc" } },
        spouse: true,
        children: { orderBy: { sl: "asc" } },
        languages: { orderBy: { sl: "asc" } },
        curriculars: { orderBy: { sl: "asc" } },
        publications: { orderBy: { sl: "asc" } },
        awards: { orderBy: { sl: "asc" } },
        disciplinaryActions: { orderBy: { sl: "asc" } },
      },
    }),
    isCareer ? getOrgPostsFlat() : Promise.resolve([] as Awaited<ReturnType<typeof getOrgPostsFlat>>),
    isCareer ? getOrgRoots()     : Promise.resolve([] as Awaited<ReturnType<typeof getOrgRoots>>),
    isCareer ? prisma.office.findMany({ orderBy: { id: "asc" } }) : Promise.resolve([] as Awaited<ReturnType<typeof prisma.office.findMany>>),
  ]);

  if (!employee) redirect("/");

  const nav = { prevStep, nextStep };

  function StepHeader() {
    return (
      <div className="mb-6">
        <p className="text-xs font-medium text-muted-foreground mb-1">
          Step {idx + 1} of {STEPS.length}
        </p>
        <h1 className="text-lg font-semibold">{current.label}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{current.desc}</p>
      </div>
    );
  }

  if (current.key === "personal") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <StepHeader />
        <PersonalForm
          employeeId={employeeId}
          data={{
            nameEn: employee.nameEn, nameBn: employee.nameBn,
            fatherNameEn: employee.fatherNameEn, fatherNameBn: employee.fatherNameBn,
            motherNameEn: employee.motherNameEn, motherNameBn: employee.motherNameBn,
            dateOfBirth: employee.dateOfBirth, gender: employee.gender,
            maritalStatus: employee.maritalStatus, bloodGroup: employee.bloodGroup ?? "",
            nid: employee.nid ?? "", passportNo: employee.passportNo ?? "",
            nationality: employee.nationality ?? "", placeOfBirth: employee.placeOfBirth ?? "",
            signatureLabel: employee.signatureLabel ?? "", photoLabel: employee.photoLabel ?? "",
            email: employee.email ?? "", mobileHome: employee.mobileHome ?? "",
            mobileOffice: employee.mobileOffice ?? "", phone: employee.phone ?? "",
            emergencyName: employee.emergencyName ?? "", emergencyRelation: employee.emergencyRelation ?? "",
            emergencyPhone: employee.emergencyPhone ?? "", emergencyMobile: employee.emergencyMobile ?? "",
          }}
          {...nav}
        />
      </div>
    );
  }

  if (current.key === "address") {
    const EMPTY_ADDR = { division:"",district:"",upazila:"",cityCorpType:"",cityCorpName:"",ward:"",houseNo:"",road:"",postOffice:"",postCode:"",thana:"" };
    const mapAddr = (a: typeof employee.presentAddress) => !a ? EMPTY_ADDR : { division:a.division??"",district:a.district??"",upazila:a.upazila??"",cityCorpType:a.cityCorpType??"",cityCorpName:a.cityCorpName??"",ward:a.ward??"",houseNo:a.houseNo??"",road:a.road??"",postOffice:a.postOffice??"",postCode:a.postCode??"",thana:a.thana??"" };
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <StepHeader />
        <AddressForm
          present={mapAddr(employee.presentAddress)}
          permanent={mapAddr(employee.permanentAddress)}
          {...nav}
        />
      </div>
    );
  }

  if (current.key === "bank") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <StepHeader />
        <BankForm
          bankAccountNo={employee.bankAccountNo ?? ""}
          bankBranch={employee.bankBranch ?? ""}
          tinNo={employee.tinNo ?? ""}
          {...nav}
        />
      </div>
    );
  }

  if (current.key === "education") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <StepHeader />
        <EducationForm
          initial={employee.educations.map((e) => ({
            degree: e.degree, institution: e.institution, subject: e.subject ?? "",
            board: e.board ?? "", gpa: e.gpa ?? "", result: e.result ?? "", passingYear: e.passingYear ?? "",
          }))}
          {...nav}
        />
      </div>
    );
  }

  if (current.key === "career") {
    const wings = orgRoots.filter((r) => r.category === "wing");
    const offices = rawOffices.map((o) => ({
      id: o.id, nameBn: o.nameBn, nameEn: o.nameEn, type: o.type as string,
      rootId: resolveOfficeRootId(o.nameEn, o.type as string, orgRoots),
    }));
    const postings = (employee.postings ?? []).map((p: any) => ({
      id: p.id, type: p.type, status: p.status, selfReported: p.selfReported, grade: p.grade,
      joinedAt: p.joinedAt ?? "", relievedAt: p.relievedAt ?? "",
      orderNo: p.orderNo ?? "", orderDate: p.orderDate ?? "",
      officeName: p.office?.nameBn ?? "", designationBn: p.orgPost?.nameBn ?? "", designationEn: p.orgPost?.nameEn ?? "",
    }));

    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <StepHeader />
        {employee.serviceHistoryLocked && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            Your service history has been verified and locked by admin. Contact admin to make changes.
          </p>
        )}
        <CareerForm
          postings={postings} orgPosts={orgPosts} wings={wings} offices={offices}
          locked={employee.serviceHistoryLocked}
          {...nav}
        />
      </div>
    );
  }

  if (current.key === "experience") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <StepHeader />
        <ExperienceForm
          initial={employee.workHistory.map((w) => ({
            designationBn: w.designationBn, designationEn: w.designationEn,
            grade: w.grade, office: w.office,
            start: w.start, end: w.end, orderNo: w.orderNo ?? "", orderDate: w.orderDate ?? "",
          }))}
          {...nav}
        />
      </div>
    );
  }

  if (current.key === "promotions") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <StepHeader />
        <PromotionsForm
          initial={employee.promotions.map((p) => ({
            designationBn: p.designationBn ?? "", designationEn: p.designationEn ?? "",
            grade: p.grade ?? "", effectiveDate: p.effectiveDate ?? "",
            orderNo: p.orderNo ?? "", orderDate: p.orderDate ?? "",
          }))}
          {...nav}
        />
      </div>
    );
  }

  if (current.key === "training") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <StepHeader />
        <TrainingForm
          initial={[
            ...employee.trainings.map((t) => ({ isLocal: true, title: t.title, institution: t.institution ?? "", country: "", startDate: t.startDate ?? "", endDate: t.endDate ?? "", duration: t.duration ?? "", result: t.result ?? "" })),
            ...employee.foreignTrainings.map((t) => ({ isLocal: false, title: t.title, institution: t.institution ?? "", country: t.country ?? "", startDate: t.startDate ?? "", endDate: t.endDate ?? "", duration: t.duration ?? "", result: t.result ?? "" })),
          ]}
          {...nav}
        />
      </div>
    );
  }

  if (current.key === "family") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <StepHeader />
        <FamilyForm
          maritalStatus={employee.maritalStatus}
          spouse={employee.spouse ? {
            nameBn: employee.spouse.nameBn ?? "", nameEn: employee.spouse.nameEn ?? "",
            dateOfBirth: employee.spouse.dateOfBirth ?? "", nid: employee.spouse.nid ?? "",
            mobile: employee.spouse.mobile ?? "", occupation: employee.spouse.occupation ?? "",
            motherNameBn: employee.spouse.motherNameBn ?? "", motherNameEn: employee.spouse.motherNameEn ?? "",
            fatherNameBn: employee.spouse.fatherNameBn ?? "", fatherNameEn: employee.spouse.fatherNameEn ?? "",
            bloodGroup: employee.spouse.bloodGroup ?? "", nationality: employee.spouse.nationality ?? "",
            passportNo: employee.spouse.passportNo ?? "", passportReceivePlace: employee.spouse.passportReceivePlace ?? "",
            passportReceiveDate: employee.spouse.passportReceiveDate ?? "", passportIssueDate: employee.spouse.passportIssueDate ?? "",
            passportExpiryDate: employee.spouse.passportExpiryDate ?? "",
          } : null}
          children={employee.children.map((c) => ({
            nameBn: c.nameBn ?? "", nameEn: c.nameEn ?? "", dateOfBirth: c.dateOfBirth ?? "",
            gender: c.gender ?? "", isSpecial: c.isSpecial, brn: c.brn ?? "",
            bloodGroup: c.bloodGroup ?? "", nid: c.nid ?? "",
          }))}
          {...nav}
        />
      </div>
    );
  }

  if (current.key === "languages") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <StepHeader />
        <LanguagesForm
          initial={employee.languages.map((l) => ({ name: l.name, proficiency: l.proficiency ?? "", comment: l.comment ?? "" }))}
          {...nav}
        />
      </div>
    );
  }

  if (current.key === "curriculars") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <StepHeader />
        <CurricularsForm
          initial={employee.curriculars.map((c) => ({ type: c.type, comment: c.comment ?? "" }))}
          {...nav}
        />
      </div>
    );
  }

  if (current.key === "publications") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <StepHeader />
        <PublicationsForm
          initial={employee.publications.map((p) => ({
            type: p.type ?? "", title: p.title, publisher: p.publisher ?? "",
            writers: p.writers ?? "", year: p.year ?? "", description: p.description ?? "",
          }))}
          {...nav}
        />
      </div>
    );
  }

  if (current.key === "awards") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <StepHeader />
        <AwardsForm
          initial={employee.awards.map((a) => ({
            type: a.type ?? "departmental", title: a.title, awardedBy: a.awardedBy ?? "",
            country: a.country ?? "", subject: a.subject ?? "", reason: a.reason ?? "", year: a.year ?? "",
          }))}
          {...nav}
        />
      </div>
    );
  }

  // disciplinary (last step)
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <StepHeader />
      <DisciplinaryForm
        initial={employee.disciplinaryActions.map((d) => ({
          type: d.type, reason: d.reason ?? "", description: d.description ?? "",
          startDate: d.startDate ?? "", endDate: d.endDate ?? "", comment: d.comment ?? "",
        }))}
        {...nav}
      />
    </div>
  );
}
