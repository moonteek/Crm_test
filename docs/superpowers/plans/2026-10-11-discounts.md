# Discounts (Chegirma) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-student, per-group monthly discount (so'm off) over a month range that lowers the student's charges but never the teacher's pay.

**Architecture:** A `Discount` table loaded through `membershipInclude`; `billing.ts` subtracts the month's discount when computing the charge while `lessonValues` keeps the undiscounted amount; a pure `discountProblem` validator guards saves; a "Chegirma" tab on the student profile gives / deletes / ends discounts.

**Tech Stack:** Next.js 15 server actions + `useActionState`, Prisma 6 / SQLite `db push`, node:test.

**Spec:** `docs/superpowers/specs/2026-10-11-discounts-design.md`

## Global Constraints

- Discounts only in per-lesson months, from `max(current month, 2026-11)`; months are UTC midnight on the 1st; `to` inclusive.
- `charge = max(0, round((price − d) × billable ÷ lessons))`; teacher pay (`lessonValues`) uses the undiscounted amount.
- No overlap between discounts of one membership; membership must be current (`leftAt = null`); `amount ≥ 1`.
- Delete only while `from ≥ current month`; end (sets `to` = previous month) only while `from < current month ≤ to`.
- Permission `students.discount` "Chegirma berish" (default role Menejer); log action `student.discount` with `studentId`; never inside `$transaction`.
- With no discounts, every balance and salary must equal master.

## Review Focus

- Member menu cost previews (freeze / leave / transfer) must include an existing discount → Task 2 passes discounts through `toMemberData`/`toBillable`; test `chargeChangeIf` with a discount in Task 1.
- A discount on a membership that later leaves/transfers stops charging with the membership (no charge after leave) → Task 1 test: discount + LEAVE mid-range.
- A 100 % discount month still counts the student as taught for PER_STUDENT pay → Task 1 test on `billableLessonsIn`.
- December→January ranges and a single-month range (`from = to`) → Task 1 tests.
- Refused saves keep typed values and say why (overlap, past month, before Nov 2026) → Task 2 dialog uses onSubmit + startTransition.

---

### Task 1: Data and billing

**Files:** Modify `prisma/schema.prisma` (Discount model as spec; `GroupStudent.discounts`, `User.discounts`), `src/lib/billing.ts`, `src/lib/billing-include.ts` (`discounts: true`), `src/lib/permissions.ts`; Create `src/lib/discounts.ts`; Test `src/lib/billing.test.ts`, `src/lib/discounts.test.ts`.

**Produces:**
- `BillableMembership.discounts?: { from: Date; to: Date; amount: number }[]`; `ChargeLine.discount: number`.
- `discountIn(discounts, y, m): number` (sum of amounts covering that month; ranges never overlap so ≤ 1).
- `discountProblem(input: { from: Date; to: Date; amount: number; current: boolean }, existing: { from: Date; to: Date }[], today: Date): string | null` — messages: `"Chegirma summasi musbat bo'lishi kerak"`, `"Boshlanish oyi tugash oyidan keyin bo'lmasin"`, `"Chegirma faqat shu oydan boshlab beriladi"`, `"Chegirma 2026-yil noyabrdan boshlab beriladi"`, `"O'quvchi bu guruhda emas"`, `"Bu oylarda boshqa chegirma bor"`.
- `discountState(d, today): "kutilmoqda" | "amalda" | "tugagan"`; `canDelete(d, today)`, `canEnd(d, today)`.

- [ ] Step 1: billing tests (FE-style group, EVEN days, price 600 000, Nov 2026 has 13 lessons): full month with 200 000 off → 400 000 and `discount` 200 000; half the lessons → `round(400000×b/13)`; 700 000 off → 0 (line kept, billable > 0); December only discount leaves Nov/Jan unchanged; Dec→Jan range covers both; legacy Oct 2026 month never discounted; `lessonValues` sum equals the undiscounted charge; `billableLessonsIn` unchanged by a 100 % discount; LEAVE on 15 Nov with discount Nov–Dec → only Nov's billable share, nothing in Dec; `chargeChangeIf` with a discount uses the discounted price.
- [ ] Step 2: `discounts.test.ts`: each `discountProblem` message; `from = to` allowed; adjacent ranges (Nov–Dec, Jan–Feb) don't overlap; state/canDelete/canEnd for past, running, future, starting-this-month.
- [ ] Step 3: `npm test` → FAIL; implement; green.
- [ ] Step 4: schema + `db:push` (dev server stopped); permission `students.discount` + Menejer default; commit `feat(discounts): data and billing`.

### Task 2: Giving, deleting and ending discounts

**Files:** Modify `src/app/(app)/actions.ts` (`saveDiscount(_: MemberActionState, f)`, `deleteDiscount(id)`, `endDiscount(id)`), `src/app/(app)/students/[id]/page.tsx` (tab "Chegirma" after To'lovlar, `payments.view`), `src/lib/statement.ts` (charge label adds ` · chegirma −<money>` when `discount > 0`), `src/components/members/types.ts` (discounts in `MemberData`, `toMemberData`, `toBillable`); Create `src/components/students/DiscountDialog.tsx`, `src/components/students/DiscountList.tsx`.

**Consumes:** `discountProblem`, `discountState`, `canDelete`, `canEnd`, `ChargeLine.discount`.

- [ ] Step 1: statement test: a discounted month's charge row label ends with `chegirma −200 000 so'm` (money format) and amount −400 000.
- [ ] Step 2: actions — `saveDiscount` reads `groupStudentId`, `amount`, `from`/`to` as `YYYY-MM` (month inputs) → UTC 1st, `reason ≤ 120`; checks `assertStudentAccess`; `discountProblem` with that membership's other discounts; logs `"Chegirma: <group> — <money>/oy, <from>–<to>"`. `deleteDiscount` / `endDiscount` refuse with the spec rules ("Boshlangan chegirmani o'chirib bo'lmaydi — tugating", "Chegirma tugagan").
- [ ] Step 3: UI — dialog (onSubmit + startTransition, shows error, keeps values); list with state badge and delete / end buttons for `students.discount`.
- [ ] Step 4: browser: give Nov–Dec 200 000 to a FE-14 student; overlap refused with message; past month refused; delete a future one; Tarix shows give / delete; teacher has no Chegirma tab; member-menu leave preview reflects the discount. Commit `feat(discounts): give, delete and end`.

### Task 3: Evidence and docs

**Files:** Modify `README.md`.

- [ ] Step 1: with no discounts: balances vs master (69 / 0 differing / 28 debtors) and salaries 2026-05..10 (0 differing).
- [ ] Step 2: temporary discount Nov 2026 on one membership, `now` = 2026-11-30 in a script: that membership's Nov charge = undiscounted − 200 000 share; its `lessonValues` sum and the teacher's November earnings unchanged; remove test data.
- [ ] Step 3: README (permission tick for Menejer, how discounts work); lint, test, check:colors; commit `docs(discounts): README`.
