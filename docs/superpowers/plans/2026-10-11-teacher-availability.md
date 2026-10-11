# Teacher Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teachers mark weekly free/busy hours (08–20, odd/even days) around their auto-filled lessons; admins see who is free; saving a group that clashes with another group's lesson is refused.

**Architecture:** One stored table (`TeacherSlot`) for marks only; lessons are always derived from ACTIVE groups. A pure module `src/lib/availability.ts` does all time maths and clash finding; server actions and pages call it. Group save rule lives in `createGroup`/`updateGroup`.

**Tech Stack:** Next.js 15 App Router + server actions, React 19 `useActionState`, Prisma 6 / SQLite (`db push`), Tailwind v4 tokens, node:test via `npm test`.

**Spec:** `docs/superpowers/specs/2026-10-11-teacher-availability-design.md`

## Global Constraints

- Day 08:00–20:00; cells are hours 8..19 (`hour:00–hour+1:00`); day types `"ODD"` (Du/Chor/Ju) and `"EVEN"` (Se/Pay/Sha); `DAILY` groups count for both.
- Lesson length = `course.lessonMin`; default 120; courses whose name contains "bolalar" stay 90.
- Clash with another ACTIVE group's lesson (teacher, assistant either role, or room) → refuse; teacher's own "band" mark → warn only.
- Edit check runs only when days, time, teacherId, assistantId, roomId or courseId changes.
- Never `logAction` inside `db.$transaction`; log action key `teacher.availability`.
- Colours only via theme tokens (`npm run check:colors`). Forms: hidden inputs, never the submit button's name/value.
- Uzbek copy exactly as in the spec ("Dars 08:00–20:00 oralig'ida bo'lishi kerak", "… da FE-14 guruhida dars beradi", "… guruhi bilan band", "Diqqat: … ni band deb belgilagan").

## Review Focus

- A `DAILY` group against an `ODD` group at the same time must clash; `ODD` vs `EVEN` must not → tests in Task 1.
- Half-hour start (14:30 + 90 → cells 14, 15) and a lesson ending exactly 20:00 (18:00 + 120) is allowed, 18:30 + 120 is refused → Task 1.
- Editing a group must not clash with itself; a renamed group that already clashes still saves → Task 2 test of `needsClashCheck` + browser check.
- A teacher who is the assistant in the other group is still busy → Task 1.
- Group with no teacher and no room never clashes → Task 1.

---

### Task 1: Data, lesson length and availability engine

**Files:**
- Modify: `prisma/schema.prisma` (add `TeacherSlot`, `User.slots TeacherSlot[]`, `Course.lessonMin @default(120)`)
- Create: `prisma/lesson-length.ts`; Modify: `package.json` (`"db:lesson-length": "tsx prisma/lesson-length.ts"`)
- Create: `src/lib/availability.ts`, Test: `src/lib/availability.test.ts`

**Interfaces — Produces:**
- `type DayType = "ODD" | "EVEN"`; `DAY_TYPES: DayType[]`; `HOURS: number[]` (8..19); `DAY_TYPE_LABEL: Record<DayType,string>` ("Toq kunlar (Du/Chor/Ju)", "Juft kunlar (Se/Pay/Sha)").
- `dayTypesOf(days: string): DayType[]`
- `lessonCells(time: string, minutes: number): number[]`
- `fitsDay(time: string, minutes: number): boolean`
- `type LessonLike = { id?: number; name: string; days: string; time: string; minutes: number; teacherId: number | null; assistantId: number | null; roomId: number | null }`
- `type Clash = { kind: "teacher" | "room"; who: string; group: LessonLike }` and `groupClashes(candidate: LessonLike, others: LessonLike[], names: { users: Map<number,string>; rooms: Map<number,string> }): Clash[]` (skips `others` with the candidate's id)
- `clashMessage(c: Clash): string` — "Aziz Karimov Du/Chor/Ju 14:00–16:00 da FE-14 guruhida dars beradi" / "Kompyuter xonasi Du/Chor/Ju 14:00–16:00 da FE-14 guruhi bilan band" (days label from `GROUP_DAYS`, range from `fromMinutes`).
- `type Cell = { state: "lesson"; group: string } | { state: "free" } | { state: "busy" } | { state: "unset" }`; `teacherGrid(userId: number, lessons: LessonLike[], slots: { dayType: string; hour: number; free: boolean }[]): Record<DayType, Map<number, Cell>>`
- `busyMarkWarnings(candidate: LessonLike, slots: { userId: number; dayType: string; hour: number; free: boolean }[]): { userId: number; hours: number[] }[]`

- [ ] **Step 1: Failing tests** in `availability.test.ts`:
  - `lessonCells("09:00",120)` → `[9,10]`; `("14:00",90)` → `[14,15]`; `("14:30",90)` → `[14,15]`; `("18:30",120)` → `[18,19,20]`.
  - `fitsDay("18:00",120)` true; `("18:30",120)` false; `("07:30",90)` false.
  - `dayTypesOf("DAILY")` → `["ODD","EVEN"]`.
  - clash: ODD 14:00/120 teacher 1 vs ODD 15:00/90 teacher 1 → one teacher clash; vs EVEN same time → none; DAILY vs ODD → clash; candidate teacher 1 vs other where 1 is assistant → clash; same room → room clash with `clashMessage` exactly `"Kompyuter xonasi Du / Chor / Ju 14:00–16:00 da FE-14 guruhi bilan band"` (label as in `GROUP_DAYS`); candidate with same id as other → none; null teacher/room → none; back-to-back (14:00–16:00 then 16:00) → none.
  - `teacherGrid`: lesson at 14:00/120 on ODD plus slot ODD 14 free → hour 14 is `lesson`, ODD 8 slot busy → `busy`, unmarked → `unset`; DAILY lesson fills both day types.
  - `busyMarkWarnings`: teacher marked ODD 15 busy, candidate ODD 14:00/120 → `[{ userId, hours: [15] }]`; marked free → `[]`.
- [ ] **Step 2:** `npm test` → FAIL (module missing).
- [ ] **Step 3:** Implement `availability.ts` (pure; use `lessonWeekdays`, `toMinutes`, `fromMinutes`, `GROUP_DAYS`). Overlap = shared weekday and `a.start < b.end && b.start < a.end`.
- [ ] **Step 4:** `npm test` → all pass.
- [ ] **Step 5:** Schema: add `TeacherSlot` per spec (`@@unique([userId, dayType, hour])`, cascade on user), default `lessonMin` 120. Stop the dev server, `npm run db:push`, restart.
- [ ] **Step 6:** `prisma/lesson-length.ts`: sets `lessonMin = 120` where name does not contain "bolalar" (case-insensitive) and value ≠ 120; prints `name: old → 120` per change and "o'zgarish yo'q" when none. Run it twice: first prints 4 changes on demo data, second prints none.
- [ ] **Step 7:** Commit `feat(availability): slots table and time engine`.

### Task 2: Group save rule

**Files:**
- Modify: `src/app/(app)/actions.ts` (`createGroup`, `updateGroup`, new `saveNewGroup`)
- Create: `src/components/NewGroupDialog.tsx`; Modify: `src/app/(app)/groups/page.tsx` (use it instead of `Modal`)
- Modify: `src/app/(app)/groups/[id]/page.tsx` (show `?warn=` notice)
- Test: `src/lib/availability.test.ts` (`needsClashCheck`)

**Interfaces — Consumes:** Task 1 `groupClashes`, `clashMessage`, `fitsDay`, `busyMarkWarnings`.
**Produces:** `needsClashCheck(before: {days,time,teacherId,assistantId,roomId,courseId}, after: same): boolean` in `availability.ts`; `checkGroupTime(candidate: LessonLike): Promise<{ warnings: string[] }>` (server helper in `actions.ts`, throws one message listing every problem); `saveNewGroup(_: MemberActionState, f: FormData): Promise<MemberActionState & { id?: number }>`.

- [ ] **Step 1: Failing test** `needsClashCheck`: name-only change → false; time change → true; courseId change → true.
- [ ] **Step 2:** Implement; `npm test` green.
- [ ] **Step 3:** `checkGroupTime`: loads other ACTIVE groups (with course lessonMin), user and room names, slots of the candidate's teacher/assistant; throws `"Dars 08:00–20:00 oralig'ida bo'lishi kerak"` if `!fitsDay`; throws all `clashMessage`s joined by `"; "`; returns warnings `"Diqqat: <name> <h>:00–<h+1>:00 ni band deb belgilagan"` (consecutive hours merged into one range).
- [ ] **Step 4:** `createGroup` calls it before create; `updateGroup` calls it only when `needsClashCheck`. Warnings: `createGroup` redirects to `/groups/<id>?warn=<encoded>`; `saveGroup` returns `{ ok: true, warning }` (extend `MemberActionState` with optional `warning`) and `EditGroupDialog` shows it in the dialog instead of closing when present.
- [ ] **Step 5:** `NewGroupDialog` (pattern of `EditGroupDialog`) with `saveNewGroup` (wraps `createGroup` logic, returns `{ error }` on refusal; redirect on success).
- [ ] **Step 6:** Browser: creating a group with FE-14's teacher, days and 14:00 is refused with the teacher + room message; changing only the name of a group still saves; a busy mark produces the warning. Commit `feat(groups): refuse teacher and room clashes`.

### Task 3: "Mening vaqtim" grid

**Files:**
- Create: `src/app/(app)/availability/page.tsx`, `src/components/AvailabilityGrid.tsx`
- Modify: `src/app/(app)/actions.ts` (`setSlot`), `src/lib/nav.ts`, `src/app/(app)/layout.tsx`

**Interfaces — Consumes:** `teacherGrid`, `DAY_TYPES`, `HOURS`, `DAY_TYPE_LABEL`.
**Produces:** `setSlot(userId: number, dayType: DayType, hour: number, state: "free" | "busy" | "unset")` — own slots if `isTeacher`, others need `groups.manage`; refuses lesson cells ("Bu soatda dars bor") and hours outside 8..19; `unset` deletes the row; logs `teacher.availability`.

- [ ] **Step 1:** Nav item `{ href: "/availability", label: "Mening vaqtim", icon: Clock, perm: "self.teacher" }`; layout passes `[...permissions, ...(user.isTeacher ? ["self.teacher"] : [])]` to `Sidebar`.
- [ ] **Step 2:** Page: `?teacher=<id>` (others: `teachers.view` to see, `groups.manage` to edit; default = current user; non-teacher without param → `/no-access`); `?d=ODD|EVEN` Segmented (default today's day type, Sunday → ODD); summary "Bo'sh: N soat · Band: N · Dars: N".
- [ ] **Step 3:** `AvailabilityGrid` (client): 12 rows, tap cycles unset → free → busy → unset via `setSlot` (optimistic, revert + error text on refusal); lesson rows show group name, not buttons; tokens: lesson `bg-ink text-page`, free `bg-success-tint text-success`, busy `bg-danger-tint text-danger`, unset dashed `border-line-strong`.
- [ ] **Step 4:** Browser at 375 px as a teacher (seed teacher login) and as admin; marks persist after reload; light + dark. Commit `feat(availability): teachers mark free and busy hours`.

### Task 4: Admin free-teacher view, evidence, docs

**Files:**
- Modify: `src/app/(app)/teachers/page.tsx`, `README.md`

**Interfaces — Consumes:** `teacherGrid`, `HOURS`, `DAY_TYPES`.

- [ ] **Step 1:** Teacher cards: "Vaqt jadvali" link → `/availability?teacher=<id>`.
- [ ] **Step 2:** Section "Bo'sh o'qituvchilar": GET form `d` (day type) and `h` (hour; default today's type and next hour, clamped to 8..19); three lists Bo'sh / Belgilanmagan / Band yoki dars (lesson shows group name); below, matrix teachers × hours for `d` (cell colours as the grid, horizontal scroll on phones).
- [ ] **Step 3:** README: `npm run db:push` then `npm run db:lesson-length` on update; how availability works (2–3 lines).
- [ ] **Step 4:** Evidence: balances vs master `billing.ts` (69, 0 differing, 28 debtors) and salaries 2026-05..10 vs master (0 differing) — lessonMin change must not touch money. `npm run lint`, `npm test`, `npm run check:colors`. Commit `feat(teachers): free-teacher view`.
