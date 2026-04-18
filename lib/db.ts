import employeeData from "./employee.json";
import type { EmployeeRecord } from "./types";

/**
 * Simulates a DB query. In a real app this would hit Prisma/Drizzle/etc.
 *
 *   const record = await db.query.employees.findFirst({ where: eq(employees.id, id) });
 *
 * For now we return the local fixture and pretend it was awaited.
 */
export async function getEmployeeRecord(
  employeeId: string,
): Promise<EmployeeRecord> {
  // Artificial latency to mimic a real query (removed in prod).
  await new Promise((resolve) => setTimeout(resolve, 0));

  if (employeeId !== employeeData.personal.employee_id) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  return employeeData as EmployeeRecord;
}

export const DEFAULT_EMPLOYEE_ID = employeeData.personal.employee_id;
