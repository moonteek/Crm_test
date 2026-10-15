# Receipts — "Chek chiqarish" and "Chek sozlamalari" — design

## Goal

After a payment, the cashier can print a receipt on a thermal receipt printer, download it as a PDF to send to a
parent, or reprint any old payment's receipt later — found from the payment or by its receipt number. An administrator
sets what the receipt shows (logo, centre name, contacts, which lines) on a settings page with a live preview, like
the old CRM's "Chek sozlamalari" / "Chek ko'rinishi".

## User's answers (binding)

- Printer: a **thermal receipt printer** (roll paper). Paper width is a setting: **80 mm (default) or 58 mm**.
- When: **ask after each payment** — after saving, the payment dialog offers "Chek chiqarish"; plus a reprint button
  on every payment.
- Lines: the old CRM's (receipt number, centre name, time, student, teacher, Mas'ul, group, payment type, total) plus
  **centre phone & address** and **"Qaysi oy uchun"**. Not the debt after payment.
- Settings: **Administrator only** (existing `staff.manage`, like the other settings tabs).
- Logo: **uploaded in settings** (PNG or JPG, up to 300 KB); until one is uploaded, the built-in Algoritm logo; a tick
  box hides the logo.
- PDF: a separate **"PDF yuklab olish"** button that downloads a ready file (`chek-<id>.pdf`), no print window.
- Reprint: **any old payment** (🧾 button on the payments list and the student's payment history) and **find by
  receipt number**.

## Settings — Sozlamalar → "Chek"

- New tab "Chek" (`/settings/receipt`), `staff.manage`.
- Left: the form. Centre name (required, ≤ 60), phone (optional, ≤ 40), address (optional, ≤ 120), paper width
  (80 / 58 mm), logo (upload / replace / remove; "Logotipni ko'rsatish" tick box), and tick boxes for the lines:
  Chek raqami, Vaqt, O'quvchi, O'qituvchi, Mas'ul, Guruh, Qaysi oy uchun, To'lov turi. **Summa is always shown.**
- Right: "Chek ko'rinishi" — the receipt drawn from the form's current values with a sample payment, updating as the
  admin types and ticks (before saving).
- Storage: a new generic table `Setting { key String @id, value String (JSON), updatedAt }`; the receipt uses key
  `receipt`. Missing or invalid stored values fall back to defaults field by field: name "Algoritm", no phone or
  address, 80 mm, logo shown, every line on.
- Logo is stored inside the setting as a data URL (PNG/JPG only, ≤ 300 KB, checked on the server by type and size);
  it works on any server without a file store. SVG is refused (PDF can't embed it). The built-in default logo ships as
  a PNG in `public/`.
- Changes are logged ("Chek sozlamalari o'zgartirildi").

## The receipt

- One pure function builds the receipt's lines from the settings and a payment: `receiptLines(settings, data)` →
  header (logo?, name, phone, address), rows of [label, value], total, all as plain text. The screen, the print page
  and the PDF all use it, so they always match.
- Values: receipt number = payment id (`№ 1234`); time = payment date + time it was recorded (centre time); student;
  teacher = the group's teacher on the payment date (teacher history), "—" without a group; Mas'ul = who took it
  ("—" for old payments); group; month = "Oktabr 2026" or left out when the payment has none; payment type in words
  (Naqd / Karta / O'tkazma); total "200 000 so'm". An edited payment prints as it is now.
- Look: monospace, black on white always (also in dark mode), centred header, label left / value right, a dashed rule
  before the total, "Rahmat!" at the bottom.

### Print page — `/payments/[id]/receipt`

- Shows the receipt at the paper width with buttons **Chop etish**, **PDF yuklab olish**, **Yopish** (buttons hidden
  when printing). `@page` size = paper width × auto, no margins, so the thermal printer's driver prints one strip.
- Opened with `?print=1` it calls the print window once on load (used by "Chek chiqarish"); without it, nothing prints
  until the button is pressed.
- Access: `payments.view` or `payments.create`, and the student must be in the user's scope (same as the student
  page); otherwise 404.

### PDF — `/payments/[id]/receipt/pdf`

- Same access. Downloads `chek-<id>.pdf`, one page sized to the paper width (80 or 58 mm) and the receipt's height,
  drawn with **pdf-lib** (new dependency) using its built-in Courier font and the logo (PNG/JPG).

## Where it appears

- **After saving a payment** (the payment dialog on the student and group pages): instead of closing, it shows
  "To'lov saqlandi — 200 000 so'm" with **Chek chiqarish** (opens the print page in a new tab with `?print=1`),
  **PDF yuklab olish** and **Yopish**. `createPayment` returns the new payment's id for this.
- **Reprint:** a 🧾 button on every payment row on `/payments` and on the student's payment history opens the print
  page (no auto-print).
- **Find by receipt number:** a "Chek №" box on `/payments`; entering a number opens that receipt (or says "Chek
  topilmadi" when there's no such payment or the user can't see it).

## Testing

- Unit (`receipt.test.ts`): defaults when nothing is stored and when stored JSON is broken or partial; hidden lines
  are left out and Summa can't be hidden; month label present / absent; method in words; no group → teacher and group
  "—"; no taker → Mas'ul "—"; 58 vs 80 mm character width (lines fit: long names wrap or cut, never overflow); logo
  validation (type, size, SVG refused).
- Browser: settings form with live preview (type, tick, upload a logo, save); a payment → "Chek chiqarish" opens the
  print page; PDF downloads and opens; reprint from the list and the student page; "Chek №" lookup; a user without
  payment access gets 404; dark mode app, receipt still black on white; phone width.

## Not included

Printing without the print window (ESC/POS), printing several receipts at once, debt after payment, receipts for
salary payouts or expenses.
