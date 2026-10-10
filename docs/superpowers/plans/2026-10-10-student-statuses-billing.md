# Student Statuses and Per-Lesson Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each student-in-a-group a status driven by an event history, charge per lesson from 1 Nov 2026, and add the group/profile actions (activate, freeze, unfreeze, back to trial, transfer, leave) with live cost previews and a reasons list.

**Architecture:** A pure `membership` module validates event sequences; a pure `billing` module replays events into monthly charge lines (legacy full-month rule before the switch date, per-lesson after). All DB writes to memberships go through one server helper that appends events and keeps `GroupStudent.status / joinedAt / leftAt` in sync, so existing `leftAt`-based queries keep working. UI dialogs call the same pure billing code client-side for previews.

**Tech Stack:** Next.js 15, React 19, Prisma 6 (SQLite, `db push`), zod 4, node:test via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-10-student-statuses-billing-design.md`

## Global Constraints

- Switch date: `PER_LESSON_FROM = 2026-11-01` (UTC date). Months before it use the legacy full-month rule; from it, per lesson.
- Dates are calendar dates stored as UTC midnight; start and end dates are both inclusive (spec A1).
- Lesson days come from `lessonDates(days, year, month)` in `src/lib/format.ts`; holidays are not skipped.
- Month charge = `Math.round(price × billable / lessonsInMonth)`; a month with 0 lessons charges 0.
- Months are charged from the first billable month through the month of `now` inclusive (whole current month, like today's model); later months are not charged.
- Statuses: `TRIAL | ACTIVE | FROZEN | LEFT`. Event types: `TRIAL | ACTIVATE | FREEZE | UNFREEZE | BACK_TO_TRIAL | LEAVE`.
- FREEZE and LEAVE need a reason (except LEAVE caused by a group finishing). Event dates may not precede the previous event.
- Uzbek UI copy; all colours via theme tokens (`npm run check:colors` stays clean); no new dependencies.
- Permissions: status actions `students.manage` + `assertGroupAccess`; payment from menu `payments.create`; reasons `staff.manage`. Every action is written with `logAction`.

## Review Focus

1. **Re-joining a group after leaving** (upsert today resets dates) — must append a new TRIAL/ACTIVATE after the LEAVE and bill both periods correctly, never erase history. Pinned by a billing test in Task 3 and a membership test in Task 2.
2. **Actions submitted twice or out of order** (double click; two staff freezing at once) — the second must be rejected with a readable error, not create a duplicate event. Pinned by `applyEvent` tests in Task 2 and re-validation inside the server helper (Task 4).
3. **Students added as Trial in October, before the switch date** — must not be charged October (legacy rule starts at the first ACTIVATE, not at joining). Pinned by a billing test in Task 3.
4. **Freeze date in a past month** (staff record a freeze late) — preview and balance must reflect that month's lessons, and later months must drop to 0. Pinned by a billing test in Task 3.
5. **Group finished while students are frozen or trial** — they must get a LEAVE without a reason and stop being charged. Pinned by a membership test (LEAVE allowed from any non-LEFT status, reason optional when `system`) in Task 2.

---

### Task 1: Schema, reasons, migration of existing memberships

**Files:**
- Modify: `prisma/schema.prisma`, `prisma/seed.ts`, `package.json` (script `db:migrate-statuses`)
- Create: `src/lib/membership-legacy.ts`, `src/lib/membership-legacy.test.ts`, `prisma/migrate-statuses.ts`

**Interfaces:**
- Produces Prisma models: `GroupStudent.status String @default("ACTIVE")`, `GroupStudent.events MembershipEvent[]`; `MembershipEvent { id Int @id @default(autoincrement()), groupStudentId Int (onDelete: Cascade), type String, date DateTime, reasonId Int?, reason Reason? (onDelete: SetNull), comment String?, userId Int?, user User? (onDelete: SetNull), createdAt DateTime @default(now()) }` with `@@index([groupStudentId, date])`; `Reason { id, name String, active Boolean @default(true), createdAt, events MembershipEvent[] }`.
- Produces: `eventsFromLegacy(joinedAt: Date, leftAt: Date | null): { type: "ACTIVATE" | "LEAVE"; date: Date }[]` (dates truncated to UTC midnight).
- Produces seed reasons: Moliyaviy sabab, Ta'til / safar, Kasallik, Boshqa kursga o'tdi, Dars yoqmadi, Vaqt to'g'ri kelmadi, Boshqa.

- [ ] **Step 1: Failing tests** `membership-legacy.test.ts`: active member → `[ACTIVATE joinedAt]`; left member → `[ACTIVATE joinedAt, LEAVE leftAt]`; times are dropped (`2026-09-03T11:47` → `2026-09-03T00:00Z`).
- [ ] **Step 2:** `npm test` → FAIL (module missing).
- [ ] **Step 3:** Implement `eventsFromLegacy`; `npm test` → PASS.
- [ ] **Step 4:** Schema changes; `npx prisma db push`; expect "in sync".
- [ ] **Step 5:** `prisma/migrate-statuses.ts`: for every `GroupStudent` with no events, create `eventsFromLegacy` events and set `status` to `LEFT` if `leftAt` else `ACTIVE`; ensure the seed reasons exist (by name); print counts. Script `"db:migrate-statuses": "tsx prisma/migrate-statuses.ts"`. Seed calls the same logic after creating memberships.
- [ ] **Step 6:** Run it twice: first prints N memberships migrated, second prints 0 (idempotent).
- [ ] **Step 7:** `npm run lint`; commit `feat(students): membership events, reasons, migration`.

### Task 2: Membership state machine

**Files:**
- Create: `src/lib/membership.ts`, `src/lib/membership.test.ts`

**Interfaces:**
- Produces: `type EventType`, `type Status`, `MEMBER_STATUS: Record<Status, string>` (Sinov darsida, Faol, Muzlatilgan, Chiqgan), `EVENT_LABEL: Record<EventType, string>`.
- Produces: `statusAfter(events: { type: EventType }[]): Status | null`.
- Produces: `applyEvent(events: { type: EventType; date: Date }[], next: { type: EventType; date: Date; reasonId?: number | null; system?: boolean }): { ok: true; status: Status } | { ok: false; error: string }`.
- Produces: `allowedActions(status: Status | null): EventType[]` — null → [TRIAL, ACTIVATE]; TRIAL → [ACTIVATE, LEAVE]; ACTIVE → [FREEZE, BACK_TO_TRIAL, LEAVE]; FROZEN → [UNFREEZE, LEAVE]; LEFT → [TRIAL, ACTIVATE].

- [ ] **Step 1: Failing tests:** each allowed transition succeeds with the right status; disallowed ones fail (UNFREEZE when ACTIVE, FREEZE when TRIAL, FREEZE twice — Review Focus 2); date earlier than the last event fails with "Sana oldingi amaldan oldin bo'lishi mumkin emas"; same date allowed; FREEZE/LEAVE without reason fail unless `system: true` (Review Focus 5); LEFT → ACTIVATE re-join succeeds (Review Focus 1).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement; `npm test` → PASS.
- [ ] **Step 4:** Commit `feat(students): membership state machine`.

### Task 3: Per-lesson billing

**Files:**
- Modify: `src/lib/billing.ts` (rewrite), `src/lib/billing.test.ts` (create)
- Create: `src/lib/billing-include.ts`

**Interfaces:**
- Consumes: `EventType` (Task 2), `lessonDates` (format.ts).
- Produces: `PER_LESSON_FROM: Date`; `type BillableMembership = { groupId: number; events: { type: EventType; date: Date }[]; group: { name: string; days: string; course: { price: number } } }`.
- Produces: `chargeLines(m: BillableMembership, now = new Date()): ChargeLine[]` where `ChargeLine = { year: number; month: number /*0-11*/; lessons: number; billable: number; amount: number; legacy: boolean }`, oldest first, only months with amount > 0 or billable > 0.
- Produces: `totalCharges(ms: BillableMembership[], now?)`, `balance(ms: BillableMembership[], payments: { amount: number }[], now?)` (same names as today), `billableLessonsIn(m, year, month, now?)`.
- Produces: `previewCharge(m: BillableMembership, extra: { type: EventType; date: Date }, now?): { year; month; lessons; billable; amount; from: Date | null; to: Date | null }` — the line for `extra.date`'s month after appending `extra`, plus the first/last billable lesson dates in it.
- Produces in `billing-include.ts`: `membershipInclude = { events: { orderBy: [{ date: "asc" }, { id: "asc" }] }, group: { include: { course: true } } } as const` and `studentBillingInclude = { groups: { include: membershipInclude }, payments: { select: { amount: true } } } as const`.

Algorithm (not determined by the signature):
```
legacy months (< PER_LESSON_FROM): a month is charged full price if any ACTIVATE..LEAVE period
  (freezes and BACK_TO_TRIAL ignored) overlaps it. Periods start at ACTIVATE, not at TRIAL.
per-lesson months (>= PER_LESSON_FROM, <= month of now): for each lesson date, the student is billable
  if the latest event on or before that date (ties: event order) leaves them ACTIVE — except that a
  FREEZE / BACK_TO_TRIAL / LEAVE dated D still bills the lesson on D (inclusive end, A1).
```

- [ ] **Step 1: Failing tests** with the spec 4.3 examples (exact so'm values), plus: Review Focus 3 (TRIAL 20 Oct, ACTIVATE 3 Nov → Oct 0, Nov per lesson from 3 Nov); Review Focus 4 (FREEZE dated in November, `now` in January → Nov partial, Dec 0, Jan 0); Review Focus 1 (ACTIVATE, LEAVE 10 Nov, ACTIVATE 20 Nov → both spans billed, lesson on 10th and 20th included); freeze and unfreeze on the same day bills that lesson once; two freezes in one month; DAILY schedule; full month = exact price (no rounding drift); month with no lessons; `now` mid-November bills all November lessons, none in December; legacy member (ACTIVATE 2 Jan 2026, no leave) → Jan–Oct full price ×10, Nov per-lesson = full price.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement; `npm test` → PASS (all previous tests still green).
- [ ] **Step 4:** Switch every caller to `studentBillingInclude` / `membershipInclude` and the new `balance`: `students/page.tsx`, `students/[id]/page.tsx` (drop `monthsEnrolled`), `groups/[id]/page.tsx`, `debtors/page.tsx`, `(app)/page.tsx`, `lib/mcp/tools.ts` (`enrollmentInclude` → `studentBillingInclude`); `npm run lint` passes with no `monthsEnrolled` left (`grep -rn monthsEnrolled src` empty).
- [ ] **Step 5:** Browser: debtors count and a few balances before/after on the seed data are identical (it is October, so only legacy months apply) — record both numbers.
- [ ] **Step 6:** Commit `feat(students): per-lesson billing from 1 Nov 2026`.

### Task 4: Server actions

**Files:**
- Create: `src/lib/membership-db.ts` (server-only)
- Modify: `src/app/(app)/actions.ts`, `src/lib/validation.ts` (only if a helper is missing)

**Interfaces:**
- Consumes: `applyEvent`, `statusAfter` (Task 2); Prisma models (Task 1).
- Produces: `recordEvent(tx, groupStudentId: number, e: { type; date; reasonId?; comment?; userId?; system? }): Promise<Status>` — loads events, runs `applyEvent`, throws `Error(error)` on failure, inserts the event, updates `status`, `joinedAt` (first event date) and `leftAt` (LEAVE date or null). `startMembership(tx, { groupId, studentId, mode: "TRIAL" | "ACTIVE", date, userId })` — upsert row, then `recordEvent` (re-join keeps history).
- Produces actions: `addStudentToGroup(f)` gains `mode` (default TRIAL) and `date`; `memberAction(groupStudentId: number, f: FormData)` with `type` (ACTIVATE | FREEZE | UNFREEZE | BACK_TO_TRIAL | LEAVE), `date`, `reasonId`, `comment`; `transferStudent(groupStudentId: number, f: FormData)` with `toGroupId`, `date`, `reasonId`, `mode`; `removeStudentFromGroup` becomes a LEAVE via `memberAction` semantics (requires reason — its button opens the dialog in Task 6); `createStudent` and `convertLead` start memberships as TRIAL; `updateGroup` finishing → `recordEvent(LEAVE, system: true)` for every non-LEFT member.
- Errors return to the form through the existing `parseForm` / error pattern used by other actions (read how `createPayment` surfaces errors and follow it).

- [ ] **Step 1:** Implement `membership-db.ts` and the actions in one transaction each (`db.$transaction`); each action calls `logAction` with `student.<type>` (e.g. `student.freeze`) and a message naming student, group, date and reason, then revalidates `/groups/{id}` and `/students/{id}`.
- [ ] **Step 2:** `npm run lint`.
- [ ] **Step 3:** Exercise each action against the dev DB with a small `tsx` script in the scratchpad (not committed) that calls `recordEvent` on a seed membership: ACTIVATE→FREEZE→UNFREEZE→LEAVE succeeds; a second FREEZE throws the readable error (Review Focus 2); status/leftAt columns match after each step.
- [ ] **Step 4:** Commit `feat(students): membership actions`.

### Task 5: Reasons in Settings

**Files:**
- Create: `src/app/(app)/settings/reasons/page.tsx`
- Modify: `src/app/(app)/settings/layout.tsx`, `src/app/(app)/actions.ts`

**Interfaces:**
- Produces actions `createReason(f)`, `renameReason(id, f)`, `toggleReason(id)` (`staff.manage`).
- Produces tab `{ href: "/settings/reasons", label: "Sabablar" }` (shown with `staff.manage`).

- [ ] **Step 1:** Page lists reasons (active first, hidden greyed), inline add form, rename in a Modal, hide/show toggle; uses `PageHeader`-free settings layout like `roles`.
- [ ] **Step 2:** `npm run lint`, `check:colors` on the new files; browser: add, rename, hide a reason; hidden reasons do not appear in dialogs (verified in Task 6).
- [ ] **Step 3:** Commit `feat(settings): reasons list`.

### Task 6: Group page — statuses, action menu, dialogs with previews

**Files:**
- Create: `src/components/members/MemberMenu.tsx` (client), `src/components/members/MemberDialog.tsx` (client), `src/components/members/StatusBadge.tsx`
- Modify: `src/app/(app)/groups/[id]/page.tsx`

**Interfaces:**
- Consumes: `allowedActions`, `MEMBER_STATUS` (Task 2); `previewCharge` (Task 3); `memberAction`, `transferStudent`, `addStudentToGroup` (Task 4); `PaymentForm` (existing `components/forms.tsx`).
- Produces: `StatusBadge({ status })` (Trial: `bg-warning-tint text-warning`; Active: ink outline; Frozen: `bg-ink/5 text-muted`; Left: faint); `MemberMenu({ membership, reasons, groups, canPay, canManage })` where `membership` is serialisable (`{ id, status, events, group: { id, name, days, course: { price } }, student: { id, name } }`, dates as ISO strings).

- [ ] **Step 1:** Student rows show `StatusBadge` + legend; ⋯ opens `MemberMenu` with only `allowedActions` (+ To'lov qilish, Boshqa guruhga o'tkazish).
- [ ] **Step 2:** `MemberDialog` per action: date (default today), reason select (active reasons) when required, comment, and the preview line computed with `previewCharge` on every change, worded like the old CRM: `Joriy oy talaba {from} dan {to} gacha o'qidi — {amount}` / for activate/unfreeze `{from} dan oy oxirigacha — {amount}`; transfer shows the old-group line, the new-group line (`previewCharge` on a synthetic membership of the target group), and the resulting balance.
- [ ] **Step 3:** Add-student dialog: Trial (default) / Active + date.
- [ ] **Step 4:** Browser at 1280 and 375, light/dark, as admin: freeze a seed student on today → preview amount equals the value in the student's Payments lines after saving; unfreeze; return to trial; transfer to another group; remove with a reason; double-submit freeze shows the error (Review Focus 2). Teacher without `students.manage` sees no menu.
- [ ] **Step 5:** `npm run lint`, `check:colors`; commit `feat(students): status actions on the group page`.

### Task 7: Student profile — group cards and statement

**Files:**
- Modify: `src/app/(app)/students/[id]/page.tsx`
- Create: `src/lib/statement.ts`, `src/lib/statement.test.ts`

**Interfaces:**
- Consumes: `chargeLines` (Task 3), `EVENT_LABEL`, `MemberMenu`, `StatusBadge`.
- Produces: `statement(memberships: BillableMembership[], payments: { id; amount; method; date; note; groupId }[], now?): StatementRow[]` where `StatementRow = { date: Date; kind: "payment" | "charge" | "event"; label: string; groupName?: string; lessons?: string; amount: number /* signed, 0 for events */; balance: number }`, newest first, charges dated the 1st of their month, events show their reason.

- [ ] **Step 1: Failing tests** for `statement`: payment then charge give the right running balance; a freeze event row carries the reason and amount 0; ordering newest first; final row balance equals `balance()`.
- [ ] **Step 2:** `npm test` → FAIL; implement; → PASS.
- [ ] **Step 3:** Profile: the "Guruhga qo'shish" dialog gets the same Trial / Active + date choice as Task 6 Step 3; "Guruhlar" as cards (status badge, joined / activated / frozen / left dates, reason, `MemberMenu`); "To'lovlar va hisob" table from `statement` (stacked on phones with `table-stack`).
- [ ] **Step 4:** Browser check light/dark, 1280/375; numbers match the group page preview from Task 6.
- [ ] **Step 5:** Commit `feat(students): profile statement and group cards`.

### Task 8: Salaries and sweep

**Files:**
- Modify: `src/lib/salary.ts`

**Interfaces:**
- Consumes: `billableLessonsIn` (Task 3), `membershipInclude`.

- [ ] **Step 1:** PER_STUDENT base = number of memberships in the teacher's groups with `billableLessonsIn(m, year, month) > 0` (legacy months: any ACTIVATE..LEAVE overlap, as before) — spec A5.
- [ ] **Step 2:** Browser: salaries page for October unchanged versus before (all seed members are migrated ACTIVE) — compare the base numbers.
- [ ] **Step 3:** `npm test`, `npm run lint`, `npm run check:colors` all pass; grep that every `groupStudent` write goes through `membership-db.ts` (`grep -rn "groupStudent\.\(create\|update\|upsert\|updateMany\)" src` lists only that file).
- [ ] **Step 4:** Commit `feat(students): per-student salaries follow billable lessons`.
