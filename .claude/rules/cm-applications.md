---
description: "CM licence applications — the 315 mandatory products, standards, SKUs, the four-step form and the fee"
paths:
  - "lib/cm/**"
  - "lib/store/**"
  - "app/(public)/public/applications/**"
  - "app/(ecommerce)/**"
  - "app/api/store/**"
---

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

- **The applicant's sampling letter is a printed document and follows the
  document table convention** — full grid, merged grouping cells, one row per
  item — recorded under "generated letter's data table" in
  `.claude/rules/workflow.md`. `LetterDocument.tsx` still rules rows only and is
  the next one to bring across.
