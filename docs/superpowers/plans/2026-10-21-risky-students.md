# Risky Students ("Xavfli o'quvchilar") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/risk` report of active/trial students who keep missing lessons, whose attendance or grades are slipping or who failed a level exam, with "Bog'lanildi" contact records, editable limits, export, sidebar badge and dashboard card.

**Architecture:** Pure rules in `src/lib/risk.ts` turn one membership's facts (marks, grades, level-exam results) into reasons with trigger dates; a server loader (`src/lib/lists/risk.ts`) gathers the facts in one pass, applies filters/tabs and builds the export table. Contacts are a new `RiskContact` table; limits are JSON in the existing `Setting` table (key `risk`).

**Tech Stack:** Next.js 15 App Router (server components + server actions), Prisma 6 / SQLite (`db push`), zod 4, node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-10-21-risky-students-design.md`

## Global Constraints

- Only memberships with status `ACTIVE` or `TRIAL` are checked; frozen / left skipped; each group separately.
- Late marks are `present = true` rows — they count as present. Only existing attendance rows count; marks dated after today are ignored.
- "Last N days" = the N centre days ending today, inclusive (`centreDay()` from `src/lib/membership-db.ts`); the previous period is the N days before that.
- Defaults: streak 2 (1–10), attendance 70 % (1–100), days 30 (7–120), min marked lessons 4 (1–30), low grade 3.5 (1–5, one decimal), grade drop 1.0 (0.1–4, one decimal), min grades 3 (1–20).
- Labels, exactly: `${n} marta ketma-ket kelmadi`, `Davomat ${pct}% (${days} kun)`, `O'rtacha baho ${avg.toFixed(1)}`, `Baho tushdi: ${prev.toFixed(1)} → ${cur.toFixed(1)}`, `${level}-daraja imtihoni: ${score}/${maxScore}`.
- Contact results: `RETURNING` "Qaytadi", `LEAVING` "Ketmoqchi", `NO_ANSWER` "Javob bermadi", `OTHER` "Boshqa"; comment ≤ 500.
- Contacted ⇔ newest contact's centre day ≥ newest trigger date of all the student's current reasons.
- Permission `risk.view` — label "Xavfli o'quvchilar: ko'rish va bog'lanishni belgilash", in the O'quvchilar permission group. Limits page uses `staff.manage`.
- Every new server action returns `ActionState` via `tryAction` (src/lib/action-result.ts) and checks permission first; forms use `ActionForm`.
- Colours only via theme tokens (`npm run check:colors`). Stop the dev server before `npm run db:push` (Windows DLL lock).

## Review Focus

1. A student risky in one group but fine in another — the row lists only the risky group; the group filter must not show the fine group. (Task 3 test via `filterRows`.)
2. Attendance rows dated after today (left from before future marks were refused) must not create or extend a streak. (Task 1 test.)
3. A trial student with no marks or grades yet — no reasons, never on the list. (Task 1 test.)
4. Two level exams where the later one is not scored yet — the latest *scored* one decides. (Task 1 test.)
5. Junk or out-of-range values in the stored `risk` setting or the settings form — per-field fallback / inline error, never a crash. (Task 1 parse test; Task 2 form refusal checked in the browser.)

---

## File Structure

- Create `src/lib/risk.ts` — settings type/defaults/parser/zod schema, reasons per membership, contacted rule, result labels, filter kinds. Pure.
- Create `src/lib/risk.test.ts`.
- Create `src/lib/risk-db.ts` — `getRiskSettings()`, `storeRiskSettings()`.
- Create `src/lib/lists/risk.ts` — `loadRisk(params)`, `countOpenRisk()`, `filterRows()` (pure, exported for tests).
- Create `src/lib/risk-filter.test.ts`.
- Create `src/app/(app)/risk/page.tsx`, `src/app/(app)/risk/export/route.ts`, `src/components/RiskContactForm.tsx`.
- Create `src/app/(app)/settings/risk/page.tsx`.
- Modify `prisma/schema.prisma` (RiskContact + back-relations), `src/lib/permissions.ts`, `src/lib/audit.ts`, `src/app/(app)/actions.ts`, `src/app/(app)/settings/layout.tsx`, `src/lib/nav.ts`, `src/components/Sidebar.tsx`, `src/components/nav/PhoneNav.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, `README.md` (production note).

---

### Task 1: Risk rules (pure)

**Files:**
- Create: `src/lib/risk.ts`
- Test: `src/lib/risk.test.ts`

**Interfaces:**
- Produces:
  - `type RiskSettings = { streak: number; ratePercent: number; days: number; minLessons: number; lowGrade: number; gradeDrop: number; minGrades: number }`
  - `const RISK_DEFAULTS: RiskSettings` (values from Global Constraints)
  - `parseRiskSettings(json: string | null): RiskSettings` — per-field fallback when missing, non-numeric or out of range
  - `riskSettingsSchema` — zod object for the settings form (fields named as in `RiskSettings`, coerced numbers, ranges from Global Constraints, Uzbek messages)
  - `type RiskKind = "streak" | "attendance" | "grades" | "exam"`; `const RISK_KINDS: Record<RiskKind, string> = { streak: "Ketma-ket", attendance: "Davomat", grades: "Baho", exam: "Imtihon" }` (falling grades use kind `"grades"`)
  - `type Reason = { kind: RiskKind; label: string; trigger: Date }`
  - `type MembershipFacts = { marks: { date: Date; present: boolean }[]; grades: { date: Date; score: number }[]; levelExams: { date: Date; level: number; maxScore: number; score: number | null }[]; passPercent: number }` (arrays in any order; dates are UTC-midnight centre days)
  - `membershipReasons(f: MembershipFacts, s: RiskSettings, today: Date): Reason[]` — order: streak, attendance, low grades, falling, exam
  - `newestTrigger(reasons: Reason[]): Date | null`
  - `isContacted(reasons: Reason[], contactDay: Date | null): boolean`
  - `const CONTACT_RESULTS = { RETURNING: "Qaytadi", LEAVING: "Ketmoqchi", NO_ANSWER: "Javob bermadi", OTHER: "Boshqa" } as const`

- [ ] **Step 1: Write the failing tests** in `src/lib/risk.test.ts`. Helpers: `const d = (s: string) => new Date(s + "T00:00:00Z")`, `today = d("2026-10-21")`, `S = RISK_DEFAULTS`, `facts(partial)` filling empty arrays and `passPercent: 60`; assertions pick reasons by `kind` (several may apply at once). Tests (names and assertions):
  - `streak: two absences in a row are risky, a present (or late) mark breaks the run` — marks 10-15 P, 10-17 A, 10-20 A → one reason `{ kind: "streak", label: "2 marta ketma-ket kelmadi", trigger: d("2026-10-20") }`; marks …A, P(10-20) → no streak reason; single newest absence → none.
  - `streak: marks after today are ignored` — 10-17 A, 10-20 A, 10-23 P → streak reason still present (trigger 10-20).
  - `attendance: under the limit with enough marked lessons` — in the last 30 days 2 present + 3 absent (5 marked) → reason label `Davomat 40% (30 kun)`, trigger = newest absence in the window; with only 3 marked lessons → no attendance reason; 3 present of 4 (75 %) → none; marks older than 30 days (e.g. 2026-09-20) don't count.
  - `low grades: average under the limit needs enough grades` — grades 3,3,4 in window → `O'rtacha baho 3.3`, trigger = newest grade below 3.5; grades 3,3 only → none; 4,4,4 → none.
  - `falling grades: drop of at least the limit against the previous period` — previous period (2026-08-23…2026-09-21) 5,5,4 (avg 4.7), last 30 days 4,4,3 (avg 3.7) → reason label `Baho tushdi: 4.7 → 3.7`, kind `"grades"`, trigger = newest grade in window; drop 0.6 → none; previous period with 2 grades → none.
  - `level exam: the latest scored level exam decides` — level 1 failed (45/100, 2026-09-10) then level 2 passed (70/100, 2026-10-10) → no exam reason; level 1 passed then level 2 failed 45/100 → `2-daraja imtihoni: 45/100`, trigger = its date; level 2 not scored (`score: null`) after a failed level 1 → level-1 reason stays.
  - `a trial student with no marks, grades or exams has no reasons` → `[]`.
  - `contacted: a call on or after the newest trigger covers the student; a newer problem reopens` — reasons with triggers 10-15 and 10-20: contact 10-20 → true; contact 10-19 → false; null → false; empty reasons → true.
  - `settings: defaults, per-field fallback for junk and out-of-range values` — `parseRiskSettings(null)` deep-equals RISK_DEFAULTS; `parseRiskSettings('{"streak":3,"ratePercent":500,"lowGrade":"x"}')` → streak 3, ratePercent 70, lowGrade 3.5; `parseRiskSettings("not json")` → defaults.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test src/lib/risk.test.ts`
Expected: FAIL — cannot find module `./risk`.

- [ ] **Step 3: Implement `src/lib/risk.ts`** with the Interfaces above. Window = `[today − (days−1), today]`, previous = `[today − (2·days−1), today − days]`; drop everything after `today` first. Streak = count of absences from the newest mark backwards until a present mark. Rate rounded with `Math.round`. Averages compared unrounded with a 1e-9 tolerance (a drop of exactly 1.0 must count), shown with `toFixed(1)`. Latest scored exam = max date among `score !== null` (tie → higher level); failure via `passed()` from `src/lib/curriculum.ts`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx tsx --test src/lib/risk.test.ts`
Expected: PASS, 9/9.

- [ ] **Step 5: Commit**

```bash
git add src/lib/risk.ts src/lib/risk.test.ts
git commit -m "feat(risk): rules for risky students"
```

---

### Task 2: Data, permission and the limits tab

**Files:**
- Modify: `prisma/schema.prisma`, `src/lib/permissions.ts`, `src/lib/audit.ts`, `src/app/(app)/actions.ts`, `src/app/(app)/settings/layout.tsx`
- Create: `src/lib/risk-db.ts`, `src/app/(app)/settings/risk/page.tsx`

**Interfaces:**
- Consumes: `RiskSettings`, `RISK_DEFAULTS`, `parseRiskSettings`, `riskSettingsSchema` (Task 1).
- Produces:
  - Prisma model `RiskContact { id Int @id @default(autoincrement()); studentId Int; student Student @relation(onDelete: Cascade); userId Int?; user User? @relation(onDelete: SetNull); result String; comment String?; createdAt DateTime @default(now()); @@index([studentId]) }` + `riskContacts RiskContact[]` on Student and User.
  - `getRiskSettings(): Promise<RiskSettings>`, `storeRiskSettings(s: RiskSettings): Promise<void>` in `src/lib/risk-db.ts` (key `"risk"`, mirror `src/lib/receipt-db.ts`).
  - Server action `saveRiskSettings(_: ActionState, f: FormData): Promise<ActionState>` — `requirePermission("staff.manage")`, `parseForm(riskSettingsSchema, f)`, store, `logAction(user, "risk.settings", "Xavfli o'quvchilar chegaralari o'zgartirildi")`, `revalidatePath("/risk")` and `"/settings/risk"`.
  - Permission key `risk.view` (label in Global Constraints) added to the O'quvchilar group after `students.discount`; `AUDIT_AREAS.risk = "Xavfli o'quvchilar"`.

- [ ] **Step 1: Write the failing test** — append to `src/lib/risk.test.ts`: `test("the risk permission exists for roles", …)` asserting `ALL_PERMISSIONS.includes("risk.view")` (import from `./permissions`).
- [ ] **Step 2: Run it** — `npx tsx --test src/lib/risk.test.ts` → FAIL on that test.
- [ ] **Step 3: Implement** the permission and audit area; schema model; stop the dev server, run `npm run db:push`; `risk-db.ts`; `saveRiskSettings`; the tab "Xavfli o'quvchilar" (`/settings/risk`) in the `staff.manage` list of `settings/layout.tsx`; the page: `requirePage("staff.manage")`, an `ActionForm` with the seven number inputs (labels: "Ketma-ket qoldirilgan darslar", "Davomat chegarasi (%)", "Davr (kun)", "Kamida belgilangan darslar", "Past o'rtacha baho", "Baho tushishi", "Kamida baholar soni"; `step="0.1"` on the two decimals), default values from `getRiskSettings()`, a short muted line under each explaining it.
- [ ] **Step 4: Verify** — `npx tsx --test src/lib/risk.test.ts` → PASS; `npm run lint` → no errors; `npm run check:colors` → "No hard-coded colours."
- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/permissions.ts src/lib/audit.ts src/lib/risk-db.ts "src/app/(app)/actions.ts" "src/app/(app)/settings" src/lib/risk.test.ts
git commit -m "feat(risk): contact table, permission and limits tab"
```

---

### Task 3: Loader, report page, contacts and export

**Files:**
- Create: `src/lib/lists/risk.ts`, `src/lib/risk-filter.test.ts`, `src/app/(app)/risk/page.tsx`, `src/app/(app)/risk/export/route.ts`, `src/components/RiskContactForm.tsx`
- Modify: `src/app/(app)/actions.ts`

**Interfaces:**
- Consumes: Task 1 (`membershipReasons`, `isContacted`, `newestTrigger`, `RISK_KINDS`, `CONTACT_RESULTS`), Task 2 (`getRiskSettings`, `RiskContact`), `centreDay`, `respondTable`/`Table`, `passed`.
- Produces:
  - `type RiskGroup = { id: number; name: string; teacherId: number | null; teacher: string | null; reasons: Reason[] }`
  - `type RiskRow = { student: { id: number; name: string; phone: string; parentPhone: string | null }; groups: RiskGroup[]; contact: { at: Date; who: string | null; result: keyof typeof CONTACT_RESULTS; comment: string | null } | null; contacted: boolean; newest: Date }`
  - `filterRows(rows: RiskRow[], p: { tab?: string; group?: string; teacher?: string; kind?: string }): RiskRow[]` — pure; tab `open` (default) / `done` / `all`; group/teacher/kind keep only matching groups (and reasons, for kind) and drop rows left with none; sort: more reasons first, then newer `newest` first.
  - `loadRisk(params: Record<string, string | undefined>): Promise<{ rows: RiskRow[]; counts: { open: number; done: number; all: number }; table: Table; groups: { id: number; name: string }[]; teachers: { id: number; name: string }[] }>` — counts are after group/teacher/kind filters, before the tab.
  - `countOpenRisk(): Promise<number>`
  - Server action `recordRiskContact(studentId: number, _: ActionState, f: FormData): Promise<ActionState>` — `requirePermission("risk.view")`; result ∈ CONTACT_RESULTS (message "Natijani tanlang"), comment `v.optText(500)`; create row; `logAction(user, "risk.contact", \`Bog'lanildi (xavfli o'quvchi): ${CONTACT_RESULTS[result]}${comment ? \` — ${comment}\` : ""}\`, { studentId })`; `revalidatePath("/risk")`.

- [ ] **Step 1: Write the failing tests** in `src/lib/risk-filter.test.ts` with two hand-made rows (A: groups G1 [streak] and G2 [exam], not contacted, newest 10-20; B: group G1 [attendance], contacted, newest 10-18):
  - `tabs: open by default, done, all` — default → [A]; `tab: "done"` → [B]; `tab: "all"` → [A, B] (A first: more reasons).
  - `group filter keeps only that group's entry` — `group: "G2 id"` → [A] with `groups.length === 1` and only the exam reason.
  - `kind filter keeps matching reasons only` — `kind: "attendance", tab: "all"` → [B]; `kind: "bogus"` ignored → same as no kind.
  - `teacher filter` — rows whose groups have that `teacherId` only.
- [ ] **Step 2: Run** — `npx tsx --test src/lib/risk-filter.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement `filterRows`, then `loadRisk` / `countOpenRisk`** in `src/lib/lists/risk.ts` (`import "server-only"` — keep `filterRows` free of db imports by placing the db part below it; if `server-only` blocks the test import, move `filterRows` and the row types into `src/lib/risk.ts` and ledger it). Queries: `groupStudent` with `status in ["ACTIVE","TRIAL"]` including student (id, name, phone, parentPhone), group (id, name, teacherId, teacher name, course.passPercent); attendance and grades for those group/student pairs with `date ≥ today − (2·days − 1)` — except attendance needs the full newest run: also load each pair's newest 10 marks regardless of date (streak max is 10); level exams (`level not null`) of those groups with the student's results; newest `riskContact` per student with user name. Build `MembershipFacts` per membership, keep memberships with reasons, merge by student, `contacted = isContacted(allReasons, centreDay(contact.createdAt))`. Table title "Xavfli o'quvchilar", columns `["O'quvchi", "Telefon", "Ota-ona telefoni", "Guruh", "O'qituvchi", "Sabablar", "Oxirgi aloqa", "Natija", "Izoh"]`, one line per student×group, reasons joined with "; ", contact date via `fmtDate`.
- [ ] **Step 4: Implement the page, export route, contact form and action.**
  - `/risk/page.tsx`: `requirePage("risk.view")`; `PageHeader` "Xavfli o'quvchilar" with `ExportButtons href="/risk/export"` (carry current params); tabs as links "Bog'lanilmagan · N", "Bog'lanilgan · N", "Hammasi · N"; a GET filter form (group, teacher, reason type selects + "Ko'rsatish"); a card list: student link to `/students/{id}`, phones, per group "name · teacher" with reason chips (`badge bg-danger-tint text-danger`), last contact line (`date · who · result` and comment muted) or "—", and a `Modal` "Bog'lanildi" (`triggerClassName="btn-secondary"`) containing `<RiskContactForm studentId=… />`. Empty: `Empty` "Xavfli o'quvchilar yo'q" (all tab / no filters) or "Hammasi bilan bog'lanilgan" (open tab).
  - `RiskContactForm` (client): `ActionForm action={recordRiskContact.bind(null, studentId)}` with result radio buttons (the four labels, required) and `textarea name="comment" maxLength={500}`; submit text "Saqlash".
  - `/risk/export/route.ts`: same shape as `src/app/(app)/debtors/export/route.ts`, permission `risk.view`, `loadRisk(params).table`.
- [ ] **Step 5: Verify** — `npx tsx --test src/lib/risk-filter.test.ts` → PASS 4/4; `npm test` → all pass; `npm run lint`; `npm run check:colors`.
- [ ] **Step 6: Commit**

```bash
git add src/lib/lists/risk.ts src/lib/risk-filter.test.ts "src/app/(app)/risk" src/components/RiskContactForm.tsx "src/app/(app)/actions.ts"
git commit -m "feat(risk): report page, contacts and export"
```

---

### Task 4: Sidebar badge, dashboard card, README, browser check

**Files:**
- Modify: `src/lib/nav.ts`, `src/components/Sidebar.tsx`, `src/components/nav/PhoneNav.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, `README.md`, `src/lib/nav.test.ts`

**Interfaces:**
- Consumes: `countOpenRisk()` (Task 3).
- Produces: NAV item `{ href: "/risk", label: "Xavfli o'quvchilar", icon: ShieldAlert, perm: "risk.view" }`, placed in the O'quv section right after `/students`; `Sidebar` and `PhoneNav` take `badges?: Record<string, number>` and show a small count pill (`bg-danger text-page`, hidden at 0) after the label of the matching href.

- [ ] **Step 1: Write the failing test** — in `src/lib/nav.test.ts`: `test("risky students sit after O'quvchilar for risk.view", …)`: `navSections(["students.view", "risk.view"])` O'quv section hrefs equal `["/students", "/risk"]`; without `risk.view` → `["/students"]`.
- [ ] **Step 2: Run** — `npx tsx --test src/lib/nav.test.ts` → FAIL.
- [ ] **Step 3: Implement** the nav item, `badges` prop on Sidebar/PhoneNav, the layout computing `{ "/risk": await countOpenRisk() }` only when `user.permissions.has("risk.view")`, the dashboard `StatCard label="Xavfli o'quvchilar" value={n} icon={<ShieldAlert />} tone="amber" href="/risk"` shown with `risk.view` (value = not-contacted count), and a README production note: `npm run db:push`, then tick "Xavfli o'quvchilar" for Menejer.
- [ ] **Step 4: Verify** — `npx tsx --test src/lib/nav.test.ts` → PASS; `npm test`, `npm run lint`, `npm run check:colors` clean. Browser (dev server, admin 901234567): `/risk` shows reasons from seed data; tabs/filters change the list; "Bog'lanildi" with "Qaytadi" moves the student to "Bog'lanilgan" and the entry appears in the student's Tarix tab; changing "Ketma-ket qoldirilgan darslar" in `/settings/risk` changes the list; an invalid value (e.g. 0) shows an inline error; export downloads; the sidebar badge and dashboard card match the open count; a role without `risk.view` (teacher Aziz 930000000) gets the no-access page on `/risk` and no sidebar item. Delete any contacts created during the check.
- [ ] **Step 5: Commit**

```bash
git add src/lib/nav.ts src/lib/nav.test.ts src/components/Sidebar.tsx src/components/nav/PhoneNav.tsx "src/app/(app)/layout.tsx" "src/app/(app)/page.tsx" README.md
git commit -m "feat(risk): sidebar badge, dashboard card and README"
```
