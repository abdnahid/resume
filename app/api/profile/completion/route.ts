import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProfileCompletion } from "@/lib/profile-completion";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  return NextResponse.json({ completion, profileStatus: employee.profileStatus });
}
