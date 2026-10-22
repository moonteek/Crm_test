# Student extras — parents, extra-info icons, documents, tags on add, ledger, transfer "keep" — design

## Goal

Roadmap step 3 (from the old-CRM review): the student form and profile carry what the office actually asks for —
both parents, quick extra contacts, scanned documents — and the payments tab reads like the old CRM's ledger
(who did what, row types, notes, a filter). A transfer can keep the student in the old group too.

## User's answers (binding)

- Parents: **father and mother, each with name and phone**. The existing single parent name/phone move into "Otasi".
- Extra-info icons open: **Telegram username, Email, Extra phone (existing), Document number (existing passport/ID)**
  — plus **document files**.
- Documents: **several files per student, PDF/JPG/PNG ≤ 2 MB**, each with a name; open/download/delete; only staff
  who edit students; never exported; stored in the database.
- Ledger gains: **who + when on each row, a payment-type filter, clear row types, the payment note on its own line**.
- Transfer: **"Guruhda saqlab qolish" tick box** — ticked = join the new group and stay in the old one.
- Tags can be chosen in the add form (roadmap item).

## Data

`Student`:
- rename meaning: `parentName` → kept as the **father's name** (`fatherName` new column, filled from `parentName` by the
  conversion); `parentPhone` → **father's phone** (`fatherPhone`, filled from `parentPhone`). New `motherName String?`,
  `motherPhone String?`. `parentName` / `parentPhone` stay as legacy columns, no longer written or read by the app
  (one `db:push`, no data loss).
- New `telegram String?` (username without "@", 5–32 chars `[A-Za-z0-9_]`), `email String?` (simple format check,
  ≤ 120).
- `phone2`, `passport` unchanged.

New `StudentDocument { id, studentId → Student (Cascade), name String (≤ 80), mime String, size Int, data String
(base64), userId → User? (SetNull), createdAt }`, index on studentId.

## Conversion — `npm run db:parents` (once after `db:push`, safe to re-run)

For every student with `fatherName` and `fatherPhone` both empty: copy `parentName` → `fatherName`,
`parentPhone` → `fatherPhone`. Prints the count. Pure planner `planParents(rows)` with tests.

## Forms (add and edit — `src/components/forms.tsx` StudentFields)

- Main fields unchanged (name, phone, birth date).
- "Otasi" row: ism, telefon; "Onasi" row: ism, telefon.
- Icon row: **Telegram · Email · Qo'shimcha telefon · Pasport/ID** (the last only for `students.manage`). Each icon
  toggles its input; an icon whose field has a value starts open and shows a dot. Buttons are labelled for screen
  readers.
- "+ qo'shimcha ma'lumot" fold keeps gender, source, school, address.
- **Add form only**: tags (multi-select chips) when the user has `students.tags`; the existing "Guruhga qo'shish" stays.
- Validation (zod, inline errors via ActionForm): telegram `^@?[A-Za-z0-9_]{5,32}$` stored without "@"
  ("Telegram username noto'g'ri"); email `^[^\s@]+@[^\s@]+\.[^\s@]+$` ("Email noto'g'ri"); phones as today.

## Student card / lists / search

- Card: "Otasi: ism · telefon (call link)", "Onasi: ism · telefon", Telegram as `t.me/<username>` link, email as
  `mailto:`.
- Search (top search and the students list `q`): matches father's and mother's phones too (digits), and names.
- Exports (students, debtors, risky students), debtors page, risky page and MCP student tools: show "Otasi telefoni"
  and "Onasi telefoni" where they showed the parent phone.

## Documents — "Hujjatlar" on the student page

- Shown to `students.manage` only (a block under Eslatma on the Guruhlar tab side panel, or its own tab "Hujjatlar").
  Decision: its own tab **Hujjatlar**, visible only with `students.manage`.
- Upload: name (required, ≤ 80) + file; client and server check: PDF (`%PDF-`), PNG, JPEG magic bytes, ≤ 2 MB
  ("Faqat PDF, JPG yoki PNG, 2 MB gacha"). Up to 30 documents per student ("Ko'pi bilan 30 ta hujjat").
- List: name, type, size, date, who; **Ochish** (opens in a new tab), **Yuklab olish**, **O'chirish** (ActionButton).
- Files are served by `GET /students/[id]/documents/[docId]` (and `?download=1`), same permission, correct
  Content-Type, `Content-Disposition: inline|attachment; filename="<name>.<ext>"`, `Cache-Control: private,
  no-store`, `X-Content-Type-Options: nosniff`.
- Upload / delete are logged (`student.document`) with the student id (Tarix).
- Never in exports or MCP.

## Ledger — payments tab (`src/lib/statement.ts`)

- `StatementRow` gains `type` (`PAYMENT | CHARGE | EVENT`-specific label), `who: string | null`, `at: Date | null`
  (recorded time), `note: string | null`, `method: string | null`.
- Row type words (first word of the row): payments "To'lov"; monthly charges "Oylik hisob"; events from
  `EVENT_LABEL`, with transfer leaves labelled "Boshqa guruhga o'tkazildi" and the join "O'tkazma bilan qo'shildi"
  when the event comment/reason marks a transfer (existing transfer writes LEAVE + ACTIVATE/TRIAL on the same day —
  detected by a LEAVE and a start in another group on the same date).
- "Hodim" column: payment → its `user` and `createdAt`; event → its `user` and `createdAt`; charge → "Tizim".
- Payment note on its own muted line; the label no longer includes the note.
- Filter (links, URL `?ledger=`): Hammasi · To'lovlar · Naqd · Karta · O'tkazma · Hisoblar (charges) · Amallar
  (events). The running balance column is computed over all rows before filtering, so it stays correct.

## Transfer — "Guruhda saqlab qolish" (`MemberDialog` TRANSFER, `transferStudent` action)

- New tick box under the target group, default off.
- Ticked: no LEAVE in the old group; the student starts in the new group from the date (trial or active as chosen).
  The balance preview shows only the new group's charge change. Logged "Boshqa guruhga qo'shildi (eskisida qoldi)".
- Unticked: as today (leave old, start new on the same date).
- Refused when the student is already active/trial/frozen in the target group (existing rule).

## Testing

Unit: `planParents`; telegram/email schema; document check (magic bytes, size, count); statement row types, who/at,
note line, filter keeps balances; transfer with keep → no leave event planned (pure helper `transferEvents(keep)`).
Browser: add form icons and tags, card parents/telegram/email, upload/open/download/delete a document (and refused
for a teacher), ledger filter and Hodim column, transfer with and without keep; dark mode and 375 px.

## Production

`npm run db:push`, then `npm run db:parents`.

## Out of scope

Parent app logins (Phase 2), SMS to parents, document templates/contracts generation.
