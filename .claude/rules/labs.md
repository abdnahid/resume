---
description: "Test parameters, fees, lab routing and the /labs module — the catalogue hierarchy, urgent fees, capability and coverage"
paths:
  - "lib/labs/**"
  - "app/(labs)/**"
  - "prisma/seed-labs.ts"
  - "prisma/import/test-parameters.ts"
  - "prisma/import/chemical-parameters.ts"
  - "prisma/import/xlsx-grid.ts"
  - "prisma/import/docx-grid.ts"
  - "prisma/import/operational-labs.ts"
  - "prisma/import/reconcile-sub-products.ts"
  - "prisma/import/recompute-urgent-fees.ts"
---

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

- **A laboratory can be added and removed at `/labs/registry`** (D121), because
  the organogram is not the last word — an office opens a bench or closes one
  for good. **A lab recorded there carries no organogram unit**, and that is
  forced, not chosen: `seed:labs` upserts on `lab-<unit slug>` and
  `Lab.orgUnitId` is `@unique`, so a hand-recorded lab holding a unit the seed
  also maps would make the next `npm run seed:labs` fail on the constraint. It
  buys the one invariant the screen needs — **`orgUnitId === null` means nothing
  outside the registry will ever rewrite the row** — so that row is safe to
  delete and a seeded one is *futile* to: the seed writes it straight back.
  **Removal is refused while anything names the bench** — capability, boxes,
  test orders, agreed sample counts, letters — listed by name rather than
  counted, the discipline `setRouting()` uses. Everything else is closed, not
  deleted.
- **A second branch bench of the same discipline is ambiguous, and it is said
  out loud.** `labFor()` takes the first match by discipline, which held only
  while every branch had at most one of each (head office's eight are separated
  by `HEAD_OFFICE_SECTION`). `createLab()` returns the collision as `ambiguity`
  and the form reports it at creation. Capability is the office's (D116), so the
  sample still reaches the right office — what is imprecise is which bench is
  named on the consignment.

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
- **A destination is an office** (D117) — so look one up in `Office`, never in
  `Lab`. `screen.ts` went on querying `prisma.lab` with an office id after the
  migration: 23 offices numbered 1–23 against 46 laboratories numbered 1–46, so
  **every id collided**, the `?? \`Office ${id}\`` fallback never fired, and the
  field officer's sampling screen named every box after an unrelated bench —
  Barishal read as *Textile, Head Office*. The post-seal half of the same file
  read the name through the relation and was right, so **the name changed at the
  moment of sealing**. Fixed 2026-09-10.
- **An office's short name is the city, and the city is not unique.** *Head
  Office, BSTI, Dhaka* and *DMI, BSTI, Dhaka* both end in Dhaka, which gave the
  23-column map two columns headed the same on the screen where an office picks
  a destination. Use `officeShortNames(offices)` — it falls back to the office's
  own first segment where a city is shared — not `officeShortName()` alone, in
  anything that renders a list.
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
  | `/labs/registry` | which laboratories exist, and what each can *run* | superadmin adds, removes and closes; that lab's own office declares what it runs |
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
- **The tests are always listed, and grouped by discipline** — physical, then
  chemical, then anything else. A package is not a flat list to the person
  answering it: Ceramic Tiles is five physical tests and four chemical ones run
  by two different benches, and interleaved it makes an office hold the split in
  its head while ticking. Each heading carries the bench that would run its
  tests — read from the parameters' own `ownLabId`, never re-derived, since
  `labFor()` already decided it on the server. That heading replaced a single
  warning line that named **one** discipline for a set that can hold both: at
  any of the twelve offices with no laboratory, Ceramic Tiles used to report
  "9 of these are physical tests" when four are chemical.
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
- **`lab_entry` is a role** (D105, renamed by D123) and has **no users today**,
  exactly like `one_stop`. Granting it at `/hr/listing/roles` is the first step;
  until then an office head or a superadmin does the work. **It is scoped to its
  own office and nowhere else** — every check in `lib/labs/access.ts` compares
  `actor.officeId` against the office being edited, and only a superadmin works
  across offices.

- **The module is built and entry has started.** Barishal made the first real
  coverage entries on 2026-09-08 — U-PVC Pipe, two tests on its own chemistry
  bench and three sent to Rangpur — which is the whole flow working end to end.
  Everything else is still a stand-in. The order for the rest is: grant
  `lab_entry`, then each office works through `/labs/coverage`. Nothing is
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

## Who may act in the testing module (D136, amending D133)

**Both lab roles are derived from the desk. Neither is granted, and neither
should be re-introduced as a grant.** They were grants until 2026-09-14, and the
result was a module nobody could use: every desk in place, no holders, all 23
offices with no wing head and no testing officer. Derived, 23 of 23 resolve.

| | Rule | `lib/labs/testing.ts` |
|---|---|---|
| **Head office wing head** | holds the Director post in `Executive (… Testing Wing)`, substantive **or acting** (D74) | `wingHeadsOfOffice()` |
| **Branch wing head** | holds the `office_head` role; covers **both** disciplines | same, the fallback branch |
| **Testing officer** | rung is examiner or assistant_director | `isTestingRung()` |

- **A branch keys on the role and not the Executive desk.** Only **11 of 23**
  office heads sit in their office's Executive section — the rest are in CM, in
  Metrology, one in a *Physical Lab*, and two hold no desk at all. The desk rule
  would leave twelve offices headless.
- **A branch head covers both disciplines whatever unit he sits in.** Narrowing
  by his unit made Pabna's head `physical` only — he is seated in *Physical Lab,
  Pabna* — so his own office's chemical orders refused him. Only a head office
  wing director is narrowed, because there the unit *is* the wing.
- **The test is a *testing* wing, not merely Executive.** Head office's
  `office_head` is the Director of the Certification Marks Wing and heads no
  laboratory.
- **`isTestingRung()` is the single place the bench question is answered** —
  `enterResult()`, `submitReport()` and the screen's `canEnterResults` all call
  it, so a control can never be offered that the service refuses.
- **`office_head` stays a granted role.** It is not derivable, and it is what a
  branch's whole testing chain now hangs off.

**Nobody signs their own test report.** Where the rung above the tester is empty
the **wing head** gives the authorising signature *and* approves, in one act —
`signaturePlan()` returns `authorisedBy: "wing_head"` and `stateAfterSubmit()`
sends it straight to `pending_approval`. D133 had the Examiner authorise his own
report; that is overruled. Head office always staffs Director → DD → AD →
Examiner, so its reports are signed three rungs down and the Director only
approves. Pabna and Dinajpur are the live cases of the fallback.
`approveReport()` **recomputes the plan rather than trusting the draft**, and
never overwrites a signature somebody else gave.

**A person holding two desks may take two steps on one order** — Khalilur
authorising as Deputy Director (Chemistry) and approving as acting Director
(Chemistry). The client's explicit call: the desk he acts from is what counts.
**Desk switching is not built**, so until it is, authority follows every desk he
holds at once.

**The `canReceive` contract.** `actionsFor()` promises a control is never offered
that the service would refuse, and it broke that: *Mark samples received* showed
on orders whose box was still at the counter, and the refusal arrived on the
click. It now carries `awaitingBoxes` — the same read `receiveByWing()` refuses
on — and the screen names the box instead of offering a dead button.

