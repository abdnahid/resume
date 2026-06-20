---
name: project-overview
description: BSTI Personal Data Sheet — what the app is, its tech stack, data model, and feature set
metadata:
  type: project
---

## What it is
An internal HR management system for BSTI (Bangladesh Standards and Testing Institution). The primary output is a government-format **Personal Data Sheet** (biodata/resume) for each employee. The app also handles salary, postings, org structure, ID cards, and bank advice.

**Why:** BSTI is a government org that must produce official formatted documents (personal data sheets, ID cards, bank advice letters) per government standards.

## Tech stack
- **Framework:** Next.js 14 (App Router), TypeScript, Tailwind CSS v4
- **Database:** PostgreSQL via Prisma ORM (custom output to `generated/prisma`)
- **Auth:** better-auth (session-cookie based, `getSessionCookie` in middleware)
- **UI:** shadcn/ui + base-ui/react, lucide-react icons
- **Config:** `prisma.config.ts`, adapter-pg for Prisma

## Roles
- `superadmin` — full access (employees, salary fixation, ID cards, organogram, director general, bank advice)
- `officeadmin` — own-office employees, salary fixation, organogram manage
- `data_entry` — limited
- `employee` — own personal data sheet only

## Core data models (schema.prisma)
- **Employee** — central entity, id is a custom string (employee ID), linked to User (1:1), Office, OrgPost, addresses (present/permanent)
- **OrgUnit / OrgPost** — hierarchical org structure (wing → divisional → regional → unit), posts attached to units
- **Posting** — tracks employee placement history (type: initial/transfer/promotion/demotion/deputation/lien; status: pending/active)
- **SalaryFixation / SalaryHistory / SalaryProcess** — salary management
- **BankAdvice** — monthly salary disbursement advice
- **IdCard / IdCardBatch / DirectorGeneral** — ID card issuance workflow (batch → DG signs → cards activated)
- **Education, Promotion, Training, ForeignTraining, Publication, Award, WorkHistory** — employee biodata sub-tables

## App routes (main layout with Sidebar + Navbar + Footer)
- `/` — Personal Data Sheet (employee's own)
- `/listing` — Employee list (all or office-scoped for officeadmin)
- `/listing/[id]/resume` — Employee's full Personal Data Sheet (3-page A4 print layout)
- `/listing/[id]/edit` — Edit employee data
- `/listing/[id]/post` — Create posting
- `/listing/[id]/card` — Individual ID card page
- `/listing/new` — Add employee
- `/listing/fixation` — Salary fixation
- `/listing/salary` — Processed salary
- `/listing/bank-advice` — Bank advice (list + generate)
- `/listing/bank-advice/[id]` — Bank advice document
- `/listing/id-cards` — ID card batch management
- `/listing/id-cards/[id]` — Batch detail with authorization list
- `/listing/director-general` — Manage DG records
- `/organogram` — Public org chart view
- `/organogram/manage` — Edit org structure

## Document rendering
- Personal Data Sheet = 3-page A4 `Sheet` component, composed from section components (GovHeader, PersonalSection, CurrentJobSection, AddressSection, EducationSection, PostingSection, PromotionSection, TrainingSection, ForeignTrainingSection, PublicationSection, AwardSection, Signatures, PageFoot)
- All section components live in `/components/`
- Content in Bengali (Bn) and English (En) throughout
- ID Card document: `/listing/[id]/card/`
- Bank Advice document: `/listing/bank-advice/[id]/`

## Key lib files
- `lib/db.ts` — main DB query functions (getEmployees, getEmployeeRecord, getUserOfficeId)
- `lib/org.ts` — org structure helpers
- `lib/types.ts` — core TypeScript types (Employee, EmployeeRecord, BankAdviceRecord, etc.)
- `lib/auth.ts` — better-auth server config
- `lib/auth-client.ts` — client-side auth
- `lib/bengali.ts` — Bengali text/number utilities
- `lib/id-card.ts` — ID card helpers
