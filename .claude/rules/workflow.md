---
description: "Workflow — files moving inside BSTI: desks, seniority, inspection plans, reports, sampling letters and the One Stop counter"
paths:
  - "lib/workflow/**"
  - "lib/cm/**"
  - "app/(workflow)/**"
  - "lib/desk-service.ts"
  - "lib/roles-service.ts"
  - "lib/roles.ts"
---

## Workflow — files moving inside BSTI

Decisions D57–D59, spec §4.2. `lib/workflow/chain.ts` is Prisma-free (D9),
`inbox.ts` is the server half. Both avoid mentioning CM: `holderEmployeeId` and
`ApplicationMovement` are generic, so the next service that needs a file to move
can reuse them.

- **Additional charge is `Employee.actingOrgPostId`, and the acting post's
  grade wins** (D74). A wing whose Director post is vacant runs on a Deputy
  Director holding its charge — the CM wing does today. Everywhere else the
  *employee's* grade decides seniority; this is the one case that inverts,
  because acting means exercising the post's authority and not your own. So
  `toDesk()` takes section and grade from the acting post, and a DD acting as
  Director (CM) ranks grade 4 inside the wing and passes to the wing's other DD
  by the ordinary rule — which by his own grade 6 `canPassTo` refused. He keeps
  his own desk: two columns, so ending the charge is nulling one field. The
  picker says *"— Director, additional charge"* rather than silently promoting
  him. No history is kept; `toDesk()` is the only reader, so making it a dated
  table later is one place.
- **A file whose holder stops serving is stuck, and only an administrator can
  free it** (D76). `holderEmployeeId` is a person and "nobody holds it" is the
  definition of unclaimed, so a file does not fall back to anyone when its
  holder leaves — it sits at a desk nobody is at. Worse, `pass()` lets only the
  holder move a file, and a retiree who has given up their desk has no
  `sectionUnitId`, so `canPassTo()` refuses before it looks at grade. D75's
  sender exemption does not help, because the section check comes first.
  `npm run fix:orphaned-files` moves each such file to its office's head — where
  it would have gone had the holder never received it — and writes a
  **`reassign`** movement. Not an `up`: nobody sent it, and "sent up by
  <retired officer>" is a lie in the one feature spec §8 calls most of the
  perceived value of the system. `fromEmployeeId` still names who was holding
  it, so the break in custody stays visible. **There is no screen for this** —
  reassignment is on the step 8+ list and the script is the only way to do it.
- **A retired officer may never be handed a file** (D75). `Desk.isActive`,
  checked on the candidate and **never on the sender** — a file already in a
  retired officer's hands must still be movable out of them. Office scoping is
  `employeesOfOffice()`, which asks where somebody works and not whether they
  still do, so without this a retiree holding a desk stayed in the picker.
- **A person may hold several roles** (D122). `User.roles` is the authority and
  `User.role` is the highest-precedence member of it, kept in step by
  `setRoles()` in `lib/roles-service.ts` and **nowhere else**. Ask
  `hasRole(subject, "x")` — never compare `role`, which grants the top role and
  silently refuses every other one the person holds.
  **`hasRole()` falls back to the primary when `roles` was not selected**, so a
  query that forgot the array is never *more* permissive than before, only
  less. That is what made the change safe to land without sweeping all 83
  comparison sites: precedence puts `superadmin` first, so only checks for a
  **non-top** role could newly be wrong, and those were converted by hand.
  **The session cookie carries the primary only** — a secondary-role check must
  go through `getViewer()`, which reads the row.
- **`office_head` is its own role.** It receives an office's submitted
  applications; `officeadmin` does not. Payroll authority and file-routing
  authority are different jobs. Until D122 `User.role` was one
  enum, so nobody could be both — and granting `office_head` silently removed
  `officeadmin`, which is why `import:office-heads` had to move payroll to
  another desk at 14 of 23 offices. A person may now hold both.
- **A desk that has handled a file keeps seeing it** (D77). `touchedBy()` reads
  the movement log, so standing is a *fact about the file* rather than a
  permission somebody granted — and it carries no power, because every action
  still keys off holding it. A file used to vanish the moment you passed it on,
  which is right for "what is on my desk" and wrong for everything else: the
  officer who wrote the inspection report is the one the applicant telephones,
  and he could not answer. Both directions of the log count — `toEmployeeId` is
  every desk that held it, and `fromEmployeeId` adds the office head who
  received and passed down in one sitting. Deliberately **not** office-scoped: a
  person who handled a file and has since transferred still handled it.
- **Reading a file and working it are two pages, each with its own button on
  the board.** `/workflow/[id]` is the preview — what the applicant filed, its
  attachments and its fees, server rendered with almost no client JS.
  `/workflow/[id]/process` is the work: corrections, the inspection plan, the
  office order, and where the file has been. An officer approving a visit should
  not scroll past six cards of sub-products to reach the button, and one
  checking a declared capacity should not scroll past the control that issues an
  office order. **Not tabs** — a tab bar on the preview reads as "the process
  lives inside the preview" when it does not. The board's Process button is
  **named for the work waiting there** (*Plan inspection*, *Inspection plan*,
  *Office order*, *Review*) for whoever holds the file, so nobody has to learn
  which page plans a visit. `FileShell.tsx` holds the shared header and the
  `Card`/`Row`/`Empty` helpers so the two pages cannot drift apart.
- **`/workflow/[id]` is the whole file, read-only** (D80) — the application
  preview, the attachments and the fees, for every officer on its flow.
  `canViewApplication()` is the named rule and it is the same standing that puts
  a file on your board (D77): you hold it, you have handled it, it is your
  office's and you are its head, or you are a superadmin. Reading is not acting
  — every action still keys off *holding* it and `pass()` re-checks on the
  server. **A refusal is `notFound()`, not a 403**, for the reason D71 gives:
  a distinguishable refusal would let any member of staff enumerate which
  application numbers exist and which office holds them.
- **The review closes when the file is marked ready.** `reviewIsClosed()` in
  `lib/cm/inspection.ts`; the panel that raises a shortfall disappears rather
  than offering a button the service would refuse.
- **The inspection plan travels with the file** (D82). `lib/cm/inspection.ts`.
  Whoever holds the file proposes a date and a team; every desk above may
  **correct** it, because a senior officer who cannot change a plan he is
  accountable for has to send it back instead — a round trip for a typed date.
- **Proposing and sending are two acts, and the sending is what moves the
  file.** Saving the plan leaves it on the proposer's desk so he can come back
  to it; **Send for approval** returns the file to whoever handed it down and
  sets `inspection_pending_approval`. Without that step the plan sat saved on
  the proposer's desk: he could still edit it and his senior had nothing to
  approve. Editing and approving both key off *holding* the file, so the
  hand-off is the only thing that has to be right for both to follow.
- **The approver is whoever handed the file down** (D84) — not the office head,
  and not a senior the sender picks. `delegatorOf()` reads the most recent
  `down` movement addressed to this desk: he delegated the work, so the plan
  returns to him. **There is nothing to choose**, and offering a list of seniors
  both asked a question the file's own history already answers and let the wrong
  person be chosen. Only `down` counts: a `receive` has no sender, an `up` came
  from somebody junior, and a `reassign` was an administrator moving a stranded
  file rather than a superior delegating work. Because the target is derived
  rather than chosen, the hand-off is written directly instead of through
  `pass()` — the chain test exists to stop an arbitrary sideways move, and there
  is no choice here to abuse — and it is recorded as an `up` so the desk flow
  reads the same. The proposer may never approve his own plan, and the approver
  must **hold** the file. The inspection and sampling reports will take the same
  rule.
- **Approval hands the file back down to whoever proposed the plan.** He is the
  officer going to the factory — he estimates the samples, takes the tokens,
  seals them and writes the report — so leaving the file on the approver's desk
  put every one of those at the wrong desk. Recorded as a `down`, which also
  makes the return journey right by itself: `delegatorOf()` then resolves to the
  approver, so the report goes back to the same officer who approved the plan.
- **Approval issues the office order**, and it is an official letter (D85).
  `/workflow/[id]/order` renders it on the government letterhead — `GovHeader`
  with `orgForOffice()`, so a Barishal order carries Barishal's address — naming
  the company, the factory, the product, the date and the team, signed by the
  approver. **The screen and the PDF are the same page**: the toolbar is
  `print:hidden` and Puppeteer loads that URL, exactly as the salary slip does,
  so there is no second layout to keep in step. `GET
  /api/workflow/applications/[id]/order/pdf` is the download.
- **The order number is a memo number**, `বিএসটিআই/<office>/পরিদর্শন/<serial>/<year>`
  — the shape `generateMemoNo()` builds for the bank advice. Numbered at
  approval and not at proposal, for the same reason an application number waits
  for submission: a number quoted to a factory should mean a visit that will
  happen. Stored with ASCII digits so the serial parses, printed through
  `toBengaliDigits()`. It appears on the board row and in the desk flow, so
  every desk sees it. **An approved plan cannot be edited or sent back** —
  changing the date means a fresh order, not an edited one.
- **What the officer finds at the factory goes on the *application*, not on
  the letter** (D89). A sub-product or variant added to the sampling letter
  alone would be sealed and tested but never applied for — no routing, no
  parameters, no test fee, and a licence that does not cover the article the jar
  came from. `declaredBy` keeps the two apart so "did they under-declare, or did
  we find more" stays answerable (D67), and the applicant's declaration is never
  rewritten. Adding one changes the sampling grid and the test fee by itself,
  because both read `ApplicationSubProduct`.
- **A line the applicant declared but is no longer making is struck out, not
  deleted** (D91). A factory may discontinue a product between applying and the
  inspection, and the officer is the one who finds out.
  `notInProductionAt` on `ApplicationSubProduct` and `ApplicationSku`, and
  everything downstream ignores it: no sampling cell, no box, no test fee,
  nothing licensed. **The declaration stays on the file**, because "what did
  they say they made" is asked in disputes and a deleted row cannot answer it —
  the same discipline as `declaredBy`. Reversible until the jars are sealed.
- **He may remove only what he added.** `removeSubProduct` and `removeSku`
  refuse a row whose `declaredBy` is `applicant`: deleting the applicant's
  declaration would erase it, and "did they under-declare, or did we find more"
  stops being answerable the moment either side can rewrite the other. The
  Remove control renders only on his own findings.
- **Amendments close when the jars are sealed.** The plan cannot be regenerated
  (`commitSampling` refuses), so a variant added afterwards would be licensed
  without ever having been sampled. Both `addSubProduct` and `addSku` refuse,
  and the panel hides rather than offering a button that will.
- **The visit's working is not everyone's to read** (D90).
  `inspectionAudience()`: the visiting officer always; the desk it was **sent
  to**, once sent; everyone with standing once **approved**. D80 gives every
  desk that handled a file the right to read it, which is right for the
  application and wrong for a report being written — a senior reading a draft
  either corrects work that was going to be corrected anyway or forms a view of
  a visit from notes. The sampling plan, the labels and the printed report all
  follow the same rule, so a link cannot outrun the panel that offers it.
  **A superadmin is not exempt**: the point is not access control against
  administrators, it is that unfinished work is not somebody else's to read.
- **The inspection report and the sampling record go up together** (D92) —
  they are one visit. Splitting them would let a senior approve a report about a
  factory whose samples he has not seen, or clear a set of jars without the
  findings that justify drawing them. Sending is refused until the jars are
  sealed, for the same reason.
- **The approving desk has three answers, because a visit is either sound, or
  wrong on paper, or wrong in the factory:**
  - **approve** — numbered, and the file goes **straight back to the officer**,
    because the letters that follow are his to issue and a file parked on the
    approver's desk is a day lost for nothing.
  - **send back** — the paperwork is wrong. Down to the officer with a note,
    `submittedAt` cleared; nothing on the application reopens and the samples
    stand.
  - **factory not ready** — a `FactoryDevelopmentNotice` goes to the applicant
    and the file waits on **them** (`awaiting_factory_development`). **Not a
    shortfall**: a shortfall reopens fields on a form, this asks for work in a
    building. The visit and its samples stay exactly as recorded, because a
    re-inspection is a *second visit* and rewriting the first would lose the
    finding that caused it.
- **The visit produces two documents, and one of them has no state** (D96).
  `/workflow/[id]/sampling-report` prints what was drawn — the sealed boxes,
  their seal numbers, the specimens with their brand, variant and size, the
  destination laboratory and how many parameters each order carries — under the
  **inspection report's number**, not one of its own. No submitted flag, no
  approver, no serial: one visit, one approval (D92), and a separate serial
  would imply the two could be decided apart. `samplingBoxesFor()` in
  `lib/cm/sampling-report.ts` reads the rows; the officer types only
  `samplingRemarks`, the part no row holds — quantity drawn, condition of the
  goods. Both documents are linked together wherever either is offered, so
  nobody approves one having read the other.
- **The sampling *screen* is the officer's; the sampling *report* is the
  chain's** (D97). `SamplingPanel` estimates counts, generates tokens and seals
  boxes, so it renders for the visiting officer alone — it stayed on every desk
  after approval because D90 widens the audience for the *work*, and a
  supervising desk was handed a tool for a job it does not do. It reads the
  document instead.
- **The letters after an approved visit are derived, then issued by the
  officer** (D95). Which letters are needed comes from the sealed boxes — one to
  each laboratory's wing head, one to the applicant, one to each One Stop
  counter — so a laboratory cannot be forgotten, the same reason destinations
  are derived and not typed (D69). But he *issues* them, in his own name:
  approval says the visit is sound, and these letters describe his samples.
  Approval hands the file straight back to him (D92), so there is no extra hop.
  **All at once** — a partial dispatch means a laboratory expecting a box the
  applicant was never told to carry — and **refused while anything is
  unaddressed**, with every obstacle listed at once so an administrator fixes
  them in one go. Issuing twice is refused; a corrected letter is a fresh letter
  with its own number, `বিএসটিআই/<office>/নমুনা/<serial>/<year>`, consecutive
  across one dispatch so a gap means a letter that never went.
- **The applicant's letter lives on the client surface** (D98).
  `/public/applications/[id]/letter` renders নমুনা জমাদান পত্র on the government
  letterhead, with the PDF at `/api/client/applications/[id]/letter/pdf`. It
  **cannot** live under `/workflow` — that prefix is INTERNAL-only (D12), so the
  one person the letter is addressed to is the one person who could not open it
  there. `applicantLetterFor()` in `lib/cm/letter-view.ts` builds it from the
  consignments themselves, so a box cannot be left off the instruction that says
  where to carry it. **Seal numbers are printed in full** — they are what the
  counter checks a box against (D72). `SampleLetterNotice` repeats the substance
  on the application page above the form, beside the shortfall notice and for
  the same reason: there is no notification channel, so the page *is* the
  notice, and a box already handed in shows as received rather than as an
  outstanding errand.
  **`ModuleNavbar` is now `print:hidden`**, which it needed to be the moment a
  client surface printed a real document — a page under
  `app/(public)/public/` cannot opt out of that layout's chrome.
  **The delivery window is a stand-in.** `SAMPLE_SUBMISSION_DAYS` is 14 in
  `policy.ts` with the reasoning (D8); it is printed as guidance and **nothing
  enforces it**, because refusing a real sample over an invented deadline is
  worse than accepting a late one.
- **The applicant gets one letter per destination office** (D128), not one
  compiled sheet describing every journey. A compiled one cannot be handed in
  anywhere: the counter taking the Khulna box cannot tell which paragraph is
  theirs, and the applicant cannot leave the paper behind when it is accepted,
  because the other two errands are printed on it. `?office=` selects one;
  omitted, the earliest is used, which is what an older link means and what a
  single-box file needs.
- **Issuing the letters demands the testing fee, in the same act** (D129).
  `Application.testFeePoisha` and `state: test_fee_demanded`. It is the first
  moment the fee is a real number — sub-products settled, destinations chosen,
  boxes sealed — so the sum across every laboratory is finally computable (D62).
  **The amount is stored, never recomputed**: prices move, the urgent-fee
  apportionment is still waiting on D100, and an applicant told ৳4,000 must be
  charged ৳4,000. **The demand is a state and a figure, not a `Payment` row** —
  a payment needs a payer and the issuing officer is not it, so the row is
  raised when the applicant starts checkout, exactly as the application fee is.
  `submitConsignment()` refuses while it is unpaid and names the amount.
  `testFeeFor()` is the only place a test fee is summed; do not re-sum it
  locally, not even in a one-off.
- **The wing-head letter names the tests routed to that office, and says on
  what basis** (D134). Two things it used to get wrong. It printed a *count*,
  and the count was the catalogue package's — so application 26's Ceramic Tiles
  read "9 tests" on all three of its letters while Head Office was sent 1,
  Faridpur 7 and Khulna 1. The names come from `LabTestOrderItem` through the
  D133 crossing (consignment → registration → sample → order), gathered per
  *order* rather than per jar, so the letter says what the bench will work from.
  **The counter still gets a count** — it takes the box at the door and never
  opens it.
- **Urgent testing is chosen when the letters are issued, and nowhere else**
  (D134). `Application.isUrgent`, one flag for the file. The same act fixes the
  fee (D129), so it is the last moment the choice can be made and the first at
  which it can be charged for; `LettersPanel` shows both totals and both
  turnarounds before the officer commits. **`issueSampleLetters()` flips the
  file's `LabTestOrder`s in the same transaction** — a letter saying জরুরি over
  a normal-priority order is the one disagreement this must not produce — and
  the route reads `body.urgent === true` and nothing looser. **The urgent total
  is the sum of `urgentFeePoisha`, never the normal one doubled**:
  `priceUrgent()` writes the same figure as normal for a test that cannot be
  hurried (D102), so doubling charges for speed no bench can deliver. On the
  paper the badge is a **border and bold type, not a colour** — the letter is
  photocopied and a red panel prints grey — and it is stated either way, so a
  letter with no badge is never ambiguous.
- **A letter names an office, never a laboratory** (D130). `SampleLetter.labId`
  is null on everything issued since, and `officeId` is set on all three kinds.
  Since D116 the destination is an **office**, accountable for the testing
  whether it runs on its own bench or sends it out, and the office is what
  decides. It used to hold the destination office id in `labId` — a column whose
  foreign key points at `Lab`. **Office ids run 1–23 inside lab ids 1–46, so
  every one of them was a valid lab id** and the database took it in silence;
  Khulna's wing head was issued a letter naming *Physical Lab, Barisal*. The
  same collision that put the wrong lab on the sealing screen. Never pass an
  office id to anything keyed on `Lab`, and name the variable for what it holds.
- **A sampling letter is read from the letter, not from the file** (D130).
  `/workflow/letters` and `lib/cm/letter-inbox.ts`. `canViewApplication()`
  grants the file you hold, handled, or head the office of (D80) — and the
  officer a letter is addressed to is **none of those**: a Faridpur inspection
  sends a box to Khulna, whose officer is asked to expect samples on a file that
  will never reach their desk. Every addressee was refused and the letters had
  no reader. Access is the letter's: `addressedToEmployeeId` for a wing head,
  `officeId` + `one_stop` for a counter, plus anyone with standing on the file.
  A refusal is `notFound()`, per D71. The applicant's letter is deliberately
  *not* here — it lives on the client surface (D98).
- **The wing-head letter is blinded; the counter's is not** (D71). Testing-wing
  staff get the package, the box, the seal and the jar count and never the
  company, the factory, the brand or the application number, because the variant
  *is* the applicant's identity. A counter hands the box back and forth with the
  person carrying it and checks the fee against their file, so it names them.
- **The `/workflow` navbar is built from what the viewer holds**,
  `workflowNav()` in `lib/workflow/nav.ts` (Prisma-free). The counter and the
  letter inbox both answer `notFound()` to someone without them, and the board
  used to link neither — so a One Stop clerk could only reach their own screen
  by typing its URL.
- **The One Stop counter is a desk, not a person** (D93). `one_stop` is a role,
  so the counter keeps working when the officer on it changes, and
  `/workflow/counter` lists what is coming to their office.
  **One office has a counter clerk** — JEB-UN NESA at head office. Faridpur and
  Khulna have boxes coming and nobody holding `one_stop`, so those boxes cannot
  be received and the letters sit in an inbox nobody can open. One grant each at
  `/hr/listing/roles`.
  **Boxes are listed by the *laboratory's* office, not the file's** — the
  applicant carries each box to the office of the lab that will test it, which is
  often not the office the application belongs to, and a counter scoped to its
  own office's files would miss exactly the boxes walking through its door.
  It is scoped to `Consignment`, never to `Application`: the counter never holds
  a file. **Payment is read-only to it and always will be** (spec §5.2) — a
  counter that could mark a file paid is a counter that can be argued with.
- **Sampling and the report are the visiting officer's work alone** (D88) —
  whoever proposed the inspection plan. A senior desk supervises and approves;
  it does not seal jars or write up a visit it did not make. **Holding the file
  is not enough for these two**, unlike everything else on the process page,
  because the file passes back through the approver's hands and he would
  otherwise inherit the officer's job with it. The panels still render for a
  reader — with the fields disabled and saying why — since the approver has to
  read what he is approving.
- **The FDO's sampling screen** (D87) sits on the process page once the plan is
  approved — sealing samples for an unauthorised visit would be jars nobody sent
  anyone to collect. `lib/samples/screen.ts` assembles it; the arithmetic stays
  Prisma-free in `plan.ts`.
- **Where several offices can run a test, the officer chooses** (D125). The
  order is **chosen → here → preferred → sole**: an explicit choice wins over
  everything, a standing `RoutingPreference` only pre-fills. The choice is
  `ApplicationParameterDestination` — **per application**, the same split as
  `SampleRequirement` against `OfficeSampleRequirement`, because it is a
  decision about one consignment and should not silently become policy.
  Only capable offices are offered, and `setParameterDestination()` refuses the
  rest itself rather than trusting the picker. **Nothing can be sealed while a
  test has no destination** — a specimen with nowhere to go is a jar nobody can
  account for.
- **Destinations are derived, counts are entered** (D69), and the screen says
  which is which. Every row is resolved from `LabRouting` — the officer cannot
  forget a lab or prepare a box nobody needs — and the one unknown is specimens
  per variant, which turns on sample quantity and destructive testing, the
  A§1.2 data nobody has collected.
- **A remembered figure is a suggestion, never a default.** It was agreed for a
  different consignment of the same sub-product, so filling it in silently would
  make last month's quantity this month's decision. It renders as
  *"2 last time — use it"*.
- **A cell resting on seeded routing says so** (D66). Nearly every one of the
  109,802 rows still points at the owning head-office section, and a destination
  nobody has chosen is not the same fact as one an office decided.
  `/labs/coverage` is where an office replaces them wholesale and
  `/labs/mapping` cell by cell.
- **Only `ref` is printed on a label** (D68). `/workflow/[id]/labels` renders a
  cut-up sheet with the QR to `/s/<ref>`, the sub-product, the size and the
  specimen number. **The brand is deliberately absent** — the variant *is* the
  applicant's identity (D71) — and `cmCode` and `labCode` are not even fetched.
  The QR is generated to SVG **on the server** (`qrcode`), so nothing reaches
  the client bundle and the same markup screens, prints and goes into a PDF.
- **Sealing is one irreversible act and the button says so.**
  `commitSampling()` refuses to run twice: the jars are about to leave in the
  applicant's hands, so a second plan would be specimens nobody can account for.
- **The inspection report is the wing's own form, improved where our data
  allows** (D86). `lib/cm/inspection-report.ts`; the catalogues
  (`INSPECTION_CONDITIONS` ×5, `INSPECTION_MARKINGS` ×9,
  `INSPECTION_NARRATIVE` ×11) are in `policy.ts`, taken from
  `utils/inspectionReport.html`. Three deliberate differences from the paper:
  - **Production as *found*, beside production as *declared*.** The paper form
    has one capacity box; we already hold what the applicant claimed in
    `ApplicationProduction`, so the report records what the officer saw next to
    it. "Did they under-declare" is the question an inspection exists to answer,
    and one box cannot ask it.
  - **Nothing is re-typed that the file already holds** — product, BDS numbers,
    company and factory are printed as context, not asked for. The paper asks
    because paper cannot look them up.
  - **The checks are rows, not columns.** Five conditions, nine marking items,
    eleven narrative sections: a column each means a migration every time the
    wing adds one, the same reasoning as the shortfall points.
- **The attachments the paper form wants are text.** There is no document store,
  so recording a file nobody can reopen would be worse than asking for the
  substance in words.
- **`reportGaps()` returns every gap at once**, so an officer fixes them in one
  sitting rather than meeting the next one after each save — the shape
  `missingForSubmission()` uses on the applicant's side. Sending is refused
  while any remain.
- **The report follows the same path as the plan**: written by the holder, sent
  to whoever handed the file down (D84), approved by him, numbered
  `বিএসটিআই/<office>/পরিদর্শন-প্রতিবেদন/<serial>/<year>` at approval. It is
  readable and downloadable **once sent up**, not only once approved — the
  senior approving it has to read it as a document.
- **[ASSUMPTION] The letter's Bengali wording is drafted, not supplied.** It
  follows the bank advice's register, which is the only other official letter
  the system issues. The facts in it are real; the sentences need a CM Wing
  officer's eye.
- **The proposer is on the team by default** — he is the one going, and making
  him tick his own name is a step that is wrong every time it is skipped. Only
  for a plan that does not exist yet: re-adding him to a saved plan would put
  him back on a visit a senior desk had removed him from.
- **The team picker is searchable and grouped by `groupByRank()`** — the same
  table the pass-down list uses, so an officer sees his colleagues under the
  same headings wherever he chooses from them. It matters here for the reason it
  mattered there: ten of the CM wing's Field Officers and six of its Assistant
  Directors are all on grade 9.
- **The team is chosen from the proposer's own section, not the office.** Head
  office has 392 desks and an inspection team is drawn from the wing that owns
  the file, so offering the building turns a short choice into a search and
  invites a Metrology inspector onto a CM visit. The section is
  `Desk.sectionUnitId`, the one the workflow chain already uses, so "who is in
  my wing" has one answer across the module. It **falls back to the office when
  the proposer holds no desk** — 249 of 731 do not, and an officer who cannot
  name a team cannot plan a visit at all — and the panel says so rather than
  silently widening the list.
- **Team members are rows, and replaced rather than merged.** A list diffed on
  save leaves somebody on the visit because nobody remembered to remove them.
  Each named officer is checked against the serving roster: a plan is an
  instruction to people.
- **Corrections are a loop between the holder and the applicant** (D81), run
  from `/workflow/[id]` and answered on the applicant's own application page.
  `lib/cm/shortfall.ts` is the server half; the rules are Prisma-free in
  `states.ts` (`editScope`) and `policy.ts` (`SHORTFALL_SECTIONS`).
- **Packaging artwork is marked per variant** — `artwork:<applicationSkuId>`.
  A licence covers every brand, size and flavour separately and each is sold in
  its own wrapper (D53), so "the artwork is wrong" is a statement about one jar;
  reopening every variant's artwork because one label is wrong invites the
  applicant to replace wrappers nobody questioned. The targets are **dynamic**,
  unlike the sections and the document checklist, so `raiseShortfall` checks the
  SKU belongs to that application before storing the point.
  **An artwork-only permission writes only the artwork**, enforced in
  `updateSku` and not in the form: the variant editor posts the whole article,
  so comparing what changed would let a resubmitted brand name through on a
  technicality. Everything but the label columns is simply not written, and the
  applicant gets a narrow "replace artwork" control rather than the editor.
- **A shortfall is an edit permission, not a note.** The officer ticks points
  from a closed list and each becomes a `ShortfallItem` row naming what
  reopens — a section like `production`, or `document:<kind>` for one paper.
  `editScope()` turns those rows into "may I write this", and **both the page
  that greys a step out and the route that refuses the write call it**, so they
  cannot disagree. A free-text note could not be turned into a permission, and
  reopening the whole application invites changes nobody asked for after the fee
  is paid.
- **The file never leaves the officer's desk during a round.**
  `holderEmployeeId` is untouched; the *state* is what says the applicant owes a
  response. Handing it back would put it in an applicant inbox that does not
  exist.
- **It runs any number of rounds** — the client's rule, which settles the
  "maximum rounds" half of §10 #7 — and ends when the officer marks the file
  ready, which is the existing `review_passed`. Nothing checks that a marked
  point was *actually* corrected: that judgement is the officer's, which is why
  the file goes back to him to look again.
- **There is no notification channel.** No mail (client addresses are often
  `@mobile.bsti.invalid` placeholders) and SMS is not enabled, so the panel on
  the application page *is* the notice. Do not describe the applicant as
  "notified" until a channel exists.
- **The attachments panel says the bytes are not stored.** The kernel document
  store does not exist, so an officer must not open that list believing BSTI
  holds the applicant's trade licence.
- **The desk flow is on the board**, collapsed, one query for every row
  (`flowsFor()`), rendered through the same `describeMovement()` the server half
  uses (D9) so a reassignment reads identically wherever it appears.
- **A file is held by a person**, `Application.holderEmployeeId`, and every
  hand-off writes an `ApplicationMovement`. "Nobody holds it" *is* the
  definition of unclaimed — there is no parallel state to disagree with.
- **Seniority is the pay grade, then the designation within it** — `seniority()`
  returns the pair (D78). The organogram puts a branch Director in the Executive
  unit beside their stenographer while the officers sit in sibling units, so
  depth is useless. It is the **employee's** grade, not the post's: an officer
  on grade 9 may sit on a post graded 11.
  **`Posting.orgPostId` is null on every row** — the organogram link is
  `Employee.orgPostId`. Read the posting's org post and every desk gets a null
  section and no chain.
- **The grade alone is not an order, and that is not a detail.** Assistant
  Director, Field Officer, Examiner, Inspector and Senior Examiner are *all*
  grade 9 — 16 of head office's 22 CM desks sit in that one band. By grade they
  were all peers, so an AD could not hand work to a Field Officer, which is the
  processing chain the spec names: office head → AD (CM) → FO (CM). The tie is
  broken by `deskRank()`, **the same table the picker groups by**, so the two
  can never disagree about who is senior. Purely additive: it only changes pairs
  that tie on grade, so nothing that worked before can break. 3,423 possible
  hand-offs became 4,730, and the desks that could reach nobody at all went from
  5 to 0.
- **An empty pass-down list is two different facts, and the board says which.**
  `candidates()` returns nothing both when the chain genuinely ends with you and
  when you hold **no organogram post at all** — and the second is an
  administrative fault somebody has to repair, not a fact about the file. 251 of
  731 employees hold no desk, so this is not a corner. The button used to be
  disabled with a `title` of *"No more junior desk in this section"*, which for
  a desk-less holder was true of nothing: he had no section. `deskOf()` answers
  it in one lookup the board already had the actor for, and the administrative
  case is stated **on the page rather than in a `title`** — a tooltip is
  invisible on a touch screen and easy to miss on any.
- **Pass down reaches your own level or below; send up is strictly senior**
  (D79). Sideways is a `down`. An earlier reading of D58 made same-level desks
  unreachable in either direction, on the theory that a sideways move would make
  "who holds it" a matter of who clicked — it does not, because the holder is a
  single column and every move is appended to `ApplicationMovement`, so the
  chain reads back whatever route it took. And it was wrong about the office: a
  section holding six Assistant Directors expects the one covering that product
  line to take the file from whoever received it. The two directions stay
  disjoint and together cover the section — verified over all 5,640 head-office
  pairs, none in both lists and none in neither.
- **An office head passing down is exempt from the grade test**, because an
  acting head is the top of their section whatever their own grade — which is
  the whole reason it is a role and not a designation.
- **252 of 731 employees have no `orgPostId`**, so they have no section and
  cannot be handed a file — 114 of them daily basis, who hold no sanctioned post
  by definition. See "Desks" above: what remains is organogram gaps, not
  missing matching. **No office head is among them any more**, so every office
  can at least start a file moving.

