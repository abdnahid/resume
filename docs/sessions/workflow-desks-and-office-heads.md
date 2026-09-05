# Working log — the workflow board, desks, and office heads

**What this file is.** A verbatim record of the working sessions on files moving
inside BSTI: the `/workflow` receive desk, the organogram placement that decides
who can be handed a file, and the `office_head` role that starts a file moving.
Started 2026-09-05, covering work that began 2026-09-02 with step 8a.

**Why it exists.** This piece of work runs across several days and two machines,
so no single session holds the whole thread. Nothing here is recoverable from
the code: it is the reasoning, the questions still unanswered, and the things
the client said that shaped the design.

**How to use it.**

- **Read it before resuming.** It is the context a new session does not have.
- **Append, never rewrite.** Each session gets its own `## Session N` heading
  with the date and which machine it ran on. Earlier sessions stay as written
  even where later ones contradict them — the plan carries the current answer.
- **Verbatim means verbatim.** The user's messages are reproduced word for word.
  Tool calls, file reads and intermediate analysis are not — only the
  conclusions that were actually stated.
- **Decisions belong in `docs/BUILD-PLAN.md`**, not here. When something is
  settled it gets a D-number there and this file records how it was reached.

**What came before this log.** Step 8a was built 2026-09-02 (D57–D59) and the
commits up to `3bb6e86` are the record; they are summarised in
`docs/BUILD-PLAN.md` and `CLAUDE.md` rather than repeated here.

---

## Session 1 — 2026-09-05 (Linux machine)

Picking the thread up after the previous session was closed unexpectedly. The
session opened with orientation, moved through a reported error, and ended
having fixed the data that was stopping files moving in five offices.

### User

> accidently closed claude. Are you aware of the current state?

### Assistant

Working tree clean, everything committed and pushed. Last commit `3bb6e86` — the
`/workflow` receive desk became count tiles plus a stage filter, and
`groupByRank()` grouped the pass-down picker into bilingual optgroups by
designation rank. Its own note says it was not verified in a browser.

Named blocker, still unfixed: `lib/workflow/chain.ts:52-53` restricts every
hand-off to the sender's own section, including the office head's, so a
Metrology head at a branch cannot pass a CM file into the CM section. D58 needs
amending. Two heads (Narsingdi, Narayanganj) also held no desk at all.

---

### User

> I have found an error in /hr/listing. I cannot access it. showing error

### Assistant

Ruled out the query layer: `npx tsc --noEmit` clean, and running the page's exact
server-side data fetch against the live database returned 731 employees, 557 org
posts, 30 roots and 23 offices with no throw.

The suspect was staleness, not code. The dev server had been running since 07:38
with a `.next` stamped 07:38, while `prisma/schema.prisma` and the whole
generated client under `generated/prisma/` were rewritten at 11:12. Next dev
holds the compiled Prisma client in its module cache, so regenerating underneath
a running server gives a 500 on every page that touches the database. Suggested
stopping dev, `rm -rf .next`, and restarting before looking further.

**Not confirmed.** The user did not come back with the error text, and moved on
to the next question. If `/hr/listing` errors again, this is still the first
thing to check — and the actual message is what decides where to look, because a
client-side crash in `EmployeeTable.tsx` (which assumes a non-null `name.en`
once you type in the search box) would look like a different bug entirely.

---

### User

> Why no deputy director is being shown in the pass down option?

### Assistant

Simulated `candidates(head, office, "down", {asHead: true})` for all 23 office
heads against the live database. Four separate causes, three of them correct
behaviour:

1. **At 13 branch offices the head *is* the Deputy Director.** Each has exactly
   one DD and `import:office-heads` made that person the head; `candidates()`
   excludes the sender, so there is nobody at that rank left to offer.
2. **At Head Office 22 DDs exist and 1 was offered.** The head is DD (CM) in
   section 212, Certification Marks Wing, which holds two DDs. The other 20 sit
   in Metrology (4), Standards (3), Admin (3), Executive (3), Physical Testing
   (2), MSC (1), and 4 held no desk. The section rule (D58) working as intended.
3. **At 5 offices the pass-down list was empty entirely** — the head held no
   `orgPostId`, so `sectionUnitId` was null and `canPassTo` refused at line 52
   before grade was considered: Narayanganj, Narsingdi, Rajshahi, Bogura,
   Khulna. **`CLAUDE.md` recorded two of these. It was five.**
4. **A genuine bug.** `EMPLOYEE_DESK_SELECT` in `lib/workflow/inbox.ts` selects
   `designationEn` only, and 42 desked employees carry only the Bangla — among
   them 3 Deputy Directors, 15 Assistant Directors and 11 Field Officers.
   `deskRank(null)` returns `Other`, so they appear at the bottom of the picker
   rather than under their rank. `RANK_TABLE` already holds every Bangla pattern
   that would match them; the field holding them is simply never read.

**Cause 4 is still unfixed** — offered, and the user went to the data instead.

---

### User

> All the directors are grade 4. We have director post at Khulna, Rajshahi,
> Chittagong. Other branch offices have Deputy Director as office head. Assign
> them grade 6. improvise the missing information and update database

### Assistant

The database matched the description exactly: 9 Directors, all on grade 4; 9
`Director` posts, all on grade 5; the three branch ones in `Executive
(Chittagong)`, `Executive (Rajshahi)` and `Executive (Khulna)`, all vacant.
Every other branch office's Executive unit already held a Deputy Director post
on grade 6.

**Two changes, both data.**

`prisma/seed-grades.ts` moves the nine Director posts from grade 5 to **grade
4**. That was the real blocker: desk matching is office → wing → grade → title,
so a grade no Director holds meant no Director could be seated anywhere,
including the two whose offices made them head.

`prisma/import/office-head-desks.ts` (new, `npm run import:office-head-desks`)
seats each office head on their office's **Executive** desk. This has to be its
own step, and that is the thing worth remembering: `import:desks` matches on the
head's own wing, but **a branch head is whoever is seniormost whatever wing he
came from, and his desk is the single post in Executive** — so matching on his
wing looks for a Metrology desk inside Executive and finds nothing. All five
failures were exactly that.

| Head | Office | Seated on | Improvised |
|---|---|---|---|
| K M Hanif | Narayanganj | Deputy Director (CM) | grade 6, from the post |
| Muhammad Shafiqul Alam | Narsingdi | Deputy Director (CM) | grade 6, from the post |
| Md. Zahurul Hoque | Bogura | Deputy Director (Physical) | — |
| Jahora Sikder | Rajshahi | Director | English designation, from the post |
| Rahima Talukder | Khulna | Director | — |

**Nothing was invented.** The two ungraded heads are the designated *Heads of
Office* — which is why `import:office-heads` picked them (a designated head
outranks seniority) and why nothing could seat them. Their grade is taken **from
the post they are seated on**, and the report names every such fill. Their
designation was left as *Head of Office* rather than overwritten with *Deputy
Director*: that is what the HR export says and it is the reason they hold the
role, so overwriting it would destroy the signal.

A second `import:desks` run then seated four head-office Directors (Admin,
Standards, Physics, Metrology) on their own wings' desks — a direct consequence
of the grade fix, and leaving them out would have landed it half-done.

`seed:grades` was also changed to group its writes into one `updateMany` per
grade. A round trip to the remote database costs about half a second, so
changing twelve distinct values took some five minutes as a write per post.

**Verified against the live database.** All 23 office heads hold a desk and
**every pass-down list is non-empty**, where five were empty before. Both
scripts re-run with zero further writes. 479 of 731 desked, up from 470; nine
Director posts on grade 4; seven of nine Directors seated.

Khulna is the visible answer to the question that started this: its pass-down
list now reads `Deputy Director: 2, Assistant Director: 4, Field Officer: 3,
Examiner: 6, …` where it was empty.

Committed as `d5e574d`.

---

### User

> I received an application in Golam Rabbani's profile and the application is
> stuck there. Can you bring it to current acting director's desk?

### Assistant

One file: **CM-2026-000019**, Istiak Sugar Refinary, Colour Fastness Ratings of
Textiles, Head Office, `submitted`, with a single `receive` movement to Golam
Rabbani and nothing after it.

**It was genuinely stuck, and the reason is structural.**
`Application.holderEmployeeId` is a person and "nobody holds it" is the
definition of unclaimed (D58) — which is the right shape and has one
consequence: a file does not fall back to anybody when its holder stops being
available. On top of that `pass()` lets only the holder move a file, and
retiring him released his desk, so he had no `sectionUnitId` and `canPassTo()`
refused before it ever looked at grade. D75's sender exemption does not rescue
this, because the section check comes first.

**Moved to Md. Alauddin Hussain**, the acting Director and Head Office's
`office_head` — where the file would have arrived had Rabbani never received it
(D57).

**The movement is a new `reassign` direction, not an `up`.** Nobody sent it, and
a log reading "sent up by Md. Golam Rabbani" would attribute an action to
somebody who had already left — in the one feature spec §8 calls most of the
perceived value of the system. `fromEmployeeId` still names him, so the break in
custody stays visible rather than being smoothed over. The log now reads:

```
Received by Md. Golam Rabbani
Reassigned to Md. Alauddin Hussain, from Md. Golam Rabbani
  — Reassigned by administration: Md. Golam Rabbani is retired.
```

`npm run fix:orphaned-files` is the general form — every file held by someone
not `active` goes to that office's head, idempotent, and it refuses rather than
guesses where the office has no serving head or where the head *is* the stuck
holder. **There is no screen for it.** Reassignment is on the step 8+ list and
the script is the only path today.

**Verified:** Alauddin holds the file, Rabbani holds none, no file anywhere is
held by a non-serving officer, and Alauddin can pass it to 21 desks including
all three CM Deputy Directors.

### User

> All the subsequent desks of processed application should be able to see the
> application and its current status. Can also see the desk flow

### Assistant

Built. A file used to leave your board the moment you passed it on, which is
right for "what is on my desk" and wrong for everything else — the officer who
wrote the inspection report is the one the applicant telephones, and he had no
way to answer.

**Standing comes from the movement log, not from a role.** `touchedBy()` returns
every application whose `ApplicationMovement` names you in either direction:
`toEmployeeId` is every desk that held it, and `fromEmployeeId` catches the one
case that misses — an office head who received a file and passed it down in the
same sitting. It is a fact about the file rather than a permission, and it
grants nothing: `PassPanel` and `ReceiveButton` still key off holding it, and
`pass()` re-checks on the server.

Deliberately **not** office-scoped. Somebody who handled a file and has since
transferred still handled it, and hiding it would make the history disagree with
itself.

A fifth tile, **"You handled"**, and a collapsed **Desk flow** on every card —
one `flowsFor()` query for the whole board rather than one per row, rendered
through the same `describeMovement()` the server half uses (D9), so a
reassignment reads identically wherever it appears.

**Also fixed while here:** `flowsFor()`, `movementsFor()` and the board's holder
line all read `designationEn` alone, so Afsana Hossain — one of the 42 who carry
only the Bangla — rendered with a blank designation. The same fallback as the
picker.

**Verified against the live database.** The file had moved on by then, which
made a better test than a synthetic one:

```
Md. Golam Rabbani     Deputy Director   → CM-2026-000019 [handled]
Md. Alauddin Hussain  Deputy Director   → CM-2026-000019 [handled]
KAWSER AHMED KHAN     Deputy Director   → CM-2026-000019 [handled]
AFSANA HOSSAIN        সহকারী পরিচালক    → CM-2026-000019 [mine]
মোহাম্মদ আরাফাত হোসেন সরকার              → nothing
```

And the flow reads end to end, in both languages:

```
Received by Md. Golam Rabbani — Deputy Director
Reassigned to Md. Alauddin Hussain, from Md. Golam Rabbani
  “Reassigned by administration: Md. Golam Rabbani is retired.”
Passed down to KAWSER AHMED KHAN, by Md. Alauddin Hussain
Passed down to AFSANA HOSSAIN, by KAWSER AHMED KHAN — সহকারী পরিচালক
```

### User

> The application is at Afsana hossain's desk. Why cant she see any Field
> officer to pass down?

### Assistant

Because **she is an Assistant Director on grade 9 and every Field Officer in the
CM wing is also grade 9.** `canPassTo` demanded the candidate be *strictly* more
junior by grade and refused peers by design (D58), so all 10 FOs and the 5 other
ADs were invisible. She could pass down only to the Office Assistant (g20) and
the Computer Operator (g16).

**The grade alone is not an order, and that is the real finding.** Assistant
Director, Field Officer, Examiner, Inspector and Senior Examiner all sit on
grade 9 — 16 of head office's 22 CM desks are in that one band. The codebase
already knew: `RANK_TABLE` was written for exactly this observation, and
`CLAUDE.md` already stated the chain as *"AD (CM) → FO (CM) carries it on"*. The
table was only being consulted to group the picker, never to decide seniority.

So `seniority()` now returns a **pair** — grade first, then `deskRank().order`
within it (D78, amending D58). Using the same table the picker groups by means
the order shown and the order enforced cannot drift apart.

**Purely additive.** It only decides pairs that tie on grade; where grades differ
the answer is unchanged, so no hand-off that worked before can stop working.
Peers remain peers: two ADs on grade 9 tie on both halves.

**Verified across all 23 offices, not just this one:**

```
possible pass-down pairs        3,423 → 4,730
desks that could reach nobody       5 → 0
```

Those five were **Cox's Bazar, deadlocked outright** — five desks all on grade 9
and not one hand-off possible between them. Eleven offices have only grade 9 in
their CM section and all of them were limited to head → FDO → back up.

The chain at head office now reads properly in both directions: Afsana passes
down to 10 Field Officers and up to the Director and 3 Deputy Directors; a Field
Officer sends up to 6 ADs, 3 DDs and the Director; a DD passes down to ADs and
FOs and up to the acting Director alone.

### Facts established this session

- **Directors are grade 4**, client-confirmed. The organogram's grade 5 was
  wrong and matched nobody.
- **The office head's desk is the Executive unit's post**, whatever wing he came
  from. This is a rule, not a repair, and it is why office-head seating cannot
  live inside `import:desks`.
- **`Posting.orgPostId` is null on every row** — the organogram link is
  `Employee.orgPostId`. (Carried forward from step 8a; re-confirmed.)
- Roster 731; desked 479; without a desk 252.
- Office heads: 23 of 23 assigned, 22 of 23 desked — Head Office's holds the
  Director post in additional charge instead, which is the same thing.
- **The export records the acting designation, not the substantive one.** That
  is how a Deputy Director arrived as a grade-4 পরিচালক.
- A file does not fall back to anyone when its holder leaves, and the holder is
  the only person who can move it. Both are deliberate; together they strand the
  file.

### User

> at BSTI head office sometimes a wing doesn't have a full director. At that
> time a Deputy director is given additional charge of Director. For example the
> deputy director currently assigned to CM wing is actually Director(additional
> Charge). How to handle it. And why current deputy director is unable to see
> 20063010031-KAWSER AHMED KHAN in the forward application dropdown menu?

### Assistant

**Kawser Ahmed Khan holds no `orgPostId` at all**, so `sectionUnitId` is null and
`canPassTo` refuses at `chain.ts:52` before grade is considered. Nothing to do
with the section or grade rule.

Why he has no desk is a matching flaw worth remembering. `import:desks` matches
his recorded wing **সিএম বিভাগ** by Bengali edit distance, and that matches
**CM Dhaka** (সিএম ঢাকা) — a *leaf section* — not the `Certification Marks Wing`
root. It then searches only that subtree, found CM Dhaka's one DD seat taken,
and reported *"every post at that grade is full"* while a vacant DD (CM) seat
sat in the sibling **Training** unit, out of scope. The same flaw hit
মোহাম্মদ আরাফাত হোসেন সরকার at grade 6 and মোঃ আলাউদ্দিন হুসাইন at grade 4,
whose Director post is in the sibling **Executive** unit.

### User

> id=19953010019 has already retired. Forgot about that. id=19953010017 is
> deputy director (CM) with grade 6 and acting director of CM

### Assistant

Both corrections mattered more than they looked.

**Md. Golam Rabbani (19953010019) was `status: active` and still in the HR
export** as a serving উপপরিচালক — so `import:retire`, which only removes people
the export does *not* contain, would never have caught him. He held both
`office_head` for Head Office and the DD (CM) desk, so an office's files were
arriving at somebody who had left.

**Md. Alauddin Hussain (19953010017) carried grade 4 and পরিচালক** — the *acting*
designation showing through, not his substantive rank. That is precisely the
confusion the new column exists to end. His `nameEn` also held the Bangla name,
because the HR detail API returned 500 for his record and the row fell back to
the preview; the export's own `conflicts` array records the scraped `name_en`.

**What was built.**

`Employee.actingOrgPostId` — a second, nullable link to a post (D74). The
officer keeps their own desk and holds the vacant senior post in charge, so
ending the charge is nulling one field rather than putting a moved link back.

**The acting post's grade wins over the officer's own**, and that is the whole
point. Everywhere else the employee's grade decides seniority — an officer on
grade 9 may sit on a post graded 11 and it is the officer who is senior.
Additional charge is the one case that inverts it. `toDesk()` therefore reads
section *and* grade from the acting post.

**Verified, and the proof is specific:** Alauddin's **plain** pass-down list —
with the `asHead` exemption switched off — is the same 19 desks as with it, and
includes S M ABU SAYED, a Deputy Director on grade 6. By his own grade 6
`canPassTo` refused that hand-off outright. He now ranks grade 4 inside section
212 by the ordinary rule, so the exemption is no longer what carries him.

`Desk.isActive` (D75) — a retired officer may never be handed a file, checked on
the candidate and **never on the sender**, because a file already in a retired
officer's hands must still be movable out of them. Office scoping is
`employeesOfOffice()`, which asks where somebody works and not whether they still
do, so without this a retiree holding a desk stayed in the picker. Found only
because the client mentioned the retirement in passing.

The picker also now falls back to `designationBn`, which fixes the 42 desked
employees who were being filed under **Other**.

`npm run import:hr-corrections` applies both record changes. It exists as a
script rather than a hand-edit because the export is re-imported and will
re-assert what it says, so a correction that contradicts it has to be written
down somewhere that survives — with the reason and who decided.

### User

> assaign 20063010031 to Deputy director(CM) of CM Dhaka seciton and
> মোহাম্মদ আরাফাত হোসেন সরকার to Deputy Director (CM) of Training

### Assistant

Both seated, and **Md. Alauddin Hussain gives up his substantive desk** as a
consequence — three serving DDs against two sanctioned DD seats is one too many,
and the third seat he actually occupies is the Director's, which is what the
charge means. That keeps every post inside its sanctioned count instead of
over-allocating one. It costs him nothing: `toDesk()` reads the acting post
first, so he keeps section 212 and grade 4. If the charge ends he needs a DD
seat back.

`import:desks` now skips anyone holding a charge, and anyone not `active`.
Without that, a DD seat falling vacant later would silently seat the officer
running the wing on a junior desk and demote him.

**Verified.** Alauddin's pass-down list is 21 and its Deputy Director group now
reads Kawser Ahmed Khan, S M Abu Sayed and মোহাম্মদ আরাফাত হোসেন সরকার. Kawser
passes down to 18 and sends up to exactly one desk — Alauddin — so the round
trip closes. Every DD (CM) post is 1/1, none over-allocated. 480 of 731 desked;
249 seatable and unseated, down from 252.

---

### Resume here

**State.** Typecheck clean, tree clean, committed and pushed. Not verified in a
browser — the dev server was running, so no build was made.

**Three things left undone, in the order they bite:**

1. **`candidates()` still blocks the hand-off the routing needs.**
   `lib/workflow/chain.ts:52-53` restricts even the office head to
   `sectionUnitId === sender.sectionUnitId`, so a Metrology head cannot pass a
   CM file into the CM section at all — the first hop of the real routing. D58
   needs amending: the head's **first** hand-off crosses into the *service's*
   section, and movement stays within that section afterwards. Now that every
   head holds a desk, this is the only thing between here and a file moving end
   to end.
2. ~~**Bangla-only designations land under "Other" in the picker.**~~ **Fixed**
   later in this session — `toDesk()` falls back to `designationBn`.
3. **The wing name matches a leaf section, not the wing root.** This is the
   flaw behind most of what went wrong this session: `import:desks` resolves the
   Bengali wing name to the closest *leaf* unit, so sibling `Executive` and
   `Training` units fall out of scope and it reports "every post at that grade
   is full" while a seat stands empty one unit over. Gazi Md. Nurul Islam
   (Chemical Testing, grade 4) is still unseated for exactly this reason. Fixing
   it means scoring the wing root as well as its children and preferring the
   root when the title matches a post under it — worth doing before the next
   wing's data arrives. Mobin Ul Islam is separate: a grade-4 Director on a
   Deputy Director (Textile) post from the original seeding, and `import:desks`
   only fills a null `orgPostId`, so moving him is a decision, not a repair.

**Also carried forward:** `/hr/listing` was reported erroring and the cause was
never confirmed — see session 1 above. And 15 offices still have no local
payroll admin, needing nomination at `/hr/listing/roles`.

**One thing to watch.** The HR export records the *acting* designation, not the
substantive one — that is how a DD arrived as a grade-4 পরিচালক. Other grade-4
Directors in the roster may be acting DDs the same way, which would mean the
seniority column is not always what it appears. Worth asking the wing.
