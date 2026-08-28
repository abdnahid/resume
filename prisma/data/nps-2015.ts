/**
 * The National Pay Scale 2015 grid.
 *
 * Source: `utils/Increment-Chart-2015.pdf` — a scanned image with no text
 * layer. Rather than transcribe ~350 numbers by eye, the chart was read three
 * independent ways (visually, and by two OCR passes) and reconciled against the
 * generating rule below, which reproduces every cell exactly and lands on each
 * grade's published maximum.
 *
 * **The rule:** an annual increment is `rate`% of the *current* basic, rounded
 * **up** to the next 10 taka. The rate is not the same for every grade — that
 * is what makes the grid impossible to guess:
 *
 *   grade 2         3.75%
 *   grades 3–4      4.00%
 *   grade 5         4.50%
 *   grades 6–20     5.00%
 *
 * Grade 1 is a fixed salary (নির্ধারিত) with no increments.
 *
 * `max` is the ceiling printed in the chart's "নতুন স্কেল" column, and
 * `buildGrade()` asserts the generated series ends exactly on it. If a future
 * edit breaks the grid, the seed fails rather than quietly paying wrong money.
 *
 * Two rows where the chart contradicts itself, resolved in favour of the step
 * columns (the printed range label is a summary, the steps are the data):
 *   grade 8  — label reads 23000–55460, steps end at 55470
 *   grade 11 — label reads 12500–32240, steps end at 30230
 */

export type GradeSpec = {
  grade: number;
  /** Step 0 — the grade's initial basic. */
  initial: number;
  /** Percent of current basic added each year. Null for the fixed grade 1. */
  rate: number | null;
  /** How many increments the grade has above its initial. */
  increments: number;
  /** The published ceiling; the generated series must end here. */
  max: number;
};

export const NPS_2015: GradeSpec[] = [
  { grade: 1,  initial: 78000, rate: null, increments: 0,  max: 78000 },
  { grade: 2,  initial: 66000, rate: 3.75, increments: 4,  max: 76490 },
  { grade: 3,  initial: 56500, rate: 4.0,  increments: 7,  max: 74400 },
  { grade: 4,  initial: 50000, rate: 4.0,  increments: 9,  max: 71200 },
  { grade: 5,  initial: 43000, rate: 4.5,  increments: 11, max: 69850 },
  { grade: 6,  initial: 35500, rate: 5.0,  increments: 13, max: 67010 },
  { grade: 7,  initial: 29000, rate: 5.0,  increments: 16, max: 63410 },
  { grade: 8,  initial: 23000, rate: 5.0,  increments: 18, max: 55470 },
  { grade: 9,  initial: 22000, rate: 5.0,  increments: 18, max: 53060 },
  { grade: 10, initial: 16000, rate: 5.0,  increments: 18, max: 38640 },
  { grade: 11, initial: 12500, rate: 5.0,  increments: 18, max: 30230 },
  { grade: 12, initial: 11300, rate: 5.0,  increments: 18, max: 27300 },
  { grade: 13, initial: 11000, rate: 5.0,  increments: 18, max: 26590 },
  { grade: 14, initial: 10200, rate: 5.0,  increments: 18, max: 24680 },
  { grade: 15, initial: 9700,  rate: 5.0,  increments: 18, max: 23490 },
  { grade: 16, initial: 9300,  rate: 5.0,  increments: 18, max: 22490 },
  { grade: 17, initial: 9000,  rate: 5.0,  increments: 18, max: 21800 },
  { grade: 18, initial: 8800,  rate: 5.0,  increments: 18, max: 21310 },
  { grade: 19, initial: 8500,  rate: 5.0,  increments: 18, max: 20570 },
  { grade: 20, initial: 8250,  rate: 5.0,  increments: 18, max: 20010 },
];

/** One increment: `rate`% of current basic, rounded up to the next 10 taka. */
export function nextStep(current: number, rate: number): number {
  return Math.ceil((current * (1 + rate / 100)) / 10) * 10;
}

/**
 * Every step of a grade, index 0 being the initial basic.
 * Throws if the series does not end on the published maximum — the guard that
 * makes this file safe to edit.
 */
export function buildGrade(spec: GradeSpec): number[] {
  const steps = [spec.initial];
  for (let i = 0; i < spec.increments; i++) {
    steps.push(nextStep(steps[steps.length - 1], spec.rate!));
  }
  const last = steps[steps.length - 1];
  if (last !== spec.max) {
    throw new Error(
      `NPS-2015 grade ${spec.grade}: generated series ends at ${last}, but the chart's maximum is ${spec.max}.`,
    );
  }
  return steps;
}

/** The whole grid as flat rows, ready to seed. */
export function buildGrid(): { grade: number; step: number; amount: number }[] {
  const rows: { grade: number; step: number; amount: number }[] = [];
  for (const spec of NPS_2015) {
    buildGrade(spec).forEach((amount, step) =>
      rows.push({ grade: spec.grade, step, amount }),
    );
  }
  return rows;
}
