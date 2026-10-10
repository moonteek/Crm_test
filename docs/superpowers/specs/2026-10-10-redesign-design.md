# Algoritm CRM redesign — "Ink and amber", Nothing-inspired

Date: 2026-10-10
Status: approved direction, awaiting spec review

## 1. Goal

Replace the current look (navy sidebar, blue buttons, grey pages, Inter) with a new visual identity built
on the Algoritm logo, in the calm, monochrome, "smooth" style of Nothing products, with full light and dark
modes and a first-class phone experience.

Success means:

- The CRM is instantly recognisable as Algoritm (logo colours and mark everywhere).
- It feels smooth: gentle page and dialog motion, soft press feedback, no jarring jumps.
- Every page works in light and dark, and on a phone as well as on a desktop.
- Nothing about what the CRM *does* changes.

## 2. What the user said vs. what is assumed

Said by the user:

- Choose direction A, "ink and amber": warm off-white pages, black and amber as the brand pair, amber for
  the main action.
- Add a dark mode.
- "Smooth feeling design like Nothing products."
- The design must be something new, not modelled on their previous CRM.
- Users: office staff on desktop all day; teachers mostly on phones; students may use a phone app later.
- Approved the mockup with dot-matrix numbers, monospace labels, dot-grid background, pill buttons and a
  floating pill tab bar on phones.

Assumed (correct me in review):

- Functionality, permissions, routes, and Uzbek copy stay exactly as they are. This is a visual redesign.
- A student-facing app is a separate future project, not part of this work.
- The provided logo PNG (amber `#FFBE00` triangle with a pencil, black `ALGORITM` wordmark) is the final logo.

## 3. Brand and design language

### Colour

Two brand colours plus neutrals. Amber is the only chromatic accent in the UI chrome.

| Role | Light | Dark |
| --- | --- | --- |
| Page background | `#F4F2EE` warm off-white | `#000000` true black |
| Surface (cards, sidebar) | `#FFFFFF` | `#0E0E0E` |
| Raised surface (rows, inputs) | `#FFFFFF` | `#141414` |
| Ink (primary text) | `#161817` | `#EDEBE6` |
| Muted text | `#77736B` | `#8A8780` |
| Faint text / labels | `#8A867E` | `#77736B` |
| Hairline border | `#E4E1DA` | `#262626` |
| Accent (amber) | `#FFBE00` | `#FFBE00` |
| Text on accent | `#161817` | `#161817` |
| Accent tint (badges, highlights) | `#FFF1C2` with `#7A5A00` text | `#2A2000` with `#FFD34D` text |
| Navigation | white sidebar, ink (`#161817`) active pill | `#0E0E0E` sidebar, amber active pill |
| Hero stat card | ink card, amber number | amber card, ink number |

Rules:

- Amber is used as a **fill with black text**, never as text on white (fails contrast). In dark mode amber
  may be used as text/numbers on black.
- Status colours stay, but muted to fit the palette: success (green), danger (red), warning (amber tint).
  They appear only where they carry meaning (debt, paid, failed, clash).
- At most one amber-filled button per view; other buttons are outline or ghost.

### Typography

- **Outfit** (geometric, matches the wordmark) for all UI text. Weights 400, 500, 600.
- **Doto** (dot matrix) only for display numbers: stat cards, lesson times on the timetable and phone
  "today" card, big totals. Never for body text or tables.
- **JetBrains Mono**, small uppercase with wide tracking, for labels and metadata (dates, column headers,
  stat labels).
- All loaded via `next/font/google` (self-hosted, no layout shift), replacing the Google Fonts `<link>`.

### Shapes and texture

- Pill-shaped buttons, nav items, and badges; 12–14px radius cards; hairline (0.5–1px) borders; no heavy
  shadows.
- A faint dot-grid background on the main content area (CSS `radial-gradient`), lighter than the content so it
  never competes with it.
- Progress and counts may be shown as dot rows (Glyph-style), e.g. attendance, lesson progress.

### Logo

- Add the provided PNG to `public/brand/` and recreate the mark (triangle + pencil) as an SVG component
  `<LogoMark />` so it is crisp at any size and can be recoloured for dark backgrounds.
- Wordmark set in Outfit 600 uppercase next to the mark (`<Logo />`), used in the sidebar, login page, and
  phone header.
- Replace `src/app/icon.svg` (favicon) with the amber mark.

## 4. Motion ("smooth")

All motion is short (150–250 ms), eased (`cubic-bezier(.2,.8,.2,1)`), and disabled under
`prefers-reduced-motion: reduce`.

- **Page enter:** content fades in and rises ~6px on each navigation, via an `(app)/template.tsx` wrapper
  (re-mounts per route, no library needed).
- **Dialogs:** backdrop fades; panel scales from 0.98 and fades on desktop; on phones it becomes a bottom
  sheet that slides up.
- **Phone menu:** full navigation opens as a bottom sheet from the tab bar's menu button.
- **Buttons and cards:** hover colour transitions; press scales to 0.98 and springs back.
- **Theme switch:** colours cross-fade (transition on background/colour/border tokens).

## 5. Dark mode

- Three settings: Light, Dark, Auto (follows the device). Default: Auto.
- Stored per browser in a `theme` cookie so the server renders the right theme on first paint, with no
  flash. Auto uses `prefers-color-scheme`.
- Toggle in the sidebar footer (desktop) and in the phone menu sheet.

## 6. Layout

### Desktop (≥ 1024px)

- Fixed left sidebar (white with a hairline edge in light mode, near-black in dark), logo at top, nav items
  as pills (ink pill for active in light, amber pill in dark), user + theme toggle + logout at the bottom.
  This follows the approved Nothing-style mockup, which replaced direction A's all-black sidebar.
- Content area on the dot-grid page background, max readable width for forms, full width for tables and
  timetable.
- Page header: small mono date/context label above a 600-weight title, actions on the right.

### Tablet (768–1023px)

- Same as desktop with a collapsible sidebar (icon rail).

### Phone (< 768px)

- Compact top bar: logo mark + page title.
- **Floating pill tab bar** at the bottom with four slots: the three most-used pages the user is allowed to
  see, from the priority list Bosh sahifa → Dars jadvali → Guruhlar → O'quvchilar → Lidlar → To'lovlar, plus
  a Menu button that opens the full navigation sheet. A teacher therefore gets Home, Timetable, Groups.
- Tables become stacked cards where a table would scroll sideways (students, payments, debtors, leads).
- Primary page action becomes a full-width amber pill or stays in the header, whichever fits the page.

## 7. Technical approach

### Semantic colour tokens (the core change)

Today about 500 class usages hard-code colours (`text-slate-500`, `bg-brand-600`, `bg-sidebar`, …). These
cannot change in dark mode. The redesign introduces semantic tokens in `globals.css` and migrates every
usage to them.

- Define CSS variables on `:root` (light) and `[data-theme="dark"]` / `prefers-color-scheme` (dark), then
  expose them to Tailwind v4 through `@theme inline`, giving utilities such as:
  `bg-page`, `bg-surface`, `bg-raised`, `bg-nav`, `text-ink`, `text-muted`, `text-faint`, `border-line`,
  `bg-accent`, `text-on-accent`, `bg-accent-tint`, `text-accent-ink`, and status pairs
  `bg-success-tint`/`text-success`, `bg-danger-tint`/`text-danger`, `bg-warning-tint`/`text-warning`.
- Update the shared utilities (`input`, `label`, `btn-primary`, `btn-secondary`, `btn-danger`, `card`,
  `badge`, `.table`) to the new tokens and shapes; add `btn-ghost` and `label-mono`.
- Replace `brand-*` / `slate-*` / raw status colours in every page and component with semantic tokens.
  `LEVEL_TONES` in `ui.tsx` moves to tokens too (levels shown as outline pills with an amber dot, not six
  different hues, to keep the monochrome look).
- After migration, no `slate-*`, `brand-*`, `sidebar`, `rose-*`, `emerald-*`, `sky-*`, `amber-*` classes
  remain (checked with a grep in testing).

### New / changed building blocks

- `src/components/brand/Logo.tsx`: `LogoMark`, `Logo`.
- `src/components/ThemeToggle.tsx`: client component, writes the cookie, updates `data-theme`.
- `src/components/Sidebar.tsx`: restyled desktop sidebar plus the phone top bar, tab bar, and menu sheet.
- `src/components/Modal.tsx`: animated dialog that becomes a bottom sheet on phones.
- `src/components/ui.tsx`: `PageHeader` (mono context label), `StatCard` (Doto number), `Empty`, `LevelBadge`,
  new `DotMeter` (Glyph-style dot progress).
- `src/components/charts/*`: series colours from tokens (amber, ink, muted), gridlines from `border-line`, both
  themes.
- `src/app/layout.tsx`: fonts via `next/font`, reads the `theme` cookie and sets `data-theme` on `<html>`.
- `src/app/(app)/template.tsx`: page-enter animation.
- `src/app/login/*`: redesigned login (ink panel with logo and dot-grid, amber sign-in button).

No new runtime dependencies.

## 8. Rollout order

1. **Foundation:** tokens, fonts, shared utilities, logo, theme cookie and toggle, motion primitives.
2. **Shell:** sidebar, phone top bar and tab bar, menu sheet, modal/sheet, page template, login.
3. **Checkpoint page — dashboard:** fully redesigned in both themes and on phone. **The user approves this
   before the rest is converted.**
4. **Remaining pages in batches:** timetable and groups; students and leads; payments, debtors, finance,
   salaries, shop; analytics and sales (charts); teachers, courses, rooms, activity; settings.
5. **Sweep:** grep for leftover hard-coded colours, contrast check, reduced-motion check.

Work happens on the `redesign` branch and lands as one PR (or one PR per stage if the user prefers).

## 9. Testing

- `npm run lint` (tsc) passes after each stage.
- Every page checked in the browser pane in light and dark, at desktop (1280px) and phone (375px) widths,
  logged in as admin and as a teacher (to check the teacher tab bar and permission-filtered navigation).
- Contrast: body and muted text ≥ 4.5:1 on their backgrounds in both themes; amber only behind black text.
- Reduced motion: with `prefers-reduced-motion` emulated, no animations run.
- Theme: Auto follows the device; Light/Dark persist across reloads with no flash of the wrong theme.
- Leftover-colour grep returns nothing.

## 10. Out of scope

- New features or changes to data, permissions, or routes.
- A student app or student portal.
- Translating the UI or changing copy (beyond labels moved into mono style).
- Copying the user's previous CRM's design.
