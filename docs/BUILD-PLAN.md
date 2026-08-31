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
| D2 | **One auth system, two lanes.** Widen the existing better-auth `User` with `accountType: INTERNAL \| CLIENT`, make `email` optional, add unique `mobile` + nullable `mobileVerifiedAt`. No separate client auth stack. | Plan §1 "one platform"; §2.6 mobile identity, one user → many org memberships. Two session models would fork the platform on day one. **Amended 2026-08-25:** the *column* is nullable, but better-auth 1.6.9 has no email-less sign-up — `/sign-up/email` requires a valid address — so mobile-only clients carry a synthesised placeholder (D16). |
| D3 | **Progressive build mirrors progressive profiling.** Store ships at Tier 1 (individual: mobile + name). Companies, groups, factories arrive with the licence slice. | Plan §2.1 — never ask for more than the current action needs; same rule applied to our own build order. |
| D4 | **Payment behind a `PaymentProvider` interface**, manual/offline provider first. | The Sonali-vs-aggregator question (§6) is unresolved. Keeps it a swap, not a rewrite. |
| D5 | **`consumedByApplicationId` (nullable, UNIQUE) exists on `BdsPurchase` from day one**, even though nothing reads it until step 6. | Plan §3.3. Retrofitting a unique index onto a live purchase table is the expensive version. |
| D6 | **Slugs derive from the BDS number** (`bds-1982-2020`), not the title. | Deviates from the sample HTML's title slugs. The number is the natural key: stable, short, unique; titles get re-worded. |
| D7 | **Division is a table, not an enum.** | Bilingual labels, ordering, and later product mapping are data. Plan §1: modules should be configuration-heavy. |
| D8 | **Unresolved policy lives behind one named function**, per the plan's instruction to Claude Code (§12). | So a `[OPEN]` answer changes one place. |
| D9 | **Per-module code splits into a Prisma-free half and a server half** — `lib/store/bds-catalog.ts` (facets, query shape, URL encoding) vs `lib/store/bds.ts` (queries). | A client component importing the query module drags `pg` into the browser bundle and the page 500s. The split makes the boundary a file boundary. |
| D10 | **Navbar active state is a prop (`activeHref`), never `useSearchParams()`.** | That hook opts the whole page out of static prerendering — it broke the build for `/store`, `/accounts`, `/admin`, `/inventory` and `/workflow` at once. Matches how `Footer` already takes `module` as a prop. |
| D11 | **`accountType` gates routes; `role` stays internal-only.** `AccountType { INTERNAL \| CLIENT }` on `User`, defaulting to `INTERNAL`. | Every existing employee row is correct with no data migration. The `Role` enum keeps meaning what it means — client roles arrive later with organization membership (§2.4), on a different axis. |
| D12 | **One guard module, `lib/auth-guard.ts`, enforced in two places.** `accountType` rides in better-auth's signed session cookie so middleware can redirect cheaply; every internal layout also calls `requireInternal()`, which is authoritative. | Middleware runs on the edge and cannot reach Prisma — it only knows a cookie exists. The cookie makes the redirect fast, the DB check makes it true. A stale cookie can never grant access, and a new module that forgets the guard is caught by the middleware prefix. |
| D13 | **The store treats any logged-in user as a buyer.** Purchases hang off `User`, not off a client-only table. | An employee buying a BDS is a buyer who happens to have an employee ID — one identity, two surfaces. Consequence: an INTERNAL user may hold no mobile, so checkout asks for one when missing. That is D3 progressive profiling applied to staff. |
| D14 | **Public surfaces list citizen services, not the module grid.** The landing page "Services" section and the `Footer` / `ModuleNavbar` switchers filter by viewer. | The grid currently shows a public visitor six modules of which they can use one. That is the dead-link problem one step worse — the link works, it just refuses them. §8 asks for service tiles, not an internal inventory. |
| D15 | **The organogram is internal.** `/organogram` moves to `/hr/organogram`; the public hero link is removed. | Decided 2026-08-25. The chart names post-holders across every office — org structure is staff-facing. It also pairs the viewer with the editor already at `/hr/organogram/manage`. |
| D16 | **Mobile identity is better-auth's `phone-number` plugin, mapped onto `User.mobile`** — not `username = mobile`. Mobile-only clients get a synthesised `@mobile.bsti.invalid` placeholder email. | Spike, 2026-08-25. Employee IDs and BD mobiles are both 11-digit numeric, so sharing the `username` column would let a client claim a number identical to an employee ID and deny it. Separate columns make the collision impossible. `/sign-in/phone-number` takes `{phoneNumber, password}` and, with `requireVerification: false`, never touches an OTP — so §2.6 is satisfied with the plugin already in place for when SMS lands. |
| D17 | **Salary fixation is versioned and effective-dated.** An employee has many `SalaryFixation` rows, one per fiscal year plus any mid-year change; a new version truncates the one it displaces to the day before and stamps `supersededAt`. `SalaryProcess` points at the version it was paid from, and a version with a processed month attached can no longer be edited. | Decided 2026-08-28. Pay changes mid-year — a special increment, a promotion, a punishment, a new allowance — and a single overwritable row loses the record of what an employee was actually paid when. It also makes the salary history reconcile without a separate `SalaryHistory` write. |
| D18 | **A fixation is basic salary plus heads.** `SalaryHead` is an editable catalogue (superadmin-managed); a fixation attaches them as `SalaryFixationItem` rows that **snapshot** the head's basis and value. Three bases: `fixed`, `percent_of_basic`, `house_rent_rule`. | Allowances and deductions vary per employee and change over time, so they are data, not columns. Snapshotting means correcting a head's rate today cannot silently restate what someone was paid last year. Head management is superadmin-only because an officeadmin who could invent allowances could raise their own office's pay. |
| D19 | **The pay scale is versioned, and house rent slabs hang off the scale version.** `PayScale` (`NPS-2015`, and whatever replaces it) + `PayScaleStep` (grade × step → amount) + `HouseRentRule`. A scale with no steps loaded is `verified: false` and fixation falls back to manual basic entry. | A new national scale must not erase the old one — fixations made under NPS-2015 have to keep resolving against it, or the salary history stops reconciling. Rates and slabs move together with the scale, so they share its version. |
| D21 | **Basic salary is never entered by hand** — it is the pay scale grid's figure for the grade and step. The NPS-2015 grid is encoded as its generating rule in `prisma/data/nps-2015.ts`, guarded by an assertion that each grade lands on its published maximum. | Resolved 2026-08-28 from `utils/Increment-Chart-2015.pdf` (a scan with no text layer, read three ways and reconciled). The increment is `rate`% of current basic **rounded up** to the next 10, and the rate varies by grade — 3.75% / 4% / 4.5% / 5% — which is why no single formula reproduced it earlier. A reduced salary is a court verdict applied on top, not a typed number. |
| D25 | **Payroll is per office, end to end** — processing, the month sequence and the bank advice. `BankAdvice` gains `officeId`, unique on (month, year, office). An officeadmin is pinned to their own office; a superadmin names one. | Decided 2026-08-28. Each office pays its own staff on its own cheque, and the letter names the office — it always said "প্রধান কার্যালয়" while the list beneath totalled all 23 offices. A single national row cannot represent that. |
| D26 | **Months are processed in order; going back means undoing.** A month cannot be processed while a later one is, and `DELETE /api/salary/process` exists to remove one. Deleting is refused once the advice is issued, and restores any arrear the month settled to pending. | The operator's rule: "if I processed Oct by mistake and now want July, I have to delete Oct". It also gives the system a useful invariant — an issued advice freezes its month, so the stored totals and the entries recomputed from `SalaryProcess` can never drift, and no snapshot table is needed. |
| D27 | **Each office's bank details are data, in `Bank` + `OfficeBankAccount`**, and an advice snapshots them at issue. Office setup lives at `/hr/listing/offices`: superadmin edits any office, officeadmin only their own, and the house rent zone is superadmin-only throughout. | Decided 2026-08-28. The advice hardcoded Sonali/Tejgaon/head-office-account, so every office's letter was addressed to Dhaka. Snapshotting keeps an issued letter a true record when a branch later changes. The zone is withheld from officeadmins because it multiplies every salary in their own office. |
| D22 | **A court verdict is applied by raising fixation versions, not by a parallel pay path.** Recording a verdict imposes it in the same request; if imposing fails the verdict is rolled back. Salary processing and the bank advice are untouched — they pay the version in force. | Decided 2026-08-28. Fixation is already versioned and effective-dated, so a punishment is just another reason to raise a version. A separate "punished pay" path would have to be consulted by processing, payslips and the advice, and would drift. |
| D23 | **Arrears are a sum of differences, never a replay of history.** A verdict-derived version stores `baselineFixationId`; the pay withheld in a month is `baseline.netSalary − process.netSalary`. Revoking with `arrearsOrdered` totals that across the months paid under the punishment and writes one `SalaryArrear`, settled by the next month processed. | The alternative — recomputing what each past month "would have" paid — needs the scale, heads, rent slabs and verdict all as they were on that date. Both figures are already stored, so the difference is exact and cheap. |
| D24 | **`case_officer` is a new role that reaches every office**, and only it and `superadmin` may touch cases. Verdict-derived fixation versions cannot be hand-edited. | Cases are run by a central legal cell, so office scoping would be wrong. A disciplinary record is more sensitive than a salary record, so salary admins are excluded. Locking the derived version keeps the court order the single source of the punishment. |
| D36 | **The whole §5.2 state machine is declared; only the applicant's three transitions are implemented.** `canApplicantMove()` is a deliberately short table covering `draft → pending_app_fee → submitted` (plus withdrawal). | The workflow engine needs somewhere to move a file to without a migration on its first day. But a transition table the applicant's routes can reach is a transition the applicant can eventually be tricked into making, so the reachable set is kept to what they actually drive. |
| D37 | **Submission is not a button — the file submits the moment the application fee settles.** `fulfilPayment()` dispatches on purpose and calls `submitApplication()`, guarded on the fee being `paid` in the database rather than on the caller saying so. | A paid fee against an unsubmitted application is money held for nothing, and refunds are not modelled. Guarding on stored state rather than on the call is what makes it safe from the payment return page, which anyone can navigate to. |
| D38 | **The application number is assigned at submission, not at draft creation.** | A number quoted to an applicant should mean a file exists. Numbering drafts would burn numbers on applications nobody ever finished, and leave gaps that read as lost files. |
| D39 | **The BDS attachment rule is enforced in three layers**, as §3.3 demands: the UNIQUE index, the application-layer checks, and a conditional `updateMany` inside a transaction that is the actual lock. Swapping the standard on a draft **releases** the previous purchase. | The spec is explicit that the UI is not the enforcement point. Verified with two concurrent attaches of one purchase: exactly one wins. Releasing on swap stops an applicant permanently consuming a purchase by changing their mind in a draft. |
| D40 | **The BDS catalogue *is* the product list.** The applicant picks a standard from the catalogue and that names the product — there is no free-text product field. The attached purchase must be a purchase of **that** standard. | Confirmed by the client 2026-08-31. BSTI certifies conformity to a published standard, so a product it has no standard for is not a product it can certify — a free-text box could name one, and would produce a file nobody could act on. It also turns §3.3 check 3 ("the BDS matches the product applied for") from a stub into a real equality test, and makes the standard the applicant must buy a determined fact rather than a judgement call. The Phase G `Product` table becomes an attribute of a BDS later, not a replacement for this. |
| D41 | **Changing the product releases the attached purchase.** `setProduct()` detaches and un-consumes it in the same transaction. | A purchase of the old standard cannot certify the new product, and leaving it attached would let an application reach submission with a standard that does not match. Releasing rather than consuming keeps it usable elsewhere — changing your mind in a draft must not destroy a purchase. |
| D42 | **A standard can be bought from inside the application and returns to the draft** — `beginCheckout(…, next)`, validated by `safeNext()`. | Spec §3.4: "never send them to the store and lose the draft". The path is accepted only if it is app-relative — an absolute URL, `//host` or a scheme is discarded rather than corrected, so a crafted checkout cannot turn the receipt page into an open redirect. |
| D43 | **A CM application may only be made against a standard on the mandatory 315 list.** `productEligibilityPolicy()` refuses anything else; the picker still *shows* non-mandatory standards, marked ineligible with the reason. | Spec §1's asymmetry: "CM/Chemical/Physical operate on a closed list of 315 products. Metrology operates on an open product universe." A CM licence is the permission to sell a product placed under compulsory certification — a standard outside that list is one anyone may build to, and there is no licence to issue. Showing the refusal beats hiding the row: a search for a genuinely unregulated product should answer "you do not need this licence", not "no such standard". Enforced in `setProduct()` and again in `missingForSubmission()`, so a row written before the rule cannot reach the fee. |
| D44 | **`Product` is the CM product list, and an application is filed against a Product, not a BDS.** *Schema landed 2026-09-01 (`Application.productId`, nullable, running beside `bdsId`); the application flow is **not yet moved onto it** — that is the next step.* `Product` ↔ `Bds` is many-to-many (`ProductStandard`), because 24 of the 315 name more than one standard. The required purchase is derived from the product's standards. | Decided 2026-09-01 from BSTI's published list. This **reverses D40's note**, which assumed `Product` would hang off `Bds` as an attribute. The real list is the other way round: it enumerates *products*, each naming the standard(s) that certify it, and a product may need several (a multi-part standard is several catalogue rows covering one article). A manufacturer knows they make toilet soap, not that they make BDS 13:2021 — so the product is the thing to pick, and the standard follows from it. |
| D45 | **A standard the mandatory list names but the catalogue does not price is not for sale.** Rows created by the importer carry `isFromMandatoryList` + `priceIsPlaceholder`, and both `startBdsPurchase()` and the checkout route refuse them. | The published list gives designations, not the Standards Wing's prices, and the stand-in is ৳0 — so selling one would either charge a made-up amount or hand out a purchase for nothing, on a public store, against a shared database. Refusing is the only safe default until real prices are loaded. **Consequence, deliberately accepted:** until then no CM application can be completed, because every mandatory standard is one of these. That is the truth about the data, and a working demo built on invented prices would hide it. |
| D46 | **Generic names are derived only from what the source states** — a bracketed alternative ("Suji (Semolina)") or a slashed one ("Natural Henna/Mehedi") — never guessed. 29 of 315 have one. | The point of generic names is that a manufacturer searches for what they call the thing. Inventing synonyms would put words in BSTI's mouth on a screen that decides whether someone can apply for a licence; an empty field is honest and curation is a data job. |
| D47 | **Standard PDFs live in S3-compatible object storage, and a download is a short-lived signed URL issued only after the purchase check.** `Bds.pdfObjectKey` / `pdfBytes` / `pdfSha256` model it; the object key never leaves the server. | Chosen by the client 2026-09-01 over local disk, which would tie the app to one machine's filesystem — and there are two. It is also where certificates will eventually live, so the kernel document store gets one backend rather than two. **Schema only so far**: no client, no bucket, no credentials, and the UI still says plainly that uploaded files are not kept. |
| D32 | **The payment gateway is an interface with a built-in sandbox provider behind it** — `lib/payments/provider.ts` defines it, `sandbox.ts` implements it, `registry.ts` selects it from `PAYMENT_PROVIDER`. **Stripe was considered and rejected.** | Decided 2026-08-31. Stripe does not support Bangladesh as a merchant country and does not support BDT at all — the only route is a US LLC front, so every line of it would be thrown away, and it needs API keys plus a webhook tunnel merely to test. The sandbox needs no keys, no network and no account, and the interface is shaped after **SSLCommerz and the e-Challan** (session → redirect → IPN → server-side validation), not after the mock. SSLCommerz is the realistic production candidate if an aggregator is permitted. |
| D33 | **Only a server-side `verify()` may mark a payment paid.** The browser returning from a gateway settles nothing; the IPN body is read for a reference and nothing else. | The return URL is attacker-controlled — anyone can navigate to it — and an IPN is an unauthenticated POST from the open internet. Both are hints that something happened, never evidence of what. The sandbox implements `verify()` too, against its own separate ledger table, so the discipline is exercised now rather than bolted on when a real gateway lands. |
| D34 | **Money is stored as integer poisha, and the Income/VAT split is one function, `splitFee()`.** | 15% VAT on a whole-taka price is fractional for most prices (৳350 → ৳52.50), and a float would eventually make the two e-Challan account totals disagree with what was charged. `income + vat === total` holds by construction. Whether the catalogue price is VAT-inclusive or exclusive is an open question, so it sits behind one function (D8). |
| D35 | **`/api/store/*` and `/api/payments/*` join the public API lane** in `PUBLIC_API_PREFIXES`. | API routes are internal-by-default, which would have refused every actual customer at checkout (D13: an employee buying a BDS is a buyer who happens to have an employee ID) and made the IPN callback unreachable, since a gateway posts server-to-server with no session at all. Outside the internal gate is not unguarded: checkout demands a session, and the IPN trusts its body for nothing but a reference. |
| D28 | **A factory's district decides which BSTI office receives its applications**, resolved by `resolveJurisdiction()` in `lib/client/jurisdiction.ts` and **stored on the factory**, not computed at application time. | Decided 2026-08-31. A licence is granted for a product made at a named premises, so the plant's district decides the office — not the company's registered address, which is often a city head office far away. Storing it means a jurisdiction redrawn later cannot silently re-route files already in flight. **The real map is not in the repo** — see the open questions. |
| D29 | **A mother organisation is administrative: it holds no factories and never applies.** Group depth is one level, enforced at the API. A licence is issued to the entity that owns the plant. | The client's own description of their three shapes. Without the depth check a member could be given a member and the group quietly becomes a tree, which the routing and licence-holder rules do not survive. |
| D30 | **Profile completeness is one function, `missingForSubmission()`,** returning named fields rather than a percentage, and returning nothing at all for a group parent. | D8 applied: spec §2.3's mandatory field set is still an assumption awaiting CM Wing, so it changes in one place. Named fields tell the client what to do next; a progress bar tells them only how far they are. A parent gates nothing, so listing thirteen missing fields against it is noise it can never act on. |
| D31 | **Acting-as is stored on the membership, not in a cookie.** | Someone signing in from a second device should land on the company they left off in — and the acting-as company is what an application gets filed under, so it is a real choice, not a UI highlight. |
| D20 | **`computeSheet()` in `lib/salary/compute.ts` is the only calculation path**, called by both the preview and the save route. Prisma-free, per D9. | The operator has to approve a sheet before submitting; two code paths would eventually disagree, and the one they approved would not be the one stored. |

---

---

## Route access model

Decided 2026-08-25. Two account types, and the route prefix decides the audience.

| Prefix | Who | Notes |
|---|---|---|
| `/` | Anyone | Client landing page. Citizen service tiles (D14), not the module grid. |
| `/public/*` | Anyone | Client pages as they arrive — service detail, certificate verification, fees and guides (§8). Empty today. |
| `/store/*` | Anyone | Browse without an account. A session is required only at checkout. |
| `/login` | Anyone | Two lanes (see Step 2). |
| `/hr/*` `/workflow/*` `/accounts/*` `/inventory/*` `/admin/*` `/print/*` | INTERNAL only | |
| `/api/auth/*` | Anyone | better-auth itself. |
| all other `/api/*` | INTERNAL only | Client-facing store APIs get their own prefix when step 3 needs them. |

**A client who requests an internal route is redirected to `/` silently.** No 404,
no 403 page — a citizen never sees an error screen, and nothing is revealed about
what exists internally. An *anonymous* visitor still goes to `/login` with a
`redirect` return URL, because they may well be an employee.

**An internal employee may browse every client surface**, and is rendered there as
a customer — store chrome, purchase history, no HR navigation (D13).

**A client can never reach an internal route.**

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

### ✅ Step 2 — Client accounts and the two-lane boundary
D2 and D11–D16 made real: the account-type split, route enforcement, a two-lane
login, and Tier-1 client registration. Planned 2026-08-25.

**Why the login has two explicit lanes rather than one smart field:** employee IDs
are 11-digit numeric (`20105010089`) and Bangladeshi mobile numbers are 11-digit
numeric (`01712345678`). No heuristic can separate them. Two lanes is forced, not
a preference. *Within* the client lane, mobile-versus-email is unambiguous, so
that single field can detect its own input.

- [x] **Spike first — this gates the rest.** Confirm against better-auth 1.6.9
      whether `User.email` and `User.username` may be nullable, and whether the
      `phone-number` plugin does password sign-in with no OTP step. The answer
      decides whether mobile identity is that plugin or simply `username = mobile`
      on client rows. **Answered:** both columns may be nullable; the plugin
      does password sign-in with no OTP; `/sign-up/email` requires an email, so
      placeholders it is (D16).
- [x] Schema: `AccountType` enum; `User.accountType` (default `INTERNAL`),
      `email` → optional, `username` → optional, `mobile` unique,
      `mobileVerifiedAt` nullable (§2.6 — OTP drops in later without a migration).
      `prisma db push`, and read the data-loss warnings rather than passing
      `--accept-data-loss`.
- [x] `lib/auth-guard.ts` — `requireInternal()`, `getViewer()`. One place (D12).
- [x] Gate the four unguarded module layouts — `(admin)`, `(workflow)`,
      `(accounts)`, `(inventory)` have **no session check at all** today. They are
      placeholders so nothing leaks yet, but they are internal routes standing open.
- [x] Close `app/api/salary/process/route.ts` and `app/api/test/route.ts` — the
      only two non-auth API routes with no `getSession` (37 of 40 do check).
      `api/test` looks like a debug endpoint; consider deleting it outright.
- [x] Middleware: widen the matcher to every internal prefix and make it
      account-type aware. It currently blanket-redirects any logged-in user off
      `/login` to `/hr`, which is wrong for a client.
- [x] Two-lane `/login` — employee ID · mobile-or-email — with a `redirect` return
      URL and the lane preselected by where the visitor came from. Retire the
      hardcoded `bsti@123` quick-login before this page is ever public.
- [x] Client registration (Tier 1: mobile + name) and a client dashboard shell.
      Restores the Sign Up button removed from `ModuleNavbar` in step 1.
- [x] Move the organogram (D15): `app/(public)/organogram/*` →
      `app/(main)/hr/organogram/*`. Repoint `components/layout/Sidebar.tsx:29`
      (it links `/organogram` — the internal sidebar was already pointing at the
      public route) and drop the hero link at `app/(public)/page.tsx:129`.
      The page is `flex flex-col h-screen` with its own header because
      `(public)/layout.tsx` is a bare passthrough; under `(main)` it inherits
      Navbar + Sidebar + Footer, which are themselves `h-screen overflow-hidden`,
      so it needs `h-full` or it will double-scroll.
- [x] Landing page: hero keeps only "Browse standards". The "Services" section
      renders citizen services instead of the `MODULES` grid, and the
      `Footer` / `ModuleNavbar` switchers filter by viewer (D14).

**Found while planning, not fixed here:** the organogram viewer and its editor
read different sources of truth. `(public)/organogram/_components/data.ts` is
3706 lines of hardcoded `WINGS` / `DIVISIONAL_OFFICES` / `REGIONAL_OFFICES`,
while `/hr/organogram/manage` edits the `OrgUnit` / `OrgPost` tables that
`npm run seed:org` populates. Structure changed in `manage` does not move the
chart. Pre-existing; worth its own step.


**Shipped:** `lib/auth-identity.ts` (Prisma-free — shared by the edge middleware
and the browser), `lib/auth-guard.ts`, `lib/services.ts`, a rewritten
`middleware.ts`, `/register` + `POST /api/client/register`, `/public/dashboard`,
and an audience-filtered `Footer`.

**Verified against a running server**, all three viewer types:

| | internal prefixes | internal API | `/` `/store` `/public/dashboard` | `/login` |
|---|---|---|---|---|
| client | 307 → `/` | 403 | 200 | 307 → `/` |
| staff | 200 | passes gate | 200 (customer view) | 307 → `/hr` |
| anonymous | 307 → `/login?redirect=…` | 401 | 200 (dashboard → login) | 200 |

Cross-lane sign-in was checked directly: staff signing in through the client
email field is refused with "BSTI staff sign in with their employee ID." Stripping
the `session_data` cookie so middleware cannot see `accountType` still produced a
redirect off `/hr` — confirming the layout guard stands on its own (D12).

**Two things to know:**

- The account chip in `ModuleNavbar` and the landing masthead read the session
  **client-side** (`authClient.useSession()`). Awaiting it on the server would
  opt the ISR store pages and the static landing page out of static generation.
- The office quick-login now renders only when `NODE_ENV !== "production"`. It
  signs in as an office admin with a shared default password, and `/login` is
  reachable by the public from this step onward.

**Left alone deliberately:** every employee row is still created with the default
password `bsti@123` in `app/api/employees/route.ts`. Pre-existing, out of this
step's scope, and worth its own fix before any public launch.

### 🚧 Step 3 — Purchase, payment, download
Built 2026-08-31, minus the download. The gateway question no longer blocks it.

**The kernel payment service.** `Payment` + `PaymentEvent` (append-only audit),
polymorphic over `subjectType`/`subjectId` so applications, testing fees and
licence fees need no schema change to use it (spec §1). Amounts in integer
poisha with the Income/VAT split behind `splitFee()` (D34).

**The gateway is an interface.** `PaymentProvider` with a built-in sandbox
behind it (D32) — no keys, no network, works offline, and labelled as a
simulation everywhere it is visible. The sandbox keeps its **own ledger table**,
`SandboxGatewayTxn`, so `verify()` is a genuine question to an external system
rather than a payment row reading its own status (D33).

**`BdsPurchase`** (§3.2) with D5's `consumedByApplicationId` UNIQUE from day
one. Deviates from the spec's `buyer_type`/`buyer_id` per D13: the buyer is
always a User, and the acting-as company is a separate nullable link.

| Path | What it is |
|---|---|
| `POST /api/store/checkout` | Raise the payment, open a session, return the redirect |
| `/pay/sandbox/[reference]` | The simulated hosted page — pay, fail, or cancel |
| `/pay/return/[reference]` | Settles by asking the gateway; owner-only |
| `POST /api/payments/ipn/[provider]` | Server-to-server notification |

**Verified against the live database:** the split reconciles at ৳350/৳500/৳1200/
৳33; hitting the return URL without paying grants nothing; a gateway reporting
৳1.00 against a ৳575.00 demand is refused and the mismatch recorded; three
concurrent settlements produce exactly one purchase.

**Still to do:** the PDF download (needs the kernel document store), guest
checkout creating a Tier-1 account (§2.2 Path A), and the real e-Challan account
split once the gateway is chosen.

**No longer blocking:** the Sonali-vs-aggregator answer changes one file.

### ✅ Step 4 — Party registry
Built 2026-08-31. Company profiles, factories, memberships and the profile
switcher (§2.3–2.5), plus the jurisdiction rule that decides which office an
application reaches.

**Schema:** `Organization` (`standalone | group_parent | group_member`, one
level deep), `OrganizationMembership` (`org_admin | manager | viewer`, carrying
the acting-as flag), `Factory` (`district` and `addressLine` are the only
required address parts — the district decides routing), `OrganizationDocument`.

**Surfaces**

| Path | What it is |
|---|---|
| `/public/companies` | The list, doubling as the profile switcher; members nested under their group |
| `/public/companies/new` | The guided wizard — type → company → address → representative → factories → review |
| `/public/companies/[id]` | The profile, what it still needs, editing, and adding factories |
| `/api/client/organizations`, `…/[id]`, `…/factories`, `…/context` | The writes |

**The wizard writes nothing until the last step**, so an abandoned setup leaves
no half-made company behind. The three shapes are offered in the client's own
terms — a group, a company with several plants, or a single factory — because
someone registering one plant should not have to work out that they are a
`standalone`. A single-premises company is never asked for its address twice:
its factory is built from the company address it already gave.

**Verified end to end** against the live database for all three shapes: বাগেরহাট
→ Khulna divisional (no office in the district), সিলেট → Sylhet, রংপুর →
Rangpur; group parent complete with no factory; member companies each routed
independently.

**Still open:** §10 #6 — the mandatory field set is behind
`missingForSubmission()` (D30) pending CM Wing confirmation. Document *upload*
is schema-only; the storage decision is not taken.

**The jurisdiction map is a documented default, not real data** — see the open
questions below.

### ✅ Steps 5–7 — Application, BDS attachment, fee and submit
Built 2026-08-31. The applicant's half of §5 runs end to end: `draft` →
`pending_app_fee` → `submitted`, with the file landing in the right office.

**Schema:** `Application` (the full §5.2 state machine declared, D36),
`ApplicationDocument` (one per requirement, unique on `(applicationId, kind)`),
`ApplicationEvent` (the append-only movement log §4.2 asks for).

| Path | What it is |
|---|---|
| `/public/services/cm-licence` | Service detail page (§8.2) — steps, documents, fees. Public and **static** |
| `/public/applications/new` | Company → factory, with the receiving office named beside each |
| `/public/applications/[id]` | Product (searched from the catalogue), BDS attachment, documents, fee, stage tracker |
| `/public/applications` | The list, each row showing who holds the file |
| `GET /api/store/bds/search` | The product search behind the picker. Public; withdrawn standards excluded |

**Choosing the product is choosing the standard** (D40). The picker searches the
BDS catalogue, and only a purchase of that exact standard can then be attached —
which is what makes §3.3 check 3 a real test. If the applicant owns none, they
buy it **in flow** and land back on the draft (D42).

**Step 6, the attachment rule, is done properly** — three layers per §3.3
(D39), verified under concurrency. **Step 7** is the fee and submission (D37).

**Policy decisions, all behind named functions in `lib/cm/policy.ts` (D8):**

| §10 | Question | Default taken |
|---|---|---|
| #2 | Superseded BDS attachable? | **Yes, with a warning.** Withdrawn is refused. The spec notes this "will happen constantly"; refusing outright penalises the applicant for BSTI's publication schedule |
| #3 | Purchase released on rejection? | **Freed on withdrawal and lapse, consumed on rejection.** Nothing calls it yet — those states are Phase 2 |
| #4 | Group-scoped purchases? | **No** — the spec's own preferred answer. A purchase bought before any company profile existed stays usable by its buyer |
| #6 | Company field set | Already behind `missingForSubmission()` |
| §1 | Which products can a CM licence be applied for? | **Only the mandatory 315** (`productEligibilityPolicy`). `Bds.isMandatory315` is the flag; 15 of the 55 seeded standards carry it, and the authoritative list is Phase G |

**Verified against the live database:** a second application cannot reuse a
purchase; two concurrent attaches, exactly one wins; swapping releases the
previous purchase; another company's purchase is refused; the fee is refused on
an incomplete file; submission is refused before the fee is raised and while it
is unpaid; concurrent fulfilment yields one application number; a submitted file
is frozen.

**Still to do:** document *storage* (the kernel document store — the UI says
plainly that files are not kept yet), the real CM fee schedule (a flat ৳1,000
stands in), and the real document list.

**Note for Phase G:** when the `Product` reference table arrives it hangs off
`Bds` as an attribute (`bds.productId`), refining the picker's search. It does
not replace the standard as the thing an application is made against — that is
D40 and it is now load-bearing in three places.

### 🚧 Step 7b — The mandatory product list
Landed 2026-09-01: BSTI's published list of 315 mandatory-certification
products is now real data in the database, replacing the guess that
`isMandatory315` used to be.

**Source and provenance.** `utils/mandatory list.pdf` (BSTI, June 2025) →
`prisma/import/parse-mandatory-315.py` → `prisma/data/mandatory-315.json` →
`npm run import:products`. The PDF is a Word table printed to PDF, so the
parser had to handle Word's vertically-centred serial cells (six rows render
their number on the row's *second* line), designations that wrap across a
neighbouring row's line, and one pair of designations fused by the original
wrap. **Verified**: 315 items, serials 1–315 with no gaps, the five category
counts equal to the totals the PDF declares for itself, every item with a name
and at least one designation, every designation starting with "BDS".

**In the database:** 5 `ProductCategory`, 315 `Product`, 376 `ProductStandard`,
and 375 new `Bds` rows for designations the catalogue did not hold — the
catalogue had exactly **one** of them, the other 54 rows being the placeholders
`seed-bds.ts` documents as invented.

- [x] Parse and verify the list
- [x] `Product`, `ProductCategory`, `ProductStandard`; `Application.productId`
- [x] Importer, idempotent and batched (per-row upserts against the remote
      database took ~100 minutes; batched, under a minute)
- [x] Refuse to sell a standard whose price is a stand-in (D45)
- [ ] **Move the application flow onto `Product`** — `setProduct()`, the picker,
      `attachBds()`'s equality test becoming "a purchase of one of *this
      product's* standards", and `productEligibilityPolicy()` reading the
      product rather than the BDS flag
- [ ] Search products by generic name
- [ ] Object storage for the standard PDFs and the paid download (D47)

### ⬜ Step 8+ — Workflow engine (Phase D)
Routing path snapshot, descend/ascend/return/reassign, movement log, officer
inbox, SLA clocks (§4.2). The reusable prize — do not build it as "just enough
for CM".

---

## HR payroll — where it stands

Not one of the numbered steps above: those track the CM/store platform, while
this is the HR module, which was already in use and has been made real. As of
2026-08-30 the whole chain runs on live data.

**Done.**

- ✅ **Roster** — 554 employees imported from the HR export (348 officers, 113
  staff, 93 daily basis) across all 23 offices; the 97 demo accounts retired.
  `npm run import:report` dry-runs it, `import:employees` upserts,
  `import:retire` removes what the export does not contain.
- ✅ **Pay scale** — NPS-2015, 314 steps, from `utils/Increment-Chart-2015.pdf`.
  Basic salary is never typed.
- ✅ **Fixation** — versioned and effective-dated, composed of a grade/step
  basic plus editable salary heads; preview before submit.
- ✅ **House rent** — government slab table by office zone, from `rent.xlsx`.
- ✅ **Daily basis** — 800/750/700 per day by zone, 22-day ceiling, days
  confirmed before processing. Outside the pay scale; cannot be fixated.
- ✅ **Court cases** — verdicts raise fixation versions; revocation restores pay
  and settles arrears as a difference against the displaced version.
- ✅ **Processing and bank advice** — per office, in order, undoable until the
  advice is issued. Payslip on screen and as PDF.
- ✅ **Office setup** — contact, house rent zone, and each office's bank branch.
- ✅ **Roles** — superadmin assigns; guarded against self-demotion and against
  removing the last superadmin.

**Known gaps, in rough priority order.**

1. **Everyone still shares the password `bsti@123`**, now across 554 real
   accounts rather than 402 demo ones. This is the oldest open item in the plan
   and the largest exposure; a forced first-login reset is the obvious answer.
2. **`EmployeeCategory` cannot be changed after import.** It is derived from the
   employee id's entry code, which encodes the year and series someone joined
   under and therefore never changes. A daily-basis worker who is regularised
   into a staff post would stay `daily_basis` for ever and could never be
   fixated. Needs to be editable — superadmin only, since it moves someone
   between two pay regimes.
3. **218 records were not imported** — 115 with no identity block, 72 whose
   scrape failed with a 500, 14 that are not people (OSS desks, an API account),
   12 with no office, 5 whose id field holds a mobile number. Re-running the
   import picks them up once the HR system has them.
4. **22 of 23 offices carry improvised bank branch details**, flagged
   `isPlaceholder`; only Head Office's is real. Bogura's address is improvised
   too. All correctable in Office Setup.
5. **The organogram still has two sources of truth** — a 3,700-line hardcoded
   file for the chart, and `OrgUnit`/`OrgPost` for the editor. Unchanged since
   step 2 flagged it.
6. **Salary heads are the operator's own.** MEDICAL, WELFARE and AIT were
   created through the screen; House Rent is seeded. There is no authoritative
   list to check them against.

---

## Open questions outstanding

Tracked from plan §10 and addendum A§10. Answering these unblocks the steps above.

| Q | Blocks | Asked |
|---|---|---|
| Does a digital BDS list exist (count, format, prices, PDFs)? | Real catalogue data | 2026-08-24 |
| Payment gateway — Sonali mandatory or aggregator? (§6). **No longer blocking** — the sandbox ships behind the `PaymentProvider` interface (D32), so the answer replaces one file. Stripe is ruled out: no Bangladesh merchant support, no BDT. | Going live with real money | 2026-08-24 |
| ~~One application = one product = one factory? (§10 #1)~~ **Answered 2026-08-31: yes, and the licence goes to the entity, not the parent.** | Step 5 | 2026-08-24 |
| Company mandatory field set (§10 #6) — now behind `missingForSubmission()` (D30), so the assumed set is in use and swappable | Step 5 submission | — |
| Superseded BDS attachable? (§10 #2) — **default in force: yes with a warning**, withdrawn refused (`bdsEditionPolicy`) | Confirming the default | — |
| Purchase released on rejection/withdrawal? (§10 #3) — **default in force: freed on withdrawal/lapse, consumed on rejection** (`purchaseReleasePolicy`). Nothing calls it until Phase 2 | Phase 2 terminal states | — |
| Subsidiary using parent's purchase? (§10 #4) — **default in force: no** (`purchaseOwnershipPolicy`). The spec expects complaints, so the refusal says what to do instead | Confirming the default | — |
| Password reset with no OTP (§10 #9) | Step 2 launch | — |
| **BSTI's authoritative allowance and deduction list** — MEDICAL, WELFARE and AIT have been entered by hand and House Rent is seeded, but nothing confirms that set is complete or the rates current. | Payroll that matches the books | 2026-08-28 |
| **Should `EmployeeCategory` be editable?** Regularising a daily-basis worker into a staff post is a real HR event the system cannot currently record. | Anyone changing pay regime | 2026-08-30 |
| **Sonali branch details for 22 offices** — seeded values are improvised and flagged. | Correct bank advice outside Head Office | 2026-08-29 |
| **The CM application fee schedule.** A flat ৳1,000 stands in (`applicationFeePoisha()`); the real schedule varies by product category, and the category table is Phase G reference data. | Charging applicants correctly | 2026-08-31 |
| **Prices for the 375 standards created from the mandatory list.** The published list carries designations, not prices. Until the Standards Wing's price list lands, every mandatory standard is unsaleable (D45) and therefore **no CM application can reach submission**. This is now the single biggest blocker on the CM flow. | Any applicant buying the standard they need | 2026-09-01 |
| **Titles for those 375 standards.** The list names the *product*, not the standard, so each created catalogue row is titled after the product it certifies. Correct enough to search by, wrong as a catalogue title. | The store reading truthfully | 2026-09-01 |
| **Curated generic names.** 29 of 315 products carry a name derived from the source (D46); the rest have none, and Bengali generic names have none at all. | Manufacturers finding their product | 2026-09-01 |
| **The real mandatory-315 product list.** `Bds.isMandatory315` now *gates* which standards a CM application may be made against (D43), but the flag is set by the catalogue seed's own judgement — 15 of 55. Populating it correctly is a data job, not a code one; the rule does not change when the list arrives. | Applicants seeing the right products | 2026-08-31 |
| **The CM document checklist.** `CM_DOCUMENTS` is nine items assembled from the spec and general practice, at the same `[ASSUMPTION]` standing as the §2.3 company field set. | Applicants bringing the right papers | 2026-08-31 |
| **Shortfall policy (§10 #7)** — maximum rounds, response deadline, consequence of lapse. Not yet reached, but it gates the Phase 2 review loop. | Step 8+ | 2026-08-31 |
| **Is the BDS catalogue price VAT-inclusive or VAT-exclusive?** Treated as exclusive — the price is the income fee and 15% is added on top (D34). The other reading gives a different total for the same standard, so it is a real question, not a rounding detail. Behind `splitFee()`. | What customers are actually charged | 2026-08-31 |
| **The real Income Fee and VAT account numbers** for the e-Challan split. The proportions are modelled; the accounts they settle into are not. | Money reaching the right government accounts | 2026-08-31 |
| **The district → BSTI office jurisdiction map.** 64 districts, 23 offices, and the boundaries are an administrative decision rather than a geographic one. Resolving today by a documented default (D28): an office in the factory's own district, else that district's divisional office, else Head Office. That routes all 64 districts with no fallbacks — 22 by district, 42 by division — but it is a guess, and two consequences need checking: **Dhaka district goes to Head Office**, and **DMI receives nothing**. | Every application reaching the right office | 2026-08-31 |
| **Where uploaded company documents are stored.** `OrganizationDocument` exists but nothing writes a file yet — local disk, object storage, or the same place certificates will live. | Document upload in the profile wizard | 2026-08-31 |
| **Mymensingh's house rent zone** — a divisional office, but not among the eight cities `rent.xlsx` names, so seeded as `other_district`. | Correct house rent for that office | 2026-08-28 |

---

## Working agreement

Two machines, home and office, never running at the same time. The database is
remote and shared, so only the code needs care. `CLAUDE.md` carries the full
routine; the rule that matters is **push before switching machines** — an
uncommitted change on the powered-off machine is unreachable. If a session ends
mid-task, commit the work in progress rather than leaving it in the working
tree.

`.env` is not in git and must not be. Copy it across by hand once;
`.env.example` lists the keys. Both machines point at the same database.

**Work lands on `main`.** Feature branches were dropped on 2026-08-27 — one
developer, two machines, no reviewers, so a branch only bought a merge step.
`module-path-routing` was fast-forwarded into `main` and retired.

---

## Parallel track — reference data (Phase G)

Addendum A§11: **Phase G gates everything after Phase H and is not a coding
phase.** Wing-by-wing collection of the parameter catalogue, sample
requirements and facility capability matrix. Begin with cement plus 4–5
high-volume products as a pilot rather than all 315.

For the store specifically the reference data is the BDS catalogue itself —
numbers, titles, editions, prices, PDFs. Collection should run alongside
steps 2–3, not after them.
