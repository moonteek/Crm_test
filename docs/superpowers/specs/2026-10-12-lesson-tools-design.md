# Lesson tools — absence reasons, cancelled lessons, substitutes — design

Date: 2026-10-12 · Status: approved in chat, awaiting written-spec review

## Goal

The old CRM's per-lesson tools: say why a student was absent, cancel one group's lesson, and record a substitute
teacher for one lesson — with the money following what really happened.

## What the user said

- **Absence reasons** are optional; the starting list is the old one with colours (Kasal, Maktab / Univer sababli,
  Oilaviy sabab, Sababsiz, Ish sabab, Boshqa, Bog'lanib bo'lmadi); absent still counts as absent in the %.
- **Cancelling a lesson ("Darsni qoldirish") works like a holiday for that group**: not charged, not paid, the month's
  price drops by one lesson.
- **A substitute is paid for that lesson by their own salary rule**; the absent teacher isn't.
- All approved in chat: a menu on each lesson date; permission "Darslarni boshqarish" (admins + Menejer); this month
  onward; reasons can be set by whoever marks attendance.

## Assumptions

- A1. Money changes only from November 2026 (per-lesson era), as with holidays; before that, a cancellation affects
  attendance and the course plan, and a substitution is recorded only.
- A2. A substitute with a FIXED (monthly) salary gets nothing extra; a FIXED regular teacher loses nothing. Only PERCENT
  and PER_STUDENT pay move.
- A3. Cancel / substitute only on the group's lesson days, this month onward, not on holidays; a cancelled lesson
  can't also have a substitute. Both can be undone (same month rule).
- A4. Marks already given on a day that gets cancelled are removed (the lesson didn't happen); absence reasons go with
  their marks.

## Data

```prisma
model AbsenceReason {            // Settings → Sabablar (second list beside the leave reasons)
  id     Int     @id @default(autoincrement())
  name   String  @unique
  color  String  // one of TAG_COLORS
  active Boolean @default(true)
  marks  Attendance[]
}

model Attendance { reasonId Int?  reason AbsenceReason? @relation(..., onDelete: SetNull) } // only when absent

model LessonChange {
  id           Int      @id @default(autoincrement())
  groupId      Int
  group        Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  date         DateTime // the lesson day, UTC midnight
  kind         String   // CANCEL | SUBSTITUTE
  role         String?  // SUBSTITUTE: TEACHER | ASSISTANT — whose lesson is taken
  substituteId Int?     // SUBSTITUTE: who teaches it
  substitute   User?    @relation("Substitutions", fields: [substituteId], references: [id], onDelete: SetNull)
  reason       String?
  userId       Int?     // who recorded it
  createdAt    DateTime @default(now())
  @@unique([groupId, date, kind, role])
}
```

A seed/migration script `npm run db:absence-reasons` adds the seven starting reasons if missing (re-runnable).

## Money and course plan

- **Cancelled lessons** join the membership's closed days: `BillableMembership.holidays` becomes centre holidays ∪
  that group's cancelled days (helper `closedDaysFor(groupId)` / `withClosedDays`), so billing, teacher pay and
  previews all follow the holiday rule unchanged. `CurriculumGroup.holidays` gets the same set (level lesson counts,
  exam day).
- **Substitutes**: teacher pay decides who taught each lesson with `taughtBy(day)` = substitution for that day and
  role, else the teacher history (`teacherOn`). The salary loaders also include memberships of groups where the person
  substituted that month. A substitute's PERCENT pay = their % of that lesson's value; PER_STUDENT = their amount ×
  1 / lessonsInMonth per student. The regular teacher loses exactly that lesson.
- Old-rule months (before Nov 2026) are unchanged (A1).

## Screens

- **Date menu** on each lesson date in the attendance and grades grids (button on the date header):
  Hammasi keldi · Kelmaganlik sabablari · Darsni qoldirish / Qoldirishni bekor qilish · O'qituvchini almashtirish /
  Almashtirishni bekor qilish. Menu items need the right permission (attendance.mark for the first two,
  `lessons.manage` for the rest).
- **Grid**: a cancelled day is a greyed "Bekor" column (like holidays, not markable); a substituted day shows "↔" with
  the substitute's name in the header tooltip; an absent cell shows a red flag when it has no reason, else the reason's
  colour, reason in the tooltip.
- **"Bugungi dars"**: a "Kelmadi" student gets a small reason select; the card is hidden when today's lesson is
  cancelled ("Dars bekor qilindi"); a substitute is shown ("Bugun: Aziz Karimov o'rniga Dilnoza Rahimova").
- **Settings → Sabablar** gains a second list "Kelmaganlik sabablari" (add, rename, colour, switch off).
- **Salary breakdown** (`/salaries/[userId]`): substitute lessons appear in the lesson rows like any taught lesson.
- **Tarix / activity log**: cancel, undo, substitute, undo are logged (`lesson.change`).

## Testing

- Unit: closed days = holidays ∪ cancelled (billing 600 000 × 11/12 for one cancelled lesson; teacher basis drops the
  same); substitute PERCENT and PER_STUDENT earnings for one lesson, regular teacher loses exactly that; FIXED
  unaffected; old-rule month unaffected; curriculum lesson count and exam move on a cancelled exam day; change rules
  (lesson day, this month onward, not a holiday, cancel vs substitute conflict, undo).
- Evidence: with no changes balances and salaries equal master; with a temporary November cancellation and substitution
  the student's charge, the regular teacher's and the substitute's pay move by exactly one lesson's share; data removed.
- Browser: date menu actions, reasons in the grid and the today card, cancel/undo, substitute/undo, teacher sees no
  cancel/substitute items; 375 px and dark mode.
