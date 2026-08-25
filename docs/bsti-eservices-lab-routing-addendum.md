# BSTI e-Services — Addendum A: Test Plan Resolution, Sample Logistics & Lab Pipeline

**Companion to:** `bsti-eservices-cm-module-plan.md` (same folder)
**Replaces:** §9 "What is NOT yet specified" of the main plan (Phase 5 onward is now specified)
**Status:** Draft v0.1

---

## A0. The one idea this whole addendum rests on

The main plan modelled an application as having **one status** and **one sample**. Both are now wrong.

After the inspection report is approved, a single application becomes:

- **N parameters**, each with its own capable facility
- **M physical samples**, each with its own barcode, destination and custody chain
- **K one-stop offices** receiving samples independently and at different times
- **J laboratory pipelines** running in parallel, finishing at different times
- **J test reports**, compiled by the system into one consolidated report

So the application status stops being a scalar and becomes a **derived rollup** over child records. Every dashboard, every SMS, every status badge must be computed from the children, never stored on the parent.

If this is built as "one status column plus some extra tables," it will produce applications that show `SAMPLE_RECEIVED` while two of five samples are still in the client's car. Build the rollup first.

---

## A1. Reference data — the foundation

Three seeded tables carry this entire feature. They are also the largest data-entry effort in the project, and none of it is software work. Start collecting now, in parallel with development.

### A1.1 `test_parameter`

The parameter catalogue, derived from each BDS.

```
test_parameter
  id
  product_id
  applies_when          expression over variant attributes
                        e.g. cement_type = 'CEM I'
                             strength_class IN ('42.5R','52.5N','52.5R')
  parameter_name        e.g. "Sulfate content (as SO3)"
  discipline            CHEMICAL | PHYSICAL_CIVIL | PHYSICAL_MECHANICAL
                        | ELECTRICAL | TEXTILE | MICROBIOLOGICAL
  test_method           e.g. EN 196-2
  limit_expression      e.g. "<= 4.0 %"
  is_mandatory          some parameters are declared, not pass/fail
  standard_turnaround_days
  bds_id, bds_clause
```

`applies_when` is not optional sophistication. Cement alone requires it: loss on ignition applies to CEM I but not CEM II; the SO₃ limit changes with strength class; the 2-day strength test does not exist for class 32.5 N. A flat product→parameter list breaks on the first cement application.

### A1.2 `sample_requirement`

How much physical material each parameter needs. This drives the barcode count.

```
sample_requirement
  id
  test_parameter_id
  quantity, unit
  container_type
  preservation          NONE | REFRIGERATED | DARK | AIRTIGHT ...
  is_destructive
  can_share_with_parameter_ids   parameters testable from the same portion
```

`can_share_with_parameter_ids` is what stops the system from demanding eleven separate cement samples when three would do.

### A1.3 `facility` and `facility_capability`

```
facility
  id
  type              BSTI_LAB | THIRD_PARTY_LAB
  office_id         FK office (null for third party)
  name, address, district, division, geo
  one_stop_office_id     where samples for this facility are handed in
  is_active

facility_capability
  facility_id
  test_parameter_id       (or parameter+method pair)
  method
  accreditation_body, accreditation_scope_ref, accredited_until
  typical_turnaround_days
  current_queue_depth     maintained by the system, not entered
  cost_per_test           relevant for third-party labs
  is_active
```

Two hard rules:

- **Never resolve a parameter to a facility whose accreditation has expired.** The check happens at resolution time and must be re-checked at dispatch. An expired-scope result is worse than no result — it is a challengeable certificate.
- `one_stop_office_id` is deliberately separate from `facility_id`. A third-party lab in Bogura does not take client walk-ins; its samples are received at the Rangpur one-stop and forwarded under BSTI custody.

---

## A2. Test Plan Resolution

### A2.1 When it runs

Resolution runs when the FDO builds the inspection plan. **Barcodes are generated only
after that plan is approved up the channel (AD → DD → Director / Office Head).**

Sequence:

```
FDO builds inspection plan (date + team)
  → system resolves test plan, computes sample set, shows counts to FDO
  → plan ascends AD → DD → Director / Office Head
  → APPROVED
  → test plan FROZEN + barcodes generated
  → FDO prints labels and travels to the factory
```

Nothing physical is printed before approval, which removes the worst failure mode:
labels committed to the field for an inspection that was never authorised, or a
sample set the Director revised on the way up.

Because approval-to-printing is now minutes rather than weeks, the revalidation
window is small — but it is not zero:

- The resolved plan is **frozen and versioned** at approval.
- `revalidate()` runs at barcode generation and again at first sample receipt.
- If revalidation changes a destination **after labels are printed**, that is a
  supervisor exception, never a silent re-route. Physical labels on sealed tins
  are already committed.
- If the Director **rejects or revises** the plan, the resolution is discarded and
  recomputed on the next submission. No barcodes exist yet, so there is nothing
  to retire.

### A2.2 The algorithm

Input: application → product + variant list → applicable parameters (via `applies_when`).

For each parameter, gather capable facilities, then rank:

| Tier | Rule |
|---|---|
| 1 | The applying office's own lab |
| 2 | Nearest BSTI lab — same division first, then by road distance |
| 3 | Head office (Dhaka) lab |
| 4 | Accredited third-party lab, nearest first |

Tie-breakers, in order: valid accreditation → shortest total turnaround → lowest queue depth → lowest cost.

**Record the decision, not just the outcome:**

```
test_plan_item
  id, test_plan_id
  test_parameter_id
  resolved_facility_id
  resolution_tier            1..4
  resolution_reason          human-readable, generated
  rejected_alternatives      JSON — which facilities were skipped and why
  resolved_at, resolved_by   SYSTEM | officer override
```

`rejected_alternatives` looks like over-engineering until the first client asks why they must travel to Dhaka for one parameter, or the first audit asks why a third-party lab was chosen over a BSTI one. Then it is the only defensible answer available.

**Manual override** must exist (FDO or office head), must require a reason, and must be logged. Reality will produce cases the ranking gets wrong.

### A2.3 Worked example — cement at Rangpur

11 parameters: 5 physical, 6 chemical.

| Parameter | Discipline | Resolved to | Tier |
|---|---|---|---|
| Compressive strength 2-day | Physical (Civil) | Rangpur | 1 |
| Compressive strength 28-day | Physical (Civil) | Rangpur | 1 |
| Initial setting time | Physical (Civil) | Rajshahi | 2 |
| Soundness (Le Chatelier) | Physical (Civil) | Dhaka | 3 |
| Fineness | Physical (Civil) | 3rd-party, Bogura | 4 |
| Loss on ignition | Chemical | Rangpur | 1 |
| Insoluble residue | Chemical | Rangpur | 1 |
| Sulfate (SO₃) | Chemical | Rajshahi | 2 |
| Chloride | Chemical | Dhaka | 3 |
| ... | ... | ... | ... |

Grouped by **destination facility**, then by **shareable sample portion**, this yields the sample set — for example 5 or 6 barcoded units, not 11. The count comes out of `sample_requirement`, never from a hardcoded number.

---

## A3. Barcodes & sealing

### A3.1 Generation

Triggered by **approval of the inspection plan** (AD → DD → Director / Office Head), not by
plan creation. Output: a printable label sheet for the FDO.

```
sample
  id
  barcode              opaque unique ID — the only thing encoded
  human_readable_ref   e.g. RNG-2026-000412-S3  (printed under the barcode)
  application_id, inspection_id
  destination_facility_id
  submission_one_stop_id
  test_plan_item_ids   the parameters this sample serves
  required_quantity, container_type, preservation
  variant_id           which brand/size/grade this sample represents
  status               see A4
  seal_number, sealed_by, sealed_at, geo
```

Design rules:

- **The barcode encodes an ID and nothing else.** No product name, no company name, no parameter list. Labels get photographed, and a barcode carrying data is a data leak and an integrity risk. Everything resolves server-side on scan.
- Print the human-readable reference under the barcode. Scanners fail; handwriting on a dusty cement bag does not.
- Print the destination office **on the label in Bangla**, because the client is the one carrying it.
- Generate a small overage of blank spare labels — a torn or unreadable label at a factory gate should not sink the inspection. Spares are pre-registered as `VOID` until activated by scan.

### A3.2 Multi-variant sampling

One application covers multiple brands/sizes/grades. The variant dimension multiplies samples: cement in two strength classes = two full sample sets, because the parameter sets themselves differ by class.

**RESOLVED: BSTI seals samples for every declared brand, variant and size.** There is no
representative-subset shortcut. So:

```
sample_count = Σ over variants ( samples needed for that variant's parameter set )
```

Consequences to design for deliberately:

- An application with 8 brands × 3 sizes is 24 variants. Even at 5 samples each that is
  120 barcoded units from one inspection. The label sheet, the FDO's offline app, the
  one-stop receive screen and the client instruction sheet must all stay usable at that
  volume — assume hundreds, not dozens.
- The test fee scales with variants, so the client sees cost rise directly with how many
  brands they declare. Show the sample count and fee estimate **in the application wizard,
  before submission**, so this is never a surprise after inspection.
- Every sample carries `variant_id`. Results, verdicts and re-inspection scope are all
  per-variant (see A8.1) — a failure in one brand must not invalidate the others.
- One-stop receive screens must group by variant, not present a flat list of 120 scans.

### A3.3 Offline requirement

The FDO scans and confirms sealing at the factory, where connectivity is unreliable. The mobile app must:

- hold the pre-generated sample list offline
- record scan, seal number, quantity, photo, GPS, timestamp offline
- sync on return, with conflict detection

Barcodes are pre-generated precisely so this works offline. Do not add any step at the factory that requires a live server call.

---

## A4. Sample lifecycle (per sample, not per application)

```
PLANNED
  → LABEL_PRINTED
  → SEALED_AT_PREMISES        (FDO, offline-capable)
  → AWAITING_SUBMISSION       (with client, after fee demand)
  → RECEIVED_AT_ONE_STOP      (one-stop scan)
  → IN_TRANSIT_TO_FACILITY    (only if facility ≠ receiving office)
  → RECEIVED_AT_FACILITY
  → IN_TESTING
  → RESULT_RECORDED
  → REPORT_APPROVED
```

Exception states: `SEAL_BROKEN`, `QUANTITY_INSUFFICIENT`, `LABEL_UNREADABLE`, `LOST_IN_TRANSIT`, `EXPIRED` (perishables), `VOID`.

Any exception state must notify the FDO immediately and block the parent rollup — never let a broken-seal sample pass silently.

`[OPEN]` **Counterpart/retention samples.** If a result is disputed or a retest is needed, is there a retained duplicate? If yes it must be barcoded and tracked here too, roughly doubling label count. If no, every failure means a fresh factory visit. Decide now.

---

## A5. Multi-office intake

After inspection report approval (AD → DD → Director), the application appears simultaneously on **every one-stop dashboard that expects a sample**.

Each one-stop sees **only its own samples**. Rajshahi must not see, receive, or action Dhaka's samples.

One-stop receive screen:

1. Scan barcode
2. System shows: expected sample, expected quantity, expected seal number, paid status
3. Officer records: seal intact / broken / mismatch, quantity adequate, condition
4. Confirm receipt

Constraints carried forward from the main plan, unchanged: **payment status is read-only to the one-stop, and the officer's only write action is receipt.** With three offices now involved, this matters more, not less — a payment override at any one of them would break the control everywhere.

### A5.1 Client-side instruction

The client's dashboard must show a per-office breakdown, not a single line:

> **Test fee requested — ৳ X,XXX** [Pay now]
> Submit sealed samples:
> • Rangpur One Stop — 3 samples (RNG-…-S1, S2, S6) — *pending*
> • Rajshahi One Stop — 2 samples (S3, S8) — *received 24 Aug*
> • Dhaka One Stop — 1 sample (S4) — *pending*

With office address, map link, and hours for each. Printable as a single instruction sheet the client carries.

### A5.2 The question worth raising with CM Wing

As described, the client personally travels to Rangpur, Rajshahi **and** Dhaka. For a Rangpur cement plant that is roughly 600 km of travel to complete one application.

The alternative: **the client submits everything at their local one-stop, and BSTI moves samples between offices under its own custody.** Chain of custody arguably improves, since sealed samples stop riding around in client vehicles.

This is a policy decision, not a technical one — but the data model should support both from day one:

```
custody_transfer
  sample_id
  from_party        CLIENT | OFFICE | COURIER
  to_party
  from_facility_id, to_facility_id
  dispatched_at, dispatched_by
  received_at, received_by
  seal_check_result
  courier_ref
```

With `custody_transfer` present, switching from client-carries to BSTI-carries is a configuration change per office pair, not a rewrite. Build the table now even if the policy stays as-is.

---

## A6. Test fee

One demand, one payment, covering all parameters at all facilities. The client should never see three invoices.

```
test_fee_line
  application_id
  test_plan_item_id
  facility_id
  fee_type          BSTI_SCHEDULE | THIRD_PARTY_PASSTHROUGH
  amount
  revenue_office_id     which office books this income
```

Three open items, all financial rather than technical:

1. `[OPEN]` **Third-party lab charges** — does BSTI collect and pay the lab, or does the client pay the lab directly? The first keeps the client experience clean and makes BSTI liable for payment; the second is simpler for accounts and worse for everyone else. Recommend the first.
2. `[OPEN]` **Inter-office revenue attribution** — Rangpur takes the application, Dhaka does the work. Who books the income? The `revenue_office_id` field assumes per-line attribution; confirm that matches how BSTI accounts actually work.
3. `[OPEN]` **VAT treatment on third-party pass-through** — pass-through cost or BSTI service revenue? Affects the existing Income/VAT split.

---

## A7. Laboratory pipeline

On sample receipt confirmation, the application enters that office's internal channel:

- **Divisional / regional office:** Office Head → DD → AD → Examiner
- **Head office:** Wing Head (Physical or Chemical) → DD → AD → Examiner

This is the *same* file movement engine from §4.2 of the main plan, with one difference worth being explicit about: these are **parallel independent channels**, not a single file passing through three offices in sequence. Each has its own routing path snapshot, its own custody, its own SLA clock.

```
lab_job
  id
  application_id, facility_id
  test_plan_item_ids
  sample_ids
  routing_path            own snapshot
  current_holder_id
  status
  received_at, due_at
  examiner_id
  results                 → test_result[]
  report                  → lab_test_report
```

```
test_result
  lab_job_id
  test_plan_item_id
  observed_value, unit
  method_used
  tested_on               matters — 2-day and 28-day differ
  verdict                 PASS | FAIL | NOT_APPLICABLE | INCONCLUSIVE
  examiner_id
  instrument_id, calibration_ref
```

`instrument_id` + `calibration_ref` is a small addition with a large payoff: it links every result to the calibration status of the instrument that produced it. That is an accreditation requirement, and it is also the thread that connects this module to the Metrology Wing's calibration records — the first real cross-wing data link in the platform.

### A7.1 Long-running and staged tests

Cement 28-day strength means a lab job stays open for a month. Required behaviour:

- Results are recorded **as they land** (2-day, 7-day, 28-day are separate `test_result` rows on one job)
- SLA clocks are derived from `standard_turnaround_days`, not a flat target — otherwise every cement file shows as breached and the dashboards become noise
- `[OPEN]` **Early-fail policy:** if the 2-day strength fails, does testing stop, or does the 28-day run anyway? This affects both cost and timeline.

### A7.2 Report approval

`[OPEN]` Does the examiner's test report need AD/DD/office-head approval before it is released to compilation, or does the examiner's signature suffice? Assume approval up the same channel until told otherwise — but confirm, because it changes the timeline materially.

### A7.3 Third-party labs

Third-party labs are not BSTI officers and cannot sit inside the internal channel. Two workable options:

- **Limited external portal account** — the lab logs in, sees only its assigned jobs, uploads a signed report and enters results. Cleaner, needs onboarding for 8–10 labs.
- **Sponsoring office entry** — the nearest BSTI office receives the lab's signed report and keys it in, attaching the scan.

Recommend the portal, with the sponsoring office as fallback. Either way the signed original PDF must be attached and retained — the system's structured result is a convenience, the lab's signed report is the evidence.

---

## A8. Compilation, final review, certificate

```
ALL lab_jobs REPORT_APPROVED
  → system compiles consolidated_test_report
  → application returns to FDO
  → FDO reviews consolidated report
  → FDO assesses marking fee
  → MARKING_FEE_DEMANDED  →  client pays
  → certificate generated and released to client account
```

The consolidated report is **generated, never typed.** It assembles every `test_result` against every `test_plan_item`, showing observed value, limit, method, facility and verdict, with an overall conformity determination.

### A8.1 Failure handling — the re-inspection cycle

**RESOLVED:** a failed parameter does not reject the application. The FDO informs the
client to improve the product's quality; once improved, the client requests
**re-inspection on the same application**, and the cycle repeats.

This is the single most structurally significant answer in the whole spec, because it
means **the application is cyclic, not linear.** An application can carry several full
rounds of inspection → sealing → submission → testing → report before it terminates.

#### The cycle entity

Everything downstream of the inspection plan belongs to a numbered cycle:

```
inspection_cycle
  id
  application_id
  cycle_number            1, 2, 3 ...
  trigger                 INITIAL | RE_INSPECTION_REQUESTED
  requested_by            null (initial) | client user_id
  requested_at
  failed_items_from_cycle_id     what this cycle exists to re-test
  scope                   → test_plan_item[] for this cycle
  status
```

`test_plan`, `sample`, `lab_job`, `test_result` and `consolidated_test_report` all hang
off `inspection_cycle`, **not** off `application`. The application holds identity,
company, factory, product, variants and the attached BDS; the cycle holds everything
that can happen more than once.

Get this wrong and cycle 2 overwrites cycle 1's results, destroying the evidence trail
of what originally failed — which is exactly the record BSTI would need if the licence
were ever challenged. **Never update in place across cycles. Append.**

#### Barcodes across cycles

New cycle → **entirely new barcodes.** Never reuse, never reactivate. Previous-cycle
samples move to a terminal state (`SUPERSEDED`) and their barcodes are permanently
retired. A scan of a retired barcode at a one-stop must fail loudly with "this sample
belongs to a closed cycle," not silently resolve to the current application.

#### Application states for the cycle

```
CONSOLIDATED_REPORT_READY
  → FDO review
  → verdict PASS  → MARKING_FEE_DEMANDED → ... → CERTIFICATE_ISSUED
  → verdict FAIL  → AWAITING_QUALITY_IMPROVEMENT      (client side, clock paused)
                     → client requests re-inspection
                     → RE_INSPECTION_REQUESTED
                     → back into the channel → new inspection_cycle
```

While in `AWAITING_QUALITY_IMPROVEMENT` the BSTI SLA clock **pauses**, exactly as it does
for a shortfall. Time spent by the client improving their product is not BSTI's delay,
and if it counts against SLA every failed application will pollute the performance
dashboards.

The attached BDS purchase stays **consumed** throughout — the application never ended, so
the release rule from §3.3 of the main plan does not trigger.

#### Cycle scope — RESOLVED

**A re-inspection cycle covers only the failed parameters.** Passing results from earlier
cycles carry forward into the final consolidated report.

```
inspection_cycle.scope = test_plan_item[] WHERE verdict = FAIL in the previous cycle
                         (restricted to the failed variants)
```

Four things follow, and none of them are optional:

**1. Resolution and sample grouping must be recomputed, not copied.**
A reduced parameter set groups differently. If only chloride failed and chloride resolves
to Dhaka, cycle 2 is one sample to one office — the client no longer travels to Rangpur
and Rajshahi. Never carry cycle 1's sample set forward and prune it; run the full
resolution algorithm against the reduced scope. Shareable-portion grouping (§A1.2) changes
when parameters drop out.

**2. The consolidated report spans cycles.**

```
consolidated_test_report
  application_id
  compiled_at
  lines[]:
    test_parameter_id, variant_id
    observed_value, verdict
    source_cycle_number        ← which cycle produced this result
    tested_on                  ← actual test date
    facility_id
```

Every line records its source cycle and test date. A certificate issued after two cycles
rests on results produced months apart, and the report must show that on its face rather
than presenting them as one contemporaneous test.

**3. Carried-forward results need a validity period — this is the sharp edge.**

With a three-month improvement window, a cycle-1 pass can be four or five months old by
the time the certificate issues. Worse: the client has physically *changed the product* to
fix the failure. The cement that passed 28-day strength in cycle 1 is not the same cement
that gets certified after the mix was altered to fix chloride.

So the model needs two things:

```
test_parameter.result_validity_days      how long a passing result stays usable
test_parameter.retest_dependency[]       parameters invalidated when THIS one is re-tested
```

`retest_dependency` was optional before; with partial re-testing it is load-bearing. If
the corrective action for chloride is a change to the raw mix, strength and setting time
are plausibly affected and cannot honestly be carried forward. Only CM Wing and the
testing wings can populate this — it is technical judgement per BDS, not a rule the
system can infer.

`[OPEN]` **Both fields need values from the wings.** Recommend a conservative default:
carried-forward results expire at 90 days, and any parameter with no declared dependency
is treated as independent. Flag both defaults in the UI so a reviewing officer sees when a
carried-forward result is near expiry.

**4. FDO override.** The FDO must be able to widen a cycle's scope beyond the failed
parameters — with a reason, logged. They are the person standing in the factory who can
see that the corrective action was more invasive than the failure implied.

#### Fees — RESOLVED

**Each cycle is charged a new fee**, assessed on that cycle's reduced scope.

```
test_fee_demand
  inspection_cycle_id        ← per cycle, not per application
  lines[]  → test_fee_line
  total
```

So an application's total cost is the sum across cycles, and a client who fails twice pays
three times. The dashboard should show a running total per application, and the wizard
should state up front that re-inspection is chargeable — this is the kind of surprise that
generates complaints at the counter rather than in the system.

`[OPEN]` **Is there a separate re-inspection visit fee**, distinct from the test fee? A
fresh factory visit has its own cost (travel, officer time) that the test fee may not
cover. Needs a fee-schedule answer.

#### Improvement window — RESOLVED

**Three months in `AWAITING_QUALITY_IMPROVEMENT`, then the application lapses.**

Store as configuration, never as a constant:

```
policy_setting
  key                  cm.quality_improvement_window_days
  value                90
  effective_from, effective_to
  set_by, set_at
```

Explicitly noted as subject to change, so it must be editable by an authorised officer
without a deployment — and versioned with effective dates, so an application that lapsed
under a 90-day rule can still be explained after the rule changes to 120.

Behaviour:

- Warning notifications to the client at 30 days and 7 days remaining, and at expiry.
- The FDO and office head see an ageing list of applications approaching lapse.
- The window applies **per cycle**, restarting each time a cycle ends in failure.

`[OPEN]` **What does lapse mean, exactly?** §3.3 of the main plan releases the attached BDS
purchase on rejection. Is a lapse a rejection for that purpose — does the client get their
BDS back, or is it consumed? And can a lapsed application be revived on request, or must
the client start over with a fresh application and a fresh BDS purchase?

#### Remaining open sub-questions

1. `[OPEN]` **Variant scope.** If 2 of 24 variants failed, is cycle 2 limited to those 2?
   Almost certainly yes, and the model supports it via `variant_id`, but confirm.
2. `[OPEN]` **Maximum cycles.** Is there a cap before outright rejection? With a chargeable
   fee each round there is a natural brake, so a cap may be unnecessary — but decide
   deliberately rather than by omission.
3. `[OPEN]` **Re-inspection routing.** Does the client's request re-enter at the Director
   and descend the channel again, or go straight to the original FDO?
4. `[OPEN]` **Same FDO?** If the original FDO has transferred, who picks it up?

### A8.2 Certificate as structured data

Restating the point from the main plan because this is where it lands: generate the certificate as **structured data first, rendered to PDF second.** The consolidated report already holds every result, method, facility and accreditation reference in structured form — which is exactly the payload a machine-readable certificate needs. If the certificate is authored as a PDF, that structure is thrown away at the last step and rebuilding it later is a rewrite.

---

## A9. Revised application state model

Parent status becomes a **computed rollup** over the **current** `inspection_cycle`'s
children. Closed cycles are retained in full but never contribute to current status.
Indicative derivation:

| Parent status | Derivation |
|---|---|
| `TEST_PLAN_RESOLVED` | test plan frozen, labels not yet printed |
| `AWAITING_SAMPLE_SUBMISSION` | fee paid, 0 samples received |
| `SAMPLES_PARTIALLY_RECEIVED` | 0 < received < total |
| `ALL_SAMPLES_RECEIVED` | received = total |
| `TESTING_IN_PROGRESS` | ≥1 lab_job open |
| `AWAITING_FINAL_RESULTS` | all jobs open ≥ their due date |
| `ALL_RESULTS_IN` | all lab_jobs REPORT_APPROVED |
| `PENDING_FDO_FINAL_REVIEW` | consolidated report generated |
| `MARKING_FEE_DEMANDED` / `_PAID` | payment state |
| `AWAITING_QUALITY_IMPROVEMENT` | FDO verdict FAIL, clock paused, client side |
| `RE_INSPECTION_REQUESTED` | client request received, new cycle pending |
| `CERTIFICATE_ISSUED` | terminal |

Blocked variants (`BLOCKED_SEAL_BROKEN`, `BLOCKED_SAMPLE_LOST`) take precedence over any progress rollup, so a problem is never hidden behind an optimistic aggregate.

---

## A10. Open decisions added by this addendum

Ordered by rework cost if answered late.

1. **`result_validity_days` and `retest_dependency` values per parameter** — needed from the
   testing wings; without them, partial re-testing cannot be done defensibly (A8.1)
2. **What a lapse means** — is the BDS purchase released, and can a lapsed application be
   revived? (A8.1)
3. **Separate re-inspection visit fee**, distinct from the test fee? (A8.1)
4. **Counterpart/retention samples** — kept or not? (A4)
5. **Client-carries vs BSTI-transfers samples between offices** (A5.2)
6. **Third-party lab payment** — BSTI pays and recovers, or client pays direct? (A6)
7. **Third-party lab result entry** — portal account or sponsoring-office entry? (A7.3)
8. **Lab report approval chain** — examiner signature sufficient, or up the channel? (A7.2)
9. **Early-fail policy on staged tests** (A7.1)
10. **Inter-office revenue attribution** (A6)
11. **Certificate approval above FDO** (A8)
12. **Re-inspection routing, FDO continuity, variant scope, cycle cap** (A8.1)

---

## A11. Revised phasing

Replaces "Phase G+" in the main plan.

**Phase G — Reference data** *(start immediately, parallel to Phases A–F)*
Parameter catalogue per product · sample requirements · facility capability matrix · third-party lab onboarding.
This is not a coding phase. It is months of wing-by-wing data collection and it is the critical path. Nothing after Phase H can be tested without it. Begin with cement and 4–5 other high-volume products as a pilot set rather than attempting all 315.

**Phase H — Test plan resolution & barcodes**
Resolution algorithm · freeze/revalidate · label generation · offline sealing app.

**Phase I — Multi-office intake**
Per-office one-stop dashboards · scan-based receipt · custody transfer · rollup status engine · client instruction sheet.

**Phase J — Lab pipeline**
Parallel lab jobs on the existing workflow engine · result capture · staged/long-running tests · lab report approval · third-party portal.

**Phase K — Compilation & certificate**
Consolidated report generation · FDO final review · marking fee · certificate as structured data + QR verification.

**Note on ordering:** Phase G gates everything. If reference-data collection has not started by the time Phase D is in progress, the project will finish its software and then wait months for its data. That is the most likely way this schedule slips, and it is entirely avoidable.
