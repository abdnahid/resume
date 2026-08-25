# BSTI e-Services — Platform Plan & CM Quality Certification Module Spec

**Status:** Draft v0.1 — planning only, no code
**Owner:** ICT Division, BSTI
**Scope of this document:** the shared platform kernel + the CM Wing quality certification (315 mandatory products) process flow, end-to-end from public landing page to sample receipt at the One Stop Service Centre.

---

## 0. How to read this document

Sections 1–4 are **architecture** — they apply to every module, present and future.
Sections 5–9 are the **CM quality certificate module** in detail.
Section 10 lists **open decisions** that must be answered before coding.
Section 11 is the **build phasing**.

Anything marked `[ASSUMPTION]` was inferred, not stated. Every one of those needs a yes/no before it hardens into code.
Anything marked `[OPEN]` is a known gap.

---

## 1. Governing principle: one platform, not a suite of modules

The HR module is finished, but it is not a separate product. It is the **officer registry** that every other module depends on. The same holds in reverse — the CM module will become the *inspection history* source that Metrology, Standards and Enforcement read from.

The rule that follows from this:

> A module never owns data that another module needs. It owns a *service* that other modules call.

Concretely: the CM module must never store its own copy of "who is an Assistant Director in the CM Wing and are they on leave next Tuesday." It asks HR. If it copies, the copies drift, and within a year we are back to different software for different work.

### 1.1 Kernel vs. module

Split the codebase along this line from day one:

**Kernel (shared, built once):**

| Service | Responsibility | Consumers |
|---|---|---|
| Identity & Access | Accounts, sessions, roles, profile switching | All |
| Party Registry | Individuals, companies, company groups, factories | All client-facing modules |
| Service Catalog | Definition of every BSTI service as configuration | All |
| Workflow / File Movement | Routing, custody, shortfall, approval, escalation | All internal modules |
| Assignment | Team formation, workload, availability → **reads HR** | CM, Metrology, MSC, Halal |
| Fee & Payment | Fee schedule, demand notes, gateway, Income/VAT split | All |
| Sample & Test | Sealing, chain of custody, lab dispatch, test report | CM, Metrology, Halal |
| Certificate Registry | Issuance, numbering, QR, public verification | All certifying wings |
| Document Store | Uploads, generated PDFs, versioning | All |
| Notification | SMS, email, in-app | All |
| Audit Log | Immutable who-did-what-when | All |

**Modules (thin, configuration-heavy):**
CM Quality Certification · PCR (Packaging) · Halal · Management System Certification · Calibration · Verification · Import Clearance · BDS Store · Training (future, external paid) · Enforcement/Surveillance

A module should mostly be: a service definition, a set of stage definitions, a set of forms, and a certificate template. If a module needs to reimplement routing or payments, the kernel is wrong.

### 1.2 Why this matters for the wings we haven't built yet

Known service surface across the 7 wings, so the kernel is sized correctly from the start:

- **CM Wing** — quality certificate (315 mandatory products), renewal, brand/type/size/flavour/grade inclusion, duplicate licence, import clearance
- **Chemical Testing Wing** — testing against BDS (same 315 product universe)
- **Physical Testing Wing** — testing against BDS (same 315 product universe)
- **Metrology Wing** — PCR/packaging certificate (**all packaged products**, not limited to 315), calibration, verification, weights-and-measures licensing and import registration
- **Standards Wing** — BDS authoring, publication, sale
- **MSC / Halal** — ISO 900x/1400x/22000 certification, halal certificate
- **ICT Division** — **internal only**, no external service
- **Training** — currently internal only; planned external paid training for calibration and testing institutes → treat as a *future revenue-bearing service*, so the Service Catalog and Fee engine must not assume "service = certificate"

The important asymmetry to encode: **CM/Chemical/Physical operate on a closed list of 315 products. Metrology operates on an open product universe.** The product model must support both a controlled vocabulary and free-entry-with-moderation (PCR does not accept arbitrary junk product names, so free entry needs a review gate, not an open text box).

---

## 2. Client-side identity model

### 2.1 The progressive profiling ladder

The core UX requirement: **never ask for more than the current action needs.**

| Tier | Who | Required data | Can do |
|---|---|---|---|
| 0 | Anonymous visitor | none | Browse landing page, browse services, browse BDS store, read fees/guides, verify a certificate |
| 1 | Individual account | Mobile (identifier), name | Buy BDS, download purchases, see purchase history |
| 2 | Company profile (draft) | Company name, representative name, mobile | Start an application, save drafts |
| 3 | Company profile (complete) | Mandatory KYC set (§2.3) | **Submit** an application |

The jump from 1→2 and 2→3 is prompted *at the moment of need*, never up front.

### 2.2 Entry paths (all must work)

**Path A — buy a BDS, nothing else.**
Store → select BDS → checkout. Ask only: name, mobile, email (optional). Pay. Download.
Behind the scenes this creates a Tier-1 individual account keyed on the mobile number. `[ASSUMPTION]` The buyer is told an account was created and can set a password later — a purchase must never be orphaned, because that same person may come back tomorrow to attach it to a licence application.

**Path B — logged-in individual clicks "Apply for Quality Certificate".**
System detects Tier 1 → shows an interstitial: *"Licence applications are issued to companies. Create your company profile to continue."* → company profile form → on completion, continue **to the same application** they were trying to start. Do not dump them back at the homepage.

**Path C — logged-in user with a complete company profile clicks Apply.**
Straight to the application form. Zero friction.

**Path D — anonymous visitor clicks "Apply for Quality Certificate".**
Redirect to login, with a `next=` return URL. Registration screen offers two account types, with **Company preselected**, since anyone at this entry point is here to apply.

**Path E — user belongs to several companies.**
Login is single. A profile switcher in the header selects the active company context. Everything — applications, purchases, payments, notifications — is scoped to the active context.

### 2.3 Company profile — mandatory field set `[ASSUMPTION — needs CM Wing confirmation]`

Blocking submission until these exist:

- Legal name (Bangla + English)
- Company type (proprietorship / partnership / limited / group entity)
- Trade licence number + issuing authority + expiry + scan
- BIN / VAT registration
- TIN
- Registered office address (division / district / upazila / postcode)
- Authorised representative: name, designation, mobile, email, NID
- At least one factory (§2.5)

Optional at profile level, required per application: bank details, IRC/ERC for importers.

### 2.4 Company groups (mother company + entities)

Real structure: a group is a parent under which multiple legal entities sit. Each entity applies separately, holds its own licences, and pays its own fees.

Model:

```
organization
  id
  type            : STANDALONE | GROUP_PARENT | GROUP_MEMBER
  parent_id       : FK organization (null unless GROUP_MEMBER)
  ...
```

Rules:
- Depth is **one level only**. A GROUP_MEMBER cannot itself be a parent. `[ASSUMPTION]` — confirm no multi-tier holding structures exist in practice.
- A licence is always issued to a specific entity, never to the parent. The parent is an administrative convenience, not a legal applicant. `[OPEN]` Unless BSTI does in fact issue to group parents — confirm.
- A user can be a member of the parent and/or any subset of members, with a role per membership.
- Switching context switches *everything*, including which BDS purchases are visible (§3.3).

```
organization_membership
  user_id
  organization_id
  role            : ORG_ADMIN | REPRESENTATIVE | VIEWER
  is_default
```

### 2.5 Factories

A company may have many factories. A quality licence is granted for **a product manufactured at a specific factory** — this is why the inspection targets a premises, not a company.

```
factory
  id, organization_id
  name, address, district, upazila, geo (lat/lng)
  contact person, mobile
  is_active
```

The application form requires selecting exactly one factory. `[OPEN]` Can one application cover one product across two factories, or is that always two applications? This materially changes the inspection model — assume **one application = one factory** until told otherwise.

### 2.6 Authentication

- **Identifier: mobile number.** Unique across the platform.
- Password-based. **No OTP in this phase** — but design the schema with `mobile_verified_at` present and nullable so OTP drops in later without a migration.
- One user, many organization memberships (§2.4).
- `[OPEN]` Password reset with no OTP available — email fallback, or manual reset via One Stop desk? Needs an answer before launch, not after.

---

## 3. BDS Store & the attachment rule

### 3.1 Catalog

```
bds
  id
  bds_number            e.g. BDS 1234:2023
  title_en, title_bn
  product_id            FK → product (nullable for non-product standards)
  is_mandatory_315      boolean
  edition, year, pages
  price
  pdf_document_id
  status                CURRENT | SUPERSEDED | WITHDRAWN
  superseded_by_id
```

The store is public and browsable without login. Search by BDS number, product name, sector, and — importantly — **by "I want to apply for a licence for X"**, which should surface exactly the standard needed.

### 3.2 Purchase

```
bds_purchase
  id
  purchase_number       unique, human-readable, printed on the invoice
  bds_id
  buyer_type            INDIVIDUAL | ORGANIZATION
  buyer_id
  purchased_at
  payment_id
  consumed_by_application_id   FK application, NULLABLE, **UNIQUE**
```

Anyone can buy any BDS, any number of times.

### 3.3 The one-purchase-one-application rule

**Rule:** a purchased BDS may be attached to exactly one new quality licence application, ever.

Enforcement is a `UNIQUE` constraint on `consumed_by_application_id` (nulls excluded), *plus* an application-layer check, *plus* a transactional lock at attach time. Do not rely on the UI alone.

Attach-time validation:

1. The purchase exists and belongs to the active party.
2. `consumed_by_application_id IS NULL`.
3. `bds.product_id` matches the product being applied for.
4. `bds.status = CURRENT` — `[OPEN]` what happens if the applicant bought BDS 1234:2019 and it was superseded last month? Reject, or accept with a warning? This will happen constantly and needs a policy.

Release rules — `[OPEN]`, and consequential:
- Application withdrawn before submission → does the purchase free up again?
- Application **rejected** → freed, or consumed permanently?
- Application submitted and approved → obviously consumed.

My recommendation: freed on withdrawal/cancellation before formal receipt in the Wing; consumed permanently from the moment the Director receives the file. That gives applicants a safety net for mistakes without creating a loophole.

**Ownership across a group** — `[OPEN]`: if the mother company bought the BDS, can a group member entity attach it? Cleanest answer is no (purchase is party-scoped), but it will generate complaints, so decide deliberately.

### 3.4 Attachment UX inside the application

At the BDS step of the application form, three states:

- *Owns an unconsumed matching purchase* → shown as a selectable card, one click.
- *Owns only consumed purchases* → shown greyed with "already used on application CM-2026-00123", plus a **Buy another** button.
- *Owns none* → inline purchase, in-flow, returning to the same application step. Never send them to the store and lose the draft.

---

## 4. Internal actors, hierarchy & the file movement engine

### 4.1 Roles

| Role | Source | Notes |
|---|---|---|
| Wing Director | HR module | Entry point for all files into the wing; approver |
| Deputy Director / intermediate officers | HR module | Pass-through, may annotate |
| **FDO** (File Dealing Officer) | HR module | Field Officer or Assistant Director. Does the real work |
| Inspection team member | HR module | Any available officer of the wing |
| One Stop Officer | HR module | Receives samples, updates receipt status only |
| Accounts | HR module | Fee reconciliation |
| Lab (Chemical / Physical) | HR module | Later phase |
| System Admin | ICT | Configuration, not case work |

"FDO" is a **role on a specific file**, not a designation. The same Assistant Director is an FDO on their own files and a team member on someone else's. Model it as an assignment, never as a user attribute.

### 4.2 The routing channel

Stated requirement, and it is the single most important internal rule:

> The file always passes back through the same channel it came.

Do not compute the return path from the org chart at return time — postings change, officers go on leave, and the file would take a different route home than it took out. Instead:

**Snapshot the path on descent, walk it in reverse on ascent.**

```
application_file
  id, application_id
  routing_path        JSON array of {user_id, designation, order} captured on first descent
  current_holder_id
  current_position    index into routing_path
  status
```

Movement operations:
- `descend()` — hand down one step
- `ascend()` — hand up one step (approval requests, completed work)
- `return_to_applicant()` — shortfall; exits the internal channel
- `reassign(reason)` — the escape hatch for leave/transfer/death. Must be **logged with a reason and an authoriser**, and must patch `routing_path` rather than bypass it.

Every movement writes a row:

```
file_movement
  id, application_file_id
  from_user_id, to_user_id
  action              DESCEND | ASCEND | RETURN_TO_APPLICANT | REASSIGN
  note                officer's remark
  attachments
  moved_at
  sla_due_at
```

This table *is* the file's history sheet. It should be printable as the nothi-style movement record, because that is what officers will trust.

### 4.3 Assignment & team formation — the HR contract

When the FDO forms an inspection team, the module calls the kernel Assignment service, which queries HR for:

- Officers posted to this wing (and optionally this region)
- Current leave / tour / training status on the proposed date
- Existing inspection load in that window
- Discipline/expertise tags — `[OPEN]` does HR carry a competency field per officer? If not, this is a needed HR extension, and it is the first real proof that the modules talk.
- Conflict of interest flags — `[OPEN]` does BSTI track officer↔company conflicts today? If not, propose it.

The Assignment service returns *available* officers. The FDO chooses; the system does not auto-assign. `[ASSUMPTION]` — confirm BSTI wants human selection rather than automatic round-robin.

---

## 5. CM Quality Certificate — process flow

### 5.1 Phases

```
  ┌─ PHASE 1 ─ APPLICATION ────────────────────────────────────┐
  │ Applicant: profile → BDS attach → form → application fee   │
  │            → submit                                        │
  └────────────────────────────────────────────────────────────┘
                          ↓
  ┌─ PHASE 2 ─ INTAKE & REVIEW ────────────────────────────────┐
  │ Director → intermediate officers → FDO                     │
  │ FDO reviews → shortfall (loop) OR pass                     │
  └────────────────────────────────────────────────────────────┘
                          ↓
  ┌─ PHASE 3 ─ INSPECTION ─────────────────────────────────────┐
  │ FDO proposes date + team → up the channel → Director       │
  │ approves → down the channel → inspection → form + sealed   │
  │ sample → FDO submits                                       │
  └────────────────────────────────────────────────────────────┘
                          ↓
  ┌─ PHASE 4 ─ TESTING FEE & SAMPLE INTAKE ────────────────────┐
  │ Test fee demanded → applicant pays (anywhere) → applicant  │
  │ carries sealed sample to One Stop → One Stop verifies PAID │
  │ → receives sample → marks received                         │
  └────────────────────────────────────────────────────────────┘
                          ↓
  ┌─ PHASE 5+ ─ LAB TESTING → DECISION → LICENCE ──────────────┐
  │ NOT SPECIFIED YET — see §9                                 │
  └────────────────────────────────────────────────────────────┘
```

### 5.2 State machine

| # | State | Holder | Exits |
|---|---|---|---|
| 1 | `DRAFT` | Applicant | → `PENDING_APP_FEE` |
| 2 | `PENDING_APP_FEE` | Applicant | → `SUBMITTED` (on payment) |
| 3 | `SUBMITTED` | System | → `RECEIVED_BY_DIRECTOR` |
| 4 | `RECEIVED_BY_DIRECTOR` | Wing Director | → `IN_CHANNEL_DESCENDING` |
| 5 | `IN_CHANNEL_DESCENDING` | Intermediate officer(s) | → `ASSIGNED_TO_FDO` |
| 6 | `ASSIGNED_TO_FDO` | FDO | → `UNDER_REVIEW` |
| 7 | `UNDER_REVIEW` | FDO | → `SHORTFALL_ISSUED` \| `REVIEW_PASSED` \| `REJECTED` |
| 8 | `SHORTFALL_ISSUED` | Applicant | → `SHORTFALL_RESPONDED` \| `LAPSED` (timeout) |
| 9 | `SHORTFALL_RESPONDED` | FDO | → `UNDER_REVIEW` (loop, counter++) |
| 10 | `REVIEW_PASSED` | FDO | → `INSPECTION_PROPOSED` |
| 11 | `INSPECTION_PROPOSED` | ascending channel | → `INSPECTION_PENDING_APPROVAL` |
| 12 | `INSPECTION_PENDING_APPROVAL` | Wing Director | → `INSPECTION_APPROVED` \| `INSPECTION_REVISION_REQUESTED` |
| 13 | `INSPECTION_REVISION_REQUESTED` | FDO | → `INSPECTION_PROPOSED` (loop) |
| 14 | `INSPECTION_APPROVED` | descending channel | → `INSPECTION_SCHEDULED` |
| 15 | `INSPECTION_SCHEDULED` | FDO | → `INSPECTION_IN_PROGRESS` \| `INSPECTION_RESCHEDULED` |
| 16 | `INSPECTION_IN_PROGRESS` | FDO (on site) | → `INSPECTION_COMPLETED` |
| 17 | `INSPECTION_COMPLETED` | FDO | → `INSPECTION_REPORT_SUBMITTED` |
| 18 | `INSPECTION_REPORT_SUBMITTED` | System | → `TEST_FEE_DEMANDED` \| `INSPECTION_FAILED` |
| 19 | `TEST_FEE_DEMANDED` | Applicant + One Stop (visible) | → `TEST_FEE_PAID` |
| 20 | `TEST_FEE_PAID` | Applicant + One Stop | → `SAMPLE_RECEIVED` |
| 21 | `SAMPLE_RECEIVED` | One Stop | → **Phase 5, TBD** |

Terminal/side states: `REJECTED`, `WITHDRAWN`, `LAPSED`, `INSPECTION_FAILED`.

**Design note on 19 → 20 → 21:** the One Stop Officer's *only* write action in this whole flow is "sample received / not received." Payment status is read-only to them, and arrives from the Payment service. This keeps the counter honest — the officer cannot mark a sample received against an unpaid file, and cannot mark a file paid to accommodate a walk-in. Do not add a manual payment override to the One Stop dashboard. If cash-at-counter is a real scenario, it must be a *payment method* inside the Payment service with its own receipt, not a status toggle.

### 5.3 Shortfall loop

```
shortfall
  id, application_id
  raised_by_user_id, raised_at
  items           JSON [{field_or_document, observation, required_action}]
  due_at
  responded_at
  response_note, response_attachments
  round_number
```

- Shortfalls are **itemised**, not a free-text paragraph. The applicant then sees a checklist, which is what actually reduces repeat rounds.
- The application clock pauses while the file sits with the applicant. SLA measures BSTI's time, not the applicant's.
- `[OPEN]` Maximum number of shortfall rounds before auto-rejection? Response deadline? Both are policy decisions, not technical ones.

### 5.4 Inspection

```
inspection
  id, application_id, factory_id
  proposed_date, proposed_by_user_id
  approved_date, approved_by_user_id, approved_at
  status
  conducted_on
  team            → inspection_team_member[]
  report          → inspection_report
  samples         → sample[]
```

The inspection form should be **fillable offline on a phone or tablet and synced later** — factories are not all in Dhaka and connectivity is not guaranteed. Treat the offline draft as a first-class requirement, not a nice-to-have; a form that fails at the factory gate will be filled on paper and typed up later, and the automation gains nothing.

`[OPEN]` Is the inspection form the same for all 315 products, or per-product/per-sector? If it varies, the form itself needs to be configuration (a form-definition table), not a hardcoded screen. Strong suspicion it varies.

### 5.5 Sample sealing & chain of custody

Sealed at the premises by the FDO. This is the point where the physical world and the system have to stay in sync, so the identifier has to be created **at sealing time, on site**:

```
sample
  id
  seal_number         generated by the system, printed/written on the seal
  application_id, inspection_id
  product_id, batch/lot, mfg_date, quantity
  sealed_by_user_id, sealed_at, geo
  custody_status      SEALED_AT_PREMISES | IN_TRANSIT_WITH_APPLICANT
                      | RECEIVED_AT_ONE_STOP | DISPATCHED_TO_LAB | ...
  received_by_user_id, received_at, receipt_condition
```

Note the custody gap: the sample is sealed by BSTI, then **carried by the applicant** to the One Stop Centre. The seal is what protects integrity. So the One Stop receipt screen must record **seal intact / seal broken / seal number mismatch**, and a broken seal must block progress and notify the FDO rather than silently accepting the sample.

`[OPEN]` Is a duplicate/counterpart sample retained at the factory or by the FDO, as is common practice? If yes, it needs modelling now.

---

## 6. Fees & payments

Three distinct money events in this flow:

| Fee | When | Who sets | Paid where |
|---|---|---|---|
| BDS purchase | Store checkout | Standards Wing price list | Online |
| Application fee | Before submission | CM fee schedule | Online |
| Testing fee | After inspection report | Per-product test parameter cost | **Anywhere** — online, bank, mobile |
| Licence fee | Phase 5, TBD | CM licence fee schedule (by category) | TBD |

Reuse the existing split: **Income Fee account + VAT (15%) account via e-Challan**, already in place.

Required behaviour: because the applicant may pay the testing fee "from anywhere," the payment record must reconcile back to the application automatically. The demand note therefore carries a **unique payment reference printed on it**, and reconciliation keys on that reference — not on name, not on amount, not on date. Manual reconciliation at the One Stop desk should be an exception path with an audit trail, not the normal route.

`[OPEN]` The gateway question is still live from earlier work — whether Sonali Bank is legally mandatory or whether an aggregator can sit in front of it. This flow makes the answer more urgent, since "pay from anywhere" is now a stated requirement.

---

## 7. Notifications

Minimum event set for this module:

| Event | To | Channel |
|---|---|---|
| Application submitted | Applicant | SMS + in-app |
| Received in Wing / file number assigned | Applicant | SMS + in-app |
| Shortfall issued | Applicant | SMS + in-app + email |
| Shortfall deadline approaching | Applicant | SMS |
| Inspection date approved | Applicant, team members | SMS + in-app |
| Inspection completed | Applicant | in-app |
| Testing fee demanded | Applicant | SMS + in-app |
| Payment received | Applicant, One Stop | in-app |
| Sample received | Applicant, FDO | SMS + in-app |
| File assigned to you | Officer | in-app |
| SLA breach imminent | Officer + their supervisor | in-app |

SMS templates need Bangla, and Bangla SMS is expensive per part — keep templates short and check the encoding cost before writing them.

---

## 8. Applicant-facing surfaces

1. **Public landing page** — what BSTI does, service tiles, each with *Apply Now*
2. **Service detail page** — requirements, documents needed, fees, timeline, FAQ. Public. This page prevents a large share of shortfalls if written well.
3. **BDS Store** — browse, search, buy. Public.
4. **Certificate verification** — public lookup by certificate/licence number. Public, no login.
5. **Dashboard** — active applications with a visible stage tracker, purchases, payments, certificates, notifications
6. **Application wizard** — product → BDS attach → factory → details → documents → fee → submit
7. **Shortfall response screen** — itemised checklist
8. **Profile management** — company, group entities, factories, users & roles

Design requirement: the applicant should be able to see **exactly which stage their file is at and who holds it**, without phoning anyone. That single feature is most of the perceived value of this system.

---

## 9. Phase 5+ — now specified in Addendum A

> **See `bsti-eservices-lab-routing-addendum.md` (same folder).** Test plan resolution, barcoded
> multi-sample generation, distributed lab routing across BSTI offices and accredited
> third-party labs, multi-office one-stop intake, parallel lab pipelines, consolidated
> report compilation, marking fee and certificate issuance are specified there.
> That addendum also replaces the scalar application status in §5.2 with a computed
> rollup — read it before implementing §5.2.

### 9.1 Still unspecified after Addendum A

Phase 5 onward is undefined and must not be guessed at in code:

- Lab dispatch — how samples route to Chemical vs Physical wings, and what happens when both are needed
- Test parameter selection per BDS, and how test fees are computed from it
- Test report generation and approval chain
- Retest / second sample on failure
- The licensing decision — is there a committee? who signs?
- Licence fee assessment (is it category- or turnover-based?)
- Certificate generation, numbering, QR, and the 3-year validity clock
- Surveillance during the validity period
- Renewal, brand/type/size/flavour/grade inclusion, duplicate licence
- Suspension and cancellation

Also entirely unspecified: how this module's output feeds the **DCC** ambition. Worth noting now — if certificates are generated as structured data first and rendered to PDF second, the later move to machine-readable certificates is a rendering change. If they are generated as PDFs, it is a rewrite. **Design certificates as data from day one.**

---

## 10. Open decisions — needed before coding

Ordered by how much rework each one causes if answered late.

1. **Application scope:** one application = one product = one factory? Or can one application cover multiple products/brands/factories?
2. **Superseded BDS:** can an applicant attach a purchase of a now-superseded edition?
3. **BDS release on rejection/withdrawal:** does the purchase free up?
4. **Group-scoped purchases:** can a subsidiary use the parent's BDS purchase?
5. **Inspection form variability:** one universal form, or per-product/sector forms?
6. **Company profile mandatory fields:** confirm the §2.3 list against what CM Wing actually demands today.
7. **Shortfall policy:** max rounds, response deadline, consequence of lapse.
8. **SLA targets per stage** — needed for the officer dashboards and for the Citizen's Charter timelines.
9. **Password reset with no OTP.**
10. **Counterpart sample retention.**
11. **Group parent as licence holder** — yes or no.
12. **Officer competency and conflict-of-interest data in HR** — does it exist?

---

## 11. Build phasing

**Phase A — Kernel foundations**
Identity & access · Party registry (individual, company, group, factory) · Document store · Notification · Audit log
*Exit criteria:* a user can register, create a company, add a factory and switch profiles.

**Phase B — Store & Payments**
BDS catalog · public store · guest purchase · payment integration with Income/VAT split · purchase ledger
*Exit criteria:* an anonymous visitor can buy a BDS and get a receipt; a company sees its purchases.

**Phase C — Service Catalog & Application intake**
Service definitions · application wizard · BDS attachment rule · application fee · submission
*Exit criteria:* a complete company profile can submit a CM application with a validly attached BDS.

**Phase D — Workflow engine**
Routing path snapshot · descend/ascend/return/reassign · file movement log · officer inbox · SLA clocks
*Exit criteria:* a submitted application reaches an FDO through the channel and can be returned as a shortfall.

**Phase E — Inspection**
Assignment service + HR integration · date proposal & Director approval · offline-capable inspection form · sample sealing
*Exit criteria:* an inspection is approved, conducted, and its report submitted with a sealed sample recorded.

**Phase F — Test fee & One Stop intake**
Test fee demand · pay-from-anywhere reconciliation · One Stop dashboard · sample receipt with seal verification
*Exit criteria:* the flow reaches `SAMPLE_RECEIVED` end to end.

**Phase G+** — lab, decision, certificate. Specify first (§9), then build.

Phases D and E are the reusable prize. Once the workflow engine and assignment service exist and are proven on CM, PCR, Halal, MSC and calibration become largely configuration exercises rather than new builds. Resist the pressure to make Phase D "just good enough for CM" — that is exactly how a platform turns back into seven separate systems.

---

## 12. Suggested repository layout

> **Not adopted.** See decision D1 in `BUILD-PLAN.md`: the monorepo split was
> rejected in favour of `lib/` conventions inside the existing Next.js app.
> The layout below is kept for reference only.

```
/docs
  bsti-eservices-cm-module-plan.md      ← this file
  decisions/                            ← one ADR per resolved item from §10
/kernel
  identity/  party/  catalog/  workflow/  assignment/
  payment/  sample/  certificate/  document/  notify/  audit/
/modules
  cm-quality/  bds-store/  pcr/  halal/  msc/  calibration/
/apps
  portal/        ← applicant-facing
  officer/       ← internal
  onestop/       ← counter
  admin/
```

**Instruction for Claude Code:** read §10 first. Do not begin implementation of any phase whose open decisions are unresolved — instead, surface the question. Where a decision is unresolved but a stub is needed to proceed, isolate it behind a single named policy function so it can be changed in one place.
