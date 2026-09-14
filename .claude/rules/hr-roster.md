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

| Designation | Staff | Grade | Posts at that grade |
|---|---|---|---|
| Examiner | 40 | 10 | **none anywhere** |
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

