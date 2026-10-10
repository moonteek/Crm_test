# Students step 1a — statuses and per-lesson billing

Date: 2026-10-10
Status: awaiting review
Reference: old-CRM screenshots in `C:\Users\user\Desktop\Reference` (group student menu, freeze dialog,
transfer dialog, payment form, student profile tabs).

## 1. Goal

Give every student-in-a-group a status (trial, active, frozen, left), charge per lesson instead of per
whole month, and let staff freeze, unfreeze, activate, transfer and remove students with a reason and a
date — always showing what it costs before saving.

Success means:

- A trial student is never charged; charging starts on the activation date.
- Freezing on a date charges only the lessons held up to that date; nothing is charged while frozen.
- Joining, activating, unfreezing, leaving and transferring mid-month are all charged per lesson.
- Staff can see, line by line, why a balance is what it is.
- Nothing about months before the switch date changes.

## 2. What the user said vs. what is assumed

Said:

- Frozen month: charge per lesson up to the freeze date. If the month was already paid, the unused lessons
  become credit; if not, the student owes only the lessons held.
- Freezing requires a reason and a freeze date.
- Per-lesson charging applies everywhere: joining, leaving, unfreezing mid-month too.
- Trial lessons are free; an admin activates the student and charging starts that day; if the student
  does not stay, the admin removes them with a reason.
- Reasons and tags are lists managed in Settings.
- Switch to the new rules from a start date: 1 Nov 2026. Earlier months stay as they are.
- One balance per student (approved), charges shown as lines on the Payments tab (approved).
- Step 1b (profile fields, tags, notes, history tab, discounts, filters, export) comes after this.

Assumed (correct me in review):

- A1. Dates are inclusive: activating / joining / unfreezing on date D charges the lesson on D; freezing /
  leaving on date D also charges the lesson on D (the freeze dialog in the old CRM counts "06-10 to 10-10").
- A2. A lesson day is any day the group's schedule (odd / even / daily) has a lesson. Holidays do not
  exist yet, so they are not skipped (a later step adds "Bayram kunlari").
- A3. Adding a student to a group lets staff choose **Trial** (default) or **Active from a date**.
  Converting a lead into a student with a group also starts them as Trial.
- A4. "Return to trial" stops charging from the given date, like a freeze, but the status shows Trial.
- A5. Teacher salaries of type PER_STUDENT count a student for a month only if at least one lesson was
  billable to them that month (so pure-trial and fully-frozen students do not count). Percentage salaries
  are unchanged (they follow payments).
- A6. The payment form does not get a "which month" field: with one balance per student it has no effect.
- A7. Rounding: each month's charge for one group is rounded to whole so'm once
  (`round(price × billableLessons / lessonsInMonth)`), so a full month always costs exactly the price.

## 3. Statuses and the event history

Each student-in-a-group (today's `GroupStudent`) keeps an **event history**. The current status is the last
event; the billing and the "charge lines" are worked out by replaying the history.

| Event | Who / when | Status after | Needs |
| --- | --- | --- | --- |
| `TRIAL` | added to a group as trial | Trial | date |
| `ACTIVATE` | trial student stays, or added as active | Active | date |
| `FREEZE` | admin freezes | Frozen | date, reason, optional comment |
| `UNFREEZE` | admin unfreezes | Active | date |
| `BACK_TO_TRIAL` | admin returns an active student to trial | Trial | date |
| `LEAVE` | removed, trial did not stay, group finished, transferred away | Left | date, reason (except group finished) |

Rules: actions are only offered when they make sense (e.g. Unfreeze only when Frozen); an event date may
not be earlier than the previous event's date; events can't be edited in this step (undo = add the
opposite event).

`GroupStudent` also stores `status` and keeps `joinedAt` / `leftAt` up to date, so the ~40 places that use
"is in the group" (`leftAt: null`), counts, analytics and access rules keep working unchanged.

## 4. Billing

### 4.1 Rule from 1 Nov 2026

For each group a student has been in, for each calendar month from November 2026 on:

```
lessonsInMonth   = lesson days of the group's schedule in that month
billableLessons  = those lesson days on which the student was Active (A1)
charge           = round(course.price × billableLessons / lessonsInMonth)
```

Balance = all payments − all charges (unchanged definition).

### 4.2 Before 1 Nov 2026

Unchanged: full course price for every calendar month (fully or partly) between joining and leaving.
Existing members get one migrated `ACTIVATE` event on their join date (and a `LEAVE` on their leave date),
so their pre-November charges are identical and from November they are simply Active.

### 4.3 Examples (tests)

- Course 600,000, 12 lessons in November, student joins as Active on the 5th lesson day → 8 lessons →
  400,000.
- Same course, freeze after 4 lessons → 200,000; frozen for the rest of the month → nothing more.
- Paid 600,000 for November, then frozen after 4 lessons → balance +400,000 (credit).
- Trial on 3 Nov, activated on 10 Nov → only lessons from 10 Nov.
- Trial, never activated, left on 15 Nov → 0.
- Membership from 15 Oct to 20 Nov → October full price (old rule), November per lesson.
- Transfer on 10 Nov from group A (12 lessons) to group B (13 lessons): A charges lessons up to and
  including 10 Nov, B charges lessons from 10 Nov; leftover money stays on the one balance.

### 4.4 Code shape

- `src/lib/billing.ts` becomes the single place for this: a pure function that takes a membership (its
  events, the group's days, the course price) and returns month lines `{ month, lessons, billable,
  amount, events }`; `balance()` sums them. All current callers (students list, profile, group page,
  debtors, dashboard, MCP tools) switch to one shared Prisma `include` so nobody re-implements it.
- `previewCharge(...)` (same file) computes what an action would cost, for the dialogs.

## 5. Screens

### 5.1 Group page — student rows

- A status dot and label per student: Trial (amber), Active (ink), Frozen (grey), plus the existing debtor
  badge. A legend above the list.
- An action menu (⋯) per student: **To'lov qilish**, **Faollashtirish** (trial only), **Muzlatish**
  (active), **Muzlatishdan chiqarish** (frozen), **Sinov darsiga qaytarish** (active), **Boshqa guruhga
  o'tkazish**, **Guruhdan chiqarish**.
- Each action opens a dialog with the date (default today), the reason when required, and a live line
  like the old CRM: "Joriy oy talaba 06.10 dan 10.10 gacha o'qidi — 128 571 so'm".
- Transfer dialog: new group, date, reason, and two lines — what the old group charges up to the date
  and what the new group charges from the date to the month end — plus the student's balance after.
  Option: start in the new group as Trial or Active.
- "Add student" dialog gains Trial / Active (+ date).

### 5.2 Student profile

- **Groups** section: a card per group with status, joined / activated / frozen / left dates, the
  reason when frozen or left, and the same action menu.
- **Payments** section becomes "To'lovlar va hisob": payments and charge lines mixed by date, e.g.
  "Noyabr 2026 · ROBO-3 · 8/12 dars · −400 000", "Muzlatildi 12.11 · Ta'til", "To'lov · Naqd · +600 000",
  with a running balance.

### 5.3 Settings — Reasons

A new "Sabablar" tab: add, rename, hide reasons. Seeded with: Moliyaviy sabab, Ta'til / safar,
Kasallik, Boshqa kursga o'tdi, Dars yoqmadi, Vaqt to'g'ri kelmadi, Boshqa.

### 5.4 Everywhere else

Student list, debtors, dashboard counters and MCP tools use the new balance. Active-student counts keep
meaning "in the group" (trial and frozen included), as today.

## 6. Data changes (Prisma, `db push`)

- `GroupStudent`: add `status String @default("ACTIVE")` (TRIAL | ACTIVE | FROZEN | LEFT).
- New `MembershipEvent { id, groupStudentId → GroupStudent (cascade), type, date, reasonId?, comment?,
  userId?, createdAt }`.
- New `Reason { id, name, active Boolean @default(true), createdAt }`.
- One-off migration script `prisma/migrate-statuses.ts` creates the ACTIVATE / LEAVE events for existing
  rows; idempotent (skips memberships that already have events).

## 7. Permissions

- Status actions and transfer: `students.manage` (as adding / removing today), scoped by
  `assertGroupAccess`.
- Taking a payment from the menu: `payments.create`.
- Managing reasons: `staff.manage` (Settings).
- Every action is written to the activity log.

## 8. Testing

- Unit tests (node:test) for the billing function: all examples in 4.3, plus: month with no lessons,
  events out of order rejected, freeze and unfreeze on the same day, many freezes in one month,
  group with DAILY schedule, rounding (full month = exact price).
- Unit test for the migration mapping (existing joinedAt / leftAt → events → same pre-November charges).
- Browser checks: each action from the group page and the profile, dialog previews match the saved
  result, phone layout, light and dark.
- `npm run lint`, `npm run check:colors`, `npm test` all pass.

## 9. Out of scope (later steps)

Student fields, tags, notes, history tab, discounts, list filters and export (step 1b); holidays; SMS on
freeze; coins; student app; per-group balances.
