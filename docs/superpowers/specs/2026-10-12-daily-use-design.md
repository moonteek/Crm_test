# Daily-use fixes — design

Date: 2026-10-12 · Status: approved in chat, awaiting written-spec review

## Goal

Make the screens staff use every day faster and harder to get wrong: find a student instantly, take a payment with
the right amount, see who took it, mark today's lesson in seconds, know which groups haven't been marked, and find
pages in a grouped menu.

## What the user said

1. **Search** (top bar, Ctrl+K): students only.
2. **Debtors**: one number everywhere — everyone who owes (current and former students); Qarzdorlar gets a
   Faol / Chiqib ketgan / Hammasi filter.
3. **Payment form**: amount pre-filled with the student's debt (or the monthly price if nothing is owed); group price
   and debt shown; "Qaysi oy uchun" is a **label only**.
4. **Payments record who took them; staff with permission can edit a payment and every edit is kept and shown**
   (old CRM: "Abdullajonova Zebo [780000 -- 790000]").
5. **"Bugungi dars"** for teachers: today's list first, big buttons, "Hammasi keldi".
6. **Attendance marks: Keldi / Kechikdi / Kelmadi** — late counts as present in the attendance %.
7. "Davomat qilinmagan" groups for managers; group delete moved into a "⋯" menu with a confirmation; grouped sidebar;
   timetable export. (All approved in chat.)

## Assumptions

- A1. Editing payments is a new permission "To'lovni tahrirlash" (`payments.edit`); only Administrator has it by
  default (owners tick it for other roles). Deleting stays `payments.delete`.
- A2. Old payments have no recorded taker; they show "—".
- A3. "Qaysi oy uchun" offers the previous, current and next three months; default = current month.
- A4. "Davomat qilinmagan" = an active group with a lesson today (not a holiday) whose start time has passed and
  that has no attendance mark today.

## Data

```prisma
model Payment {
  // new
  userId    Int?      // staff member who took it ("Hodim")
  user      User?     @relation("PaymentTaker", fields: [userId], references: [id], onDelete: SetNull)
  month     DateTime? // "Qaysi oy uchun" — label only (UTC 1st); balance is unaffected
  createdAt DateTime  @default(now())
  edits     PaymentEdit[]
}

model PaymentEdit {
  id        Int      @id @default(autoincrement())
  paymentId Int
  payment   Payment  @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  userId    Int?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  before    String   // JSON {amount, method, date, month, note}
  after     String
  createdAt DateTime @default(now())
}

model Attendance { late Boolean @default(false) } // only meaningful when present = true
```

## Screens and behaviour

### 1. Student search
A search button in the desktop sidebar header and the phone top bar; Ctrl+K / "/" opens it. A dialog with one input;
results after 2 characters (debounced), up to 8: name, phone, current groups, balance chip (only with
`canSeeBalances`). Matches name, phone, phone2, parentPhone; respects `studentScope`. Arrow keys + Enter open the
student. Server route `GET /api/search/students?q=` (auth required).

### 2. Debtors
`loadDebtors` gains `status: "all" | "active" | "left"` (active = has a current membership). Dashboard card shows the
same total as Qarzdorlar "Hammasi"; the card links to Qarzdorlar.

### 3. Payment form
Shown for a student (profile, debtors, member menu): group select (current groups), and above the amount: "Guruh
narxi: X / oy · Qarz: Y" for the selected group (balance-wide debt). Amount default = debt if > 0 else the group's
monthly price. Method Naqd / Karta / O'tkazma. Date (default today). "Qaysi oy uchun" select (A3). Izoh. The taker is
the signed-in user.

### 4. Payments list and edits
- Columns: Sana, O'quvchi, Guruh, Summa, Turi, Qaysi oy, **Hodim**, Izoh. Under a payment that was edited: one line
  per edit "Zebo · 12.10 14:20: 780 000 → 790 000" (changed fields only).
- Filters (GET params): date range (default this month — replaces the month arrows), search by student name,
  group, teacher (current teacher of the group), Hodim, method. "Jami: N so'm / K ta". Export follows the filters.
- Edit dialog (`payments.edit`): amount, method, date, month, note; saved as one transaction writing a PaymentEdit;
  logged `payment.edit` with the student (appears in Tarix).

### 5. "Bugungi dars"
On the group page, when today is one of the group's lesson days and not a holiday, a card above the tabs: each current
student (not left/frozen) with three big buttons Keldi / Kechikdi / Kelmadi (selected state filled), and "Hammasi
keldi" for those not yet marked. Each tap saves immediately (same server rules as the grid). Hidden otherwise.

### 6. Attendance marks
Grid cell cycle: empty → ✓ keldi → 🕒 kechikdi → ✗ kelmadi → empty. Late = `present: true, late: true`. Attendance %
counts late as present. Exports show "K" for late. MCP `mark_attendance` unchanged (present/absent; late stays false).

### 7. Davomat qilinmagan
`unmarkedToday(groups, attendanceToday, now)` (pure). Dashboard card "Davomat qilinmagan guruhlar" (manager roles with
`groups.all`); groups list filter `?unmarked=1`.

### 8. Group delete
"O'chirish" moves into a "⋯" menu on the group header; it opens a confirmation ("Guruh va uning davomat, baho,
imtihonlari o'chiriladi. Rostdan o'chirilsinmi?").

### 9. Grouped sidebar
Bosh sahifa, Analitika on top; sections **O'quv** (O'quvchilar, Guruhlar, Dars jadvali, O'qituvchilar, Mening vaqtim,
Kurslar, Xonalar), **Sotuv** (Lidlar, Sotuv va KPI), **Moliya** (To'lovlar, Qarzdorlar, Moliya, Ish haqi, Do'kon),
**Tizim** (Faoliyat jurnali, Sozlamalar). Section titles only (no collapsing); a section with no allowed items is
hidden. Phone menu sheet uses the same sections; the bottom tab bar is unchanged.

### 10. Timetable export
Excel / Google Sheets on Dars jadvali for the shown day: Vaqt, Guruh, Kurs, O'qituvchi, Xona, O'quvchilar.

## Testing

- Unit: debtor status filter; payment default amount (debt / price); month-label options; payment edit diff text;
  attendance cycle and % with late; `unmarkedToday` (holiday, before start time, already marked, non-lesson day);
  sidebar sections hide empty groups; search matching on phones.
- Browser: each screen at 1280 and 375, light/dark; teacher sees no edit / delete; balances vs master equal (payments
  untouched by labels) and after a test edit only that student's balance changes by the edit's difference.
