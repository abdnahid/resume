---
description: "Payroll — versioned fixation, the two pay regimes, attendance, bank advice, and per-office scoping"
paths:
  - "lib/salary/**"
  - "app/(main)/hr/listing/**"
  - "app/api/salary/**"
  - "prisma/seed-salary.ts"
---

## Salary

Fixation is **versioned**, and that is the whole design. An employee has many
`SalaryFixation` rows over their service, not one.

- **One version per fiscal year is the ordinary case** — 1 July to 30 June. A
  special increment, a promotion or a punishment mid-year raises a *new* version
  from its own effective date; the version it displaces is truncated to the day
  before and stamped `supersededAt`. Nothing is ever overwritten.
- **A version that has been paid cannot be edited.** `SalaryProcess` rows point
  at the version they were paid from, so editing one would restate a disbursed
  salary. The route refuses with 409 and tells the operator to raise a new
  version instead.
- **A month is paid from the version in force on its last day**, not from
  whatever is current now — so back-processing an earlier month after an
  increment still pays that month's structure. `supersededAt` is deliberately
  *not* a disqualifier there.
- **The two payrolls are run separately, from separate screens.** `POST
  /api/salary/process` takes a `category` of `regular` or `daily_basis`.
  Regular staff are processed from the fixation screen; daily-basis staff from
  the attendance register, where the days were just entered — recording and
  paying belong to one sitting. Omitting `category` still runs both, which the
  single-employee path relies on.

- **Sidebar → Salary Fixation is a collapsible with two children**, Regular and
  Daily basis, because they are the two pay regimes. The fixation screen lists
  regular staff only; daily-basis staff appear on the attendance register
  instead. Listing them as unfixable rows on the fixation screen only invited
  the mistake it was meant to prevent.

- **Attendance is a record, not a prompt.** `DailyAttendance` holds days worked
  per employee per month, entered at `/hr/listing/attendance` whenever suits.
  Days used to exist only as a column on `SalaryProcess`, so they came into
  being when a month was paid and could only be corrected by undoing it —
  impossible once the advice was issued. The pay run now *reads* the register
  and **skips anyone without a record**: defaulting to the 22-day ceiling would
  quietly pay a full month to somebody nobody had counted. A row locks once its
  month is paid, so the register can never disagree with the payslip.

- **Daily-basis staff cannot be fixated, and the route says so.** `POST
  /api/salary/fixation` refuses `category: daily_basis` with 409. Without that
  guard the screen happily created one — and because processing checks the
  category *before* it looks for a fixation, the fixation was never paid: the
  screen showed grade 9 at ৳28,100 a month while the payslip paid 22 × ৳800.
  Not wrong money, but a record that lied, which is worse for being quiet.
  They still appear on the fixation screen, showing their daily rate and a
  disabled action rather than being hidden — a roster that silently omits 93
  people raises more questions than it answers.

- **Daily-basis staff are paid by the day, not by fixation.** `EmployeeCategory`
  splits the roster: `officer` (grades 1–11), `staff` (12–20), `daily_basis`
  (no grade at all) and `outsourcing`. Daily-basis pay is
  `DailyWageRate` for the office's zone × days worked, capped at
  `MAX_PAID_DAYS` (22) and defaulted to it — the process screen asks for days
  before writing anything. They hold no `SalaryFixation` and never can, because
  a fixation needs a grade.
- **The category comes from the employee id, then the grade.** Ids are
  `YYYY`+`CCC`+`NNNN` — joining year, entry code, serial — and code `103` is the
  daily-basis series. Everyone else splits on grade. Only `daily_basis` is read
  off the code, because the id records where someone *entered*: seven code-102
  staff have since been promoted into officer posts and the id cannot change.
- **Validate id structure, not just length.** BD mobile numbers are also 11
  digits and the HR export has four of them in the id field. `parseEmployeeId()`
  checks the joining year and a known entry code.
- **The chain is fixation → `SalaryProcess` → bank advice.** `SalaryProcess`
  snapshots basic/gross/deduction/net; the bank advice sums `netSalary` over a
  month. Change what a fixation pays and everything downstream follows.
- **Payroll is per office, end to end.** Processing, the month sequence and the
  advice are all scoped to one office — each pays its own staff on its own
  cheque and its letter names itself. An officeadmin is pinned to their own
  office whatever the request body says; a superadmin must name one.
  `lib/salary/payroll.ts` holds the scoping and sequencing.
- **`employeesOfOffice()` is the one definition of "this office's staff"**, and
  every office-scoped query uses it — the fixation list, payroll, the advice and
  their routes. The **current posting** decides, not `Employee.officeId`: a
  transfer is recorded as a posting and the legacy column can be left behind.
  Someone with no current posting falls back to the column, so nobody becomes
  invisible to every office and therefore unpayable. The two must never be
  compared directly — an employee visible on one office's screen and payable by
  another is the bug this prevents.
- **Scope on the id you were given.** `getEmployees()` once filtered only when
  `role: "officeadmin"` was passed *as well as* `officeId`, so a caller that
  supplied only an `officeId` listed all 402 employees. It now scopes on
  `officeId` or `employeeId` whenever either is present.
- **Processing needs superadmin or officeadmin.** The gate was once
  `accountType === "INTERNAL"` alone, which let any member of staff run payroll
  for the whole institute.
- **Months run in order, and going back means undoing.** A month cannot be
  processed while a later one already is; `DELETE /api/salary/process` removes
  one so you can. Deleting is refused once the advice is issued, and any arrear
  the deleted month settled goes back to pending — otherwise the money vanishes.
- **The salary slip is read, never recomputed.** `lib/salary/slip.ts` reads the
  `SalaryProcess` row and the fixation version it names, so a slip keeps showing
  what was actually paid after a later fixation supersedes that one.
  `/hr/listing/salary/slip/[id]?month=&year=` serves both the on-screen view and
  the PDF — its toolbar is `print:hidden`, so Puppeteer renders the same page
  and there is no second layout to keep in step.
- **PDF rendering goes through `launchBrowser()` in `lib/pdf.ts`**, never
  `puppeteer.launch()` directly. Puppeteer's bundled Chromium is often absent;
  the helper falls back to a system Chrome and honours
  `PUPPETEER_EXECUTABLE_PATH`.
- **Each office banks for itself.** `Bank` + `OfficeBankAccount` hold the bank,
  branch, branch address, the designation a letter is addressed to, and the
  account a cheque is drawn on. The advice used to hardcode all four — Sonali,
  Tejgaon, head office's account — so every office's letter went to Dhaka.
  Managed at `/hr/listing/offices`; a superadmin edits any office, an
  officeadmin only their own.
- **The house rent zone is superadmin-only, even on an officeadmin's own
  office.** It multiplies every salary there — moving an office into the Dhaka
  zone lifts house rent from 40% to 50% of basic — so it is not a change the
  office being paid gets to make for itself.
- **An advice snapshots its bank block at issue.** A letter is a record of what
  was sent, so a branch that changes later must not rewrite an old one. Rows
  issued before those columns existed fall back to the office's current details.
- **Seeded branch details are improvised** except Head Office's, and carry
  `isPlaceholder`. The office setup screen flags them; saving an office is what
  marks it confirmed. Do not treat them as real bank data.
- **An issued advice freezes its month.** That is what keeps the stored totals
  and the entries recomputed from `SalaryProcess` from ever drifting apart, so
  no separate snapshot table is needed.

**A fixation is basic salary plus heads.** Basic comes from the versioned
`PayScale` grid (`grade` × `step`); every allowance and deduction is a
`SalaryHead` attached as a `SalaryFixationItem`. Items snapshot the head's
`basis` and `value` at save time, so editing a head later never rewrites a
settled fixation.

- **Heads are data, not code.** Superadmin manages them at
  `/hr/listing/salary-heads`. Three bases: `fixed`, `percent_of_basic`, and
  `house_rent_rule` — the last consults the government slab table for the
  employee's office zone (`Office.houseRentZone`), a percent of basic with a
  floor. Head management is superadmin-only on purpose: an officeadmin who could
  invent allowances could raise their own office's pay.
- **`lib/salary/` splits the same way `lib/store/` does (D9).**
  `compute.ts` and `dates.ts` are Prisma-free and imported by the fixation
  modal; `queries.ts` is the server half. Importing `queries.ts` from a client
  component drags `pg` into the browser bundle.
- **`computeSheet()` is called by both the preview and the route.** That is why
  the sheet an operator approves is the sheet that gets stored — do not add a
  second calculation path.
- **The pay scale is versioned too.** A new gazetted scale is a new `PayScale`
  row; old ones are never deleted, because historical fixations must keep
  resolving against the scale they were made under.
- **Basic salary is never typed.** It is the grid's figure for the grade and
  step. A reduced salary is a court verdict applied on top, not a number an
  operator invents. The route ignores any `basicSalary` in the request body.
- **The NPS-2015 grid lives in `prisma/data/nps-2015.ts`** as the generating
  rule, not 350 loose numbers: an increment is `rate`% of the *current* basic
  **rounded up** to the next 10, where the rate is 3.75% at grade 2, 4% at
  grades 3–4, 4.5% at grade 5 and 5% from grade 6 down. `buildGrade()` throws
  if a grade's series does not land on its published maximum, so the seed fails
  loudly rather than paying wrong money. `utils/payscale.xlsx` overrides it if
  present.

