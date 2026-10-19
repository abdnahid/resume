---
description: "Who is in the roster and who is not — import rejections, desks, office heads, and the organogram's shape"
paths:
  - "prisma/import/**"
  - "lib/org.ts"
  - "lib/org-types.ts"
  - "lib/desk-service.ts"
  - "app/(main)/hr/**"
---

## Who is in the roster, and who is not

**731 of the 815 records in `utils/employee_bio.json` are imported; 44 are
rejected** — 23 name no office, and 21 have an email address where the id
should be, mostly shared One Stop Service accounts rather than people.

**The five biographical NOT NULL columns no longer hold anyone out.** They used
to reject 118 people, and none of them is read by `lib/salary/` or
`lib/workflow/` — they are profile and display fields. Keeping someone out of
the roster meant they had no desk and no file could reach them, which is a
working problem traded for a cosmetic one. So the gaps are filled with
stand-ins and **`Employee.identityIsProvisional` says so** (107 rows), the same
discipline as the seeded bank details and the provisional standard prices.

- **Date of birth is derived from the joining year in the id**, less 25–30
  years. The offset comes from the id rather than a random draw, so a re-import
  does not move someone's birthday. **Nothing computes off it** —
  `postRetirementLeave` and `fullRetirement` are stored columns.
- **Gender and marital status get `unspecified`, not a guess.** Inferring gender
  from a Bangladeshi name is unreliable and a wrong answer is shown to that
  person on their own profile. The value is offered in the profile and edit
  forms as "Not recorded", so it renders as what it is instead of blank — a
  blank select would be silently replaced by whatever was saved next.
- Missing parents' names become `Not recorded` / `তথ্য নেই`.

**The `no bio` group is gone.** 72 records used to carry a null `bio` because
the HR system's detail API returned 500; the refreshed export has all of them,
which is where 70 of the new arrivals come from. That was the valuable group —
18 of them CM Wing, the section whose workflow chain is one desk deep.

| Reason | Count | Fixable in our schema? |
|---|---|---|
| identity incomplete | **118** | Yes — see below |
| bad id | 21 | No |
| no office | 12 | Partly |

Many of the 118 are now missing only **one** field — gender alone, or date of
birth alone — rather than all five, so the group is closer to admissible than
it was.

**The rejections are two different problems, and they need different fixes.**

**The bare minimum a person needs, per function.** Worth knowing before
relaxing anything, because the schema demands far more than any of these use:

| Function | Genuinely needs |
|---|---|
| HR roster | `id`, `nameEn`/`nameBn`, `officeId`, `status`, `category` |
| Payroll — regular | + `category` and `grade` (→ PayScale grade×step), plus an active `Posting.officeId` for scoping, rent zone and advice |
| Payroll — daily basis | + office (→ zone → `DailyWageRate`) and a `DailyAttendance` row. No grade, no fixation |
| Workflow desk | + `grade` (seniority) and `orgPostId` (→ unit → section) |

**`dateOfBirth`, `gender`, `maritalStatus`, `fatherName*` and `motherName*`
appear nowhere in `lib/salary/` or `lib/workflow/`.** They are used by the HR
profile and edit forms and for display, nothing else. They are required by
`app/api/employees/route.ts` and by NOT NULL columns, and that requirement is
the only thing keeping those 115 people out. Date of birth is the one with a
real future use (retirement), and it is *not* computed today —
`postRetirementLeave` and `fullRetirement` are stored columns.

### Desks

**480 of 731 now hold an `orgPostId`** — 288 from the original seeding, 182
placed by `npm run import:desks` on 2026-09-05, then 5 office heads seated by
`npm run import:office-head-desks`, 4 head-office Directors by a second
`import:desks` run once Directors were graded 4, and the CM wing's two Deputy
Directors by `npm run import:hr-corrections`, all the same day.

Of the 251 who hold none, **one is holding a post in additional charge** and so
has a section anyway (`actingOrgPostId`, D74), and **one is retired**.
`import:desks` skips both: someone acting in a senior post must not be seated on
a junior seat that falls vacant, which would silently demote the officer running
the wing. **A seat it got wrong is corrected at `/hr/listing/desks`** (D131) —
the importer only ever *fills* a null `orgPostId`, so it cannot revisit one. The importer does *not* set it:
the export names an office and a wing, never a sanctioned post, so joining the
two is a separate, reviewable step that writes
`utils/desk-assignment-report.txt` listing every assignment it makes.

**The picker falls back to `designationBn`.** `EMPLOYEE_DESK_SELECT` used to
select the English designation alone, and 42 desked employees carry only the
Bangla — 3 Deputy Directors, 15 Assistant Directors and 11 Field Officers — so
`deskRank()` filed every one of them under **Other** while `RANK_TABLE` already
held the Bangla pattern that matches them. Fixed 2026-09-05.

**Matching is office → wing → grade → title.** The last two both matter:
সিএম ঢাকা has Field Officer (CM) and Assistant Director (CM) *both at grade 9*,
so grade alone put an Assistant Director on a Field Officer's desk. Routing
seniority reads the employee's grade, so nothing broke — but the desk a person
is shown at should be the job they hold.

**The two systems spell the same section differently**, with typos on both
sides — the export writes টেক্সটাইল and the organogram ট্রেক্সটাইল, the export
ব্যাকটেরিলিওজি and the organogram ব্যাকটেরিওলজি. So the wing is matched by edit
distance and anything inexact is reported separately for a human to read. The
organogram also writes **Barisal** where the office register writes
**Barishal** — the same alias the labs needed.

**249 are seatable and still have no desk, and every reason is an organogram gap
rather than a matching failure:**

| Reason | Count |
|---|---|
| daily basis — not on the sanctioned strength, so there is no post to hold | 114 |
| every post at that grade is already full | 60 |
| no post at that grade in that unit | 52 |
| wing matches no unit in that office — branch offices have one flat lab where head office has sections | 20 |
| no grade | 3 |

**One Director is still among them** — Gazi Md. Nurul Islam of Chemical Testing,
in "no post at that grade in that unit". His wing's Director post exists and is
graded 4, but it sits in the `Executive (<wing>)` child unit rather than the
wing his own wing name resolves to. **That is a matching flaw worth knowing**:
the Bengali wing name matches the closest *leaf* section, so the sibling
`Executive` and `Training` units fall out of scope. It is what hid the CM wing's
free Deputy Director seat and reported "every post at that grade is full" while
a seat stood empty one unit over.

**MOBIN UL ISLAM is a grade-4 Director sitting on a Deputy Director (Textile)
post** from the original seeding; `import:desks` only ever fills a null
`orgPostId`, so it does not move him.

### Can a CM application be worked in every office?

**All 23 offices now have an `office_head`**, assigned 2026-09-05 by
`npm run import:office-heads`. One thing still blocks the flow — see the
cross-section note below.

**Head Office's is the CM wing's acting Director** — Md. Alauddin Hussain
(19953010017), a Deputy Director (CM) on grade 6 holding the vacant Director
post in additional charge. The HR export recorded him as পরিচালক on grade 4,
which is the charge showing through rather than his substantive rank; that is
the confusion D74 exists to end. It had also put his Bangla name in `nameEn`,
because the detail API returned 500 for his record. Corrected 2026-09-05 by
`npm run import:hr-corrections`, which also **retired Md. Golam Rabbani**
(19953010019) — he held `office_head` and the DD (CM) desk while no longer
serving, and the export still lists him, so `import:retire` would never have
caught him.

**Who holds it.** A designated *Head of Office* where one exists (three people
are, and all three have no grade at all, so ranking by seniority would have
skipped exactly the right person); otherwise the seniormost officer of the
office, whatever wing he comes from. **At head office it is the CM wing's
seniormost officer, not the building's** — the Director (CM) post is vacant, so
DD (CM) acts in it, which is why D57 made this a role and not a designation.

**Payroll was not collateral damage — and the workaround is now obsolete.**
`User.role` was a single enum until D122, so granting `office_head` to someone
holding `officeadmin` silently removed their payroll authority, and the natural
head was the officeadmin at **14 of 23 offices**. The script therefore moves
`officeadmin` to the office's accounts desk where one exists and **reports the
office rather than guessing** where none does.
**A person may now hold both** (D122), so that displacement is no longer
necessary: the 14 offices could have their head hold `officeadmin` again, and
`import:office-heads` should stop moving it. Neither has been done — the
displacement is harmless and reversing it is a data change nobody has asked
for.

**15 offices have no local payroll admin** and need one nominated at
`/hr/listing/roles`: Barishal, Sylhet, Chittagong, Rangpur, Mymensingh, Cumilla,
Faridpur, Cox's Bazar, Bogura, Dinajpur, Noakhali, DMI, Narsingdi, Rajshahi,
Narayanganj.

**Every office head now holds a desk**, seated 2026-09-05 by
`npm run import:office-head-desks`. Five did not, and each could receive a file
and then not pass it on — `candidates()` works from `desksOfOffice()`, and
someone with no post has no section, so the picker came back empty and the file
stopped dead in his hands.

**Re-run it whenever the `office_head` role changes hands.** The seating is a
snapshot, not a rule: granting the role at `/hr/listing/roles` does not seat
anybody, so a head appointed after the last run has no desk and lands in exactly
the trap above. Faridpur's MD. KAMAL HOSSAIN sat there on 2026-09-10 — two files
on his desk and nobody to pass them to, while `Executive (Faridpur)` held one
vacant post, Deputy Director (CM) at grade 6, which is precisely his grade and
designation. The importer only ever fills a null `orgPostId`, so **it is safe to
run any time and is the first thing to reach for** before reasoning about the
chain. It also fills a missing English designation from the post it seats
someone on, which is where his came from.

**`import:desks` cannot seat a head, and that is why this is its own step.** It
matches office → wing → grade → title, which is right for the officers who do
the work. But a branch head is whoever is seniormost *whatever wing he came
from*, and the desk he holds is the single post in the office's **Executive**
unit — so matching on his own wing looks for a Metrology desk inside Executive
and finds nothing. Narsingdi, Narayanganj, Bogura, Rajshahi and Khulna all
failed exactly there.

**Two heads had no grade at all**, which is why `import:office-heads` picked
them (a designated *Head of Office* outranks seniority) and why nothing could
seat them. The grade is taken **from the post they are seated on** — Deputy
Director (CM), grade 6 — not invented, and the report names every such fill.
The same rule filled Rajshahi's missing English designation.

### The hand-off the routing needs, and does not yet allow

A branch office head may come from any wing — a DD (Metrology) at Barisal
receives CM applications — and must pass the file **into the CM section**,
where AD (CM) → FO (CM) carries it on. When the sampling letter is approved a
letter goes to the **testing wing head** of Chemical or Physical at that office,
who is simply the seniormost officer of that section: DD, AD or Examiner by
availability. At head office the CM wing director receives, and the
Physical/Chemical wing director gets the letter after approval.

**`candidates()` blocks the first step.** It restricts even the office head to
`sectionUnitId === sender.sectionUnitId`, so a Metrology head cannot pass a CM
file into the CM section at all. D58 needs amending: the head's first hand-off
crosses into the *service's* section, and movement stays within that section
afterwards.

**The testing wing head is whoever holds the wing's Director post** — not the
seniormost officer of the section (D94, superseding what this file said before,
which was written before additional charge was a column). Still no new table:
the post answers it.

The live roster shows why seniority does not: head office's **Physical Testing
Wing holds two grade-4 Directors**, one in the Director (Physics) post and one
sitting on a Deputy Director (Textile) post from the original seeding. They tie
on grade *and* on designation rank, so "seniormost" returned whichever the sort
happened to put first — not a way to address a letter.

So `wingHeadForLab()` asks the post, in one order: the officer holding it
substantively; the officer holding it in **additional charge** (D74) — the rare
case, and what that column exists for; otherwise **nobody, said out loud**.
Head office's Chemical Testing Wing runs on the **second** answer since
2026-09-13 (D132): Gazi Md. Nurul Islam has left Director (Chemistry) and
Md. Khalilur Rahman holds it in additional charge, so its sampling letters
resolve to an acting holder. The third answer — nobody, said out loud — is what
protects the case where neither exists: an unaddressed letter is fixed in a
minute, a letter addressed to the wrong Director is not noticed at all.

**A branch office has no testing wing** — its labs hang off the branch itself —
so `officeHeadFor()` answers there, which is what `office_head` already means.

Everything else is in place. **22 of 23 offices have CM-desked staff** — from 23
at Chittagong down to 1 at Patuakhali. The exception is **DMI, which has none**,
and by the jurisdiction default receives nothing anyway.

Eleven offices have only grade 9 in their CM section. That used to make everyone
there a peer, so a file could move head → FDO → back up and no further;
**Cox's Bazar was deadlocked outright**, five desks and not one hand-off
possible between them. Two changes fixed it: the grade tie is broken by
designation rank (D78), so AD (CM) → FO (CM) works inside the band, and a
hand-off to the same level is allowed (D79). **No desk in any office can now
reach nobody.** Patuakhali, with a single CM desk, still needs its office head
to be someone outside that section.

### The organogram is not full — it is the wrong shape

Checked 2026-09-05, because 54 posts hold 170 people beyond their sanctioned
count and that looks like overcrowding. It is not.

**In aggregate there is plenty of room.** 842 sanctioned posts excluding the 12
outsourcing ones, against **617 permanent staff** — 225 spare. No daily-basis
employee holds an organogram post; they are not on the sanctioned strength at
all. Grade 9 alone has **495 posts for 333 staff**.

**The mismatch is by designation, and it is of two kinds.**

*Designations the organogram has no post for:*

> **Superseded 2026-09-21 by D150.** The Examiner and Senior Inspector rows
> below were both symptoms of one mistranslation, not of a real gap — see
> "Post names are derived from the Bengali" at the end of this file. There are
> 65 Examiner and 22 Senior Examiner posts, and 0 Senior Inspector ones.

| Designation | Staff | Grade | Posts at that grade |
|---|---|---|---|
| ~~Examiner~~ | ~~40~~ | ~~10~~ | **Fixed 2026-09-21 (D150)** — পরীক্ষক was rendered *Inspector*; the posts existed under the wrong English word. |
| ~~Director~~ | ~~9~~ | ~~4~~ | **Fixed 2026-09-05** — the nine Director posts moved from grade 5 to 4, which is where all nine serving Directors are. |
| Chief Assistant | 6 | 12 | **none anywhere** |

*And one crowded at a grade that is otherwise half empty:*

| Designation | Posts | Staff |
|---|---|---|
| Field Officer | 25 | **61** |
| Senior Inspector | 22 | **0** |
| Assistant Director | 89 | 87 |
| Inspector | 66 | 70 |

61 Field Officers are being squeezed into 25 sanctioned posts while 22 Senior
Inspector posts at the same grade stand empty. That is where the over-allocation
comes from, and no matching rule can fix it — either the sanctioned counts are
out of date or the recorded designations are.

**A desk in the wrong office is released and re-matched.** The original seeding
put 15 people on posts in another office's subtree — a file routed to their own
office would have arrived at a desk in someone else's. `import:desks` releases
those before matching, so it is idempotent except for that one repair. 6 of the
15 found a seat at home; the other 9 have none at their grade there, which is
the honest answer.

**Do not "rebalance" to clear the over-allocation.** Simulated: a clean
capacity-respecting re-allocation of all 617 places only **359**, against 470
desked today. Releasing the excess would leave 120 more people unreachable by a
file than leaving it alone. The over-allocation is untidy; removing it is worse.

**54 posts are over their sanctioned count**, all from the original seeding,
which picked a post without checking capacity. `import:desks` never adds to
one: it only fills a seat that is free, and only ever fills a null `orgPostId`,
so a re-run cannot move anyone placed by hand.



## Designations and desks — the two halves (D149)

**The organogram is the client's own instrument and is not rebuilt here.** His
line, 2026-09-20: *"Organogram is the desk. I can create/delete/edit organogram
desk in the manage structure menu."* Posts live at `/hr/organogram/manage`. The
two things that screen cannot do are:

| Screen | What it owns |
|---|---|
| `/hr/listing/designations` | the employee's **recorded title** — merge, rename, per-person edit |
| `/hr/listing/desks/assign` | **bulk seating** — propose, review, apply |
| `/hr/listing/desks` | one person's seat, by hand (D131) — unchanged |

- **A designation is load-bearing, not a label.** `deskRank()` reads it to place
  somebody in a picker, `displayDesignation()` falls back to it wherever a desk
  is a guess, and the laboratory ladder turns it into a rung that decides who
  may sign a test report (D143). Renaming one moves files, so the service
  returns the rank change and the screen shows it before writing.
- **The naming problem is upstream of the seating problem.** 285 employees are
  designated something the chart holds no post of — 97 Examiners against zero
  Examiner posts — so no correct seat exists and `import:desks` matched on grade
  alone. That is where the 322 guessed seats came from. Fix the catalogue, then
  seat.
- **Group on the rank, split on the parenthetical.** `deskRank()` ignores
  `(CM)` and `(Metrology)` on purpose — they are one rank on a picker — but a
  *merge* keyed on rank alone sweeps *Deputy Director (CM)* into plain *Deputy
  Director* and loses the wing. A rank is what somebody is; a parenthetical is
  where.
- **Proposing never writes, and every applied placement goes through
  `setDesk()`.** A batch with its own path would be a second set of rules free
  to disagree. Vacancies decrement as the run proposes, or two people at one
  rank are offered the same seat. Partial success is reported rather than rolled
  back.
- **`Deputy Director (Chemistry)` used to rank as `Director`.** `RANK_TABLE`
  carried a row for `["director (physics)", "director (chemistry)"]` with the
  *same* label and order as the generic Director row below it, so it decided
  nothing it did not also break: "deputy director (chemistry)" contains
  "director (chemistry)". In the lab ladder that is the `wing_head` rung — the
  desk that approves a test report — reached by a title that says deputy on its
  face. The row is gone; Khalilur still heads the Chemical wing through his
  **acting** charge (D74), which is the correct route.
- **No audit table exists for employee facts**, so a rename leaves no history —
  the same standing as `import:hr-corrections`. It is reviewed before it runs
  and reports exactly whom it touched. Worth closing before go-live.


## Post names are derived from the Bengali (D150)

**The chart is a Bengali document.** BSTI's 1983 sanctioned organogram names
every post in Bengali; the English column was written beside it by hand and
drifted. `lib/org-names.ts` is now the one rule, called by both
`npm run fix:post-names` and `seed-organogram.ts` — they used to hold separate
English strings, so correcting one left the other to reinstate it.

**Two words were swapped, and it cost the whole seating model:**

| Bengali | was | is | meaning |
|---|---|---|---|
| পরীক্ষক | Inspector | **Examiner** | examines a sample at a bench |
| পরিদর্শক | Field Inspector | **Inspector** | inspects a factory in the field |

- **This is why the notes said there was no Examiner post.** There were 65, all
  labelled *Inspector*. 97 employees are designated Examiner, could not be
  matched, and `import:desks` fell back to grade — which is where every guessed
  seat came from. Do not re-add a claim that BSTI has no Examiner post.
- **"Field Inspector" is not a BSTI rank.** It appears nowhere in the Bengali.
- **Bengali is never rewritten** — it is the record. Only the derived column is.
- **A fragment no dictionary covers is skipped and reported**, never guessed: a
  post title is what somebody's job is called on their own screen. Add the term
  to `HEAD` or `QUALIFIER` and re-run.
- **A bare serial is dropped.** *পরিদর্শক (মেট্রোলজি) (২)* is the second post
  of that title in that section; `sanctionedCount` already carries the number.
- **`rankKey()`, not the label, compares a designation to a post.** `deskRank()`
  returns an unrecognised title with only its first letter capitalised, so
  *"Office assistant"* and *"Office Assistant"* read as two unrelated desks —
  38 people were stuck behind that alone. Use the label for display and
  grouping; use `rankKey()` for matching.
- **Batch by target name, never one `update` per row.** 126 updates inside one
  `$transaction` hit Prisma's 5s interactive cap exactly as CLAUDE.md warns;
  one `updateMany` per distinct title is ~30 round trips instead of 126.

**The client's vocabulary, settled 2026-09-21 (D151).** Corrections to the
dictionary, not to individual rows — change `lib/org-names.ts` and re-run:

| Bengali | English | not |
|---|---|---|
| রসায়ন | **Chemical** | Chemistry |
| পদার্থ / ভৌত | **Physical** | Materials |
| পুরকৌশল | **Civil** | |
| ই এন্ড ই | **E & E** | |
| মান | **Standards** | |

- **A bare rank takes its section's implied qualifier.** `পরিদর্শক` alone is
  always *Inspector (Metrology)* and `ফিল্ড অফিসার` alone *Field Officer (CM)* —
  those posts exist only in those sections, so the Bengali does not repeat what
  the unit says, but the English is read far from the chart. An explicit
  qualifier always wins.
- **A branch office's E&E posts are named for the bench they sit on** —
  *(E & E, Physical)*, because a branch has one physical lab rather than a
  section per discipline. That is the chart's own idiom, not an invention:
  Khulna's Bengali reads *ই এন্ড ই, পদার্থ*. Head office keeps the full
  *Electrical & Electronics*, where it is a section under the Physical Testing
  Wing. `contextualQualifier()` decides, on the unit name.
- **A comma-joined qualifier is translated part by part.** Matching the pair as
  one string let the longest substring key win and dropped the rest — *(রসায়ন,
  মান)* became plain *Chemical* and the Standards Wing disappeared from four
  titles. Splitting also means pairs need not be enumerated: *পুরকৌশল* +
  *পদার্থ* compose to *Civil, Physical*.
- **Bengali serials are stripped** — *(১)*, *(২)* — the one thing that edits the
  Bengali, on the client's instruction. `sanctionedCount` already carries the
  number and the organogram renders the Bengali.
- **Unit names are not renamed with the posts.** `lib/labs/` matches
  `"Testing Wing"` on unit names and 46 `Lab` rows were seeded from them, so
  *Chemistry Lab, Chittagong* stays inconsistent with *Examiner (Chemical)*
  until somebody decides to migrate both together.
- **`import:hr-corrections` asserts post names literally.** Its guards check
  that an id still means what it did; renaming a post breaks them, and they must
  be updated in the same change.


## Desks and designations — two tables (D153), cached both ways (D154)

```
Designation ──designationId──> Employee ──EmployeeDesk──> OrgPost ──> OrgUnit
  130 unique titles              one              many (1 primary)     the section
```

- **A desk is per section; a designation is not.** Three offices' *Assistant
  Director (Chemical)* desks are three `OrgPost` rows — the seat carries the
  unit that routes a file (D58) — while the designation is one row held by
  everybody of that rank. That is why one shared table could not do both.
- **The catalogue is exactly the organogram's titles**, 130 of them. A roster
  designation that is not one of them is merged onto one, and the rule that
  does most of the work is **their own desk's title where it agrees in rank**
  (200 of 489). 242 are left unmatched on purpose: *Assistant Director* with 19
  candidates is a real choice.
- **One designation, many desks — one primary, the rest additional charges.**
  D74's single `actingOrgPostId` is now the special case. Exactly one primary is
  enforced in `setDesks()`, not by the database: a partial unique index is not
  expressible in the schema.
- **Desks are replaced, never diffed.** A list merged row by row leaves somebody
  on a desk because nobody remembered to take them off it.
- **`orgPostId`/`actingOrgPostId` are mirrors, not the authority.** 51 call
  sites still read them, so `setDesks()` *and* the older `setDesk()` both keep
  them in step. If you add a writer, write the table and the mirrors together —
  a desk assigned through only one of them is invisible on the other screen.
- **Officers group by wing, everybody else under one Staff heading.** Grades
  1–9 are the officer cadre where the wing is the distinction that matters among
  88 titles; 10–20 are clerical and trade desks where it means nothing.
  `Designation.wing` is derived from the posts' wing ancestor, with the title's
  own qualifier breaking a tie and filling the gap for branch-only titles.
- **The desk picker is one office's organogram and nothing else** — what the
  client asked for, and what `setDesks()` enforces anyway.
- **Cached on both sides, tagged per office** (D154). `lib/hr-cache.ts` holds
  the `unstable_cache` entries; every write calls `revalidateOffice()`. Never
  revalidate globally: correcting one Faridpur row must not drop head office's
  391-row payload. `QueryProvider` is scoped to the screen, not the root layout.

## One title catalogue for both (D152)

> **Superseded by D153** — `JobTitle` was split into `Designation` and
> `EmployeeDesk`. Kept for the reasoning about the catalogue's contents, which
> still holds.


```
JobTitle ──titleId──> OrgPost ──unitId──> OrgUnit     the desk: a seat in a section
    ^
    └──designationTitleId── Employee                   the designation: a word
```

**`/hr/listing/desks` sets both, per person, two pickers side by side.** It
replaced D149's separate designation screen, which edited `designationEn`
directly and would now desync it from the catalogue.

- **A desk is an `OrgPost`, never just a title.** The post carries the unit and
  the unit routes a file to a section (D58). Normalising the label must not
  dissolve the routing model — so the catalogue holds the *titles* and the desk
  still points at a seat.
- **They are allowed to differ** (D124), and a rank difference is flagged, not
  refused: an Inspector (Metrology) on an Examiner (Chemical) desk because he
  knows chemistry is deliberate.
- **A bare rank and a qualified post are both real titles.** *Assistant
  Director* (what HR records) and *Assistant Director (CM)* (what the chart
  sanctions) are not a spelling mistake, and merging them would lose the
  section. Only same-job-different-spelling folds, on `rankKey()`.
- **Everything the seeder matched is `designationIsInferred: true`** and it
  never clears the flag. Choosing a value on the screen is what clears it — the
  same act as confirming a seat. 731 of 731 are inferred until a human touches
  them.
- **`designationEn`/`Bn` are kept in step with the chosen title.** They are the
  import record and the title is the authority, but every screen not yet
  migrated still reads the text, and two columns describing one fact must not
  disagree while both are live. `setDesignationTitle()` writes both.
- **`seed:job-titles` upserts on `titleKey`**, so re-running adds new titles
  without renumbering: a designation corrected by hand points at an id, and a
  catalogue rebuilt from scratch would silently repoint it at another job.
- **A Bengali designation the rank table does not recognise becomes its own
  title** rather than being guessed into an English one — it shows in the
  picker for somebody to reassign.


## Desks outside the organogram (D155)

**A temporary desk is an `OrgPost` with `isSanctioned: false` and
`sanctionedCount: 0`.** Never a second table: files route to a desk, work orders
sit on one, the lab ladder ranks by one — a desk in a parallel table could not
hold any of it, and regularising would become a migration instead of a flag
flip. When the sanction arrives the post joins the establishment and **nothing
moves**; the holders and the work keep the same post id.

- **`sanctionedCount: 0` is the trick.** *held 1/0* already reads as "one
  person, no sanctioned seat", and over strength is `posted − sanctioned`, so
  the exception shows up in arithmetic that already existed.
- **The reason is required, the creator is recorded, and `regularisedMemoNo` is
  the evidence afterwards.** An establishment exception is the first thing an
  auditor asks about.
- **The unit is the decision, not the title** — it is what routes the file. The
  form asks for it first and says why.
- **Superadmin only**, unlike ordinary post creation which an officeadmin may
  do: an office that could mint desks could grow its own sanctioned strength.
- **No script creates one.** `import:desks` and `fix:seat-by-designation` fill
  sanctioned posts only.
- **`/hr/listing/manpower`** reports sanctioned · posted · over strength ·
  outside organogram, and lists every temporary desk with its reason. Reporting
  only the first two would hide the thing the exception exists to make visible.

**Over strength is a warning, never a refusal** (same decision). BSTI posts more
people to a desk than it sanctions as a matter of course. `setDesk()` used to
throw, which is what made a select appear to "snap back" to its old value — the
write was rejected and the refusal rendered off-screen. It now warns, naming who
else is on the desk, on the row.


## One row per seat, and tenure is history (D156)

**557 posts became 854 seats.** `OrgPost.seatNo` numbers them within (unit,
title); existing rows kept their ids and became seat 1, which is why
`hr-corrections.ts`'s hardcoded ids and every file in flight survived.
`sanctionedCount` is now only ever **1** (a sanctioned seat) or **0** (outside
the organogram) — it says whether the row counts toward strength, not how many
people fit on it.

- **`EmployeeDesk` is a tenure, not a current state.** Rows are **closed** with
  `releasedAt` + `releaseReason`, never deleted. The current holder is the open
  row. Before this, reassigning somebody deleted the old row and the previous
  tenure was lost — a data-loss bug, not a missing feature.
- **`kind`**: `substantive` (their own post, what files route to) ·
  `additional_charge` (D74) · `attachment` (working here, belongs elsewhere).
  `isPrimary` is gone; `kind === "substantive"` replaces it.
- **No unique index on (employee, post)** — a person may return to a desk across
  a career, and a partial unique on "one open tenure per seat" is not
  expressible here. `setDesks()`/`setDesk()` enforce it.
- **Any new writer must close, not delete**, and must keep
  `Employee.orgPostId`/`actingOrgPostId` in step — they are still read by 51
  unmigrated call sites.
- **`fix:unpack-seats` runs create → spread → exile, in that order.** The first
  version computed the excess up front against the old `sanctionedCount` and
  exiled 139 people who had a vacant seat waiting. Each phase must read the
  state it actually runs against. It is idempotent.
- **A seat is labelled by its occupant**, not a held count: two rows share a
  title now, so `vacant` / `held by <name>` is what distinguishes them.

**Unpack the organogram, never the seating** (D156, corrected 2026-09-21). The
854 seats come from `sanctionedCount` and are right. What was wrong was the
exile step: manufacturing a post for every holder with no seat **built structure
out of a guess** — six Coordination Officer desks were created for six people
`import:desks` had wrongly seated there, not one of them designated Coordination
Officer. `fix:withdraw-unpack-desks` undid it. Whoever has no seat is left
**unseated and named**; a temporary desk (D155) is created by hand when somebody
decides one is needed, never by a script reading who happens to be sitting where.

**Seed an occupancy map from the database, not from the run.**
`fix:seat-by-designation` counted only the placements it made itself, so a seat
held by somebody it was not moving read as vacant and was given to a second
person — 27 double-held seats. Anyone the run *is* moving is excluded, because
they are about to leave.

**No server-side cache on `/hr/listing/desks`** (D154, amended 2026-09-21).
`unstable_cache` was removed after it served a stale payload through a reload:
`/api/employees/[id]/desk` never called `revalidateTag`, so a saved desk was
invisible for five minutes. **If you add caching back, do not key it on a tag
every write path must remember** — cache behind the service, on the rows it
reads. The client cache (TanStack Query) stays; it is invalidated by the
mutation itself and refetches with `refetchType: "all"`.

**Structure outside the organogram is created in Manage Structure** (D157), not
on the assignment screen. `+Temp unit` and `+Temp post` on any unit row;
assignment stays at `/hr/listing/desks`, which keeps a pointer rather than a
second creation path — two ways to make one kind of thing is how they drift.

- **A section can be an exception too.** `OrgUnit.isSanctioned` mirrors
  `OrgPost`'s. The unit is what routes a file, so where an office runs no
  section of that discipline the *section* is the part that must be creatable —
  hanging the desk under Administration instead would send the officer's work to
  the wrong place rather than to none.
- **`sumSanctioned()` counts sanctioned seats only**, so an exception never
  inflates a unit's strength; a temporary post renders as *outside organogram*,
  never as `0×`.
- A temporary desk may sit vacant, exactly like a sanctioned one — creation and
  assignment are separate acts.

**The desks roster groups by the organogram's own sections, ordered by grade**
(D158). `staffSection()` decides the heading: officers (grade 1–9) by the
**unit their desk sits in**, grades 10–20 under one *Staff* heading, and
*No desk yet* for anyone unseated — the worklist, kept together whatever their
grade.

- **Sections follow the chart, read depth-first** (`chartOrder()`), never
  `OrgUnit.sortOrder` directly: that column is per *parent*, so comparing it
  across wings put head office's *Document Control* above the Director
  General's own section.
- **Rows move between headings as desks are assigned, and that is wanted** —
  somebody jumping into their section confirms the assignment took.

## The desks screen is built for 391 rows (D159)

**Two things made it slow, and they were independent.** Measured 2026-09-23 on
head office, which is the only office where it bites: 391 employees, 130
designations, 393 desks.

**The table rendered 359,156 `<option>` elements — 31 MB of HTML.** Every row
carried three pickers, each holding the whole catalogue: `391 × (130 + 393 +
393)`. The browser parsed it, hydrated it, and **reconciled it on every
keystroke in the search box**, which is why searching felt worse than loading.

- **A closed picker holds its placeholder and the one option it is currently
  showing.** `LazySelect` builds the real list on approach. 1,633 options for
  the whole table instead of 359,156.
- **The row arms its own pickers**, on `onMouseEnter` / `onFocusCapture` /
  `onTouchStart` — a pointer cannot reach a select without crossing its row and
  focus cannot land on one without entering it, so the list is built while
  somebody is still moving towards it rather than in the instant they press.
  The select keeps its own `onMouseDown`/`onFocus` handlers as a backstop for a
  press that skips both.
- **Never prefill every row "when idle".** It would undo the whole thing: the
  search box's job is to unmount 390 rows, and filled rows are 900 option nodes
  each to tear down.
- **The row is `memo`'d and every prop into it is stable** — the choice lists
  are memoised, `onSave` is a `useCallback`, and the save state is narrowed to
  *this* row's message, so a save on row 300 does not re-render row 1.
- **`deskLabel()` is computed once per desk, not once per cell.** It was called
  391 × 393 × 2 times per render.

**The server made nine round trips to Neon, at roughly half a second each.**
Prisma loads each relation level as its own query, so the roster was five and
the desk list four.

- **`staffOfOffice()` and `deskOptions()` are one `$queryRaw` each**, with the
  desks aggregated by `json_agg`. Same discipline as `lib/labs/mapping.ts`.
- **`chartOrder()` runs beside the roster query, not in front of it.**
- **`deskOptions()` scopes to the office's units in SQL.** It read all 855
  posts and filtered in JS, which is twice what head office needs and thirty
  times what a regional office does.
- **A seat with two open tenures names its substantive holder.** Three posts
  carry one, somebody on the post and somebody acting in it (D74), and the
  aggregate orders on `kind`. The old code took `holders[0]` with no ordering
  and got the right name by accident of row order — so this was a latent bug,
  not a behaviour change.

**Verified against the previous implementation across all 23 offices**, row for
row and field for field, before and after. Do that again if you touch either
query: they are the only two reads on a screen whose whole purpose is to be
trusted with the establishment.

| | before | after |
|---|---|---|
| page HTML | 31,054,616 B | 1,196,470 B |
| `<option>` elements | 359,156 | 1,633 |
| page request (dev) | 4.26 s | 0.80 s |
| the three reads | ~2.7 s | ~0.2 s |
| `/api/hr/desks` (refetched after every save) | ~2.7 s | ~0.3 s |
