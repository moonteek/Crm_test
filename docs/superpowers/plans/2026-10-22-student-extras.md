# Student Extras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Father/mother contacts, Telegram/email and extra-info icons on the student form, student documents, tags in the add form, a richer payments ledger, and "Guruhda saqlab qolish" on transfer.

**Architecture:** Pure rules first (`src/lib/student-contacts.ts`, `src/lib/documents.ts`, `src/lib/statement.ts`, `src/lib/membership.ts` transfer helper), then schema + actions in `src/app/(app)/actions.ts`, then the screens. Documents are stored in a new table and served by a route handler with the same permission check.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma 6 / SQLite, zod 4, node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-10-22-student-extras-design.md`

## Global Constraints

- Legacy `Student.parentName` / `parentPhone` stay in the schema, never written or read by app code after Task 1 (only `db:parents`).
- Telegram `^@?[A-Za-z0-9_]{5,32}$`, stored without "@", message "Telegram username noto'g'ri"; email `^[^\s@]+@[^\s@]+\.[^\s@]+$` ≤ 120, "Email noto'g'ri".
- Documents: PDF (`%PDF-`), PNG (`89 50 4E 47 0D 0A 1A 0A`), JPEG (`FF D8 FF`); ≤ 2 MB decoded; ≤ 30 per student; name ≤ 80; messages "Faqat PDF, JPG yoki PNG, 2 MB gacha", "Ko'pi bilan 30 ta hujjat". Visible/usable only with `students.manage`; never exported or in MCP.
- Ledger filter keys: `all` (Hammasi), `payments` (To'lovlar), `CASH`/`CARD`/`TRANSFER` (Naqd/Karta/O'tkazma — the PAYMENT_METHODS keys in `src/lib/format.ts`), `charges` (Hisoblar), `events` (Amallar). Balance computed before filtering.
- Row words: "To'lov", "Oylik hisob", event labels from `EVENT_LABEL`; transfers "Boshqa guruhga o'tkazildi" / "O'tkazma bilan qo'shildi"; charges' "Hodim" = "Tizim".
- New actions: `tryAction`, permission first, inline errors; colours via tokens; stop the dev server before `db:push`.

## Review Focus

1. A student created before the change (only legacy parent fields) before `db:parents` runs — card/search/export show nothing for parents but never crash; after it runs, values appear as "Otasi". (Task 1 planner test + browser.)
2. A file renamed to `.pdf` that is really something else, or a 2 MB+1 byte file — refused on the server even if the browser check is bypassed. (Task 2 tests.)
3. A teacher (no `students.manage`) requesting a document URL directly — 403/404, no bytes. (Task 2 browser.)
4. The ledger filtered to "Naqd" — the balance column still equals the full-ledger running balance on those rows. (Task 3 test.)
5. Transfer with "keep" into a group the student already left earlier (LEFT membership) — restarts there like today's re-add; without "keep" behaviour unchanged. (Task 4 test on the pure helper + browser.)

---

### Task 1: Parents, Telegram, email, icons, search and lists

**Files:** Create `src/lib/student-contacts.ts`, `src/lib/student-contacts.test.ts`, `prisma/parents.ts`; Modify `prisma/schema.prisma`, `package.json` (`db:parents`), `src/app/(app)/actions.ts` (`studentSchema`), `src/components/forms.tsx` (StudentFields → client icon row), `src/app/(app)/students/[id]/page.tsx` (card), `src/lib/search.ts`, `src/lib/student-filters.ts`, `src/lib/lists/students.ts`, `src/lib/lists/debtors.ts`, `src/app/(app)/debtors/page.tsx`, `src/lib/lists/risk.ts`, `src/lib/risk.ts` (row type), `src/app/(app)/risk/page.tsx`, `src/lib/mcp/tools.ts`.

**Interfaces — Produces:** `telegramField`, `emailField` (zod, in `student-contacts.ts`); `planParents(rows: { id: number; parentName: string | null; parentPhone: string | null; fatherName: string | null; fatherPhone: string | null }[]): { id: number; fatherName: string | null; fatherPhone: string | null }[]`; `parentPhones(s: { fatherPhone: string | null; motherPhone: string | null }): string` ("Otasi: …, Onasi: …" joined, empty parts skipped). Schema: `Student.fatherName/fatherPhone/motherName/motherPhone/telegram/email String?`.

- [ ] **Step 1: Failing tests** `student-contacts.test.ts`: `telegram: @ removed, bad usernames refused` ("@aziz_k" → "aziz_k"; "ab" and "has space" → message; "" → null); `email: simple shape` ("a@b.uz" ok, "a@b" → message, "" → null); `parents: legacy values move into Otasi only when Otasi is empty` (row with legacy and empty father → planned; row with father set → skipped; row with nothing → skipped); `parentPhones` formats.
- [ ] **Step 2: Run** `npx tsx --test src/lib/student-contacts.test.ts` → FAIL.
- [ ] **Step 3: Implement** pure module; schema; `npm run db:push`; `prisma/parents.ts` + script; `studentSchema` fields `fatherName, fatherPhone, motherName, motherPhone, telegram, email` (remove `parentName/parentPhone`); StudentFields: Otasi/Onasi rows, icon buttons (Telegram, Email, Qo'shimcha telefon, Pasport/ID for `canManage`) each toggling its input (open when it has a value, dot marker, `aria-pressed`); card lines with tel:/t.me/mailto links; search + list filter OR on `fatherPhone`, `motherPhone`, `fatherName`, `motherName`; exports/debtors/risk/MCP use `parentPhones` or the two columns ("Otasi telefoni", "Onasi telefoni").
- [ ] **Step 4: Verify** tests PASS, `npm test`, `npm run lint`, `npm run db:parents` prints a count, second run 0.
- [ ] **Step 5: Commit** `feat(students): father and mother contacts, Telegram and email, extra-info icons`

### Task 2: Documents

**Files:** Create `src/lib/documents.ts`, `src/lib/documents.test.ts`, `src/app/(app)/students/[id]/documents/[docId]/route.ts`, `src/components/students/DocumentsPanel.tsx`; Modify `prisma/schema.prisma` (`StudentDocument`), `src/app/(app)/actions.ts` (`uploadDocument(studentId, _, f)`, `deleteDocument(id)`), `src/app/(app)/students/[id]/page.tsx` (tab "Hujjatlar" for `students.manage`).

**Interfaces — Produces:** `documentProblem(dataUrl: string, count: number): string | null`; `decodeDocument(dataUrl): { mime: string; ext: "pdf" | "png" | "jpg"; bytes: Buffer }`; route `GET /students/[id]/documents/[docId]?download=1`.

- [ ] **Step 1: Failing tests** — real PDF/PNG/JPEG headers accepted; text renamed as PDF refused; 2 MB + 1 byte refused; count 30 → "Ko'pi bilan 30 ta hujjat"; `decodeDocument` ext/mime.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** model + push, actions (`requirePermission("students.manage")`, `assertStudentAccess`, log `student.document` with studentId), route (same checks, headers from the spec), panel (name input, file input read as data URL, list with Ochish/Yuklab olish/O'chirish; client-side `documentProblem` before upload). **Step 4: Verify** tests, lint; **Step 5: Commit** `feat(students): documents tab`.

### Task 3: Ledger

**Files:** Modify `src/lib/statement.ts`, `src/lib/statement.test.ts`, `src/app/(app)/students/[id]/page.tsx` (query users + createdAt for payments/events, filter links, Hodim column, note line).

**Interfaces — Produces:** `StatementRow` + `type: string` (row word), `who: string | null`, `at: Date | null`, `note: string | null`, `method: string | null`; `statement()` inputs: payments gain `user: { name } | null`, `createdAt`; events gain `user`, `createdAt`, `groupId`; `filterLedger(rows, key: string): StatementRow[]`.

- [ ] **Step 1: Failing tests** — payment row `type "To'lov"`, `who`/`at`, note not in label; charge `type "Oylik hisob"`, `who "Tizim"`; a same-day LEAVE in group A + ACTIVATE in group B → "Boshqa guruhga o'tkazildi" / "O'tkazma bilan qo'shildi"; `filterLedger(rows, "CASH")` keeps cash payments with their original balances; unknown key → all.
- [ ] **Step 2–5:** run FAIL → implement → PASS + lint → commit `feat(students): ledger with row types, who/when, notes and a filter`.

### Task 4: Transfer "keep", tags on add, README, browser check

**Files:** Modify `src/lib/membership.ts` (`transferPlan(keep: boolean): ("LEAVE_OLD" | "START_NEW")[]`), its test, `src/app/(app)/actions.ts` (`transferStudent` reads `keep`; `createStudent` reads `tagIds` when `students.tags`), `src/components/members/MemberDialog.tsx` (tick box + preview note), `src/app/(app)/students/page.tsx` (tag chips in the add form), `README.md`.

- [ ] **Step 1: Failing test** — `transferPlan(false)` = ["LEAVE_OLD","START_NEW"]; `transferPlan(true)` = ["START_NEW"].
- [ ] **Step 2–3:** FAIL → implement (keep: skip the LEAVE event; log "Boshqa guruhga qo'shildi (eskisida qoldi)"; preview hides the old group's change when ticked).
- [ ] **Step 4: Verify** `npm test`, lint, colours; browser (admin): add a student with icons (Telegram, email), both parents and two tags; card links; search by mother's phone finds them; upload a PDF and a PNG, open, download, delete, a renamed .txt refused; teacher Aziz gets no tab and 404/403 on the file URL; ledger filter Naqd / Hisoblar / Amallar and Hodim column; transfer with and without keep. Clean up test data.
- [ ] **Step 5: Commit** `feat(students): transfer can keep the old group; tags when adding; README`.
