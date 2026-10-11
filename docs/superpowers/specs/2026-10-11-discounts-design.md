# Discounts (Chegirma) — students step 1b-ii — design

Date: 2026-10-11 · Status: approved in chat, awaiting written-spec review

## Goal

Give a student a monthly discount in one of their groups for a range of months. The student's charges and balance
go down; the teacher's pay does not.

## What the user said

- The discount is an **amount off per month** (so'm), for one student in one group, over a month range.
- **Teacher pay is never lowered** by a discount.
- Part months (joined mid-month, frozen, transferred): the **discounted price is split per lesson** like the normal
  price.
- If the discount is bigger than the month's charge, the **charge becomes 0** — never negative, nothing carried over.
- **Current month onward** only; past months stay as charged. Discounts start **no earlier than November 2026**
  (October's teacher pay still follows payments, which a discount would lower).
- **Admins and managers** give discounts (new permission).
- "2+1", "oktabr bepul" are just notes: a free month is a discount equal to the month's price with that note.

## Data

```prisma
model Discount {
  id             Int          @id @default(autoincrement())
  groupStudentId Int
  groupStudent   GroupStudent @relation(fields: [groupStudentId], references: [id], onDelete: Cascade)
  amount         Int          // so'm off each month (> 0)
  from           DateTime     // first month: UTC midnight on the 1st
  to             DateTime     // last month, inclusive: UTC midnight on the 1st
  reason         String?      // "2+1", "aka-uka", …
  userId         Int?
  user           User?        @relation(fields: [userId], references: [id], onDelete: SetNull)
  createdAt      DateTime     @default(now())
  @@index([groupStudentId])
}
```

Rules on save: `amount ≥ 1`; `from ≤ to`; `from ≥ max(current month, 2026-11)`; the membership is current
(`leftAt = null`); no overlap with another discount of the same membership.

## Billing

- `BillableMembership` gains optional `discounts: { from: Date; to: Date; amount: number }[]`; `membershipInclude`
  loads them, so every balance (profile, lists, debtors, exports, dashboard) includes discounts.
- In a per-lesson month (never a legacy month) with a discount `d`:
  `charge = max(0, round((price − d) × billable ÷ lessons))`.
  `ChargeLine` gains `discount` (so'm taken off this month = undiscounted amount − charge).
- `lessonValues` (teacher pay) keeps using the **undiscounted** amount, so PERCENT and PER_STUDENT pay don't change.
  `billableLessonsIn` / `billedStudentCount` are unchanged (a 100 % discounted student still counts as taught).

## Changing a discount

- **Delete** — allowed while `from ≥ current month` (nothing already charged in a closed month).
- **End** — for one that started before this month and still runs (`from < current month ≤ to`): `to` becomes the
  previous month, so this month and later lose it and past months never change.
- No editing of amount or months (delete / end, then give a new one) — the history stays readable.
- Every give / delete / end is logged (`student.discount`) with the student, so it appears in Tarix.

## Screens

- Student profile → new tab **Chegirma** (after To'lovlar; shown with `payments.view`): table of discounts — group,
  amount / oy, months (`Noyabr 2026 – Yanvar 2027`), reason, who / when, state (kutilmoqda / amalda / tugagan) and
  delete / end buttons for `students.discount`. "Chegirma berish" dialog (`useActionState`, keeps typed values on
  refusal): group (current memberships), amount, from month, to month (month inputs), reason.
- To'lovlar tab / statement: a discounted month's row reads e.g. `Noyabr 2026 · 13 dars · chegirma −200 000`.

## Permissions

New `students.discount` — "Chegirma berish"; default role "Menejer" gets it (existing databases: tick once on Rollar).

## Testing

- Unit (billing): full month with discount; part month (half the lessons → half the discounted price); discount ≥
  price → 0, never negative; month outside the range unchanged; legacy month never discounted; `lessonValues`
  unchanged by a discount; overlapping-range check helper; month-range validation (`from` before current month or
  before 2026-11 refused).
- Evidence: with no discounts all 69 balances equal master and salaries 2026-05..10 equal master; with a temporary
  discount on a test membership for Nov 2026 the projected November charge drops by exactly the discount share and the
  teacher's lesson values don't change; test data removed.
- Browser: give, refuse overlap / past month (message shown, values kept), delete a future one, end a running one,
  Tarix shows all three; teacher sees no Chegirma tab.
