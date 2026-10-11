# Students step 1b-i — fields, tags, notes, history, list filters, export — design

Date: 2026-10-11 · Status: approved in chat, awaiting written-spec review
Discounts (Chegirma) are step 1b-ii, designed separately because they change balances and teacher pay. Nothing in this
step changes money.

## Goal

Bring the old CRM's student details into the new CRM: richer student info, admin-managed tags, notes with one pinned,
a full history per student, a filterable student list, and exporting the shown list to Excel or Google Sheets.

## What the user said

- Extra fields: gender; parent's name + second phone; school + address; source + passport/ID.
- Notes: many per student, each with author and time; one can be pinned.
- Tags: a list managed by **managers or admins**; staff attach tags to students.
- **Teachers and assistant teachers cannot** add notes, tags or edit students.
- History tab: everything about the student, with who and when.
- Export: download the shown data as Excel, or take it to Google Sheets (copy-and-paste, no Google account setup).
- Passport/ID: only staff who edit students see it; never exported.
- Source: same list as leads; a converted lead passes its source on.

## Assumptions

- A1. Export includes every row matching the current filters (all pages), not only the visible page.
- A2. The existing single `Student.note` ("Izoh") becomes the student's first note (one-time, re-runnable script); the
  field is then no longer shown or edited.
- A3. History for actions before this release shows what is already stored (membership events, payments); profile
  edits, notes, tags and payment deletions are recorded from this release on.
- A4. The export control is reusable; this step puts it on the student list only.

## Data

```prisma
model Student {
  // new, all optional
  gender      String?  // "M" | "F"
  parentName  String?
  phone2      String?
  school      String?  // school and class, free text: "12-maktab, 7-sinf"
  address     String?
  source      String?  // one of LEAD_SOURCES
  passport    String?  // shown only with students.manage; never exported
  tags        StudentTag[]
  notes       StudentNote[]
  auditLogs   AuditLog[]
}

model Tag {
  id     Int     @id @default(autoincrement())
  name   String  @unique
  color  String  // one of TAG_COLORS: "amber" | "green" | "red" | "blue" | "grey"
  active Boolean @default(true)
  students StudentTag[]
}

model StudentTag {
  studentId Int
  student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  tagId     Int
  tag       Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([studentId, tagId])
}

model StudentNote {
  id        Int      @id @default(autoincrement())
  studentId Int
  student   Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  text      String
  pinned    Boolean  @default(false)
  userId    Int?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  createdAt DateTime @default(now())
  @@index([studentId])
}

model AuditLog {
  // new
  studentId Int?
  student   Student? @relation(fields: [studentId], references: [id], onDelete: SetNull)
  @@index([studentId])
}
```

`Lead → Student` conversion copies `lead.source` into `student.source`.
Script `npm run db:notes-from-izoh`: for every student with a non-empty `note` and no notes yet, create one
`StudentNote` (no author, pinned, `createdAt = student.createdAt`); prints the count; re-running creates nothing.

## Permissions

- New permission `students.tags` — "Teglarni boshqarish" (create / rename / recolour / switch off tags). Administrator
  has everything; the default "Menejer" role gets it in `DEFAULT_ROLES` (existing databases: tick it once on the
  Rollar page — seed never edits existing roles).
- Attach/detach tags, add/pin/delete notes, edit fields: `students.manage` (teacher and assistant roles don't have it).
  Deleting a note: its author, or an admin.
- Passport: rendered and editable only with `students.manage`.
- Export: `students.view`, within `studentScope` (teachers export only their students); the balance column only when
  `canSeeBalances`.

## Screens

### Student form

The existing fields plus a collapsible "+ qo'shimcha ma'lumot" section: Jinsi (O'g'il / Qiz), Ota-ona ismi,
Qo'shimcha telefon, Maktab / sinf, Manzil, Qayerdan keldi (LEAD_SOURCES), Pasport / ID (only with `students.manage`).
"Izoh" textarea is removed from the form (notes replace it).

### Student profile

- Left card: name, ID, balance, phone(s), parent, birth date, joined, filled extra fields, tag chips (with an edit
  popover for `students.manage`: checkbox list of active tags), and the pinned note (text, author, time).
- Right: tabs `Guruhlar · To'lovlar · Eslatma · Imtihonlar · Tarix` (query param `tab`). Phones: card first, tabs
  scroll sideways.
  - Eslatma: add form (textarea) on top for `students.manage`; list newest first with author/time, pin toggle (pinning
    one unpins the other) and delete.
  - Tarix: one timeline, newest first, each row = what, group (if any), amount (if any), who, when. Sources:
    membership events (from `MembershipEvent`), payments (from `Payment`), and `AuditLog` rows with this `studentId`
    except `payment.create` and membership actions (already shown from their own tables).

### Settings → Teglar

List of tags with colour chip, student count, rename / colour / active toggle; add form. Inactive tags stay on
students but can't be newly attached and are hidden from the filter.

### Student list

- One search box: name, phone, second phone or parent's phone.
- Filters (GET params, combinable): group, course, teacher (teacher or assistant of an active membership), tag, status:
  Faol (ACTIVE), Sinovda (TRIAL), Muzlatilgan (FROZEN), Guruhsiz / chiqib ketgan (no current membership),
  Qarzdor (balance < 0, only for `canSeeBalances`), Barchasi. "Tozalash" resets.
- "Jami: N"; page size 20 / 50 / 100 (`per`), pages (`page`).
- Rows: name (+ tag chips), phone, groups, teachers, status, balance (if allowed).
- Export control (top right): **Excel** → `GET /students/export?<same params>` returns `.xlsx`
  (`O'quvchilar-YYYY-MM-DD.xlsx`), header row bold, columns sized; **Google Sheets** → copies the same rows as
  tab-separated text to the clipboard and says "Nusxa olindi — Google Sheets'da Ctrl+V bosing".
  Columns: № , Ism, Telefon, Ota-ona telefoni, Guruhlar, O'qituvchilar, Holati, Balans (if allowed), Teglar,
  Qayerdan keldi. Never passport.

## Logic units

- `src/lib/student-filters.ts` (pure, tested): `parseStudentFilters(params) → Filters`, `studentWhere(filters, scope) →
  Prisma.StudentWhereInput`, `matchesStatus(student, status, balance)` for the in-memory statuses (Qarzdor).
- `src/lib/student-export.ts` (pure, tested): `exportRows(students, { showBalance }) → string[][]` (header + rows),
  `toTsv(rows)`; `src/lib/xlsx.ts` builds the workbook with `exceljs`.
- `src/lib/student-history.ts` (pure, tested): `studentHistory({ events, payments, logs }) → HistoryItem[]` merged and
  sorted, skipping duplicate audit kinds.
- `logAction(user, action, summary, { studentId })` — optional fourth argument; student actions pass it.

## Testing

- Unit: filters (each status, search across phones, tag/course/teacher), export rows (balance column hidden, no
  passport, Uzbek letters intact in TSV), history merge order and de-duplication, notes script idempotence (run twice).
- Browser (light/dark, 1280 and 375 px): add fields, pin a note, attach a tag, history shows all three with author;
  teacher login sees no note form / tag edit / passport; filters + pagination; Excel downloads and opens; Sheets copy
  pastes into columns.
- Evidence: balances and salaries identical to master (nothing here touches money).

## Out of scope (later steps)

Discounts (1b-ii), SMS, coins/crystals, risky-students report, export on other lists (one line each once the control
exists).
