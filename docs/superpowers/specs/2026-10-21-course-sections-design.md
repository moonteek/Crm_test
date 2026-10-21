# Course sections and lesson-based levels — design

## Goal

Courses are built the way the centre actually teaches them: a course has **sections** (Bo'lim — e.g. Web development →
Frontend, Backend), a section has **levels**, and a level lasts **its own number of lessons** (usually 13 ≈ one month,
sometimes 8), with the level exam on its last lesson. A group studies one section. Courses get a picture.

This replaces the month-based curriculum of `2026-10-11-curriculum-design.md` (a level = one calendar month); every
other rule of that spec (auto level exams, pass mark, fail flags, progress bar, alerts, finished groups take no exams)
stays.

## User's answers (binding)

- A group studies **one section**. Frontend graduates who want Backend go to a **new Backend group** (often 2–3
  graduate groups merged) — done **by hand** with the existing transfer / add-to-group; no wizard.
- Level length is **per level, in lessons** (default 13; e.g. 8). The exam is on the level's last lesson.
- Only **lessons actually held** count: holidays and cancelled lessons don't (make-up lessons will, in step 2).
- Existing data converts **automatically: 1 subject-month = 1 level of 13 lessons**, one section per course named
  after the course; the admin then splits Web development / IT Kids into sections.
- Same-name levels are **numbered automatically**: "Node.js ×3" → Node.js 1, Node.js 2, Node.js 3; a one-level name
  shows without a number (HTML).
- A section may have its **own monthly price** (optional; empty = course price). A new group takes it.
- Course **picture: uploaded per course** (PNG/JPG ≤ 300 KB); without one the card shows the course colour and its
  first letter.

## Data

- `Course`: + `image String?` (data URL, checked like the teacher photo: PNG/JPG magic bytes, ≤ 300 KB).
  `durationMon` stays only for courses without levels; with levels the UI shows the computed length.
- New `Section { id, courseId → Course (cascade), name (≤ 60), position, price Int?, createdAt }`, unique
  (courseId, name).
- `Subject` becomes a **level line**: + `sectionId → Section (cascade)`, `levels Int` (1–24; was `months`),
  `lessons Int` (lessons per level, 1–60, default 13). `courseId` is kept (filled from the section) for existing
  queries. `months` is dropped after the conversion copies it into `levels`.
- `Group`: + `sectionId → Section? (SetNull)`. `startSubjectId` / `startLevel` keep their meaning (a line of the
  group's section and a level number within that line).
- Level number = position in the section's level sequence, counted from 1 (the group's starting point can make the
  first level it takes higher, as now). `Exam.level` keeps using these numbers; `@@unique([groupId, level])` stays.

## How levels run (pure, `src/lib/curriculum.ts`)

- The section's levels in order: every line expands to `levels` steps of `lessons` lessons each, named
  `name` (1 level) or `name N` (several).
- From the group's start day, its lesson days are listed forward (weekdays of the group, centre calendar), skipping
  the group's closed days (holidays + its cancelled lessons — the existing `closedDaysOf`). The first level the
  group takes is the first `lessons` of those lessons, the next level the following ones, and so on to the section's
  last level.
- `Window` = { level, line, label ("JS", "Node.js 2"), lessons: Date[], from = first lesson, to = last lesson }.
  Progress, the current level, the next level exam and "lessons done" are computed from these windows on a given
  day exactly as today (done = held lessons ≤ that day).
- Level exam date = the window's last lesson; title `"<label> imtihoni"` (e.g. "JS imtihoni", "Node.js 2
  imtihoni").
- Section end = the last window's last lesson. "Kurs tugadi" becomes **"Bo'lim tugadi"**; the alerts bell lists
  groups whose section ends this month or next, or has ended (same window as today).
- Billing is untouched (monthly / per lesson as now).
- Saved exams: a scored exam keeps its stored date and level; an unscored automatic exam follows the computed date.

## Conversion — `npm run db:curriculum-v2` (once, after `db:push`; safe to run again)

- Every course without a section gets one section named after the course (position 1, no price).
- Every subject gets that section, `levels = months`, `lessons = 13`.
- Every group gets its course's first section if it has none; its starting point is unchanged.
- Level numbers therefore stay the same, so scored exams keep their level.
- Prints a short summary (courses / sections / lines / groups touched).

## Editing rules

- Always allowed: rename a section or line, change a section's price, change `lessons` of a line, add a line or
  section at the end.
- **Refused** for a section that has a group with a scored level exam (message names the group): reorder or remove
  lines, change a line's `levels`, insert a line before existing ones, move a line to another section, remove the
  section. ("Create the new section in a new course or keep the order.") Finished groups' scores count too.
- A section with groups can't be removed; a course keeps at least one section.
- Changing `lessons` moves the unscored exams of running groups to their new dates.

## Screens

- **Kurslar** cards: picture (or colour + first letter), name, price, and per section "Frontend · 5 daraja · 65 dars"
  (with the section price when it differs).
- **Course form** (create / edit): picture upload (preview, remove) next to the existing fields; the
  subject editor becomes a **section editor**: sections in order (rename, price, ↑↓, remove) and in each section
  its lines (name, levels, lessons per level, ↑↓, remove; "+ daraja qo'shish"). Totals per section ("65 dars ≈ 5 oy").
  Errors inline (ActionForm / `{ error }`).
- **Group form** (new / edit): Kurs → **Bo'lim** (only that course's sections; one section = preselected and hidden
  choice) → "Qaysi darajadan boshlaydi" (line + level of that section). Price pre-fills from the section (else
  course); changing an existing group's section is allowed only while it has no scored level exams.
- **Group page / groups list / timetable card / risky students**: labels read
  "Frontend · JS · 3/5-daraja · 7/13 dars"; exam columns use the new titles. Single-section courses don't show the
  section name.
- Leads keep pointing at a course (no section).

## Access

Unchanged: course and section editing `courses.manage`; groups `groups.manage`.

## Testing

Unit tests (`src/lib/curriculum.test.ts`, updated):
- 13-lesson levels on odd days from a start date; mixed 8 / 13 lines; a group starting at a later line/level.
- a holiday and a cancelled lesson inside a level move its last lesson (exam) and every later level by one lesson.
- numbering: "Node.js ×3" → Node.js 1/2/3; single-level line unnumbered; exam titles.
- progress on a day (not started / in progress / finishing / finished) and section end; alerts use the section end.
- editing rules: each refused change with a scored exam, each allowed change.
- conversion: months → levels, one section per course, groups linked, idempotent on a second run (pure planner).

Browser check: course with two sections and its card picture; group form section choice and price; group page
labels and exam dates; a cancelled lesson moving the exam; the conversion on the demo data.

## Production

`npm run db:push`, then `npm run db:curriculum-v2`. Then split Web development / IT Kids into sections on Kurslar.

## Out of scope

The "graduates → next section" wizard; per-section teacher pay; lead → section; make-up lessons (step 2).
