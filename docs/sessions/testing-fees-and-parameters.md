# Working log — testing fees and the parameter catalogue

**What this file is.** A verbatim record of the working sessions on BSTI's test
parameter catalogue and the fee model built over it. Started 2026-09-03 from the
textile wing's parameter list.

**Why it exists.** This piece of work runs across several days and two machines,
so no single session holds the whole thread. Nothing here is recoverable from
the code: it is the reasoning, the questions still unanswered, and the things
the client said that shaped the design.

**How to use it.**

- **Read it before resuming.** It is the context a new session does not have.
- **Append, never rewrite.** Each session gets its own `## Session N` heading
  with the date and which machine it ran on. Earlier sessions are the record of
  what was thought at the time and stay as written, even where later sessions
  contradict them — a superseded decision is worth as much as the one that
  replaced it, and the plan carries the current answer.
- **Verbatim means verbatim.** The user's messages and the assistant's replies
  are reproduced word for word. Tool calls, file reads and the intermediate
  analysis are not — only the conclusions that were actually stated. Where a
  number in an early session was later found wrong, the correction goes in the
  later session rather than being edited into the earlier one.
- **Decisions belong in `docs/BUILD-PLAN.md`**, not here. When something is
  settled it gets a D-number there and this file records how it was reached.

---

## Session 1 — 2026-09-03

Reading the textile parameter list for the first time. No code written.

### User

> get up to date with the project. we will discuss next

### Assistant

I'm caught up. Environment is green: `npm install` was stale on this machine
(zod 3 installed against `^4.5.4` declared, no `react-hook-form`/`@hookform/resolvers`)
— installed, Prisma client regenerated, `npx tsc --noEmit` clean, tree clean and
level with `origin/main`.

**Where the project stands**

*Platform / CM track* — steps 1–7d done, 8a in progress:

- Store catalogue, two-lane auth, kernel payments (sandbox behind
  `PaymentProvider`), party registry: ✅
- CM application runs end to end — draft → `pending_app_fee` → `submitted`,
  filed against one of the real **315 mandatory products**, all its standards
  required, SKUs, production capacity, questionnaire, declaration. Four-step
  form with zod schemas shared by form and server.
- Step 8a (2026-09-02): `office_head` role, `Application.holderEmployeeId`,
  `ApplicationMovement`, seniority read off the *employee's* grade. Verified 29
  checks.
- Step 8+ (the real workflow engine — routing snapshot, SLA clocks, reassign)
  not started.

*HR payroll* — the whole chain is live on 554 real employees: roster, NPS-2015
scale, versioned fixation, house rent, daily basis, court verdicts with arrears,
processing + bank advice, office setup, roles.

**The things actually blocking, roughly in order of bite:**

1. **All 554 accounts share `bsti@123`.** Oldest open item, biggest exposure.
   Needs forced first-login reset — and it's gated on the no-OTP
   password-reset question (§10 #9).
2. **218 employees not imported**, and the blocker is ours. 115 held out by five
   biographical NOT NULL columns that nothing in `lib/salary/` or
   `lib/workflow/` reads; 72 more by a null `bio` — and that second group is the
   valuable one (18 of them CM Wing, the section whose workflow chain is one
   desk deep). Last commit was the investigation; the fix hasn't been made.
3. **251 of 554 have no `orgPostId`** — no section, so no desk, so no file can
   reach them. Neither import fix touches this.
4. **`EmployeeCategory` is immutable after import** — a regularised daily-basis
   worker can never be fixated.
5. **Going-live blockers on money**: 375 standards carry an invented ৳500 demo
   price, no real fee schedule, no e-Challan account numbers, gateway unchosen.

Two things I'd flag as worth a decision rather than just noting: whether the 24
multi-standard products genuinely require *all* their standards (if some are
alternatives, applicants are buying standards they'll never be certified
against), and the jurisdiction default's two odd consequences — Dhaka district
routes to Head Office, and DMI receives nothing.

What are we doing next?

### User

> I think we need to update the employee list. We couldn't add some important
> employees earlier. we will do that later. For now lets talk about an important
> file I placed in utils folder. named textile-parameter-list.xlsx. First read
> this file and discuss with me about what you understand

### Assistant

I've read it end to end. Here's what it is and what it means for us.

#### What the file is

`utils/textile-parameter-list.xlsx` is **the Phase G parameter catalogue for the
Textile wing** — the reference data addendum A§1.1 calls the foundation of
test-plan resolution and "the largest data-entry effort in the project, and none
of it is software work." This is the first wing's worth of it arriving.

Two sheets. `Sheet1` is a six-row scratch pad (variety 1/2/3 against 156/196 —
looks like working notes for GSM-dependent limits); the real content is
`working Textile Product lis (2)`: 1,929 data rows, 12 used columns, 1,476
merged cells carrying the hierarchy.

```
Main Product → Sub-Product/Variant → Standard → Parameter → Sub-Parameter
            → Standard Limit → Method → Test Fee → Total → Duration (normal / urgent)
```

**Counts after resolving the merges:** 50 main products · **104 test packages**
(one per main+variant; S/L runs 1–102 because S/L 1 covers three innerwear
variants) · 17 product standards · 71 distinct parameters · 54 test methods ·
fees ৳494–৳9,464, median ৳3,515, ৳421,571 if every package were run once ·
turnaround 12/10/9 days normal against 9/7/6 urgent.

**It is internally consistent.** All 104 package totals equal the sum of their
parameter fees — I checked every one. Whoever maintains this has been careful,
which is worth knowing before we start "correcting" it.

#### How it lines up with A1.1

Most of it maps directly — `parameter_name`, `test_method`, `limit_expression`,
`bds_id`, `standard_turnaround_days`. Three things don't:

**1. There's a level A1.1 doesn't have, and it changes the schema.** 1,640 of
1,929 rows carry a *sub-parameter*. Colour fastness to perspiration is **one
৳700 test** that produces **14 separately rated readings** (acidic/alkaline ×
change-in-colour + staining on six fibres). The fee is charged at the parameter
level; the result is recorded at the sub-parameter level. If `test_parameter` is
one flat row it gets one of those two wrong — we need a result-line child.

**2. `applies_when` is already needed, and the file answers it as data rather
than as an expression.** The addendum warned this would break first on cement.
It breaks first on textiles:

| Innerwear variant | 3rd parameter | Fee |
|---|---|---|
| Cotton-Woven | Colour fastness to **Perspiration** ৳700 | ৳2,322 |
| Woolen, Silk, Knitted | Colour fastness to **Washing (A1)** ৳494 | ৳2,116 |
| Manmade and Blended | Colour fastness to **Washing (B2)** ৳494 | ৳2,116 |

Same product, same standard, three parameter sets, two prices. The good news: we
don't need an expression language yet. A variant row carrying its own parameter
list does the job, and that's the shape the data already has.

**3. Two of the three A1 tables are entirely absent.** No sample requirements
(A1.2 — quantity, container, destructive, shareable), so we cannot compute
sample or barcode counts. No facility capability (A1.3), so there is no routing.
Also missing: `discipline`, `is_mandatory` (declared vs pass/fail), BDS clause
references, Bengali names.

#### The finding I'd act on first: the fee is per *method*, not per product

88 distinct (parameter, method) pairs, and only **3** carry more than one fee.
That means the fee belongs on the test method, and this one textile file has
handed us a price list for 54 methods that every other wing will reuse. The
three exceptions are either a deliberate discount or a data error, and which one
decides the schema:

- Colour fastness to Washing (B2), `BDS ISO 105 C 10:2010 (B2)` — ৳494 in some
  packages, **৳823** in others
- Washing (D4), same method — ৳823 / ৳494
- Colour fastness to Water, `BDS ISO 105 E 01:2016` — ৳782 / **৳453**

#### The mapping problem — our `Product` table does not line up with this

Every one of the 17 standards is in the mandatory 315, but the granularity is
completely different:

- **#252 Colour Fastness Ratings of Textiles** (one product to us) → **16 main
  products, 29 packages** here
- **#246 Industrial Sewing Threads** (one product) → **15 main products, 30
  packages**
- **#250 Silk Fabrics** (one product) → 10 variants
- **#261 Disposable Diapers** (one product) → 2 mains (baby/adult), 8 packages
  by size

So 17 of our 315 products explode into 104 test packages. And the exploding
dimension **is our `ApplicationSku`** — diaper sizes XS→XXL are SKU rows with a
size-chart size, and they carry genuinely different limits (rewet 4/5/7/8/10/12
g). That confirms the addendum's line 218: the test plan resolves per SKU, not
per application. But our SKU variant field is free text and this is a controlled
list, so there's a binding decision to make.

**Coverage: 17 of the 31 mandatory Jute & Textile products.** Not covered:
Poplin, Cotton Sewing Threads, Cotton long cloth, Cotton Bed Sheets, both rubber
beltings, Handloom Lungi, Printed Silk Saris, Synthetic Mosquito Nets, Towels &
Towelling, Jamdani Sharee, Bed Mattress, Reusable Sanitary Napkin — and Steviol
Glycosides, which is filed under Jute & Textile in the source PDF and clearly
shouldn't be.

#### One concrete discrepancy

All 30 sewing-thread packages test against **BDS 1221 : 2011**. The mandatory
list names **BDS 1221:2021 (4th Revision)** — ten years and a revision apart.
Every other standard's edition matches exactly. Either the lab is running a
superseded edition or the published list is ahead of practice; that's
`bdsEditionPolicy` (§10 #2) showing up in live data rather than as a
hypothetical.

---

**Questions I'd put to the Textile wing before we model anything:**

1. Is the test fee per method or per product? The three conflicting fees decide it.
2. BDS 1221 — 2011 or 2021?
3. Is the variant list controlled vocabulary we should seed and bind to SKUs, or
   descriptive text?
4. The 14 uncovered textile products — not collected yet, or not tested by this
   lab?
5. Urgent turnaround is 25–30% faster with **no urgent fee column**. Is urgent
   priced?
6. Does an applicant always get the whole package, or does an officer select
   parameters?

What do you want to do with it — model it toward A1.1, or hold until more wings
arrive?

### User

> Lets talk about setting fee. But first I need you to save a file where my input
> and your response is documented word by word so that in future session you can
> read that file and understand. Actually this section is going to be complex so
> I might work on it a few days in different sessions from both of my computer.

### Assistant

Precedent was a `.docx` dropped in `utils/` — opaque, can't be diffed or
appended to. For something you'll add to over several days from two machines, a
markdown file in `docs/` is the right shape: appendable, diffable, and a future
session can just read it.

*(This file was created at this point. The discussion continues below.)*

### User

> Okay I want to stop here from this computer. We will resume this from another
> computer in a different session.

### Assistant

*(Wrapped up: appended this exchange to the log, committed and pushed. The
resume point is recorded at the end of this file.)*

---

## Session 1 (continued) — product, sub-product, and where the limit lives

### User

> Looks good now lets talk about fee. But before fee lets calrify product and sub
> product. I think Main product should be bds specified name. For the serial 1 I
> have cut the main file and prepare a dedicated file. I will update it from time
> to time according to my need. For now I have edited the main product name to be
> identified by BDS name. based on that the sub products will be identified. Now
> each sub product has their parameters. Now you might think parameters are
> shared between sub products. In this file it might look like it. But although
> the parameter name matches between two sub product or even product, the
> standard limit might be differnt. what do you suggest how can we model it?

The file referred to is `utils/textile-parameter-list-serial-1.xlsx` — S/L 1 cut
out of the main list, with `Main Product` rewritten from "Textile Colour Fastness
Rating (Innerwear Fabrics)" to **"Colour Fastness Ratings of Textiles"**, which is
the mandatory-315 name for #252, BDS 1758:2022. Same twelve columns, 58 data rows,
three sub-products. Column P's stray notes are gone.

### Assistant

Your instinct is right, and the data backs it harder than the file first suggests.

#### First — your rename is the right call, and it fixes a problem I flagged

Making Main Product the BDS-specified name means **Main Product = our `Product`
row from the 315**. The 50 mains collapse to 17, matching #237, #241, #246, #250,
#252 and so on exactly. The mapping problem from last session disappears:
sub-product becomes the variant beneath a product we already have.

But it makes the limit problem *worse*, which is exactly why you're right to
raise it now. Before the collapse, only 5 of 50 mains had a parameter whose limit
varied between its own variants. After it:

| Product | Variants | Parameter-lines | Lines whose limit depends on the variant |
|---|---|---|---|
| BDS 1758:2022 Colour Fastness Ratings | 29 | 83 | **35** |
| BDS 1467 Silk Fabrics | 10 | 8 | 5 |
| BDS 2006 Disposable Diapers | 8 | 6 | 5 |
| BDS 1974 Light Weight Jute Sacking | 2 | 10 | 5 |
| BDS 1989 / 1767 Jute bags | 2 | 10 | 3 each |

Across the whole file: **94 of 181** distinct (parameter, sub-parameter) keys
carry more than one limit. Only 87 are single-valued. Concretely — *Colour
fastness to Rubbing/Crocking » b) Wet rub-* is `3-4` in nine places, `3` in
sixteen, `4` in three, and `4 or better` in fifteen. Same parameter, same method,
same fee, four different limits.

So: **the limit is not an attribute of the parameter. It is an attribute of the
intersection of a variant and a parameter.** Anything that hangs the limit off the
parameter is wrong, and anything that dedupes parameters *by* their limit will
silently merge rows that are not the same.

#### The model I'd suggest — three layers

**Layer 1 — vocabulary. Shared, reusable, carries no limits.**

```
TestParameter      nameEn/nameBn, discipline, slug          71 rows
TestParameterLine  parentId, label, ordinal                181 rows
                   "iv) Acidic-Staining Nylon" — the result-bearing row
TestMethod         designation, bdsId?, slug                54 rows
```

These are global on purpose. Facility capability (A1.3) keys on parameter +
method — "which lab can run colour fastness to perspiration by BDS ISO 105 E 04"
is *the* query the whole routing feature stands on. Duplicate parameters per
product and that question can only be answered by fuzzy name matching.

**Layer 2 — the specification. Per variant, and this is where limits live.**

```
ProductVariant   productId → Product(315), bdsId, nameEn/nameBn,
                 turnaroundNormalDays, turnaroundUrgentDays, ordinal    104 rows
VariantTest      productVariantId, testParameterId, testMethodId,
                 feePoisha, ordinal                                     713 rows
VariantTestLimit variantTestId, testParameterLineId?, limitText,
                 limitKind, ordinal                                    1929 rows
```

`VariantTestLimit` is one row per spreadsheet row — and I checked: **(product,
variant, parameter, sub-parameter) is unique across all 1,929 rows, zero
duplicates.** The spreadsheet row *is* the limit row, one to one. That's a good
sign the shape is right, and it gives you an import that cannot silently merge
anything.

`testParameterLineId` is nullable for the 289 rows that have no sub-parameter —
one limit row, line null.

**Layer 3 — `limitKind`, because the text alone can't carry it.** The file has
four kinds:

| Kind | Rows | Example |
|---|---|---|
| `rule` | 1,685 | `Maximum 17%`, `4 or better`, `94cm (+4/ -0)cm` |
| `declared` | 224 | `*-text field-*`, `As declared` |
| `cross_reference` | 10 | `As per BDS 1149`, `As per BDS 1147` |
| `unspecified` | 10 | blank — all *Silk Fabrics » Material (Purity of silk fibers)* |

`declared` is A1.1's "some parameters are declared, not pass/fail", and it has a
real consequence: **the applicant must be asked for the value at application
time.** Total length of yarn in a package, polyester percentage, single-end
breaking force — the manufacturer states it and the test confirms the stated
figure. That's a form field, not a constant. `cross_reference` should carry a
nullable `refBdsId` so the delegation is a link, not prose. The 10 blanks look
like a gap in the source worth asking about.

**One thing I'd deliberately *not* do yet:** parse `limitText` into
operator/value/unit. Automatic pass/fail is a later phase, and a parser guessing
at `94cm (+4/ -0)cm`, `from 40 to 48` and `(-6.0% to +8.0%)` will be wrong in ways
nobody notices. Keep the text as the authority; add structured columns beside it
when we build result entry.

#### Two consequences worth deciding now

**1. `ProductVariant` is reference data, not free text — and that changes the CM
form.** The variant selects the parameter set *and* the price (innerwear
cotton-woven ৳2,322 vs woolen/silk/knitted ৳2,116). A free-typed variant yields no
test plan and no fee. So step 2 of the application would become: pick product →
pick variant from a controlled list → then brand/size/packaging hang off that.
Today the applicant free-types all of it into `ApplicationSku`. That's a form
change, not just a schema one.

**2. Sub-product is currently two different axes in one column.** For diapers the
variant is the *size* (XS→XXL — identical parameters, different limits), which is
also an SKU dimension. For innerwear it's the *fibre construction* (cotton-woven
vs woolen/silk/knitted), which isn't a size at all and changes which parameters
apply. If a manufacturer makes cotton-woven innerwear in three sizes, is that one
variant or three?

I'd keep the list flat for now — it's the shape the file has, and inventing a
second axis before we've seen more wings is exactly the over-modelling D8 warns
against. But it's worth knowing you'll hit it, and diapers are the case that will
force it.

---

Before I write any of this down: does "sub-product" mean the same thing to the
Textile wing in both those cases, or are diaper sizes an accident of how this
sheet was built? And shall I now do the fee side on top of this model?

---

## Reference — facts established in session 1

Kept separate from the log so a resuming session can find them without reading
the whole conversation. Every number here was derived from
`utils/textile-parameter-list.xlsx` and verified in that session.

**Shape of the source.** Sheet `working Textile Product lis (2)`, `A1:P1930`.
Row 1 is the header. Columns: A `S/L`, B `Main Product`,
C `Sub-Product /Product Varient`, D `Standard`, E `Parameter`, F `Sub Parameter`,
G `Standard Limit`, H `Method`, I `Test Fee`, J `Total Test Fee`,
K `Duration of Test (Normal)`, L `Duration of Test (Urgent)`. M–O are empty; P
holds 22 stray notes that are drafting leftovers, not data.

**Reading it requires resolving the merges.** 1,476 merged ranges carry the
hierarchy — a main product, a variant, a standard, a fee and a duration are each
written once and span the rows beneath. Read without filling the merges, every
column but F and G looks 90% empty.

**The package boundary is the merge block of column J**, not the S/L number.
That yields exactly 104 packages against 102 S/L values, because S/L 1 spans
three innerwear variants. Grouping by S/L gives a wrong answer for that one row.

| Quantity | Value |
|---|---|
| Data rows | 1,929 |
| Test packages (main + variant) | 104 |
| Main products | 50 |
| Product standards | 17 |
| Distinct parameters | 71 |
| Distinct test methods | 54 |
| Rows carrying a sub-parameter | 1,640 |
| Rows with a blank limit | 10 (all *Silk Fabrics » Material (Purity of silk fibers)*) |
| Fee range per package | ৳494 – ৳9,464, median ৳3,515 |
| Parameters per package | 1 – 13, median 6 |
| Normal turnaround | 12d ×75, 10d ×18, 9d ×9 |
| Urgent turnaround | 9d ×75, 7d ×17, 6d ×9, 8d ×1 (*Absorbent Cotton*, S/L 70) |

**Consistency check that passed:** for all 104 packages, `Total Test Fee` equals
the sum of the distinct per-parameter `Test Fee` values. The per-parameter fee is
merged across that parameter's sub-parameters, so it must be counted once per
parameter, not once per row.

**Fee determinism:** 88 distinct (parameter, method) pairs, 3 of which carry more
than one fee — Washing (B2) ৳494/৳823, Washing (D4) ৳823/৳494, and Colour
fastness to Water ৳782/৳453. Every other pair is single-valued.

**Standard → mandatory-315 mapping** (base number match; all 17 are in the 315):

| Standard in file | Mains | Packages | Mandatory product |
|---|---|---|---|
| BDS 1221 : 2011 | 15 | 30 | #246 Industrial Sewing Threads — **list says 1221:2021 (4th Rev)** |
| BDS 1758:2022 | 16 | 29 | #252 Colour Fastness Ratings of Textiles |
| BDS 1467: 2021 | 1 | 10 | #250 Silk Fabrics |
| BDS 2006:2022 | 2 | 8 | #261 Disposable Diapers |
| BDS 1148:2021 | 2 | 4 | #242 Woven Shirtings (Polyester/blends) |
| BDS 1175:2021 | 2 | 4 | #243 Woven Suitings (Polyester/blends) |
| BDS 1125:2020 | 2 | 4 | #241 Umbrella Cloth |
| BDS 63:2017 | 1 | 2 | #237 Cotton Sharee – Power Loom |
| BDS 319:2020 | 1 | 2 | #239 Cotton Canvas |
| BDS 1989:2021 | 1 | 2 | #259 Hessian Jute Bags for Rice & Pulse |
| BDS 1767:2014 | 1 | 2 | #253 Jute Bags for Packing 50 kg Food Grains |
| BDS 1974:2019 | 1 | 2 | #258 Light Weight Jute Sacking Bags 50 kg |
| BDS ISO 105- E11:2004 | 1 | 1 | #264 Colour Fastness to Steaming |
| BDS 1261:2019 | 1 | 1 | #248 Sanitary Napkins |
| BDS 1260:2016 | 1 | 1 | #247 Absorbent Cotton |
| BDS 2005:2022 | 1 | 1 | #260 Hessian Jute Bags 30 kg |
| BDS 2017:2023 | 1 | 1 | #262 Nonwoven Wipes |

**Not covered — 14 of the 31 mandatory Jute & Textile products:** #235 Poplin
Fabric, #236 Cotton Sewing Threads, #238 Cotton long cloth, #240 Cotton Bed
Sheets, #244 Rubber Flat Transmission Belting, #245 Rubber Conveyor and Elevator
Belting, #249 Handloom Cotton Lungi Cloth, #251 Printed Silk Saris, #254
Synthetic Mosquito Nets, #255 Towels and Towelling, #256 Jamdani Sharee, #257 Bed
Mattress, #263 Reusable Sanitary Napkin, #265 Steviol Glycosides (miscategorised
in the source PDF — it is not a textile).

**Open questions put to the Textile wing, none answered yet:**

1. Is the test fee per method or per product?
2. BDS 1221 — 2011 or 2021?
3. Is the variant list controlled vocabulary, to be seeded and bound to
   `ApplicationSku`, or descriptive text?
4. The 14 uncovered products — not collected yet, or not tested by this lab?
5. Is the urgent lane priced? There is no urgent fee column.
6. Does an applicant always get the whole package, or does an officer select
   parameters?

**Tooling note.** No Python `openpyxl` on the Windows machine; the project's own
`xlsx` package (`node_modules/xlsx`, v0.18.5) reads the workbook fine. A script
run from the scratchpad must `require()` it by absolute path, since Node resolves
from the script's own directory.

### Added after the product/sub-product discussion

**Main Product is now the BDS-specified product name**, per the user's edit to
`utils/textile-parameter-list-serial-1.xlsx`. That makes **Main Product = our
`Product` row from the mandatory 315**, and the 50 mains in the original file
collapse to 17. Sub-product becomes the variant beneath a product we already
hold. `textile-parameter-list-serial-1.xlsx` is the user's working cut — S/L 1
only, three sub-products, 58 data rows — and will be extended over time. The full
`textile-parameter-list.xlsx` stays as the unedited source.

**Limits vary by variant, and this is the central modelling constraint.**
94 of 181 distinct (parameter, sub-parameter) keys carry more than one limit
across the file; only 87 are single-valued. After collapsing mains onto the BDS
product, 56 parameter-lines have a limit that depends on which variant is being
tested — 35 of them inside BDS 1758 alone. *Colour fastness to Rubbing/Crocking »
b) Wet rub-* is the clearest case: `3-4` ×9, `3` ×16, `4` ×3, `4 or better` ×15,
at one method and one fee.

**Verified key.** `(main product, sub-product, parameter, sub-parameter)` is
unique across all 1,929 rows — zero duplicates. Also unique when the main is
replaced by its standard. So one spreadsheet row maps to exactly one limit row,
and an importer keyed this way cannot silently merge two specifications.

**Four kinds of limit**, which a single text column cannot distinguish:

| Kind | Rows | Example |
|---|---|---|
| `rule` | 1,685 | `Maximum 17%`, `4 or better`, `94cm (+4/ -0)cm` |
| `declared` | 224 | `*-text field-*`, `As declared` — the manufacturer states it |
| `cross_reference` | 10 | `As per BDS 1149`, `As per BDS 1147` |
| `unspecified` | 10 | blank — all *Silk Fabrics » Material (Purity of silk fibers)* |

**Proposed model, three layers** (not yet built, not yet a D-number):

| Table | Rows this file would produce | Holds |
|---|---|---|
| `TestParameter` | 71 | the name only — no limit, no fee |
| `TestParameterLine` | 181 | the sub-parameter; the result-bearing row |
| `TestMethod` | 54 | the method designation, optional `bdsId` |
| `ProductVariant` | 104 | `productId` → the 315, `bdsId`, turnaround normal/urgent |
| `VariantTest` | 713 | variant × parameter × method, **fee** |
| `VariantTestLimit` | 1,929 | **the limit** — one per spreadsheet row |

The rule the model exists to enforce: **the limit belongs to the intersection of
a variant and a parameter, never to the parameter.** Layer 1 is global so that
facility capability (A1.3) can key on parameter + method, which is the query
test-plan routing depends on.

Deliberately deferred: parsing `limitText` into operator/value/unit. Pass/fail
evaluation is a later phase and a parser guessing at `from 40 to 48` or
`(-6.0% to +8.0%)` fails invisibly. Text stays the authority; structured columns
arrive with result entry.

---

## Resume point at end of session 1

**State at the end of session 1 (2026-09-03).** No schema written, no code
changed. The parameter model above is proposed and agreed in outline; the fee
model has not been discussed at all.

**Two questions were put to the user and are unanswered:**

1. Does "sub-product" mean the same thing to the Textile wing in both its uses —
   diaper *sizes* (XS→XXL, same parameters, different limits) and innerwear
   *fibre construction* (cotton-woven vs woolen/silk/knitted, which changes which
   parameters apply)? Those are two axes in one column. The recommendation was to
   keep the list flat for now and expect diapers to force the question later.
2. Whether to move on to the fee model on top of this structure.

**The next session should start by:** reading this file, then asking the user
which of the two to take up. The six questions for the Textile wing listed above
are also still open — the fee-per-method question in particular decides whether
`feePoisha` belongs on `VariantTest` (per product-variant, as the sheet is laid
out) or on `TestMethod` (shared, as the data mostly behaves).

---

## Session 2 — 2026-09-03 / 04 (Linux machine)

Resumed from the log. The product/sub-product/parameter model was agreed, the
lab-routing model was worked out from scratch, and the first file edit landed:
`utils/textile-parameter-list-sanitized.xlsx`.

### User

> hello are you here?
> lets resume the work we were doing about setting testing fees and parameters. I
> think the setup at the database should be like this-> product a-> links to
> sub-product a1,a2,a3-> each sub product links to own parameters (a1->a11,a12,
> a13,a14; a2-> a21, a22, a23; a3-> a31, a32)-> each parameter can have
> sub-parameter optionally (a11->a111,a112,a113,a114,a115;a14->a141,a142;a31->
> a311,a312,a313). Each parameter should have a certain fee,method. standard
> limit is assigned to parameter directly if no sub-parameter exists for that
> parameter. If Sub-parameter exist then standard limit is assigned to the
> sub-parameter. What do you think of this design? I want to do it like this
> because there are lots of possiblity of same parameter name in multiple
> sub-product or even product with different standard limit or fee or both.

### Assistant

Agreed with the design and the data backs it harder than the sheet suggests.
Confirmed from the source: 94 of 181 distinct (parameter, sub-parameter) keys
carry more than one limit; only 87 are single-valued. `Mass of Fabric (GSM)`
carries 9 different limits, `Ends and Picks per cm » b) Picks per cm` 9,
`Corrected mass/bag. g` 6, `Rewet under load in g (max)` 6.

Fee on the parameter rather than the sub-parameter is right — the fee is merged
across a parameter's sub-parameters in the sheet, and all 104 package totals
equal the sum of the per-parameter fees counted once. Method belongs there too:
**8 of 71 parameter names run under more than one method** depending on the
sub-product, and 3 of 88 (parameter, method) pairs carry two different fees, so
the fee cannot live on the method either.

The one change proposed: make the parameter *name* a pointer rather than a
string re-typed on all 713 rows. Two arguments were given —

1. The names have already drifted in the source. `Width of fabric` appears with
   three sub-parameter labels — `Width in cm (Tolerance: ±1 cm )` ×8,
   `(Tolerance: ±2% )` ×2, `(Tolerance: +1% )` ×4 — one measurement, three
   spellings, differing only because **the limit was typed into the label**.
   Same with `GSM (Weight per unit area or length)` (2 spellings). If the label
   is owned per sub-product nothing can ever tell you those are the same thing.
2. Facility capability (A§1.3) keys on parameter + method, which is the query
   lab routing depends on.

The honest counter-argument was also given: a shared catalogue only works if
data entry can find the existing name instead of creating a near-duplicate —
a screen problem, not a schema one.

**A wrinkle the model must survive:** the sub-parameter *set* itself varies by
sub-product. `Colour fastness to Washing (B2)` stains six fibres, but for 1 of
its 15 sub-products the list is Tri-Acetate/Viscose where the other 14 have
Acetate/Wool. So which lines apply is decided per sub-product, never globally on
the parameter.

### User

> Just tell me plainly. Does my idea solves the issues of mismatch?
> product->sub-Product->parameter->sub-parameter setup

### Assistant

Yes, completely. Because the limit hangs off a leaf beneath a specific
sub-product, the same parameter name in two sub-products is simply two rows with
their own limit, fee and method. There is no shared cell for them to collide in,
so a mismatch is not representable — not prevented by a rule someone has to
remember. Verified: `(product, sub-product, parameter, sub-parameter)` is unique
across all 1,929 rows.

The only thing it does not solve is the opposite problem — recognising that two
of those rows *are* the same parameter, which is what lab routing needs later.

### User

> I will route lab based on product+sub-product+parameter. For now we have CM
> module live. […] we have some cases where a party comes to our onestop center
> and ask for testing a certain product based on some selected parameters or all
> parameters. In that case the application is directly processed by Testing wing
> and then a test report is produced and given to client. This process doesnt
> produce any certificate like CM wing. […] the system should find which lab the
> sample will go to. The system should match the lab combining
> product+sub-product+parameter.

*(Second application track: direct testing. Applicant picks product →
sub-product → some or all parameters; sample is routed; a test report is
produced and no certificate.)*

### Assistant

Noted that the user's routing key removes the strongest argument for the shared
parameter catalogue — capability becomes a row per (sub-product, parameter),
a concrete list a lab manager can tick off and a plain FK to the row already
holding fee and method. Said plainly that the earlier suggestion should not be
treated as settled because of that.

Three things raised as schema-changing:

1. **A `Lab` is not an office.** It points at an `OrgUnit`, because head office
   has sections under two testing wings while a branch has one flat lab per
   discipline.
2. **A selected-parameter request can split across labs**, so **the lab belongs
   on each selected parameter line, not on the request** — correct whether or
   not a split happens, and wrong the first time one does if stored on the
   request. This also surfaces the missing A§1.2 sample-requirement data.
3. **Does a CM application always take the whole package**, or can an officer
   trim it? If it can be trimmed, both tracks are the same table.

### User

> 1. The file I provided is entirely for physical testing parameters. I have
> similar files for all of the labs. […] 2. Fallback is not always head office.
> Also not nearby. It depends on office. A office at barisal might test its
> sample that are not testable at barisal office at the comilla office instead of
> capable khulna office. THats why I was asking to prepare a 2D map. Dont worry
> about the data entry. We will build a module and each office and wing will
> enter there own data. 3. We will have a list of accredited lab from which we
> can select. It is the responsibility of examiner to select a specific 3rd party
> lab and generate official letter addressed to that lab. 4. depends on FDO. He
> can seal one sample per related lab or more than one if needed. so I think at
> the sampling report he can enter the number of sample he collected for specific
> labs.

*(This followed a full statement of the CM flow — apply on a BDS → wing director
or office head desk by factory jurisdiction → FDO → factory inspection, sample
sealed, sub-product recorded, sampling report → up the chain → head approves →
test fee generated and labs resolved → letters issued per destination. The
worked example: a Chittagong application whose sub-product has 10 parameters —
3 at Chittagong Chemistry, 2 at Chittagong Physical, 3 not testable in
Chittagong at all, 2 at a third-party lab supervised by the Chittagong examiner
of the matching discipline.)*

### Assistant

**The correction that matters most: that file is one lab's share, not the test
fee.** If every lab produces its own file in the same format, column J is a
per-lab subtotal. Session 1 recorded ৳494–৳9,464 per package and ৳421,571 for
the lot — those are the textile portion only. Disposable Diapers has 6
parameter-lines in this file and a diaper standard plainly needs chemistry too.

Consequences: the importer must **merge** a second file's parameters into
sub-products the first file already created, never insert a second copy; and
`(product, sub-product)` is the key that makes that safe, owned by neither file.

**It also settles discipline.** Discipline is fixed per parameter because it is
fixed per file — the file names the owning lab section (Textile, Organic
Chemistry, Food & Bacteriology…), which is stronger than a physical/chemical
flag since the wing falls out of the section. And **the same parameter name will
appear in two labs' files** — "Moisture" in textile and in food are different
tests — so any shared name catalogue is keyed on `(lab section, name)`, never
name alone.

**On the 2D map:** the requirement was accepted. The argument made was no longer
about data entry but about correctness — a map storing a destination directly
can name a lab that cannot do the test, and nothing checks it. Proposed two
tables that render as the same screen: **capability** (`Lab × (sub-product,
parameter)`, each lab maintains its own) and **referral** (per office, an
*ordered* preference of where to send what it cannot do, with per-parameter
overrides). The resolver walks the preference and picks the first entry that
actually holds the capability, so a cell can never point somewhere impossible.

**Third-party labs:** a `ThirdPartyLab` table, examiner selects one, letter to
that lab is a second artifact class. Suggested carrying **accreditation scope
and expiry** so the picker can grey out a lab not currently accredited for the
parameter in hand.

**A sequencing catch was found in the flow as described.** Routing was described
as happening after the head approves the sampling report, but the FDO needs to
know which labs to seal samples for *at inspection*. These are two moments:
routing resolves the instant the FDO enters the sub-product (the parameter list
is fixed then), and the fee and letters issue at approval. Routing is then
**snapshotted at approval**, so a referral map edited next month cannot redirect
a sample already sealed and in transit.

### From the organogram (verified this session)

Head office has **Physical Testing Wing** → Textile, Electrical & Electronics,
Civil Physical …, and **Chemical Testing Wing** → Organic Chemistry, Inorganic
Chemistry, Food & Bacteriology, Chemical Lab (PMO). Branch offices are flat:
one `Physical Lab, <city>`, one `Chemistry Lab, <city>`, no sections. Both are
`OrgUnit` rows, so `Lab.orgUnitId → OrgUnit` covers head office and branch
without special-casing.

**The fallback is not hypothetical.** 21 offices have a chemistry lab; only
**17** have a physical lab. **Cox's Bazar, Cumilla, Faridpur and Mymensingh have
no physical lab at all** — so for an application filed there, every physical
parameter falls through to another office on day one.

### User

> The fees are on parameter basis. The fees at the file is sub-total. Some
> products are entirely physical or entirely chemical. In that case that total is
> grand total of testing fee. So maybe you can do like this-> consider those
> subtotal-> lets say physical lab fee 2000 and no chemical parameter from a
> chemical wing data, then chemical lab fee is 0-> grand total 2000. Also in most
> cases like 99.99% time the urgent fee is double. Now another thing we need to
> do to sanitize textile-parameter-list.xlsx. We need to rename the main product
> column to match the BDS name exactly. I have provided you mandatory list.pdf
> file. You should follow those names.

### Assistant

The fee model needs nothing stored: the grand total is the sum of the selected
parameters' fees, and the per-lab subtotal is a grouping of that same sum — a
lab with no parameters contributes 0 by having no rows, not by needing a zero
row. Urgent is `2 ×` as the default with a per-parameter override for the 0.01%.

Then did the sanitisation. See the section below.

### The sanitisation — what was done and how it was verified

**Output: `utils/textile-parameter-list-sanitized.xlsx`.** The source
`textile-parameter-list.xlsx` was left untouched, per the session-1 decision that
it stays as the unedited original.

**Only column B changed.** Every `Main Product` value was replaced with the exact
product name from `prisma/data/mandatory-315.json` (which was parsed from
`utils/mandatory list.pdf`), resolved via the row's own `Standard` column.

**The mapping was deterministic.** All 50 distinct main products map to exactly
one standard each, and each of the 17 standards matches exactly one product in
the 315. **50 main products → 17 BDS names.**

| Collapsed into | From | Standard |
|---|---|---|
| #252 Colour Fastness Ratings of Textiles | 16 mains | BDS 1758:2022 |
| #246 Industrial Sewing Threads Made Wholly or Partly from Synthetic Fibres | 15 mains | BDS 1221 : 2011 |
| #241 Umbrella Cloth | 2 (Coloured, White) | BDS 1125:2020 |
| #242 Woven Shirtings Made of Polyester or Polyester Blends | 2 (Coloured, White) | BDS 1148:2021 |
| #243 Woven Suitings Made of Polyester or Polyester Blends | 2 (Coloured, White) | BDS 1175:2021 |
| #261 Disposable Diapers | 2 (Adult, Baby) | BDS 2006:2022 |
| the other 11 | 1 each | — |

**Bengali parentheticals were stripped**, following the user's own precedent in
`textile-parameter-list-serial-1.xlsx`. Only #252 needed it — `pdftotext` mangles
Bengali conjuncts, so `mandatory-315.json` holds it as
`Colour Fastness Ratings of Textiles ( ট টাইল পে র রং এর ািয়ে র মা া িনিদ করণ)`.
The user had already written just `Colour Fastness Ratings of Textiles`.
**This means `mandatory-315.json` itself carries mangled Bengali** — but it is
contained: **#252 is the only one of the 315** whose name has any Bengali in it,
and no `genericNames` entry does. So it is a one-row fix at the source, not a
re-parse.

**Verification, all passing:**

| Check | Result |
|---|---|
| Data rows | 1,929 before and after |
| Packages `(main, sub-product)` | **104 before, 104 after** — no collapse |
| Distinct main products | 50 → 17 |
| `(main, sub, parameter, sub-parameter)` unique | **1,929 / 1,929** |
| Rows where the rename merged a different limit or fee | **0** |
| Cells changed outside column B | **0** |
| Cells in column B changed incorrectly | **0** |
| Merge ranges | 1,476 before and after, identical |
| Per-package fee reconciliation | 104 / 104 still sum to their total |
| Zip integrity / `xl/styles.xml` retained | pass / yes |

**The rename is lossless because the sub-product column already carries what the
main-product name held.** For #252 the sub-products are `Bed-Linen Fabrics
(Cotton-Woven)`, `Buckram cloth`, `Yarn (Cotton)` …; for #246 they are `Air-Jet
Textured Polyester Threads-Coloured` and so on. Nothing was distinguished only by
the main-product name.

**How it was written.** No `openpyxl` and no `pip` on this machine, and SheetJS's
free build drops cell styles on write. So the workbook XML was patched directly:
new shared strings appended to `xl/sharedStrings.xml`, the 52 column-B cell `<v>`
indices repointed, everything else copied byte-for-byte. That is why merges,
styles and column widths survive exactly.

**Tooling note for the next session.** The obvious cell regex is wrong. Matching
`<c r="..."([^>]*)>(.*?)</c>` swallows following cells, because `[^>]*` happily
eats the `/` of a self-closing `<c r="B5" s="1"/>`. The first analysis this
session reported 5 phantom package collisions on blank sub-products because of
it. The correct form is
`<c r="([A-Z]+)(\d+)"([^>]*?)(?:/>|>(.*?)</c>)`. A working reader is kept at
`scratchpad/lib.py` during the session but is not committed — rewrite it from
that regex.

### Settled this session, not yet given D-numbers

1. **The catalogue hierarchy.** Product → sub-product → parameter → optional
   sub-parameter. Fee and method on the parameter. Limit on the parameter when it
   has no sub-parameters, on the sub-parameter when it does.
2. **The fee is per parameter.** A file's `Total Test Fee` is that lab's subtotal;
   the grand total is the sum over all labs, and a lab with no parameters
   contributes nothing rather than a zero row.
3. **Urgent is 2× the normal fee** by default (~99.99% of cases), overridable per
   parameter.
4. **Discipline / owning lab section comes from the source file**, one file per
   lab, all in the same format.
5. **Lab routing keys on (product, sub-product, parameter)** and is expressed as
   an office × parameter map, to be maintained by each office and wing through a
   module of its own.
6. **Third-party testing keeps custody inside BSTI** — the accountable unit and
   the physical testing location are two different fields, and the examiner of
   the matching discipline selects the accredited lab and writes to it.

### Still open

- Does a CM application always take the whole parameter package, or may an
  officer trim it? Decides whether direct testing and CM share one table.
- Turnaround for a partial selection. Duration is recorded per package, not per
  parameter, so a 2-of-13 selection has no computable promised date.
- Who assembles the report when results land from several labs at different
  times, and does one failed parameter fail the licence?
- The six questions to the Textile wing from session 1 remain unanswered, though
  #1 (fee per method or per product) is now settled as **per parameter**, and #5
  (is urgent priced) is settled as **2×**.

## Resume point mid-session 2 (superseded — see the end of this file)

**State at the end of session 2.** Still no schema written and no application
code changed. One file produced: `utils/textile-parameter-list-sanitized.xlsx`.

**The next session should:** take the six settled items above to
`docs/BUILD-PLAN.md` as D-numbers (the highest in use is **D59**, so these would
be D60–D65), then write the Prisma models. The parameter/limit model and the lab
routing model are both worked out in enough detail to build.

---

## Session 2 (continued) — the schema, the import and the 2D map

### User

> FYI we dont need to show bengali in bds name. Now can you model the database
> and seed it as needed based on this document? Also the 2D map. For now keep all
> the mapped point to head office lab. this is textile file so all of those
> parameter maps to physical wing. Later we will develop a system to easily enter
> lab mapping by individual office.

### Assistant

Built it. Seven decisions went to `docs/BUILD-PLAN.md` as **D60–D66**.

**Schema** (appended to `prisma/schema.prisma`, `db push`ed):

| Model | Rows seeded | Holds |
|---|---|---|
| `SubProduct` | 104 | the variant beneath a mandatory product; standard as printed, turnaround |
| `TestParameter` | 713 | **fee + method + discipline**; limit only when childless |
| `TestSubParameter` | 1,640 | the result-bearing line, and **its** limit |
| `TestMethod` | 53 | shared — a method is a document, and nothing about it varies by sub-product |
| `Lab` | 46 | points at the OrgUnit that *is* the lab |
| `LabCapability` | 713 | sparse ground truth: what a lab can actually run |
| `LabRouting` | 16,399 | the 2D map, 23 offices × 713 parameters |

Enums added: `LabDiscipline`, `LimitKind`, `LabRoutingMode`.

**`utils/textile-parameter-list-sanitized.xlsx` is now the import source**, read by
`prisma/import/xlsx-grid.ts` (merge resolution) and
`prisma/import/test-parameters.ts`. `npm run import:test-parameters [-- --dry]`
and `npm run seed:labs [-- --dry]`; both idempotent, verified by running twice
and getting identical counts with 0 rows rewritten.

**Everything reconciles with the session-1 analysis**, which is the point of
having done that analysis first:

| | Session 1 (from the sheet) | Imported |
|---|---|---|
| Data rows | 1,929 | 1,929 |
| Packages / sub-products | 104 | 104 |
| Parameters | — | 713 |
| Sub-parameters | 1,640 | 1,640 |
| Limit kinds | rule 1,685 · declared 224 · cross_ref 10 · unspecified 10 | identical |
| Textile subtotal range | ৳494 – ৳9,464 | identical |

Verified after seeding: no parameter holds both its own limit and
sub-parameters; every childless parameter holds a limit unless the source left
it blank (exactly the 10 known *Silk Fabrics » Material (Purity of silk fibers)*
rows); **every routing row points at a lab that holds the capability**; all
16,399 routing rows carry `isPlaceholder`.

**Two data problems found in the source and handled, not silently smoothed:**

1. **`BDS 949` and `BDS 949:` are the same method typed two ways.** Left alone
   they became two `TestMethod` rows, which would have split one procedure's
   capability in half — a lab able to run it would appear able to run only some
   of it. The importer strips trailing punctuation from a designation, and a
   slug shared by two designations is now a **parse-time report** rather than a
   crash halfway through writing. 54 designations → 53 methods.
2. **`SubProduct.slug` built as `productName--subName` collided.** #246's name is
   69 characters, so truncating at 120 cut off the half that distinguishes one
   sub-product from the next. The slug is now `p{serial}-{subName}` — 104 keys,
   zero collisions, asserted before any write.

**`prisma/data/mandatory-315.json` #252 fixed.** It held
`Colour Fastness Ratings of Textiles ( ট টাইল পে র রং এর ািয়ে র মা া িনিদ করণ)` —
`pdftotext` mangling Bengali conjuncts. Now the English name alone, per the
user. It was the only one of the 315 affected. `npm run import:products`
reported `products refreshed: 1`.

**Labs came from the organogram, none invented.** 46 = 8 head-office sections
(the two `*-exec` units are wing offices, not laboratories, and are excluded)
+ 38 branch labs matched to offices by city. The only alias needed was
**Barisal → Barishal**: the organogram spells it one way and the office register
the other. Zero unmatched.

**What the seeded map does and does not claim.** Every office routes every
textile parameter to the head-office Textile section, `isPlaceholder: true`,
with a note saying so — the same discipline as the seeded bank branch details.
`SECTION_FOR_SOURCE` in `prisma/seed-labs.ts` is the one place a new wing's file
is bound to its head-office section, and the seed **refuses to write** if a
parameter arrives from a section not listed there.

### Resume point after the schema and seed

**State at the end of session 2.** The catalogue and the routing map are built,
seeded and verified. `npx tsc --noEmit` clean. Nothing committed yet.

**Next, in rough order:**

1. **The lab-mapping module** — the office × parameter grid each office edits.
   The resolver must require that a nominated destination holds the capability
   (D64); that is the whole reason capability and routing are separate tables.
2. **The other wings' files** as they arrive. Add a `SOURCE` block and a
   `SECTION_FOR_SOURCE` entry; the importer merges into existing sub-products
   rather than duplicating them (D62). Worth re-checking the fee subtotals then,
   because that is when a grand total first spans two labs.
3. **The direct-testing track** — the user has said this is still to be
   discussed, and it turns on whether a CM application can have its parameter
   list trimmed (still open).

**Still unanswered:** whether a CM application always takes the whole package;
turnaround for a partial selection (recorded per package, not per parameter);
who assembles a report when results land from several labs; and whether one
failed parameter fails the licence. From session 1, the BDS 1221 edition
question (2011 in the file, 2021 in the published list) is still open and is now
visible in the data as `SubProduct.standardAsPrinted`.

---

## Session 2 (continued) — blinding the sample between CM and the labs

### User

> So now the textile applications are processible at the lab. we need to add some
> more features in this application flow. The idea is to put a layer in between
> CM wing and chemical testing wing so that a FDO doesnt know which officers are
> handling the sample to test. And officers in the lab should not know which FDO
> has processed this file. The sample is collected through onestop service. So we
> can make something here. I have an idea but cannot map it properly. Lets head
> yours. What can we do?

### Assistant — the proposal, not yet agreed

**Where it fits.** The CM spec §5.2 stops at step 21 `SAMPLE_RECEIVED` → "Phase
5, TBD". This fills that gap, and the counter is already the right place: the
spec's own design note says the One Stop Officer's only write action is
*received / not received*.

**The idea in one line: the sample changes identity at the counter.** Upstream
of the one-stop it is an *application*; downstream it is a *test order* with a
code and nothing else. The two are linked in exactly one table, **which no
person reads in the normal flow** — the temptation is to make the one-stop
officer the human who knows both sides, but that only moves the leak to a desk
and creates a person worth bribing. It also keeps the spec's principle that the
officer gains no discretion: the code is assigned by the system, not chosen.

| The lab sees | The lab never sees |
|---|---|
| the lab code | application number, applicant, company, factory |
| sub-product, and the parameters to test | brand, SKU, packaging artwork |
| sample count, seal numbers, condition on receipt | the FDO, the sampling report, inspection notes |
| normal or urgent, and the due date | the receiving office (open question) |

| The CM side sees | The CM side never sees |
|---|---|
| which lab holds it, and since when | which examiner holds it |
| stage, due date, overdue flag | the lab's internal hand-offs |
| the signed result when it lands | the bench officer's name (open question) |

**The leak in the code we already have.** `Application.holderEmployeeId` +
`ApplicationMovement` are generic on purpose (D58/D59) — so if the sample
travels as the *same* work item, the lab officers become holders of the
application and the FDO can read their names straight off the stage tracker.
D58's design becomes the leak. The lab leg therefore needs its **own** work item
and its own movement chain:

```
Application  ──holder: CM officers──►  ApplicationMovement      (CM side)
      │
      ├─ Sample (sealed by FDO, per destination lab)
      │
   ═══╪═══ the cut: SampleRegistration ═══════════════════════
      │
LabTestOrder ──holder: lab officers──►  LabTestOrderMovement    (lab side)
```

`LabTestOrder` carries **no `applicationId` column at all** — not hidden in the
UI, absent from the table. That is what makes the barrier structural rather than
a permission check somebody forgets on one screen.

**Sketch:**

| Model | Holds |
|---|---|
| `Sample` | sealed by the FDO — seal no., count, destination lab, condition |
| `SampleRegistration` | **the cut.** applicationId ↔ labCode. Written at the counter, read by the system only |
| `LabTestOrder` | labCode, subProductId, urgency, dueDate, labId, holderEmployeeId |
| `LabTestOrderItem` | one per `TestParameter` to test |
| `TestResult` | per item: observed value, verdict, examiner |
| `CustodyEvent` | every hand-off, both sides of the cut |
| `Reidentification` | audit: who deliberately linked the two, when, why |

- **A different code per lab, not per sample.** The Chittagong example split four
  ways; one shared code would let two labs compare notes and reconstruct the
  full parameter set, which with the sub-product narrows the applicant fast. The
  FDO already seals per destination, so per-lab codes cost nothing.
- **The code carries no meaning** — no office, no date, no sequence. Random
  Crockford base32 so it survives being written on a jar (`7Q4M-2R8K`), with a
  check character. A sequential code tells the lab how many samples that office
  sent this month, most of the way to identifying a small office's only
  applicant.
- **The normal path never requires a human to see both sides.** Results come
  back keyed to the code and the system re-links. Manual re-identification is
  for disputes only, and is audited.

**What this can and cannot buy** — stated so the controls match the real threat:

- *Achievable*: the examiner cannot look up the applicant, the FDO cannot look
  up the examiner, neither by accident, and a deliberate attempt is logged.
- *Partial*: a sample tested at its own office's lab is in the same building as
  the FDO. Software cannot blind a corridor.
- *Not achievable*: if one company in Bangladesh makes a product, the
  sub-product identifies them. Same if a lab handles four samples a month.
- *Temporary by design*: the report is a legal document, the certificate names
  the applicant, and a dispute needs the link. This is **pseudonymisation during
  testing**, not anonymity — the link must never be destroyed, only guarded.

**The physical half matters as much as the software.** The applicant carries the
sealed sample to the counter themselves (§5.2 phase 4), so branded packaging
walks in with it. The one-stop must over-label with the code before dispatch,
and the system should require that as an explicit confirmation rather than
assume it. A perfect schema is undone by a brand name on a jar.

**Five questions put to the user, all unanswered:**

1. Does the blinding survive the result? A signed report needs a responsible
   signatory — blind the *bench examiner* and let the report carry the lab's
   authorising officer, or must even that be hidden (report signed by the lab as
   an office)?
2. Does the lab need to know the receiving office? They need somewhere to return
   results, but "return to One Stop" works and the office name is the single
   biggest re-identification hint.
3. Who may deliberately break the link — one-stop in-charge, wing director,
   superadmin only?
4. What is the actual threat — collusion between applicant and lab, or an
   impartiality requirement (ISO/IEC 17025)? The first needs hard controls; the
   second mostly needs a documented, auditable procedure.
5. Direct testing has no FDO — the customer hands the sample straight to the
   counter. Same blinding, or is that track open?

### Also this session — the organogram sat under the sidebar

Unrelated to testing fees, recorded because it changed a layout rule now in
CLAUDE.md. `/hr/organogram` and `/hr/organogram/manage` are full-bleed screens,
and at `min-[1920px]` — where the sidebar is docked rather than a drawer — their
left 240px rendered underneath it. Every `PageContainer` screen clears the
sidebar *by accident*, because its 1440px box leaves a gutter exactly the
sidebar's width; a full-bleed screen has no gutter.

The clearance cannot go on `<main>`: padding it would shift `PageContainer`'s
centred box right by half the sidebar's width and break the navbar alignment the
out-of-flow sidebar exists to preserve. So it lives once in
`components/FullBleedContainer.tsx`. The organogram's `loading.tsx` was also
using `PageContainer` while its page was full-bleed, so the chart jumped
sideways on load — it now uses the same container as its page.

Not verified in a browser at ≥1920px. Other full-bleed screens (`hr/page.tsx`,
`hr/profile`, `hr/approvals`, `listing/new`, `listing/[id]/*`) very likely have
the same bug and were left alone as out of scope.

## Resume point after session 2

**State.** Catalogue and routing map built, seeded and verified; the blinding
layer is proposed but **nothing about it is built or agreed**. `npx tsc
--noEmit` clean. Committed and pushed.

**The three pieces named for the next session:**

1. **Parameter setup** — the screens to view and edit the catalogue, and the
   next wings' files as they arrive (a `SOURCE` block + a `SECTION_FOR_SOURCE`
   entry). Re-check the fee subtotals then: that is when a grand total first
   spans two labs, and D62 gets its first real test.
2. **Lab mapping** — the office × parameter grid each office edits. The resolver
   must require that a nominated destination holds the capability (D64); that is
   the entire reason capability and routing are separate tables. All 16,399
   seeded rows are `isPlaceholder` and the module is what clears them.
3. **Sample encoding between CM and Testing** — the proposal above. **Start by
   answering the five questions**, because #1 and #4 change how much of it is
   worth building. Then D-numbers, then the models.

**`utils/lab-format-setup.xlsx` — placed by the user at the end of this
session, not discussed.** Three sheets: `Chemical` and `Physical` in the same
12-column format as the textile file, and `labCodes` (Lab type · Lab name ·
Code, codes blank) listing the eight head-office sections.

Worth reading closely before building anything, because the two parameter sheets
are a **worked example of the D62 merge case**: the same main product "A" and
sub-product "A1" appear in both, with different parameters (x1–x5 vs its own set)
and different fees (10–14 physical, 20–24 chemical). That is the shape the
importer already handles — `(productId, nameEn)` on `SubProduct` merges rather
than duplicating — so this file is the first chance to prove it rather than
assert it, and the first case where a grand total spans two labs.

The `labCodes` sheet is unexplained. It could be a short code per lab section
for the file format, or it could be for the sample-encoding work — the two are
very different things and it should not be guessed at. **Ask.**

**Older open questions, still unanswered:** whether a CM application always
takes the whole parameter package or an officer may trim it (this decides
whether direct testing and CM share one table); turnaround for a partial
selection (recorded per package, not per parameter); who assembles a report when
results land from several labs at different times; whether one failed parameter
fails the licence; and the BDS 1221 edition question from session 1 — 2011 in
the file, 2021 in the published list, now visible in the data as
`SubProduct.standardAsPrinted`.

---

## Session 3 — 2026-09-04 (Linux machine)

The sample-encoding design was settled and built. `lab-format-setup.xlsx` was
read first; the flow, the blinding scheme and the application restructure were
worked out with the client across several exchanges, then implemented.

### What `lab-format-setup.xlsx` turned out to be

Three sheets. `Chemical` and `Physical` are the same 12-column parameter format
as the textile file for one product **A** with sub-products **A1/A2/A3** —
placeholder data, real structure. **Columns M–R are the 2D map embedded in the
parameter sheet**: one column per office, each cell a lab code decoded by the
third sheet (office Dhaka 1 · Gazipur 2 · Narayanganj 3 · Barisal 4 · Khulna 5 ·
Chittagong 6; lab Physical P · Chemical C). `4C` = Barisal Chemical.

**It confirms D62 exactly.** All six subtotals reconcile and the grand total is
the sum across labs: A1 = 161 + 91 = **252**, A2 = 244 + 189 = **433**,
A3 = 266 + 236 = **502**. Durations agree between sheets per sub-product, so
turnaround belongs to the sub-product and not to each lab.

**It also settles that routing needs parameter-level granularity** — the thing
that was least certain. Chemical A1: Barisal keeps x1–x4 (`4C`) and sends x5–x7
to Dhaka (`1C`). An office-level referral default would be wrong.

Derived from the map for an application received at Barisal, against the
client's hand-worked list:

| | derived | client said |
|---|---|---|
| A1-physical | 1P, 4P, 5P | 3 offices ✓ |
| A2-physical | 1P, 4P | Barisal + Dhaka ✓ |
| A3-physical | 1P | Dhaka ✓ |
| A1-chemical | 1C, 4C | 2 offices ✓ |
| A2-chemical | 1C, 4C | 2 offices ✓ |
| A3-chemical | **4C — Barisal** | *Dhaka* — **disagrees** |

And **5 boxes, not 6**: Khulna-chemical is never a destination, so the sixth
would have been empty. Both slips are the kind that disappear once the box list
is generated rather than typed — which is now what happens.

**Three findings the file produced, all acted on:**

1. **The columns are swapped.** The textile file is `H = Method, I = Test Fee`;
   this one is `H = Test Fee, I = Method`. The importer has them hardcoded, so a
   second file in this shape would import methods as fees. **Not yet fixed** —
   see the resume note.
2. **The lab code names an office + discipline, not a section.** `1P` is "Dhaka
   Physical", but head office has four physical sections. Our `Lab` is one row
   per organogram unit, so `LabRouting.labId` points at a section while the file
   points at a wing. For textile data everything routes to `lab-pt-textile` so it
   collapses and nothing is wrong today. Left open deliberately.
3. **The same parameter name appears in both sheets for one sub-product** (x1…x7
   in Chemical A1 and Physical A1), which `@@unique([subProductId, nameEn])`
   would silently overwrite. Almost certainly lazy placeholder naming — the same
   name routes to `1C` on one sheet and `1P` on the other, and one parameter
   would have one destination — but unconfirmed, and it decides whether the key
   must become `(subProductId, discipline, nameEn)`.

### The design, as settled

**The flow.** Applicant picks product → sub-products → variants under each.
Submitted on factory location. FDO inspects, may add sub-products and variants,
phones the labs for sample counts, seals jars, packs one box per destination
lab. Report approved → letters generated → applicant pays the test fee → carries
each sealed box to **that destination office's own one-stop counter** → counter
checks payment and seal and marks received → lab opens and validates.

**The client's salting idea, and why it was dropped.** The proposal was for the
FDO to see an unsalted token and the examiner a salted one, under a daily
rotating superadmin key. It cannot work: **the code is printed on a physical
object the examiner is holding**, so whatever is on the label is what they read,
and flipping which one is printed only moves the problem to the FDO. Two further
problems if it were wanted anyway — a hash is one-way so the mapping is stored
regardless, making the hash do no work; and daily rotation either changes the
code mid-test or forces every old salt to be kept for ever, since a sample lives
for weeks.

**What replaced it keeps the client's structure** — two audiences, two
identifiers — and adds a third that is the only one printed (D68). The QR became
a URL requiring a session, as the client asked, with the correction that
**a QR decodes without a session**: login gates the page, not the string. Hence
the printed token belongs to neither side.

**Where a rotating key does belong:** the link, not the code. Encrypting
`SampleRegistration`'s application reference under a key held outside the
application database gives the client the "highly secured rotatable secret" they
wanted, pointed at the thing that needs it. **Not built** — noted for later.

**The leak found in the client's own flow.** Letters go to the office head, the
one-stop *and* the applicant, who prints them. That letter names the applicant
and probably the FDO. So there must be **two documents**: a submission letter
(applicant, application no., which bags to bring, QR for the counter) and a
consignment note that travels with the box (consignment code, seal no., specimen
codes, sub-product, parameters — no applicant, no FDO, no application number).
Nothing else may travel in the box.

**The leak the client had not hit: the variant is the brand.** The lab must tell
specimen 1 from specimen 2 and needs test-relevant attributes — the diaper case
has size carrying different limits — but the brand identifies the company. So
the cut passes size and grade and withholds brand, flavour name, artwork and
company.

**Client decisions, taken and not revisited:** the applicant travels to every
destination office (the burden was raised and reaffirmed); the one-stop may not
open boxes, only labs may, and a failed validation goes lab → one-stop →
applicant, which keeps the cut intact on the error path.

### What was built

Schema, `db push`ed: `ApplicationSubProduct`, `SampleRequirement`,
`LabSampleRequirement`, `Consignment`, `Sample`, `SampleRegistration`,
`LabTestOrder`, `LabTestOrderItem`, `TestResult`, `CustodyEvent`,
`Reidentification`; enums `DeclaredBy`, `SampleState`, `ConsignmentState`,
`LabTestOrderState`, `TestVerdict`, `RequirementSource`, plus
`ApplicationState.sample_partially_received`.

Code: `lib/samples/codes.ts` and `plan.ts` (Prisma-free), `service.ts`,
`resolve.ts`, `lib/cm/sub-products.ts`, `app/s/[ref]/` with its layout, and the
`ApplicationSku` refactor across six files.

**Verified end to end on real catalogue data**, twice — once on a single-lab
sub-product and once with routing deliberately split across two labs in two
offices, then restored:

- check characters catch a corrupted code; `O`/`L` normalise to `0`/`1`
- the plan starts with every cell unknown and yields no total until all are
  answered; `10 = Σ per-variant × variants`; one box per destination lab
- lab defaults are remembered from the FDO's entry
- `ref`, `cmCode` and `labCode` are all different
- **`Sample` and `LabTestOrder` have no application column** — asserted against
  the generated client's own keys, not by inspection
- a box handed in at the wrong office is refused; a broken seal is refused
- `sample_partially_received` after box 1 of 2, `sample_received` after the last
- the lab view contains **no brand name and no application number**
- an unrelated officer gets `not_found`, not a distinguishable 403
- superadmin gets the CM view

**A real hole found while verifying and fixed.** Deleting a variant cascaded the
registration away but left the specimen behind — a sealed jar with nothing
saying whose it is. `removeSubProduct` already guarded this; `removeSku` did
not. Both now refuse once specimens exist.

### Resume here

**State.** Typecheck clean, database clean (catalogue and routing map unchanged:
104 / 713 / 1,640 / 53 / 46 / 713 / 16,399, all routing still `isPlaceholder`).
Committed and pushed.

**Built: the data model and the services. Not built: the screens.** Three are
needed before anyone can use this —

1. **The FDO's sampling screen** — the derived grid, one number per cell, the
   running total, and the seal/label step. `buildPlanFor()` and
   `setRequirement()` are ready for it.
2. **The one-stop counter** — scan the letter QR, check payment (read-only,
   never writable — spec §5.2), check the seal, `submitConsignment()`.
3. **The lab bench** — `openConsignment()`, then result entry against
   `LabTestOrderItem` × specimen.

**Also outstanding:**

- **Resolve importer columns by header text, not position.** The two files
  already disagree on H/I, and a second file would import methods as fees.
- **Two documents, not one** — the submission letter and the consignment note.
  Neither exists yet; the design says what each may carry.
- **Encrypt the link at rest** under an externally-held key, as the client's
  rotating-secret idea correctly wanted.
- The three `lab-format-setup.xlsx` questions: A3-chemical Dhaka or Barisal;
  whether routing should target office+discipline rather than a section; and
  whether one parameter name may appear under two labs for one sub-product.
- From earlier: whether a CM application may have its parameter list trimmed;
  turnaround for a partial selection; who assembles a report across labs;
  whether one failed parameter fails the licence; and BDS 1221's edition.
