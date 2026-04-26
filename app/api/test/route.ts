import { NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";

// const EMPLOYEE_FIXATION = {
//   employeeId: "20051030005",
//   grade: undefined,
//   basicSalary: undefined,
//   validFrom: undefined,
//   validThru: "12-31-2026",
//   salaryStatus: undefined,
// };
// const BANK_ACCOUNT_MAP: Record<string, string> = {
//   "20220010021": "4404001031001",
//   "19953010010": "4404001031002",
//   "20020030007": "4404001031003",
//   "20105010089": "4404001031004",
//   "20101030016": "4404001031005",
//   "20051030005": "4404001031006",
//   "20051030006": "4404001031007",
//   "20101030015": "4404001031008",
//   "20220010022": "4404001031009",
//   "20220010023": "4404001031010",
//   "20150040012": "4404001031011",
//   "20180060003": "4404001031012",
// };

export async function GET() {
  // let updated = 0;
  // for (const [id, bankAccountNo] of Object.entries(BANK_ACCOUNT_MAP)) {
  //   const result = await prisma.employee.updateMany({
  //     where: { id },
  //     data: { bankAccountNo },
  //   });
  //   if (result.count > 0) {
  //     console.log(`  Updated ${id} → ${bankAccountNo}`);
  //     updated++;
  //   } else {
  //     console.warn(`  SKIP: employee ${id} not found`);
  //   }
  // }
  return NextResponse.json(`\nDone — employee(s) updated.`);
}
