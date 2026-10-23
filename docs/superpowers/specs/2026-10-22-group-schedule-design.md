# Step 4a — Group lesson schedule: custom days, end time, schedule history

Roadmap step 4 (group extras) is split into three branches: **4a schedule** (this spec), 4b group data & list
(pay rule per group, Telegram chat ID, online/offline + room rule, group tags, note, table view, filters, counts),
4c group page (Chegirma / Reyting / Tarix / Izoh tabs, status dots + legend, attendance PDF, reason colours).

## Why

The old CRM's group form (screenshot 2026-10-22 113756) has "Toq kunlar / Juft kunlar / Boshqa" and a start and end
time. Ours allows only odd / even / daily and a fixed lesson length from the course (120, kids 90). And today an edit
of a group's days rewrites its whole past: from November 2026 billing and teacher pay count lessons by those days, so
changing a schedule mid-course would silently change past charges and salaries. The user chose: custom days, an end
time, and schedule changes that apply from a chosen date while earlier lessons keep the old schedule (option 1:
history rows, like teacher changes).

## What the user gets

### Days
- The group form's day picker: **Toq kunlar** (Du/Chor/Ju), **Juft kunlar** (Se/Pay/Sha), **Har kuni** (Du–Sha),
  **Boshqa** → six checkboxes Du … Sha. At least one day; Sunday is not offered (the timetable is Mon–Sat).
- Stored in the existing `days` string: `ODD`, `EVEN`, `DAILY`, or a custom set as ascending weekday numbers joined
  by commas (`"1,4,6"`; 1 = Monday … 6 = Saturday). A custom set equal to a named one is saved as the name
  (`"1,3,5"` → `ODD`), so filters and labels stay simple.
- Labels: named sets keep today's text; a custom set reads as short names, e.g. "Du / Pay / Sha". One function
  `daysLabel(days)` replaces every `GROUP_DAYS[g.days]` lookup.

### Time
- **Boshlanish vaqti** and **Tugash vaqti**. On a new group, choosing the course (or changing the start) fills the
  end as start + the course's lesson length; the user can change it.
- Rules: both HH:MM (as today's start); end after start on the same day; a lesson is at most 4 hours.
- New column `Group.endTime String?`. Empty (every existing group) = start + course lesson length, so no data script
  is needed. `lessonMinutes(group)` gives the length; it replaces `course.lessonMin` wherever a group's lesson length
  is used (timetable cards and widths, clash checks, teacher availability, make-up clash checks, Telegram reminder /
  unmarked timings, dashboard "today" list). `Course.lessonMin` stays as the default for new groups.

### Schedule history
- New table `GroupSchedule { id, groupId, from (UTC midnight), days, time, endTime, userId, createdAt }`,
  unique `(groupId, from)`, cascade on group delete.
- `Group.days / time / endTime` always hold the **newest** schedule (it may start in the future).
- `scheduleOn(group, day)`: the row with the latest `from ≤ day`; with no such row, the group's own fields. A group
  never changed has no rows and behaves exactly as today.
- On the first change of a group, two rows are written: the old schedule from the group's start date and the new one
  from the chosen date. Later changes add one row.
- Editing a group: when days, start or end time changed, the dialog shows **"Qachondan?"** (date, default today).
  - Earliest: the 1st of the current month (earlier salaries may be paid — same rule as teacher changes);
    and not before the group's latest schedule row. Not before the group's start date.
  - Up to 60 days ahead (same horizon as make-ups).
  - Refused when the group has attendance marks or grades on dates from `from` onward that are no longer lesson
    days under the new schedule (make-up days excepted). The message lists up to 5 dates: "Bu sanalarda davomat bor:
    12.11, 14.11 … — avval ularni tozalang".
  - Refused when the new schedule clashes (room / teacher) with another group — checked as today, against the
    other groups' schedules on or after `from`.
  - A same-date second change replaces that date's row (fixing a typo the same day).
- Changing a group's start date keeps today's behaviour; it is not a schedule change.
- Group page "Jadval" shows today's schedule; when a future row exists, a second line: "12.11 dan: Se / Pay / Sha ·
  16:00–18:00".

### Where the history counts
Every lesson-date calculation goes through the history, by month:
`lessonDatesOf(group, year, month)` = the dates of the month whose weekday is a lesson day of `scheduleOn(group, date)`.
`heldLessonsOf(group, y, m, closed)` drops closed days as `heldLessons` does. They replace `lessonDates(days, …)` /
`heldLessons(days, …)` in:
- billing (`lessonValues` and everything built on it: balances, statements, previews, debtor lists)
- teacher pay (`teacherEarnings` lessons in month) and `salary.ts`
- curriculum (`heldFrom`: progress, level windows, level exams, course-end alerts)
- the group attendance / grades grid and its export (`group-sheet.ts`)
- lesson-change checks (cancel / substitute: "Bu kunda dars yo'q"; make-up: "Guruhning shu kuni darsi bor")
- today checks: group page "lesson today", `lessonOpenOn` (attendance / grades actions, cover page), unmarked lists,
  Telegram plan, dashboard today list, timetable, teacher availability, risk report.

Queries that today filter groups in the database with `days: { in: scheduleKeysOn(weekday) }` (dashboard,
timetable, schedule list) load active groups with their schedule rows and filter in memory with `scheduleOn`,
because custom sets can't be matched by a list and a future row may differ from the group's fields.

To stop a forgotten `include` from silently using the newest schedule for the past, the group types these functions
take make `schedules: ScheduleRow[]` **required**; a missing include is a type error.

## Out of scope
4b and 4c items; Sunday lessons; per-weekday different times (one time for all lesson days, as today); changing
past months (before the current month).

## Testing
- `daysLabel`, parsing / normalising custom sets (`"5,1,3"` → `ODD`, empty → refused, Sunday refused).
- `scheduleOn` with no rows, before the first row, on the boundary day, with a future row.
- `lessonDatesOf` across a mid-month change (Toq until the 14th, Juft from the 15th).
- billing: a membership whose month is split by a change charges the right lessons; teacher pay `lessonsInMonth` and
  shares the same; curriculum progress counts held lessons across the change.
- `scheduleChangeProblem`: before the current month, before the latest row, beyond 60 days, marks on removed days
  (listed), same-day replacement.
- time rules: end ≤ start, longer than 4 h, filled end from course length; `lessonMinutes` fallback.
- clash check uses `lessonMinutes` and the schedule valid on/after `from`.
