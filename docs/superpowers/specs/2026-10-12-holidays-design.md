# Holidays (Bayram kunlari) — design

Date: 2026-10-12 · Status: approved in chat, awaiting written-spec review

## Goal

Days the whole centre is closed. No lesson happens, so the student isn't charged for it, the teacher isn't paid
for it, it can't be marked in attendance, and the course plan doesn't count it.

## What the user said

- **Money: the month's price drops** — charge = price × lessons held ÷ the month's normal lessons; the teacher earns
  only on lessons held.
- A holiday closes the **whole centre**.
- Holidays can be added for **this month onward** only (past months stay as charged and paid).
- **Not a lesson at all**: attendance can't be marked that day, it doesn't count toward a level's lessons, and a
  level exam that fell on it moves to the last real lesson.
- **Admins and managers** manage the list.
- One branch now, maybe more later (nothing here should assume otherwise, but no branch feature now).

## Assumptions

- A1. Money changes only in per-lesson months (from November 2026). October 2026 keeps its full-month rule, so a
  holiday there affects attendance and the course plan only.
- A2. A holiday on a day a group has no lesson changes nothing for that group.
- A3. A holiday can be deleted while its date is still in the future (deleting today's or a past one would rewrite
  money already charged).

## Data

```prisma
model Holiday {
  id        Int      @id @default(autoincrement())
  date      DateTime @unique // calendar day, UTC midnight
  name      String           // "Navro'z", "Yangi yil"
  userId    Int?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  createdAt DateTime @default(now())
}
```

A date range in the form ("1–3 yanvar") creates one row per day; an existing day is refused with its name.

## How lessons change

- `lessonDates(days, y, m)` stays the **scheduled** days (the denominator of a month's price).
- New `heldLessons(days, y, m, holidays)` = scheduled days that aren't holidays.
- **Billing** (`billing.ts`): `BillableMembership` gets a **required** `holidays: string[]` (ISO days). In a
  per-lesson month a holiday day is never billable: `billable` counts held days only, `lessons` stays the scheduled
  count, so `charge = round((price − discount) × billable ÷ lessons)`. `lessonValues` (teacher pay) only lists held
  days, so PERCENT and PER_STUDENT pay drop with it. Legacy months ignore holidays (A1). Making the field required
  means every place that computes a balance must load holidays — the compiler finds any it misses.
- One loader helper `withHolidays(memberships)` (or holidays passed alongside) is used by every balance / statement /
  salary / export / dashboard / MCP call site.
- **Course plan** (`curriculum.ts`): `CurriculumGroup` gets `holidays: string[]`; level windows count held lessons,
  exam = last held lesson of the window, progress and course-end alerts follow.
- **Attendance**: holiday columns render greyed "Bayram" and can't be toggled (server refuses too); attendance and
  grades exports show "Bayram" in that column.
- **Timetable and dashboard** "today's lessons": a holiday shows "Bayram — dars yo'q" instead of lessons.

## Screens

Settings → **Bayram kunlari** (permission `holidays.manage`, default role Menejer): list (upcoming first, then past,
greyed), add form (from date, optional to date, name), delete for future ones. Every add / delete is logged
(`holiday.manage`).

## Testing

- Unit: `heldLessons` skips holidays; Nov 2026 EVEN group (12 lessons) with one holiday on a lesson day → full month
  charge 600 000 × 11 ÷ 12 = 550 000, `lessonValues` 11 days summing 550 000; holiday on a non-lesson day changes
  nothing; legacy October ignores holidays; discount + holiday together; curriculum window lesson count and exam day
  move; date-range expansion and "this month onward" rule.
- Evidence: with no holidays every balance and salary equals master; with a temporary November holiday one
  membership's charge and its teacher's lesson-value basis drop by exactly one lesson's share; test data removed.
- Browser: add a range, refuse a past date and a duplicate, delete a future one; attendance column greyed and not
  clickable; timetable / dashboard message on the day; course progress and exam date move.
