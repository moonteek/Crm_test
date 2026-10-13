# Lesson Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Absence reasons, cancelling one group's lesson (like a holiday for it), and per-lesson substitute teachers paid by their own rule.

**Architecture:** `LessonChange` rows per group/day; pure helpers merge cancelled days into the existing `holidays` closed-day list and decide who taught each lesson; actions and a date menu in the grid.

**Tech Stack:** Next.js 15, Prisma 6 / SQLite, node:test.

**Spec:** `docs/superpowers/specs/2026-10-12-lesson-tools-design.md`

## Global Constraints

- Money moves only from November 2026; cancelled = closed day for that group (holiday rule); substitute takes that lesson's pay by their own PERCENT / PER_STUDENT rule; FIXED unaffected.
- Changes only on the group's lesson days, this month onward, not holidays; cancel and substitute exclusive; undo allowed this month onward.
- Permission `lessons.manage` "Darslarni boshqarish" (Menejer default). Reasons settable with `attendance.mark`.
- With no changes, balances and salaries equal master. `logAction` outside transactions; tokens only.

## Review Focus

- A cancelled lesson must leave every balance path (lists, exports, MCP, previews) — same closed-day plumbing as holidays → Task 2 uses `withHolidays` callers via one loader `closedDaysByGroup()`.
- A substitute who isn't otherwise the group's teacher must still see the lesson in their salary → Task 2 loader includes groups with their substitutions.
- Cancelling a day that already has marks removes them (and their reasons) → Task 3 action test via helper.
- A substitute on a holiday or non-lesson day is refused → Task 1 `lessonChangeProblem` test.
- Old-rule months unaffected by substitutes → Task 2 test.

---

### Task 1: Data and rules

**Files:** Modify `prisma/schema.prisma` (AbsenceReason, Attendance.reasonId, LessonChange, relations), `src/lib/permissions.ts`; Create `src/lib/lesson-changes.ts` (+test), `prisma/absence-reasons.ts`, `package.json` script `db:absence-reasons`.

**Produces:** `lessonChangeProblem(input: { kind: "CANCEL" | "SUBSTITUTE"; date: Date; days: string; holidays: string[]; existing: { kind: string; date: Date }[]; substituteId?: number | null; absentId?: number | null }, today: Date): string | null`; `closedDays(holidays: string[], cancelled: Date[]): string[]`; `whoTaught(day: Date, role, regular: number | null, subs: { date: Date; role: string; substituteId: number | null }[]): number | null`.

- [ ] Step 1: tests — problems: not a lesson day "Bu kunda dars yo'q", holiday "Bayram kuni — dars yo'q", past month "Faqat shu oydan boshlab", already cancelled / substituted "Bu dars allaqachon …", substitute = absent person "O'zini o'zi almashtira olmaydi"; `closedDays` union and dedupe; `whoTaught` substitution wins for its role only.
- [ ] Step 2: FAIL → implement → green; schema + db:push; reasons script run twice (7 then 0).
- [ ] Step 3: commit `feat(lessons): data and rules`.

### Task 2: Money — cancelled lessons and substitutes

**Files:** Modify `src/lib/holidays-db.ts` (`closedDaysByGroup(): Promise<(groupId: number) => string[]>`), every `withHolidays` / curriculum caller to pass the group's closed days, `src/lib/teacher-pay.ts` (`PayMembership.group.substitutes`, use `whoTaught`), `src/lib/salary.ts` (loaders include substitutions and groups substituted in); Tests `teacher-pay.test.ts`, `billing.test.ts`.

- [ ] Step 1: tests — teacher-pay: substitute PERCENT 30 % of one 50 000 lesson = 15 000 to substitute, regular loses 15 000 share; PER_STUDENT; old-rule month unaffected (teacherEarnings only used for lesson months — assert via `lessonBased`).
- [ ] Step 2: FAIL → implement → green; lint lists callers; fix all.
- [ ] Step 3: evidence: no changes → balances/salaries equal master; commit `feat(lessons): cancelled lessons and substitutes in money`.

### Task 3: Screens

**Files:** Modify `src/app/(app)/actions.ts` (`cancelLesson`, `restoreLesson`, `substituteLesson`, `removeSubstitute`, `setAbsenceReason(groupId, studentId, isoDay, reasonId | null)`, absence reason list actions), `src/app/(app)/groups/[id]/page.tsx`, `src/components/TodayLesson.tsx`, `src/app/(app)/settings/reasons/page.tsx`, `src/lib/lists/group-sheet.ts`; Create `src/components/LessonDateMenu.tsx`, `src/components/AbsenceReasonPicker.tsx`.

- [ ] Step 1: UI + actions per spec (date menu, greyed "Bekor", "↔" substitute mark, red flag / reason colour, today card reason select and cancelled/substitute notes, settings list).
- [ ] Step 2: browser: cancel + undo, substitute + undo, reasons from card and date menu, teacher lacks cancel/substitute; evidence with a temporary November cancellation and substitution (charge, regular, substitute each move by one lesson); remove data; README; commit `feat(lessons): date menu, reasons, cancel and substitute`.
