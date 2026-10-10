# Price History and Lesson-Exact Teacher Pay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Price changes take effect from the next month with history kept, group teachers have dated history, and from November 2026 teacher pay follows the exact lessons each teacher taught, with a per-teacher breakdown.

**Architecture:** Two small history tables (`GroupPrice`, `GroupTeacher`) read by pure lookup functions; groups never changed fall back to their current price/teacher, so no data migration is needed. `billing.ts` prices each month from history and exposes per-lesson values that sum to the month charge; a new pure `teacher-pay.ts` attributes those lesson values to the teacher on each lesson day. `salary.ts` uses it for months from November 2026.

**Tech Stack:** Next.js 15, Prisma 6 (SQLite, `db push`), node:test via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-10-price-history-teacher-pay-design.md`

## Global Constraints

- New pay rule from `PER_LESSON_FROM` (2026-11-01); earlier months use today's salary code unchanged.
- Price changes start on the 1st of the next month (Tashkent calendar); same-month re-edit replaces that month's row.
- History lookups fall back to current values when a group has no rows (no migration step).
- Lesson values of a membership-month sum exactly to its month charge; rounding happens once per teacher per month.
- Uzbek UI; theme tokens only (`npm run check:colors`); no new dependencies; every change logged with `logAction`.

## Review Focus

1. **Price edited twice in the same month** — the second edit must replace the scheduled row, not stack two rows for the same month. Pinned by a `priceAt` test (Task 1) and the server helper's upsert.
2. **Teacher changed on a date before the group's last change, or twice the same day** — must be refused or replace cleanly; never two teachers for one lesson. Pinned by `teacherOn` tests and helper validation (Task 2).
3. **Student charged in two groups in one month (transfer)** — both teachers' shares must add to the two charges exactly. Pinned by the spec example test in Task 3.
4. **Frozen or trial lessons** — no teacher earns on them. Pinned by Task 3 tests.
5. **Months before November** — salaries identical to the current code. Pinned by the snapshot check in Task 4.

---

### Task 1: Price history

**Files:** Modify `prisma/schema.prisma`, `src/lib/billing.ts`, `src/lib/billing-include.ts`, `src/app/(app)/actions.ts` (`updateGroup`, `updateCourse`), `src/components/GroupFields.tsx`, group/profile pages (price display). Create `src/lib/prices.ts`, `src/lib/prices.test.ts`, `src/lib/prices-db.ts`.

**Interfaces:**
- Produces model `GroupPrice { id, groupId → Group (cascade), price Int, from DateTime, userId Int?, createdAt }` with `@@unique([groupId, from])`.
- Produces `priceAt(history: { price: number; from: Date }[], fallback: number, year: number, month: number): number` and `upcomingPrice(history, now): { price: number; from: Date } | null` in `prices.ts`.
- Produces `BillableMembership.group.prices?: { price: number; from: Date }[]`; `billing.ts` month price = `priceAt(prices ?? [], groupPrice(group), y, mo)`.
- Produces server helpers `schedulePrice(tx, groupId, newPrice, userId)` (baseline row from 1970-01-01 with the current effective price if none, then upsert row for the 1st of next month) and course-wide variant for groups with `price: null`.

- [ ] **Step 1: Failing tests** (`prices.test.ts`): no rows → fallback; baseline 450k from 1970 + 500k from Nov → Oct 450k, Nov 500k, Dec 500k; two changes (Nov 500k, Jan 550k); `upcomingPrice` returns the Nov row when now is in Oct and null when now is in Nov. Billing test: membership with prices history charges Oct 450k (legacy) and Nov 500k.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement; → PASS.
- [ ] **Step 4:** schema + `db push` + generate; `membershipInclude.group` includes `prices: { orderBy: { from: "asc" } }`.
- [ ] **Step 5:** Rule: `Group.price` means "own price" (null = follows the course) and is only a fallback once history exists. `updateGroup`: compute the price the group will charge next month (`price` field, or the course price if blank); if it differs from the price it charges now, `schedulePrice(tx, groupId, thatPrice, userId)`; then save `Group.price` as submitted. `updateCourse`: if the price changed, `schedulePrice` for every group of the course with `price: null`, then save `Course.price`. Form note under the price field: "Yangi narx keyingi oyning 1-sanasidan amal qiladi".
- [ ] **Step 6:** Pages show current price and "1-noyabrdan: X" when upcoming.
- [ ] **Step 7:** Evidence: all balances identical to master's billing (compare script); browser: change ROBO-3 price → October unchanged, preview of a November action uses the new price; restore.
- [ ] **Step 8:** Commit `feat(billing): price changes apply from next month`.

### Task 2: Teacher history

**Files:** Modify `prisma/schema.prisma`, `src/app/(app)/actions.ts` (`updateGroup`), `src/components/GroupFields.tsx`. Create `src/lib/teachers-history.ts`, `src/lib/teachers-history.test.ts`.

**Interfaces:**
- Produces model `GroupTeacher { id, groupId → Group (cascade), userId → User (cascade), role String ("TEACHER" | "ASSISTANT"), from DateTime, createdAt }` with `@@unique([groupId, role, from])`.
- Produces `teacherOn(history: { userId: number; role: string; from: Date }[], current: { teacherId: number | null; assistantId: number | null }, day: Date, role: "TEACHER" | "ASSISTANT"): number | null`.
- Produces `checkTeacherChange(history, role, from: Date): string | null` (error when `from` is before the latest row of that role).
- `updateGroup` reads `teacherFrom` (date, default today) and writes baseline (from 1970) + new row when teacher or assistant changes; keeps `Group.teacherId/assistantId` = current.

- [ ] **Step 1: Failing tests:** no rows → current; baseline A + B from 20 Nov → 19 Nov A, 20 Nov B; assistant independent; change dated before latest row refused; same-day re-change replaces.
- [ ] **Step 2–3:** RED → implement → GREEN.
- [ ] **Step 4:** schema, push, generate; form gets "O'qituvchi o'zgarsa — qaysi kundan" date field; action wiring; log `group.teacher`.
- [ ] **Step 5:** Browser: change a group's teacher from a date; history rows correct; group shows new teacher; restore.
- [ ] **Step 6:** Commit `feat(groups): teacher history with dates`.

### Task 3: Lesson values and teacher earnings

**Files:** Modify `src/lib/billing.ts`, `src/lib/billing.test.ts`. Create `src/lib/teacher-pay.ts`, `src/lib/teacher-pay.test.ts`.

**Interfaces:**
- Produces `lessonValues(m: BillableMembership, year, month, now?): { day: Date; value: number }[]` — billable lesson days with values summing to that month's charge (largest-remainder distribution of the rounded charge).
- Produces in `teacher-pay.ts`: `type PayMembership = BillableMembership & { student: { id: number; name: string }; group: … & { id: number; teacherId: number | null; assistantId: number | null; teachers?: { userId: number; role: string; from: Date }[] } }`; `teacherEarnings(teacherId: number, salary: { type: "PERCENT" | "PER_STUDENT"; amount: number }, memberships: PayMembership[], year, month, now?): { rows: { studentId; studentName; groupId; groupName; lessons: number; lessonsInMonth: number; value: number; share: number }[]; total: number }` — share unrounded per row, `total = Math.round(sum)`.

- [ ] **Step 1: Failing tests:** lessonValues sum = charge (full month, partial, odd counts); spec example (ROBO-3 9 lessons 289 286 teacher A, FE-14 5 lessons 230 769 teacher B, 40% → 115 714 / 92 308); mid-month teacher change inside one group splits by day; frozen and trial days earn nothing; assistant earns on same lessons; PER_STUDENT 500 000 × 9/14 for half-month.
- [ ] **Step 2–3:** RED → implement → GREEN.
- [ ] **Step 4:** Commit `feat(salary): lesson-exact teacher earnings`.

### Task 4: Salaries from November + breakdown

**Files:** Modify `src/lib/salary.ts`, `src/app/(app)/salaries/page.tsx`. Create `src/app/(app)/salaries/[userId]/page.tsx` (or a Modal) for "Batafsil".

**Interfaces:** `salariesForMonth` uses `teacherEarnings` when the month ≥ November 2026 for PERCENT and PER_STUDENT; `base` becomes the charged value (PERCENT) or the lesson-weighted student count (PER_STUDENT, 2 decimals). New `salaryBreakdown(userId, month)` returns `teacherEarnings` rows (Nov+) or the old basis (payments list / student list) for earlier months.

- [ ] **Step 1:** Snapshot Sept/Oct salaries (all types) before; implement; snapshot after → identical.
- [ ] **Step 2:** Breakdown page: table student / group / lessons / value / share, total equals the salary row; phone layout `table-stack`.
- [ ] **Step 3:** Browser check of the page for October (old basis) and a unit-level check that November totals equal `teacherEarnings`.
- [ ] **Step 4:** All checks; commit `feat(salary): November pay by lessons, with breakdown`.
