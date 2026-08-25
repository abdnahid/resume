# BSTI e-Services — Build Plan

**Living document.** Updated as each step lands — it is the plan we build
against, and the only current one in this repo.

Source specs, both in this folder:
`bsti-eservices-cm-module-plan.md` (§ refs below) and
`bsti-eservices-lab-routing-addendum.md` (A§ refs).
`reference-store-sample.html` is the BSTI store page the catalogue facets and
card layout were taken from.

**Status key:** ✅ done · 🚧 in progress · ⬜ not started · 🔒 blocked

---

## Architecture decisions taken

| # | Decision | Rationale |
|---|---|---|
| D1 | **No `/kernel /modules /apps` monorepo split** (deviates from plan §12). Keep the single Next.js app; enforce the kernel/module boundary with `lib/` conventions — `lib/store/*`, `lib/hr/*`, later `lib/kernel/*`. | A monorepo restructure of a working app costs weeks and buys nothing yet. The discipline is the boundary, not the folder depth. Revisit only if it actually hurts. |
| D2 | **One auth system, two lanes.** Widen the existing better-auth `User` with `accountType: INTERNAL \| CLIENT`, make `email` optional, add unique `mobile` + nullable `mobileVerifiedAt`. No separate client auth stack. | Plan §1 "one platform"; §2.6 mobile identity, one user → many org memberships. Two session models would fork the platform on day one. |
| D3 | **Progressive build mirrors progressive profiling.** Store ships at Tier 1 (individual: mobile + name). Companies, groups, factories arrive with the licence slice. | Plan §2.1 — never ask for more than the current action needs; same rule applied to our own build order. |
| D4 | **Payment behind a `PaymentProvider` interface**, manual/offline provider first. | The Sonali-vs-aggregator question (§6) is unresolved. Keeps it a swap, not a rewrite. |
| D5 | **`consumedByApplicationId` (nullable, UNIQUE) exists on `BdsPurchase` from day one**, even though nothing reads it until step 6. | Plan §3.3. Retrofitting a unique index onto a live purchase table is the expensive version. |
| D6 | **Slugs derive from the BDS number** (`bds-1982-2020`), not the title. | Deviates from the sample HTML's title slugs. The number is the natural key: stable, short, unique; titles get re-worded. |
| D7 | **Division is a table, not an enum.** | Bilingual labels, ordering, and later product mapping are data. Plan §1: modules should be configuration-heavy. |
| D8 | **Unresolved policy lives behind one named function**, per the plan's instruction to Claude Code (§12). | So a `[OPEN]` answer changes one place. |
| D9 | **Per-module code splits into a Prisma-free half and a server half** — `lib/store/bds-catalog.ts` (facets, query shape, URL encoding) vs `lib/store/bds.ts` (queries). | A client component importing the query module drags `pg` into the browser bundle and the page 500s. The split makes the boundary a file boundary. |
| D10 | **Navbar active state is a prop (`activeHref`), never `useSearchParams()`.** | That hook opts the whole page out of static prerendering — it broke the build for `/store`, `/accounts`, `/admin`, `/inventory` and `/workflow` at once. Matches how `Footer` already takes `module` as a prop. |

---

## Steps

### ✅ Step 1 — BDS catalogue + public browse
Public, no auth, no money. Schema + seed + real store pages.

- [x] `BdsDivision`, `Bds`, `BdsStatus` in `prisma/schema.prisma`
- [x] `prisma/seed-bds.ts` — 6 divisions, ~60 standards
- [x] `lib/store/bds.ts` — query + facet layer
- [x] `/store/bds` — sidebar facets (search, publication date, day-wise, division, price), card grid, pagination
- [x] `/store/bds/[slug]` — detail page
- [x] `/store` landing wired to real destinations
- [x] Fix `ModuleNavbar` swallowing navigation (`e.preventDefault()` on every nav link)
- [x] Store layout scrolls as a document rather than a fixed viewport pane
- [x] `/store` uses ISR (`revalidate = 3600`) so catalogue counts are not frozen at build time

**Seeded:** 55 standards across 6 divisions — Chemical, Agriculture and Food,
Jute and Textile, Electrical and Electronics, Civil and Mechanical Engineering,
Halal Standards.

**Found on the way:** the database already held an empty `Bds` table that was
not in `schema.prisma` — an earlier draft using the spec's raw column names
(`bdsNumber`, `productId`, `price numeric`). It had 0 rows and was reshaped by
`prisma db push --accept-data-loss`. Worth knowing that schema drift exists in
this database; a real migration history would prevent the next one.

**Known gaps carried forward:** no `Bds.productId` yet (needs the product
catalogue, Phase G) — required by the attachment rule at step 6. `pdfUrl` is a
placeholder until the kernel document store exists; real PDFs load later.
Seed rows outside Jute & Textile / Electrical & Electronics are plausible
placeholders, not verified BSTI records, and every publication *date* is
synthesised from the year. Cart and buy buttons render disabled with a note —
they light up in step 3. `/help` and `/contact` in the shared utility bar are
pre-existing dead links, not introduced here.

### ⬜ Step 2 — Client accounts
D2's schema change made real: mobile registration/login, two-lane login page,
client dashboard shell. Tier 1 only. Restores the Sign Up button removed from
`ModuleNavbar` in step 1.

### 🔒 Step 3 — Purchase, payment, download
`BdsPurchase` (§3.2) with polymorphic buyer + D5's column. Guest checkout
creating a Tier-1 account (§2.2 Path A). Income Fee + 15% VAT split via
e-Challan (§6).
**Blocked on:** payment gateway answer — Sonali Bank mandatory, or aggregator?

### 🔒 Step 4 — Party registry
Company profile, factories, memberships, profile switcher (§2.3–2.5).
**Blocked on:** §10 #6 — confirm the mandatory company field set against what
CM Wing demands today.

### 🔒 Step 5 — Application wizard (draft only)
Service catalog + form. No submission.
**Blocked on:** §10 #1 — one application = one product = one factory? Highest
rework cost in the spec.

### ⬜ Step 6 — BDS attachment rule
The join between store and application (§3.3). UNIQUE constraint + application
check + transactional lock at attach time. Release policy isolated per D8.
**Needs:** §10 #2 (superseded editions), #3 (release on rejection), #4
(group-scoped purchases). Ship with a default policy behind one function.

### ⬜ Step 7 — Application fee + submit
Reaches `SUBMITTED` (§5.2 state 3).

### ⬜ Step 8+ — Workflow engine (Phase D)
Routing path snapshot, descend/ascend/return/reassign, movement log, officer
inbox, SLA clocks (§4.2). The reusable prize — do not build it as "just enough
for CM".

---

## Open questions outstanding

Tracked from plan §10 and addendum A§10. Answering these unblocks the steps above.

| Q | Blocks | Asked |
|---|---|---|
| Does a digital BDS list exist (count, format, prices, PDFs)? | Real catalogue data | 2026-08-24 |
| Payment gateway — Sonali mandatory or aggregator? (§6) | Step 3 | 2026-08-24 |
| One application = one product = one factory? (§10 #1) | Step 5 | 2026-08-24 |
| Company mandatory field set (§10 #6) | Step 4 | — |
| Superseded BDS attachable? (§10 #2) | Step 6 | — |
| Purchase released on rejection/withdrawal? (§10 #3) | Step 6 | — |
| Subsidiary using parent's purchase? (§10 #4) | Step 6 | — |
| Password reset with no OTP (§10 #9) | Step 2 launch | — |

---

## Parallel track — reference data (Phase G)

Addendum A§11: **Phase G gates everything after Phase H and is not a coding
phase.** Wing-by-wing collection of the parameter catalogue, sample
requirements and facility capability matrix. Begin with cement plus 4–5
high-volume products as a pilot rather than all 315.

For the store specifically the reference data is the BDS catalogue itself —
numbers, titles, editions, prices, PDFs. Collection should run alongside
steps 2–3, not after them.
