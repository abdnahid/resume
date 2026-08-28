# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

**BSTI e-Services** — the internal and public platform for the Bangladesh
Standards and Testing Institution. One Next.js app, several modules mounted on
path prefixes. The HR module is built and in use; the BDS store catalogue and
client accounts are new; the CM quality-certification module is the large piece
ahead.

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
prisma/          schema.prisma and the seed scripts
docs/            the plan and the specs
```

`lib/modules.ts` is the module registry — path, bilingual labels, blurb, theme
class. Adding a module is one entry there plus its `app/(group)/<path>` folder
and a theme class in `app/globals.css`.

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
- **The chain is fixation → `SalaryProcess` → bank advice.** `SalaryProcess`
  snapshots basic/gross/deduction/net; the bank advice sums `netSalary` over a
  month. Change what a fixation pays and everything downstream follows.

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
  resolving against the scale they were made under. A scale with no steps loaded
  is `verified: false`, and fixation falls back to typing basic by hand.

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
npm run seed:employees # employees
npm run seed:salary    # pay scale, house rent slabs, office zones (reads utils/*.xlsx)
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
