# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

**BSTI e-Services** — the internal and public platform for the Bangladesh
Standards and Testing Institution. One Next.js app, several modules mounted on
path prefixes. The HR module is built and in use; the BDS store catalogue and
client accounts are new; the CM quality-certification module is the large piece
ahead.

**The roster is real.** 554 employees were imported from the HR system's export
on 2026-08-29, replacing the demo data — 348 officers, 113 staff, 93 daily
basis, across all 23 offices. Payroll runs on it: pay scale, house rent, salary
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
  login/         two-lane sign-in                             public
  register/      client sign-up (Tier 1: mobile + name)       public
  print/[id]/    outside every module — puppeteer drives it   INTERNAL only
components/      shared UI; layout/ holds Navbar, Sidebar, Footer, ModuleNavbar
lib/             modules, services, auth, prisma, types; lib/store/ is the BDS store
prisma/          schema.prisma, the seed scripts, and import/ for the HR export
docs/            the plan and the specs
utils/           source data — the HR export, the pay scale, the rent table
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
npx prisma generate    # regenerate the client (also runs on npm install)

npm run seed:bds       # BDS store catalogue — 6 divisions, 55 standards
npm run seed:org       # organogram
npm run seed:grades    # NPS-2015 grades onto OrgPost
npm run seed:employees # employees — SUPERSEDED by import:employees, kept for reference
npm run seed:salary    # pay scale, house rent slabs, office zones, daily wage rates, banks

npm run import:report    # dry run over utils/employee_bio.json — writes a report, no DB writes
npm run import:employees # import/refresh employees from the HR export (upsert, never deletes)
npm run import:retire    # remove employees the export does not contain (dry run without --yes)
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
git pull            # always, before anything else
npm install         # runs prisma generate automatically
```

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
`tsconfig.tsbuildinfo`. Never commit them; they conflict on every pull.

## Scope note

`lib/employee.json` is an unreferenced leftover fixture. `lib/employees.json` is
still used by `prisma/seed.ts`. Don't confuse the two.
