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
| `docs/sessions/testing-fees-and-parameters.md` | The test parameter catalogue (Phase G), the fee model over it, lab routing, and the sample-blinding layer. Started 2026-09-03 from `utils/textile-parameter-list.xlsx`; Session 5 (2026-09-08) imports the Chemical Wing's two files and takes the catalogue to 4,767 parameters; Session 6 the same day apportions the urgent fee to the wing's published totals and builds the `/labs` module over the lot; Session 7 corrects the premise — parameters are universal, not head office's — and adds the office coverage form; Session 8 finds one article split across two wings' sub-products and folds them back together; Session 9 (2026-09-09) fixes the single-sub-product picker and records Barishal's first real coverage entries; Session 10 records the mixed physical/chemical routing scenario; **Session 11 rebuilds the model on the client's answers — capability per office with a manner, the 109,802-cell routing map replaced by an optional preference**; Session 12 settles the fee convention from the files' own merges; Session 13 imports the physical sheet, giving Ceramic Tiles its 9 mixed tests. |
| `docs/sessions/workflow-desks-and-office-heads.md` | Files moving inside BSTI, end to end: the `/workflow` board and organogram placement, the `office_head` role, then the whole CM inspection flow — correction rounds, the inspection plan and office order, sampling and sealing, the two reports, and the letters that follow approval. Started 2026-09-05, covering work begun 2026-09-02 with step 8a; Session 2 runs to 2026-09-07. |

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
  (workflow)/    /workflow    CM files on the move            INTERNAL only
  (labs)/        /labs        test catalogue + the 2D map     INTERNAL only
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
- **The navbar identity is text, not a link.** `Name (employee id)` over the
  designation, with a caret beside it opening the account menu. It used to be a
  button to `/public/dashboard` — the *client* account page — so a member of
  staff clicking their own name landed on the citizen-facing surface.
  `components/layout/AccountMenu.tsx` holds it, and both navbars use it:
  `ModuleNavbar` renders it directly, `Navbar` (the /hr one) shares its `useMe()`
  hook.
- **The title shown is the desk's, where the desk is credible.**
  `displayDesignation()` in `lib/workflow/chain.ts`. The post *is* the job — a
  Deputy Director (CM) moved onto the Deputy Director (Halal Certification) desk
  is doing the Halal job while the roster still says CM — so the desk's title
  wins. **But two thirds of desks were inferred, not recorded:**
  `import:desks` seats people on whatever post at their grade is free when the
  title does not match, so **325 of 481** desked staff sit on a post of a
  different *rank* from their recorded designation — 248 apparently promoted (an
  Office Assistant on a Security Guard desk) and 77 apparently demoted. So the
  rule is: take the desk's title when it **agrees in rank** with HR's record,
  and fall back to the record when it does not, because a rank disagreement is
  the signal that the seat was a guess. 157 titles come from the desk today; the
  fallback stops firing by itself as the organogram is corrected.
  **A post held in additional charge is exempt** — there the rank difference
  *is* the fact, and the charge was recorded by hand, so a DD acting as Director
  reads "Director". Display only: seniority still follows the person.
- **`GET /api/me` supplies what the session does not** — designation, office and
  the desks held. `ModuleNavbar` reads the session client-side on purpose (the
  store is ISR and awaiting a session server-side would opt every catalogue page
  out of static generation), so it has a name and a role and nothing else. The
  route is **internal by default and stays that way**: everything it returns is
  employment data, and the navbar only calls it when the session says
  `INTERNAL`, so no client provokes the refusal.
- **The account menu shows the desks you hold; it does not switch between
  them.** Nobody holds two today — `User.role` is a single enum, and a post held
  in additional charge (D74) is the only second desk anyone can have. So it
  marks what you act from rather than offering a control that would do nothing.
  When someone genuinely holds two, the row appears on its own and wiring the
  choice through to `toDesk()` is the work that follows — a behaviour change,
  not a display one.
- **`loading.tsx` is what makes a click feel responsive.** Every slow route needs
  one; `app/(main)/hr/loading.tsx` is the fallback for everything under /hr.

**The client surfaces have their own shell**, `app/(public)/public/layout.tsx` —
`ClientNavbar`, `<main>`, `Footer`. It exists because it was in *none* of them:
the dashboard, the applications and the company profiles each rendered their own
`min-h-screen` column and their own footer and no navbar at all, so a client
reading their own application had no way back to the store, no account menu and
no sign-out. Pages under it supply content and their own width — 1100px for the
listings, 900px for the forms — and must not render a footer or a
`min-h-screen` wrapper of their own.

- **`ClientNavbar` is the citizen counterpart of the store's `Navbar`** — a thin
  wrapper over `ModuleNavbar` listing services, never the module grid (D14).
  `/pay/return` renders it directly rather than through the layout, because it
  cannot share one with `/pay/sandbox`: the sandbox page impersonates a
  *gateway's* hosted page, and a BSTI navbar on it would misrepresent whose page
  the payer is looking at.
- **The landing page keeps its own masthead.** It is a designed government
  header with the bilingual institution name, not a module navbar.

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

**480 of 731 now hold an `orgPostId`** — 288 from the original seeding, 182
placed by `npm run import:desks` on 2026-09-05, then 5 office heads seated by
`npm run import:office-head-desks`, 4 head-office Directors by a second
`import:desks` run once Directors were graded 4, and the CM wing's two Deputy
Directors by `npm run import:hr-corrections`, all the same day.

Of the 251 who hold none, **one is holding a post in additional charge** and so
has a section anyway (`actingOrgPostId`, D74), and **one is retired**.
`import:desks` skips both: someone acting in a senior post must not be seated on
a junior seat that falls vacant, which would silently demote the officer running
the wing. The importer does *not* set it:
the export names an office and a wing, never a sanctioned post, so joining the
two is a separate, reviewable step that writes
`utils/desk-assignment-report.txt` listing every assignment it makes.

**The picker falls back to `designationBn`.** `EMPLOYEE_DESK_SELECT` used to
select the English designation alone, and 42 desked employees carry only the
Bangla — 3 Deputy Directors, 15 Assistant Directors and 11 Field Officers — so
`deskRank()` filed every one of them under **Other** while `RANK_TABLE` already
held the Bangla pattern that matches them. Fixed 2026-09-05.

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

**249 are seatable and still have no desk, and every reason is an organogram gap
rather than a matching failure:**

| Reason | Count |
|---|---|
| daily basis — not on the sanctioned strength, so there is no post to hold | 114 |
| every post at that grade is already full | 60 |
| no post at that grade in that unit | 52 |
| wing matches no unit in that office — branch offices have one flat lab where head office has sections | 20 |
| no grade | 3 |

**One Director is still among them** — Gazi Md. Nurul Islam of Chemical Testing,
in "no post at that grade in that unit". His wing's Director post exists and is
graded 4, but it sits in the `Executive (<wing>)` child unit rather than the
wing his own wing name resolves to. **That is a matching flaw worth knowing**:
the Bengali wing name matches the closest *leaf* section, so the sibling
`Executive` and `Training` units fall out of scope. It is what hid the CM wing's
free Deputy Director seat and reported "every post at that grade is full" while
a seat stood empty one unit over.

**MOBIN UL ISLAM is a grade-4 Director sitting on a Deputy Director (Textile)
post** from the original seeding; `import:desks` only ever fills a null
`orgPostId`, so it does not move him.

### Can a CM application be worked in every office?

**All 23 offices now have an `office_head`**, assigned 2026-09-05 by
`npm run import:office-heads`. One thing still blocks the flow — see the
cross-section note below.

**Head Office's is the CM wing's acting Director** — Md. Alauddin Hussain
(19953010017), a Deputy Director (CM) on grade 6 holding the vacant Director
post in additional charge. The HR export recorded him as পরিচালক on grade 4,
which is the charge showing through rather than his substantive rank; that is
the confusion D74 exists to end. It had also put his Bangla name in `nameEn`,
because the detail API returned 500 for his record. Corrected 2026-09-05 by
`npm run import:hr-corrections`, which also **retired Md. Golam Rabbani**
(19953010019) — he held `office_head` and the DD (CM) desk while no longer
serving, and the export still lists him, so `import:retire` would never have
caught him.

**Who holds it.** A designated *Head of Office* where one exists (three people
are, and all three have no grade at all, so ranking by seniority would have
skipped exactly the right person); otherwise the seniormost officer of the
office, whatever wing he comes from. **At head office it is the CM wing's
seniormost officer, not the building's** — the Director (CM) post is vacant, so
DD (CM) acts in it, which is why D57 made this a role and not a designation.

**Payroll was not collateral damage.** `User.role` is a single enum, so granting
`office_head` to someone holding `officeadmin` silently removes their payroll
authority — and the natural head was the officeadmin at 14 of 23 offices. The
two are different jobs (payroll can be run by the accounts head, by any
officer), so the script moves `officeadmin` to the office's accounts desk where
one exists and **reports the office rather than guessing** where none does.
Payroll still runs everywhere meanwhile, because a superadmin is not
office-scoped.

**15 offices have no local payroll admin** and need one nominated at
`/hr/listing/roles`: Barishal, Sylhet, Chittagong, Rangpur, Mymensingh, Cumilla,
Faridpur, Cox's Bazar, Bogura, Dinajpur, Noakhali, DMI, Narsingdi, Rajshahi,
Narayanganj.

**Every office head now holds a desk**, seated 2026-09-05 by
`npm run import:office-head-desks`. Five did not, and each could receive a file
and then not pass it on — `candidates()` works from `desksOfOffice()`, and
someone with no post has no section, so the picker came back empty and the file
stopped dead in his hands.

**`import:desks` cannot seat a head, and that is why this is its own step.** It
matches office → wing → grade → title, which is right for the officers who do
the work. But a branch head is whoever is seniormost *whatever wing he came
from*, and the desk he holds is the single post in the office's **Executive**
unit — so matching on his own wing looks for a Metrology desk inside Executive
and finds nothing. Narsingdi, Narayanganj, Bogura, Rajshahi and Khulna all
failed exactly there.

**Two heads had no grade at all**, which is why `import:office-heads` picked
them (a designated *Head of Office* outranks seniority) and why nothing could
seat them. The grade is taken **from the post they are seated on** — Deputy
Director (CM), grade 6 — not invented, and the report names every such fill.
The same rule filled Rajshahi's missing English designation.

### The hand-off the routing needs, and does not yet allow

A branch office head may come from any wing — a DD (Metrology) at Barisal
receives CM applications — and must pass the file **into the CM section**,
where AD (CM) → FO (CM) carries it on. When the sampling letter is approved a
letter goes to the **testing wing head** of Chemical or Physical at that office,
who is simply the seniormost officer of that section: DD, AD or Examiner by
availability. At head office the CM wing director receives, and the
Physical/Chemical wing director gets the letter after approval.

**`candidates()` blocks the first step.** It restricts even the office head to
`sectionUnitId === sender.sectionUnitId`, so a Metrology head cannot pass a CM
file into the CM section at all. D58 needs amending: the head's first hand-off
crosses into the *service's* section, and movement stays within that section
afterwards.

**The testing wing head is whoever holds the wing's Director post** — not the
seniormost officer of the section (D94, superseding what this file said before,
which was written before additional charge was a column). Still no new table:
the post answers it.

The live roster shows why seniority does not: head office's **Physical Testing
Wing holds two grade-4 Directors**, one in the Director (Physics) post and one
sitting on a Deputy Director (Textile) post from the original seeding. They tie
on grade *and* on designation rank, so "seniormost" returned whichever the sort
happened to put first — not a way to address a letter.

So `wingHeadForLab()` asks the post, in one order: the officer holding it
substantively; the officer holding it in **additional charge** (D74) — the rare
case, and what that column exists for; otherwise **nobody, said out loud**.
Head office's **Chemical Testing Wing is vacant today** with nobody acting, so
that third answer is live: an unaddressed letter is fixed in a minute, a letter
addressed to the wrong Director is not noticed at all.

**A branch office has no testing wing** — its labs hang off the branch itself —
so `officeHeadFor()` answers there, which is what `office_head` already means.

Everything else is in place. **22 of 23 offices have CM-desked staff** — from 23
at Chittagong down to 1 at Patuakhali. The exception is **DMI, which has none**,
and by the jurisdiction default receives nothing anyway.

Eleven offices have only grade 9 in their CM section. That used to make everyone
there a peer, so a file could move head → FDO → back up and no further;
**Cox's Bazar was deadlocked outright**, five desks and not one hand-off
possible between them. Two changes fixed it: the grade tie is broken by
designation rank (D78), so AD (CM) → FO (CM) works inside the band, and a
hand-off to the same level is allowed (D79). **No desk in any office can now
reach nobody.** Patuakhali, with a single CM desk, still needs its office head
to be someone outside that section.

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
| ~~Director~~ | ~~9~~ | ~~4~~ | **Fixed 2026-09-05** — the nine Director posts moved from grade 5 to 4, which is where all nine serving Directors are. |
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

**A desk in the wrong office is released and re-matched.** The original seeding
put 15 people on posts in another office's subtree — a file routed to their own
office would have arrived at a desk in someone else's. `import:desks` releases
those before matching, so it is idempotent except for that one repair. 6 of the
15 found a seat at home; the other 9 have none at their grade there, which is
the honest answer.

**Do not "rebalance" to clear the over-allocation.** Simulated: a clean
capacity-respecting re-allocation of all 617 places only **359**, against 470
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

- **All three ways in are on the apply page.** `/public/applications/new` picks
  an existing factory, registers a **new factory** for an existing company
  inline, or sends someone to set up a **company that does not exist yet** —
  which is where an applicant who has just discovered the plant is unregistered
  actually is. `FactoryForm` is shared with the company page rather than copied,
  because the district field decides which office receives every application
  from that plant and two copies would drift.
  **The company wizard is deliberately not duplicated inline.** It asks for
  everything `missingForSubmission()` later demands; a stripped-down second form
  would create companies that cannot submit, with the wall arriving *after* the
  product, the SKUs and the fee. So `/public/companies/new` takes a `?next=`
  and the wizard lands there instead of on the company page — the applicant
  comes straight back to the picker. `safeNext()` (now `lib/nav.ts`, Prisma-free
  so a client component may import it) discards anything not app-relative.
  **A factory added here is listed with its BSTI office resolved before the
  Apply button beside it is worth pressing** — the form refreshes the server
  render rather than splicing the row in, because the office is derived from the
  district on the server and a row without it hides the one fact that matters.

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

- **The fee is per parameter — and the file's *merges* say how it wrote it**
  (D119). A fee merged across a parameter's sub-parameter rows is that
  parameter's fee, stated once; a fee written into each row separately is that
  row's share, and the parameter's fee is their **sum**. Both are one price per
  parameter, and `Grid.isFilled()` is the only thing that tells them apart once
  merges are resolved. The textile file merges it — 266 merged ranges in the fee
  column, exactly matching the parameter column — and **all 104 of its packages
  reconcile to their stated total that way, none to the other**.
  `chemical-physical-mixed-test.xlsx` merges the parameter and not the fee,
  writing 105 into three separate cells, and its stated ৳2,200 only adds up if
  all three count. **Never resolve merges without recording that they
  happened.**
- **`import:test-parameters` takes a list of files, one per section**
  (`SOURCES`), and `--only=<key>` runs one. Adding a wing's `.xlsx` is a block
  there plus an entry in **both** `SECTION_FOR_SOURCE` (`prisma/seed-labs.ts`)
  and `HEAD_OFFICE_SECTION` (`lib/labs/coverage.ts`) — miss the second and head
  office cannot declare those tests in-house. `physical-civil` →
  `Civil Physical, Head Office` was added 2026-09-10 for the ceramic-tiles file.
- **A product is matched by its standard first, then its name** (D114). The
  wings write "Ceramic Tiles" where the published list says "Ceramic Tiles -
  Definitions, Classification, Characteristics and Marking". Matched on prefix
  and number and **never the year**, the rule the chemical importer measured at
  92% against 5% by name.
- **The textile file publishes a package total, and the importer ignored it for
  five sessions.** `Total Test Fee`, column J. That is why all 104 textile
  packages carried no stated figure and every one of its 713 parameters sat at
  `doubled_assumed`. Read since 2026-09-09; all 104 reconcile. It still has no
  *urgent* total, so those stay `doubled_assumed` — that part was right.
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

- **One article, one sub-product — and `(productId, nameEn)` is not enough to
  guarantee it** (D111). The sub-product name is the residue left after the
  product name and the standard are stripped from a block heading, so a wing
  that tests the article *as a whole* leaves the product name again: the
  Chemical Wing filed `Sanitary Napkins » "Sanitary Napkin"` beside the textile
  file's `"Sanitary Towels/ Napkins"`, and two rows were written for one
  article. **The sub-product is the level a test plan resolves against** (D67),
  so that means an applicant picks one and is tested for half the standard and
  charged for half — a live draft was doing exactly that.
  **`npm run labs:reconcile` is the step that fixes it, and it must be run after
  any wing's import** — both importers end by saying so. The rule: a wing
  contributing a row named after the *product* is testing the whole product, so
  its tests apply to **each** variant another wing named. Three products were
  affected; Disposable Diapers' single chemical package now sits on each of its
  eight sizes, because each size is a separate sample.
- **Folded, not deleted, and identified by name** (D112). `SubProduct.foldedAt`.
  Deleting does not survive a re-import — the importer keys on
  `(productId, nameEn)`, finds nothing and writes the row straight back.
  Detecting the re-import by comparing *parameter names* is unsafe, because the
  same test names recur across genuinely different variants (D60): *Suji »
  Small particle grade* carries the same eight names as *Large particle grade*,
  and that rule proposed folding 201 products. Counting rows per wing breaks
  once a fold has happened, because the variants then carry both wings and
  eight-against-eight reads as a disagreement when it is the same eight rows.
  So the signal is that the **name is the product's name**, de-pluralised with
  one edit per ten characters — enough for *Non Oven wipes*, tight enough that
  *Sanitary Towels/ Napkins* stays a variant.
- **A folded row is not a package and must be excluded wherever sub-products are
  offered or counted** (D113). Seven queries filter `foldedAt: null`, and
  `addSubProduct()` refuses one by id as well — a rule enforced only where the
  button is holds only for people who used the button.
- **Import merges, never duplicates.** `(productId, nameEn)` on `SubProduct` is
  what lets the chemistry file add its parameters to a sub-product the textile
  file created. Adding a wing means a `SOURCE` block plus a
  `SECTION_FOR_SOURCE` entry in `prisma/seed-labs.ts`; the seed **refuses to
  write** if a parameter arrives from a section not listed there. **Then
  `npm run labs:reconcile`** — see D111 above, and do not skip it.

  **But `TestParameter` is upserted on `(subProductId, nameEn)`, and
  `sourceSection` is not in that key.** So a merge only happens where the two
  wings name *different* tests on the same sub-product. If the chemistry file
  lists a parameter the textile file already carries for that sub-product — and
  the textile file does carry pH, ash content and fibre composition — the second
  import **updates the first row rather than sitting beside it**, flipping its
  `discipline` and `sourceSection` and replacing its fee. D62 says an applicant
  pays the sum over every lab; an overwritten row is counted once, at whichever
  file was imported last. Nothing is wrong today — one file, one discipline,
  nothing to collide with — and the fix, if the wings do overlap, is to put
  `sourceSection` in the key. **Checked when the chemical files arrived
  (2026-09-08): it does not bite.** Only three sub-products meet textile at all
  — Sanitary Napkin, Disposable Diaper, Nonwoven Wipes — each contributing one
  microbiological count, and none of the names collides. Re-check when a third
  wing's file lands; the query is in the session log.

- **`discipline` is a per-file default, not a claim about the test** (D63).
  All 713 textile rows are stamped `physical` because that is the file they came
  from, and **77 of them are chemistry by their own method designation** — fibre
  composition under `BDS ISO 1833` (quantitative *chemical* analysis: dissolve
  one component, weigh the residue), pH of aqueous extract under
  `BDS ISO 3071:2006`, oil content on the four jute-bag products, and ash
  content and water-soluble extract on Absorbent Cotton. That is ৳75,047 of the
  file's ৳425,803. It costs nothing today, and it matters in two places:
  discipline decides which wing supervises a sample sent to a third-party lab
  (D65), and `LabCapability` is checked per parameter. **No sub-product is
  wholly chemical** — all 64 that carry such a parameter mix both — which is
  exactly the case per-parameter routing exists for: Absorbent Cotton's ash
  content can be sealed for a chemistry lab and its absorbency for the physical
  lab, off one inspection.

- **The Chemical Wing's two files are in** (2026-09-08), and they are the bulk
  of the catalogue: **4,767 parameters over 491 sub-products and 203 of the 315
  products**, against textile's 713 over 104. (The catalogue stands at **4,774
  over 488 offered** today: D111 folded three duplicate rows and copied one
  chemical package onto each of eight diaper sizes.) They arrive as `.docx`, so
  `prisma/import/docx-grid.ts` is the Word counterpart of `xlsx-grid.ts` —
  reading the ZIP central directory with `node:zlib` rather than taking a
  dependency. Four rules earn their keep there, each of which cost a survey:
  **the published list owns the product name** (match on the standard's
  `(prefix, number)` and never its year — 92% against 5% by name); **the
  sub-product is the residue** once the serial, the standard and the listed name
  are removed, which is what makes `Sweetmeats` → *Rasogolla, Chomchom, Kalojam*
  and `Chocolate` → *Milk, White*; **a row with no fee, no limit and no method
  is a category title**, folded into its children's names as
  `Total Plate Count, per gm, Max (Microbiological Requirements)` — which is
  also what stops `pH (Dye)` and `pH (Developer)` colliding on
  `(subProductId, nameEn)`, 42 collisions down to 5; and **the wing's stated
  total is a checksum**, which proved those last 5 were duplicated source rows.
  **`sourceSection` is `chemical-food` or `chemical-non-food`**, and both are in
  `SECTION_FOR_SOURCE`. 25 blocks name a product the mandatory list does not and
  were **not** imported; `--names` prints all 387 sub-product names, 27 of which
  still carry a serial fragment worth tidying.
- **The urgent fee is stored, not derived** (D99), and `priceUrgent()` in
  `lib/labs/urgent-fee.ts` is the one place it is decided — Prisma-free, shared
  by both importers, `npm run fees:urgent` and the catalogue screen. Both
  `feePoisha` and `urgentFeePoisha` are NOT NULL and always filled. **Do not
  reintroduce a doubling rule at read time**; sum the column.
  The rule has three cases (D102), and `urgentFeeSource` records which applied:
  - **2× the normal fee** — the ordinary case. `doubled` where the wing's
    published urgent total is exactly twice its normal total and therefore
    proves each part doubles (2,323); `doubled_assumed` where the file
    publishes no urgent total to check against (732, of which 713 are the whole
    textile file).
  - **equal to the normal fee** (`same_as_normal`, 106) where the urgent
    turnaround is not shorter — there is no faster service to charge for.
  - **apportioned** (1,606) where the published urgent total is *not* twice the
    normal one. Every parameter in the package is scaled by the same multiplier
    — Poultry Feed's ৳25,000 ÷ ৳20,000 = 1.25 — largest-remainder so the parts
    sum to the published figure **exactly**. 383 of the 385 apportionable
    packages now match the wing's own urgent total to the poisha.
  **An apportioned figure is right for the package and unverified per test.**
  D100's evidence says the surcharge really falls on some tests and not others
  (Aldrin, Dieldrin, aflatoxin, microbiology cannot be hurried), and equally
  says why it cannot be imported: subset-sum is ambiguous wherever fees repeat.
  `WHERE "urgentFeeSource" = 'apportioned'` is the list to correct when the wing
  answers. `manual` — typed in the catalogue screen — is **never** recomputed
  over, and is subtracted from the package total before the rest is apportioned.
- **`SubProductPackageFee` keeps each wing's own stated totals** (D103), keyed
  `(subProductId, sourceSection)`. Not a grand total — D62 still forbids that —
  but one wing's published subtotal, which is three things at once: the
  checksum made durable (23 disagreements are open with the Chemical Wing and
  are now queryable rather than printed once by a dry run), what the
  apportionment divides by, and the only place a turnaround survives a second
  wing filing for the same sub-product.
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

- **[SUPERSEDED by D116 — kept because the reasoning still holds]** Capability
  and routing were two tables, not one map (D64). Referral is an
  administrative fact and must be stored, not derived — Barisal may send what it
  cannot test to Cumilla rather than a nearer, capable Khulna. But a map holding
  a destination directly can name a lab that cannot run the test and nothing
  checks it. So `LabCapability` is sparse ground truth each lab maintains, and
  `LabRouting` is the office × parameter map; **the resolver must require that a
  nominated destination holds the capability**. The mapping module still renders
  the 2D grid the client asked for.

- **The fallback is not hypothetical, and it got larger.** Once the labs that
  exist only in the organogram were closed (D106), **11 offices have a working
  chemistry lab and only 7 a physical one** — head office, Barishal, Sylhet,
  Chittagong, Rangpur, Khulna and Rajshahi. Cox's Bazar, Cumilla, Faridpur and
  Mymensingh have chemistry only. **The other 12 offices have no laboratory at
  all**, so every parameter filed at one of them falls through to another office
  on day one. That is what the map is for.

- **Third-party testing is a mode, not a destination** (D65).
  `LabRouting.labId` is always the accountable BSTI unit; `mode: third_party`
  means the sample is physically tested outside. Custody never leaves BSTI —
  the examiner of the matching discipline selects the accredited lab, writes to
  it, and enters the result. Collapse the two and the destination letters cannot
  be grouped and the examiner has no row to record against.

- **A seeded routing row is `isPlaceholder`** (D66) and points at the owning
  head-office section until an office enters its own. The flag travels with the
  row — the same discipline as the seeded bank branch details — so do not read a
  stand-in as a decision. There are **109,802** cells; entry began 2026-09-08
  and the live figure is on `/labs`, which is the point of that screen. Never
  quote a count from here as though it were current.

- **22 of the 46 seeded labs are closed, because they do not exist in
  practice** (D106). The organogram gave every office but DMI a laboratory
  unit; the client named the eleven offices that actually have one — head
  office, Chittagong, Khulna, Rajshahi, Rangpur, Faridpur, Cumilla, Sylhet,
  Barishal, Mymensingh, Cox's Bazar. `npm run labs:operational` holds the list.
  **Closed, not deleted**: the organogram unit is real even where the bench is
  not, and deleting would take `LabCapability` and every `LabRouting` row with
  it. Nothing was repointed — all 22 held no capability and no routing cells.

### The model, as it stands after D114–D118

- **`Product → SubProduct → TestParameter → TestSubParameter`**, one-to-many
  down, exactly one parent up. Unchanged; the client confirmed it 2026-09-09.
- **A product is identified by a unique BDS number** (D114). `Product.bdsId` is
  `@unique` — verified: no BDS is claimed by two products. It is the identity,
  not the whole requirement: 24 products are certified against several parts of
  one specification and D48 still needs all of them, so those stay in
  `ProductStandard`. **Sub-products inherit it**; `SubProduct.bdsId` is gone and
  `standardAsPrinted` remains, because 43 products have a wing citing a
  different edition.
- **A parameter carries fee, urgent fee, method, limit and now its own
  turnaround** (D115). `packageDays()` in `lib/labs/turnaround.ts` derives a
  package's duration as the **longest** of its tests — which is what a
  turnaround is, and what finally makes a partial selection datable.
- **Capability is an office's, and sparse** (D116). `ParameterCapability`
  `(officeId, parameterId, manner, labId?)`. A row exists only where an office
  has said it covers a test; **silence means it does not**. `manner` is
  `in_house` or `third_party`.
- **There is no third-party laboratory table, deliberately.** The system records
  *that* an office sends a test out and enters the result through its own
  examiner, not *which* company runs it — the accountable unit is always BSTI.
  That is D65's principle, and it is what lets **Faridpur cover a physical test
  with no physical bench**.
- **Keyed on the office, not the lab**, for exactly that reason. `labFor()` in
  `lib/labs/coverage.ts` names the bench for in-house work — discipline at a
  branch, section at head office — and null is the honest answer for work sent
  out.
- **`RoutingPreference` is optional and only breaks a tie** (D116). No row means
  the field officer chooses from the capable offices. D64's point survives —
  referral is administrative, so Barisal may prefer Cumilla over a nearer,
  capable Khulna — but nobody fills in a grid to say so.
- **A destination is an office** (D117). `Consignment` and `LabTestOrder` are
  addressed to one, with the bench named when there is one. The alternative was
  to invent a nominal laboratory per discipline at every office, in a module
  whose 46 labs came from the organogram with none invented.
- **Nothing is seeded any more.** `seed:labs` creates the laboratories and
  stops. Seeding capability would put words in offices' mouths, which is what
  D107 had to be written to undo.

### The laboratory module — `/labs`

Decisions D102–D118. `lib/labs/` holds it: `urgent-fee.ts`, `grid.ts` and
`access.ts` are Prisma-free (D9); `catalogue.ts`, `mapping.ts` and
`coverage.ts` are the server half.

- **A test parameter belongs to no office** (D107). The catalogue is
  institution-wide: a wing's file is where a test was *written down*, not a
  claim about who can run it. `seed:labs` had to point capability somewhere so
  sampling would resolve before anybody had entered anything, and it pointed all
  4,767 rows at the head-office section owning each file — which reads exactly
  like "only head office can run these". **Every seeded `LabCapability` row
  carries `isPlaceholder`**, the same discipline as `LabRouting.isPlaceholder`.
  Nothing was deleted: clearing them would stop the CM sampling flow dead, and a
  flagged stand-in that still resolves beats a gap. Screens show **declared**
  and **seeded** as different numbers — do not add them together.

- **Three screens over three kinds of fact, with three different owners**, and
  `lib/labs/access.ts` is the one place that says which:

  | Screen | The fact | Who writes it |
  |---|---|---|
  | `/labs/catalogue` | what a test *is* and what it costs | superadmin |
  | `/labs/coverage` | **the entry form** — what this office handles and can test | that office |
  | `/labs/registry` | what a laboratory can *run*, test by test | that lab's own office |
  | `/labs/mapping` | where a sample *goes*, cell by cell | that office |

  The fee schedule is superadmin's because an office able to edit it could
  reduce what its own applicants pay. Capability is the lab's because nobody
  else can find out — an instrument out of service is not a fact head office
  discovers. Routing is the office's, which is the whole reason D64 stores it
  rather than deriving it. **Reading is open to every member of staff**: an FDO
  planning a visit and an examiner expecting a box both have reason to look.

- **The map is one package at a time, always.** 23 offices × 4,774 parameters is
  109,802 cells, and no screen should try to be all of it. The question people
  bring is "for this product, where does each test go", which is one package
  wide and 23 offices across — parameters down the rows, every office as a
  column, and the cell reads the lab's own name when the sample stays put and
  `→ Faridpur` when it travels.

- **Reading is every office; writing is one column.** That asymmetry is the
  design: "who else sends this to Faridpur" is a question the whole grid should
  answer at a glance, while the decision itself belongs to one office and
  nobody redraws another's referrals.

- **A single-option `<select>` fires no change event.** `/labs/mapping` and
  `/labs/registry/[id]` pick a product and then one of its packages; **129 of
  the 203 products with parameters have exactly one**, so for most of the
  catalogue there was nothing to change to and the grid sat on "choose a
  sub-product" for ever. Both pages now resolve a lone package **on the server**
  and redirect to it, which also makes the URL the same however it was reached.
  The second half of the same fault: a `value` with no matching `<option>`
  leaves the browser displaying option one, so the control read as a package
  already chosen while the page said none was. Both selects render an explicit
  placeholder option while nothing is selected.
- **`/labs/mapping` is `FullBleedContainer`, and so is its `loading.tsx`.**
  23 columns do not fit `PageContainer`'s 1440px box. The skeleton must use the
  same container as the page — the organogram's did not, and the chart jumped
  sideways on load.

- **A destination must hold the capability, refused by name.** `setRouting()`
  names the tests the lab has not declared rather than counting them, because
  the fix is to go and tick those tests on the lab's page and a number does not
  say which. It also refuses a closed lab.

- **Withdrawing a capability does not repoint anybody.** Routing rows pointing
  at the lab stay exactly as the office left them and start failing the check in
  `resolveDestinations()`, which now also refuses a **closed** lab and says so.
  Silently moving an office's samples somewhere it never chose would be worse
  than telling it — the arbitrariness D64 respects cuts both ways.

- **The form asks full or partial, and drills in only for partial** (D118).
  Within the drill-down each test is *our bench*, *sent out*, or *not ours*, and
  a test the office has no bench for defaults to **sent out**. **Nothing asks
  where the rest goes** — that was the old model's question, and it is what made
  the form infinite.
- **`/labs/coverage` is the way capability is meant to be recorded** (D108);
  `/labs/mapping` and `/labs/registry` are the cell-by-cell views over the same
  two tables. 4,774 parameters × 23 offices is not a grid anybody completes one
  cell at a time, so the office answers at the level it thinks in — products,
  variants, then *all of these / some / none* per package — and the parameters
  follow.
- **The office answers; the laboratory is resolved** (D108). `labFor()` in
  `lib/labs/coverage.ts`: a branch has one bench per discipline so the
  parameter's discipline picks it, and head office's eight sections are picked
  by the parameter's `sourceSection`. Asking an operator to choose between
  Organic Chemistry and Food & Bacteriology 4,774 times is asking a question
  they cannot answer. **`LabCapability` is still per lab** — that is what D64
  checks and what a consignment is addressed to.
- **The coverage level is derived, never stored.** `full` / `partial` / `none`
  comes from counting the capability rows. A stored level would be a second copy
  of the same fact and would disagree the first time somebody edited one
  parameter on the map.
- **`OfficeSubProductScope` is the office's working set** (D109), and it is not
  derivable: every office already has a routing row for every parameter, so
  routing cannot say what an office has *looked at*, and "we cannot do this and
  send it away" is a different fact from "we do not deal with this at all".
  **It does not gate which applications an office receives** — jurisdiction
  still does that from the factory's district (D28). Whether it should is open
  with the client.
- **A destination that has not declared the capability is allowed and
  reported** (D110), not refused. Barisal cannot name Khulna until somebody at
  Khulna has filled in their form, and Khulna is in the same position about
  Barisal — refusing deadlocks the institution on whoever went first. Nothing is
  lost: `resolveDestinations()` still refuses to *follow* such a row, by name,
  days before a sample moves. **A closed lab is still refused outright.**
- **The destination picker only offers offices that can receive that kind of
  test.** Four offices have chemistry and no physical bench, twelve have
  neither; offering them offers a destination the save then refuses. The bulk
  "send everything to…" assigns what that office can take and **names what it
  cannot**, which is the rare split.
- **`lab_incharge` is a role** (D105) and has **no users today**, exactly like
  `one_stop`. Granting it at `/hr/listing/roles` is the first step; until then
  an office head or a superadmin does the work.

- **The module is built and entry has started.** Barishal made the first real
  coverage entries on 2026-09-08 — U-PVC Pipe, two tests on its own chemistry
  bench and three sent to Rangpur — which is the whole flow working end to end.
  Everything else is still a stand-in. The order for the rest is: grant
  `lab_incharge`, then each office works through `/labs/coverage`. Nothing is
  blocked meanwhile, because the stand-ins still resolve. **`/labs` is where the
  live count lives**; figures written here go stale the moment an office types.

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
- **[NOT BUILT] The field officer will select which parameters are tested**
  (D101, decided 2026-09-07). Today every parameter of an applied sub-product is
  tested and charged — `testFeeFor()` and `resolveDestinations()` both take the
  whole set — and any code written before D101 lands should keep assuming that.
  When it is built: **exclusion rows with a required reason**, not a selection,
  because the default is "everything the standard requires" and the deviation is
  the fact worth storing (the `notInProductionAt` discipline, D91); locked once
  the jars are sealed; printed on the inspection report so the approver sees it;
  and filtered in `resolveDestinations()`, which is the single place a
  sub-product's parameters are gathered. **Not the applicant's choice** — nobody
  should pick which tests their own licence rests on.

## Workflow — files moving inside BSTI

Decisions D57–D59, spec §4.2. `lib/workflow/chain.ts` is Prisma-free (D9),
`inbox.ts` is the server half. Both avoid mentioning CM: `holderEmployeeId` and
`ApplicationMovement` are generic, so the next service that needs a file to move
can reuse them.

- **Additional charge is `Employee.actingOrgPostId`, and the acting post's
  grade wins** (D74). A wing whose Director post is vacant runs on a Deputy
  Director holding its charge — the CM wing does today. Everywhere else the
  *employee's* grade decides seniority; this is the one case that inverts,
  because acting means exercising the post's authority and not your own. So
  `toDesk()` takes section and grade from the acting post, and a DD acting as
  Director (CM) ranks grade 4 inside the wing and passes to the wing's other DD
  by the ordinary rule — which by his own grade 6 `canPassTo` refused. He keeps
  his own desk: two columns, so ending the charge is nulling one field. The
  picker says *"— Director, additional charge"* rather than silently promoting
  him. No history is kept; `toDesk()` is the only reader, so making it a dated
  table later is one place.
- **A file whose holder stops serving is stuck, and only an administrator can
  free it** (D76). `holderEmployeeId` is a person and "nobody holds it" is the
  definition of unclaimed, so a file does not fall back to anyone when its
  holder leaves — it sits at a desk nobody is at. Worse, `pass()` lets only the
  holder move a file, and a retiree who has given up their desk has no
  `sectionUnitId`, so `canPassTo()` refuses before it looks at grade. D75's
  sender exemption does not help, because the section check comes first.
  `npm run fix:orphaned-files` moves each such file to its office's head — where
  it would have gone had the holder never received it — and writes a
  **`reassign`** movement. Not an `up`: nobody sent it, and "sent up by
  <retired officer>" is a lie in the one feature spec §8 calls most of the
  perceived value of the system. `fromEmployeeId` still names who was holding
  it, so the break in custody stays visible. **There is no screen for this** —
  reassignment is on the step 8+ list and the script is the only way to do it.
- **A retired officer may never be handed a file** (D75). `Desk.isActive`,
  checked on the candidate and **never on the sender** — a file already in a
  retired officer's hands must still be movable out of them. Office scoping is
  `employeesOfOffice()`, which asks where somebody works and not whether they
  still do, so without this a retiree holding a desk stayed in the picker.
- **`office_head` is its own role.** It receives an office's submitted
  applications; `officeadmin` does not. Payroll authority and file-routing
  authority are different jobs. `User.role` is one enum, so nobody is both —
  accepted deliberately (D57).
- **A desk that has handled a file keeps seeing it** (D77). `touchedBy()` reads
  the movement log, so standing is a *fact about the file* rather than a
  permission somebody granted — and it carries no power, because every action
  still keys off holding it. A file used to vanish the moment you passed it on,
  which is right for "what is on my desk" and wrong for everything else: the
  officer who wrote the inspection report is the one the applicant telephones,
  and he could not answer. Both directions of the log count — `toEmployeeId` is
  every desk that held it, and `fromEmployeeId` adds the office head who
  received and passed down in one sitting. Deliberately **not** office-scoped: a
  person who handled a file and has since transferred still handled it.
- **Reading a file and working it are two pages, each with its own button on
  the board.** `/workflow/[id]` is the preview — what the applicant filed, its
  attachments and its fees, server rendered with almost no client JS.
  `/workflow/[id]/process` is the work: corrections, the inspection plan, the
  office order, and where the file has been. An officer approving a visit should
  not scroll past six cards of sub-products to reach the button, and one
  checking a declared capacity should not scroll past the control that issues an
  office order. **Not tabs** — a tab bar on the preview reads as "the process
  lives inside the preview" when it does not. The board's Process button is
  **named for the work waiting there** (*Plan inspection*, *Inspection plan*,
  *Office order*, *Review*) for whoever holds the file, so nobody has to learn
  which page plans a visit. `FileShell.tsx` holds the shared header and the
  `Card`/`Row`/`Empty` helpers so the two pages cannot drift apart.
- **`/workflow/[id]` is the whole file, read-only** (D80) — the application
  preview, the attachments and the fees, for every officer on its flow.
  `canViewApplication()` is the named rule and it is the same standing that puts
  a file on your board (D77): you hold it, you have handled it, it is your
  office's and you are its head, or you are a superadmin. Reading is not acting
  — every action still keys off *holding* it and `pass()` re-checks on the
  server. **A refusal is `notFound()`, not a 403**, for the reason D71 gives:
  a distinguishable refusal would let any member of staff enumerate which
  application numbers exist and which office holds them.
- **The review closes when the file is marked ready.** `reviewIsClosed()` in
  `lib/cm/inspection.ts`; the panel that raises a shortfall disappears rather
  than offering a button the service would refuse.
- **The inspection plan travels with the file** (D82). `lib/cm/inspection.ts`.
  Whoever holds the file proposes a date and a team; every desk above may
  **correct** it, because a senior officer who cannot change a plan he is
  accountable for has to send it back instead — a round trip for a typed date.
- **Proposing and sending are two acts, and the sending is what moves the
  file.** Saving the plan leaves it on the proposer's desk so he can come back
  to it; **Send for approval** returns the file to whoever handed it down and
  sets `inspection_pending_approval`. Without that step the plan sat saved on
  the proposer's desk: he could still edit it and his senior had nothing to
  approve. Editing and approving both key off *holding* the file, so the
  hand-off is the only thing that has to be right for both to follow.
- **The approver is whoever handed the file down** (D84) — not the office head,
  and not a senior the sender picks. `delegatorOf()` reads the most recent
  `down` movement addressed to this desk: he delegated the work, so the plan
  returns to him. **There is nothing to choose**, and offering a list of seniors
  both asked a question the file's own history already answers and let the wrong
  person be chosen. Only `down` counts: a `receive` has no sender, an `up` came
  from somebody junior, and a `reassign` was an administrator moving a stranded
  file rather than a superior delegating work. Because the target is derived
  rather than chosen, the hand-off is written directly instead of through
  `pass()` — the chain test exists to stop an arbitrary sideways move, and there
  is no choice here to abuse — and it is recorded as an `up` so the desk flow
  reads the same. The proposer may never approve his own plan, and the approver
  must **hold** the file. The inspection and sampling reports will take the same
  rule.
- **Approval hands the file back down to whoever proposed the plan.** He is the
  officer going to the factory — he estimates the samples, takes the tokens,
  seals them and writes the report — so leaving the file on the approver's desk
  put every one of those at the wrong desk. Recorded as a `down`, which also
  makes the return journey right by itself: `delegatorOf()` then resolves to the
  approver, so the report goes back to the same officer who approved the plan.
- **Approval issues the office order**, and it is an official letter (D85).
  `/workflow/[id]/order` renders it on the government letterhead — `GovHeader`
  with `orgForOffice()`, so a Barishal order carries Barishal's address — naming
  the company, the factory, the product, the date and the team, signed by the
  approver. **The screen and the PDF are the same page**: the toolbar is
  `print:hidden` and Puppeteer loads that URL, exactly as the salary slip does,
  so there is no second layout to keep in step. `GET
  /api/workflow/applications/[id]/order/pdf` is the download.
- **The order number is a memo number**, `বিএসটিআই/<office>/পরিদর্শন/<serial>/<year>`
  — the shape `generateMemoNo()` builds for the bank advice. Numbered at
  approval and not at proposal, for the same reason an application number waits
  for submission: a number quoted to a factory should mean a visit that will
  happen. Stored with ASCII digits so the serial parses, printed through
  `toBengaliDigits()`. It appears on the board row and in the desk flow, so
  every desk sees it. **An approved plan cannot be edited or sent back** —
  changing the date means a fresh order, not an edited one.
- **What the officer finds at the factory goes on the *application*, not on
  the letter** (D89). A sub-product or variant added to the sampling letter
  alone would be sealed and tested but never applied for — no routing, no
  parameters, no test fee, and a licence that does not cover the article the jar
  came from. `declaredBy` keeps the two apart so "did they under-declare, or did
  we find more" stays answerable (D67), and the applicant's declaration is never
  rewritten. Adding one changes the sampling grid and the test fee by itself,
  because both read `ApplicationSubProduct`.
- **A line the applicant declared but is no longer making is struck out, not
  deleted** (D91). A factory may discontinue a product between applying and the
  inspection, and the officer is the one who finds out.
  `notInProductionAt` on `ApplicationSubProduct` and `ApplicationSku`, and
  everything downstream ignores it: no sampling cell, no box, no test fee,
  nothing licensed. **The declaration stays on the file**, because "what did
  they say they made" is asked in disputes and a deleted row cannot answer it —
  the same discipline as `declaredBy`. Reversible until the jars are sealed.
- **He may remove only what he added.** `removeSubProduct` and `removeSku`
  refuse a row whose `declaredBy` is `applicant`: deleting the applicant's
  declaration would erase it, and "did they under-declare, or did we find more"
  stops being answerable the moment either side can rewrite the other. The
  Remove control renders only on his own findings.
- **Amendments close when the jars are sealed.** The plan cannot be regenerated
  (`commitSampling` refuses), so a variant added afterwards would be licensed
  without ever having been sampled. Both `addSubProduct` and `addSku` refuse,
  and the panel hides rather than offering a button that will.
- **The visit's working is not everyone's to read** (D90).
  `inspectionAudience()`: the visiting officer always; the desk it was **sent
  to**, once sent; everyone with standing once **approved**. D80 gives every
  desk that handled a file the right to read it, which is right for the
  application and wrong for a report being written — a senior reading a draft
  either corrects work that was going to be corrected anyway or forms a view of
  a visit from notes. The sampling plan, the labels and the printed report all
  follow the same rule, so a link cannot outrun the panel that offers it.
  **A superadmin is not exempt**: the point is not access control against
  administrators, it is that unfinished work is not somebody else's to read.
- **The inspection report and the sampling record go up together** (D92) —
  they are one visit. Splitting them would let a senior approve a report about a
  factory whose samples he has not seen, or clear a set of jars without the
  findings that justify drawing them. Sending is refused until the jars are
  sealed, for the same reason.
- **The approving desk has three answers, because a visit is either sound, or
  wrong on paper, or wrong in the factory:**
  - **approve** — numbered, and the file goes **straight back to the officer**,
    because the letters that follow are his to issue and a file parked on the
    approver's desk is a day lost for nothing.
  - **send back** — the paperwork is wrong. Down to the officer with a note,
    `submittedAt` cleared; nothing on the application reopens and the samples
    stand.
  - **factory not ready** — a `FactoryDevelopmentNotice` goes to the applicant
    and the file waits on **them** (`awaiting_factory_development`). **Not a
    shortfall**: a shortfall reopens fields on a form, this asks for work in a
    building. The visit and its samples stay exactly as recorded, because a
    re-inspection is a *second visit* and rewriting the first would lose the
    finding that caused it.
- **The visit produces two documents, and one of them has no state** (D96).
  `/workflow/[id]/sampling-report` prints what was drawn — the sealed boxes,
  their seal numbers, the specimens with their brand, variant and size, the
  destination laboratory and how many parameters each order carries — under the
  **inspection report's number**, not one of its own. No submitted flag, no
  approver, no serial: one visit, one approval (D92), and a separate serial
  would imply the two could be decided apart. `samplingBoxesFor()` in
  `lib/cm/sampling-report.ts` reads the rows; the officer types only
  `samplingRemarks`, the part no row holds — quantity drawn, condition of the
  goods. Both documents are linked together wherever either is offered, so
  nobody approves one having read the other.
- **The sampling *screen* is the officer's; the sampling *report* is the
  chain's** (D97). `SamplingPanel` estimates counts, generates tokens and seals
  boxes, so it renders for the visiting officer alone — it stayed on every desk
  after approval because D90 widens the audience for the *work*, and a
  supervising desk was handed a tool for a job it does not do. It reads the
  document instead.
- **The letters after an approved visit are derived, then issued by the
  officer** (D95). Which letters are needed comes from the sealed boxes — one to
  each laboratory's wing head, one to the applicant, one to each One Stop
  counter — so a laboratory cannot be forgotten, the same reason destinations
  are derived and not typed (D69). But he *issues* them, in his own name:
  approval says the visit is sound, and these letters describe his samples.
  Approval hands the file straight back to him (D92), so there is no extra hop.
  **All at once** — a partial dispatch means a laboratory expecting a box the
  applicant was never told to carry — and **refused while anything is
  unaddressed**, with every obstacle listed at once so an administrator fixes
  them in one go. Issuing twice is refused; a corrected letter is a fresh letter
  with its own number, `বিএসটিআই/<office>/নমুনা/<serial>/<year>`, consecutive
  across one dispatch so a gap means a letter that never went.
- **The applicant's letter lives on the client surface** (D98).
  `/public/applications/[id]/letter` renders নমুনা জমাদান পত্র on the government
  letterhead, with the PDF at `/api/client/applications/[id]/letter/pdf`. It
  **cannot** live under `/workflow` — that prefix is INTERNAL-only (D12), so the
  one person the letter is addressed to is the one person who could not open it
  there. `applicantLetterFor()` in `lib/cm/letter-view.ts` builds it from the
  consignments themselves, so a box cannot be left off the instruction that says
  where to carry it. **Seal numbers are printed in full** — they are what the
  counter checks a box against (D72). `SampleLetterNotice` repeats the substance
  on the application page above the form, beside the shortfall notice and for
  the same reason: there is no notification channel, so the page *is* the
  notice, and a box already handed in shows as received rather than as an
  outstanding errand.
  **`ModuleNavbar` is now `print:hidden`**, which it needed to be the moment a
  client surface printed a real document — a page under
  `app/(public)/public/` cannot opt out of that layout's chrome.
  **The delivery window is a stand-in.** `SAMPLE_SUBMISSION_DAYS` is 14 in
  `policy.ts` with the reasoning (D8); it is printed as guidance and **nothing
  enforces it**, because refusing a real sample over an invented deadline is
  worse than accepting a late one.
- **The One Stop counter is a desk, not a person** (D93). `one_stop` is a role,
  so the counter keeps working when the officer on it changes, and
  `/workflow/counter` lists what is coming to their office.
  **`one_stop` has no users today**, so every counter is empty and no box can be
  marked received — which is also why the applicant's own panel can never show
  one as delivered. Granting the role at `/hr/listing/roles` is the first step,
  and `submitConsignment()` still has no button.
  **Boxes are listed by the *laboratory's* office, not the file's** — the
  applicant carries each box to the office of the lab that will test it, which is
  often not the office the application belongs to, and a counter scoped to its
  own office's files would miss exactly the boxes walking through its door.
  It is scoped to `Consignment`, never to `Application`: the counter never holds
  a file. **Payment is read-only to it and always will be** (spec §5.2) — a
  counter that could mark a file paid is a counter that can be argued with.
- **Sampling and the report are the visiting officer's work alone** (D88) —
  whoever proposed the inspection plan. A senior desk supervises and approves;
  it does not seal jars or write up a visit it did not make. **Holding the file
  is not enough for these two**, unlike everything else on the process page,
  because the file passes back through the approver's hands and he would
  otherwise inherit the officer's job with it. The panels still render for a
  reader — with the fields disabled and saying why — since the approver has to
  read what he is approving.
- **The FDO's sampling screen** (D87) sits on the process page once the plan is
  approved — sealing samples for an unauthorised visit would be jars nobody sent
  anyone to collect. `lib/samples/screen.ts` assembles it; the arithmetic stays
  Prisma-free in `plan.ts`.
- **Destinations are derived, counts are entered** (D69), and the screen says
  which is which. Every row is resolved from `LabRouting` — the officer cannot
  forget a lab or prepare a box nobody needs — and the one unknown is specimens
  per variant, which turns on sample quantity and destructive testing, the
  A§1.2 data nobody has collected.
- **A remembered figure is a suggestion, never a default.** It was agreed for a
  different consignment of the same sub-product, so filling it in silently would
  make last month's quantity this month's decision. It renders as
  *"2 last time — use it"*.
- **A cell resting on seeded routing says so** (D66). Nearly every one of the
  109,802 rows still points at the owning head-office section, and a destination
  nobody has chosen is not the same fact as one an office decided.
  `/labs/coverage` is where an office replaces them wholesale and
  `/labs/mapping` cell by cell.
- **Only `ref` is printed on a label** (D68). `/workflow/[id]/labels` renders a
  cut-up sheet with the QR to `/s/<ref>`, the sub-product, the size and the
  specimen number. **The brand is deliberately absent** — the variant *is* the
  applicant's identity (D71) — and `cmCode` and `labCode` are not even fetched.
  The QR is generated to SVG **on the server** (`qrcode`), so nothing reaches
  the client bundle and the same markup screens, prints and goes into a PDF.
- **Sealing is one irreversible act and the button says so.**
  `commitSampling()` refuses to run twice: the jars are about to leave in the
  applicant's hands, so a second plan would be specimens nobody can account for.
- **The inspection report is the wing's own form, improved where our data
  allows** (D86). `lib/cm/inspection-report.ts`; the catalogues
  (`INSPECTION_CONDITIONS` ×5, `INSPECTION_MARKINGS` ×9,
  `INSPECTION_NARRATIVE` ×11) are in `policy.ts`, taken from
  `utils/inspectionReport.html`. Three deliberate differences from the paper:
  - **Production as *found*, beside production as *declared*.** The paper form
    has one capacity box; we already hold what the applicant claimed in
    `ApplicationProduction`, so the report records what the officer saw next to
    it. "Did they under-declare" is the question an inspection exists to answer,
    and one box cannot ask it.
  - **Nothing is re-typed that the file already holds** — product, BDS numbers,
    company and factory are printed as context, not asked for. The paper asks
    because paper cannot look them up.
  - **The checks are rows, not columns.** Five conditions, nine marking items,
    eleven narrative sections: a column each means a migration every time the
    wing adds one, the same reasoning as the shortfall points.
- **The attachments the paper form wants are text.** There is no document store,
  so recording a file nobody can reopen would be worse than asking for the
  substance in words.
- **`reportGaps()` returns every gap at once**, so an officer fixes them in one
  sitting rather than meeting the next one after each save — the shape
  `missingForSubmission()` uses on the applicant's side. Sending is refused
  while any remain.
- **The report follows the same path as the plan**: written by the holder, sent
  to whoever handed the file down (D84), approved by him, numbered
  `বিএসটিআই/<office>/পরিদর্শন-প্রতিবেদন/<serial>/<year>` at approval. It is
  readable and downloadable **once sent up**, not only once approved — the
  senior approving it has to read it as a document.
- **[ASSUMPTION] The letter's Bengali wording is drafted, not supplied.** It
  follows the bank advice's register, which is the only other official letter
  the system issues. The facts in it are real; the sentences need a CM Wing
  officer's eye.
- **The proposer is on the team by default** — he is the one going, and making
  him tick his own name is a step that is wrong every time it is skipped. Only
  for a plan that does not exist yet: re-adding him to a saved plan would put
  him back on a visit a senior desk had removed him from.
- **The team picker is searchable and grouped by `groupByRank()`** — the same
  table the pass-down list uses, so an officer sees his colleagues under the
  same headings wherever he chooses from them. It matters here for the reason it
  mattered there: ten of the CM wing's Field Officers and six of its Assistant
  Directors are all on grade 9.
- **The team is chosen from the proposer's own section, not the office.** Head
  office has 392 desks and an inspection team is drawn from the wing that owns
  the file, so offering the building turns a short choice into a search and
  invites a Metrology inspector onto a CM visit. The section is
  `Desk.sectionUnitId`, the one the workflow chain already uses, so "who is in
  my wing" has one answer across the module. It **falls back to the office when
  the proposer holds no desk** — 249 of 731 do not, and an officer who cannot
  name a team cannot plan a visit at all — and the panel says so rather than
  silently widening the list.
- **Team members are rows, and replaced rather than merged.** A list diffed on
  save leaves somebody on the visit because nobody remembered to remove them.
  Each named officer is checked against the serving roster: a plan is an
  instruction to people.
- **Corrections are a loop between the holder and the applicant** (D81), run
  from `/workflow/[id]` and answered on the applicant's own application page.
  `lib/cm/shortfall.ts` is the server half; the rules are Prisma-free in
  `states.ts` (`editScope`) and `policy.ts` (`SHORTFALL_SECTIONS`).
- **Packaging artwork is marked per variant** — `artwork:<applicationSkuId>`.
  A licence covers every brand, size and flavour separately and each is sold in
  its own wrapper (D53), so "the artwork is wrong" is a statement about one jar;
  reopening every variant's artwork because one label is wrong invites the
  applicant to replace wrappers nobody questioned. The targets are **dynamic**,
  unlike the sections and the document checklist, so `raiseShortfall` checks the
  SKU belongs to that application before storing the point.
  **An artwork-only permission writes only the artwork**, enforced in
  `updateSku` and not in the form: the variant editor posts the whole article,
  so comparing what changed would let a resubmitted brand name through on a
  technicality. Everything but the label columns is simply not written, and the
  applicant gets a narrow "replace artwork" control rather than the editor.
- **A shortfall is an edit permission, not a note.** The officer ticks points
  from a closed list and each becomes a `ShortfallItem` row naming what
  reopens — a section like `production`, or `document:<kind>` for one paper.
  `editScope()` turns those rows into "may I write this", and **both the page
  that greys a step out and the route that refuses the write call it**, so they
  cannot disagree. A free-text note could not be turned into a permission, and
  reopening the whole application invites changes nobody asked for after the fee
  is paid.
- **The file never leaves the officer's desk during a round.**
  `holderEmployeeId` is untouched; the *state* is what says the applicant owes a
  response. Handing it back would put it in an applicant inbox that does not
  exist.
- **It runs any number of rounds** — the client's rule, which settles the
  "maximum rounds" half of §10 #7 — and ends when the officer marks the file
  ready, which is the existing `review_passed`. Nothing checks that a marked
  point was *actually* corrected: that judgement is the officer's, which is why
  the file goes back to him to look again.
- **There is no notification channel.** No mail (client addresses are often
  `@mobile.bsti.invalid` placeholders) and SMS is not enabled, so the panel on
  the application page *is* the notice. Do not describe the applicant as
  "notified" until a channel exists.
- **The attachments panel says the bytes are not stored.** The kernel document
  store does not exist, so an officer must not open that list believing BSTI
  holds the applicant's trade licence.
- **The desk flow is on the board**, collapsed, one query for every row
  (`flowsFor()`), rendered through the same `describeMovement()` the server half
  uses (D9) so a reassignment reads identically wherever it appears.
- **A file is held by a person**, `Application.holderEmployeeId`, and every
  hand-off writes an `ApplicationMovement`. "Nobody holds it" *is* the
  definition of unclaimed — there is no parallel state to disagree with.
- **Seniority is the pay grade, then the designation within it** — `seniority()`
  returns the pair (D78). The organogram puts a branch Director in the Executive
  unit beside their stenographer while the officers sit in sibling units, so
  depth is useless. It is the **employee's** grade, not the post's: an officer
  on grade 9 may sit on a post graded 11.
  **`Posting.orgPostId` is null on every row** — the organogram link is
  `Employee.orgPostId`. Read the posting's org post and every desk gets a null
  section and no chain.
- **The grade alone is not an order, and that is not a detail.** Assistant
  Director, Field Officer, Examiner, Inspector and Senior Examiner are *all*
  grade 9 — 16 of head office's 22 CM desks sit in that one band. By grade they
  were all peers, so an AD could not hand work to a Field Officer, which is the
  processing chain the spec names: office head → AD (CM) → FO (CM). The tie is
  broken by `deskRank()`, **the same table the picker groups by**, so the two
  can never disagree about who is senior. Purely additive: it only changes pairs
  that tie on grade, so nothing that worked before can break. 3,423 possible
  hand-offs became 4,730, and the desks that could reach nobody at all went from
  5 to 0.
- **Pass down reaches your own level or below; send up is strictly senior**
  (D79). Sideways is a `down`. An earlier reading of D58 made same-level desks
  unreachable in either direction, on the theory that a sideways move would make
  "who holds it" a matter of who clicked — it does not, because the holder is a
  single column and every move is appended to `ApplicationMovement`, so the
  chain reads back whatever route it took. And it was wrong about the office: a
  section holding six Assistant Directors expects the one covering that product
  line to take the file from whoever received it. The two directions stay
  disjoint and together cover the section — verified over all 5,640 head-office
  pairs, none in both lists and none in neither.
- **An office head passing down is exempt from the grade test**, because an
  acting head is the top of their section whatever their own grade — which is
  the whole reason it is a role and not a designation.
- **252 of 731 employees have no `orgPostId`**, so they have no section and
  cannot be handed a file — 114 of them daily basis, who hold no sanctioned post
  by definition. See "Desks" above: what remains is organogram gaps, not
  missing matching. **No office head is among them any more**, so every office
  can at least start a file moving.

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

- **`prisma/` is inside the typecheck, and must stay there.** It was excluded
  from `tsconfig.json` until 2026-09-10, which meant every seed and importer
  could go on referencing dropped models and columns without a murmur —
  `reconcile-sub-products.ts` was calling three tables that no longer existed,
  and **`npm run seed:org` had been broken for weeks**, still importing
  `app/(main)/organogram/_components/data` after the HR module moved under
  `/hr`. `npx tsc --noEmit` covers it now. Only `prisma/seed.ts` is still
  excluded — the superseded demo seed, which writes a relation the schema no
  longer has. **Do not add the directory back to `exclude` to make a build
  pass.**
- **A verification that `extends` the real tsconfig inherits its `exclude`.**
  The first check of whether `prisma/` typechecked used exactly that, and so
  excluded the directory it was testing and reported clean. The honest run found
  six errors. If you are testing whether a config change is safe, change the
  config.

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

- **A `useState` initialiser runs once, so a list that grows after mount
  breaks state keyed on it.** `SamplingPanel` keyed its typed counts by cell and
  read them directly; recording a found sub-product adds a cell, and the
  re-render read `undefined.trim()` and crashed — while the row had already been
  written, so a full reload looked fine. **Fall back to the prop rather than
  syncing with an effect**, which would fight the officer's typing. Any panel
  holding draft state over a server-derived list has the same shape.
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
npm run import:office-head-desks # seat each office head on their office's Executive desk (--dry)
npm run import:hr-corrections   # roster facts the HR export cannot supply (--dry)
npm run fix:orphaned-files      # files held by someone no longer serving → the office head (--dry)

npm run import:test-parameters # every .xlsx parameter file → the catalogue (--dry, --only=<key>)
npm run import:chemical-parameters # the Chemical Wing's two .docx files (--dry, --names, --file=food)
npm run fees:urgent            # re-price every package's urgent fee from what the wing published (--dry)
npm run seed:labs              # labs from the organogram, capability + the routing map (--dry)
npm run labs:operational       # close the labs the client says do not exist in practice (--dry)
npm run labs:reconcile         # one article, one sub-product — run after any wing's import (--dry)

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
