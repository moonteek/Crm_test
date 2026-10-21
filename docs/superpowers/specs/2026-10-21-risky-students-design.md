# Risky students — "Xavfli o'quvchilar" — design

## Goal

Show the staff who is likely to drop out — students who keep missing lessons, whose attendance or grades are slipping,
or who failed a level exam — so someone calls the student or a parent before they leave. The call and its result are
recorded, and a student comes back to the "not contacted" list only when something new goes wrong.

## User's answers (binding)

- Signals: **missed lessons in a row**, **low attendance lately**, **falling or low grades** (including a failed level
  exam). **Not debt.**
- Follow-up: **"Bog'lanildi" + result + comment**, kept in the student's history; the student leaves the
  "Bog'lanilmagan" tab until a **new** risk signal appears.
- Access: **admins and managers only** — a new permission; teachers don't see the report.
- Limits: **editable in Settings**, with sensible defaults.

## Who is checked

- Every membership with status **ACTIVE** or **TRIAL** today (frozen and left are skipped). Each group is checked on
  its own; a student in two groups can be risky in one of them.
- Only lessons that were **marked** count. Unmarked lessons, cancelled lessons and holidays have no attendance row, so
  they neither break nor extend a run and don't enter rates.
- "Kechikdi" (late) counts as present everywhere.
- Window dates use the centre's day (`centreDay()`); "last N days" = the N days ending today, inclusive.

## Signals (pure functions in `src/lib/risk.ts`)

Each signal produces a reason with a short label and a **trigger date** — the date of the newest fact behind it
(used by the contact rule below).

| Signal | Rule (defaults) | Label | Trigger date |
|---|---|---|---|
| Missed in a row | the newest marked lessons of that group are ≥ **2** "kelmadi" in a row | `3 marta ketma-ket kelmadi` | newest absence |
| Low attendance | in the last **30** days, present ÷ marked < **70 %**, with at least **4** marked lessons | `Davomat 55% (30 kun)` | newest absence in the window |
| Low grades | average grade in the last 30 days < **3.5**, with at least **3** grades | `O'rtacha baho 3.2` | newest grade below the limit in the window (else newest grade) |
| Falling grades | average in the last 30 days is lower than the 30 days before by ≥ **1.0**, each period with at least 3 grades | `Baho tushdi: 4.6 → 3.4` | newest grade in the last 30 days |
| Failed level exam | the student's **latest scored level exam** in that group is below the course's pass mark (`passed()` in curriculum.ts) | `2-daraja imtihoni: 45/100` | the exam's date |

- Averages are shown with one decimal; percentages rounded to whole numbers.
- A later passed level exam clears the exam signal (only the latest scored one counts).
- Hand-added exams (no level) are ignored.

## Limits — Sozlamalar → "Xavfli o'quvchilar"

- New tab `/settings/risk`, editable with `staff.manage` (like the other settings tabs).
- Fields (integers unless noted), stored as JSON in the existing `Setting` table under key `risk`, each field falling
  back to its default when missing or invalid:
  - Ketma-ket qoldirilgan darslar: **2** (1–10)
  - Davomat chegarasi: **70** % (1–100)
  - Davr (kun): **30** (7–120) — used by both attendance and grades
  - Kamida belgilangan darslar: **4** (1–30)
  - Past o'rtacha baho: **3.5** (1–5, one decimal)
  - Baho tushishi: **1.0** (0.1–4, one decimal)
  - Kamida baholar soni: **3** (1–20)
- Saving is logged ("Xavfli o'quvchilar chegaralari o'zgartirildi"). Errors show inline (ActionForm).

## Contacts

- New table:
  `RiskContact { id, studentId → Student (cascade), userId → User? (set null), result String, comment String?, createdAt }`
  with an index on studentId.
- Results: `RETURNING` "Qaytadi", `LEAVING` "Ketmoqchi", `NO_ANSWER` "Javob bermadi", `OTHER` "Boshqa".
- "Bog'lanildi" button on each row opens a dialog: result (required, buttons/radio), comment (optional, ≤ 500).
  Saved with the current user and time; also written to the audit log with the student id, so it appears in the
  student's **Tarix** tab: "Bog'lanildi (xavfli o'quvchi): Qaytadi — <comment>".
- **Contacted rule:** a student counts as contacted when their newest contact is **on or after the newest trigger
  date** among all their current reasons. A new absence, low grade or failed exam dated after the call puts them
  back in "Bog'lanilmagan"; the earlier contact stays visible on the row.
- Contacts are per student (not per group) — one call covers all their groups.

## The page — `/risk` "Xavfli o'quvchilar"

- Sidebar: under **O'quv**, after O'quvchilar, with a badge = number of not-contacted risky students (hidden at 0).
- Tabs: **Bog'lanilmagan** (default) · **Bog'lanilgan** · **Hammasi**, each with its count.
- Filters (URL params, like the students list): group, teacher (the group's current teacher), reason type
  (ketma-ket / davomat / baho / imtihon).
- One row per student, sorted by number of reasons (most first), then by newest trigger date (newest first):
  - student name (link to the profile), phone, parent's phone;
  - per risky group: group name (link) · teacher, with that group's reason chips;
  - last contact: date, who, result (and comment on hover/under it), or "—";
  - "Bog'lanildi" button.
- Empty states: "Xavfli o'quvchilar yo'q" / "Hammasi bilan bog'lanilgan".
- Export: Excel and Google Sheets buttons (same ExportButtons as other lists) with the current tab and filters;
  columns: O'quvchi, Telefon, Ota-ona telefoni, Guruh, O'qituvchi, Sabablar, Oxirgi aloqa, Natija, Izoh.
- Dashboard: a card "Xavfli o'quvchilar — N ta bog'lanilmagan" linking to `/risk`, shown to users with the
  permission.

## Access

- New permission **`risk.view`** — "Xavfli o'quvchilar: ko'rish va bog'lanishni belgilash" in the O'quvchilar group.
  Administrator has everything; it is ticked for nobody else by default (tick it for Menejer). The page, export,
  dashboard card, sidebar item and the contact action all require it.
- No group scoping (managers see the whole centre); teachers without the permission get the no-access page.

## Performance

- One request loads: active/trial memberships with student, group, course pass mark and current teacher; attendance
  and grades of those memberships in the last 2 × window days; level exams with results for those groups; the newest
  contact per student. Rules run in memory. Fine for a few thousand students on SQLite; no caching.
- The sidebar badge and dashboard card use the same function.

## Testing

Unit tests (`src/lib/risk.test.ts`) for the pure rules:
- run of absences: broken by a present or late mark; unmarked days ignored; below the limit → no reason; label count.
- attendance: rate under/over the limit; fewer marked lessons than the minimum → no reason; late = present.
- grades: low average with/without enough grades; falling by ≥ limit vs previous period, each needing the minimum.
- level exam: latest scored failed → reason; a later passed exam clears it; non-level exams ignored.
- trigger dates and the contacted rule: contact after the newest trigger → contacted; a newer absence → not
  contacted; contact on the same day as the trigger → contacted.
- settings parsing: defaults, out-of-range and junk values fall back per field.

Browser check: the page with tabs and filters, a contact moving a student to "Bog'lanilgan", the entry in Tarix, the
settings tab changing the list, export, and a role without `risk.view` being refused.

## Production

`npm run db:push` (new RiskContact table), then tick "Xavfli o'quvchilar" for the Menejer role.

## Out of scope

Debt as a signal; automatic SMS/Telegram to parents; per-teacher view; scheduled reminders to call.
