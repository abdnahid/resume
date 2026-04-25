import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EMPLOYEE_FIXATION = {
  employeeId: "20051030005",
  grade: undefined,
  basicSalary: undefined,
  validFrom: undefined,
  validThru: "12-31-2026",
  salaryStatus: undefined,
};

export async function GET() {
  const { employeeId, grade, basicSalary, validFrom, validThru, salaryStatus } =
    EMPLOYEE_FIXATION;

  const fixation = await prisma.salaryFixation.update({
    where: { employeeId },
    data: {
      ...(grade !== undefined && { grade }),
      ...(basicSalary !== undefined && { basicSalary }),
      ...(validFrom !== undefined && { validFrom }),
      ...(validThru !== undefined && { validThru }),
      ...(salaryStatus !== undefined && { salaryStatus }),
    },
  });

  return NextResponse.json({ fixation });
}
