# Course Sections and Lesson-Based Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Courses → sections → level lines with per-level lesson counts; a group studies one section; levels end after N held lessons with the exam on the last one; course pictures; automatic conversion of existing month-based subjects.

**Architecture:** `src/lib/curriculum.ts` stays the single pure engine but counts lessons instead of months; its callers pass the group's **section** lines instead of the course's subjects. A pure planner (`src/lib/curriculum-convert.ts`) drives the one-off conversion script and a pure guard (`structureProblem`) drives the editing rules. UI: a section editor replaces the subject editor; the group form gains a section select.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma 6 / SQLite (`db push`), zod 4, node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-10-21-course-sections-design.md`

## Global Constraints

- Level line: name ≤ 60, `levels` 1–24, `lessons` 1–60 (default 13). Section: name ≤ 60, unique per course, optional `price` (so'm, ≥ 0).
- Numbering: a line with `levels > 1` → labels `"<name> 1" … "<name> N"`; `levels = 1` → `"<name>"`. Exam title `"<label> imtihoni"`.
- Lessons that count: the group's weekdays from its start day (centre calendar), minus the group's closed days (`closedDaysOf()` — holidays + its cancelled lessons).
- "Kurs tugadi" → **"Bo'lim tugadi"** everywhere. Single-section courses never show the section name.
- Pictures: PNG/JPG, ≤ 300 KB, checked with `imageProblem(url, "Rasm")` from `src/lib/image.ts`; card fallback = course colour (`COURSE_TONE[courseColor(c)]`) + first letter.
- Editing rules (refused when any group of the section — running or finished — has a scored level exam, i.e. an `Exam` with `level != null` and ≥ 1 result): reorder/remove lines, change `levels`, insert before existing lines, move a line between sections, remove the section. Always allowed: rename, section price, `lessons`, append a line/section at the end.
- Schema ruling (deviation from spec, recorded here): the `Subject.months` column is **kept** (unused, comment "legacy — read only by db:curriculum-v2") so one `db:push` without data loss is enough; the spec's "dropped" is deferred.
- New/changed server actions return `ActionState` via `tryAction`, check `courses.manage` / `groups.manage` first; forms use `ActionForm`; colours only via tokens.
- Stop the dev server before `npm run db:push` (Windows DLL lock).

## Review Focus

1. A group whose start point line was deleted or has fewer levels now — must fall back to the section's first level (as `startPoint` does today), never crash. (Task 1 test.)
2. A group with **no section** (created before the conversion ran) — curriculum shows "none" state and the old level label, no crash. (Task 4 caller check + Task 1 empty-lines test.)
3. Many cancelled lessons in a row / a start day that is itself a holiday — the level still collects exactly N held lessons. (Task 1 test.)
4. Running the conversion twice — no duplicate sections, levels unchanged. (Task 2 test.)
5. Changing `lessons` on a section with scored exams — allowed, and scored exams keep their stored dates while unscored ones move. (Task 1 `examColumns` test + Task 3 rule test.)

---

### Task 1: Lesson-based curriculum engine

**Files:**
- Modify: `src/lib/curriculum.ts`, `src/lib/curriculum.test.ts`, `src/lib/group-exams.ts`, `src/lib/alerts.ts` (types only)

**Interfaces:**
- Produces:
  - `type CurriculumSubject = { id: number; name: string; levels: number; lessons: number; position: number }` (a level line of the group's section)
  - `CurriculumGroup` unchanged (`startDate, days, startSubjectId, startLevel, holidays`)
  - `type Window = { level: number; subjectId: number; subject: string; label: string; levelInSubject: number; subjectLevels: number; from: Date; to: Date; lessons: Date[] }` — `subject` = line name, `label` = numbered label, `level` = number within the section (counted from the section's first level), `from`/`to` = first/last lesson.
  - `levelLabel(name: string, levelInSubject: number, levels: number): string`
  - `levelWindows`, `progressOn`, `levelExams` (title `"<label> imtihoni"`), `curriculumOn`, `passed` — same names/signatures as today.
  - `sectionLevels(lines: CurriculumSubject[]): number` (total levels), `sectionLessons(lines): number` (total lessons).

- [ ] **Step 1: Rewrite the tests** in `src/lib/curriculum.test.ts` (replace the month-based ones; keep the Tashkent-midnight and pass-mark tests). Fixture: odd days `"ODD"` (Mon/Wed/Fri — use the same `days` key the existing tests use), start Mon 2026-09-07, no holidays.
  - `levels count held lessons: 13 lessons per level by default` — lines `[HTML ×1 of 13, CSS ×1 of 13]` → 2 windows; window 1 has 13 lessons starting 2026-09-07, ends on the 13th lesson; window 2 starts on the next lesson day.
  - `mixed lengths: an 8-lesson level then a 13-lesson one` — window 1 has 8 lessons, window 2 has 13.
  - `numbered labels for multi-level lines` — `Node.js ×3` → labels `Node.js 1`, `Node.js 2`, `Node.js 3`; `HTML ×1` → `HTML`; `levelExams` titles `"Node.js 2 imtihoni"`, `"HTML imtihoni"`.
  - `a holiday and a cancelled lesson move the exam and every later level` — same group with `holidays: ["2026-09-09", "2026-09-14"]` → every window's `to` is 2 lesson days later than without them; neither date is in any `lessons`.
  - `a start day that is a holiday and a long run of cancellations still give N lessons` — start day in `holidays` plus 6 consecutive lesson days cancelled → window 1 still has exactly 13 lessons, none of them closed.
  - `a group can start part-way: line and level` — lines `[HTML ×1, CSS ×1, JS ×3]`, `startSubjectId = JS.id, startLevel = 2` → first window label `JS 2`, `level = 4`.
  - `a start point that no longer exists falls back to the first level` — `startSubjectId` not in lines → first window `level = 1`; `startLevel = 9` on a 3-level line → capped at its last level.
  - `progress before, during, in the last level and after the section` — states `not-started / in-progress / finishing / finished`, `done/total` counts, `percent`.
  - `a section without lines has no curriculum` — `[]` windows, state `"none"`.
  - `totals` — `sectionLevels` / `sectionLessons` of `[HTML ×1 of 13, Node.js ×3 of 8]` = 4 / 37.
- [ ] **Step 2: Run** — `npx tsx --test src/lib/curriculum.test.ts` → FAIL (old month engine / missing exports).
- [ ] **Step 3: Implement** in `src/lib/curriculum.ts`: expand lines (sorted by `position`) into steps `{ line, levelInSubject, lessons }`; find the first step from the start point (capped like today); list lesson days forward from `centreDate(startDate)` month by month with `heldLessons(days, y, m, holidays)` (filter `>= start`), stopping when the remaining steps are filled (hard stop after 120 months); slice consecutive chunks. Update the header comment to describe lesson counts.
- [ ] **Step 4: Update** `src/lib/group-exams.ts` / `src/lib/alerts.ts` for the new `CurriculumSubject` type (no behaviour change: `examColumns` still keeps a saved scored exam's own `date`? — today it uses the computed date for every auto column; change it so a saved exam **with results** uses its stored `date`, unscored follow the computed one) and add test `scored exams keep their date; unscored ones follow the lessons` in `src/lib/curriculum.test.ts` (import `examColumns`).
- [ ] **Step 5: Run** — `npx tsx --test src/lib/curriculum.test.ts` → PASS. (`npm run lint` will fail in callers until Task 4 — expected; record in the ledger.)
- [ ] **Step 6: Commit** — `git commit -m "feat(curriculum): levels count held lessons; numbered level labels"`

---

### Task 2: Schema, conversion and editing guard

**Files:**
- Modify: `prisma/schema.prisma`, `package.json` (script `db:curriculum-v2`)
- Create: `src/lib/curriculum-convert.ts`, `src/lib/curriculum-convert.test.ts`, `prisma/curriculum-v2.ts`

**Interfaces:**
- Produces:
  - Prisma: `Course.image String?`; `model Section { id Int @id @default(autoincrement()); courseId Int; course Course @relation(onDelete: Cascade); name String; position Int; price Int?; createdAt DateTime @default(now()); subjects Subject[]; groups Group[]; @@unique([courseId, name]) }`; `Subject`: `+ sectionId Int?` → `Section? (onDelete: Cascade)`, `+ levels Int @default(1)`, `+ lessons Int @default(13)`, `months` kept with the legacy comment; `Group`: `+ sectionId Int?` → `Section? (onDelete: SetNull)`.
  - `planConversion(data: { courses: { id: number; name: string; sections: { id: number }[] }[]; subjects: { id: number; courseId: number; sectionId: number | null; months: number; levels: number }[]; groups: { id: number; courseId: number; sectionId: number | null }[] }): { newSections: { courseId: number; name: string }[]; subjects: { id: number; courseId: number; levels: number }[]; groups: { id: number; courseId: number }[] }` — sections to create (courses with none), subjects without a section (to link to their course's first section, `levels = months`), groups without a section.
  - `type LineShape = { id: number; position: number; levels: number }`; `structureProblem(before: LineShape[], after: LineShape[], scored: boolean): string | null` — null when allowed; when `scored`, refuses any change except appending new ids after the last existing position (message `"Bu bo'limda daraja imtihoni baholangan — darajalar tartibi va sonini o'zgartirib bo'lmaydi (nomini va dars sonini o'zgartirish mumkin)"`).

- [ ] **Step 1: Write the failing tests** `src/lib/curriculum-convert.test.ts`:
  - `conversion: one section per course, months become levels, groups linked` — two courses without sections, subjects 3 and 1 months, two groups → 2 new sections named after the courses, subjects `levels` 3 and 1, both groups listed.
  - `conversion is idempotent` — data where every course has a section and every subject/group has `sectionId` → all three lists empty.
  - `structure guard: free sections change freely` — reorder with `scored=false` → null.
  - `structure guard with a scored exam` — reorder → message; remove a line → message; `levels` change → message; insert a new line before existing (`position` lower than an existing one) → message; append at the end → null; same shape (only names/lessons changed, not part of LineShape) → null.
- [ ] **Step 2: Run** — `npx tsx --test src/lib/curriculum-convert.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `src/lib/curriculum-convert.ts`; schema changes; stop dev server; `npm run db:push`; `prisma/curriculum-v2.ts` (loads data, `planConversion`, applies in one `db.$transaction`: create sections, then link subjects (`sectionId` = that course's lowest-position section, `levels`), groups; prints `Kurslar: N bo'lim yaratildi · M daraja qatori · K guruh`); `package.json` script `"db:curriculum-v2": "tsx prisma/curriculum-v2.ts"`.
- [ ] **Step 4: Run** — tests PASS; `npm run db:curriculum-v2` on the demo DB prints the summary; second run prints zeros.
- [ ] **Step 5: Commit** — `git commit -m "feat(curriculum): sections table, conversion script and editing guard"`

---

### Task 3: Courses — section editor, picture, cards

**Files:**
- Modify: `src/app/(app)/actions.ts` (replace `saveSubject` / `syncDuration` / `assertStructureFree`; course create/update gain `image`), `src/app/(app)/courses/page.tsx`, `src/lib/lists/courses.ts`
- Create: `src/components/SectionEditor.tsx` (replaces `src/components/SubjectEditor.tsx`, which is deleted), `src/components/CoursePicture.tsx`

**Interfaces:**
- Consumes: `structureProblem` (Task 2), `sectionLevels`/`sectionLessons`/`levelLabel` (Task 1), `imageProblem`.
- Produces:
  - `saveSection(_: ActionState, f: FormData): Promise<ActionState>` — `op` ∈ `add | update | up | down | delete`; fields `courseId` (add), `id`, `name`, `price` (optional).
  - `saveLine(_: ActionState, f: FormData): Promise<ActionState>` — `op` ∈ `add | update | up | down | delete`; fields `sectionId` (add), `id`, `name`, `levels`, `lessons`. Builds `before`/`after` `LineShape[]` and calls `structureProblem(before, after, scored)` where `scored` = a group of that section has a level exam with results. `delete` also refused while a group starts at that line (existing message). After `levels`/`lessons` change: `revalidatePath("/groups")`.
  - Section `delete` refused when it has groups (`"Bu bo'limda guruhlar bor"`), when it's the course's only section (`"Kursda kamida bitta bo'lim bo'lishi kerak"`), or when `scored`.
  - Course create also creates its first section (named after the course) in the same transaction.
  - Course form field `image` (data URL / `"remove"` / `""` keep), validated by `imageProblem`.

- [ ] **Step 1: Write the failing test** — append to `src/lib/curriculum-convert.test.ts`: `structure guard: moving a line to another section counts as removing it here` — `after` without the line, `scored=true` → message. (Pins the "move between sections" rule the action relies on.)
- [ ] **Step 2: Run** → FAIL only if the guard doesn't treat a missing id as removal; if it already passes, note "covered by Task 2 implementation" in the ledger and continue (the test still pins it).
- [ ] **Step 3: Implement** the actions, `SectionEditor` (per section: name, price, ↑↓, delete; its lines table: name, levels, lessons, ↑↓, delete; "+ daraja qo'shish"; "+ bo'lim qo'shish"; totals `"65 dars ≈ 5 oy"` using `Math.round(lessons / 13)`; every control posts through `ActionForm`/`ActionButton`), `CoursePicture` (upload/preview/remove like `TeacherForm`'s photo), the course form field, the cards (picture or colour + letter; per section `"Frontend · 5 daraja · 65 dars"`, section price when it differs), and the export columns (`Bo'limlar` = `"Frontend: HTML, CSS, JS, TS, React (65 dars)"`).
- [ ] **Step 4: Verify** — `npx tsx --test src/lib/curriculum-convert.test.ts` PASS; `npm run check:colors`; browser: add a second section to a course, add `Node.js ×3 of 13`, reorder lines in a section without scored exams, try to reorder in one with a scored exam (inline refusal), upload and remove a picture.
- [ ] **Step 5: Commit** — `git commit -m "feat(courses): section editor, course pictures and cards"`

---

### Task 4: Groups use their section everywhere

**Files:**
- Modify: `src/components/CourseStartFields.tsx`, `src/components/GroupFields.tsx`, `src/components/CurriculumBar.tsx`, `src/app/(app)/actions.ts` (`groupSchema`, `startPoint`, `createGroup`/`saveNewGroup`/`saveGroup`), `src/app/(app)/groups/[id]/page.tsx`, `src/lib/lists/groups.ts`, `src/lib/lists/group-sheet.ts`, `src/app/(app)/schedule/page.tsx`, `src/lib/alerts-db.ts`, `src/lib/lists/risk.ts` (level-exam pass mark unchanged; nothing else), `README.md`
- Test: `src/lib/curriculum.test.ts`

**Interfaces:**
- Consumes: Task 1 engine, Task 2 schema.
- Produces:
  - `CourseOption = { id: number; name: string; price: number; sections: { id: number; name: string; price: number | null; subjects: { id: number; name: string; levels: number }[] }[] }`; `CourseStartFields` posts `sectionId`, `startSubjectId`, `startLevel`; shows the Bo'lim select only when the course has > 1 section; the start select lists `levelLabel(...)` options of that section; on course/section change it sets the price input (`name="price"`) to `section.price ?? course.price` when the user hasn't typed a price.
  - `groupSchema` + `sectionId: v.optId()`; save refuses a section of another course (`"Bo'lim bu kursga tegishli emas"`) and, for an existing group, a section change while it has a scored level exam (`"Guruhda daraja imtihoni baholangan — bo'limni o'zgartirib bo'lmaydi"`). `startPoint(sectionId, startSubjectId, startLevel)` looks up lines of that section and caps at `levels`.
  - Every caller passes `group.section?.subjects ?? []` (ordered by `position`) instead of `group.course.subjects`.
  - Labels: `CurriculumBar` text `"[Section · ]<label> · <level>/<total>-daraja · <done>/<lessons> dars"`; badge `"Bo'lim tugadi"`; groups list label likewise.

- [ ] **Step 1: Write the failing test** — in `src/lib/curriculum.test.ts`: `section progress label` for a helper `progressLabel(sectionName: string | null, p: Progress, total: number): string` exported from `src/lib/curriculum.ts` → `"Frontend · JS · 3/5-daraja · 7/13 dars"`; with `sectionName = null` → `"JS · 3/5-daraja · 7/13 dars"`; finished → `"Bo'lim tugadi"`.
- [ ] **Step 2: Run** → FAIL (no `progressLabel`).
- [ ] **Step 3: Implement** `progressLabel`, then the callers, form, actions and labels above; README section "Kurslar, bo'limlar va darajalar" with the production steps (`npm run db:push`, `npm run db:curriculum-v2`).
- [ ] **Step 4: Verify** — `npm test` all PASS; `npm run lint` clean; `npm run check:colors`. Browser (admin 901234567): new group in a two-section course picks Bo'lim and gets the section price; group page shows the new label and exam titles; cancel a lesson (lesson menu) in the current level → the next exam date moves one lesson later, then restore it; a group without section (set one to null in the DB, then back) shows no crash; schedule cards and groups list show labels; alerts bell says "Bo'lim tugadi". Clean up test data.
- [ ] **Step 5: Commit** — `git commit -m "feat(groups): groups study one section; labels and exams follow lesson-based levels"`
