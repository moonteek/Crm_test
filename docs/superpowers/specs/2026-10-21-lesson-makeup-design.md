# Lesson make-up, balance toggle and one-day substitute access — design

## Goal

When a lesson is cancelled ("Darsni qoldirish") the office can move it to another day (a make-up lesson) or decide
whether the students and teacher are still charged/paid; and whoever covers one lesson — a substitute
("O'qituvchini almashtirish") or a make-up teacher — can mark attendance and grade **that lesson only**.

Builds on `2026-10-12-lesson-tools-design.md` (cancel / substitute, `LessonChange`, closed days) and the old CRM's
"Darsni qoldirish" dialog (screenshot 2026-10-12 090204).

## User's answers (binding)

- Make-up money: **nothing changes** — the lesson is moved, not lost: charged and paid as if held on its original day.
  Attendance and grades go on the make-up date; the course plan counts the make-up lesson.
- Make-up dialog: **date + time + room** (time and room pre-filled with the group's), refused when the teacher or room
  is busy then; shows in the timetable and as an extra column in the attendance grid.
- Make-up teacher: **the group's teacher, changeable**; someone else is paid for that lesson (like a substitute) and
  can mark/grade it.
- Make-up dates: **today to 60 days ahead**; not a centre holiday, not a day the group already has a lesson, not a
  cancelled day. A make-up can itself be cancelled or moved again later.
- Toggle "Talabalar va o'qituvchi balansiga ta'sir qilsin" (cancel **without** make-up): **ON (default) = like a
  holiday, not charged / not paid** (today's behaviour); **OFF = still charged and paid**.
- One-day substitute (and make-up teacher): **mark + grade that lesson only** — on that day, from their Bosh sahifa;
  no other dates, no payments, no student details beyond names.

## Data

`LessonChange` (kind `CANCEL`) gains:

- `charged Boolean @default(false)` — true when the toggle is OFF (money as if held).
- `makeupDate DateTime?` (UTC midnight), `makeupTime String?` ("HH:MM"), `makeupRoomId Int?` → Room (SetNull),
  `makeupTeacherId Int?` → User (SetNull, relation "Makeups").

A cancel with `makeupDate` is a **moved** lesson; money follows the original day. Existing rows keep today's meaning
(`charged=false`, no make-up).

## Day sets (src/lib/lesson-changes.ts, src/lib/holidays-db.ts)

Today one set "closed days" (holidays ∪ cancelled) serves money and the course plan. It splits into:

- **No-lesson days** (course plan, attendance/grade marking, unmarked lists, alerts): holidays ∪ every cancelled day.
  (= today's `closedDaysOf`, unchanged name and behaviour.)
- **Not-charged days** (billing, teacher pay, debtors, previews): holidays ∪ cancelled days with `charged = false` and
  no `makeupDate`. New cached loader `unchargedDaysOf()`; every money consumer switches to it (billing.ts, salary.ts,
  lists/debtors.ts, lists/students.ts, students/[id] page, dashboard, search route, MCP tools, telegram-bot salary text).
- **Extra lesson days** (course plan, attendance grid, marking): each group's make-up dates. `CurriculumGroup` gains
  `extraDays: string[]`; `levelWindows` merges them into the held-lesson list (sorted, deduplicated, never a no-lesson
  day).

Pure helpers with tests: `noLessonDays(holidays, cancels)`, `unchargedDays(holidays, cancels)`, `makeupDays(cancels)`.

## Teacher pay

- A moved lesson is paid on its **original day** (it's a held lesson for money). Who earns it: the make-up teacher if
  set and different from the group's teacher that day, else the usual `taughtBy` (substitute for that day, else
  teacher history). Same per-lesson rules as substitutes (PERCENT share of that lesson; PER_STUDENT 1/lessonsInMonth;
  FIXED unaffected); the regular teacher loses exactly that lesson. Only in the per-lesson era (from Nov 2026), as
  with substitutes.
- Charged-but-cancelled (`charged=true`, no make-up): paid to whoever `taughtBy` that day as if held.

## Cancel dialog (lesson menu → "Darsni qoldirish")

- Sabab (optional, as now).
- "Boshqa sanada darsni o'tasizmi?" — **Ha** / **Yo'q** (default Yo'q).
- Ha: Sana (min today, max today + 60), Vaqt (default the group's time), Xona (default the group's room, may be
  empty), O'qituvchi (default the group's teacher on the original day). Refusals (inline):
  "Bayram kuni", "Guruhning shu kuni darsi bor", "Bu kun ham bekor qilingan", "Sana bugundan 60 kungacha bo'lishi
  kerak", teacher / room busy messages from the date clash check (weekly lessons of active groups on that weekday,
  their make-ups on that date, minus cancelled ones; lesson length = course `lessonMin`; must fit 08:00–20:00).
- Yo'q: switch "Talabalar va o'qituvchi balansiga ta'sir qilsin" (on).
- Same rights as today (`lessons.manage`, this month onward, lesson day, not a holiday, not already cancelled).
- **Undo** ("Qoldirishni bekor qilish") removes the cancel and its make-up; refused when the make-up date already has
  marks or grades ("Qo'shimcha darsda davomat bor — avval uni o'chiring").
- **Make-up menu**: the make-up column's date menu offers "Qo'shimcha darsni ko'chirish" (new date/time/room/teacher,
  same checks) and "Qo'shimcha darsni bekor qilish" (asks the toggle like a cancel: ON → becomes a plain cancel,
  not charged; OFF → plain cancel, charged).

## Screens

- **Attendance and grades grid**: make-up dates of the shown month appear as extra columns, header "25.10" with a
  "qo'shimcha" label; the original column shows "Bekor → 25.10" (or "Bekor" / "Bekor · to'lanadi" when charged).
- **Group page "Bugungi dars"** works on a make-up day too.
- **Timetable** (both views): on a make-up date a card "Qo'shimcha dars" at its time and room (dashed border);
  the original lesson stays greyed as today.
- **Dashboard (Bosh sahifa)**: today's list includes make-ups; for the covering person a block
  "O'rinbosar darslaringiz" lists today's lessons they cover (substitute or make-up teacher) with a link.
- **Single-lesson page** `/lessons/[groupId]/[day]`: group name, time, room, and the students active/trial on that
  day with Keldi / Kechikdi / Kelmadi, absence reason and the daily grade (1–5). Shown to: the group's own staff
  (as today's group page rights) and **the covering person on that day only**. No phones, balances or other dates.
- **Telegram**: moved lesson → teacher and assistant: "FE-12: 23.10 dagi dars 25.10 14:00 ga ko'chirildi (2-xona)";
  a different make-up teacher gets "Siz FE-12 guruhining 25.10 14:00 dagi qo'shimcha darsini o'tasiz (2-xona)".
  Undo / move again send the matching texts (like substitute undo).

## Access

- New check `coverAllowed(user, groupId, day, today)`: true when `day == today` and the user is that day's substitute
  (`SUBSTITUTE`, `substituteId`) or the make-up teacher of a make-up on that day for that group.
- Marking actions (attendance, absence reason, grade, "Hammasi keldi") accept a user who has `attendance.mark` /
  `grades.manage` **and** either group access (as now) or `coverAllowed` for exactly that date. The single-lesson page
  uses the same rule. No other action or page changes.

## Testing

Unit:
- day sets: plain cancel → no lesson, not charged; charged cancel → no lesson, charged; moved → no lesson on the
  original day, charged, make-up day is a lesson.
- billing for a month with one moved lesson equals the month with no change; with one plain cancel drops one lesson.
- teacher pay: moved lesson with a different make-up teacher → that teacher earns exactly the lesson, the regular one
  loses it; same teacher → unchanged.
- curriculum: a make-up day counts (level ends one lesson earlier than with a plain cancel; exam on the make-up if it
  is the level's last lesson).
- make-up date rules (range, holiday, own lesson day, cancelled day) and the date clash check.
- `coverAllowed`: right group+day+today → true; another day, another group, yesterday's substitution → false.

Browser: cancel with make-up and without (toggle both ways), extra grid column and timetable card, undo refused when
marked, substitute (teacher Aziz) sees the block and marks/grades only that lesson, refused on another date.

## Production

`npm run db:push`. No data conversion (existing cancels keep today's meaning).

## Out of scope

Bulk moves (a whole week), make-ups for several groups at once, student-side "missed lesson" make-ups (individual
catch-up lessons).
