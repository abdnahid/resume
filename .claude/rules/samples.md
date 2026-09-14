---
description: "Samples and the cut between CM and the labs — the three identifiers, the sampling plan, and custody"
paths:
  - "lib/samples/**"
  - "app/s/**"
  - "lib/cm/**"
---

## Samples, and the cut between CM and the labs

Decisions D67–D73. `lib/samples/` holds it — `codes.ts` and `plan.ts` are
Prisma-free (D9), `service.ts` and `resolve.ts` are the server half.

**The application grew a level** (D67):

```
Application → ApplicationSubProduct  → ApplicationSku   the variants
                (what is applied for)
```

The applicant picks the product from the 315, then the sub-products beneath it,
then names the variants under each. `ApplicationSku.applicationId` is gone — an
article belongs to the sub-product it varies. Both rows carry `declaredBy`: the
FDO amends at inspection (he found A2 on the floor) and the applicant's
declaration is never overwritten, because "did they under-declare, or did we
find more" is asked in disputes.

**Choosing the sub-product is what lets a test fee be quoted before
inspection.** `testFeeFor()` in `lib/cm/sub-products.ts` is the one place it is
computed, provisional and final alike, so the two figures cannot diverge. It
returns **both** the normal and the urgent total (D134); `totalPoisha` is
whichever basis the file is on, and `Application.isUrgent` is set when the
letters go out. Never double the normal figure to get the urgent one — a test
that cannot be hurried carries the same fee in both columns.

### Three identifiers, and only one is printed

**A QR is an encoded string — any phone decodes it without a session.** So
whatever is printed on a jar is readable by the FDO who binds the label *and*
the examiner who opens the box. Printing either side's working code hands it to
the other. Hence three (D68):

| token | printed | who works with it |
|---|---|---|
| `ref` | **yes** | nobody — it only resolves at `/s/<ref>` |
| `cmCode` | no | the FDO and CM staff on that file |
| `labCode` | no | the examiner and testing-wing staff |

**`labCode` is not derived from `cmCode`.** A hash needs the mapping stored
anyway, and a rotating salt would either change the code mid-test or force every
old salt to be kept for ever — a sample lives for weeks and its identifiers must
not move. The key worth rotating protects the *link*, not the code.

Codes are Crockford base32 with a check character, so a code read off a jar
cannot be transcribed into somebody else's specimen. `ref` is 128-bit: it
travels through several hands and is treated as public.

### Where the cut actually is

- **`Sample` and `LabTestOrder` carry no application column at all** (D70) — not
  hidden in the UI, absent from the table. The two sides meet only in
  `SampleRegistration`, which nothing lab-facing reads.
- **It is not an absolute barrier and must not be described as one.** One
  database means any link is a join away for whoever writes the join. What the
  shape buys is that the *accident* cannot happen and the *deliberate* act is
  visible — every crossing goes to `Reidentification`.
- **`/s/<ref>` answers by role *and* relationship** (D71). A CM officer in Dhaka
  has no standing on a Barisal file; an examiner has none on another lab's
  bench. **A refusal is identical whether the token exists or not** — a distinct
  403 would let anyone with a photographed label learn which codes are live.
  `/s` is in `INTERNAL_PREFIXES` *and* its layout calls `requireInternal()`.
- The lab view shows the sub-product, the specimen number, and **only this
  lab's** parameters. Never the brand — the variant *is* the applicant's
  identity. Test-relevant attributes (size, grade) pass; brand and company do
  not.

### The sampling plan

- **Destinations are derived, counts are entered** (D69). `resolveDestinations()`
  reads `LabRouting`, so the FDO cannot forget a lab or prepare a box nobody
  needs. **A routing row naming a lab without the matching capability is
  refused, not followed** — that is what the two tables are for (D64).
- **The count is his**, because it depends on sample quantity and destructive
  testing, which is A§1.2 data nobody has collected. He phones the lab and types
  it; `LabSampleRequirement` remembers it, so the next application arrives
  pre-filled and the calls stop by themselves. The lab owns and corrects its own
  rows, exactly like `LabCapability`.
- `commitSampling()` is one transaction — test orders, specimens and boxes
  together, because a half-written plan is a box of jars nobody can account for.
  It refuses rather than regenerating if consignments already exist.

### Custody

- **One box per destination lab, sealed by the FDO, opened only by the lab**
  (D72). The applicant carries them to each destination office's own counter, so
  the samples are in their own custody between factory and counter: the seal is
  the only control, and a broken one is a **refusal**, not a note. A short
  consignment therefore surfaces at the lab, days later and possibly in another
  city — which is why the submission letter must list seal numbers.
- **`sample_received` is the last box, not the first** (D73);
  `sample_partially_received` covers the rest. Receipt is several events with
  several dates, and testing at one lab starts independently of another.
- **Removing a variant or sub-product is refused once specimens exist.**
  Otherwise sealed jars in the applicant's custody lose the row that says whose
  they are.
- **[NOT BUILT] The field officer will select which parameters are tested**
  (D101, decided 2026-09-07). Today every parameter of an applied sub-product is
  tested and charged — `testFeeFor()` and `resolveDestinations()` both take the
  whole set — and any code written before D101 lands should keep assuming that.
  When it is built: **exclusion rows with a required reason**, not a selection,
  because the default is "everything the standard requires" and the deviation is
  the fact worth storing (the `notInProductionAt` discipline, D91); locked once
  the jars are sealed; printed on the inspection report so the approver sees it;
  and filtered in `resolveDestinations()`, which is the single place a
  sub-product's parameters are gathered. **Not the applicant's choice** — nobody
  should pick which tests their own licence rests on.

