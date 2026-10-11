# Teacher availability — design (curriculum part B)

Date: 2026-10-11 · Status: approved in chat, awaiting written-spec review

## Goal

Admins can see at a glance which teachers are free at a given hour on odd or even days, so they can open a group with
a teacher and room that are actually available. Teachers keep their own weekly free/busy pattern up to date from the
phone. Saving a group that clashes with another group's lesson is refused with a clear reason.

## What the user said

- Grid of 1-hour cells, 08:00–20:00, separately for odd days (Du / Chor / Ju) and even days (Se / Pay / Sha).
- Cells covered by the teacher's groups are filled automatically ("Dars").
- A lesson is 2 hours; kids' courses are 1.5 hours.
- In the hours without a class, the teacher marks themselves free or busy. Admins can view and edit everyone's.
- Opening / editing a group: refuse when the teacher or room is already busy, and explain why. (The teacher's own
  "busy" mark only warns.)
- All non-kids courses become 120-minute lessons (Robototexnika (bolalar) stays 90).
- Out of scope (decided): adding subjects after exams are scored stays locked; finished groups take no exams.

## Assumptions (stated in chat, not contradicted)

- A1. Lessons must fit inside 08:00–20:00; a group whose lesson would end after 20:00 or start before 08:00 is refused.
- A2. Existing clashing groups are left alone; only saves (create / edit) are checked. The timetable already flags clashes.
- A3. The pattern is weekly and the same every week — no per-date exceptions or holidays.

## Data

```prisma
model TeacherSlot {
  id        Int     @id @default(autoincrement())
  userId    Int
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  dayType   String  // "ODD" | "EVEN"
  hour      Int     // 8..19 — the cell hour:00–hour+1:00
  free      Boolean // true = bo'sh, false = band
  @@unique([userId, dayType, hour])
}
```

A missing row means "belgilanmagan" (not set). Lesson cells are never stored — they are derived from the active groups
every time, so they can't go stale when a group moves.

`Course.lessonMin` default becomes 120. A one-off, re-runnable script (`npm run db:lesson-length`) sets `lessonMin = 120`
on every course whose name does not contain "bolalar"; it prints what it changed. (On the demo data: Frontend, Kompyuter
savodxonligi, Backend, TS → 120; Robototexnika (bolalar) stays 90.)

## Logic — `src/lib/availability.ts` (pure, tested)

- `DAY_TYPES = ["ODD", "EVEN"]`, `HOURS = 8..19`.
- `dayTypesOf(days)`: ODD → [ODD], EVEN → [EVEN], DAILY → [ODD, EVEN].
- `lessonCells(time, minutes)`: hours whose cell the lesson touches. 09:00 + 120 → [9, 10]; 14:00 + 90 → [14, 15];
  14:30 + 90 → [14, 15]; 18:30 + 120 → [18, 19, 20] (20 is outside → invalid).
- `fitsDay(time, minutes)`: start ≥ 08:00 and end ≤ 20:00.
- `overlaps(a, b)`: two lessons share a weekday (via `lessonWeekdays`) and their minute ranges overlap.
- `groupClashes(candidate, others)`: for a candidate `{ id?, days, time, minutes, teacherId, assistantId, roomId }`
  against other ACTIVE groups → list of `{ kind: "teacher" | "room", who, group }` (a person counts as busy whether they
  are teacher or assistant in the other group).
- `teacherGrid(userId, groups, slots)`: per day type, per hour → `{ state: "lesson", group } | { state: "free" } |
  { state: "busy" } | { state: "unset" }`; lessons win over marks.
- `busyMarkWarnings(candidate, slotsByTeacher)`: hours of the candidate lesson that the teacher (or assistant) marked busy.

## Screens

### "Mening vaqtim" — `/availability` (teachers)

- In the nav for every user with `isTeacher` (layout adds a pseudo permission `self.teacher` to the nav list), and in
  the phone menu.
- Segmented "Toq kunlar (Du/Chor/Ju)" / "Juft kunlar (Se/Pay/Sha)".
- 12 rows (08:00–09:00 … 19:00–20:00), each a big tap target. Tap cycles: belgilanmagan → bo'sh → band → belgilanmagan.
  Lesson cells show the group name and are not tappable.
- Colours via tokens: lesson = ink, bo'sh = success tint, band = danger tint, unset = dashed outline.
- Summary line: "Bo'sh: 9 soat · Band: 2 · Dars: 6".

### Admin — O'qituvchilar page

- Each teacher card gets "Vaqt jadvali" → `/availability?teacher=<id>`: the same grid, editable by users with
  `groups.manage` (otherwise read-only for `teachers.view`).
- New section "Bo'sh o'qituvchilar": pick day type and hour (defaults: today's day type, next hour). Lists teachers in
  three columns: Bo'sh, Belgilanmagan, Band / dars bor (with the group name for lessons). Also a compact matrix view
  (teachers × hours) for the chosen day type, scrolling sideways on phones.

### Group create / edit

- `createGroup` and `updateGroup` refuse (server-side) when:
  - the lesson doesn't fit 08:00–20:00: "Dars 08:00–20:00 oralig'ida bo'lishi kerak";
  - teacher / assistant / room clashes with another ACTIVE group: e.g.
    "Aziz Karimov Du/Chor/Ju 14:00–16:00 da FE-14 guruhida dars beradi" / "Kompyuter xonasi Du/Chor/Ju 14:00–16:00 da FE-14 guruhi bilan band".
  All problems are listed in one message.
- A clash with the teacher's own "band" marks does not block: the group is saved and the result says
  "Diqqat: Aziz Karimov 14:00–15:00 ni band deb belgilagan". Edit dialog shows it; creation flashes it on the new group page.
- The new-group form moves from `Modal` (closes on submit, can't show errors) to a `useActionState` dialog like
  `EditGroupDialog`.
- Editing: the clash check runs only when days, time, teacher, assistant, room or course (lesson length) change. Other
  edits (name, price, status…) of a group that already clashes today (A2) still save.

## Permissions

- Own slots: any active user with `isTeacher` (no extra permission).
- Others' slots: `groups.manage`. Viewing others: `teachers.view`.
- Every write logged (`teacher.availability`), outside transactions.

## Testing

- `availability.test.ts`: lessonCells (incl. 90-min and half-hour starts), fitsDay, DAILY vs ODD overlap, ODD vs EVEN
  no overlap, teacher-as-assistant clash, room clash, editing a group doesn't clash with itself, grid precedence
  (lesson over marks), busy-mark warnings.
- Browser: teacher login on 375 px marks cells and they persist; admin edits a teacher's grid; free-teacher view;
  creating a clashing group is refused with the message; busy-mark warning shown; light and dark.
- Evidence: balances and salaries identical before/after (lessonMin change must not touch money).

## Files

New: `src/lib/availability.ts` (+ test), `src/app/(app)/availability/page.tsx`, `src/components/AvailabilityGrid.tsx`,
`src/components/NewGroupDialog.tsx`, `prisma/lesson-length.ts`.
Changed: `prisma/schema.prisma`, `src/app/(app)/actions.ts`, `src/app/(app)/teachers/page.tsx`,
`src/app/(app)/groups/page.tsx`, `src/lib/nav.ts`, `src/app/(app)/layout.tsx`, `package.json`, `README.md`.
