# Lesson Make-up, Balance Toggle and One-day Substitute Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cancelled lessons can be moved to a make-up date (money unchanged) or kept charged; make-up lessons appear in the grid, timetable and course plan; a substitute or make-up teacher can mark and grade that one lesson on its day.

**Architecture:** All rules are pure functions in `src/lib/lesson-changes.ts` (day sets, make-up date rules, date clash, cover access, make-ups as substitutes) and `src/lib/curriculum.ts` (`extraDays`). Two cached loaders in `src/lib/holidays-db.ts` feed them: `closedDaysOf` (no-lesson days, unchanged) and new `unchargedDaysOf` (money) / `makeupDaysOf` (extra lesson days). Money consumers switch to `unchargedDaysOf`. UI: the cancel dialog, a make-up column menu, grid/timetable/dashboard additions and a single-lesson page.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma 6 / SQLite, zod 4, node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-10-21-lesson-makeup-design.md`

## Global Constraints

- Make-up date: today … today + 60 days; not a centre holiday; not one of the group's lesson weekdays (already a lesson); not a no-lesson day of the group; not the original date.
- Make-up time "HH:MM", lesson length = course `lessonMin`, must fit 08:00–20:00 (`fitsDay` in `src/lib/availability.ts`).
- Toggle default ON (= `charged = false`). Moved lesson ⇒ money as if held on its original day.
- Money changes only from `PER_LESSON_FROM` (Nov 2026) — the existing billing/teacher-pay switch handles this automatically.
- Copy (exact): "Boshqa sanada darsni o'tasizmi?", "Ha, roziman", "Yo'q", "Talabalar va o'qituvchi balansiga ta'sir qilsin", "Qo'shimcha dars", "Qo'shimcha darsni ko'chirish", "Qo'shimcha darsni bekor qilish", "O'rinbosar darslaringiz", refusals "Bayram kuni", "Guruhning shu kuni darsi bor", "Bu kun ham bekor qilingan", "Sana bugundan 60 kungacha bo'lishi kerak", "Qo'shimcha darsda davomat bor — avval uni o'chiring". Telegram: "FE-12: 23.10 dagi dars 25.10 14:00 ga ko'chirildi (2-xona)" / "Siz FE-12 guruhining 25.10 14:00 dagi qo'shimcha darsini o'tasiz (2-xona)" (room part omitted when no room).
- Every new/changed action: `tryAction` / `{ error }`, permission first (`lessons.manage` for changes; marking keeps `attendance.mark` / `grades.manage`), inline errors; colours via tokens only.
- Stop the dev server before `npm run db:push`.

## Review Focus

1. A make-up date in the **next month** — grid shows it in that month, billing unchanged in both months, curriculum counts it in order. (Task 1 curriculum test + Task 2 billing test.)
2. A substitute who is **also** the group's assistant / a teacher who is the make-up teacher of their own group — no double pay, access rule still day-limited. (Task 1 `coverAllowed` + Task 2 pay test.)
3. Undo of a cancel whose make-up already has marks — refused, nothing deleted. (Task 3 action check in browser + pure guard test.)
4. A make-up moved again to a new date — old make-up column disappears, marks rule as in 3. (Task 3.)
5. The covering person opening `/lessons/[group]/[day]` for another day or group, or the day after — refused (404 / no-access). (Task 1 `coverAllowed` tests + Task 4 browser.)

---

### Task 1: Pure rules

**Files:** Modify `src/lib/lesson-changes.ts`, `src/lib/curriculum.ts`; Test `src/lib/lesson-changes.test.ts`, `src/lib/curriculum.test.ts`

**Interfaces — Produces:**
- `type CancelRow = { groupId: number; date: Date; charged: boolean; makeupDate: Date | null; makeupTime: string | null; makeupRoomId: number | null; makeupTeacherId: number | null }`
- `unchargedDays(holidays: string[], cancels: Pick<CancelRow, "date" | "charged" | "makeupDate">[]): string[]` — holidays ∪ cancels with `!charged && !makeupDate` (ISO, unique). (`closedDays` stays = no-lesson days.)
- `makeupDays(cancels: Pick<CancelRow, "makeupDate">[]): string[]` — ISO make-up dates.
- `makeupProblem(p: { date: Date; original: Date; today: Date; days: string; holidays: string[]; noLesson: string[] }): string | null` — the Global Constraints rules and copy.
- `clashesOn(candidate: { start: string; minutes: number; teacherId: number | null; roomId: number | null }, others: { name: string; start: string; minutes: number; teacherId: number | null; assistantId: number | null; roomId: number | null }[]): string[]` — messages `"O'qituvchi band: <name> <HH:MM>–<HH:MM>"`, `"Xona band: <name> <HH:MM>–<HH:MM>"` for overlapping intervals.
- `makeupSubstitutes(cancels: CancelRow[], teacherOn: (groupId: number, day: Date) => number | null): { groupId: number; date: Date; role: "TEACHER"; substituteId: number }[]` — one entry per cancel with a make-up teacher who isn't the group's teacher on the original day (date = original day).
- `coverAllowed(p: { userId: number; groupId: number; day: string; today: string; subs: { groupId: number; date: Date; substituteId: number | null }[]; makeups: CancelRow[] }): boolean`
- `curriculum.ts`: `CurriculumGroup` + optional `extraDays?: string[]`; `levelWindows` merges `extraDays` (≥ start, not in `holidays`) into the held lessons, sorted, unique.

- [ ] **Step 1: Write failing tests** in `src/lib/lesson-changes.test.ts`:
  - `day sets: plain cancel, charged cancel, moved lesson` — holidays `["2026-11-10"]`; cancels A (11-12, plain), B (11-14, charged), C (11-17, makeup 11-21) → `closedDays` contains all three; `unchargedDays` = holidays + 11-12 only; `makeupDays` = ["2026-11-21"].
  - `make-up date rules` — group "ODD", original 2026-11-16, today 2026-11-16: 11-21 (Sat) ok → null; 11-18 (Wed, own lesson day) → "Guruhning shu kuni darsi bor"; a holiday → "Bayram kuni"; a day in `noLesson` → "Bu kun ham bekor qilingan"; yesterday or today + 61 → "Sana bugundan 60 kungacha bo'lishi kerak".
  - `date clash` — candidate 14:00/120 min teacher 5 room 2 vs other 15:00/120 teacher 5 → one teacher message; other room 2 at 16:00 → none (touching ends); assistant 5 counts as teacher busy.
  - `make-up teacher is paid like a substitute only when it isn't the group's teacher` — two cancels, teacherOn → 5; makeupTeacherId 7 → one entry `{ substituteId: 7, role: "TEACHER", date: original }`; makeupTeacherId 5 or null → none.
  - `cover access: that group, that day, only on the day` — substitute 7 for group 1 on 11-21: (7,1,"2026-11-21",today "2026-11-21") true; today "2026-11-22" false; group 2 false; user 8 false; make-up teacher 9 of group 1 makeup 11-21 → true on 11-21.
  - In `src/lib/curriculum.test.ts`: `a make-up day counts as a lesson` — group ODD from 2026-09-07 with `holidays: ["2026-09-09"]` (cancelled) and `extraDays: ["2026-09-12"]` (Sat) → first window has 13 lessons including 09-12 and its `to` equals the plain (no cancel) window's `to` (2026-10-05).
- [ ] **Step 2: Run** `npx tsx --test src/lib/lesson-changes.test.ts src/lib/curriculum.test.ts` → FAIL (missing exports).
- [ ] **Step 3: Implement** the functions above (times compared in minutes via `toMinutes` from `src/lib/schedule.ts`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(lessons): pure rules for make-ups, charged cancels and cover access`

---

### Task 2: Data, loaders and money

**Files:** Modify `prisma/schema.prisma`, `src/lib/holidays-db.ts`, `src/lib/salary.ts`, `src/lib/lists/debtors.ts`, `src/lib/lists/students.ts`, `src/app/(app)/students/[id]/page.tsx`, `src/app/(app)/page.tsx`, `src/app/api/search/students/route.ts`, `src/lib/mcp/tools.ts`, `src/lib/telegram-bot.ts`, and every curriculum caller that passes `holidays` (`groups/[id]/page.tsx`, `lists/groups.ts`, `lists/group-sheet.ts`, `schedule/page.tsx`, `alerts-db.ts`, `actions.ts` saveLevelExamScores); Test `src/lib/billing.test.ts`, `src/lib/teacher-pay.test.ts`

**Interfaces:**
- Consumes Task 1.
- Produces: `LessonChange` + `charged Boolean @default(false)`, `makeupDate DateTime?`, `makeupTime String?`, `makeupRoomId Int?` (→ Room, SetNull, relation "MakeupRoom"), `makeupTeacherId Int?` (→ User, SetNull, relation "Makeups"); `unchargedDaysOf(): Promise<(groupId) => string[]>` and `makeupDaysOf(): Promise<(groupId) => string[]>` (both `cache()`d, mirroring `closedDaysOf`).

- [ ] **Step 1: Failing tests** — `billing.test.ts`: `a moved lesson is billed like a held one; a plain cancel is not` — a November 2026 membership with `holidays = unchargedDays(…)` for (a) no change, (b) moved, (c) charged cancel → equal charges; (d) plain cancel → one lesson less. `teacher-pay.test.ts`: `a different make-up teacher earns the moved lesson` — PERCENT teacher 5 and substitute list from `makeupSubstitutes` with teacher 7 → teacher 7 earns exactly that lesson's share, teacher 5 loses it.
- [ ] **Step 2: Run** → FAIL (fixtures use new helpers / expectations).
- [ ] **Step 3: Implement** schema, `npm run db:push`, loaders, switch money consumers from `closedDaysOf` to `unchargedDaysOf` (billing, salary incl. `oldRuleStudents`/`earningsFor`, debtors, students list, student page balance, dashboard, search route, MCP money tools, telegram salary), `earningsFor` adds `makeupSubstitutes(...)` to its substitutes and `taughtBy` covers groups where the user is a make-up teacher that month; curriculum callers pass `extraDays: makeups(g.id)`.
- [ ] **Step 4: Run** `npm test` → PASS; `npm run lint` clean.
- [ ] **Step 5: Commit** `feat(lessons): make-up fields; money uses charged days; make-up teacher pay`

---

### Task 3: Cancel dialog, make-up actions, Telegram

**Files:** Modify `src/app/(app)/actions.ts` (`cancelLesson`, `restoreLesson`; new `moveMakeup`, `cancelMakeup`), `src/components/lesson-grid.tsx` (cancel dialog fields), `src/components/LessonDateMenu.tsx` (make-up column items), `src/lib/telegram-plan.ts`; Test `src/lib/telegram-plan.test.ts`, `src/lib/lesson-changes.test.ts`

**Interfaces:**
- `cancelLesson(_, f)` reads extra fields `makeup` ("1"), `makeupDate`, `makeupTime`, `makeupRoomId`, `makeupTeacherId`, `charged` ("on" = toggle ON = not charged; absent = charged). Checks `makeupProblem` and `clashesOn` (others = active groups meeting that weekday + make-ups that date, minus no-lesson ones, excluding this group).
- `moveMakeup(_, f)` (fields `groupId`, `date` original ISO, make-up fields) and `cancelMakeup(_, f)` (`groupId`, `date`, `charged`) — both refuse when the current make-up date has marks/grades.
- `restoreLesson` refuses when the make-up date has attendance or grades.
- Pure guard `makeupLocked(marks: number, grades: number): string | null` in `lesson-changes.ts` → the copy "Qo'shimcha darsda davomat bor — avval uni o'chiring" when either > 0.
- `telegram-plan.ts`: `makeupTexts(group: string, original: Date, makeup: Date, time: string, room: string | null): { regular: string; cover: string }` and `makeupUndoText(group, makeup)`.

- [ ] **Step 1: Failing tests** — `makeupLocked` (0/0 null; 1/0 and 0/1 message); `makeupTexts` exact copy with and without room.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** actions, dialog (Ha/Yo'q radio; Ha shows date/time/room/teacher; Yo'q shows the toggle; inline errors via the existing ChangeDialog `{ error }` flow), the make-up column menu items, Telegram sends with keys `makeup:<changeId>:<userId>:<isoMakeup>`.
- [ ] **Step 4: Run** `npm test` PASS, lint clean.
- [ ] **Step 5: Commit** `feat(lessons): make-up and charged cancel in the dialog; move/cancel make-up; Telegram`

---

### Task 4: Grid, timetable, dashboard, single-lesson page, access

**Files:** Modify `src/app/(app)/groups/[id]/page.tsx` (extra make-up columns + original "Bekor → dd.mm" header), `src/lib/lists/group-sheet.ts` (export includes make-up columns), `src/app/(app)/schedule/page.tsx` + `src/components/schedule/HorizontalTimetable.tsx` (make-up cards, dashed border, label "Qo'shimcha dars"), `src/app/(app)/page.tsx` (today's make-ups; "O'rinbosar darslaringiz"), `src/app/(app)/actions.ts` (marking actions accept `coverAllowed`), `src/lib/holidays-db.ts` (`assertLessonOpen` allows make-up days); Create `src/app/(app)/lessons/[groupId]/[day]/page.tsx`, `src/lib/cover-db.ts` (`canCover(user, groupId, day)` loading subs/makeups and calling `coverAllowed`); `README.md`.

**Interfaces:** `canCover(user: CurrentUser, groupId: number, day: string): Promise<boolean>`; marking actions: `if (!(await groupAccessible(user, groupId)) && !(await canCover(user, groupId, isoDay))) throw new ForbiddenError()`.

- [ ] **Step 1: Failing test** — `src/lib/lesson-changes.test.ts`: `a make-up day can be marked; the original day can't` using a pure `lessonOpenOn(day, { noLesson, extra, weekdayLesson: boolean }): boolean` (export it) — make-up day true even if not a weekday lesson; original cancelled false; holiday false.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** everything above. **Step 4: Verify** `npm test`, `npm run lint`, `npm run check:colors`; browser (admin 901234567, teacher Aziz 930000000): cancel with make-up next Saturday → grid column + timetable card + Telegram row; cancel without make-up toggle OFF → "Bekor · to'lanadi", student balance unchanged; undo refused after marking the make-up; substitute Aziz for today on another teacher's group → Bosh sahifa block → single-lesson page marks + grade saved; same page for tomorrow / another group → refused. Clean up test data.
- [ ] **Step 5: Commit** `feat(lessons): make-up columns, timetable cards, cover page and access`
