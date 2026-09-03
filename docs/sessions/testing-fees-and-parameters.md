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

## Resume here

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
