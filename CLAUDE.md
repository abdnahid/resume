# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

**BSTI e-Services** — the internal and public platform for the Bangladesh
Standards and Testing Institution. One Next.js app, several modules mounted on
path prefixes. The HR module is built and in use; the BDS store catalogue and
client accounts are new; the CM quality-certification module is the large piece
ahead.

**The roster is real.** 731 employees are imported from the HR system's export
— 441 officers, 176 staff, 114 daily basis, across all 23 offices. First loaded
2026-08-29 (554 people); the export was refreshed on 2026-09-05, and relaxing
the identity requirement the same day brought the rest. Payroll runs on it: pay scale, house rent, salary
heads, court verdicts, processed months and bank advice are all live features
over live people. Treat mistakes here as mistakes about someone's salary.

**Two kinds of user, and the route prefix decides which.** BSTI staff
(`accountType: INTERNAL`) sign in with an employee ID and are the only ones who
reach the internal modules. Clients (`CLIENT`) sign in with a mobile number or
email and live on the public surfaces. See "Auth" below — it is the rule most
likely to bite you.

## The plan — read this first

**`docs/BUILD-PLAN.md` is the current plan and the only one.** It carries the
numbered architecture decisions (D1…), the build steps with their blockers, and
the open questions that gate each step. Update it as work lands — it is meant to
stay current, not to be a snapshot.

Supporting specs in the same folder:

| File | What it is |
|---|---|
| `docs/bsti-eservices-cm-module-plan.md` | Platform kernel + CM module spec. `§` references in the plan point here. |
| `docs/bsti-eservices-lab-routing-addendum.md` | Phase 5+ — test plan resolution, lab pipeline. `A§` references point here. |
| `docs/reference-store-sample.html` | The BSTI store page the catalogue facets and card layout came from. |

`docs/sessions/` holds verbatim working logs for pieces of work that span several
sessions and both machines. **Read the relevant one before resuming that work** —
it carries the reasoning and the client's own words, neither of which is
recoverable from the code. Append a new `## Session N` section; never rewrite an
earlier one. Settled decisions graduate to `docs/BUILD-PLAN.md` as D-numbers.

| Log | Covers |
|---|---|
| `docs/sessions/testing-fees-and-parameters.md` | The test parameter catalogue (Phase G), the fee model over it, lab routing, and the sample-blinding layer. Started 2026-09-03 from `utils/textile-parameter-list.xlsx`. |

Two rules from the spec that carry real weight:

- **Read §10 (open decisions) before implementing a phase.** Where a decision is
  unresolved but a stub is needed, isolate it behind one named policy function
  so the answer changes one place (decision D8).
- **A module never owns data another module needs** (§1). It exposes a service
  the others call. The CM module asks HR who its officers are; it does not keep
  its own copy.

## Stack

- Next.js 14 App Router, TypeScript, Tailwind v4
- Prisma 7 + PostgreSQL (remote, `db.prisma.io`), client generated to
  `generated/prisma`, `@prisma/adapter-pg`
- better-auth (session cookie + `cookieCache`; `username` plugin for staff —
  username is the employee ID; `phone-number` plugin for clients, mapped onto
  `User.mobile`)
- shadcn/ui + `@base-ui/react`, lucide-react
- zod + react-hook-form (`@hookform/resolvers`) for CM form validation (D56).
  HR's forms are still plain `useState` and are being left that way.

## Layout

```
app/
  (public)/      /            landing page                    public
                 /public/*    client pages (dashboard, …)     session for private ones
  (ecommerce)/   /store       BDS store                       public
  (main)/        /hr          HR module — the built one       INTERNAL only
  (workflow)/    /workflow    placeholder                     INTERNAL only
  (accounts)/    /accounts    placeholder                     INTERNAL only
  (inventory)/   /inventory   placeholder                     INTERNAL only
  (admin)/       /admin       placeholder                     INTERNAL only
  api/           route handlers — INTERNAL except /api/auth/* and /api/client/*
  pay/           gateway hand-off and return                  session for the receipt
  login/         two-lane sign-in                             public
  register/      client sign-up (Tier 1: mobile + name)       public
  print/[id]/    outside every module — puppeteer drives it   INTERNAL only
components/      shared UI; layout/ holds Navbar, Sidebar, Footer, ModuleNavbar
lib/             modules, services, auth, prisma, types; lib/store/ is the BDS store
prisma/          schema.prisma, the seed scripts, and import/ for the HR export
                 import/xlsx-grid.ts resolves the wings' merged-cell files
docs/            the plan and the specs
utils/           source data — the HR export, the pay scale, the rent table,
                 and the wings' test-parameter files
```

The HR screens, all under `/hr/listing` unless noted:

| Route | What it is | Who |
|---|---|---|
| `/hr/listing` | the roster | all staff, scoped by office |
| `/hr/listing/fixation` | salary structure per employee, and the Process button | superadmin, officeadmin |
| `/hr/listing/salary` | processed months, payslips | scoped; own row only for others |
| `/hr/listing/salary/slip/[id]` | one payslip, screen and PDF | as above |
| `/hr/listing/bank-advice` | the letters to the bank | scoped |
| `/hr/listing/salary-heads` | the allowance/deduction catalogue | superadmin |
| `/hr/listing/cases` | court cases and verdicts | superadmin, case_officer |
| `/hr/listing/offices` | office contact, zone and bank details | superadmin; own office for officeadmin |
| `/hr/listing/roles` | who holds which role | superadmin |
| `/hr/organogram` | the chart, and `/manage` to edit it | staff; superadmin to manage |

`lib/salary/` is the payroll core — `compute.ts` and `dates.ts` are Prisma-free
and safe in the browser, `queries.ts`, `verdicts.ts`, `payroll.ts`, `slip.ts`,
`cases.ts` and `heads.ts` are the server half. `prisma/import/` reads the HR
export and is pure apart from `run.ts` and `retire.ts`.

`lib/modules.ts` is the module registry — path, bilingual labels, blurb, theme
class. Adding a module is one entry there plus its `app/(group)/<path>` folder
and a theme class in `app/globals.css`.

## Page shell

`app/(main)/layout.tsx` is navbar, then a `relative` row holding the sidebar and
`<main>`, then footer. Three things about it are load-bearing:

- **The sidebar is `absolute`, not in flow.** That is what lets `<main>` span the
  window so `PageContainer` can centre on the same 1440px box as the navbar. Put
  the sidebar back in the row and the alignment breaks — no width can fix it.
- **`PageContainer` owns width and padding.** Screens must not set their own.
- **A full-bleed screen needs `FullBleedContainer`, not a bare div.** A
  `PageContainer` screen clears the sidebar by accident: its 1440px box leaves a
  gutter of at least 240px, exactly the sidebar's width. A screen that spans the
  window has no gutter, so at `min-[1920px]` — where the sidebar is docked
  rather than a drawer — its left 240px renders *underneath* it. That is what
  hid the organogram. The clearance cannot go on `<main>`: padding it would
  shift `PageContainer`'s centred box right by half the sidebar's width and
  break the navbar alignment the out-of-flow sidebar exists to preserve. So it
  lives in `components/FullBleedContainer.tsx`, once. **And the `loading.tsx`
  must use the same container as its page** — the organogram's skeleton sat in
  `PageContainer` while the page was full-bleed, so the chart jumped sideways
  on load, which is the one thing a skeleton is meant to prevent.
- **`loading.tsx` is what makes a click feel responsive.** Every slow route needs
  one; `app/(main)/hr/loading.tsx` is the fallback for everything under /hr.

## Auth

Decisions D11–D16 in the plan. The route prefix decides the audience:
`/`, `/public/*`, `/store/*`, `/login` and `/register` are public; everything
else is INTERNAL only.

- **`accountType` gates routes. `role` is internal-only.** Never gate an
  internal route on `role` alone — clients carry the inert `role: client`.
- **Enforced in two places, on purpose.** `middleware.ts` reads `accountType`
  from better-auth's signed `session_data` cookie and refuses at the edge;
  every internal layout also calls `requireInternal()` from `lib/auth-guard.ts`,
  which re-reads the database and is the authority. Middleware fails *open* when
  the cookie is unreadable — the layout is what actually decides.
- **Adding an internal module means two things:** the prefix in
  `INTERNAL_PREFIXES` (`lib/auth-identity.ts`) *and* a `requireInternal()` call
  in its layout. Miss the second and a stale cookie gets in.
- **API routes are internal by default.** `PUBLIC_API_PREFIXES` is the
  allow-list: `/api/auth`, `/api/client`, `/api/store`, `/api/payments`. A new
  client-facing endpoint outside those four is silently refused to every client.
  Being outside the internal gate is not being unguarded — each route still
  enforces its own rule.
- **A client hitting an internal route is redirected to `/` silently** — no 404,
  no 403. Anonymous visitors go to `/login` with a `redirect` return URL,
  because they may be staff.
- **Staff may browse every client surface** and are rendered there as customers.
  `requireClient()` deliberately does not demand `CLIENT`.
- **Two login lanes, and they cannot be merged.** Employee IDs and Bangladeshi
  mobile numbers are both 11-digit numeric, so no heuristic separates them. That
  is also why mobile has its own column instead of sharing `username`.
- **better-auth has no email-less sign-up.** `/sign-up/email` requires a valid
  address, so mobile-only clients carry a synthesised `@mobile.bsti.invalid`
  placeholder. Use `displayEmail()` before showing an address — it returns null
  for placeholders. Never mail one.
- **`lib/auth-identity.ts` is Prisma-free** and imported by the edge middleware
  and by client components. Keep it that way. `lib/auth-guard.ts` is the
  server-only half.
- **OTP is not enabled.** `sendOTP` throws by design. The schema already carries
  `mobileVerifiedAt`, so SMS drops in without a migration.

## Who is in the roster, and who is not

**731 of the 815 records in `utils/employee_bio.json` are imported; 44 are
rejected** — 23 name no office, and 21 have an email address where the id
should be, mostly shared One Stop Service accounts rather than people.

**The five biographical NOT NULL columns no longer hold anyone out.** They used
to reject 118 people, and none of them is read by `lib/salary/` or
`lib/workflow/` — they are profile and display fields. Keeping someone out of
the roster meant they had no desk and no file could reach them, which is a
working problem traded for a cosmetic one. So the gaps are filled with
stand-ins and **`Employee.identityIsProvisional` says so** (107 rows), the same
discipline as the seeded bank details and the provisional standard prices.

- **Date of birth is derived from the joining year in the id**, less 25–30
  years. The offset comes from the id rather than a random draw, so a re-import
  does not move someone's birthday. **Nothing computes off it** —
  `postRetirementLeave` and `fullRetirement` are stored columns.
- **Gender and marital status get `unspecified`, not a guess.** Inferring gender
  from a Bangladeshi name is unreliable and a wrong answer is shown to that
  person on their own profile. The value is offered in the profile and edit
  forms as "Not recorded", so it renders as what it is instead of blank — a
  blank select would be silently replaced by whatever was saved next.
- Missing parents' names become `Not recorded` / `তথ্য নেই`.

**The `no bio` group is gone.** 72 records used to carry a null `bio` because
the HR system's detail API returned 500; the refreshed export has all of them,
which is where 70 of the new arrivals come from. That was the valuable group —
18 of them CM Wing, the section whose workflow chain is one desk deep.

| Reason | Count | Fixable in our schema? |
|---|---|---|
| identity incomplete | **118** | Yes — see below |
| bad id | 21 | No |
| no office | 12 | Partly |

Many of the 118 are now missing only **one** field — gender alone, or date of
birth alone — rather than all five, so the group is closer to admissible than
it was.

**The rejections are two different problems, and they need different fixes.**

**The bare minimum a person needs, per function.** Worth knowing before
relaxing anything, because the schema demands far more than any of these use:

| Function | Genuinely needs |
|---|---|
| HR roster | `id`, `nameEn`/`nameBn`, `officeId`, `status`, `category` |
| Payroll — regular | + `category` and `grade` (→ PayScale grade×step), plus an active `Posting.officeId` for scoping, rent zone and advice |
| Payroll — daily basis | + office (→ zone → `DailyWageRate`) and a `DailyAttendance` row. No grade, no fixation |
| Workflow desk | + `grade` (seniority) and `orgPostId` (→ unit → section) |

**`dateOfBirth`, `gender`, `maritalStatus`, `fatherName*` and `motherName*`
appear nowhere in `lib/salary/` or `lib/workflow/`.** They are used by the HR
profile and edit forms and for display, nothing else. They are required by
`app/api/employees/route.ts` and by NOT NULL columns, and that requirement is
the only thing keeping those 115 people out. Date of birth is the one with a
real future use (retirement), and it is *not* computed today —
`postRetirementLeave` and `fullRetirement` are stored columns.

### Desks

**479 of 731 now hold an `orgPostId`** — 303 from the original seeding, 176
placed by `npm run import:desks` on 2026-09-05. The importer does *not* set it:
the export names an office and a wing, never a sanctioned post, so joining the
two is a separate, reviewable step that writes
`utils/desk-assignment-report.txt` listing every assignment it makes.

**Matching is office → wing → grade → title.** The last two both matter:
সিএম ঢাকা has Field Officer (CM) and Assistant Director (CM) *both at grade 9*,
so grade alone put an Assistant Director on a Field Officer's desk. Routing
seniority reads the employee's grade, so nothing broke — but the desk a person
is shown at should be the job they hold.

**The two systems spell the same section differently**, with typos on both
sides — the export writes টেক্সটাইল and the organogram ট্রেক্সটাইল, the export
ব্যাকটেরিলিওজি and the organogram ব্যাকটেরিওলজি. So the wing is matched by edit
distance and anything inexact is reported separately for a human to read. The
organogram also writes **Barisal** where the office register writes
**Barishal** — the same alias the labs needed.

**252 still have no desk, and every reason is an organogram gap rather than a
matching failure:**

| Reason | Count |
|---|---|
| daily basis — not on the sanctioned strength, so there is no post to hold | 114 |
| every post at that grade is already full | 59 |
| no post at that grade in that unit | 58 |
| wing matches no unit in that office — branch offices have one flat lab where head office has sections | 18 |
| no grade | 3 |

### The organogram is not full — it is the wrong shape

Checked 2026-09-05, because 54 posts hold 170 people beyond their sanctioned
count and that looks like overcrowding. It is not.

**In aggregate there is plenty of room.** 842 sanctioned posts excluding the 12
outsourcing ones, against **617 permanent staff** — 225 spare. No daily-basis
employee holds an organogram post; they are not on the sanctioned strength at
all. Grade 9 alone has **495 posts for 333 staff**.

**The mismatch is by designation, and it is of two kinds.**

*Designations the organogram has no post for:*

| Designation | Staff | Grade | Posts at that grade |
|---|---|---|---|
| Examiner | 40 | 10 | **none anywhere** |
| Director | 9 | 4 | **none anywhere** (organogram puts Directors at 3 and 5) |
| Chief Assistant | 6 | 12 | **none anywhere** |

*And one crowded at a grade that is otherwise half empty:*

| Designation | Posts | Staff |
|---|---|---|
| Field Officer | 25 | **61** |
| Senior Inspector | 22 | **0** |
| Assistant Director | 89 | 87 |
| Inspector | 66 | 70 |

61 Field Officers are being squeezed into 25 sanctioned posts while 22 Senior
Inspector posts at the same grade stand empty. That is where the over-allocation
comes from, and no matching rule can fix it — either the sanctioned counts are
out of date or the recorded designations are.

**Do not "rebalance" to clear the over-allocation.** Simulated: a clean
capacity-respecting re-allocation of all 617 places only **359**, against 479
desked today. Releasing the excess would leave 120 more people unreachable by a
file than leaving it alone. The over-allocation is untidy; removing it is worse.

**54 posts are over their sanctioned count**, all from the original seeding,
which picked a post without checking capacity. `import:desks` never adds to
one: it only fills a seat that is free, and only ever fills a null `orgPostId`,
so a re-run cannot move anyone placed by hand.

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

## CM licence applications

Decisions D36–D40, spec §5. `lib/cm/` holds the module: `policy.ts` and
`states.ts` are Prisma-free (D9), `applications.ts` is the server half.

- **One application = one product = one factory**, and the licence goes to the
  entity that owns the factory, never to its group parent. This settled §10 #1,
  the decision the spec flagged as carrying the highest rework cost.

- **The factory decides the office, snapshotted at submission.** The routing
  path is fixed when the file starts moving (§4.2), so a jurisdiction redrawn
  next year cannot move a file already in flight. Before submission the screen
  still names the office the file *would* go to — the applicant should not
  discover that after committing.

- **The BDS attachment rule has three layers, and the UI is not one of them**
  (§3.3): the single scalar `BdsPurchase.consumedByApplicationId`, the checks in
  `attachBds()`, and a conditional `updateMany` inside a transaction that is the
  actual lock. Two concurrent attaches of one purchase — exactly one wins.
  **Swapping the product on a draft releases the previous purchases**, or
  changing your mind would consume them for ever.
  That column was `@unique` until D48 and is not any more: uniqueness there
  enforced *one purchase per application*, which a multi-standard product makes
  wrong. One purchase serving one application is enforced by the column being a
  single FK — a direction the index was never what held.
  **`attachBds()` checks membership itself**, not only at the route: it is also
  called by `fulfilPayment()` when an in-flow purchase settles, and a rule
  enforced only where the button is holds only for people who used the button.

- **Submission is not a button.** The file submits the moment the fee settles,
  because a paid fee against an unsubmitted application is money held for
  nothing. `fulfilPayment()` dispatches on payment purpose;
  `submitApplication()` is guarded on the fee being `paid` **in the database**,
  not on the caller saying so — it runs from the payment return page, which
  anyone can navigate to.

- **The application number is assigned at submission, not at creation.** A
  number quoted to an applicant should mean a file exists; numbering drafts
  burns numbers and leaves gaps that read as lost files.

- **Every unresolved policy question lives in `lib/cm/policy.ts`** with its
  default, the reasoning, and what changes when the real answer lands (D8).
  Superseded standards are attachable with a warning; a group member may not use
  the parent's purchase; the fee is a flat ৳1,000 standing in for a schedule
  that does not exist yet. None of these are settled — they are defaults chosen
  so the build could proceed.

- **`Product` is the CM product list, and an application is filed against a
  Product** (D44) — `Application.productId`, and there is no `bdsId` any more.
  `prisma/data/mandatory-315.json` is BSTI's published list of 315
  mandatory-certification products, parsed from `utils/mandatory list.pdf`
  by `prisma/import/parse-mandatory-315.py` and loaded by
  `npm run import:products`. **This is real data**, unlike the placeholder half
  of the BDS catalogue. `Product` ↔ `Bds` is many-to-many through
  `ProductStandard` because 24 of the 315 name more than one standard — a
  multi-part standard is several catalogue rows covering one article. A
  manufacturer knows they make toilet soap, not BDS 13:2021, so the product is
  what they pick and the standards follow from it.
  The picker is `GET /api/store/products/search`, which searches name, Bangla
  name, generic names and standard number over all 315 and filters in memory —
  `genericNames` is a text array and Postgres cannot substring-match inside one
  through Prisma.

- **All of a product's standards are required, not one of them** (D48). 24
  products name several and they are not alternatives: a multi-part standard is
  one specification split across catalogue rows. So an application consumes
  **one purchase per standard**, `requirementsFor()` returns a row per standard
  with its own attach/buy state, and `missingForSubmission()` names each
  unattached one rather than the set.

- **A standard bought from inside an application attaches itself** (D50).
  `Payment.attachToApplicationId` is set when the checkout route raises the
  payment — against a session already proven, never read back off the
  attacker-controlled return URL — and `fulfilPayment()` attaches the purchase
  when the money settles. A failure there is not fatal and not silent: the
  purchase is the buyer's whatever happens, and the reason travels to the
  receipt.

- **An in-flow purchase is scoped to the *application's* company, not to the
  default profile.** A purchase is party-scoped and a group member may not use
  the parent's (`purchaseOwnershipPolicy`, §10 #4), so scoping to whichever
  profile happened to be default bought the standard for one company and then
  refused it to the company that was applying — and where the default profile is
  a group parent, which D29 says never applies, the purchase was usable by
  nobody. `/api/store/checkout` reads the application's `organizationId` when
  `applicationId` is present and only falls back to the default profile
  otherwise.

- **The sandbox gateway holds the return URL it is given.** `returnUrl` and
  `cancelUrl` are columns on `SandboxGatewayTxn`, set in `createCheckout()` and
  read by the hosted page. The page used to invent a bare
  `/pay/return/<reference>`, which dropped the `?next=` that carries an in-flow
  buyer back to their draft — so the receipt showed no way back. The cancel URL
  is passed separately because both already carry a query string; appending
  `?cancelled=1` to the return URL produced a second `?` and lost the `next`.

- **A standard with a stand-in price sells at a labelled demo price** (D45,
  amended by D49). The published list gives designations, not prices, so the 375
  catalogue rows the importer created carry `isFromMandatoryList` +
  `priceIsPlaceholder` and a ৳0 stand-in. D45 refused to sell them at all, which
  was right — and left every mandatory standard unbuyable and therefore every CM
  application uncompletable. **D49 substitutes ৳500 while the platform runs on
  the sandbox gateway**, where no money can move and every payment is stamped
  `isSandbox` for ever. What D45 protected is kept by *labelling*, not
  refusing: `salePricePolicy()` in `lib/store/bds-catalog.ts` is the one place
  that decides, and `isProvisional` travels with the price to the buy button,
  the application, the store card, the detail page and the receipt. **Show the
  price it returns, never `bds.priceBdt` raw** — otherwise the page quotes ৳0
  and the gateway charges ৳500. A ৳0 is still refused. When the Standards Wing's
  prices land, load them and clear the flag; the function stops applying by
  itself.

- **Generic names come only from the source** (D46) — a bracketed alternative
  ("Suji (Semolina)") or a slashed one ("Natural Henna/Mehedi"). 29 of 315 have
  one and the rest are empty on purpose. Do not invent synonyms: this field
  feeds the picker that decides what someone may apply to certify.

- **The applicant picks a product from the 315, and the standards follow.**
  There is no free-text product field and no standard picker. **Only a product
  under mandatory certification can be applied for** — spec §1: CM operates on a
  closed list of 315 products while Metrology operates on an open one. A CM
  licence is the permission to sell a product the state has placed under
  compulsory certification; outside that list there is no licence to issue.
  `productEligibilityPolicy()` is the rule, reading `Product.isMandatory`,
  enforced in `setProduct()` and again in `missingForSubmission()` so a row
  written before the rule cannot reach the fee. An ineligible product is *shown*
  marked ineligible with the reason — a search for a genuinely unregulated
  product should answer "you do not need this licence", not "no such product".
  **Only a purchase of one of that product's standards may be attached** —
  which is what makes spec §3.3 check 3 a real test rather than a stub, now that
  the `Product` ↔ `Bds` join answers "does this standard certify this product".
  Changing the product releases every attached purchase in the same transaction
  (D41); consuming them would punish an applicant for changing their mind in a
  draft. Owning none, they buy in flow and land back on the draft with it
  already attached (D50) — §3.4 is explicit that they must never be sent to the
  store to lose it.
- **`safeNext()` guards the in-flow return.** Only an app-relative path
  survives; an absolute URL, `//host` or a scheme is discarded rather than
  corrected, so a crafted checkout cannot make the receipt page an open
  redirect.

- **A licence covers SKUs, and they are rows** (D51). One product is sold in
  many shapes — orange 200 ml in a paper can, mango 2 L in a plastic bottle —
  and `ApplicationSku` names each: brand, variant/flavour, size, packaging,
  units per pack, grade. It replaced the free-text `brandName` +
  `productDetails` pair, which held the same words but could not be counted,
  grouped, or carried onto a certificate. The spec makes **inclusion** of a new
  brand/type/size/flavour/grade its own wing service, so a licence gains SKUs
  over its life and each one has to be identifiable alone.
  **Brand and size are required; everything else is optional** — cement has no
  flavour, a biscuit has no grade. At least one SKU is needed before the fee.

- **The size type is chosen before the unit, and that is the whole design.**
  `SizeType` (weight, volume, number of items, length, cross-section, surface
  area, diameter, thickness, power, voltage, capacity, size chart) each carry
  their own `SizeUnit` rows, so a biscuit cannot be measured in litres. Seeded by
  `npm run seed:size-types` — 12 types, 43 units, a table not an enum (D7).
  `SizeKind` splits them: a `numeric` type takes a number beside its unit, a
  `categorical` one (the size chart: XS–XXXL) *is* the answer and the form stops
  asking for a number. **`resolveSize()` re-checks that the unit belongs to the
  chosen type** — trusting the pair as posted would store "Weight / litre",
  which every screen downstream would render as nonsense.
  Which size types a product may use is Phase G reference data; until it lands
  all are offered.

- **Documents are recorded, not stored.** The kernel document store does not
  exist, so the bytes are discarded and **the screen says so plainly**. A
  progress bar that silently drops the file would leave an applicant believing
  BSTI holds their trade licence when it does not.

- **Form payloads are zod schemas in `lib/cm/schemas.ts`, parsed on both sides**
  (D56). The form validates with react-hook-form + `zodResolver`
  (`mode: "onChange"`), and the route and the service parse the *same* schema —
  so the server can never be laxer than the screen. Saving parses
  `.partial()`: saving is not submitting, and a half-finished step must keep
  what was written. The submission gate stays `missingForSubmission()` on the
  server. New CM forms use react-hook-form; HR's forms are still `useState` and
  are being left alone.

- **The application is a four-step form** (D52), routed by `?step=1..4` with
  `StepNavButton` — same pattern as the profile wizard, because `loading.tsx`
  does not fire for a same-route navigation. Step 1 reads the company and
  factory back without letting them be edited there (they are shared by every
  application, so an edit inside one file would change the others); step 2 is
  the product, standards, SKUs and documents; step 3 is production capacity;
  step 4 is BSTI's questions and the declaration.

- **Two trackers, and they swap at submission.** `FormProgress` while the file
  is editable, `StageTracker` once it is not. "Who holds my file" is only a
  question after submission — before it every draft answers identically — and
  "what is still missing" is only a question before. `Gap.step` is what lets one
  gap list drive both, so a new requirement is one `missingForSubmission()` entry
  and appears in the tracker on its own.

- **Packaging artwork hangs off each SKU, not the application** (D53). A licence
  covers every brand, size and flavour separately and each is sold in its own
  wrapper. Still **metadata only** — the bytes are discarded and the field says
  so, exactly like the documents.

- **Production capacity and the questionnaire live on the application** (D54),
  because one plant may run several product lines and a capacity figure only
  means something beside the product it is for. `prefillableAnswers()` carries
  the *factory-level* answers — manpower, quality control, records — across from
  that factory's most recent other application, and never the capacity, which
  would be the wrong product's numbers.

- **The declaration is a time and a person** (D55), refused while a required
  answer is blank and withdrawable while the file is a draft.

- **The stage tracker names who holds the file**, not just where it is. Spec §8
  calls that single feature most of the perceived value of the system, because
  it replaces a phone call.

## Test parameters, fees and lab routing

Decisions D60–D66, spec addendum A§1. This is Phase G reference data — the
foundation test-plan resolution stands on, and the largest data-entry effort in
the project. The Textile lab's file is the first to arrive.

**The hierarchy is the client's, and it exists to make one mistake
impossible.**

```
Product (one of the mandatory 315)
  └── SubProduct          the variant a test plan resolves against
        └── TestParameter       fee + method + discipline live here
              └── TestSubParameter    the result-bearing line
```

- **A parameter is owned by its sub-product, never shared** (D60). The same
  parameter name recurs across sub-products carrying a different limit, a
  different fee, or both — **94 of 181** distinct (parameter, sub-parameter)
  keys in the textile file have more than one limit; `Ends and Picks per cm`
  has 10. Owning it downward means two sub-products naming the same test are two
  rows with no cell to collide in, so a mismatch is *not representable* rather
  than merely forbidden. `TestParameter.slug` is carried so "is this the same
  test" stays answerable for cross-wing reporting, and it is **not an
  identity** — "Moisture" in the textile file and in the food file are
  different tests. The closest thing to one is `(sourceSection, slug)`.

- **The limit sits at the leaf** (D61) — on the parameter when it has no
  sub-parameters, on the sub-parameter when it has them. Colour fastness to
  perspiration is one ৳700 test producing 14 separately rated readings, so the
  charge is above and the result below. The importer *asserts* this rather than
  assuming it. `LimitKind` splits four kinds a single text column cannot: `rule`
  (1,685), `declared` (224 — the manufacturer states the value and the test
  confirms it, so it becomes a form field, not a pass/fail), `cross_reference`
  (10, "As per BDS 1149"), `unspecified` (10 blanks, all *Silk Fabrics »
  Material (Purity of silk fibers)* — a gap in the source, kept visible).

- **The fee is per parameter, and a file's total is that lab's subtotal**
  (D62). Every lab produces its own file in the same format, so the same
  (product, sub-product) arrives again from the chemistry file with *its*
  parameters. The fee an applicant pays is the sum over every lab; **no total is
  stored**, because a stored one would be a per-lab figure masquerading as the
  price. A wholly physical product gets subtotal = grand total for free, with no
  zero rows. Urgent is **2× the normal fee** unless `urgentFeePoisha` overrides
  it — a nullable column and not a constant, because the wing says 2× holds
  "99.99% of the time". Money is integer poisha, as everywhere else.

- **Discipline comes from the file, not the row** (D63). Each lab's file is one
  discipline, so `TestParameter.discipline` and `sourceSection` are set at
  import. Nothing in a parameter's own data says whether it is physical or
  chemical, and it is what decides which wing supervises work sent outside.

- **Columns are found by their header, never by position.** The wings' files do
  not agree on order: the textile list runs `Standard Limit | Method | Test
  Fee`, and `lab-format-setup.xlsx` runs `Standard Limit | Test Fee | Method`.
  Read by position, one file's methods import as the other's *fees* — silently,
  because both columns are populated and nothing looks wrong until someone is
  billed for a method name. `resolveColumns()` throws rather than guessing, and
  `npm run import:test-parameters -- --dry --file=… --sheet=…` prints the
  resolved mapping so a new wing's file can be checked before it is trusted.

- **`prisma/import/xlsx-grid.ts` resolves the merged cells.** The wings' files
  carry their hierarchy in merges — a product, sub-product, standard, fee and
  duration are each written once and span the rows beneath. Read without filling
  them, every column but the sub-parameter and the limit looks 90% empty.

- **Import merges, never duplicates.** `(productId, nameEn)` on `SubProduct` is
  what lets the chemistry file add its parameters to a sub-product the textile
  file created. Adding a wing means a `SOURCE` block plus a
  `SECTION_FOR_SOURCE` entry in `prisma/seed-labs.ts`; the seed **refuses to
  write** if a parameter arrives from a section not listed there.

- **The source is `utils/textile-parameter-list-sanitized.xlsx`**, with `Main
  Product` rewritten to the mandatory-315 name — 50 "main products" collapse to
  17 with no collision, because the sub-product name already carried what
  distinguished them. `utils/textile-parameter-list.xlsx` stays as the unedited
  original. **The standard does not always agree with the published list**:
  every sewing-thread package is tested against BDS 1221 : 2011 while the list
  names BDS 1221:2021. `SubProduct.standardAsPrinted` keeps both visible rather
  than picking a winner; the question is open with the wing.

### Labs and the 2D map

- **A lab is an organogram unit** (D63). `Lab.orgUnitId → OrgUnit` covers both
  shapes: head office splits its two testing wings into sections (Textile,
  Organic Chemistry, Food & Bacteriology), a branch has one flat `Physical Lab,
  <city>` and/or `Chemistry Lab, <city>`. 46 labs seeded from the organogram
  with none invented — 8 head-office sections (the two `*-exec` units are wing
  offices, not laboratories) and 38 branch labs matched by city. The only alias
  needed is **Barisal → Barishal**: the organogram spells it one way and the
  office register the other.

- **Capability and routing are two tables, not one map** (D64). Referral is an
  administrative fact and must be stored, not derived — Barisal may send what it
  cannot test to Cumilla rather than a nearer, capable Khulna. But a map holding
  a destination directly can name a lab that cannot run the test and nothing
  checks it. So `LabCapability` is sparse ground truth each lab maintains, and
  `LabRouting` is the office × parameter map; **the resolver must require that a
  nominated destination holds the capability**. The mapping module still renders
  the 2D grid the client asked for.

- **The fallback is not hypothetical.** 21 offices have a chemistry lab and only
  **17** a physical one — Cox's Bazar, Cumilla, Faridpur and Mymensingh have no
  physical lab at all, so every physical parameter filed there falls through on
  day one.

- **Third-party testing is a mode, not a destination** (D65).
  `LabRouting.labId` is always the accountable BSTI unit; `mode: third_party`
  means the sample is physically tested outside. Custody never leaves BSTI —
  the examiner of the matching discipline selects the accredited lab, writes to
  it, and enters the result. Collapse the two and the destination letters cannot
  be grouped and the examiner has no row to record against.

- **Every seeded routing row is `isPlaceholder`** (D66). All 16,399 point at the
  owning head-office section until offices enter their own, and the flag travels
  with the row — the same discipline as the seeded bank branch details. Do not
  read a stand-in as a decision.

### Sequencing, when the workflow is built

The sub-product is a **finding, not a claim**: the applicant applies against a
BDS, and the FDO records which sub-product he found at the factory. So the test
fee cannot be quoted at application time, and there are **two payments** — the
application fee at submission and the test fee after the sampling report is
approved. Routing resolves the moment the FDO enters the sub-product, because he
needs to know which labs to seal samples for; the fee and the letters issue at
approval, and the routing is **snapshotted** then, so a referral map edited next
month cannot redirect a sample already sealed and in transit.

## Samples, and the cut between CM and the labs

Decisions D67–D73. `lib/samples/` holds it — `codes.ts` and `plan.ts` are
Prisma-free (D9), `service.ts` and `resolve.ts` are the server half.

**The application grew a level** (D67):

```
Application → ApplicationSubProduct  → ApplicationSku   the variants
                (what is applied for)
```

The applicant picks the product from the 315, then the sub-products beneath it,
then names the variants under each. `ApplicationSku.applicationId` is gone — an
article belongs to the sub-product it varies. Both rows carry `declaredBy`: the
FDO amends at inspection (he found A2 on the floor) and the applicant's
declaration is never overwritten, because "did they under-declare, or did we
find more" is asked in disputes.

**Choosing the sub-product is what lets a test fee be quoted before
inspection.** `testFeeFor()` in `lib/cm/sub-products.ts` is the one place it is
computed, provisional and final alike, so the two figures cannot diverge.

### Three identifiers, and only one is printed

**A QR is an encoded string — any phone decodes it without a session.** So
whatever is printed on a jar is readable by the FDO who binds the label *and*
the examiner who opens the box. Printing either side's working code hands it to
the other. Hence three (D68):

| token | printed | who works with it |
|---|---|---|
| `ref` | **yes** | nobody — it only resolves at `/s/<ref>` |
| `cmCode` | no | the FDO and CM staff on that file |
| `labCode` | no | the examiner and testing-wing staff |

**`labCode` is not derived from `cmCode`.** A hash needs the mapping stored
anyway, and a rotating salt would either change the code mid-test or force every
old salt to be kept for ever — a sample lives for weeks and its identifiers must
not move. The key worth rotating protects the *link*, not the code.

Codes are Crockford base32 with a check character, so a code read off a jar
cannot be transcribed into somebody else's specimen. `ref` is 128-bit: it
travels through several hands and is treated as public.

### Where the cut actually is

- **`Sample` and `LabTestOrder` carry no application column at all** (D70) — not
  hidden in the UI, absent from the table. The two sides meet only in
  `SampleRegistration`, which nothing lab-facing reads.
- **It is not an absolute barrier and must not be described as one.** One
  database means any link is a join away for whoever writes the join. What the
  shape buys is that the *accident* cannot happen and the *deliberate* act is
  visible — every crossing goes to `Reidentification`.
- **`/s/<ref>` answers by role *and* relationship** (D71). A CM officer in Dhaka
  has no standing on a Barisal file; an examiner has none on another lab's
  bench. **A refusal is identical whether the token exists or not** — a distinct
  403 would let anyone with a photographed label learn which codes are live.
  `/s` is in `INTERNAL_PREFIXES` *and* its layout calls `requireInternal()`.
- The lab view shows the sub-product, the specimen number, and **only this
  lab's** parameters. Never the brand — the variant *is* the applicant's
  identity. Test-relevant attributes (size, grade) pass; brand and company do
  not.

### The sampling plan

- **Destinations are derived, counts are entered** (D69). `resolveDestinations()`
  reads `LabRouting`, so the FDO cannot forget a lab or prepare a box nobody
  needs. **A routing row naming a lab without the matching capability is
  refused, not followed** — that is what the two tables are for (D64).
- **The count is his**, because it depends on sample quantity and destructive
  testing, which is A§1.2 data nobody has collected. He phones the lab and types
  it; `LabSampleRequirement` remembers it, so the next application arrives
  pre-filled and the calls stop by themselves. The lab owns and corrects its own
  rows, exactly like `LabCapability`.
- `commitSampling()` is one transaction — test orders, specimens and boxes
  together, because a half-written plan is a box of jars nobody can account for.
  It refuses rather than regenerating if consignments already exist.

### Custody

- **One box per destination lab, sealed by the FDO, opened only by the lab**
  (D72). The applicant carries them to each destination office's own counter, so
  the samples are in their own custody between factory and counter: the seal is
  the only control, and a broken one is a **refusal**, not a note. A short
  consignment therefore surfaces at the lab, days later and possibly in another
  city — which is why the submission letter must list seal numbers.
- **`sample_received` is the last box, not the first** (D73);
  `sample_partially_received` covers the rest. Receipt is several events with
  several dates, and testing at one lab starts independently of another.
- **Removing a variant or sub-product is refused once specimens exist.**
  Otherwise sealed jars in the applicant's custody lose the row that says whose
  they are.

## Workflow — files moving inside BSTI

Decisions D57–D59, spec §4.2. `lib/workflow/chain.ts` is Prisma-free (D9),
`inbox.ts` is the server half. Both avoid mentioning CM: `holderEmployeeId` and
`ApplicationMovement` are generic, so the next service that needs a file to move
can reuse them.

- **`office_head` is its own role.** It receives an office's submitted
  applications; `officeadmin` does not. Payroll authority and file-routing
  authority are different jobs. `User.role` is one enum, so nobody is both —
  accepted deliberately (D57).
- **A file is held by a person**, `Application.holderEmployeeId`, and every
  hand-off writes an `ApplicationMovement`. "Nobody holds it" *is* the
  definition of unclaimed — there is no parallel state to disagree with.
- **Seniority is the pay grade, not the org tree.** The organogram puts a branch
  Director in the Executive unit beside their stenographer while the officers
  sit in sibling units, so depth is useless. It is the **employee's** grade, not
  the post's: an officer on grade 9 may sit on a post graded 11.
  **`Posting.orgPostId` is null on every row** — the organogram link is
  `Employee.orgPostId`. Read the posting's org post and every desk gets a null
  section and no chain.
- **Peers cannot pass to each other.** Sideways movement would make "who holds
  it" a matter of who clicked, with no chain to read back.
- **An office head passing down is exempt from the grade test**, because an
  acting head is the top of their section whatever their own grade — which is
  the whole reason it is a role and not a designation.
- **252 of 731 employees have no `orgPostId`**, so they have no section and
  cannot be handed a file — 114 of them daily basis, who hold no sanctioned post
  by definition. See "Desks" above: what remains is organogram gaps, not
  missing matching.

## Payments

Decisions D32–D35. `lib/payments/` is the kernel money service — every module
raises fees through it, because a module that reimplements payments means the
kernel is wrong (spec §1).

- **The gateway is an interface, and the sandbox is the default.**
  `provider.ts` defines `PaymentProvider`; `sandbox.ts` implements it;
  `registry.ts` picks one from `PAYMENT_PROVIDER`, defaulting to the sandbox
  because the gateway decision is still open and the safe default is the one
  that cannot move money. **Stripe is not an option** — it does not support
  Bangladesh as a merchant country and does not support BDT. SSLCommerz is the
  realistic candidate, and the interface is shaped after it and the e-Challan:
  session → browser redirect → IPN → server-side validation.

- **Only `settlePayment()` may mark a payment paid, and only on a `verify()`
  answer.** The return URL is attacker-controlled and an IPN is an
  unauthenticated POST from the open internet — both are hints that something
  happened, never evidence of what. The IPN body is read for a reference and
  nothing else. The sandbox implements `verify()` against its **own ledger
  table**, `SandboxGatewayTxn`, precisely so the call is a real question to an
  external system rather than a payment row reading its own status. Nothing
  outside `lib/payments/sandbox.ts` may touch that table.

- **Settlement is idempotent and fulfilment happens once.** `settlePayment()`
  claims the row with an `updateMany` guarded on `status: { not: "paid" }`, so
  when the browser return races the IPN both verify but only one sees
  `newlyPaid` — and only that one grants anything. Verified with three
  concurrent settlements producing one purchase.

- **A gateway that collects too little grants nothing.** `amountMatches()` is
  checked on every settlement and the mismatch is written to the row, not just
  logged.

- **Money is integer poisha, never taka floats.** 15% VAT on a whole-taka price
  is fractional for most prices (৳350 → ৳52.50). `splitFee()` is the one place
  the Income/VAT split happens, and `income + vat === total` holds by
  construction — the e-Challan settles one payment into two accounts and they
  have to reconcile. Whether the catalogue price is VAT-inclusive is still
  open, which is why it is one function (D8).

- **The reference is the reconciliation key** (spec §6) — not name, not amount,
  not date, because the payer may pay "from anywhere" and all three collide.
  It is printed on demand notes and will travel by SMS and paper, so **holding
  it is not proof of identity**: `/pay/return/[reference]` requires the session
  and 404s for anyone but the payer.

- **A sandbox payment is labelled everywhere it is visible** — the buy button,
  the hosted page, the receipt, and `Payment.isSandbox` on the row for ever. An
  unlabelled fake payment screen is the one thing here that could genuinely
  mislead someone.

## Court cases and verdicts

Decisions D22–D24. `/hr/listing/cases` is the register; `case_officer` and
`superadmin` are the only roles that reach it, and a case officer sees **every**
office because cases are run by a central legal cell, not per office.

- **Recording a verdict applies it.** The two are not separable — a verdict
  sitting on the register without touching pay is the failure this exists to
  prevent. `POST /api/cases/[id]/verdicts` writes the verdict, calls
  `imposeVerdict()`, and deletes the verdict again if that throws, so the
  register can never disagree with the salary.
- **A verdict raises fixation versions; nothing else knows about verdicts.**
  Salary processing and the bank advice were not touched — they still just pay
  the version in force. `imposeVerdict()` raises a punished version for the
  window and a restoring version for the day after it ends.
- **A verdict that outlives the fiscal year still binds.** `getFixationContext()`
  returns every un-revoked verdict with its window, and both the preview and the
  save route call `verdictOn(verdicts, validFrom)`. So next July's annual
  fixation picks the punishment up on its own.
- **Verdict-derived versions are not hand-editable** — the route returns 409 and
  points at case management. Changing the punishment means lifting the verdict.
- **A verdict cannot reduce a month already disbursed.** `imposeVerdict()`
  refuses if a processed month falls inside the window.

**Arrears are a difference, not a replay.** A verdict-derived version records the
version it displaced (`baselineFixationId`), so the pay withheld in a month is
`baseline.netSalary - process.netSalary` — both already stored. `revokeVerdict()`
with `arrearsOrdered` sums that across exactly the months paid under the punished
version and writes one `SalaryArrear`. The next month processed adds it, stamps
it paid in the same transaction, and the bank advice follows because it has
always summed `netSalary`. Re-processing a month never pays an arrear twice.

**Clause order matters** and is fixed in `applyVerdict()`: demote the grade, come
down the increments, resolve the scale basic, cut it by percentage, then
suppress heads. `withhold_increment` deliberately changes no arithmetic — it
constrains the *next* annual fixation and is surfaced as a note.

**`reduceDerivedAllowances` answers "rest remains same".** Off (the default), a
`basic_percent` clause halves what is paid as basic but leaves house rent and
other percentage allowances on the full scale figure. On, they follow it down.
It is per verdict, because the court order decides.

## Conventions that have bitten us

These are decisions D9, D10 and D14 in the plan. The first two cost a broken
build once.

- **Split Prisma-free code from server code inside a module.**
  `lib/store/bds-catalog.ts` holds facets, query shape and URL encoding — no
  Prisma import, so client components can use it. `lib/store/bds.ts` holds the
  queries. A client component importing the query module pulls `pg` into the
  browser bundle and the page 500s with `Can't resolve 'fs'`.

- **Never call `useSearchParams()` in a shared layout component.** It opts every
  page using that component out of static prerendering, and the build fails on
  all of them at once. Pass active state down as a prop instead — `Footer` takes
  `module`, `ModuleNavbar` takes `activeHref`.

- **Don't await a session on a static or ISR page.** It opts the page out of
  static generation — the same failure class as `useSearchParams()` above. The
  store's account chip and the landing masthead read it client-side with
  `authClient.useSession()` instead (`ModuleNavbar`, `LandingAuth`). `/` and
  `/store` are static and should stay that way.

- **Public surfaces list citizen services, not modules.** `lib/services.ts` is
  the public-facing registry; `lib/modules.ts` is the internal one. Showing a
  visitor the module grid advertises five destinations they get refused at.
  `Footer` takes `audience` and defaults to `"public"` — pass
  `audience="internal"` in an internal layout.

- **Server components read the DB directly.** No API route in between unless the
  browser needs it. `app/api/*` exists for client-side mutations.

- **Bilingual throughout.** Most records carry `nameEn`/`nameBn`,
  `titleEn`/`titleBn`. Bengali uses the `font-bn` / `font-bn-serif` families.

- **Theme tokens, not raw colours.** `app/globals.css` §2 defines the token
  block; each module overrides `--primary` and friends via its theme class.
  Write `text-primary`, `bg-card`, `border-border` — never a hex value.

- **Every screen sits in `PageContainer`.** Its width and padding are the
  navbar's own — `max-w-[1440px]`, `px-5 lg:px-10` — so the page lines up with
  the chrome above it. Screens previously picked their own: `max-w-5xl`, `6xl`
  and `7xl`, some centred and some left-aligned, and several painted a second
  `bg-slate-50` over the layout's background. Do not set a width on a page root;
  put it in the container or nowhere.

- **The sidebar is out of flow, and that is what makes the alignment work.**
  It is `absolute` inside the layout's `relative` row, so `<main>` spans the
  whole window and centres on the same 1440px box as the navbar. While the
  sidebar was in flow the main column began 240px in and *no* width could line
  the two up. Below `min-[1920px]` the sidebar slides in as a drawer over a
  backdrop; at or above it there is room in the left gutter and it stays
  docked. `SidebarContext` holds that state because the toggle lives in the
  navbar, and it closes the drawer on navigation, on Escape, and when the
  window widens past the breakpoint. `useOptionalSidebar()` exists for the
  print views, which render the navbar outside the provider.

- **Every route that can be slow needs a `loading.tsx`.** Next renders it the
  instant a navigation starts, so without one a click does nothing visible until
  the server component finishes — around a second on the fixation and employee
  screens. `components/Skeleton.tsx` holds the pieces; a skeleton should echo
  the shape of the page it stands in for, so content does not jump when it
  lands. A `loading.tsx` covers its own segment and every nested one, so
  `app/(main)/hr/loading.tsx` is the fallback and the heavy tables override it.

- **`loading.tsx` does not fire for same-route navigation.** Moving between
  profile wizard steps only changes `?step=`, so the segment never re-mounts.
  Those use `StepNavButton`, which wraps `router.push` in `useTransition` —
  that is what makes the pending state cover the navigation rather than just
  the click.

- **Don't ship dead links or dead buttons.** A nav entry that 404s is worse than
  no entry. Where a feature is not built yet, render it disabled with a short
  note saying when it arrives.

## Commands

```bash
npm run dev            # dev server (:3000, or :3001 if taken)
npm run build          # prisma generate && next build
npx tsc --noEmit       # typecheck — fast, run it before declaring done
npx prisma db push     # apply schema.prisma to the database
npx prisma generate    # regenerate the client — always pair it with db push

npm run seed:bds       # BDS store catalogue — 6 divisions, 55 standards
npm run seed:size-types # SKU size types and their units — 12 types, 43 units
npm run seed:org       # organogram
npm run seed:grades    # NPS-2015 grades onto OrgPost
npm run seed:employees # employees — SUPERSEDED by import:employees, kept for reference
npm run seed:salary    # pay scale, house rent slabs, office zones, daily wage rates, banks

npm run import:report    # dry run over utils/employee_bio.json — writes a report, no DB writes
npm run import:employees # import/refresh employees from the HR export (upsert, never deletes)
npm run import:retire    # remove employees the export does not contain (dry run without --yes)
npm run import:products  # the 315 mandatory products (--dry to report without writing)
npm run import:desks     # place employees on organogram posts (--dry to report without writing)

npm run import:test-parameters # a wing's test-parameter file → the Phase G catalogue (--dry)
npm run seed:labs              # labs from the organogram, capability + the routing map (--dry)

# The 315 list is parsed from the PDF first; the JSON it writes is committed,
# so this is only needed if the source PDF changes.
pdftotext -layout "utils/mandatory list.pdf" /tmp/mand.txt
python3 prisma/import/parse-mandatory-315.py /tmp/mand.txt
```

Seeds are idempotent — they upsert on natural keys and are safe to re-run.

**Build gotcha:** don't run `npm run build` while `npm run dev` is running. They
share `.next` and the build fails with confusing prerender errors. Stop dev
first; if a build fails oddly, `rm -rf .next` and retry before believing it.

## Database

There is **no migration history** — `prisma/migrations/` does not exist and
schema changes are applied with `prisma db push`. The database is remote and
shared by every machine, so the schema stays in step on its own, but there is no
record of how it got that way and no rollback.

This has already produced drift: an empty `Bds` table existed in the database
that was never in `schema.prisma`. Adopting migrations before real client
purchase data lands is recommended in the plan (step 3). Until then:

- Always `prisma db push` from a clean `schema.prisma`, and read the data-loss
  warnings rather than reflexively passing `--accept-data-loss`.
- Check whether a table already exists before assuming a model is new.

## Working from two machines

Home and office, never at the same time. The remote database is shared, so only
the code needs care.

**Starting a session:**

```bash
git pull                # always, before anything else
npm install             # deps, and regenerates the Prisma client
npx prisma generate     # cheap; guarantees the client matches schema.prisma
npx tsc --noEmit        # confirms the client matches the code
```

`npm install` does regenerate the client — the project's own `postinstall` is
`prisma generate`. Ignore the `npm warn allow-scripts` lines it prints: those
are about *dependency* lifecycle scripts (esbuild, puppeteer, msw, and Prisma's
own preinstall), not the project's postinstall, which runs. Running
`npx prisma generate` again after a pull is harmless and takes under a second,
so the step above is belt and braces rather than a fix for a known break.

**Where the client actually goes stale is your own schema edits.**
`npx prisma db push` applies `schema.prisma` to the database but does **not**
regenerate the client. Change the schema, push it, and `npx tsc --noEmit`
reports a pile of "Property 'x' does not exist on type" errors that read as
broken code when only the client is behind. Always pair them:

```bash
npx prisma db push && npx prisma generate
```

`npm run build` regenerates first (`prisma generate && next build`), so a full
build hides this; `tsc` does not.

**You do not need `prisma db push` after a pull.** The database is remote and
shared, so whichever machine made the schema change already applied it. Push
only when *you* have edited `schema.prisma`.

**Ending a session — leave nothing behind:**

```bash
npx tsc --noEmit    # clean typecheck
git add -A && git commit
git push
```

The rule that matters: **push before switching machines.** An uncommitted change
on the machine that is powered off is unreachable. If a session ends mid-task,
commit the work in progress rather than leaving it in the working tree.

**Work on `main`.** Feature branches were dropped on 2026-08-27 — one developer,
two machines, no reviewers, so a branch only adds a merge step. Commit to `main`
and push.

**`.env` is not in git** and must not be. Copy it to the other machine by hand
once; `.env.example` lists the keys it needs. Both machines point at the same
remote database, so the same `DATABASE_URL` works on both.

**Regenerated artefacts are ignored** — `generated/prisma`, `.next`,
`tsconfig.tsbuildinfo`. Never commit them; they conflict on every pull. The
generated client is not in git, which is why `npm install` regenerates it.

**Scripts that touch the database need `dotenv`.** A one-off `npx tsx foo.ts`
importing `lib/prisma` will fail with `ECONNREFUSED` unless the file starts
with `import "dotenv/config";` — Next loads `.env` itself, a bare tsx script
does not. The seeds all do this already.

**Batch writes against the remote database.** Round trips to `db.prisma.io`
cost roughly half a second each, so a loop of per-row `upsert`s is minutes
where `createMany` is seconds — the 315-product import took ~100 minutes as a
loop and under one batched. Prisma's interactive `$transaction` also times out
at 5s, so do not wrap hundreds of updates in one.

## Scope note

`lib/employee.json` is an unreferenced leftover fixture. `lib/employees.json` is
still used by `prisma/seed.ts`. Don't confuse the two.
