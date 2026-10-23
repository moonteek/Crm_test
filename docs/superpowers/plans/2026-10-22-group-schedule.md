# Group Schedule (Step 4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Groups get custom lesson weekdays, an end time, and a schedule history so a change applies from a chosen date while earlier lessons keep the old schedule.

**Architecture:** Pure helpers in two new files — `src/lib/group-days.ts` (day sets, labels, lesson length) and `src/lib/group-schedule.ts` (history: `scheduleOn`, `lessonDatesOf`, change checks). Every lesson-date calculation is moved onto them; the group types they take make `schedules` required so a missing Prisma include is a type error. A new `GroupSchedule` table holds the rows; `Group.days/time/endTime` hold the newest schedule.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma 6 / SQLite (`db push`), zod 4, node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-10-22-group-schedule-design.md`

## Global Constraints

- UI copy in Uzbek, exactly as given here; colours only from theme tokens (`npm run check:colors`).
- Server actions: permission check first, return `ActionState` / `MemberActionState` via `tryAction` / try-catch with `unstable_rethrow`; refusals are plain `Error` with Uzbek text.
- Days are stored in `Group.days`: `ODD` | `EVEN` | `DAILY` | ascending custom weekdays `"1,4,6"` (1 = Monday … 6 = Saturday). A custom set equal to a named set is stored as the name. Sunday (0) is never a lesson day.
- Lesson length = end − start; empty `endTime` = start + `course.lessonMin`. End after start, same day, at most 240 minutes. The existing 08:00–20:00 window (`fitsDay`) still applies to start and end.
- Schedule change date: not before the 1st of the current month (centre time), not before the group's start date, not before its latest schedule row, at most 60 days after today.
- First schedule change of a group writes two rows (old schedule from the group's start date, new from the chosen date); a change on the date of an existing row replaces that row.
- Verification per task: `npm test` green and `npm run lint` with no `error TS`.

## Review Focus

1. A page or loader that builds a billing/curriculum group without `schedules` — must fail type check, never fall back silently (Task 3 makes the field required; Task 4 test asserts a split month).
2. A future-dated change: until its date, today's lists (dashboard, timetable, reminders, unmarked, lesson-open checks) must use the old days and time (Task 5 test `scheduleOn before a future row`).
3. Custom set that matches a named set, unordered or duplicated input (`"5,1,3,3"`) → stored `ODD` (Task 1 test).
4. A mark on a day that the new schedule drops, but which is a make-up day → not a refusal (Task 2 test in `removedLessonDays`).
5. Clash check of a change dated in the future against another group's future row (Task 6 test of `schedulesFrom`).

---

### Task 1: Day sets, labels and lesson length

**Files:**
- Create: `src/lib/group-days.ts`, `src/lib/group-days.test.ts`
- Modify: `src/lib/format.ts` (`lessonWeekdays` delegates to `weekdaysOf`), `src/lib/availability.ts` (`dayTypesOf`, `clashMessage` label), every `GROUP_DAYS[...]` label lookup: `groups/page.tsx`, `groups/[id]/page.tsx`, `rooms/page.tsx`, `students/[id]/page.tsx`, `lists/groups.ts`, `lists/rooms.ts`, `mcp/tools.ts`
- Modify: `prisma/schema.prisma` — `Group.endTime String?` (comment: "HH:MM; empty = time + course.lessonMin")

**Interfaces:**
- Produces:
  - `weekdaysOf(days: string): number[]` — ODD [1,3,5], EVEN [2,4,6], DAILY [1..6], custom parsed; unknown → [].
  - `normalizeDays(weekdays: number[]): string | null` — sorts, dedupes, drops nothing silently: any value outside 1..6 or empty → `null`; equal to a named set → its key.
  - `daysLabel(days: string): string` — named sets keep `GROUP_DAYS` text; custom → short names joined by " / " (Du, Se, Chor, Pay, Ju, Sha).
  - `lessonMinutes(g: { time: string; endTime: string | null; course: { lessonMin: number } }): number`
  - `endOf(g)` → `"HH:MM"` (start + `lessonMinutes`).
  - `timeProblem(time: string, endTime: string): string | null` — `"Tugash vaqti boshlanishdan keyin bo'lishi kerak"`, `"Dars 4 soatdan uzun bo'lmasin"`, `"Dars 08:00–20:00 oralig'ida bo'lishi kerak"`.

- [ ] **Step 1: Write failing tests** in `group-days.test.ts`:
```ts
assert.deepEqual(weekdaysOf("ODD"), [1, 3, 5]); assert.deepEqual(weekdaysOf("1,4,6"), [1, 4, 6]);
assert.equal(normalizeDays([5, 1, 3, 3]), "ODD"); assert.equal(normalizeDays([2, 4, 6]), "EVEN");
assert.equal(normalizeDays([1, 2, 3, 4, 5, 6]), "DAILY"); assert.equal(normalizeDays([6, 1, 4]), "1,4,6");
assert.equal(normalizeDays([]), null); assert.equal(normalizeDays([0, 1]), null); assert.equal(normalizeDays([7]), null);
assert.equal(daysLabel("1,4,6"), "Du / Pay / Sha"); assert.equal(daysLabel("ODD"), "Du / Chor / Ju");
assert.equal(lessonMinutes({ time: "14:00", endTime: null, course: { lessonMin: 90 } }), 90);
assert.equal(lessonMinutes({ time: "14:00", endTime: "15:30", course: { lessonMin: 120 } }), 90);
assert.equal(timeProblem("14:00", "14:00"), "Tugash vaqti boshlanishdan keyin bo'lishi kerak");
assert.equal(timeProblem("10:00", "14:30"), "Dars 4 soatdan uzun bo'lmasin");
assert.equal(timeProblem("19:00", "20:30"), "Dars 08:00–20:00 oralig'ida bo'lishi kerak");
assert.equal(timeProblem("14:00", "16:00"), null);
```
  Also in `availability.test.ts`: `dayTypesOf("1,4") → ["ODD","EVEN"]`, `dayTypesOf("1,5") → ["ODD"]`.
- [ ] **Step 2: Run** `npm test` → FAIL (module missing).
- [ ] **Step 3: Implement** the functions; `lessonWeekdays` in format.ts returns `weekdaysOf(days)`; `dayTypesOf` = each type whose weekdays meet the set's; replace label lookups with `daysLabel`. Add `endTime` to schema, run `npx prisma db push` (dev server stopped).
- [ ] **Step 4: Run** `npm test` and `npm run lint` → PASS, no `error TS`.
- [ ] **Step 5: Commit** `feat(groups): custom day sets, labels and lesson length helpers`.

### Task 2: Schedule history core

**Files:**
- Create: `src/lib/group-schedule.ts`, `src/lib/group-schedule.test.ts`
- Modify: `prisma/schema.prisma` — `model GroupSchedule { id, groupId (cascade), from DateTime, days String, time String, endTime String?, userId Int? (SetNull), createdAt; @@unique([groupId, from]) }`, `Group.schedules GroupSchedule[]`, `User.groupSchedules`

**Interfaces:**
- Consumes: `weekdaysOf` (Task 1).
- Produces:
  - `type ScheduleRow = { from: Date; days: string; time: string; endTime: string | null }`
  - `type Scheduled = { days: string; time: string; endTime: string | null; schedules: ScheduleRow[] }`
  - `scheduleOn(g: Scheduled, day: Date): { days: string; time: string; endTime: string | null }` — row with latest `from ≤ day`, else the group's fields.
  - `isLessonDay(g: Scheduled, day: Date): boolean` (Sunday never).
  - `lessonDatesOf(g: Scheduled, year: number, month: number): Date[]`
  - `heldLessonsOf(g: Scheduled, year: number, month: number, closed: string[]): Date[]`
  - `schedulesFrom(g: Scheduled, day: Date): { days; time; endTime }[]` — the schedule on `day` plus every later row.
  - `scheduleChangeProblem(p: { from: Date; today: Date; startDate: Date; rows: ScheduleRow[] }): string | null` — messages: `"Jadvalni o'tgan oylardan boshlab o'zgartirib bo'lmaydi — eng erta sana: DD.MM.YYYY"`, `"Sana guruh boshlanishidan oldin bo'lishi mumkin emas"`, `"Sana oldingi jadval o'zgarishidan (DD.MM.YYYY) oldin bo'lishi mumkin emas"`, `"Ko'pi bilan 60 kun oldinga"`.
  - `removedLessonDays(p: { marked: string[]; from: Date; days: string; makeups: string[] }): string[]` — ISO days ≥ from, not a lesson day of `days`, not a make-up; sorted.
  - `scheduleRowsToWrite(p: { before: ScheduleRow; startDate: Date; rows: ScheduleRow[]; next: ScheduleRow }): ScheduleRow[]` — rows to upsert: none existing → [before@startDate, next]; else [next] (same `from` replaces).

- [ ] **Step 1: Write failing tests**: `scheduleOn` with no rows → group fields; before first row; on the boundary day (row applies); with a future row (today's old one applies). `lessonDatesOf` for November 2026 with rows `[{from: 2026-11-01, ODD}, {from: 2026-11-16, EVEN}]` → Mondays/Weds/Fris before the 16th and Tue/Thu/Sat from the 16th (assert exact ISO list). `scheduleChangeProblem`: today 2026-11-10 → from 2026-10-31 refused with "01.11.2026"; from before latest row refused; 2027-01-10 refused (>60 days); from 2026-11-10 → null. `removedLessonDays({ marked: ["2026-11-16","2026-11-17","2026-11-09"], from: 2026-11-15, days: "EVEN", makeups: [] })` → `["2026-11-16"]`; with `makeups: ["2026-11-16"]` → `[]`. `scheduleRowsToWrite` first change → 2 rows; later change → 1.
- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement**; schema change, `npx prisma db push`.
- [ ] **Step 4: Run** `npm test`, `npm run lint` → PASS.
- [ ] **Step 5: Commit** `feat(groups): schedule history rows and helpers`.

### Task 3: Billing and teacher pay through the history

**Files:**
- Modify: `src/lib/billing.ts` (`BillableMembership.group` gains required `schedules: ScheduleRow[]` and `time`, `endTime`; `lineFor` uses `lessonDatesOf(m.group, y, mo)`), `src/lib/teacher-pay.ts` (`lessonsInMonth` = `lessonDatesOf(...)`), `src/lib/billing-include.ts` (`schedules: true` in group include), `src/lib/salary.ts` includes, `src/components/members/types.ts` (`MemberGroup.schedules` as ISO strings + time/endTime; `toMemberGroup` and the client parse back), every other include/select that type check now flags (`students/[id]/page.tsx`, `lists/students.ts`, `groups/[id]/page.tsx` transfer targets, sales, alerts, statement, risk …), all billing/teacher-pay test fixtures (`schedules: []`).

**Interfaces:**
- Consumes: `ScheduleRow`, `lessonDatesOf` (Task 2).

- [ ] **Step 1: Write failing tests** in `billing.test.ts`: a membership active all of November 2026 in a group 1 200 000 so'm, rows `[{from 2026-11-01 ODD 14:00}, {from 2026-11-16 EVEN 14:00}]`: November `lessons` = 12 (ODD 2,4,6,9,11,13 + EVEN 17,19,21,24,26,28), `amount` 1 200 000. Same membership with student leaving 2026-11-14 → `billable` 6, `amount` 600 000. In `teacher-pay.test.ts`: same split month, PER_STUDENT 120 000, teacher taught all → share 120 000 with `lessonsInMonth` 12.
- [ ] **Step 2: Run** → FAIL (old code counts ODD all month).
- [ ] **Step 3: Implement**; fix every type error `npm run lint` lists by adding `schedules: true` to the include or select (never `?? []` at a call site).
- [ ] **Step 4: Run** `npm test`, `npm run lint` → PASS.
- [ ] **Step 5: Commit** `feat(billing): charges and teacher pay follow the group's schedule history`.

### Task 4: Past lessons — curriculum, attendance grid, lessons passed

**Files:**
- Modify: `src/lib/curriculum.ts` (`CurriculumGroup` replaces `days: string` with `Scheduled` fields; `heldFrom` uses `heldLessonsOf`), `src/lib/timetable.ts` (`lessonsPassed(group: Scheduled & { startDate }, …)` uses `isLessonDay`), `src/app/(app)/groups/[id]/page.tsx` (grid days = `lessonDatesOf`), `src/lib/lists/group-sheet.ts`, callers of `levelWindows`/`progressOn`/`levelExams`/`curriculumOn` (groups list, group page, alerts-db, risk, actions level exams, dashboard) — include `schedules`.

**Interfaces:**
- Consumes: `Scheduled`, `heldLessonsOf`, `isLessonDay`, `lessonDatesOf` (Task 2).

- [ ] **Step 1: Write failing tests**: `curriculum.test.ts` — group from 2026-11-02 ODD with a row EVEN from 2026-11-16, an 8-lesson level: its last lesson is `"2026-11-19"` (ODD 2,4,6,9,11,13 then EVEN 17,19). `timetable.test.ts` — `lessonsPassed` on 2026-11-19 for that group = 8.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; fix type errors by including `schedules`.
- [ ] **Step 4: Run** `npm test`, `npm run lint` → PASS.
- [ ] **Step 5: Commit** `feat(groups): curriculum and attendance grid follow the schedule history`.

### Task 5: Today and future — lesson checks, lists, reminders, timetable

**Files:**
- Modify: `src/lib/lesson-changes.ts` (cancel/substitute "Bu kunda dars yo'q" and make-up "Guruhning shu kuni darsi bor" take `isLessonDay(group, date)` — input field `days: string` becomes `group: Scheduled`), `actions.ts` lesson-open checks (lines ~593, ~1359) and `lessons/[groupId]/[day]/page.tsx` (`weekdayLesson: isLessonDay(group, day)`), `src/lib/attendance.ts` unmarked (`isLessonDay` + `scheduleOn(today).time`), `src/lib/telegram-plan.ts` (lesson today + reminder time + end from `scheduleOn`), `src/app/(app)/page.tsx`, `src/app/(app)/schedule/page.tsx`, `src/lib/lists/schedule.ts` (load active groups with `schedules`, filter in memory with `isLessonDay(g, dateOfWeekdayThisWeek)`), timetable cards (time/length from `scheduleOn`), `src/lib/schedule.ts` (delete `scheduleKeysOn`), group page "lesson today" and "Jadval" (today's schedule; when a later row exists a second line `"DD.MM dan: <daysLabel> · HH:MM–HH:MM"`).

**Interfaces:**
- Consumes: `scheduleOn`, `isLessonDay`, `lessonMinutes`, `daysLabel`, `endOf`.

- [ ] **Step 1: Write failing tests**: `lesson-changes.test.ts` — cancel on 2026-11-17 for a group ODD with row EVEN from 2026-11-16 → allowed; on 2026-11-18 → "Bu kunda dars yo'q". `attendance.test.ts` / `telegram-plan.test.ts` — a group ODD 14:00 with a future row EVEN 16:00 from 2026-11-16: on Monday 2026-11-09 it is in today's plan at 14:00; on Monday 2026-11-23 it is not; on Tuesday 2026-11-17 it is, at 16:00.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; Ruling for `/schedule` weekday tabs: the date is that weekday of the current centre week.
- [ ] **Step 4: Run** `npm test`, `npm run lint` → PASS; `grep -rn "scheduleKeysOn\|lessonDates(\|heldLessons(" src` shows only `format.ts` internals and tests.
- [ ] **Step 5: Commit** `feat(groups): today's lessons, reminders and timetable follow the schedule history`.

### Task 6: Lesson length and clash checks with end time and future schedules

**Files:**
- Modify: `src/lib/availability.ts` (`LessonLike.minutes` stays; callers fill it from `lessonMinutes`), `actions.ts` `checkGroupTime` (candidate minutes = end − start; others: every schedule in `schedulesFrom(other, from)` becomes a `LessonLike`; `fitsDay` with the candidate's minutes), make-up clash list (~1361, `minutes: lessonMinutes(c.group)`), every `course.lessonMin` use for a group lesson (availability page, teachers page, schedule page/list, dashboard, telegram-bot, telegram-plan) → `lessonMinutes(group)`.

**Interfaces:**
- Consumes: `lessonMinutes`, `schedulesFrom` (Tasks 1–2). `checkGroupTime(g: GroupTime & { endTime: string | null; from: Date })`.

- [ ] **Step 1: Write failing test** in `group-schedule.test.ts`: `schedulesFrom` for a group ODD 14:00 with row EVEN 16:00 from 2026-12-01, asked on 2026-11-20 → both schedules; on 2026-12-05 → only EVEN 16:00. In `availability.test.ts`: a candidate EVEN 16:00–17:30 clashes with that group's future EVEN 16:00 schedule in the same room (via `groupClashes` over the expanded list).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `npm test`, `npm run lint` → PASS; `grep -rn "lessonMin" src` shows only course pages/actions, `lessonMinutes`, and new-group default.
- [ ] **Step 5: Commit** `feat(groups): lesson length from the end time; clash checks see future schedules`.

### Task 7: Group form and saving a schedule change

**Files:**
- Create: `src/components/ScheduleFields.tsx` (client): day select Toq kunlar / Juft kunlar / Har kuni / Boshqa; Boshqa shows six checkboxes `customDays` (Du … Sha); start `time` and `endTime` inputs (label "Boshlanish vaqti", "Tugash vaqti"); on a new group, a course or start change sets end = start + that course's `lessonMin` (course options carry `lessonMin`); on edit, when days/start/end differ from the saved values, shows "Qachondan?" `scheduleFrom` date (default today, hint "Shu kundan oldingi darslar eski jadval bo'yicha qoladi").
- Modify: `src/components/GroupFields.tsx` (uses ScheduleFields; `g` gains `endTime`), `CourseStartFields` course option type (`lessonMin`), `actions.ts`: `groupSchema` days via `daysField` (reads `days` + `customDays[]`, `normalizeDays`, refusal `"Kamida bitta dars kunini tanlang"`), `endTime: v.time()`, `timeProblem` refusal; `insertGroup` saves `endTime`; `updateGroup`: when schedule changed → `scheduleChangeProblem`, marks check (attendance + grades from `from`, make-ups from `makeupDaysOf`) → `"Bu sanalarda davomat bor: 16.11, 18.11 — avval ularni tozalang"` (up to 5 dates, then " …"), write `scheduleRowsToWrite` in the same transaction, log `group.schedule` "`<name>` jadvali DD.MM.YYYY dan: <daysLabel> HH:MM–HH:MM".
- Test: `src/lib/group-days.test.ts` (`daysField` parse), `group-schedule.test.ts` (`marksMessage(dates: string[])`).

**Interfaces:**
- Produces: `daysField()` zod preprocessor in `group-days.ts`; `marksMessage(dates: string[]): string` in `group-schedule.ts`.

- [ ] **Step 1: Write failing tests**: `daysField` parses `{days:"CUSTOM", customDays:["6","1","4"]}` → `"1,4,6"`, `{days:"CUSTOM", customDays:[]}` → error `"Kamida bitta dars kunini tanlang"`, `{days:"EVEN"}` → `"EVEN"`, `{days:"CUSTOM", customDays:["2","4","6"]}` → `"EVEN"`. `marksMessage(["2026-11-16","2026-11-18"])` → `"Bu sanalarda davomat bor: 16.11, 18.11 — avval ularni tozalang"`; 7 dates → first 5 then " …".
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run check:colors` → PASS. In the browser (preview `dev`, admin 901234567 / admin123): create a group with Boshqa Du/Pay, 15:00–16:30; edit it to Juft from a date next week → group page shows today's line and "DD.MM dan: Se / Pay / Sha …"; the timetable shows the old schedule today; an edit dated last month is refused with the earliest-date message.
- [ ] **Step 5: Commit** `feat(groups): day picker with custom days, end time, schedule change from a date`.

### Task 8: README

**Files:** Modify: `README.md` — groups section: custom days, end time, schedule change from a date; server note "after pulling: `npm run db:push`".

- [ ] **Step 1:** Write the section. **Step 2:** `npm test`, `npm run lint` → PASS. **Step 3: Commit** `docs: group schedule`.
