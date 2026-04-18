# BSTI Personal Data Sheet — Next.js

A Next.js 14 (App Router) + Tailwind CSS implementation of the BSTI
employee biodata sheet. Design is the **Standard density / Ruled table /
Photo slot shown** variant, with a purple (`#5b21b6`) accent.

## Structure

```
nextjs-resume/
├── app/
│   ├── layout.tsx         Root HTML shell
│   ├── page.tsx           Server component — fetches employee + renders sheets
│   └── globals.css        Tailwind base + print rules + font imports
├── components/
│   ├── Sheet.tsx          Single letter-sized page frame
│   ├── GovHeader.tsx      Gov + BSTI emblems + three Bengali title lines
│   ├── DocumentTitle.tsx  "Personal Data Sheet" centerpiece
│   ├── SectionHead.tsx    Numbered section header
│   ├── PersonalSection.tsx
│   ├── CurrentJobSection.tsx
│   ├── AddressSection.tsx
│   ├── DataTable.tsx      Reusable ruled-table primitives
│   ├── EducationSection.tsx
│   ├── PostingSection.tsx
│   ├── PromotionSection.tsx
│   ├── TrainingSection.tsx
│   ├── ForeignTrainingSection.tsx
│   ├── PublicationSection.tsx
│   ├── AwardSection.tsx
│   ├── Signatures.tsx
│   └── PageFoot.tsx
├── lib/
│   ├── types.ts           TypeScript shape of the DB row
│   ├── employee.json      Mock data (looks like a DB result set)
│   └── db.ts              getEmployeeRecord(id) — stand-in for a real query
└── tailwind.config.ts
```

## Data flow

`app/page.tsx` is an async server component. It calls
`getEmployeeRecord(id)` from `lib/db.ts` (currently reads
`lib/employee.json`, but shaped like a Prisma/Drizzle query so swapping
in a real DB is a one-file change), then passes slices of the record
down to each section component as props.

Swap the fixture for a real query later:

```ts
// lib/db.ts
import { db } from "./drizzle";
import { eq } from "drizzle-orm";
import { employees } from "./schema";

export async function getEmployeeRecord(id: string) {
  return db.query.employees.findFirst({ where: eq(employees.id, id) });
}
```

## Run

```bash
cd nextjs-resume
npm install
npm run dev
```

Open `http://localhost:3000`. Print via browser (Cmd/Ctrl + P) — the
print stylesheet hides screen chrome, drops shadows, and paginates
at the three sheets.

## Notes

- Google Fonts (`Newsreader`, `Inter Tight`, `Hind Siliguri`,
  `Noto Serif Bengali`, `JetBrains Mono`) are loaded via `@import` in
  `globals.css`. Consider moving to `next/font` for production.
- The two circular logo slots are typographic placeholders. Drop real
  SVGs into `GovHeader.tsx` when available.
- Photo slot is a striped placeholder with corner ticks. Replace the
  inner `<div>` in `PersonalSection.tsx` → `PhotoSlot` with an `<Image>`
  when a real photo is on file.
