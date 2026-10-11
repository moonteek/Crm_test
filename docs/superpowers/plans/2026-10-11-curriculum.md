# Curriculum (part A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Courses get ordered subjects with month counts; every group's subject, level, lessons done, progress and level-exam dates are computed from its start day and schedule; level exams are scheduled automatically with pass/fail flags; groups can be filtered by progress, archived and restored; course-end alerts.

**Architecture:** One pure module `src/lib/curriculum.ts` computes level windows (a level = one month from the group's start day), progress and exam days from `startDate`, `days`, the course's subjects and the group's start point. Screens only render its results. Auto exams are virtual until a score is saved, then stored as `Exam` rows with `level` set.

**Tech Stack:** Next.js 15, Prisma 6 (SQLite, `db push`), node:test via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-11-curriculum-design.md`

## Global Constraints

- Level N window: from `addMonths(start, N−1)` to the day before `addMonths(start, N)`; a start day the month lacks (29–31) clamps to that month's last day. Dates are UTC calendar days.
- Lessons come from `lessonDates(days, y, m)` (Mon–Sat schedules; no holidays).
- Exam day = last lesson day of a window; title `"{Subject} · {n}-daraja imtihoni"`.
- Pass mark per course (`passPercent`, default 60): failed when `score / maxScore × 100 < passPercent`.
- Billing and salaries are untouched: balances and salaries compared before/after the branch.
- Uzbek UI, theme tokens (`npm run check:colors`), no new dependencies, `logAction` for every change.

## Review Focus

1. **Group starting on the 29th–31st** — windows must not skip or double a month (Feb, 30-day months). Pinned by `levelWindows` tests (Task 1).
2. **Course without subjects / group without start point** — everything must degrade to today's behaviour (old Daraja label, no progress bar), never crash. Pinned by tests + browser check (Tasks 1, 3).
3. **Subjects edited after groups started** (months changed, subject removed) — progress recomputes; a subject with existing auto exams saved can't be deleted. Pinned by Task 2 validation.
4. **Score entered for an auto exam twice / by two teachers** — one Exam row per (group, level), never duplicates. Pinned by unique constraint + upsert (Task 4).
5. **Archive/restore** — restoring never re-adds students or charges. Pinned by Task 5 check.

---

### Task 1: Data and the curriculum engine

**Files:** Modify `prisma/schema.prisma`. Create `src/lib/curriculum.ts`, `src/lib/curriculum.test.ts`.

**Interfaces:**
- Models: `Subject { id, courseId → Course (cascade), name String, months Int, position Int, createdAt }`; `Course.passPercent Int @default(60)`, `Course.subjects Subject[]`; `Group.startSubjectId Int?` (→ Subject, SetNull), `Group.startLevel Int @default(1)`; `Exam.level Int?` with `@@unique([groupId, level])`.
- `type CurriculumGroup = { startDate: Date; days: string; startSubjectId: number | null; startLevel: number }`, `type CurriculumSubject = { id: number; name: string; months: number; position: number }`.
- `levelWindows(group, subjects): Window[]` where `Window = { level: number /* 1-based course month from the group's start */; subjectId; subject: string; levelInSubject: number; subjectLevels: number; from: Date; to: Date; lessons: Date[] }` — empty when no subjects; starts at the group's start point (subject + level).
- `progressOn(group, subjects, day): { state: "none" | "not-started" | "in-progress" | "finishing" | "finished"; window: Window | null; doneInWindow: number; lessonsInWindow: number; done: number; total: number; percent: number }` — "finishing" = in the last window.
- `levelExams(group, subjects): { level; subject; levelInSubject; date: Date; title: string }[]`.
- `passed(score, maxScore, passPercent): boolean`; `addMonthsClamped(date, n): Date`.

- [ ] **Step 1: Failing tests:** start 20 Oct EVEN, subjects HTML 1 / CSS 2 → 3 windows 20.10–19.11, 20.11–19.12, 20.12–19.01, subject/levelInSubject right, lessons = EVEN days inside; start on 31 Jan 2027 (window N starts at `addMonthsClamped(originalStart, N−1)`: 31.01, 28.02, 31.03) → windows 31.01–27.02, 28.02–30.03, 31.03–29.04; starting part-way (CSS level 2) → first window is CSS 2/2; progress before start "not-started", mid-window counts lessons ≤ day, last window "finishing", after end "finished" with 100%; no subjects → state "none"; exam days = last lesson of each window; `passed(59,100,60)` false, `passed(60,100,60)` true.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement → PASS.
- [ ] **Step 4:** schema, `db push`, generate (stop dev server first). Commit `feat(curriculum): subjects and level engine`.

### Task 2: Courses — subject editor and pass mark

**Files:** Modify `src/app/(app)/courses/page.tsx`, `src/app/(app)/actions.ts`. Create `src/components/SubjectEditor.tsx` (client).

**Interfaces:** actions `addSubject(courseId, f)`, `updateSubject(id, f)`, `moveSubject(id, dir: -1 | 1)`, `deleteSubject(id)` (refused when any group starts from it or a saved auto exam exists for its months — message names the group), `updateCourse` saves `passPercent`; `Course.durationMon` is set to the subjects' month total whenever subjects change. All `courses.manage`, logged.

- [ ] **Step 1:** Course cards list subjects as chips with months ("HTML · 1 oy"); "Fanlar" dialog edits them (name, months 1–24, ↑/↓, delete).
- [ ] **Step 2:** Browser: add Web Development-style subjects to a seed course; reorder; delete refused when used. Commit `feat(courses): subjects and pass mark`.

### Task 3: Group start point, progress bar, badges

**Files:** Modify `src/components/GroupFields.tsx`, `src/app/(app)/actions.ts` (group schema: `startSubjectId`, `startLevel`), `src/components/ui.tsx` (`LevelBadge` → also accepts a subject), group list/page, schedule page. Create `src/components/CurriculumBar.tsx`.

**Interfaces:** `CurriculumBar({ windows, progress, mode: "card" | "mini" })` — segmented per subject, current window highlighted, labels like EduTrack (`"JavaScript · 2/3-daraja · 8/13 dars"`, `"46%"`); next exam date shown on the group page.

- [ ] **Step 1:** Form: "Qaysi fandan boshlaydi" (subject select of the chosen course + level 1..months) shown when the course has subjects.
- [ ] **Step 2:** Groups list card and group page show the bar; badge shows the current subject (falls back to old `level`); "Kurs tugadi" badge when finished; timetable card shows current subject and an "Imtihon" marker on exam days.
- [ ] **Step 3:** Browser 1280/375 light/dark; groups whose course has no subjects look as before. Commit `feat(groups): progress through subjects`.

### Task 4: Level exams and fail flags

**Files:** Modify `src/app/(app)/groups/[id]/page.tsx` (Imtihonlar tab), `src/app/(app)/actions.ts`, `src/app/(app)/students/[id]/page.tsx`.

**Interfaces:** action `saveLevelExamScores(groupId, level, f)` — upserts `Exam { groupId, level }` (title/date from `levelExams`, maxScore from form, default 100) and results; manual exams unchanged. Failed = `!passed(...)`.

- [ ] **Step 1:** Imtihonlar tab: one table with auto exams (upcoming greyed with date, past ones editable) and manual exams; failed scores red with "yiqildi"; group header shows the next exam.
- [ ] **Step 2:** Student profile: failed level exams listed under the groups section.
- [ ] **Step 3:** Browser: enter scores for an auto exam twice (second edit updates, no duplicate row); fail flag shown. Commit `feat(exams): automatic level exams with pass marks`.

### Task 5: Filters, archive, alerts

**Files:** Modify `src/app/(app)/groups/page.tsx`, `src/app/(app)/actions.ts` (`restoreGroup(id)`), `src/components/Sidebar.tsx`, `src/components/nav/PhoneNav.tsx`, `src/app/(app)/layout.tsx`, dashboard page. Create `src/lib/alerts.ts` (+ test), `src/components/AlertsBell.tsx`.

**Interfaces:** `courseEndAlerts(groups with subjects, today): { groupId; name; endsOn: Date; state: "ending" | "ended" }[]` — active groups whose last window ends this month or next, or that are finished but still active. Bell shows the count, a dropdown list linking to groups, dismiss per group+state (localStorage).

- [ ] **Step 1: Failing test** for `courseEndAlerts` (ends next month → ending; ended but ACTIVE → ended; FINISHED groups excluded; groups without subjects excluded). RED → implement → GREEN.
- [ ] **Step 2:** Groups list: filters (course, current subject, progress state) via query params + Segmented "Faol / Arxiv"; archive cards get "Qayta tiklash" (status ACTIVE only; students untouched; logged).
- [ ] **Step 3:** Bell in sidebar header and phone top bar (only for `groups.view`); dashboard card "Kursi tugayotgan guruhlar".
- [ ] **Step 4:** Evidence: balances and salaries identical to master; browser checks. Commit `feat(groups): progress filters, archive and course-end alerts`.
