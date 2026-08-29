/**
 * Pay for daily-basis staff.
 *
 * They sit outside the national pay scale entirely — no grade, no step, no
 * allowances and no deductions — so they cannot hold a `SalaryFixation`. Pay is
 * the daily rate for their office's zone times the days credited, and nothing
 * else.
 *
 * Prisma-free (D9), so the process screen and the route share one calculation
 * exactly as fixation-based pay does.
 */
import type { HouseRentZone } from "@/lib/salary/compute";

/**
 * The most days that may be paid in a month, whatever the calendar or the
 * attendance says. A government ceiling, not an arithmetic one.
 */
export const MAX_PAID_DAYS = 22;

/** What the screen starts every daily-basis employee at. */
export const DEFAULT_PAID_DAYS = MAX_PAID_DAYS;

export type DailyRate = { zone: HouseRentZone; amount: number };

export type DailyPay = {
  daysWorked: number;
  dailyRate: number;
  /** Rate × days. There is nothing else, so gross and net are the same. */
  netSalary: number;
  warnings: string[];
};

/** The rate in force for a zone. Null when none is configured for it. */
export function rateFor(rates: DailyRate[], zone: HouseRentZone | null): number | null {
  if (!zone) return null;
  return rates.find((r) => r.zone === zone)?.amount ?? null;
}

/**
 * Days are clamped rather than rejected: an operator typing 25 means "the whole
 * month", and the ceiling is what the rule actually says. The clamp is reported
 * so the sheet can show that it happened.
 */
export function computeDailyPay(dailyRate: number, requestedDays: number): DailyPay {
  const warnings: string[] = [];

  let days = Math.floor(Number(requestedDays));
  if (!Number.isFinite(days) || days < 0) {
    days = 0;
    warnings.push("Days worked was not a number — counted as 0.");
  }
  if (days > MAX_PAID_DAYS) {
    warnings.push(`${requestedDays} days requested; at most ${MAX_PAID_DAYS} may be paid in a month.`);
    days = MAX_PAID_DAYS;
  }

  return {
    daysWorked: days,
    dailyRate,
    netSalary: days * dailyRate,
    warnings,
  };
}
