import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProfileCompletion } from "@/lib/profile-completion";
import ProfileSidebar from "./_components/ProfileSidebar";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const employeeId = session.user.username ?? "";

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      presentAddress: true,
      permanentAddress: true,
      educations: true,
      postings: true,
      workHistory: true,
      promotions: true,
      trainings: true,
      foreignTrainings: true,
      spouse: true,
      children: true,
      languages: true,
      curriculars: true,
      publications: true,
      awards: true,
      disciplinaryActions: true,
    },
  });

  if (!employee) redirect("/");

  const completion = getProfileCompletion({
    employee,
    educations: employee.educations,
    postings: employee.postings,
    workHistory: employee.workHistory,
    promotions: employee.promotions,
    trainings: employee.trainings,
    foreignTrainings: employee.foreignTrainings,
    spouse: employee.spouse,
    children: employee.children,
    languages: employee.languages,
    curriculars: employee.curriculars,
    publications: employee.publications,
    awards: employee.awards,
    disciplinaryActions: employee.disciplinaryActions,
  });

  return (
    <div className="flex h-full overflow-hidden">
      <ProfileSidebar
        completion={completion}
        profileStatus={employee.profileStatus}
        employeeId={employeeId}
      />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
