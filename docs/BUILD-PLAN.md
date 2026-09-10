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
| D48 | **A product that names several standards needs *all* of them.** An application consumes one purchase per standard; `Application.bdsPurchaseId` is gone, replaced by the `attachedPurchases` set, and `BdsPurchase.consumedByApplicationId` is **no longer UNIQUE**. | Confirmed by the client 2026-09-01. 24 of the 315 name more than one and they are not alternatives — a multi-part standard (`BDS ISO 4427-1/-2/-3`) is one specification split across catalogue rows, so certifying the article means conforming to every part. Attaching one part and calling the file complete would put a licence behind a fraction of its own specification. Dropping the unique index sounds like weakening §3.3 and is not: it enforced *one purchase per application*, the direction a multi-standard product makes wrong. One purchase serving one application is enforced by the column being a single scalar FK, plus the conditional `updateMany` that was always the actual lock. |
| D49 | **A standard whose price is a stand-in sells at a labelled demo price of ৳500** while the platform runs on the sandbox gateway. `salePricePolicy()` in `lib/store/bds-catalog.ts` is the only place that decides, and `isProvisional` travels with the price to every screen that shows it. **Amends D45.** | Chosen by the client 2026-09-01. D45's refusal was right about the data and fatal for the flow: all 375 imported standards carry a ৳0 stand-in, so no CM application could be completed at all. No real money can move here — `PAYMENT_PROVIDER` defaults to the sandbox and every payment it touches is stamped `isSandbox` for ever — so the exposure D45 was guarding against is not present. What it was protecting, that nobody is quietly charged an invented amount, is kept by *labelling* rather than refusing. A ৳0 is still refused. When the real prices land they are loaded onto `Bds.priceBdt`, the flag is cleared, and the function stops applying on its own. |
| D50 | **A standard bought from inside an application attaches itself when the payment settles.** `Payment.attachToApplicationId` is recorded when the checkout route raises the payment; `fulfilPayment()` calls the same `attachBds()` the button does. | D42 already returned the buyer to their draft, but left them to attach by hand the thing they had just paid for — a step with no decision in it, and one an applicant can abandon halfway. The application id is recorded at raise time against a session already proven, never read back off the return URL, which is attacker-controlled. Failure is neither fatal nor silent: the purchase is the buyer's whatever happens, so the reason travels to the receipt instead of a paid-for standard vanishing. It also forced `attachBds()` to check membership itself rather than trusting the route — `fulfilPayment()` is a second caller, and a rule enforced only where the button is holds only for people who used the button. |
| D51 | **The articles a licence covers are rows, not free text.** `ApplicationSku` — brand, variant/flavour, size (a `SizeType` + `SizeUnit` + value), packaging, units per pack, grade. `Application.brandName` and `productDetails` are dropped. Brand and size are required; at least one SKU gates the fee. The size type is picked first and the unit list follows from it; `SizeKind` separates measured sizes from chosen ones (the size chart). | Decided with the client 2026-09-01. A manufacturer applying for "artificial flavoured drinks" sells orange 200 ml in a paper can, mango 2 L in a plastic bottle, and six more — different brands among them. Two free-text boxes could hold that as prose but nothing could count it, group it, or print it on a certificate, and the reviewing officer cannot plan sampling from a paragraph. The spec settles the shape: it lists **inclusion** of a new brand/type/size/flavour/grade as its own wing service, so a licence gains SKUs one at a time and each must be identifiable alone. Units are a table under the size type rather than free text because the same unit otherwise arrives spelled five ways — and choosing the type first is what stops a biscuit being measured in litres. The categorical kind exists because a shirt is size M and asking for a number would only get an invented one. |
| D52 | **The application is a four-step form, and the right-hand tracker swaps at submission.** `?step=1..4`, navigated with `StepNavButton`; `FormProgress` while the file is editable, `StageTracker` once it is not. | Decided 2026-09-01. The four steps ask different things — a check of what BSTI already holds, the product, numbers from the plant, a description of how it is run — and one long page hid how much was left. The tracker swap follows from the same fact: "who holds my file" is only a question after submission, and before it every draft answers it identically, while "what is still missing" is only a question before. `Gap.step` is what lets one gap list serve both. |
| D53 | **Packaging artwork is attached per SKU, not once per application** — and it is **metadata only**, like the documents. | A licence covers each brand, size and flavour separately and each is sold in its own wrapper, so one label per file could only ever describe one of them. Asking for it beside the variant also asks at the moment the applicant is thinking about that variant. The bytes are still discarded because D47 is schema and not a client, and the field says so plainly rather than showing a progress bar that drops the file. |
| D54 | **Production capacity and the practice questionnaire belong to the application, not the factory** — with the factory-level answers prefilled from that factory's most recent other application. | The client's own reasoning, and it is right: one plant may run several product lines, so a capacity figure only means something beside the product it is for. A file also has to keep saying what was claimed when it was submitted, which an editable factory-level record could not. Prefill covers the retyping that would otherwise argue for the factory: manpower, quality control and records describe the plant, so they carry across — capacity never does, because copying it would import the wrong product's numbers. |
| D55 | **The declaration is a time and a person, not a flag**, and cannot be given while a required answer is blank. | It is a statement someone made about the answers above it, so a consent that cannot say who gave it or when is not a declaration — and one signed over blanks is not a claim about anything. It stays withdrawable while the file is a draft, or an applicant who spotted their own mistake would be trapped by it. |
| D56 | **One zod schema per payload, in `lib/cm/schemas.ts`, parsed by the form *and* by the server.** Forms use react-hook-form with `zodResolver` and `mode: "onChange"`. | Decided 2026-09-02. The rules were written twice — `validateSku()` on one side, hand-rolled `typeof body.x === "string"` on the other — and two rules that must agree but are written separately eventually disagree. A route that parses the schema cannot be laxer than the screen. It also fixes a real complaint: step 4's warnings came only from the server's gap list, so a question stayed marked missing until Save was pressed, with the answer already on screen. **Validation is not the submission gate** — `missingForSubmission()` stays server-side and authoritative; zod only stops the screen lying. Saving parses `.partial()`, because saving is not submitting and a half-finished step must keep what was written. react-hook-form is adopted in the CM forms only; HR's forms stay on `useState` rather than a big-bang migration. |
| D57 | **`office_head` is a new role, separate from `officeadmin`.** Whoever holds it receives their office's submitted applications and starts them moving. | Decided 2026-09-02. Payroll authority and file-routing authority are different jobs, and welding them together would mean whoever runs an office's salaries also decides who reviews its licence applications. It is a **role and not a designation** because the client's own point is that when the senior desk is vacant a more junior officer acts in it. `User.role` is a single enum, so one person cannot be both office admin and office head — accepted deliberately. |
| D58 | **A file is held by a person, and moves up and down the organogram by grade.** `Application.holderEmployeeId` plus an append-only `ApplicationMovement`. | The client's chain is Director → DD → AD → FO and back up. **Seniority is the pay grade, not the org tree's depth**: the organogram puts a branch Director in the Executive unit beside their stenographer while the officers who do the work sit in sibling units, so depth says nothing. Grade says exactly the right thing, and it is the *employee's* grade, not the post's — an officer on grade 9 may sit on a post graded 11, and seniority follows the officer. Peers on one grade cannot pass to each other: sideways movement would make "who holds it" a matter of who clicked, unreadable afterwards. An office head passing **down** is exempt from the grade test, because an acting head is the top of their section whatever their own grade. |
| D59 | **The movement log is its own table, not events.** | `ApplicationEvent` says what happened to the *application*; `ApplicationMovement` says who had it and when. "How long did this sit with the AD" is a question about the second, and mixing them would mean parsing notes to answer it. |
| D60 | **A test parameter is owned by its sub-product, never shared.** `Product → SubProduct → TestParameter → TestSubParameter`, with the fee and method on the parameter. | Decided 2026-09-04, the client's own design. The same parameter name recurs across sub-products carrying a different limit, a different fee, or both — **94 of 181** distinct (parameter, sub-parameter) keys in the textile file have more than one limit; `Ends and Picks per cm` has 10. Owning the parameter downward means two sub-products naming the same test are two rows with no cell to collide in, so a mismatch is not representable rather than merely forbidden. The cost is that the *name* is a string repeated across 713 rows; `TestParameter.slug` is carried so "is this the same test" stays answerable for cross-wing reporting, and it is explicitly **not** an identity — "Moisture" in the textile file and the food file are different tests. |
| D61 | **The standard limit sits at the leaf.** On the parameter when it has no sub-parameters, on the sub-parameter when it has them. | A parameter is one charge that may produce many rated readings — colour fastness to perspiration is one ৳700 test yielding 14 of them. Charging at the parameter and recording at the leaf is what the source data already does; anything flatter gets one of the two wrong. The importer asserts it rather than assuming it, and the 10 rows with a genuinely blank limit are stored `unspecified` rather than being quietly dropped. |
| D62 | **The fee is per parameter. A wing file's "Total Test Fee" is that lab's subtotal, and no total is stored.** Urgent is 2× the normal fee unless a parameter overrides it. | Decided 2026-09-04 with the client. Every lab produces its own file in the same format, so the same (product, sub-product) arrives again from the chemistry file with *its* parameters — the fee an applicant pays is the sum over every lab, and a stored total would be a per-lab figure masquerading as the price. A product that is entirely physical therefore has subtotal = grand total for free, with no zero rows needed. This **supersedes session 1's reading** of ৳494–৳9,464 as the test fee: that is the textile share. Urgent is a nullable column rather than a constant because the wing says 2× holds "99.99% of the time", and the exceptions must be recordable. |
| D63 | **A lab is an organogram unit, and the discipline comes from the file the parameter arrived in.** `Lab.orgUnitId → OrgUnit`, `TestParameter.discipline` + `sourceSection`. | Head office splits its two testing wings into sections (Textile, Organic Chemistry, Food & Bacteriology); a branch office has one flat `Physical Lab, <city>` and/or `Chemistry Lab, <city>`. Both are OrgUnit rows, so one model covers the two shapes — 46 labs seeded from the organogram with **none guessed**. Discipline is not derivable from a parameter's own row and is not stored per sub-product: it is a property of which wing's file the row came from. It decides which wing supervises work sent outside. |
| D64 | **Capability and routing are two tables, not one map.** `LabCapability` is sparse ground truth; `LabRouting` is the office × parameter map each office maintains. | The client is right that referral is arbitrary and must be stored, not derived — Barisal may send what it cannot test to Cumilla rather than a nearer, capable Khulna. But a map that stores a destination directly can name a lab that cannot run the test, and nothing would check it. Splitting them lets the resolver require that a nominated destination actually holds the capability, while the mapping module still renders exactly the 2D grid the client asked for. The fallback is not hypothetical, and D106 made it larger: **11 offices have a working chemistry lab and only 7 a physical one**, and the other 12 have no laboratory at all — so every parameter filed at those 12 falls through on day one. |
| D65 | **Third-party testing is a mode, not a destination.** `LabRouting.labId` is always the accountable BSTI unit; `mode: third_party` says the sample is physically tested outside. | The sample leaves BSTI but custody does not — the examiner of the matching discipline selects the accredited lab, writes to it, and enters the result. Collapsing the two into one field would leave the destination letters ungroupable and the examiner with no row to record against. |
| D66 | **Every seeded routing row is flagged `isPlaceholder` and points at the owning head-office section.** | Decided 2026-09-04: the client asked for all the rows — 16,399 then, **109,641** since the chemical files landed — to point at head office until offices enter their own. A stand-in that looks identical to a decision is the failure mode here — the same reasoning as the seeded bank branch details — so the flag travels with the row and the mapping module clears it. |
| D67 | **An article belongs to a sub-product, not to an application.** `Application → ApplicationSubProduct → ApplicationSku`, and the applicant picks the sub-product themselves. | Decided 2026-09-04. A variant only means something beside the sub-product it varies, and the sub-product is what resolves a test plan — so choosing it is what lets a **test fee be quoted before inspection** rather than only after it. `declaredBy` on both rows keeps the applicant's declaration apart from the FDO's finding: he adds the sub-product he found on the floor and the variant they forgot, and "did they under-declare, or did we find more" stays answerable in a dispute, which an overwrite could not do. |
| D68 | **A specimen carries three identifiers, and the printed one belongs to neither side.** `ref` in the QR, `cmCode` for CM staff, `labCode` for the testing wing. | A QR is an encoded string: any phone decodes it with no session, so whatever is printed on the jar is readable by the FDO who binds the label *and* the examiner who opens the box. Printing either working code therefore hands it to the other side. Printing a third means correlating them needs system access. **`labCode` is not derived from `cmCode`** — a hash needs the mapping stored anyway, and a rotating salt would either change the code mid-test or force every old salt to be kept for ever; a sample lives for weeks and its identifiers must not move. The key worth rotating protects the *link*, not the code. |
| D69 | **Destinations are derived, counts are entered, and the answer is remembered.** `SampleRequirement` per (application sub-product, lab); `LabSampleRequirement` as the learned default. | The routing map already answers "received at Barisal, which labs run A1's parameters", so the FDO cannot forget a destination or prepare a box nobody needs — both slips the client's own worked example contained. What the map cannot say is how many specimens each lab wants, which turns on quantity and destructive testing (A§1.2, uncollected). So he phones and types a number, and the lab's row remembers it: the first application for a sub-product costs a call, every one after arrives pre-filled, and no data-entry project was needed. |
| D70 | **`Sample` and `LabTestOrder` carry no application column at all**, and the two sides meet only in `SampleRegistration`. | Not hidden in the UI — absent from the table, so a lab-side query cannot reach the applicant however carelessly it is written, and `lib/samples/resolve.ts`'s lab branch never touches the registration. **This is not an absolute barrier and must not be described as one:** one database means any link is a join away for whoever writes the join. What the shape buys is that the accident cannot happen and the deliberate act is visible — every crossing is written to `Reidentification`. |
| D71 | **`/s/<ref>` answers according to who is asking, and refuses identically to everyone else.** Role *and* relationship, never role alone. | The same jar shows an examiner its sub-product, specimen number and *only this lab's* parameters; it shows the file's own officers the applicant. A CM officer in Dhaka has no standing on a Barisal file and an examiner has none on another lab's bench, so the gate is a relationship check, not a role check. A refusal is identical whether the token exists or not — a distinct 403 would let anyone with a photographed label learn which codes are live. `/s` is in `INTERNAL_PREFIXES` **and** its layout calls `requireInternal()`, per D12. |
| D72 | **A box is sealed by the FDO and opened only by the lab; the counter checks the seal, never the contents.** One `Consignment` per (application, destination lab). | The applicant carries the sealed boxes to each destination office themselves, so the samples are in their own custody between factory and counter — the seal is the only thing standing between the two, and a broken one is a refusal rather than a note. It follows that a short consignment surfaces at the lab days later and possibly in another city, so the submission letter must list seal numbers for the counter to have something real to check. |
| D73 | **`sample_received` is the last box, not the first.** `sample_partially_received` covers the rest. | The applicant visits every destination office, so receipt is several events with several dates and testing at one lab begins independently of another. A single flag would have called a file complete when one box of five had arrived. |
| D74 | **Additional charge is a second, nullable link to a post — `Employee.actingOrgPostId` — and the acting post's grade wins over the officer's own.** | A wing whose Director post is vacant runs on a Deputy Director holding its charge; the CM wing does today. Everywhere else the *employee's* grade decides seniority, because an officer on grade 9 may sit on a post graded 11 and it is the officer who is senior. Additional charge is the one case that inverts it: the point of the charge is that they act with the post's authority. So `toDesk()` reads section and grade from the acting post, and a DD acting as Director (CM) ranks grade 4 inside the wing — verified, he now passes to the wing's other DD by the ordinary rule, where by his own grade 6 `canPassTo` refused. Two columns rather than one moving link, because he keeps his own desk and the charge ends by nulling one field. No history is kept: if "who was acting the day this file moved" ever needs answering it becomes a table with a date range and an office order number, and `toDesk()` is the only reader. |
| D75 | **A retired or inactive officer may never be handed a file** — `Desk.isActive`, checked on the candidate and never on the sender. | Office scoping is `employeesOfOffice()`, which asks where somebody works and not whether they still do — it is payroll's rule, borrowed — so a retiree holding a desk stayed in the picker. Found when the client mentioned in passing that Head Office's `office_head` had retired. The sender is deliberately exempt: if a file is already in a retired officer's hands it must still be possible to move it out of them. |
| D76 | **A file orphaned by its holder leaving is moved by an administrator to the office head, and recorded as its own `reassign` direction.** | `holderEmployeeId` is a person and "nobody holds it" means unclaimed (D58), so a file does not fall back to anyone when the holder goes — and `pass()` lets only the holder move it, while a retiree who gave up their desk has no section for `canPassTo()` to work with. It goes to the office head because that is where a submitted file arrives in the first place (D57), so it is where this one would have been had the holder never received it. `reassign` rather than `up` because nobody sent it: the movement log is the answer to "who has my file", which spec §8 calls most of the perceived value of the system, and `up` would attribute an action to someone who had left. `fromEmployeeId` still names them, so the break in custody stays readable. No screen yet — `npm run fix:orphaned-files` is the only path, and reassignment is on the step 8+ list. |
| D77 | **Standing to see a file comes from the movement log, not from a role: every desk that has handled it keeps seeing it, and the desk flow with it.** | A file vanished from your board the moment you passed it on — right for "what is on my desk", wrong for everything else, because the officer who wrote the inspection report is the one the applicant telephones and he had no way to answer. `touchedBy()` reads `ApplicationMovement` in both directions (`toEmployeeId` is every desk that held it; `fromEmployeeId` catches the office head who received and passed down in one sitting). It is a fact about the file rather than a permission, and it grants nothing: `PassPanel` and `ReceiveButton` still key off holding it, and `pass()` re-checks on the server. Not office-scoped — someone who handled a file and has since transferred still handled it, and hiding it would make the history disagree with itself. Spec §8 calls "who holds my file" most of the perceived value of the system; this is the internal half of the same answer. |
| D78 | **Amends D58. Seniority is the pay grade *then* the designation's rank within it, not the grade alone.** `seniority()` returns the pair; `deskRank()` breaks the tie. | Assistant Director, Field Officer, Examiner, Inspector and Senior Examiner are all on grade 9, and 16 of head office's 22 CM desks sit in that one band — 6 ADs and 10 FOs. By grade they were all peers, so an Assistant Director holding a file could not hand it to a single Field Officer, which is precisely the processing chain the spec describes: office head → AD (CM) → FO (CM). Eleven branch offices have only grade 9 in their CM section and **Cox's Bazar was deadlocked outright** — five desks, not one hand-off possible. The tie-break uses `deskRank()`, the same table the picker already groups by and which was written for this exact observation, so the order shown and the order enforced cannot disagree. Purely additive — it only decides pairs that tie on grade, so no hand-off that worked before can stop working. Measured across all 23 offices: 3,423 possible hand-offs → 4,730, and desks that could reach nobody 5 → 0. Peers remain peers: two ADs on grade 9 tie on both halves and a file may not move between them. |
| D79 | **Amends D58. A file may be passed to a desk at the sender's own level, recorded as a `down`; `up` remains strictly senior.** | D58 refused same-level hand-offs on the theory that sideways movement would make "who holds it" a matter of who clicked first, with no chain to read back. That reasoning does not hold: `holderEmployeeId` is a single column and every move is appended to `ApplicationMovement`, so the history reads back whatever route the file took. And it was wrong about how the office works — the client's own rule is "pass to can send to same level or junior", because a section holding six Assistant Directors expects the one covering that product line to take the file from whoever received it. The two directions remain disjoint and together cover the section: a desk is either senior to you or it is not. Verified over all 5,640 head-office section pairs — none appears in both lists, none in neither — and no desk in any of the 23 offices can now reach nobody. |
| D80 | **Every officer on a file's flow can read the whole file — preview, attachments and fees — at `/workflow/[id]`, and a refusal is a 404.** `canViewApplication()` is the one rule. | Spec §8 puts most of the system's perceived value in answering "where is my file and what is in it", and an officer could see a summary row and nothing else. Standing is the same as D77's: you hold it, you have handled it, it is your office's and you are its head, or you are a superadmin. The office head's reach is the office's files rather than only the ones they touched, because a file they have not yet picked up is one they must read before deciding who gets it. Reading is deliberately not acting: the actions stay on the board, keyed off holding the file, and `pass()` re-checks on the server. The refusal is `notFound()` for the reason D71 gives about `/s/<ref>` — a distinguishable 403 would let any member of staff enumerate which application numbers exist and which office holds them. The attachments panel states plainly that the bytes are not stored, because the kernel document store does not exist and an officer must not believe BSTI holds a trade licence it discarded. |
| D81 | **A shortfall is an edit permission, not a note.** The reviewing officer marks points from a closed list; exactly those parts of the application reopen, and the loop runs any number of rounds until he marks the file ready for processing. | The officer previews the whole file (D80), ticks what is wrong and says why. Each mark is a `ShortfallItem` naming what reopens — a section such as `production`, or `document:<kind>` for a single paper, because "your trade licence has expired" should not reopen the whole checklist. `editScope()` in `states.ts` is the one place those rows become "may I write this", and both the page that greys a step out and the route that refuses the write go through it. A covering note alone would leave the officer's intent unenforceable, and reopening the application wholesale would invite changes nobody asked for after the fee had been paid. **The file never changes hands:** `holderEmployeeId` is untouched and the state is what says the applicant owes a response — handing it back would put it in an applicant inbox that does not exist. **Any number of rounds**, which is the client's own rule and settles the "maximum rounds" half of §10 #7; the deadline and lapse halves are still open. It ends at the existing `review_passed`, so the applicant's tracker gains no new stage. Nothing checks that a marked point was actually corrected — that judgement is the officer's, which is why he looks again. Raising is guarded on *holding* the file, not on a role: an officer two desks away who may read it (D80) must not be able to write to the applicant in its name. **No notification channel exists** — no mail, no SMS — so the panel on the applicant's page is the notice. **Packaging artwork is marked per variant** (`artwork:<applicationSkuId>`), because a licence covers each brand, size and flavour separately and each is sold in its own wrapper (D53) — reopening every wrapper because one label is wrong invites replacements nobody asked for. Those targets are dynamic, so `raiseShortfall` checks the SKU belongs to the application. An artwork-only permission writes **only** the label columns, enforced in `updateSku` rather than by the form, since the variant editor posts the whole article and comparing what changed would let a resubmitted brand name through. |
| D82 | **The inspection plan travels with the file up the ordinary chain, every desk above may correct it, and the office head approves — which issues the office order.** | The reviewing officer proposes a date and a team once the desk review passes; the review closes at that point and no shortfall may follow. The plan has **no queue of its own**: it moves with the file on D58/D78/D79's chain, and a senior desk holding it may rewrite the date or the team rather than sending it back, because a round trip for a typed date is what makes people work around a system. Approval is the `office_head` role, which is the wing's Director or the officer acting in that post (D57, D74), so nothing needs to name an approver — and the approver must hold the file *and* belong to its office, since the order carries an office's name. **The office order is numbered at approval**, `<office>/INS/<year>/<serial>`, for the reason an application number waits for submission: a number quoted to a factory should mean a visit that is going to happen. It shows on the board row and in the desk flow so every desk on the chain sees it. An approved plan is immutable — changing the date means a fresh order. Team members are rows rather than a text field, replaced wholesale on save (a diffed list leaves somebody on a visit nobody meant to include), and each is checked against the serving roster because a plan is an instruction to people. |
| D83 | **Amends D82. Approvals are given by the proposer's *immediate senior*, not by the office head.** Inspection plan today; the inspection report and the sampling report will follow the same rule. | The client's own instruction: the question "is this plan sound" is answered by whoever the proposing officer reports to, and sending it up to a Director is asking him to read a date — the higher authority is content to follow it on the desk flow instead. `immediateSeniors()` is the smallest step up the D78 seniority pair, which is what makes it work at all: a Field Officer's approvers are the six Assistant Directors on his own grade 9, not the Deputy Directors above them, and grade alone could not tell those apart. Several people share the rung and any may act, because an approval only one named person can give waits for him to come back from leave. A desk further up may also approve rather than being refused — refusing would strand a file that had been passed higher than it needed to go — but the proposer may never approve his own plan, and the approver must be holding the file. |
| D84 | **Amends D83. The approver is the officer who handed the file down — `delegatorOf()` — not a senior chosen from a list.** | The client's correction: "the immediate person on the upper chain who sent down to FDO", so choosing is redundant. D83 computed the immediate senior rung from the organogram and offered it as a picker, which asked a question the file's own history already answers and let the wrong person be picked. `delegatorOf()` reads the most recent `down` movement addressed to the holder. Only `down` counts: a `receive` has no sender, an `up` came from somebody junior, and a `reassign` was an administrator moving a stranded file rather than a superior delegating work. Because the target is derived rather than chosen, the hand-off is written directly instead of through `pass()` — the chain test exists to stop an arbitrary sideways move, and there is no choice here to abuse — and it is recorded as an `up` so the desk flow reads the same. `immediateSeniors()` was deleted with the picker; nothing else used it. |
| D85 | **The office order is an official letter on the government letterhead, and the screen and the PDF are the same page.** | An approved inspection goes to a factory, so it has to look like what BSTI issues rather than a panel in an app: `GovHeader` with `orgForOffice()` — a Barishal order carrying Barishal's address — a memo number and date, the subject line, a body naming the company, factory, product and visit date, the team as a numbered table, and the approver's signature block. It is its own route because it is a document: it prints and it downloads. Puppeteer renders that same URL for the PDF with the toolbar `print:hidden`, the arrangement the salary slip already uses, so a letter cannot look one way on screen and another on paper. The number is a memo number, `বিএসটিআই/<office>/পরিদর্শন/<serial>/<year>`, matching `generateMemoNo()`; the first version used the office's database id, which put an internal number on a letter going to a factory. Stored with ASCII digits so the serial parses, printed through `toBengaliDigits()`. **The Bengali wording is drafted, not supplied** — it follows the bank advice's register, and the sentences need a CM Wing officer's eye even though every fact in them is real. |
| D86 | **The initial inspection report is the wing's own form as rows, with production recorded *as found* beside what was declared.** | Modelled on `utils/inspectionReport.html`, which the wing uses today. Three differences the data makes possible: production found beside production declared, because "did they under-declare" is the question an inspection exists to answer and the paper form's single capacity box cannot ask it; nothing re-typed that the file already holds, since paper asks for the product and the addresses only because paper cannot look them up; and the five conditions, nine marking checks and eleven narrative sections stored as rows rather than columns, so the wing adding an item is data and not a migration. The attachments the paper asks for are text, because there is no document store and a file nobody can reopen is worse than the substance in words. `reportGaps()` returns every gap at once and sending is refused while any remain — a report that reaches a senior half filled costs two hand-offs to fix what one check catches. It travels and is approved exactly as the inspection plan does (D84), numbered at approval like the office order (D85), and is readable and downloadable once **sent up** rather than only once approved, because the senior approving it reads it as a document. |
| D87 | **The FDO's sampling screen: the grid is derived, the counts are typed, sealing is one irreversible act, and only `ref` is printed.** | The services existed (`buildPlanFor`, `setRequirement`, `commitSampling`) and the screen did not, which is why no sampling letter could be written. It appears once the inspection plan is approved — sealing for an unauthorised visit would be jars nobody sent anyone to collect. Destinations come from `LabRouting` so a lab cannot be forgotten and an empty box cannot be packed (D69); the one entered figure is specimens per variant, which turns on sample quantity and destructive testing, the A§1.2 data nobody has collected. A figure the lab agreed last time shows as a **suggestion, never a default** — it was agreed for a different consignment, and filling it in silently would make last month's quantity this month's decision. A cell whose routing is still the seeded stand-in says so on the row (D66). Labels carry the QR to `/s/<ref>`, the sub-product, the size and the specimen number, and **not the brand**, because the variant is the applicant's identity (D71); `cmCode` and `labCode` are never fetched by the page that prints. The QR renders to SVG on the server, so the client bundle is untouched and one markup serves screen, print and PDF. |
| D88 | **Sampling and the inspection report belong to the visiting officer — whoever proposed the plan — not to whoever holds the file.** | Every other act on the process page keys off holding the file, which is right: the holder is accountable for it. These two are different, because the file passes back through the approving desk on its way down and up, and the approver would otherwise inherit the officer's job with the paperwork. A senior supervises and approves; he does not seal jars or write up a visit he did not make. Both panels still render for a reader, with the fields disabled and the reason said out loud — an approver has to read what he is approving, and a field he can type into but not save is a form that lies about who owns the work. |
| D89 | **What the inspecting officer finds at the factory is added to the application, not to the sampling letter** — stamped `declaredBy: fdo`, and refused once the jars are sealed. | The client's question, and the answer the model already implied (D67). A sub-product or variant recorded only on the letter would be sealed and tested but never applied for: no routing, no parameters, no test fee, and a licence that does not cover the article the jar came from. On the application it brings its own parameters, its own laboratory and its own fee, and the sampling grid picks it up with no extra step — verified: one found sub-product took the file from 3 cells and ৳7,748 to 4 cells and ৳10,564. `declaredBy` keeps the officer's finding beside the applicant's declaration rather than over it, because "did they under-declare, or did we find more" is asked in disputes. Amendments close at sealing: `commitSampling()` refuses to re-run, so anything added afterwards would be licensed without ever having been sampled. |
| D90 | **The visit's working — the sampling plan, the labels and the inspection report — is visible to the officer who made it, then to the desk it is sent to, then to the whole chain once approved.** `inspectionAudience()`. | D80 gives every desk that has handled a file the right to read it. That is right for the application and wrong for a report being written: until it is sent up it is a draft, half-answered, with a capacity figure the officer has not checked, and a senior reading it either corrects work that was going to be corrected anyway or forms a view of a visit from notes. So the audience widens as the work firms up. The sampling plan has no rule of its own — it is the same visit, and a senior who cannot read the report has no use for the jar counts behind it. The printed report and the label sheet take the same rule, so a link cannot outrun the panel that offers it. A superadmin is not exempt, because the point is not access control against administrators but that unfinished work is not somebody else's to read. |
| D91 | **A declared line the factory is no longer making is *struck out*, not deleted** — `notInProductionAt`, set by the inspecting officer and reversible until the jars are sealed. | The client's case: a factory may discontinue a product line between applying and the inspection, and the officer is the one who finds out. He needed to take it off the application, which D89 had refused him because deleting the applicant's declaration destroys the answer to "did they under-declare". Striking out gives both: everything downstream ignores the row — no sampling cell, no box, no test fee, nothing on the letter, nothing licensed — while the declaration stays readable, with who struck it and why. Measured: striking one of four sub-products took the file from ৳10,564 and 4 cells to ৳7,748 and 3, and restoring it returned both exactly. At variant level it changes only the count of articles under that sub-product. The officer's *own* findings are deleted outright instead, because there is no declaration to preserve — and the service refuses to strike one out, pointing him at Remove. |
| D92 | **The inspection report and the sampling record are approved together as one visit, and the approving desk has three answers: approve, send back, or declare the factory not ready.** | Splitting the two would let a senior approve a report about a factory whose samples he has not seen, or clear jars without the findings that justify drawing them — so sending is refused until the jars are sealed. The three answers exist because a visit is wrong in three different ways and each needs a different thing to happen. **Approve** numbers the report and hands the file straight back to the officer, since the letters that follow are his to issue (the same reasoning as D82). **Send back** is a note between two desks: the paperwork is wrong, nothing on the application reopens, the samples stand, and `submittedAt` clears so he can send it again. **Factory not ready** raises a `FactoryDevelopmentNotice` and puts the file in `awaiting_factory_development`, waiting on the applicant rather than on BSTI — deliberately not a shortfall, because a shortfall reopens fields on a form and this asks for work in a building, and the visit and its samples stay exactly as recorded since a re-inspection is a second visit rather than an edit of the first. |
| D93 | **The One Stop Service Centre is a desk — the `one_stop` role — and its list is of consignments, not applications.** | Whoever is assigned it at an office sees the boxes coming to that office, so the counter keeps working when the person on it changes. Boxes are listed by the **laboratory's** office rather than the file's, because the applicant carries each box to the office of the lab that will test it and that is frequently not the office the application belongs to — a counter scoped to its own office's files would miss precisely the boxes walking through its door. It is scoped to `Consignment` because the counter never holds a file: its whole part in the flow is receiving a sealed box and saying whether the seal was intact. Payment is read-only to it and must stay so (spec §5.2) — a counter that could mark a file paid is a counter that can be argued with, and cash-at-counter, if it is ever real, belongs in the Payment service as a method with a receipt rather than as a status toggle here. |
| D94 | **The testing wing head is whoever holds the wing's Director post — substantively, or in additional charge — and where nobody does, the letter is unaddressed rather than guessed.** Supersedes the earlier "seniormost officer of the section". | That earlier rule was written before additional charge was a column (D74), and the live roster breaks it: head office's Physical Testing Wing contains two grade-4 Directors, one holding Director (Physics) and one sitting on a Deputy Director (Textile) post from the original seeding. They tie on grade and on designation rank, so "seniormost" returned whichever the sort put first. The post is the fact; seniority was a proxy for it. The client's rare case — a Deputy Director given the Director's charge — is then not a special case at all but the second branch of the same rule, which is what D74's column was added for. The third branch matters as much: head office's Chemical Testing Wing has a vacant Director post and nobody acting in it *today*, so a seniority rule would quietly address the letter to whichever Deputy Director sorted first. An unaddressed letter is fixed in a minute; a letter addressed to the wrong Director is never noticed. Branch offices have no testing wing — their labs hang off the branch — so the office head receives there. |
| D95 | **The letters after an approved visit are derived from the sealed boxes and issued by the visiting officer in one act — not sent automatically at approval.** | The client asked which of the two. Automatic issue would attribute them to the approving desk, when the wing-head letter says "these samples are coming to your laboratory" and that is the sampling officer's statement; it would also commit seal numbers and specimen counts the moment they are approved, so a wrong one is already out. Leaving him to compose them invites the omission `resolveDestinations()` exists to prevent. So the set is worked out for him — one per destination laboratory's wing head (D94), one to the applicant, one to each One Stop counter — and he issues it. Approval already hands the file back to him (D92), so there is no extra hop. **All or none**, because a partial dispatch means a laboratory expecting a box the applicant was never told to carry, and refused while anything is unaddressed, with every obstacle listed at once. Numbers are consecutive across a dispatch, so a gap means a letter that never went. |
| D96 | **The sampling report is its own document but carries no state of its own** — no serial, no submitted flag, no approver. It prints under the inspection report's number and is approved by the same act. | One visit produces two papers: what was seen at the factory, and what was drawn from it. The client asked for both to be "generated by FDO and sent to AD for approval", approved together, after which the file returns to the officer with the letters drafted. Giving the sampling report its own approval would make that separable, and a factory passed on inspection but with its sampling refused is not a state anyone can act on. Almost every line is already a row — the specimens, seals, destination laboratories and parameter counts were written when the boxes were sealed (D87) — so the officer writes only `samplingRemarks`, the part no row holds. `sendReportForApproval()` already refuses while no consignment exists, which is what ties the two together at the sending end. |
| D97 | **The sampling *screen* is the visiting officer's alone; every other desk reads the sampling *report*.** | The screen estimates counts, generates tokens and seals boxes — work a supervising desk does not do. Leaving it visible to the chain after approval (D90 widens the audience for the *report*) put a working tool on desks whose job was to read a document, which is what the client meant by "stays at everyone's desk". The document link answers the same question without offering the buttons. |
| D98 | **The applicant's sample submission letter is a page on the client surface, not a link to something internal** — `/public/applications/[id]/letter`, with its PDF under `/api/client/…`. | Three letters issue on approval (D95) and this is the only one the applicant ever sees; it is also the only one that *asks* something of the reader. It could not live under `/workflow` — that prefix is INTERNAL-only, so the person the letter is addressed to is the one person who cannot open it there. The page repeats its substance in a panel on the application rather than only linking to it: there is no notification channel — no mail, no SMS — so the page is the notice, exactly as the shortfall panel is (D81). **Seal numbers are printed in full**, because they are what a counter checks a box against, and a short consignment must surface at the counter and not at a bench in another city a week later (D72). Access is `membershipFor()`, and a wrong id is a 404: a letter carries seal numbers, so its existence must not be confirmable. |
| D99 | **Two fee columns on the parameter, both always filled and both NOT NULL: `feePoisha` and `urgentFeePoisha`. The urgent price is the sum of the second, exactly as the normal price is the sum of the first — no rule, no doubling at read time, no refusal.** `urgentFeeSource` records where each figure came from. Amends D62. | The client's simplification, and the right one. D62 made `urgentFeePoisha` nullable with null meaning "twice the normal fee", which is a rule evaluated at read time — and the moment a second wing prices differently, a null stops meaning "double" and starts meaning "nobody knows", with no way to tell the two apart. Storing both numbers removes the ambiguity instead of managing it: the column is NOT NULL, the reader sums, and selection (D101) composes for free because both prices are per parameter. **The work moves to the importer**, which is where deciding a number once, in a script whose output a person reads, belongs. **Do not reintroduce a doubling rule at read time.** How each figure is arrived at is D102. |
| D100 | **The evidence that chemistry's urgent surcharge is per-test is strong but not proof, and is recorded as a question rather than imported as a fact.** Under D101 this stops being avoidable: with selection there is no package total to fall back on, so those 124 packages simply have no urgent price until the wing answers. | For 121 of the 124 non-2× packages, `urgent total − normal total` is *exactly* a subset-sum of the parameter fees — i.e. some tests double and the rest do not — and the tests left at single fee are a coherent set: Aldrin and Dieldrin (47 of 47 packages, never doubled anywhere), aflatoxin, heavy metals by AAS, and microbiological counts. All are tests with a floor on their turnaround: a five-day incubation and a queued GC-MS run cannot be hurried. But **subset-sum is ambiguous where fees repeat** — Moisture reads as single in 7 packages and doubled in 97 — so the decomposition identifies *a* subset, not *the* subset, and writing per-parameter urgent fees from it would be inventing precision the file does not carry. It is the right question to put to the wing, and the wrong thing to import. |
| D102 | **The urgent fee is 2× the normal fee per parameter, except that a package whose urgent turnaround is not shorter carries no surcharge at all, and a package whose published urgent total is not twice its normal total is *apportioned* to match what the wing actually charges.** One flat multiplier over every parameter in the package, largest-remainder so the parts sum to the published figure exactly. `priceUrgent()` in `lib/labs/urgent-fee.ts` is the only place it is decided, shared by both importers, the recompute script and the catalogue screen. | Decided with the client 2026-09-08, and it closes the gap D100 left open. The flat 2× rule reproduced the wing's published urgent total for 271 of 408 packages and **overcharged for 115** — Poultry Feed (Layer-4) computed to ৳40,000 against a published ৳25,000. D100 records strong evidence that the real surcharge is per-test, and equally records why it cannot be imported: `urgent − normal` is a subset-sum of the parameter fees, and subset-sum is ambiguous wherever fees repeat, so the decomposition finds *a* subset and not *the* subset. An apportionment is honest about being one — **right in aggregate to the poisha, and not a per-test price anyone has confirmed** — and `urgentFeeSource` is what keeps the two apart. Live: `doubled` 2,323 (the published total proves each part doubles), `apportioned` 1,606, `doubled_assumed` 732 (713 textile, whose file publishes no urgent total at all, plus 19), `same_as_normal` 106. 383 of the 385 apportionable packages now match the wing's published urgent total **exactly**; the 2 that do not publish an urgent price for a turnaround they cannot shorten, and both are already on the checksum list. `WHERE "urgentFeeSource" = 'apportioned'` is still the list to correct when the wing answers D100. |
| D103 | **`SubProductPackageFee` keeps each wing's own stated totals, per `(subProduct, sourceSection)`.** Not a grand total — D62 still forbids that. | Three reasons, and the third is the one that will bite later. **It is the checksum made durable**: the import compared the wing's stated total against the sum of the rows it parsed and printed 23 disagreements once, and a figure only a dry run ever held cannot be reconciled afterwards — they are now queryable and shown on the package screen. **It is what the apportionment divides by** (D102), so re-pricing after a fee is corrected on screen costs one query rather than re-parsing a Word document, which is not a thing a screen can do. And **it has to be per section**: `SubProduct` carries one turnaround pair, so a sub-product tested by two wings keeps whichever file was imported last — three already meet that way (Sanitary Napkin, Disposable Diaper, Nonwoven Wipes) and every wing that files after this adds more. |
| D104 | **The laboratory reference data is its own module at `/labs`**, with three screens over three kinds of fact: the catalogue (`/labs/catalogue`), the 2D map (`/labs/mapping`) and the laboratory register (`/labs/registry`). | The client asked for product data management and the 2D map together, and they are the same body of reference data seen from two sides — a parameter is what a test *is*, and a routing row is where it *goes*. Putting them in `/admin` would have buried them under user accounts; putting them in `/workflow` would have mixed reference data with files in motion. **Three owners, because they are three different kinds of fact**: the fee schedule is the wing's published price and is superadmin's, since an office able to edit it could reduce what its own applicants pay; what a lab can run is that lab's office's, since nobody else can find out; where a sample goes is that office's, which is the whole reason D64 stores it rather than deriving it. `lib/labs/access.ts` is Prisma-free so the screen greys the same control the route refuses. |
| D105 | **`lab_incharge` is a role.** *(Renamed `lab_entry` by D123.)* | The client's instruction from the outset was that "each office and wing will enter their own data", and there was no role that could. `office_head` receives files and `officeadmin` runs payroll; neither is a statement about a laboratory bench. It carries no authority over files, payroll or the fee schedule — only its own office's capability and routing. It has **no users today**, exactly like `one_stop`: granting it at `/hr/listing/roles` is the first step, and until then an office head or a superadmin does the work. |
| D106 | **A laboratory that exists in the organogram but not in practice is closed, never deleted.** `npm run labs:operational` holds the client's list. | `seed:labs` created 46 laboratories from the organogram with none invented, covering 22 of the 23 offices. The client (2026-09-08) named the offices that actually have one and there are **eleven**: head office, Chittagong, Khulna, Rajshahi, Rangpur, Faridpur, Cumilla, Sylhet, Barishal, Mymensingh and Cox's Bazar. The other 22 laboratories are organogram units with no working bench. Closing rather than deleting keeps the unit, keeps the flag one field to flip back, and avoids taking `LabCapability` and every `LabRouting` row with it. **Nothing was repointed**: all 22 held no capability and no routing cells, so closing them broke nothing — and an office still routing to a closed lab keeps its rows and is told by name in `resolveDestinations()`, because silently moving somebody's samples somewhere they never chose is worse than telling them. |
| D107 | **A test parameter belongs to no office. The catalogue is institution-wide, and `LabCapability` rows written by the seed carry `isPlaceholder` like the routing rows already did.** | Corrected by the client 2026-09-08. `seed:labs` had to point capability *somewhere* so the sampling flow would resolve before anybody had entered anything, and it pointed all 4,767 rows at the head-office section that owns each wing's file. That is provenance — where a test was **written down** — and it reads exactly like a claim that only head office can run these tests, which was never meant and is not true. The flag is what separates a stand-in from an answer, the same discipline as `LabRouting.isPlaceholder`, the seeded bank branch details and the provisional standard prices. **Nothing was deleted**: clearing the rows would have broken the CM sampling flow outright, and a flagged stand-in that still resolves is better than a gap that stops work. Every screen now shows "declared" and "seeded" as different numbers. |
| D108 | **An office declares its own coverage through a three-step form at `/labs/coverage`, and the system resolves which of its benches runs each test.** | The client's design, and the reason is data entry: 4,767 parameters × 23 offices is not a grid anybody fills in cell by cell. So the office answers at the level it thinks in — the products it handles, their variants, and *fully capable / some of them / none here* per package — and the parameters follow. **The laboratory is derived, not asked for**: a branch has one bench per discipline so the parameter's discipline picks it, and head office's eight sections are picked by the source section the parameter's file came from. Asking an operator to choose between "Organic Chemistry" and "Food & Bacteriology" 4,767 times is asking a question they cannot answer and do not need to — while `LabCapability` still has to be per lab, because that is what D64 checks and what a consignment is addressed to. The capability level is **derived from the rows, never stored**: a stored level would be a second copy of the same fact and would disagree the first time somebody edited one parameter on the map. |
| D109 | **`OfficeSubProductScope` records which packages an office handles.** It does **not** gate which applications the office receives — jurisdiction still does that, from the factory's district (D28). | Not derivable, which is why it is stored: every office already has a routing row for every parameter (the seed wrote all 109,641), so routing cannot say what an office has looked at; and "we cannot do this and send it away" is a different fact from "this is not something we deal with". It is also the form's memory — an office with forty products has two hundred packages to answer, which is several sittings, so step 3 saves per package rather than in one final submit. **The client's wording was "the products for which clients can submit a CM application at your office"**, which may mean it should gate submission too. That is a larger change and would conflict with jurisdiction, so it is recorded as a question rather than built. |
| D110 | **A destination that has not yet declared the capability is allowed and reported, not refused.** | Amends the write-time half of D64, and leaves the read-time half exactly as it was. Barisal knows perfectly well that Khulna runs a test; it cannot say so until somebody at Khulna has filled in their own form, and Khulna is in the same position about Barisal — a strict refusal deadlocks the whole institution on whoever went first. Nothing is lost: `resolveDestinations()` still refuses to *follow* such a row, by name, days before a sample moves, which is the check D64 actually asks for. The form and the map both say how many destinations are waiting on another office. The one hard refusal that remains is a **closed** laboratory, which is never a place to carry a box. |
| D111 | **One article, one sub-product — across every wing's file.** A wing that tests the article as a whole leaves a sub-product named after the *product*; its parameters are folded into the real variants and the row is marked `foldedAt`, not deleted. `npm run labs:reconcile`. | Found by the client 2026-09-08. The sub-product name is the residue left after the product name and the standard are stripped from a block heading, so a whole-product package leaves the product name again — the Chemical Wing filed *Sanitary Napkins » "Sanitary Napkin"* beside the textile file's *"Sanitary Towels/ Napkins"*, and the importer, keying on `(productId, nameEn)`, wrote **two rows for one article**. That is not cosmetic: the sub-product is the level a test plan resolves against (D67), so an applicant picks one of them and is tested for half the standard and charged for half. A live draft was doing exactly that — ৳1,000 for one microbiological count on an article needing five tests at ৳2,370. Three products were affected and all three are now single articles: Sanitary Napkins, Nonwoven Wipes, and Disposable Diapers, whose single chemical package now applies to **each of its eight sizes**, because each size is a separate sample. **Copied, not shared** (D60): eight rows carrying the same test, each free to be corrected alone, each with its own package fee, capability and routing carried over so an office's existing decision survives. |
| D112 | **Folded, not deleted — and identified by name, not by shape.** | Two failed approaches are worth recording. **Deleting** the row does not survive a re-import: the importer keys on `(productId, nameEn)`, finds nothing, and writes it straight back. **Detecting the re-import by comparing parameter names** is unsafe, because the same test names recur across genuinely different variants (D60) — *Suji » Small particle grade* carries the same eight names as *Large particle grade* and is a different article; that rule proposed folding 201 products. And **counting rows per wing** breaks the moment a fold has happened, because the variants then carry both wings and eight-against-eight reads as a disagreement when it is the same eight rows. So the row stays, flagged; the re-import writes its parameters back onto it; the reconcile folds them away again; and the signal is that **the name is the product's name**, de-pluralised with one edit allowed per ten characters — enough for *Non Oven wipes* → *Nonwoven Wipes*, tight enough that *Sanitary Towels/ Napkins* stays a variant. Proven idempotent over import → reconcile → import → reconcile. |
| D113 | **A folded row must be excluded wherever sub-products are offered or counted**, and `addSubProduct()` refuses one by id. | It holds no parameters, so a licence applied for against it would be tested against nothing. Seven queries filter on `foldedAt: null` — the applicant's picker, the catalogue list and detail, the coverage scope and its two pickers, and the map's. The service refuses it as well as the picker hiding it, for the reason `attachBds()` checks membership itself: a rule enforced only where the button is holds only for people who used the button. |
| D114 | **A product is identified by a unique BDS number, and its sub-products inherit it.** `Product.bdsId @unique`; `SubProduct.bdsId` is gone. | The client's rule, 2026-09-09, and verified achievable before it was built: **no BDS number is claimed by two products**. It is the *identity*, not the whole requirement — 24 of the 315 are certified against several parts of one specification (IEC 61215 Parts 1–2 plus IEC 61730 for a photovoltaic module, BDS 1034 Parts 1–5 for winding wires) and D48 still requires all of them, so they stay in `ProductStandard` while `bdsId` names the part the article is known by. Splitting them into separate products instead would make a manufacturer apply eight times for one solar panel. `SubProduct.standardAsPrinted` stays: 43 products have a wing citing a different edition from the published list, and that disagreement is worth keeping visible rather than resolving by fiat. |
| D115 | **Turnaround belongs to the test, not the package.** `TestParameter.normalDays`/`urgentDays`; a package's turnaround is the **longest** of the tests it contains. | D62 recorded the limitation in its own words — "these are per package and not per parameter, so a partial selection has no computable date yet" — and D101's parameter selection would have made it bite. A package takes as long as its slowest bench, which is what a turnaround *is*, so deriving it loses nothing. Each wing's file states one duration per block, so every test in a block inherited it; the figure the wing published for the package is still kept verbatim on `SubProductPackageFee`, because it is what they printed and ours is a derivation. `packageDays()` in `lib/labs/turnaround.ts` is the one place it is derived. |
| D116 | **Capability is an office's, sparse, and carries how the work is done. The 109,802-cell routing map becomes an optional preference.** `ParameterCapability(officeId, parameterId, manner, labId?)` and `RoutingPreference(officeId, parameterId, toOfficeId)`. | The client's inversion, 2026-09-09, and it is the change that makes the data entry finite. The old pair — one capability row per lab per parameter, and a destination in every office × parameter cell — both had to be filled before anything resolved, and **neither ever was**: 4,776 capability rows and 109,802 routing cells, every one a seeded stand-in. Now an office lists only what it **can** do and silence means it cannot, so nobody answers for the 4,774 tests they do not run. **Keyed on the office, not the laboratory**, because an office may cover a test it has no bench for — Faridpur holds only a chemistry lab and can still send a physical test out and enter the result, which under the old shape had nowhere to live and would have forced the organogram to grow a laboratory that does not exist. **`manner` replaces a third-party lab table**: the client's rule is that the system records *that* an office sends a test out and enters the result through its own examiner, not *which* company runs it — the accountable unit is always BSTI, which is D65's principle and simpler for it. D64 survives in the preference: referral is administrative, so Barisal may prefer Cumilla over a nearer, capable Khulna — but with the destination derivable from capability, a preference now only breaks a tie, and **no row means the field officer chooses**. |
| D117 | **A destination is an office.** `Consignment` and `LabTestOrder` are addressed to one, with the bench named when there is one and null when the work goes outside. One box per destination office. | Follows from D116 and was the largest ripple in it. The alternative was to give every office a nominal laboratory per discipline so that a box always had a bench to be addressed to — which would have meant inventing organogram units that do not exist, in a module whose 46 laboratories were seeded from the organogram with **none invented**. `/s/<ref>` loses nothing: its examiner check was always "posted to the office that owns this lab", and the lab was only a way of naming the office. |
| D118 | **The coverage form asks full or partial, and drills into parameters only for partial.** `/labs/coverage`. | The client's shape. An office that can do everything of most products answers most packages in one click; the drill-down appears only where the answer is genuinely mixed. Within it each test is *our bench*, *sent out*, or *not ours* — and a test the office has no bench for defaults to **sent out** rather than to nothing, because that is the case the manner exists for. Nothing asks where the rest goes: that was the old model's question and it is what made the form infinite. |
| D119 | **A test fee is per parameter, and whether the spreadsheet *merged* it says how to read it.** Merged across the parameter's sub-parameter rows → that is the fee, counted once. Written into each row → the parameter's fee is their sum. `Grid.isFilled()` carries the distinction. | Raised by the client 2026-09-09 — "I think all are prices per parameter" — and they are; the earlier note that one file "prices per sub-parameter" described its layout and read as a claim about the model. It is not. What differs is how each wing writes one price. Settled by evidence rather than argument: the textile file has **266 merged ranges in its fee column, exactly matching its parameter column**, and all **104 of its packages reconcile to their stated total when distinct parameter fees are summed — and none reconciles the other way**. `chemical-physical-mixed-test.xlsx` merges the parameter (`E2:E4`) and leaves the fee unmerged, writing `105` into three separate cells, and its stated ৳2,200 works only if all three count — so Size in mm costs ৳315. **Resolving merges without recording that they happened destroys the only signal that says which is meant**, which is what `isFilled()` now preserves. Found in the same pass: the textile file publishes a `Total Test Fee` column the importer had never read in five sessions, which is why all 104 of its packages carried no stated total and every one of its 713 parameters sat at `doubled_assumed`. It is read now and all 104 reconcile; there is still no urgent total, so that provenance was right. |
| D120 | **`import:test-parameters` takes a list of `.xlsx` sources, one per lab section, and matches a product by its *standard* before its name.** `--only=<key>` runs one. | Built 2026-09-10 to load the physical sheet of `chemical-physical-mixed-test.xlsx`, which nothing had been blocking since D119 settled its fee convention — the importer simply could not be pointed at a second file, because its `--file=` override refused to write by design ("for checking a file, not importing one"). Matching by standard is the part worth keeping: the wing writes *Ceramic Tiles* where the published list says *Ceramic Tiles - Definitions, Classification, Characteristics and Marking*, and no name rule reconciles those. Prefix and number, **never the year** — the rule the chemical importer had already measured at 92% against 5% by name, and which the `.xlsx` importer had never had. **Adding a wing's file is a block in `SOURCES` plus an entry in *both* `SECTION_FOR_SOURCE` (`prisma/seed-labs.ts`) and `HEAD_OFFICE_SECTION` (`lib/labs/coverage.ts`)** — miss the second and head office cannot declare those tests in-house, silently. `physical-civil` → `Civil Physical, Head Office` is the first addition. The result is the first genuinely mixed package: Ceramic Tiles, one sub-product, 9 tests over two wings, ৳4,000, each wing's stated total reconciling to the poisha. |
| D121 | **A laboratory can be recorded and removed at `/labs/registry`, and a bench recorded there carries no organogram unit.** Superadmin, like the open/close toggle beside it. Removing is refused for anything the organogram owns and for anything the bench is already named on — by name, not by count. | Asked for 2026-09-10, before coverage entry begins: the 46 labs came from the organogram with none invented (D63), which was right as a starting position and wrong as a permanent one — an office opens a bench, or closes one for good, and neither could be said. **The no-organogram-unit rule is forced rather than chosen.** `seed:labs` upserts on `lab-<unit slug>` and `Lab.orgUnitId` is `@unique`, so a hand-recorded lab holding a unit the seed also maps would make the next `npm run seed:labs` fail on the constraint — a screen quietly breaking a script nobody would think to blame. Null is the honest value anyway: the column is nullable precisely "so a lab can be recorded before the organogram catches up". It buys the registry its one clean invariant — **`orgUnitId === null` means nothing outside the screen will ever rewrite the row** — which is what makes deleting that row safe and deleting a seeded one *futile*: the seed would write it straight back, and a delete that silently undoes itself is worse than a refusal. So **D106 stands unchanged for everything the organogram owns: closed, not deleted.** Removal is for the row that should never have been written — a mistyped name, a bench that turned out not to be opening — and `labBlockers()` refuses while capability, boxes, test orders, agreed sample counts or letters point at it, naming each, the discipline `setRouting()` already uses. **One thing it exposes rather than solves:** `labFor()` picks an office's bench by discipline and takes the first match, which was unambiguous only because every branch had at most one of each — head office's eight are separated by `HEAD_OFFICE_SECTION`. A second branch bench of the same discipline is a real question only that office can answer, so `createLab()` returns it as `ambiguity` and the form says it at the moment of creation rather than leaving it to be found on a consignment. Capability is keyed on the office (D116), so the sample still reaches the right office — what is imprecise is which bench gets named. |
| D122 | **A person may hold several roles.** `User.roles` is the authority; `User.role` is the highest-precedence member, kept in step by `setRoles()` and nothing else. Authorisation asks `hasRole()`. **Amends D57.** | Reported by the client 2026-09-10: rare, but one person can be the office admin, the office head and the lab entry officer at once. D57 accepted one column on the reading that payroll authority and file-routing authority are different jobs and so different people — and the cost of that reading is already in the tree: granting `office_head` silently removed `officeadmin`, so `import:office-heads` had to move payroll to another desk at **14 of 23 offices** to work around it. **`hasRole()` falls back to the primary when the set was not selected**, which makes the migration safe by construction — `role` is always a member of `roles`, so a query that forgot the array is never *more* permissive than before, only less. That is why 83 comparison sites did not need a sweep: precedence puts `superadmin` first, so every guard that only asks about superadmin is unaffected, and only checks for a **non-top** role could newly be wrong. Those were converted by hand — `office_head` ×3 in `inbox.ts`, `one_stop` on the counter, `case_officer` in the register, and the labs. **The session cookie carries the primary only**, so a secondary-role check must go through `getViewer()`, which reads the row — which is what it was built to do. |
| D123 | **`lab_incharge` becomes `lab_entry`, and lab routing is entered per office: whoever holds it works on their own office and nowhere else; only a superadmin works across offices.** | The client's rename and rule, 2026-09-10. The scoping was already what `lib/labs/access.ts` enforced — every check compares `actor.officeId` against the office being edited — so this makes the name say what the code does. Renaming the enum value needed **two pushes**: Prisma tries to alter the enum and add the `roles` column in one step and fails with `column "roles" does not exist`. Nobody held the old role, so nothing had to be migrated. |
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
- [x] ~~Refuse to sell a standard whose price is a stand-in (D45)~~ — superseded
      by the labelled demo price (D49)
- [x] **The application flow moved onto `Product`** (2026-09-01)
- [x] Search products by generic name, Bangla name and standard number
- [ ] Object storage for the standard PDFs and the paid download (D47)

**The picker showed nothing, and that was a separate bug.** `GET
/api/store/bds/search` read its division filter as
`Number(searchParams.get("division"))`. An absent parameter is `null`,
`Number(null)` is `0`, and `Number.isInteger(0)` is `true` — so every search ran
with `divisionId: 0`, which no row has. The picker had therefore returned an
empty list for every query since it was written. The route is gone, replaced by
`/api/store/products/search`, which tests for an absent parameter as an absent
parameter.

**What changed to move onto `Product`:**

| Piece | Now |
|---|---|
| `Application` | `productId` → `Product`; `bdsId` and `bdsPurchaseId` dropped |
| `BdsPurchase.consumedByApplicationId` | no longer UNIQUE, and a real relation — `application.attachedPurchases` is the set (D48) |
| `Payment.attachToApplicationId` | remembers an in-flow purchase's application (D50) |
| `productEligibilityPolicy()` | reads `Product.isMandatory` — real data, not the seed's guess |
| `attachBds()` | the standard must be one the *product* is certified against, one purchase per standard, and membership is checked here rather than only at the route |
| `setProduct()` | releases **every** purchase attached for the old product |
| `requirementsFor()` | replaces `attachableBds()` — one row per required standard, each with its own attach / buy state and price |
| `missingForSubmission()` | names each unattached standard rather than the set |
| `/api/store/products/search` | searches name, Bangla name, generic names and standard number over all 315; filters in memory because `genericNames` is a text array |
| Store surfaces | card, landing, detail page and buy button all read `salePricePolicy()`, so the page and the gateway cannot quote different figures |

**Two bugs found by walking the flow, 2026-09-01.** Both were in the in-flow
purchase (D50), and neither was in the code D50 added:

1. **The receipt offered no way back to the draft.** `beginCheckout()` builds a
   return URL carrying `?next=/public/applications/<id>` and hands it to the
   provider — and the sandbox threw it away. `SandboxGatewayTxn` had nowhere to
   put it, so the hosted page invented a bare `/pay/return/<reference>`. Fixed by
   giving the sandbox `returnUrl` + `cancelUrl` columns, which is what a real
   gateway holds. The cancel URL is now passed separately too: the page was
   appending `?cancelled=1` to a URL that already had a query string.
2. **The purchase was scoped to the wrong company.** `/api/store/checkout`
   scoped every purchase to the buyer's `isDefault` membership. Buying from
   inside an application therefore bought the standard for the default profile
   and then `purchaseOwnershipPolicy()` refused it to the company that was
   applying — "This standard was bought by another company in your group."
   Worse where the default profile is a **group parent**, which D29 says never
   applies: the purchase was usable by nobody. An in-flow purchase now scopes to
   the application's own `organizationId`. One live purchase stranded by this was
   re-scoped and attached.

**Verified against the live database**, 32 checks over two suites: a purchase of
another product's standard is refused; a second application cannot reuse one;
two concurrent attaches yield exactly one winner; changing the product releases
what was attached; a three-standard product leaves the other two named as gaps
until each is attached; detaching releases rather than consumes; a
placeholder-priced standard quotes and charges ৳500 and is labelled provisional
while a real price is untouched; an in-flow purchase attaches itself, twice-run
fulfilment is idempotent, and a purchase pointed at an application the buyer has
no standing on is granted but not attached.

### ✅ Step 7c — The articles a licence covers
Built 2026-09-01. An application now lists its SKUs (D51).

**Schema:** `SizeType` (12) + `SizeUnit` (43), seeded by `npm run seed:size-types`;
`ApplicationSku` hanging off the application. `Application.brandName` and
`productDetails` are gone.

| Path | What it is |
|---|---|
| `POST/PATCH/DELETE /api/client/applications/[id]/skus` | Add, edit, remove one article |

**The size type is picked before the unit**, so the unit list is only ever the
ones that make sense — and `resolveSize()` re-checks the pair server-side,
because a request that posted "Weight / litre" would otherwise store a size
nothing can read. `SizeKind` separates a measured size (200 ml) from a chosen one
(shirt size M); the form stops asking for a number on the second, and the service
refuses one.

**Verified against the live database**, 20 checks including the client's own
example: eight variants across two brands, three flavours, two packaging types
and both ml and litre; a multipack keeping its `× 24`; 1.5 L surviving as a
decimal; weight-paired-with-litre refused; brand and size enforced; a chart size
stored with no number and refused one; a size type changed on an existing row;
the fee blocked while no variant is listed; and a stranger refused.

**Still open:** whether the fee scales with SKU count (the real schedule does not
exist — a flat ৳1,000 stands in), and which size types each of the 315 products
may use (Phase G — all are offered until then).

### ✅ Step 7d — The four-step form
Built 2026-09-01. The application page was one long stack of sections with the
workflow stage tracker beside it; it is now a four-step form with a progress
tracker that counts what is still missing (D52).

| Step | What it asks |
|---|---|
| 1 | **Company and factory** — read back, not editable here. The details belong to the company profile and are shared by every application, so an edit inside one file would silently change the others; the step's job is to let the applicant *notice*, with one link to the place that owns them. |
| 2 | **Product and articles** — the product, its standards, the SKUs and the documents. Unchanged apart from the label image moving onto each variant (D53). |
| 3 | **Production capacity** — approved annual capacity for *this product*, who approved it (BIDA / BEZA / BEPZA / BSCIC), and what was actually produced this year. |
| 4 | **How the factory runs** — BSTI's questions in five groups, then the declaration, then submit. |

**Schema:** `ApplicationProduction` (1:1, capacity in a reused `SizeUnit` so a
product sold by weight cannot be given a capacity in litres),
`ApplicationAnswer` (keyed by question, never columned, because `CM_QUESTIONS`
is an `[ASSUMPTION]` that must change without a migration),
`Application.consentAcceptedAt/By`, and label metadata on `ApplicationSku`.

**Verified against the live database**, 19 checks: an unknown authority refused;
production above approved capacity refused; step 3 completing on save; unknown
question keys ignored; number answers stored as numbers; only the declaration
outstanding once the questions are answered; the declaration withdrawable while
a draft; prefill offered from the same factory's other application, carrying the
manpower/quality/records answers and **not** the product-specific ones; an
application never prefilling from itself; label metadata stored, left alone by an
unrelated edit, cleared by an explicit null, and refused for a wrong file type or
over 8 MB. Every test row was removed afterwards.

**Still open:** the question set itself is drafted from the client's list and
needs CM Wing confirmation, at the same standing as `CM_DOCUMENTS`; and the
label images are still not stored (D47).

### ✅ Step 7e — The client shell, and every way into an application
Built 2026-09-06, from two things the client reported: **no navbar on the
dashboard or the application pages**, and **no way to register a factory or a
company from the page that asks you to choose one**.

**The shell.** `app/(public)/public/layout.tsx` now owns navbar, page and
footer for every client surface. It was in none of them — each page rendered
its own `min-h-screen` column and its own footer and no navbar at all, so a
client reading their own application had no way back to the store, no account
menu and no sign-out. `ClientNavbar` is the citizen counterpart of the store's
`Navbar`: a thin wrapper over `ModuleNavbar` listing services, never the module
grid (D14). `/pay/return` renders it directly rather than through the layout,
because it cannot share one with `/pay/sandbox` — the sandbox page impersonates
a *gateway's* hosted page, and a BSTI navbar on it would misrepresent whose
page the payer is looking at. The landing page keeps its own government
masthead.

**All three ways in are now on `/public/applications/new`:** pick an existing
factory, register a new factory for an existing company inline, or set up a
company that does not exist yet. `FactoryForm` is shared with the company page
rather than copied — the district field decides which office receives every
application from that plant, and two copies would drift.

**The company wizard is deliberately not duplicated inline.** It asks for
everything `missingForSubmission()` later demands, and a stripped-down second
form would create companies that cannot submit, with the wall arriving *after*
the product, the SKUs and the fee. So `/public/companies/new` takes a `?next=`
and the wizard lands there rather than on the company page. `safeNext()` moved
to `lib/nav.ts` — Prisma-free (D9), so a client component may import it without
dragging `pg` into the browser bundle.

**A factory added here is listed with its BSTI office resolved** before the
Apply button beside it is worth pressing: the form refreshes the server render
rather than splicing the row in, because the office is derived from the district
on the server, and a row without it hides the one fact this page exists to show.

**Verified against the live database** with a throwaway client account: the
navbar renders on the dashboard and the company pages with exactly one header,
one main and one footer; the picker shows a factoryless company with *Register a
factory*, and after registering shows the row with *বিভাগীয় কার্যালয়,
বিএসটিআই, বরিশাল* named beside it; `?next=/public/applications/new` reaches the
wizard while `https://evil.example/x` and `//evil.example` both arrive as null.
Everything the run created was removed by id.

### 🚧 Step 8a — Office head, and files that move
Built 2026-09-02. The first slice of Phase D: a submitted file is received by
its office and moves through the organogram. `/workflow` replaces a placeholder
that advertised Projects, My Tasks, Team and Reports, none of which existed.

**Schema:** `Role.office_head` (D57), `Application.holderEmployeeId`,
`ApplicationMovement` with `MovementDirection { down | up | receive }` (D58/D59).

`lib/workflow/chain.ts` is the Prisma-free half — who may hand a file to whom;
`inbox.ts` is the server half. Both are written without reference to CM, so the
next service that needs a file to move can use them.

**Two data facts that had to be found the hard way.** `Posting.orgPostId` is
null on all 554 rows — the organogram link lives on `Employee.orgPostId`, set
for 303 of them — so reading the posting's org post gave every desk a null
section and no chain at all. And the employee's grade differs from their post's
grade in real data, so seniority follows the *employee*. With that fixed, 42
desks at Head Office carry both a grade and a section.

**Verified against the live database**, 29 checks: the Director → DD → AD → FO
chain both ways; peers refused; cross-section refused; passing to yourself
refused; an ungraded desk able to receive but never senior; a plain employee
having no inbox and being unable to receive; a second receive refused; a
non-holder unable to pass; passing a senior desk "down" refused; the movement
log reading `receive, down, up` with its note and sender; and an acting head on
grade 9 reaching 6 desks where grade alone gives none. The test application was
deleted and its movements cascaded away.

**Still open:** 252 of 731 employees have no `orgPostId`, so they have no
section and cannot be passed a file — the organogram placement is incomplete,
not the code.

**Resolved 2026-09-05.** All 23 offices hold `office_head`
(`npm run import:office-heads`), and every one of those heads now holds a desk.
Five did not, so `candidates()` returned an empty list and a file they received
could never be passed on. Two causes, both data:

- **`import:desks` cannot seat a head**, because it matches on the head's own
  wing and a head's desk is the one post in the office's **Executive** unit,
  whatever wing he came from. `npm run import:office-head-desks` is that step,
  and it takes a missing grade or English designation from the post rather than
  inventing one.
- **The organogram graded Directors 5, and all nine serving Directors are on
  grade 4** — so no Director could be seated anywhere, and the two whose offices
  made them head (Rajshahi, Khulna) were unreachable. `seed:grades` now puts the
  nine Director posts on grade 4; a second `import:desks` run then seated four
  head-office Directors as well.

### ✅ Step 8b — The laboratory module: catalogue and the 2D map

Built 2026-09-08 (D102–D106). `/labs`, internal only, four screens over the
Phase G reference data:

| Screen | What it is | Who may write |
|---|---|---|
| `/labs` | coverage — how much of the map is a decision rather than a stand-in | — |
| `/labs/catalogue` | the 315 products, their packages, every parameter's fee, limit, method and turnaround | superadmin |
| `/labs/mapping` | **the 2D map** — parameters down, all 23 offices across, one office's column editable | that office, or superadmin |
| `/labs/registry` | the 46 laboratories, open/closed, and what each has declared it can run | the lab's own office |

**The map is the client's own framing.** An application filed at Khulna may have
some parameters tested at Khulna, some sent to Faridpur and the rest to head
office — and which is which is administrative, not derivable (D64). So the grid
shows every office at once (that is the question "who else sends this to
Faridpur"), and writing is one column at a time (that is the unit of the
decision).

**A destination must hold the capability**, refused in `setRouting()` by name
rather than by count, because the fix is to go and tick it on the lab's page.
Verified end to end: routing before capability is refused; Khulna taking three
tests itself and sending two to Faridpur resolves through
`resolveDestinations()`; and closing the Faridpur lab breaks those two cells
**by name** rather than repointing them.

**Fixed 2026-09-09:** a product with exactly one sub-product could not be
opened on the map or the lab page — a single-option `<select>` fires no change
event, and 129 of the 203 products with parameters have exactly one, so most of
the catalogue was unreachable. Both pages resolve a lone package server-side and
redirect; both selects now render a placeholder while nothing is chosen, because
a `value` with no matching option leaves the browser showing option one.

**Entry has started.** Barishal made the first real coverage entries on
2026-09-08 — U-PVC Pipe, two tests on its own chemistry bench and three sent to
Rangpur. Everything else of the 109,802 routing cells is still `isPlaceholder`.
The order for the rest is: grant `lab_entry` at `/hr/listing/roles` (D105, D123) →
each office works through `/labs/coverage`. Nothing is blocked meanwhile,
because the seeded stand-ins still resolve. **`/labs` carries the live count**;
a figure written into a document goes stale the moment an office types.

### 🚧 Step 8c — Office coverage entry

Built 2026-09-08 (D107–D110), after the client corrected the premise: **test
parameters are universal, and the seeded capability rows were provenance, not
capability.** Every seeded row carries `isPlaceholder`.

`/labs/coverage`, three steps, one office at a time:

1. **Products** — searchable by name, serial **or BDS number**, because the
   standard is what is written on the file in front of the operator. Selecting a
   product takes on every variant beneath it.
2. **Variants** — all on by default; take off what this office does not see.
3. **Capability** — per package: *we can run all of these* / *some of them* /
   *none — send them away*. Where it is not all, each remaining test gets a
   destination office, with a "send everything to…" control for the ordinary
   case and per-test override for the rare split.

**The destination picker only offers offices that can receive that kind of
test.** Four offices have a chemistry bench and no physical one, and twelve have
neither; offering them would be offering a destination the save then refuses.
The bulk control assigns what the chosen office can take and names what it
cannot.

Verified end to end against the live database and rolled back: all three levels
resolve correctly, a physical and a chemical half can go to two different
offices, an office with no physical bench is refused a physical test, and a
destination that has not declared is written and then refused **by name** at
`resolveDestinations()` rather than silently sending a sample.

**Still to do:** grant `lab_entry` (D105, D123) — it has no users, so today only an
office head or a superadmin can fill the form in.

### ✅ Step 8d — One article, one sub-product

Built 2026-09-08/09 (D111–D113) after the client found that *Sanitary Napkins*
existed twice — once from the textile file, once from the chemical file — and
stated the rule: a wing that files a single sub-product for a product is testing
the **whole product**, so where another wing names variants its tests apply to
each of them.

`npm run labs:reconcile [-- --dry]`, run after any wing's import; both
importers now end by naming it. It **refuses rather than guesses** when two
wings name genuinely different variant sets, and when a sub-product already
carries laboratory test orders.

| Product | Was | Is |
|---|---|---|
| Sanitary Napkins | 2 rows: 4 physical tests, 1 chemical | 1 row, 5 tests, ৳2,370 |
| Nonwoven Wipes | 2 rows: 3 physical, 1 chemical | 1 row, 4 tests, ৳2,170 |
| Disposable Diapers | 9 rows: 8 sizes + 1 whole-product chemical | 8 sizes, 5 tests each, ৳2,341 |

**A live draft was mispriced by it** — application 24 named the chemical-only
row and would have been tested for one microbiological count at ৳1,000 on an
article needing five tests. It now names the real article at ৳2,370.

### 🚧 Step 8e — Capability, not a map

Rebuilt 2026-09-09 (D114–D118) on the client's model. The hierarchy was already
right — Product → SubProduct → TestParameter → TestSubParameter, one-to-many
down and one parent up — so the change is what hangs off it.

**Gone:** `LabCapability` (4,776 rows), `LabRouting` (109,802),
`LabSampleRequirement`, `SubProduct.bdsId`, `SubProduct.turnaround*`.
**Arrived:** `ParameterCapability`, `RoutingPreference`,
`OfficeSampleRequirement`, `Product.bdsId @unique`,
`TestParameter.normalDays`/`urgentDays`.

Migrated with nothing lost that anyone had entered: 491 packages' turnaround
copied onto 4,774 parameters, 315 products stamped with an identifying
standard, Barishal's 2 declared capabilities and 5 routing decisions carried
over as capability and preference, and the 114,578 seeded stand-ins dropped —
D107 had already said they were never a claim about anybody.

Proven against the client's own scenario (Ceramic Tiles, filed at Faridpur):
one test on Faridpur's own bench, one it covers by sending out, two testable at
five offices and left for the officer to choose — then a preference for Khulna
resolving them, three boxes, no problems.

**Not built, and the next thing:** the field officer's choice among capable
offices has no screen. `resolveDestinations()` names the tie and refuses to
guess, which is right, but until the sampling screen offers the choice a package
with several capable offices and no preference cannot be sealed.

### ⬜ Step 9 — The testing modules (Physical and Chemical)
**Their workflow is not CM's, and must not be built as a variant of it.**
Stated by the client 2026-09-07. CM moves one file through a chain of desks by
seniority; a laboratory receives boxes, opens them against a seal, distributes
specimens to benches, records results per parameter and issues a report — a
different unit of work (the `LabTestOrder`, which by D70 carries no application
column at all), a different actor (the examiner), and a different reason to
move. The tables already exist — `LabTestOrder`, `Sample`, `TestResult`,
`Consignment`, `LabCapability`, `LabRouting` — and the blind-side rules (D68,
D70, D71) are the constraint every screen has to respect.

**Open before it can be planned:** who holds a test order and how it is
assigned; whether a result is entered per sub-parameter or per parameter and who
may correct one; what the lab's report is and who signs it; how a third-party
referral (D65) is recorded; and how the test fee is raised and settled, which is
the second payment §5 describes.

### ⬜ Step 8+ — Workflow engine (the rest)
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
3. **218 records were not imported**, and re-running the import will not fix
   most of them — the blockers are ours, not the HR system's. Investigated
   2026-09-02; the field-level detail is in `CLAUDE.md` under "Who is in the
   roster, and who is not".

   - **115 "identity incomplete"** — held out by five biographical fields
     (date of birth, gender, marital status, father's and mother's name) that
     appear **nowhere** in `lib/salary/` or `lib/workflow/`. Nearly all of the
     115 lack all five. Making those columns nullable admits them, and they
     would be payroll-capable on arrival.
   - **72 "no bio"** — the HR detail API returned 500, so `bio` is null and the
     record is rejected before the identity check is even reached. These still
     carry name, designation, wing and office, and the office resolves for 72
     of 73. **This is the valuable group**: 16 Assistant Directors, 15
     Examiners, 11 Field Officers, 8 Deputy Directors, and **18 of them are CM
     Wing** — the section whose workflow chain is currently one desk deep.
     `name_bn` is absent in all of them, so `nameBn` has to be relaxed or
     derived as well.
   - **19 bad id / 12 no office** — genuinely unusable: mobile numbers and
     email addresses in the id field, or no office named.

   Neither fix gives anyone an `orgPostId`, so they would still have no
   workflow desk.
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
| **Does the application fee scale with the number of SKUs?** More variants mean more samples drawn and more tests run, so a flat fee for a one-SKU and a forty-SKU application is unlikely to be right. `applicationFeePoisha()` takes no arguments today; making it take the SKU list is a small change, but guessing the multiplier is not. | Charging applicants correctly | 2026-09-01 |
| **Which size types may each of the 315 products use?** All 12 are offered to every product, so nothing stops a biscuit being listed by voltage. The type-per-product mapping is Phase G reference data; the rule does not change when it lands. | Clean SKU data | 2026-09-01 |
| **The CM application fee schedule.** A flat ৳1,000 stands in (`applicationFeePoisha()`); the real schedule varies by product category, and the category table is Phase G reference data. | Charging applicants correctly | 2026-08-31 |
| **Prices for the 375 standards created from the mandatory list.** The published list carries designations, not prices. **No longer blocking the flow** — a labelled demo price of ৳500 stands in while the gateway is the sandbox (D49), so applications can be completed end to end. It is still blocking *going live*: the moment a real gateway is configured, an unlabelled real charge would be made against an invented amount. Load them onto `Bds.priceBdt` and clear `priceIsPlaceholder`; `salePricePolicy()` then stops applying by itself. | Charging real money for standards | 2026-09-01 |
| **Are a product's several standards genuinely all required?** D48 says yes and the client confirmed it, but the 24 affected rows were read off the published list's punctuation — some look like parts of one specification (`BDS ISO 4427-1/-2/-3`), others like alternatives for different variants ("a) Soluble coffee powder b) Roasted and ground coffee"). If any are alternatives, requiring all three makes an applicant buy two standards they will never be certified against. Worth checking those 24 with the CM Wing. | Applicants buying standards they do not need | 2026-09-01 |
| **Titles for those 375 standards.** The list names the *product*, not the standard, so each created catalogue row is titled after the product it certifies. Correct enough to search by, wrong as a catalogue title. | The store reading truthfully | 2026-09-01 |
| **Curated generic names.** 29 of 315 products carry a name derived from the source (D46); the rest have none, and Bengali generic names have none at all. | Manufacturers finding their product | 2026-09-01 |
| ~~**The real mandatory-315 product list.**~~ **Answered 2026-09-01:** the gate is `Product.isMandatory` over the 315 real rows, not the seed's judgement on `Bds.isMandatory315`. The flag survives on `Bds` but no longer decides anything. | — | 2026-08-31 |
| **BSTI's real questionnaire for step 4.** `CM_QUESTIONS` is five groups drafted from the client's own list — identification, isolation, process, manpower, quality control, records. Same `[ASSUMPTION]` standing as the document checklist. | Asking applicants the right questions | 2026-09-01 |
| **`Employee.wing` is free text with synonyms.** 31 distinct values across the roster against the organogram's 8 wings — some are wings, some are departments inside one, and several are one wing written twice ("মেট্রোলজি" 112 and "মেট্রোলজি উইং" 13; "সিএম বিভাগ" 81 and "সিএম উইং" 5). The roster's wing filter offers the values as recorded, with counts, so the duplicates are visible rather than hidden. | A wing filter that returns everyone in that wing | 2026-09-02 |
| **Organogram placement for 252 employees.** *(Was 251 of 554; the roster is now 731 and 479 hold a desk. No office head is among the gap any more — see step 8a.)* `Employee.orgPostId` is null for them, so they have no section and cannot be handed a file. `Posting.orgPostId` is null on every row, which is why the workflow reads the employee's post instead. | Files reaching every desk | 2026-09-02 |
| **The CM document checklist.** `CM_DOCUMENTS` is nine items assembled from the spec and general practice, at the same `[ASSUMPTION]` standing as the §2.3 company field set. | Applicants bringing the right papers | 2026-08-31 |
| **Shortfall policy (§10 #7)** — ~~maximum rounds~~ **answered 2026-09-05: any number**, the client's own rule (D81). Response deadline and consequence of lapse are still open, and nothing enforces a clock today. | Step 8+ | 2026-08-31 |
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

### The Chemical Testing Wing's two files — surveyed, then imported

Arrived 2026-09-07 as `utils/Chemical-food-param.docx` and
`utils/chemical-non-food-param.docx`; **imported 2026-09-08**. Six times the
textile file, and the first real test of whether the Phase G shape holds across
wings. It held: **no schema change was needed.**

**What landed**

| | before | after |
|---|---|---|
| test parameters | 713 | **4,767** (4,774 after D111) |
| sub-products | 104 | **491** |
| test methods | 53 | **1,212** |
| products with a test plan | 17 | **203** of 315 |
| capability rows | 713 | **4,767** (4,776 after D111) |
| routing rows | 16,399 | **109,641** (109,802 after D111) |

**What was left out, and is printed by the dry run**

- **25 blocks name a product the published list does not** — Pickle, Vegetable
  Ghee, Carbolic Soap, Protein Biscuit, Liquid Glucose, Dextrose Monohydrate,
  Condensed Milk, three bitumen grades, Duplicating Ink, Ribbons Typewriter and
  the rest. Some are certainly on the list under another name; the others are
  testing BSTI does that CM does not license (open question 3).
- **5 duplicated source rows**, each confirmed by the wing's own stated total.
- **23 checksum failures** — imported, listed, and for the wing to confirm.
- **27 of 387 sub-product names carry a leading serial fragment or an odd
  bracket.** Untidy, not wrong: the fees, limits and methods on them are exact,
  and `--names` prints all 387 for review.

**What they contain.** One Word table each, eleven columns, no spreadsheet:

| | Food | Non-food | Textile (for scale) |
|---|---|---|---|
| product blocks | 222 | 190 | 50 → 17 after sanitising |
| parameter rows | 2,724 | 1,615 | 713 |

Columns: `Sl No. · Product Name and Standards · Test Parameters · Standard
Limit · Methods · Testing fee as per test parameter · Duration (Normal) · Total
Fee (Normal) · Duration (Urgent) · Total Fee (Urgent) · Without fee`.

**The schema needed no change, and running it confirmed that.** Every column had
a home already — `SubProduct.turnaroundNormalDays` / `turnaroundUrgentDays` for
the two durations, `TestParameter.feePoisha` / `urgentFeePoisha` for the fees,
`standardAsPrinted` for the edition disagreements. `TestSubParameter` turned out
not to be needed at all: under D99 a caption becomes part of its children's
names rather than a level of its own. What had to be built was a **reader**.

**Seven findings that decide how the importer is written.**

1. **The hierarchy is carried by blank cells, not only by merges.** 892 food and
   735 non-food rows leave the product cell empty with *no* `vMerge` at all,
   alongside 1,606 and 688 that are properly merged. Reading merges alone
   splits one product into dozens; the rule is **a new product block begins
   where the product cell is non-empty**. `xlsx-grid.ts` solves the equivalent
   for spreadsheets and its logic transfers, but the reader itself is new —
   these are `.docx`, and nothing in `prisma/import/` reads Word.

2. **The BDS number is the join key and the published list owns the name.**
   Client-confirmed 2026-09-07: take the number from the wing's file, take the
   *name* from `mandatory-315.json`, and never trust the name the wing typed.
   The number's identity is `(prefix, number)` and **never the year** — the list
   says `BDS 25:2015 Amendmentment-1:2020` where the wing says `BDS 25:2015`,
   and they are one standard. Matching that way, then by containment (below),
   resolves **391 of 412 blocks (94%)** onto **192 listed products**.

3. **The sub-product is what is left when the listed name is taken away.**
   Client-confirmed: `Sweetmeats` is the product and *Rasogolla, Chomchom,
   Kalojam, Rasomalai* are the sub-products BSTI actually tests. So the cell is
   not parsed into fields — the **longest listed product name contained in it**
   is matched (which is also what turns `Milk Chocolate` and `White Chocolate`
   into two sub-products of `Chocolate`, and `Follow Up Formula for older
   infants` into one of `Follow-up formula`), and the residue after removing the
   name, the serial and the standard **is** the sub-product. Run over both
   files this yields the client's own example exactly — Sweetmeats →
   *Rasogolla, Chomchom, Kalojam, Rasomalai, Pera, Monda Sandesh* — and larger
   families beneath it: Crankcase Oils 31 SAE grades, Fish Feed 30, Poultry
   Feed 16, Ceramic Tableware 7. A product with no residue gets one sub-product
   named for itself, which is the ordinary case.
   **The residue still needs tidying** — unbalanced brackets and stray edition
   fragments survive in perhaps a fifth of them — so the `--dry` report prints
   every sub-product name for a person to read before anything is written.

4. **A row with no fee, no limit and no method is a category title, and it
   becomes part of its children's names.** Client-confirmed. 30 such rows —
   *Microbiological Requirements*, *Requirements For Syrup*, *Dye*,
   *Developer* — with **184 parameters beneath them**. The caption is appended
   in brackets: `Total Plate Count, per gm, Max (Microbiological
   Requirements)`. It is not a row of its own, because it has no fee to charge
   and no limit to test against; it is the qualifier that says which of two
   identically named tests this is.

5. **Qualifying by the caption is also what saves the `(subProductId, nameEn)`
   key.** Without it, ten blocks repeat a parameter name and the upsert would
   silently overwrite: Oxidation Hair Dyes carries `pH` at both `9.0 – 11.0`
   and `1.8 to 4.0`, one for the dye and one for the developer, and the product
   would be left with one pH, the wrong limit and half its fee. Qualified, they
   are `pH (Dye)` and `pH (Developer)` — distinct rows, both limits kept, both
   fees counted. **Measured over both files: 42 collisions before, 5 after.**
   Those 5 are exact repeats with identical limits — duplicated source rows,
   and precisely the ones the checksum in finding 6 already catches. They are
   de-duplicated, and the checksum is what proves it safe: Poultry Feed
   (Layer-4) states 20,000 against a sum of 20,700, and 700 is the repeated
   Phosphorous row to the taka.

6. **The stated total is a usable checksum, and it is not always right.**
   `Total Fee (Normal)` agrees with the sum of its parameter fees for 383 of
   412 blocks. Of the 29 that disagree, 4 are explained exactly by a duplicated
   source row — Poultry Feed (Layer-4) states 20,000 and sums to 20,700, and
   700 is precisely the repeated Phosphorous row. **Assert it at import and
   report every failure**; D62 still says do not *store* it, because a stored
   total is one lab's subtotal masquerading as the price.

7. **"Urgent is 2× normal" is a textile rule, not a BSTI rule** — and the fix
   is to move the urgent price up a level, not to guess at parameters. See D99
   below; this was the one finding that changed an existing decision.

**Two smaller things worth knowing.**

- **Seven non-food products are priced as a lump with no parameter list at all**
  — *Duplicating Ink*, *Stencil Paper*, *Ribbons Typewriter*, *Bitumen Road
  emulsion* and three more, each a single empty row carrying only a total.
  There is nothing to route, nothing to seal per parameter and no fee to sum.
  They are a data gap, not a product category, and should be reported rather
  than imported as a parameterless sub-product.
- **The `Without fee` column is `0.00` or blank throughout.** Nobody has said
  what it means. Leave it unread until they do.

**Two catalogue gaps this exposes, both outside the importer.**

- **18 cited BDS numbers are not in our catalogue.** Ten look like edition
  drift on a product we already hold — BDS 1805:2008 (UHT Milk), BDS 520:2023
  (Pickle), BDS 411:2006 (Carbon Paper), BDS 1269:2021 (Shampoo), BDS 181:2001
  (Carbolic Soap), BDS 1006:2006 (Shoe Polish), BDS 1781:2008 (Vegetable Ghee),
  BDS 1740:2024 (Liquid Body Wash), BDS 1001:2025 (Wafer Biscuit), BDS
  1515:1995 (Gold) — the same disagreement `standardAsPrinted` was added for
  (textile's BDS 1221:2011 against the list's 1221:2021). Eight are
  international adoptions absent from the catalogue entirely: BDS CXS 87:2024
  and CXS 156:2025 (Codex), BDS CAC 8/9/074, BDS ISO 13006:2015, BDS EN
  12591:2009 and EN 14023:2009.
- **The chemical wing tests products CM does not license.** Shampoo, Carbolic
  Soap, Shoe Polish, Gold, Ceramic Tiles, Duplicating Ink and about a dozen
  more are not on the mandatory 315, and `productEligibilityPolicy()` refuses an
  application for any of them — correctly, because a licence outside the list
  does not exist. But a laboratory takes voluntary and third-party work, so the
  parameter catalogue is legitimately **wider than the licensing catalogue**.
  Importing them needs `Product` rows that are *not* `isMandatory`, and it must
  stay impossible to file a CM application against one. This is a real decision
  and is listed in the open questions below.

**The `b2ff25c` question is answered: no, and by a margin.** That commit warned
that `TestParameter` is upserted on `(subProductId, nameEn)` with
`sourceSection` outside the key, so a second wing naming a test the first wing
already recorded would overwrite it rather than sit beside it. Across both
chemical files **only three sub-products meet textile at all** — Sanitary
Napkin, Disposable Diaper, Nonwoven Wipes — each contributing exactly one
parameter, a microbiological count, and **none of the three names collides**
with a textile parameter on the same row. So the key can stay as it is for
these two files. It should be re-checked when a third wing's file arrives; the
query is in the session log.

**Done, in this order** — steps 1, 2, 4 and 5 on 2026-09-08. Step 3 did not
block the import: its remaining answers change data, not structure.

1. ✅ `prisma/import/docx-grid.ts` — the `.docx` counterpart of `xlsx-grid.ts`.
   Walks the ZIP central directory with `node:zlib` rather than taking a
   dependency, resolves `gridSpan` and `vMerge`, and fills blank cells downward.
   Prisma-free and side-effect free (D9).
2. ✅ `import:chemical-parameters --dry --names` — the whole parse printed and
   read before anything was written.
3. ⬜ The open questions below.
4. ✅ Imported, with `chemical-food` and `chemical-non-food` added to
   `SECTION_FOR_SOURCE` in `prisma/seed-labs.ts`.
5. ✅ `seed:labs` re-run — 4,767 capability rows, 109,641 routing rows.

**Open questions — for the Chemical Wing. None blocked the import.**

1. ~~**Urgent pricing — the wing's own totals disagree with the rule.**~~
   **Answered 2026-09-08 (D102): apportion.** A package whose published urgent
   total is not twice its normal total is scaled by one flat multiplier so the
   total matches — Poultry Feed's ৳25,000 ÷ ৳20,000 = 1.25 — and
   `urgentFeeSource` says which figures were arrived at that way. 383 of the 385
   apportionable packages now match the wing's published urgent total exactly.
   **What is still open is D100**, and it is a smaller question than it was:
   whether the surcharge really falls on some tests and not others, and if so
   which. An apportioned figure is right for the package and unverified per
   test; `WHERE "urgentFeeSource" = 'apportioned'` is the 1,606 rows to correct
   when the wing answers.
2. **The 23 checksum failures**, listed by the dry run — is the stated total
   right and a row duplicated, or is the total stale? Four are already proven
   to be duplicated rows; the rest need an answer.
3. **The 25 blocks whose product the published list does not name.** *Pickle*, *Vegetable
   Ghee*, *Carbolic Soap*, *Protein Biscuit*, *Liquid Glucose*, *Dextrose
   Monohydrate*, *Condensed Milk*, *Cereal Based Food*, the three bitumen
   grades, *Duplicating Ink*, *Stencil Paper*, *Fountain Pen Ink*, *Ribbons
   Typewriter*, *M S Tube*, *Aluminium Sulphate (Fertilizer)*. Some are
   certainly on the list under another name and need one lookup each; the rest
   are testing BSTI does that CM does not license. Should the catalogue hold
   those as non-mandatory `Product` rows for voluntary and third-party work, or
   should the import skip them?

**Answered 2026-09-07, and folded into the findings above:** the published list
owns the product name; the sub-product is the residue after the name is removed;
a fee-less, limit-less, method-less row is a category title that qualifies its
children's names.
