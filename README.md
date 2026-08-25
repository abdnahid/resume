# BSTI e-Services

The internal and public platform for the **Bangladesh Standards and Testing
Institution**. One Next.js 14 application, several modules mounted on path
prefixes, backed by PostgreSQL through Prisma.

The HR module is built and in use. The BDS store catalogue is new. The CM
quality-certification module is the large piece ahead.

## Plan

**[`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md)** is the current plan — the
architecture decisions, the build steps in order, and the open questions that
gate each one. Start there.

The specs it builds on live beside it:
[`docs/bsti-eservices-cm-module-plan.md`](docs/bsti-eservices-cm-module-plan.md)
(platform kernel + CM module) and
[`docs/bsti-eservices-lab-routing-addendum.md`](docs/bsti-eservices-lab-routing-addendum.md)
(lab pipeline, Phase 5+).

Working in this repo with Claude Code? Read [`CLAUDE.md`](CLAUDE.md) too — it
carries the conventions and the two-machine workflow.

## Run

```bash
npm install          # also generates the Prisma client
cp .env.example .env # then fill in DATABASE_URL and the auth keys
npm run dev
```

Open `http://localhost:3000`.

To populate a fresh database:

```bash
npm run seed:org        # organogram — units and posts
npm run seed:grades     # NPS-2015 grades onto posts
npm run seed:employees  # employees
npm run seed:bds        # BDS store catalogue
```

All seeds upsert on natural keys, so re-running them is safe.

## Modules

Each module is a route group under `app/`, mounted at a path prefix.
`lib/modules.ts` is the single source of truth — it drives the landing page
cards and the footer module switcher.

| Path         | Route group       | State       | Theme                    |
| ------------ | ----------------- | ----------- | ------------------------ |
| `/`          | `app/(public)`    | Built       | Public landing page      |
| `/hr`        | `app/(main)`      | Built       | Purple (`:root` default) |
| `/store`     | `app/(ecommerce)` | Catalogue   | `.ec-theme` — plum       |
| `/workflow`  | `app/(workflow)`  | Placeholder | `.workflow-theme`        |
| `/accounts`  | `app/(accounts)`  | Placeholder | `.accounts-theme`        |
| `/inventory` | `app/(inventory)` | Placeholder | `.inventory-theme`       |
| `/admin`     | `app/(admin)`     | Placeholder | `.admin-theme`           |

`/` and `/organogram` are public. Everything under `/hr` requires a session:
`middleware.ts` guards the module root and `app/(main)/layout.tsx` guards the
rest, redirecting to `/login`.

`/print/[id]` sits at the root, outside every module — `app/api/approvals/[id]/pdf`
drives it with puppeteer and builds the URL from the request's base URL.

### Adding a module

1. Add an entry to `MODULES` in `lib/modules.ts` (path, labels, blurb, theme class).
2. Create `app/(group)/<path>/page.tsx` and a `layout.tsx` rendering
   `<Footer module="<key>" />`.
3. Add the theme class to `app/globals.css` and the icon to `Footer.tsx`.

## HR module

The primary output is the government-format **Personal Data Sheet** — a
three-page A4 print layout composed from the section components in
`components/` (`GovHeader`, `PersonalSection`, `EducationSection`,
`PostingSection`, `Signatures`, `PageFoot` and the rest), framed by `Sheet`.
Print via the browser; the print stylesheet hides screen chrome, drops shadows
and paginates at the sheet boundaries.

Beyond the data sheet: employee records and postings, salary fixation and
processing, bank advice letters, ID card batches, and the organogram.

Data comes from PostgreSQL via `lib/db.ts` (`getEmployeeRecord`, `getEmployees`
and friends). Server components query it directly; `app/api/*` exists for
client-side mutations.

## BDS store

`/store` is the public storefront for Bangladesh Standards. `/store/bds` is the
faceted catalogue — search, publication date, day-wise, division and price band,
with facet counts computed against the other active filters. `/store/bds/[slug]`
is the detail page.

Purchase and download are not wired yet; the buttons render disabled. That is
step 3 in the build plan and it is blocked on the payment gateway decision.

The catalogue schema (`Bds`, `BdsDivision`) carries `status`/`supersededBy` and
the mandatory-315 flag from the start. `productId` is deliberately absent until
the product catalogue arrives — the BDS attachment rule needs it at step 6.

## Notes

- Google Fonts (`Newsreader`, `Inter Tight`, `Hind Siliguri`,
  `Noto Serif Bengali`, `JetBrains Mono`) load via `@import` in `globals.css`.
  Consider `next/font` for production.
- The two circular logo slots in `GovHeader.tsx` are typographic placeholders.
- Colours come from the token block in `app/globals.css` — use `text-primary`,
  `bg-card` and friends rather than hex values, so module themes keep working.
