# Price history and lesson-exact teacher pay

Date: 2026-10-10
Status: awaiting review

## 1. Goal

Every so'm on a student's balance and on a teacher's salary can be traced to specific lesson days:

- A price change (group or course) applies from the next month; past months keep the price they were charged at.
- A teacher earns for exactly the lessons they taught. When a student moves to another group, or a group gets a
  new teacher, mid-month, the old and new teacher each get their own lessons — nothing counted twice, nothing lost.
- The salaries page shows, per teacher, which students and lessons each amount comes from.

## 2. What the user said vs. assumed

Said:

- Price changes apply from the new month.
- "Precise calculation of each student's balance, so there is no misunderstanding when calculating their new
  teacher and old teacher."
- Teacher pay follows lessons taught (percentage and per-student).
- Percentage teachers earn on lessons charged, paid or not.
- The new teacher-pay rule applies from November 2026; September/October salaries stay as they are.

Assumed (correct me in review):

- P1. A price edit asks nothing extra: it always starts on the 1st of next month, and the form says so.
  (Earlier months can't be re-priced from the screen.)
- P2. A course price change applies (from next month) to that course's groups that follow the course price; groups
  with their own price are not affected.
- T1. A group teacher or assistant change asks "from which date" (default today); lessons from that date belong to
  the new person.
- T2. Assistants keep today's rule: an assistant on a percentage / per-student salary earns on the same lessons as the
  main teacher.
- T3. Fixed-salary staff are unaffected.

## 3. Price history

- New table `GroupPrice { groupId, price, from (1st of a month, UTC), userId, createdAt }`.
- The price a group charges in month M = the latest row with `from ≤ M`; with no rows, the current price
  (group price, else course price) — so nothing changes for groups that were never re-priced.
- Changing a group's price (group form) writes, on the first change, a baseline row with the old price from the
  beginning of time, then a row with the new price from the 1st of next month. Later changes add one row each; a
  second change for the same month replaces that month's row.
- Changing a course's price (course form) does the same for every group of that course without its own price, and
  updates the course's default for new groups.
- Group page and profile show the current price and, if one is scheduled, "1-noyabrdan: 650 000 so'm".

## 4. Teacher history

- New table `GroupTeacher { groupId, userId, role (TEACHER | ASSISTANT), from (date), until (date | null) }`.
- Existing groups get one TEACHER row (and one ASSISTANT row if set) from the group's start date — migrated.
- Changing the teacher / assistant in the group form closes the current row the day before the chosen date and
  opens a new one; `Group.teacherId / assistantId` keep showing the current person (so access rules and lists are
  unchanged).
- `teacherOn(group, day, role)` gives who taught a lesson day.

## 5. Teacher pay from November 2026

For each lesson day the student was charged for (the billing rule already decides this), the lesson's value is
`month charge ÷ billable lessons` for that membership — so the values add up to exactly the month charge.

- PERCENT teacher: % × sum of the lesson values of lessons they taught (as TEACHER or ASSISTANT per T2), across all
  students and groups. Paid or not.
- PER_STUDENT teacher: for each student, `amount × (lessons that student had with this teacher) ÷ (lessons in that
  group's month)`. A full month with one teacher = the full amount; half a month = half.
- Rounding: once per teacher per month (the total), not per lesson.
- Before November: today's rules exactly (percentage of payments recorded to their groups; per-student count).

Example (October-style transfer in November): student charged 289 286 in ROBO-3 (9 lessons, teacher A) and
230 769 in FE-14 (5 lessons, teacher B). Teacher A at 40% earns 115 714 from this student, teacher B 92 308.

## 6. Salary breakdown

The salaries page gets a "Batafsil" (details) view per teacher and month: one row per student-group with lessons
taught, the charged value of those lessons and the teacher's share, plus the total that matches the salary row.

## 7. Code shape

- `src/lib/billing.ts`: price comes from `priceAt(group, year, month)`; `lessonValues(m, year, month)` returns each
  billable lesson day with its value (sums to the month charge).
- `src/lib/teacher-pay.ts` (new, pure): `teacherEarnings(teacherId, memberships, teacherHistory, year, month)` →
  rows and totals for PERCENT and PER_STUDENT.
- `src/lib/salary.ts`: November onward uses `teacher-pay.ts`; earlier months unchanged.
- Server helpers to change price / teacher write the history rows in one transaction and log the change.
- Migration script extends `db:migrate-statuses` (or a new `db:migrate-history`) to create the baseline teacher
  rows; idempotent.

## 8. Testing

- Unit tests: price history lookup (no rows, baseline + change, two changes, same-month replace, course change
  skips own-price groups); lesson values sum to the month charge; teacher earnings for a full month, a mid-month
  transfer (the example above), a mid-month teacher change in one group, frozen days, trial days, assistant,
  rounding.
- Evidence checks: all current balances unchanged; September/October salaries unchanged.
- Browser: change a price → schedule shown, current month unaffected; change a teacher with a date; salary details
  add up.

## 9. Out of scope

EduTrack features (modules, levels, 13-lesson progress, exam dates, archive, availability) — designed next as their
own step.
