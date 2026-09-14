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
| `docs/sessions/testing-fees-and-parameters.md` | The test parameter catalogue (Phase G), the fee model over it, lab routing, and the sample-blinding layer. Started 2026-09-03 from `utils/textile-parameter-list.xlsx`; Session 5 (2026-09-08) imports the Chemical Wing's two files and takes the catalogue to 4,767 parameters; Session 6 the same day apportions the urgent fee to the wing's published totals and builds the `/labs` module over the lot; Session 7 corrects the premise — parameters are universal, not head office's — and adds the office coverage form; Session 8 finds one article split across two wings' sub-products and folds them back together; Session 9 (2026-09-09) fixes the single-sub-product picker and records Barishal's first real coverage entries; Session 10 records the mixed physical/chemical routing scenario; **Session 11 rebuilds the model on the client's answers — capability per office with a manner, the 109,802-cell routing map replaced by an optional preference**; Session 12 settles the fee convention from the files' own merges; Session 13 imports the physical sheet, giving Ceramic Tiles its 9 mixed tests; Session 14 (Windows) makes the lab registry editable and groups the coverage form by discipline; Session 15 fixes the destination-name collision that had every box labelled for the wrong bench; **Session 16 lets the field officer choose among capable offices, which completes the routing model end to end; Session 17 moves the database to Neon after Prisma Postgres locked the account out, restoring from a Studio CSV export.** |
| `docs/sessions/workflow-desks-and-office-heads.md` | Files moving inside BSTI, end to end: the `/workflow` board and organogram placement, the `office_head` role, then the whole CM inspection flow — correction rounds, the inspection plan and office order, sampling and sealing, the two reports, and the letters that follow approval. Started 2026-09-05, covering work begun 2026-09-02 with step 8a; Session 2 runs to 2026-09-07; Session 3 (2026-09-10) makes a person able to hold several roles, amending D57; Session 4 (2026-09-13) splits the applicant's letter one per destination, demands the testing fee with it, and gives the wing head and the One Stop counter a way to read the letters addressed to them — which turned up an office id living in a column keyed to `Lab`; **Session 5 the same day builds the re-seating screen D124 asked for, after a wrong desk was found by signing in as its holder.** |

Two rules from the spec that carry real weight:

- **Read §10 (open decisions) before implementing a phase.** Where a decision is
  unresolved but a stub is needed, isolate it behind one named policy function
  so the answer changes one place (decision D8).
- **A module never owns data another module needs** (§1). It exposes a service
  the others call. The CM module asks HR who its officers are; it does not keep
  its own copy.

## Stack

- Next.js 14 App Router, TypeScript, Tailwind v4
- Prisma 7 + PostgreSQL — **Neon**, `ap-southeast-1`, Postgres 17. Client
  generated to `generated/prisma`, `@prisma/adapter-pg` over a direct TCP
  connection. Moved off Prisma Postgres 2026-09-12 (D126)
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
| `/hr/listing/desks` | which organogram post each person holds (D131) | superadmin |
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
- **A designation and a desk are different things, and may differ on purpose**
  (D124). Normally an Inspector (Metrology) sits on an Inspector (Metrology)
  desk; where a post has no exact match, somebody with adjacent expertise fills
  it — an Inspector (Metrology) on an Examiner (Chemical) desk because he knows
  chemistry. **The post is then the job**, and the section it sits in is where
  his files go.
  **`Employee.orgPostIsInferred` is what tells that apart from a mistake.**
  Every desk held today was assigned by a script, and `import:desks` takes
  whatever seat at the grade is free when no title matches — so a placement it
  makes is a guess and says so. `displayDesignation()` trusts the post outright
  once a seat is confirmed, and falls back to the recorded designation while it
  is inferred. 323 rows are flagged; **176 of 481 now take their title from the
  desk** and the remaining 305 are the correction list.
  **`/hr/listing/desks` is what clears the flag** (D131) — choosing a post by
  hand is the act that makes "a script guessed this" untrue. Superadmin only,
  over `setDesk()` in `lib/desk-service.ts`. Measured 2026-09-13: **322 of 480
  seats are guesses and every one disagrees in rank**, so the recorded title is
  shown for all of them and only the 158 confirmed rows display their desk's
  name.
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
  them.** Nobody holds two today — a post held in additional charge (D74) is the
  only second **desk** anyone can have, and only one person has one. (Roles are
  a different thing and a person may hold several since D122; this is about
  desks.) So it
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
  header with the bilingual institution name, not a module navbar — but its
  account control **is** `AccountMenu`, the same one every other surface uses.
  It was a button to `/public/dashboard`, which is the identity-as-a-link
  mistake `AccountMenu` exists to correct, repeated on the one page where that
  control is the whole masthead. Signed *out* it keeps its own Sign in / Sign up
  pair: there is no account to describe, and those are the two things a visitor
  came for. `/` stays static — `LandingAuth` reads the session client-side.
- **`AccountMenu` carries the way back to the internal side.** A member of staff
  reading a public surface — the landing page, the store, a client's own
  application — gets **My workspace** in the menu, where a client gets **My
  account**. Deliberately a labelled item somebody chooses, which is the
  opposite of the bug that made the name itself a link.

## Auth

Decisions D11–D16 in the plan. The route prefix decides the audience:
`/`, `/public/*`, `/store/*`, `/login` and `/register` are public; everything
else is INTERNAL only.

- **`accountType` gates routes. `role` is internal-only.** Never gate an
  internal route on `role` alone — clients carry the inert `role: client`.
- **Ask `hasRole()`, never compare `role`** (D122). `User.roles` is the
  authority and `User.role` is only its highest-precedence member; comparing the
  primary grants the top role and silently refuses every other one the person
  holds. The **session cookie carries the primary only**, so a check on a
  secondary role must go through `getViewer()`, which reads the row.
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
- **`wing_head` and `testing_officer` are the lab module's two roles** (D133).
  A wing head receives samples and approves reports; **which wing he heads comes
  from his desk's unit**, so head office's two Directors are told apart without a
  second column and a branch office head — sitting in Executive, in no wing —
  covers both disciplines. A testing officer is whoever may record a reading:
  normally an Examiner, an Assistant Director where no Examiner post is filled,
  which is exactly why it is a role and not a designation. **Neither has any
  holders yet.**

- **OTP is not enabled.** `sendOTP` throws by design. The schema already carries
  `mobileVerifiedAt`, so SMS drops in without a migration.

- **There is a development-only account switcher, and it must never reach
  production.** A floating widget (`components/dev/AccountSwitcher.tsx`) over
  `app/api/dev/switch/route.ts` signs out and signs in as any internal account,
  because testing one file end to end means being six people in turn and
  signing in at every desk turns a ten-minute test into an hour. It is
  **gated on `NODE_ENV` in both directions and independently** — the route 404s
  outside development, the component returns null, so Next eliminates it from a
  production bundle rather than merely hiding it. It **signs in through the
  ordinary credential path** (`auth.api.signInUsername`, the same call the login
  screen makes), so it is not a second way in that could drift from the first,
  and the password stays server-side in `DEV_SWITCH_PASSWORD` (defaulting to the
  shared test password) rather than reaching the client bundle. Being outside
  `PUBLIC_API_PREFIXES` it also needs an existing internal session, so it moves
  between staff accounts and is not an entry from signed out. **Delete both
  files when the workflow testing is done** — the failure mode is an
  authentication bypass on a government system, and the only thing standing
  between it and one is an environment variable.

## The module guides — loaded when you work in them

The eight sections below used to live in this file. They are now in
`.claude/rules/`, each scoped with `paths:` frontmatter so it loads when a
session touches that module's files rather than in every session. **When you
are reasoning about one of these without opening its code yet, read it.**

| File | Covers | Loads when you touch |
|---|---|---|
| `.claude/rules/hr-roster.md` | who is in the roster and who is not; desks; office heads; the organogram's shape | `prisma/import/`, `lib/org.ts`, `lib/desk-service.ts`, `app/(main)/hr/` |
| `.claude/rules/salary.md` | payroll — versioned fixation, the two pay regimes, attendance, bank advice | `lib/salary/`, `app/api/salary/`, `app/(main)/hr/listing/` |
| `.claude/rules/cm-applications.md` | CM licence applications — the 315 products, standards, SKUs, the four-step form, the fee | `lib/cm/`, `lib/store/`, `app/(public)/public/applications/` |
| `.claude/rules/labs.md` | test parameters, fees, lab routing and `/labs` — the catalogue, urgent fees, capability, coverage | `lib/labs/`, `app/(labs)/`, the parameter importers |
| `.claude/rules/samples.md` | samples and the cut between CM and the labs — the three identifiers, the plan, custody | `lib/samples/`, `app/s/` |
| `.claude/rules/workflow.md` | files moving inside BSTI — desks, seniority, inspection plans, reports, letters, the counter | `lib/workflow/`, `lib/cm/`, `app/(workflow)/` |
| `.claude/rules/payments.md` | the kernel money service — gateway interface, settlement, poisha | `lib/payments/`, `app/pay/`, `app/api/payments/` |
| `.claude/rules/court-cases.md` | court cases and verdicts — recording a verdict applies it; arrears are a difference | `lib/salary/cases.ts`, `lib/salary/verdicts.ts`, `app/api/cases/` |

Everything that remains in this file applies everywhere or is safety-critical,
and stays loaded every session.

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
                                # desks are otherwise corrected at /hr/listing/desks (D131)
npm run fix:orphaned-files      # files held by someone no longer serving → the office head (--dry)
npm run fix:sample-letters      # letters issued before D128/D129/D130 brought up to the rule (--dry)

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

**Neon, since 2026-09-12** (D126). `DATABASE_URL` is the **pooled** endpoint
(`…-pooler.…`), which is right for the app. **DDL needs the direct endpoint** —
drop `-pooler` from the host — because `prisma db push` through a transaction
pooler is unreliable:

```bash
DATABASE_URL="${DATABASE_URL/-pooler./.}" npx prisma db push
```

**Why the move.** The Prisma Postgres account hit its plan limit and *every*
connection began failing with `planLimitReached` — reads included, so `pg_dump`
was not available either. What saved it was a per-model CSV export taken through
the web Studio, and `npm run db:restore` puts that back. If this ever happens
again, that script is the path: `prisma db push` a new database, then restore.

**Schema changes go through migrations** (D127), since 2026-09-13.
`prisma/migrations/0_init` is the baseline — the whole schema as it stood on the
day of the Neon move, marked applied rather than run. **Do not `prisma db push`
any more**: it changes the database without leaving a record, and the next
migration's diff would then contain somebody else's change as well as yours.

```bash
# 1. edit prisma/schema.prisma
npm run db:migration -- add-lab-notes   # writes the SQL, applies nothing
# 2. read prisma/migrations/<stamp>_add_lab_notes/migration.sql
npm run db:deploy                       # applies it, then regenerates the client
npm run db:status                       # what is applied, what is pending
```

- **`prisma migrate dev` is not used, deliberately.** It is built for a
  throwaway development database: it can decide the database has drifted and
  offer to reset it, and it wants a shadow database to replay history into.
  There is **one** database here, shared by both machines, holding 731 real
  employees and a live payroll. Generate → read → apply is the same discipline
  as the `--dry` on every importer.
- **`db:migration` refuses while anything is pending**, because it diffs against
  the live database — an unapplied migration's changes would be written into the
  new one too, and then applied twice.
- It **calls out the destructive lines** — `DROP TABLE`, `DROP COLUMN`,
  `SET NOT NULL` — rather than leaving them in the middle of two thousand lines
  of DDL.
- **The CLI uses `DIRECT_DATABASE_URL`**, set in `prisma.config.ts`. Migrations
  take advisory locks and run multi-statement batches, and Neon's pooled
  endpoint does not hold a session across them. The app keeps the pooled one.
- After a `git pull` that brings new migrations, run `npm run db:deploy`. It is
  idempotent, so running it when there is nothing to do costs a round trip.

The old world left one piece of drift behind: an empty `Bds` table existed in
the database that was never in `schema.prisma`. Check whether a table already
exists before assuming a model is new.

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

**Where the client goes stale is your own schema edits.** A schema change that
has not been generated makes `npx tsc --noEmit` report a pile of "Property 'x'
does not exist on type" errors that read as broken code when only the client is
behind. `npm run db:deploy` regenerates as its last step, so the pairing is
handled — but if you ever apply DDL by hand, follow it with
`npx prisma generate`.

`npm run build` regenerates first (`prisma generate && next build`), so a full
build hides this; `tsc` does not.

**After a pull, run `npm run db:deploy`.** The database is remote and shared, so
whichever machine made the schema change already applied it to the database —
but the *migration file* arrives with the pull, and `deploy` is what records it
as applied here. It is idempotent.

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

**Batch writes against the remote database.** Round trips to Neon
cost roughly half a second each, so a loop of per-row `upsert`s is minutes
where `createMany` is seconds — the 315-product import took ~100 minutes as a
loop and under one batched. Prisma's interactive `$transaction` also times out
at 5s, so do not wrap hundreds of updates in one.

## Scope note

`lib/employee.json` is an unreferenced leftover fixture. `lib/employees.json` is
still used by `prisma/seed.ts`. Don't confuse the two.
