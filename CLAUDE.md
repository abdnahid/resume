# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

**BSTI e-Services** — the internal and public platform for the Bangladesh
Standards and Testing Institution. One Next.js app, several modules mounted on
path prefixes. The HR module is built and in use; the BDS store catalogue is
new; the CM quality-certification module is the large piece ahead.

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
- better-auth (session cookie, `username` plugin — username is the employee ID)
- shadcn/ui + `@base-ui/react`, lucide-react

## Layout

```
app/
  (public)/      /            landing page, /organogram      public
  (main)/        /hr          HR module — the built one       session required
  (ecommerce)/   /store       BDS store                       public
  (workflow)/    /workflow    placeholder
  (accounts)/    /accounts    placeholder
  (inventory)/   /inventory   placeholder
  (admin)/       /admin       placeholder
  api/           route handlers
  login/         two-lane sign-in
  print/[id]/    outside every module — puppeteer drives it for PDFs
components/      shared UI; layout/ holds Navbar, Sidebar, Footer, ModuleNavbar
lib/             modules, auth, prisma, types; lib/store/ is the BDS store
prisma/          schema.prisma and the seed scripts
docs/            the plan and the specs
```

`lib/modules.ts` is the module registry — path, bilingual labels, blurb, theme
class. Adding a module is one entry there plus its `app/(group)/<path>` folder
and a theme class in `app/globals.css`.

Auth gating: `middleware.ts` matches `/hr` only. Everything else protected is
gated by its own layout (`app/(main)/layout.tsx` redirects to `/login`).

## Conventions that have bitten us

These are decisions D9 and D10 in the plan. Both cost a broken build once.

- **Split Prisma-free code from server code inside a module.**
  `lib/store/bds-catalog.ts` holds facets, query shape and URL encoding — no
  Prisma import, so client components can use it. `lib/store/bds.ts` holds the
  queries. A client component importing the query module pulls `pg` into the
  browser bundle and the page 500s with `Can't resolve 'fs'`.

- **Never call `useSearchParams()` in a shared layout component.** It opts every
  page using that component out of static prerendering, and the build fails on
  all of them at once. Pass active state down as a prop instead — `Footer` takes
  `module`, `ModuleNavbar` takes `activeHref`.

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
commit the work in progress on a branch rather than leaving it in the working
tree.

**`.env` is not in git** and must not be. Copy it to the other machine by hand
once; `.env.example` lists the keys it needs. Both machines point at the same
remote database, so the same `DATABASE_URL` works on both.

**Regenerated artefacts are ignored** — `generated/prisma`, `.next`,
`tsconfig.tsbuildinfo`. Never commit them; they conflict on every pull.

## Scope note

`lib/employee.json` is an unreferenced leftover fixture. `lib/employees.json` is
still used by `prisma/seed.ts`. Don't confuse the two.
