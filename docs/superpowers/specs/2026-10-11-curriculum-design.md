# Curriculum: subjects, monthly levels, progress and level exams (EduTrack logic, part A)

Date: 2026-10-11
Status: awaiting review
Source: the user's previous project EduTrack (`D:\edutrack_back`) — modules → subjects → levels, progress bars,
automatic exam dates, near-finish alerts, archive. Re-implemented in this CRM, not copied (different stack).
Part B (teacher availability: free/busy slots on odd/even days) gets its own design afterwards.

## 1. Goal

Every group knows where it is in its course — which subject, which level, how many lessons done — without anyone
typing it, gets its level exams scheduled automatically, and the office sees which groups are finishing their course.

## 2. What the user said vs. assumed

Said:

- A level is one calendar month of lessons; "13 lessons" is only an average (12–14 on odd/even days, ~25 daily).
- Levels count from the group's start day: start 20 Oct → Level 1 = 20 Oct–19 Nov, Level 2 = 20 Nov–19 Dec…
- A course is an ordered list of subjects with month counts (e.g. Web Development: HTML 1, CSS 2, JavaScript 3,
  React 3, Node.js 3); a group moves through them automatically.
- Level exams are scheduled automatically on the last lesson of each level; teachers only enter scores.
- A failed exam flags the student (pass mark), nothing more; the student stays in the group.
- Include: course-end alerts, progress filters, archive (and teacher availability, in part B).
- At the end of the last subject the group shows "Kurs tugadi" and is listed in the alerts; it keeps charging
  until an admin finishes it.

Assumed (correct me in review):

- A1. Subjects belong to one course (the same name, e.g. HTML, can appear in two courses). The course's total months
  = sum of its subjects' months; the course's "Davomiylik (oy)" field becomes that sum.
- A2. A new group can start part-way through its course: "Qaysi fandan boshlaydi" = subject + level (default: the
  first subject, level 1). Example: students who know HTML start at CSS level 1.
- A3. The pass mark is per course, default 60%.
- A4. The group's current "Daraja" label (HTML, CSS, JS…) is replaced by the computed current subject; the old field
  is kept only for groups whose course has no subjects yet.
- A5. Lessons done = the group's scheduled lesson days from its start up to today (holidays aren't skipped yet).
- A6. Archive = finished groups. "Restore" makes the group active again but does not bring students back (they are
  re-added like any student, so no charges appear by surprise).
- A7. Alerts: a bell (sidebar and phone top bar) counts groups whose course ends this month or next, and groups whose
  course has ended but are still active. Each alert can be dismissed until it changes.
- A8. Auto exams are listed from the schedule and saved as a real exam the first time a score is entered, so moving a
  group's start date or schedule moves its future exams.

## 3. Data

- `Subject { id, courseId → Course (cascade), name, months Int ≥ 1, position Int }` — ordered per course.
- `Course.passPercent Int @default(60)`.
- `Group.startSubjectId Int?`, `Group.startLevel Int @default(1)` — where the group began (A2).
- `Exam.level Int?` (the course-wide month number) — set for auto exams; `null` for exams added by hand.

## 4. Logic (pure, `src/lib/curriculum.ts`)

- `levelWindows(group, subjects)` — for every course month from the group's start point: `{ month, subject,
  levelInSubject, from, to, lessons[] }`, where window N runs from start + (N−1) months to the day before
  start + N months (A start day that a month lacks, e.g. the 31st, falls on the month's last day).
- `progressOn(group, subjects, day)` → current window, lessons done in it / total, course % done, "finished" flag.
- `levelExams(group, subjects)` → the last lesson day of each window, titled "{Subject} · {level}-daraja imtihoni".
- `passed(score, maxScore, passPercent)`.

## 5. Screens

- **Courses:** a subject list editor per course (add, rename, months, reorder, delete when unused); pass mark field.
- **Group form:** "Qaysi fandan boshlaydi" (subject + level) when the course has subjects.
- **Group card / page:** current subject badge, segmented progress bar per subject like EduTrack
  ("JavaScript · 2/3-daraja · 8/13 dars · 46%"), next exam date; "Kurs tugadi" badge when finished.
- **Imtihonlar tab:** auto exams listed by date (past and upcoming) next to manual ones; entering scores saves
  them; failed scores marked "yiqildi" in red; student profile shows failed exams.
- **Groups list filters:** course, current subject, progress (boshlanmagan / jarayonda / tugayapti — last month /
  kurs tugagan), plus "Arxiv" (finished groups) with a restore button.
- **Alerts bell** (A7) and a dashboard card "Kursi tugayotgan guruhlar".
- **Timetable:** the lesson card shows the current subject and marks exam days.

## 6. Testing

Unit tests for windows (start on the 20th, start on the 31st, odd/even/daily, starting part-way, course total),
progress (before start, mid-level, last lesson, after course end), exam days, pass/fail, alert selection.
Browser checks of every screen above in light/dark and on a phone. Billing and salaries untouched (balances and
salaries compared before/after).

## 7. Out of scope

Teacher availability (part B), holidays, student app, homework, coins.
