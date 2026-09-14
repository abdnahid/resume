---
description: "Court cases and verdicts — recording a verdict applies it, and arrears are a difference not a replay"
paths:
  - "lib/salary/cases.ts"
  - "lib/salary/verdicts.ts"
  - "app/api/cases/**"
  - "app/(main)/hr/listing/cases/**"
---

## Court cases and verdicts

Decisions D22–D24. `/hr/listing/cases` is the register; `case_officer` and
`superadmin` are the only roles that reach it, and a case officer sees **every**
office because cases are run by a central legal cell, not per office.

- **Recording a verdict applies it.** The two are not separable — a verdict
  sitting on the register without touching pay is the failure this exists to
  prevent. `POST /api/cases/[id]/verdicts` writes the verdict, calls
  `imposeVerdict()`, and deletes the verdict again if that throws, so the
  register can never disagree with the salary.
- **A verdict raises fixation versions; nothing else knows about verdicts.**
  Salary processing and the bank advice were not touched — they still just pay
  the version in force. `imposeVerdict()` raises a punished version for the
  window and a restoring version for the day after it ends.
- **A verdict that outlives the fiscal year still binds.** `getFixationContext()`
  returns every un-revoked verdict with its window, and both the preview and the
  save route call `verdictOn(verdicts, validFrom)`. So next July's annual
  fixation picks the punishment up on its own.
- **Verdict-derived versions are not hand-editable** — the route returns 409 and
  points at case management. Changing the punishment means lifting the verdict.
- **A verdict cannot reduce a month already disbursed.** `imposeVerdict()`
  refuses if a processed month falls inside the window.

**Arrears are a difference, not a replay.** A verdict-derived version records the
version it displaced (`baselineFixationId`), so the pay withheld in a month is
`baseline.netSalary - process.netSalary` — both already stored. `revokeVerdict()`
with `arrearsOrdered` sums that across exactly the months paid under the punished
version and writes one `SalaryArrear`. The next month processed adds it, stamps
it paid in the same transaction, and the bank advice follows because it has
always summed `netSalary`. Re-processing a month never pays an arrear twice.

**Clause order matters** and is fixed in `applyVerdict()`: demote the grade, come
down the increments, resolve the scale basic, cut it by percentage, then
suppress heads. `withhold_increment` deliberately changes no arithmetic — it
constrains the *next* annual fixation and is surfaced as a note.

**`reduceDerivedAllowances` answers "rest remains same".** Off (the default), a
`basic_percent` clause halves what is paid as basic but leaves house rent and
other percentage allowances on the full scale figure. On, they follow it down.
It is per verdict, because the court order decides.

