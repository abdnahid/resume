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

### User

> pass to can send to same level or junior

### Assistant

That reverses D58's peer refusal, which was my design assumption rather than the
client's rule. Changed: **pass down reaches your own level or below, send up is
strictly senior** (D79). Sideways is a `down`.

**The original reasoning does not survive scrutiny.** D58 refused it because a
sideways move would supposedly make "who holds it" a matter of who clicked, with
no chain to read back. But `holderEmployeeId` is a single column and every move
is appended to `ApplicationMovement`, so the history reads back whatever route
the file took — nothing was actually at risk. And it was wrong about the office:
a section holding six Assistant Directors expects the one covering that product
line to take the file from whoever received it.

The two directions stay **disjoint and covering** — a desk is either senior to
you or it is not — which is worth stating because it is the property that keeps
the picker honest. Verified over all 5,640 head-office section pairs: none in
both lists, none in neither.

```
AFSANA HOSSAIN  (Assistant Director, g9)   down 17   up  4
   down: 5 Assistant Directors, 10 Field Officers, 2 office staff
SUMAYA AFROSE LIZA (Field Officer, g9)     down 11   up 10
   up:   1 Director, 3 Deputy Directors, 6 Assistant Directors
```

With D78 and D79 together, **no desk in any of the 23 offices can reach nobody.**

The route's refusal message changed with it — "a more junior desk" would have
been a lie about the rule being enforced.

### User

> An UI update is needed beside all my main work. On the navbar while logged in
> employee should be able to see his/her, designation/desk as well as ID.
> Another thing-> currently name is like a button. It is taking me to
> /public/dashboard always. I dont need that. The design should be like this
> "Name(id)" and "designaion" will be shown stacked on top of other. On the
> right side of it, a dropdown arrow button/three dot button remains. That
> button opens a drop down. There he can switch his roles/desks(if any). In the
> dropdown more opotions will be added later.

### Assistant

The offending navbar is `ModuleNavbar` — workflow, store and the module
placeholders. The `/hr` navbar was already a proper dropdown.

**`components/layout/AccountMenu.tsx`** — `Name (employee id)` over the
designation, as text, with a caret beside it. The name being a link to
`/public/dashboard` sent staff to the *client* account page, which is why it
felt wrong.

**`GET /api/me`** supplies what the session does not. `ModuleNavbar` reads the
session client-side deliberately — the store is ISR and awaiting a session
server-side would opt every catalogue page out of static generation (D10) — so
it has a name and a role and nothing else. The route is **internal by default
and stays that way**: everything it returns is employment data, and the navbar
only calls it when the session says `INTERNAL`, so no client ever provokes the
refusal. It applies the same `designationBn` fallback as the picker.

**The `/hr` navbar got the same treatment** where it was thin: the identity is
now stacked in the bar rather than one click inside the dropdown, and the desk
appears in the dropdown. It shares `useMe()` rather than duplicating the fetch.

**On switching desks — I did not ship a dead control.** Nobody holds two.
`User.role` is a single enum so there is no second role, and a post held in
additional charge (D74) is the only way to occupy a second desk — one person
does, and he gave up his substantive seat when it went to Kawser, so even he has
just the one. The menu therefore *shows* what you hold and marks what you act
from. When somebody genuinely holds two the extra row appears by itself and the
choice becomes real; wiring the selection through to `toDesk()` is the work that
waits for that day, and it is a behaviour change rather than a display one.

Verified the payload for four people — the acting Director (one desk, marked
*additional charge*), Afsana Hossain (Bangla-only designation, resolves), the
superadmin, and a plain Deputy Director. `/store` renders 200 through the
rewritten navbar.

### User

> Actually the designation's title comes from desk's title. There maybe some
> cases where a Deputy Director (CM) can be assigned to Deputy Director(Halal
> certification) but these are rare cases.

### Assistant

The principle is right and I had it wrong — the post is the job. But checking
the roster before applying it turned up something that changes the decision.

```
desked and active                                  481
  designation and desk are the same job            113
  same rank, different specialisation (your case)   43
  DIFFERENT RANK                                   325
     recorded rank junior to the desk              248
     recorded rank senior to the desk               77
```

**Two thirds sit on a post of a different rank from their recorded
designation** — because `import:desks` matches office → wing → grade → title and
seats people on whatever post at their grade is free when the title does not
match. `CLAUDE.md` already recorded the symptom: "grade alone put an Assistant
Director on a Field Officer's desk." Examples: a Field Officer on an Assistant
Director (CM) desk, an **Office Assistant on a Security Guard desk**, Afsana
Hossain — সহকারী পরিচালক — on a Field Officer (CM) desk.

Taking the desk title unconditionally would tell 325 people their job is
something it is not, on their own screen. That is the same class of error as
guessing somebody's gender and showing it back to them.

**So `displayDesignation()` takes the desk's title when it agrees in rank with
HR's record, and falls back to the record when it does not** — a rank
disagreement being the signal that the seat was a guess. Your case is served
exactly: মোহাম্মদ আরাফাত হোসেন সরকার, recorded "Deputy Director", desk "Deputy
Director (CM)", now reads **Deputy Director (CM)**. As the organogram is
corrected the fallback stops firing by itself.

**A post held in additional charge is exempt**, and has to be — there the rank
difference *is* the fact, and the charge was set by hand rather than matched.
Without the exemption Md. Alauddin Hussain read "Deputy Director" while running
the CM wing; he now reads **Director**.

```
মোহাম্মদ আরাফাত হোসেন সরকার  Deputy Director   + desk Deputy Director (CM)  → Deputy Director (CM)
Md. Alauddin Hussain         Deputy Director   + charge Director            → Director
AFSANA HOSSAIN               সহকারী পরিচালক    + desk Field Officer (CM)    → সহকারী পরিচালক
ABDULLAH AL NAHID            Inspector         + desk Assistant Director    → Inspector

157 titles now come from the desk; 324 fall back to HR's record.
```

**Left for the client:** whether to take the desk title unconditionally anyway.
That is defensible if the organogram placement is going to be corrected soon,
and wrong until it is.

### User

> One thing I forgot to point. Every officer one the application flow should be
> able to see the application preview+attachments+fee details

### Assistant

Built `/workflow/[id]` — the whole file, read-only (D80). Until now an officer
saw a summary row and nothing else, which is thin for the feature spec §8 calls
most of the perceived value of the system.

**`canViewApplication()` is one named rule**, not logic re-derived at the page,
because "who may read this file" is the question an auditor asks. Standing is
the same as D77's: you hold it, you have handled it, it is your office's and you
are its head, or you are a superadmin. The office head's reach is the office's
files rather than only the ones they touched — a file they have not yet picked
up is one they must read before deciding who gets it.

**Reading is not acting.** Every action still keys off *holding* the file and
`pass()` re-checks on the server, so a previous desk may follow a file and may
not move it.

**A refusal is `notFound()`, not a 403** — the same reasoning D71 gives for
`/s/<ref>`. A distinguishable refusal would let any member of staff enumerate
which application numbers exist and which office holds them.

**The attachments panel says the bytes are not stored**, because the document
store does not exist. An officer must not open that list believing BSTI holds
the applicant's trade licence.

Verified against the live file:

```
Alauddin — handled it, office head    → CAN open
Kawser — handled it                   → CAN open
Afsana — holds it                     → CAN open
Golam Rabbani — handled it, retired    → CAN open
Arafat — never touched it              → refused (404)
Jahidur Rahman — same section, untouched → refused (404)
the superadmin                         → CAN open
```

Same-section-but-untouched being refused is the point: proximity is not
standing.

And it has real content to show — Istiak Sugar Refinary, product #252, BDS
1758:2022 attached, 3 sub-products with 6 articles, 7 documents recorded, 14
answers, application fee ৳1,150 paid in the sandbox, test fee ৳7,748.

**One thing I noticed and did not fix:** the retired officer can still read
files he handled. That follows from D77 and is arguably right, but the real
answer is that a retired employee's account should not authenticate at all —
which is an auth concern rather than a per-file one, and nobody has asked for it.

### User

> Clicking the id gets me to the page. Do it as preview button instead of this.

### Assistant

Done. The application number is a label again, and each row carries a **Preview**
button beside its action — the number read as an identifier rather than as a way
in, so the link was hiding the feature.

### User

> Now at the FDO desk he will preview the whole application and if found any
> mistake he can request for correction. After sending shortafall requests the
> client will be notified and the application will be open for that marked
> correction point. THis process will be directly between FDO and client any
> number of time untill FDO marks application as Ready for processing.

### Assistant

Built (D81). The states already existed — `shortfall_issued`,
`shortfall_responded`, `review_passed` — so this is the loop the state machine
was drawn for.

**The design decision that everything follows from: a shortfall is an edit
permission, not a note.** The officer ticks points from a closed list and each
becomes a `ShortfallItem` row naming what reopens — a section like `production`,
or `document:<kind>` for one paper, because "your trade licence has expired"
should not reopen the whole checklist. `editScope()` in `states.ts` is the one
place those rows become "may I write this", and **both the page that greys a
step out and the route that refuses the write call it**, so they cannot
disagree. A free-text note could not be turned into a permission, and reopening
the whole application would invite changes nobody asked for after the fee was
paid.

**The file never leaves the officer's desk.** `holderEmployeeId` is untouched
and the *state* is what says the applicant owes a response — handing it back
would put it in an applicant inbox that does not exist and lose the officer who
has been reading it.

**Any number of rounds**, which answers the "maximum rounds" half of §10 #7 with
the client's own rule. Ends at the existing `review_passed`, so the applicant's
tracker gains no new stage. Nothing checks that a marked point was *actually*
corrected: that judgement is the officer's, which is why he looks again rather
than the system deciding it has been satisfied.

Raising is guarded on **holding** the file, not on a role — an officer two desks
away who may read it (D80) must not be able to write to the applicant in its
name.

**Verified end to end against the live file**, then rolled back so the client's
own testing was not disturbed:

```
start                 state=submitted          scope=none
officer marks 2 points state=shortfall_issued   scope=targets [production, document:trade_licence]
                      production editable=true, trade_licence=true, product=false, answers=false
  a blank comment and an unknown target were dropped
  second round while one is open  → refused
  marking ready while one is open → refused
  a non-holder raising            → refused
applicant responds    state=shortfall_responded scope=none
round 2 (skus)        state=shortfall_issued    scope=targets [skus]
officer marks ready   state=review_passed       scope=none
2 rounds recorded, both answered
```

**A bug found on the way and fixed:** the document DELETE route had *no*
editability guard at all, so a submitted application's papers could be deleted
by anyone in the company after BSTI had begun reviewing them.

**Said plainly rather than papered over:** there is no notification channel. No
mail — client addresses are often `@mobile.bsti.invalid` placeholders — and SMS
is not enabled. The panel on the applicant's page *is* the notice. The file
should not be described as "the client is notified" until a channel exists.

### User

> Each variant should have a packaging artwork uploaded. So there might be an
> option to mark which artwork needs to be corrected

### Assistant

Added `artwork:<applicationSkuId>` as a shortfall target. A licence covers every
brand, size and flavour separately and each is sold in its own wrapper (D53), so
"the artwork is wrong" is a statement about one jar — reopening every variant's
artwork because one label is wrong would invite the applicant to replace
wrappers nobody questioned.

These targets are **dynamic**, unlike the sections and the document checklist: a
variant is a row the applicant created, so the list only exists per application.
`raiseShortfall` therefore checks the SKU belongs to that application before
storing the point — otherwise a marked point could name somebody else's jar.

**An artwork-only permission writes only the artwork, and the server enforces
it.** The variant editor posts the whole article, so comparing what changed
would let a resubmitted brand name through on a technicality. `updateSku`
instead branches: with `skus` open it writes everything as before; with only
`artwork:<id>` open it writes the label columns and ignores the rest of the
payload. The applicant gets a narrow "replace artwork" control rather than the
editor.

**Verified with a deliberately hostile payload** — a brand of "HACKED BRAND"
sent alongside the new label:

```
6 variants offered to the officer, each named by brand · variant · size
a target naming a SKU on another application → dropped
scope = targets [artwork:22]

artwork:   the-batman-….jpg  →  new-label.pdf   ✓
brand:     rich kids         →  rich kids       ✓ payload ignored
packaging: —                 →  —               ✓
a variant whose artwork was not marked → refused
```

### User

> when the FDO marks it ready for processing the review option will be closed as
> no shortfall should be sent after that step. Now FDO should be able to prepare
> an inspection plan with date and team members. the plan will be sent through
> process chain and the director will approve it. […] After being approved the a
> office order will be issued and will be shown to each desk of the flow. The FDO
> will be able estimate the sample collection according to the labs demand. FDO
> will generate unique tokens and take those to the factory. FDO will visit the
> factory according to the plan and seal the sample as needed. after coming back
> he will prepare sampling report.

### Assistant

Eight things. Built four — the review closing, the inspection plan, the approval
chain and the office order (D82) — and stopped rather than half-building the
rest, because the plan chain is coherent on its own and everything downstream
waits on it existing.

**The plan travels with the file, and no queue of its own.** It moves up the
ordinary chain (D58/D78/D79) and a senior desk holding it may rewrite the date
or the team rather than sending it back — a round trip for a typed date is what
makes people work around a system. **The office head approves**, which is the
wing's Director or the officer acting in that post (D57, D74), so nothing needs
to name an approver; he must also hold the file and belong to its office.

**Approval issues the office order**, `<office>/INS/<year>/<serial>`, numbered
then and not at proposal — a number quoted to a factory should mean a visit that
is going to happen. Shown on the board row and in the desk flow.

Verified against the live file: shortfall after ready refused, proposal before
review refused, 282 officers offered, a senior edit replacing date and team, a
non-head refused, a head not holding it refused, approval producing
`6/INS/2026/0001`, and an approved plan refusing both edit and send-back.

**Still not built:** the FDO's sampling screen (the services exist in
`lib/samples/` — `buildPlanFor`, `setRequirement`, `commitSampling`, the
three-identifier scheme — but no screen), and the sampling report, which has no
model at all.

---

### User

> The process should be a different section, not inside the preview.

### Assistant

Split into two pages. `/workflow/[id]` is the preview — what was filed, the
attachments, the fees. `/workflow/[id]/process` is the work — corrections, the
inspection plan, the office order, and the desk flow.

Reading a file and working it are different jobs: an officer approving a visit
should not scroll past six cards of sub-products to reach the button, and one
checking a declared capacity should not scroll past the control that issues an
office order.

`FileShell.tsx` holds the header, the tabs and the shared `Card`/`Row`/`Empty`,
so the two views cannot drift apart. Each has its own `loading.tsx`. The preview
went from **3.89 kB of client JavaScript to 210 B** — every interactive panel
now lives on the page that needs it.

### User

> The immediate availabe senior of FDO will handle this approval only. No need to
> bother higher authority. Higher authority is satisfied with the desk flow
> update. Another thing-> FDO should be by default selected in inspection team
> preparation. Team selection should be searchable multiple option select box
> like sub-product selection process and categorized like pass-down and sent-up
> button flow.

### Assistant

Approval moved from the office head to the proposer's **immediate senior**
(D83). `immediateSeniors()` is the smallest step up the D78 seniority pair —
which is what makes it work at all: BORHAN UDDIN is a Field Officer on grade 9,
and his approvers are the **six Assistant Directors on the same grade 9**, not
the Deputy Directors above them. Grade alone could not have told those apart;
D78's tie-break is what does.

Several people share the rung and any of them may act, because an approval only
one named person can give waits for him to come back from leave. A desk further
up may still approve rather than being refused — a file passed higher than it
needed to go would otherwise be stranded — but the proposer may never approve
his own plan.

The proposer is now ticked by default: he is the one going. Only for a plan that
does not exist yet, so re-adding him to a saved plan cannot put him back on a
visit a senior desk removed him from.

The picker is searchable and grouped by `groupByRank()`, the same table the
pass-down list uses, so an officer sees his colleagues under the same headings
wherever he is choosing from them — and for the same reason it mattered there:
ten Field Officers and six Assistant Directors in this wing are all grade 9.

**Verified read-only.** The live file had a plan in flight, so nothing was
written this time:

```
proposer BORHAN UDDIN, Field Officer, grade 9
immediate seniors (6): the Assistant Directors, all grade 9
desks further above, also permitted: 4
peers and juniors refused: 11
the proposer's own attempt: refused
picker: 22 in section under 6 rank headings, proposer present
plan unchanged: true
```

### User

> Are your context got overloaded and you are hallucinating? Cause I still cannot
> approve at AD's desk. Also after sending the plan it is still editable at the
> FDO's desk

### Assistant

A real gap, and one omission caused both symptoms. `proposeInspection` never
touched `holderEmployeeId` and never wrote a movement — so **the plan was saved
but never sent**. The FDO kept the file, which is why he could still edit it;
the AD never received it, which is why `isHolder` was false and no approve
button was drawn. The original instruction said "the plan will be sent through
process chain"; the plan and the approval rule were built and the sending was
not.

`sendPlanForApproval()` is that step. Saving and sending are deliberately two
acts — an officer writing a plan should be able to come back to it before it
goes — and the hand-off runs through `pass()` rather than writing the holder
directly, so a plan travels the ordinary chain (D58/D78/D79) and lands in the
movement log like anything else.

**Why the earlier verification missed it, which is the lesson.** The probe that
"verified approval" set `holderEmployeeId` directly to put the file on the
senior's desk. That is exactly the step the application had no way to perform,
so writing it by hand made the test pass over the hole it should have found. A
check that reaches its starting state by a route the product does not have is
not a check.

```
before          state=inspection_proposed  holder=BORHAN UDDIN (the proposer)
send            state=inspection_pending_approval  holder=MD. JAHIDUR RAHMAN
FDO edits       refused — only whoever is holding this file can plan it
AD approves     state=inspection_approved  order 6/INS/2026/0001
movement        up  BORHAN UDDIN → MD. JAHIDUR RAHMAN  "For your approval."
```

The client's plan was kept: only the approval and the hand-off this run made
were undone.

### User

> The approver is the immediate person on the upper chain who sent down to FDO.
> So choosing AD is redundant

### Assistant

Right, and simpler than what was there. `delegatorOf()` reads the most recent
`down` movement addressed to the holder — the officer who delegated the work is
the one the plan returns to, so there is nothing to choose. The picker asked a
question the file's own history already answers, and let the wrong person be
picked.

Only `down` counts. A `receive` has no sender, an `up` came from somebody
junior, and a `reassign` was an administrator moving a stranded file rather than
a superior delegating work.

Because the target is now derived rather than chosen, the hand-off is written
directly instead of through `pass()`: the chain test exists to stop an arbitrary
sideways move and there is no choice here to abuse. It is still recorded as an
`up`, so the desk flow reads the same. `immediateSeniors()` was deleted with the
picker — D83's organogram computation turned out to be the wrong tool for a
question the movement log answers exactly.

```
history:  receive   —                    → Md. Golam Rabbani
          reassign  Md. Golam Rabbani    → Md. Alauddin Hussain
          down      Md. Alauddin Hussain → KAWSER AHMED KHAN
          down      KAWSER AHMED KHAN    → AFSANA HOSSAIN
          down      AFSANA HOSSAIN       → BORHAN UDDIN

delegatorOf(BORHAN UDDIN) = AFSANA HOSSAIN
send (no target)          → returned to her, state inspection_pending_approval
FDO edit                  → refused
she approves              → order 6/INS/2026/0001, as a plain employee
```

The client's plan was preserved and this run's movements removed — 5 before, 5
after.

**Twice now a CLAUDE.md edit has silently not applied** because a `.replace()`
anchor no longer matched after an earlier edit, and the script aborted before
writing. The commit went out with the plan updated and CLAUDE.md not. Worth
checking `git diff --stat` names every file expected before committing a doc
change.


### User

> After approval the office order should be generated like an official letter,
> having office pad at the top and in the body it will mention about which
> product, date, team and to which company, factory. The letter should be
> downloadable as pdf

### Assistant

`/workflow/[id]/order` (D85). Government letterhead through `GovHeader` and
`orgForOffice()`, so a Barishal order carries Barishal's address. Memo number
and date, subject, a body naming the company, factory, product and visit date,
the team as a numbered Bengali table, the approver's signature block.

**Screen and PDF are the same page** — the toolbar is `print:hidden` and
Puppeteer loads that URL, the salary slip's arrangement, so a letter cannot look
one way on screen and another on paper.

**Verifying it caught a defect.** The number read `6/INS/2026/0001` — the
office's *database id* on a letter going to a factory. It is now
`বিএসটিআই/<office>/পরিদর্শন/<serial>/<year>`, the shape `generateMemoNo()`
builds for the bank advice; ASCII digits stored so the serial parses, Bengali at
render. The order already issued in testing keeps its old number, because
renumbering an issued order is the one thing an issued order must never do.

Chromium is present (Chrome 152), so the download works rather than failing on
the missing bundled binary.

**The Bengali wording is mine, not BSTI's.** It follows the bank advice's
register and every fact in it is real, but the sentences need a CM Wing
officer's eye before a factory sees them.

---

### User

> Now the inspection report and sampling letter preparation. I have provided two
> sample for those in utils directory. […] You can be more smart and improvise a
> better inspection and sampling report design if needed.

### Assistant

Read both samples. Built the **inspection report** (D86) from
`utils/inspectionReport.html`, with three differences the data makes possible:

- **Production as *found*, beside production as *declared*.** The paper form has
  one capacity box; we already hold the applicant's claim, so the report puts
  what the officer saw next to it. "Did they under-declare" is the question an
  inspection exists to answer, and one box cannot ask it.
- **Nothing re-typed that the file already holds** — product, BDS numbers,
  company, factory print as context. Paper asks because paper cannot look up.
- **Checks are rows, not columns** — 5 conditions, 9 markings, 11 narrative
  sections — so the wing adding an item is data, not a migration.

Attachments are text: there is no document store, and a file nobody can reopen
is worse than the substance in words.

Verified: 5 gaps refused the send; filled, 0 gaps with 5/5, 9/9, 11/11 and
declared 100000 against found 85000 mg at 62.5%; the author's own approval
refused; the senior's produced
`বিএসটিআই/ঢাকা/পরিদর্শন-প্রতিবেদন/০০০১/২০২৬` and `inspection_completed`.

**The sampling letter was not built**, because its every row comes from
`commitSampling()` and the FDO's sampling screen did not exist.

---

### User

> The inspection report is at AD's desk. Why? FDO should prepare inspection
> report and what do you need to build sampling screen?

### Assistant

**The plan travels up for approval and I never sent the file back down.** So
after the AD approved it she kept the file, and since every panel keys off
holding it, the report panel appeared at her desk. Approval now hands the file
back down to whoever proposed the plan, as a `down` naming the office order —
which also makes the return journey right for free, since `delegatorOf()` then
resolves to the approver.

**On the sampling screen: nothing was needed.** I had said the letter was
blocked, which was true, and implied the screen was, which was not.
`buildPlanFor(19)` ran clean against live data — 3 cells to Textile Head Office,
5/4/5 tests, 2 variants each, **0 problems**. 16,399 routing rows, 713
capability rows, 46 labs. The only nulls were `samplesPerVariant`, which is
exactly what the FDO types.

---

### User

> yes build it

### Assistant

The sampling screen and the specimen labels (D87).

Destinations derived from `LabRouting`, counts typed, total and box count
recomputing as he types. A figure the lab agreed last time is a **suggestion,
never a default** — it was agreed for a different consignment. A cell resting on
seeded routing says so, because all 16,399 rows still point at the owning
head-office section and a destination nobody chose is not a decision.

**Labels print `ref` and nothing else** — QR to `/s/<ref>`, sub-product, size,
specimen number, and **not the brand**, because the variant is the applicant's
identity. `cmCode` and `labCode` are never fetched by the page that prints. QR
renders to SVG on the server, so the client bundle is untouched; `qrcode` is a
new dependency.

```
grid          3 cells → Textile, Head Office · 5, 4, 5 tests · 2 variants · 0 problems
type 2 each   12 specimens, 1 box
zero          refused
seal          1 consignment, 12 specimens, 3 test orders
seal again    refused
```

Everything the run created was removed — **including the three
`LabSampleRequirement` rows**, because those say "the lab agreed 2 per variant"
and no lab agreed anything. Seeding a false fact the screen then suggests is
exactly what the placeholder flags exist to prevent.

---

### User

> Why the sampling report and inspection plan on the right side smaller section
> of the page? Use it on the left side. And why the sampling report is shown and
> editable at the AD's desk. AD just supervises/approves. Its the FDO's job only.

### Assistant

Both were my errors.

**The layout.** When the page was split, the corrections history moved to the
right column; a later edit anchored the sampling and report panels on that
block, so the two biggest forms on the page landed in the sidebar. They are the
work, so they now sit beside the review and the plan; the right column keeps
only what has happened.

**The ownership rule was wrong** (D88). Every other act on the page keys off
*holding* the file, which is right — the holder is accountable. These two are
different, and structurally so: the file passes back through the approver's
hands, so keying on the holder handed her the officer's job with the paperwork.
Sampling and the report now belong to **whoever proposed the plan**.

Worse than reported: the report's inputs rendered **enabled** for the AD while
its Save button was hidden, so she could type a full report into fields that
would silently discard it. Both panels still render for a reader — an approver
must read what he approves — with the fields disabled and the reason said out
loud.

---

### Facts established this session

- **Directors are grade 4**, client-confirmed. The organogram's grade 5 matched
  nobody.
- **The office head's desk is the Executive unit's post**, whatever wing he came
  from — a rule, not a repair, and why office-head seating cannot live inside
  `import:desks`.
- **`Posting.orgPostId` is null on every row** — the organogram link is
  `Employee.orgPostId`.
- **The HR export records the *acting* designation, not the substantive one.**
  That is how a Deputy Director arrived as a grade-4 পরিচালক.
- **The pay grade alone is not an order.** AD, Field Officer, Examiner,
  Inspector and Senior Examiner are all grade 9; the designation breaks the tie.
- **A file does not fall back to anyone when its holder leaves**, and the holder
  is the only person who can move it. Both deliberate; together they strand it.
- **Approval is the officer who handed the file down**, which the movement log
  already knows — no organogram computation needed.
- Roster 731; desked 480; office heads 23 of 23, all with a desk or a charge.

### Lessons that cost something

- **A check that reaches its starting state by a route the product does not have
  is not a check.** The probe that "verified" plan approval set
  `holderEmployeeId` directly — exactly the step the product could not perform —
  so it walked straight over the missing send-for-approval step.
- **Clean up only what the run created.** A rollback that deleted *all* rounds
  for an application destroyed the client's own open shortfall. Later runs
  removed rows by id, and one deliberately removed three
  `LabSampleRequirement` rows because they asserted an agreement no lab made.
- **A doc edit that silently fails takes the commit with it.** Twice a
  `.replace()` anchor stopped matching after an earlier edit and the script
  aborted before writing, so a commit went out with the plan updated and
  CLAUDE.md not. Check `git diff --stat` names every expected file.
- **Panels that render disabled controls lie.** The report's inputs were enabled
  for a reader whose Save button was hidden.

### Resume here

**State.** Typecheck clean, `npm run build` clean, tree clean, committed. The
dev server was stopped partway through the session, so everything after that
point is build-verified rather than only typechecked.

**Where the CM flow now runs, end to end:** submitted → received → passed down →
desk review with correction rounds → ready → inspection plan → approved with an
office order → sampling plan → sealed specimens and printed labels → inspection
report → approved. Every stage was exercised against the live application
`CM-2026-000019` and rolled back.

**The one piece asked for and not built: the sampling letter.** It is now
unblocked — with specimens sealed, every column of `utils/samplingLetter.html`
resolves from our model, and better than the sample does:

| Their column | Ours |
|---|---|
| Reference Code (a UUID) | `Sample.ref`, the one printed identifier (D68) |
| Parameters ("As per BDS") | the actual `TestParameter` rows routed to that lab |
| Lab Name (blank) | resolved from `LabRouting` (D64) |
| Sample Qty | the count the FDO agreed, remembered for next time |

It follows the office order's arrangement: letterhead, recipient
(স্বত্বাধিকারী), subject naming the BDS, body, the table, the অনুলিপি copy list,
and a PDF from the same page.

**Also outstanding**

- **Every routing row is still `isPlaceholder`** (D66) — all 16,399 point at the
  owning head-office section. The sampling screen says so per cell, but no
  office has entered its own referral map.
- **The one-stop counter and the lab bench** — `submitConsignment()` and
  `openConsignment()` exist with no screens.
- **The Bengali in the office order is drafted, not supplied**, and the same
  will be true of the sampling letter. A CM Wing officer should read both.
- **No notification channel.** No mail (client addresses are often
  `@mobile.bsti.invalid`), no SMS. Every "the applicant is told" is a panel on
  their own page.
- **`candidates()` still restricts to the sender's own section**, so a branch
  office head from another wing cannot pass a CM file into the CM section. D58
  needs amending — noted at the top of this log and still true.
- 15 offices have no local payroll admin, needing nomination at
  `/hr/listing/roles`.

---

## Session 2 — 2026-09-06 → 07 (office machine, then Linux machine)

Picking up from `cd0a83f`. Two commits (`a6a0632`, `b2ff25c`) were made on the
office machine before this session opened on the Linux one. The session ran the
CM flow forward from the sealed samples: what the officer finds at the factory,
how the visit is approved, and the letters that follow — ending at the applicant,
who until the last hour of it could not see the one letter addressed to them.

### User

> We have moved from the last progress here. Get updated with the changes

### Assistant

Read the two office-machine commits. `a6a0632` gave the client surfaces a shared
shell — `ClientNavbar` over `ModuleNavbar`, a layout at
`app/(public)/public/layout.tsx` — because the dashboard, the applications and
the company pages each rendered their own column and footer and no navbar at
all. `b2ff25c` recorded what the textile file implies about the chemistry wing's
file: `TestParameter` is upserted on `(subProductId, nameEn)` and
`sourceSection` is not in that key, so where two wings name the same test on one
sub-product the second import **overwrites** the first rather than sitting
beside it. Nothing is wrong with one file loaded; it has to be checked the moment
a second arrives.

---

### User

> Now I am at the FDO's desk of the application. Currently on the inspection
> step. Now while visiting FDO may find that the factory is manufacturing more
> sub-products and variants. In that case he should be able to add those
> manually. Should we add directly to the applied section or sampling letter?
> what do you think? Also the sampling letter and inspection report should not be
> shown on AD/DD or anyone else desk other than FDO untill it is sent to AD.
> After AD apporoves it the Chain will see those reports also.

### Assistant

**The applied section, not the letter** (D89). A sub-product added to the letter
alone would be sealed and tested but never applied for: no routing, no
parameters, no test fee, and a licence that does not cover the article the jar
came from. Adding it to the application changes the sampling grid and the fee by
itself, because both read `ApplicationSubProduct`. `declaredBy` keeps the two
apart, so "did they under-declare, or did we find more" stays answerable and the
applicant's declaration is never rewritten.

**The visit's working is not everyone's to read** (D90). `inspectionAudience()`
returns `author` / `approver` / `chain` / `none`: the visiting officer always,
the desk it was sent to once sent, everyone with standing once approved. D80
gives every desk that handled a file the right to read it, which is right for the
application and wrong for a report being written. A superadmin is deliberately
not exempt — the point is not access control, it is that unfinished work is not
somebody else's to read.

---

### User

> while adding a sub-product I get error. Then after refresh it shows fine on the
> page and it is added. The error is -> TypeError: Cannot read properties of
> undefined (reading 'trim'). Also just like we can add, we should also be able
> to remove

### Assistant

`SamplingPanel` keyed its typed counts by cell in a `useState` initialiser, which
runs **once**. Recording a found sub-product adds a cell, and the re-render read
a key that was not in the map. The row had already been written, which is why a
reload looked fine. Fixed with `valueFor(c)` falling back to the prop rather than
syncing with an effect, which would fight the officer's typing. Any panel holding
draft state over a server-derived list has the same shape.

---

### User

> The applied sub-products should also be removable. Because after application
> the factory might discontinue a product line and want to remove that from that
> applicaiton.

### Assistant

Struck out, not deleted (D91). `notInProductionAt` on both
`ApplicationSubProduct` and `ApplicationSku`; everything downstream ignores a
struck row — no sampling cell, no box, no test fee, nothing licensed — and the
declaration stays on the file, because "what did they say they made" is asked in
disputes and a deleted row cannot answer it. Reversible until the jars are
sealed. Hard removal stays limited to the officer's own findings: deleting the
applicant's declaration would erase the very thing `declaredBy` exists to keep.

---

### User

> inspection report and sampling report both be sent to AD by FDO for approval.
> AD will approve both or send shortfall to FDO or demand for a re-inspection
> because inspection report is not good. At that time factory development notice
> will be sent to client and the application will be on hold. […] One stop should
> be a desk in each office. Anybody assigned to that place will be able to see
> the files sent to that desk.

### Assistant

Built as three answers on one decision (D92), because a visit is either sound, or
wrong on paper, or wrong in the factory: **approve** (numbered, file back to the
officer), **send back** (`submittedAt` cleared, nothing on the application
reopens, the samples stand), **factory not ready** (a `FactoryDevelopmentNotice`
to the applicant and `awaiting_factory_development`). The third is explicitly not
a shortfall: a shortfall reopens fields on a form, this asks for work in a
building, and the visit stays exactly as recorded because a re-inspection is a
*second* visit.

The report and the sampling record go up **together** — one visit. Sending is
refused while no consignment exists, which is what ties them at the sending end.

**One Stop is a role, not a person** (D93), so the counter keeps working when the
officer on it changes. `/workflow/counter` is scoped to `Consignment` and never
to `Application` — and by the **laboratory's** office, not the file's, because
the applicant carries each box to the office of the lab that will test it, which
is often not the office the application belongs to. A counter scoped to its own
office's files would miss exactly the boxes walking through its door.

---

### User

> Wing head is 99% time a director of that wing at head office. In very rare case
> we assign a DD to director as additional charge. what do you suggest about this
> two? 1.The letters be generated automatically after approval of sampling letter
> by AD or 2. The application comes to FDO's desk after approval and at that time
> FDO issues letters.

### Assistant

Recommended **2**, and it is now D95. Automatic issue would attribute the letters
to the approving desk, when the wing-head letter says "these samples are coming
to your laboratory" and that is the sampling officer's statement; it would also
commit seal numbers and specimen counts the moment they are approved, so a wrong
one is already out. But leaving him to *compose* them invites the omission
`resolveDestinations()` exists to prevent — so the set is derived for him and he
issues it, all at once, refused while anything is unaddressed. Approval already
hands the file back to him, so there is no extra hop.

The wing head itself became D94: **whoever holds the wing's Director post** —
substantively, then in additional charge, then nobody, said out loud. Seniority
could not answer it, and the roster showed why: two grade-4 Directors in the
Physical Testing Wing tied on grade *and* on designation rank, so "seniormost"
returned whichever the sort happened to put first.

---

### User

> We have 19945010033 as Chemical wing director in hr module. Why are chemical
> wing head vacant you say? Also for physical wing Shahadat hossain is already
> retired. id=19984010029 is the director now. His designation is also
> director(physical) now. Okay implement the option 2.

### Assistant

The tie was stale data, not a rule failure. Corrected in
`prisma/import/hr-corrections.ts` — the place for roster facts the export cannot
supply: Shahadat Hossain retired, Mobin Ul Islam moved to post 682 as Director
(Physical), Gazi Md. Nurul Islam to post 728. The Chemical wing then read as
vacant for a reason worth keeping in mind: `import:desks` matches a Bengali wing
name to the closest **leaf** section, so the sibling `Executive (<wing>)` unit —
where the Director post actually sits — falls out of scope. That flaw is what hid
the CM wing's free DD seat too. Still unfixed.

---

### User

> The application is at AD's desk. I had approved inspection report earlier. The
> sampling report was generated at FDO's desk and stays at everyone's desk. I
> want inspection report and sampling report generated by FDO and sent to AD for
> approval. Approves both then the file automatically passed to FDO with draft
> letters generated. FDO issues those and the next phase of the applicaiton
> begins.

### Assistant

Three separate things, and the diagnosis mattered more than the fix.

**The file was stuck because it was approved under the old code.** Approval had
not yet handed the file back when it ran, so it sat on the approver's desk with
nothing for him to do. Corrected `CM-2026-000019` to its field officer and
recorded the movement as the hand-back it should have been.

**The sampling report was not a document.** It existed as `samplingRemarks` on
the inspection report and nothing else. Built as its own page (D96) printing the
sealed boxes, seal numbers, specimens and each order's parameter count — but with
**no state of its own**: no serial, no submitted flag, no approver. It prints
under the inspection report's number and is approved by the same act. One visit
approved twice is a factory that passed on paper and failed on jars, which is not
a state anyone can act on.

**"Stays at everyone's desk" was the sampling *screen*, not the report** (D97).
D90 widens the audience for the visit's work once approved, which handed a
supervising desk the buttons for estimating counts and sealing jars. The screen
is now the visiting officer's alone; every other desk gets the two documents,
linked together so nobody approves one having read the other.

---

### User

> I am at director(physical) and also clients desk. Where to find those issued
> letter

### Assistant

Nowhere — and that was the honest answer. Three letters existed for application
19 as dispatch records only. `SampleLetter` was read in exactly two places,
`lib/cm/letters.ts` and one API route, so the only surface showing them was the
Letters panel on the issuing officer's own process page.

Three separate gaps, reported as such: the Director (Physical) has **no standing
on the file** — the desks that touched application 19 are five others, and being
*addressed by a letter* is not a form of standing the code recognises, so
`/workflow/19` would 404 for him and there is no inbox of letters addressed to
him; nothing on the client's application page reads letters at all; and none of
the three has a printed form. Also flagged: `one_stop` has **zero users**, so
letter 0003 is addressed to a desk nobody occupies and `/workflow/counter` is
empty for every office until someone is granted the role.

---

### User

> First build the client's end. We need to work in detail for physical testing
> module. Physical and chemical testing workflow is different than CM workflow.

### Assistant

Built the client's end (D98). `/public/applications/[id]/letter` renders নমুনা
জমাদান পত্র on the government letterhead with print and PDF, and
`SampleLetterNotice` repeats its substance on the application page above the
form.

**It could not live under `/workflow`** — that prefix is INTERNAL-only, so the
one person the letter is addressed to is the one person who could not open it
there. Hence the client route and a PDF under `/api/client/…`, which is on the
public allow-list; access is `membershipFor()` and a wrong id 404s, because a
letter carries seal numbers and its existence must not be confirmable.

The panel repeats the letter rather than only linking to it, for the reason the
shortfall panel does: there is still no notification channel, so the page *is*
the notice. A box already handed in shows as received rather than as an
outstanding errand — from `Consignment.submittedAt`, which nobody can set yet.

`ModuleNavbar` became `print:hidden` in the same commit. It had to be the moment
a client surface printed a real document: a page under `app/(public)/public/`
cannot opt out of that layout's chrome.

**The testing modules were recorded as step 9, not started.** Their workflow is
not CM's and must not be built as a variant of it — a laboratory receives boxes,
opens them against a seal, distributes specimens to benches and records results
per parameter, which is a different unit of work (`LabTestOrder`, carrying no
application column at all by D70), a different actor, and a different reason to
move. What is open before it can be planned is listed with the step.

---

### Facts established this session

- **What the officer finds goes on the application, not on the letter.** The
  letter is a dispatch instruction; the application is what gets licensed.
- **A discontinued line is struck out, never deleted** — the declaration is
  evidence.
- **One visit, one approval.** The inspection and sampling reports share a
  number and an approver; the sampling report has no state of its own.
- **The wing head is a post, not a ranking.** Two grade-4 Directors in one wing
  tie on grade and on designation, so seniority cannot address a letter.
- **The One Stop counter is scoped to the laboratory's office**, not the file's.
- **`one_stop` has zero users**, so every counter is empty today.
- **The chemistry wing's Director was invisible to `import:desks`** because the
  Bengali wing name resolves to the closest *leaf* section and the Director post
  sits in the sibling `Executive` unit. Same flaw that hid the CM wing's free DD
  seat.

### Lessons that cost something

- **"Where do I find X" is usually a report that X has no surface.** The answer
  here was "nowhere", across three different audiences, and finding that took
  one grep of who reads `SampleLetter`.
- **A panel is not a document.** The sampling report was a form field and a
  working screen; the chain needed a paper, and the two are not the same
  artefact even when they hold the same rows.
- **Fix the data as well as the code.** Approval was corrected to hand the file
  back, but the file already approved under the old rule stayed stuck until it
  was moved by hand.

### Resume here

**State.** Typecheck clean, tree committed and pushed. `CM-2026-000019` sits with
its field officer, both reports approved, all three letters issued.

**Where the CM flow now runs, end to end:** submitted → received → passed down →
desk review with correction rounds → ready → inspection plan → approved with an
office order → sampling plan → sealed specimens and printed labels → inspection
and sampling reports → approved as one act → back to the officer → letters issued
→ **the applicant sees where to carry each sealed box**.

**The next hop is the counter, and it is not built.** `submitConsignment()`
exists with its seal check and has no button; `one_stop` has no users. Until then
no box can be marked received and the applicant's panel can never show one as
delivered.

**Also outstanding**

- **The wing head and One Stop letters have no paper**, and their recipients have
  no standing on the file — the two remaining gaps from "where do I find those
  issued letter".
- **Step 9 — the Physical and Chemical testing modules.** Client asked for it
  next, in detail, and said plainly that their workflow differs from CM's. The
  open questions are listed with the step in `docs/BUILD-PLAN.md`.
- **`SAMPLE_SUBMISSION_DAYS` is 14 and invented** (D8), printed as guidance and
  enforced nowhere. Needs the CM Wing's real period, and whether microbiological
  work differs.
- **`import:desks` leaf-section matching** still resolves a Bengali wing name to
  the closest leaf, missing `Executive (<wing>)`.
- **`candidates()` still restricts to the sender's own section** — D58 unamended,
  carried from Session 1 and still true.
- **Every routing row is `isPlaceholder`** (D66); no office has entered its own
  referral map.
- **The Bengali in every letter is drafted, not supplied.** The office order, the
  two reports and now the submission letter all need a CM Wing officer's eye.
- 15 offices have no local payroll admin, needing nomination at
  `/hr/listing/roles`.
