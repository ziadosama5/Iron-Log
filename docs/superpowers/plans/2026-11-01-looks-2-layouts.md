# Looks 2.0: real layouts for Carbon and Bloom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Tasks 1-5 are design tasks that end in an owner approval checkpoint; stop there and wait. No build task (6 onward) starts before Task 5 is approved.**

**Goal:** Give Carbon and Bloom their own, Apple-clean layouts for every screen (five tabs, their sections, all sheets, the look picker and the journey), keeping Classic untouched and every feature available in both looks.

**Architecture:** One shared engine (`state`, `store`, `data-act` handlers, `render*()` entry points). Each look supplies pure HTML builders in `public/looks/carbon.js` / `bloom.js` (lazy `import()`), dispatched through `layoutFor(look)` with fallback to the Classic builder, plus per-look CSS. A contract test keeps the features equal across looks.

**Tech Stack:** Plain ES modules, CSS custom properties, Node test runner, Playwright UI tests on the stubbed-Firebase harness, the Claude design canvas for M0.

**Spec:** `docs/superpowers/specs/2026-11-01-looks-2-layouts-design.md` (decisions: different layouts per look; every screen; per-screen content decided in design; design everything first; one deploy at the end).

## Global Constraints
- Branch `looks-2`. **Never deploy.** Classic markup, behaviour and tests stay unchanged; the look stays per device (`localStorage ironlog.look`); no Firestore, rules, backup or stored-data change.
- **Apple-clean design rules (owner's direction, binding for every design and build task):**
  - Clean, modern, simple: one idea per card, generous white space on an 8 pt grid, at most one accent colour per screen plus the fixed `--good`/`--danger`.
  - Typography: a neutral system stack first (`-apple-system, "SF Pro Text", system-ui, Inter, "IBM Plex Sans Arabic"`), a tight scale (large title 34/28, title 22, headline 17 semibold, body 16, caption 13, never below 12), weight for hierarchy, no all-caps headings, no condensed display faces. (The Oswald/Fraunces/DM Sans/Manrope faces of the first looks are re-decided in Task 1 and only kept if the owner approves them.)
  - Surfaces: neutral grouped lists with hairline separators, inset cards with 14-20 px continuous radii, shadows only on floating elements, translucent blurred top and bottom bars, no borders-on-borders, no gradients except one soft page wash per look.
  - Icons: one line-icon set (1.75 px stroke, SF-Symbols-like), no emoji, never colour alone for state.
  - Motion: 150-250 ms ease-out, nothing decorative, `prefers-reduced-motion` respected.
  - Carbon = dark-first, precise, data forward, monochrome with one vivid accent. Bloom = light-first, warm, airy, rounded. Both stay light/dark capable.
- Targets ≥ 44 px, text ≥ 12 px, contrast ≥ 4.5:1 (`theme-tools.js` checks the accents), logical CSS properties, Arabic/RTL in every screen, English text as the i18n key with an Arabic entry for every new string.
- Every `data-act` of a Classic screen exists in the same screen of each look, unless the owner removed it in design (listed in `docs/looks/<screen>.md` and the contract test's allow-list).
- New `public/looks/*.js` and `public/looks-*.css` go into `APP_SHELL`; `VERSION` stays `iron-log-v48` (unreleased branch). Look modules load only for the active look.
- Shell gotchas: no backslashes or regexes in heredocs; use the Write tool; files are CRLF in git; check `grep -c $'\x08'` on changed files.
- Every commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus
1. **Feature parity:** a button or number that exists in Classic must exist in Carbon and Bloom on the same screen (the contract test), in every state (empty data, logging, finished, rest running, deload, avoided exercise, offline).
2. **Arabic/RTL and dark/light** in both new layouts: nothing clipped, mirrored chevrons and steppers kept LTR, numbers isolated, no horizontal scroll at 360 px.
3. **Fallback safety:** a look module that fails to load, or a screen the look does not define, must show the Classic layout in the look's colours, never a blank screen.
4. **Classic untouched:** the existing UI suite passes unchanged in Classic with no edits, and Classic users download no look module.
5. **Touch and focus:** 44 px targets, visible focus, tab order, the Android back gesture and swipe between tabs still work with the new tab bars and sheets.

---

### Task 1: Design language and component sheet (design, owner checkpoint)

**Files:** a new design canvas "Iron Log Looks 2.0" (create it from the Design artifact type; boards under its `project/`), `docs/looks/README.md` (tokens and rules in words), `docs/looks/language.md`.
**Interfaces:** produces the approved **token set per look** (colours light/dark, type scale and faces, spacing, radii, shadows, icon set, bar styles) and the **component list** every later board reuses: large title header, grouped list row, inset card, stat tile, ring, chip/segmented control, primary/secondary/destructive button, stepper, set row, search field, tab bar, top bar, sheet, toast, empty state.

- [ ] **Step 1:** Create the canvas (publish with the Design `type_url`, a title, `auto_open: "after_first_write"`; follow the instructions the result returns). Draw one board per look × mode (Carbon dark/light, Bloom light/dark): type scale, colour tokens with contrast figures, spacing/radius/shadow samples, the 15 components above in their states, the icon set, a sample Today header and tab bar.
- [ ] **Step 2:** Write `docs/looks/language.md` (the tokens as a table: names, light/dark values, usage) and `README.md` (how the boards map to files).
- [ ] **Step 3: STOP: owner checkpoint.** Show the canvas link; the owner approves or corrects the language (fonts, accent defaults, bar styles). Record the answer in the ledger and `language.md`. Commit docs.

### Task 2: Today tab boards (design, owner checkpoint)

**Files:** canvas boards for Today in Carbon and Bloom, `docs/looks/today.md`.
**Interfaces:** produces the approved layout of: the Today root with no workout (day picker, journey card, look hint, food and energy card, level hero, deload banner), the workout card (empty day, first set, logging with planned rows, last set, finished, rest bar running, bodyweight/hold/deload/avoided variants), the demo thumbnail and full-screen viewer, the Add exercise sheet with search, the info sheet, food sheet, cardio sheet, target sheet; each in light and dark, plus an Arabic sample. Each board is annotated with every Classic `data-act` it keeps.

- [ ] **Step 1:** Draw the boards using only Task 1 components. **Step 2:** write `docs/looks/today.md`: per screen the layout in words, what is shown by default, what is behind a tap, and an explicit "removed/moved" list. **Step 3: STOP: owner checkpoint** (approve/correct screen by screen). Commit.

### Task 3: Plan and Progress boards (design, owner checkpoint)

**Files:** canvas boards, `docs/looks/plan.md`, `docs/looks/progress.md`.
**Interfaces:** approved layouts of Plan (Days list, day card, Edit day, templates/change split, weekday strip, My Gym with the 53-item checklist and injuries card, plan sheet) and Progress (Overview, Body with entry form and charts, Lifts, Goals with badge families and the family sheet, Coach, History with backup), both looks, light/dark, Arabic samples.

- [ ] Steps as Task 2 (draw, document, **STOP: owner checkpoint**, commit).

### Task 4: Friends, Me, picker and journey boards (design, owner checkpoint)

**Files:** canvas boards, `docs/looks/friends.md`, `docs/looks/me.md`, `docs/looks/flows.md`.
**Interfaces:** approved layouts of Friends (leaderboard and podium, requests, friend page, Sent/Blocked, Find, Challenges list/open/new), Me (profile, privacy, Appearance with look tiles, accent, language, theme, downloads, History & backup, delete my account), the first-launch look picker, the Plan-my-training journey (all steps), celebration cards, toasts, sign-in screen.

- [ ] Steps as Task 2 (**STOP: owner checkpoint**, commit).

### Task 5: Design freeze

**Files:** `docs/looks/INDEX.md` (every screen, its boards, its approval date, its `data-act` list), the canvas link in the spec.
- [ ] **Step 1:** assemble INDEX.md and a list of every screen builder the build must provide (`SCREENS` names used by Task 6). **Step 2: STOP: owner approval to start building** ("design frozen"). **Step 3:** commit.

### Task 6: Plumbing: layout dispatch, loading, contract test, look screenshots

**Files:** Create `public/looks/layout.js`, `public/looks/carbon.js`, `public/looks/bloom.js` (empty builders to start), `public/looks-carbon.css`, `public/looks-bloom.css`, `tests/looks-layout.test.js`. Modify `public/index.html`, `public/sw.js` (APP_SHELL), `tests-ui/smoke.test.mjs`, `tools/screenshot-harness/` (a `look` query param).
**Interfaces:**
- `layout.js` exports `SCREENS` (the screen names from INDEX.md), `async loadLayout(look): Promise<{[screen]: (ctx)=>string}>` (classic → `{}`; a failed import → `{}` and a console warning, never a throw), `buildCtx(base)` adding `t, tn, esc, nameOf, kg, icon(name), isRtl, look`.
- `index.html`: `let LAYOUT = {}`; `activateLayout(look)` awaits `loadLayout` before the first render when the saved look is not classic and again in `applyLook`; `screenHtml(name, ctx, classicBuilder)` returns `LAYOUT[name] ? LAYOUT[name](buildCtx(ctx)) : classicBuilder(ctx)`; the look CSS file is linked/unlinked by `applyLook`.
- harness: `?look=carbon|bloom` presets `ironlog.look` before load.

- [ ] **Step 1: Failing tests:** `looks-layout.test.js`: `loadLayout("classic")` is `{}`; `loadLayout("nope")` is `{}`; a module whose import throws gives `{}` (inject a failing importer); `buildCtx` escapes via `esc` and exposes the helpers; every builder a look exports is named in `SCREENS`. UI: with `look=carbon` and the look module blocked in the service worker the app shows the Classic layout in Carbon colours and no errors; Classic users never request `/looks/carbon.js`; the contract test skeleton (`looksContract`) walks the `SCREENS` table in Classic, Carbon and Bloom and compares `data-act` sets (it passes while the looks have no builders, because of the fallback).
- [ ] **Step 2-4:** FAIL, implement, PASS, full suites. **Step 5: Commit** `feat: layout dispatch for per-look screens`.

### Task 7: App chrome in both looks: top bar, tab bars, rest bar, toasts

**Files:** `public/looks/carbon.js`, `bloom.js` (builders `tabBar`, `topBar`, `restBar`, `toast`), the two CSS files, `public/index.html` (call sites in `renderTabbar`/header/rest bar), `tests/looks-chrome.test.js`, `tests-ui/smoke.test.mjs`.
**Interfaces:** each builder takes the ctx documented in INDEX.md (active tab, dot/count badges, sync text, screen title, rest state) and emits the approved markup; behaviour (`data-tab`, swipe, back, history entries, safe-area insets, `has-restbar` padding) is unchanged.

- [ ] **Step 1: Failing tests:** builder unit tests (five tabs with `data-tab`, `aria-current`, request dot and count, Arabic order via `dir`, no label under 12 px); UI: in each look the five tabs switch, swipe and Back work, the bar clears the safe area, the rest bar shows over every tab, 44 px targets, no overflow at 360 px in en/ar, light/dark. **Step 2-4:** FAIL, implement from the approved boards, PASS. **Step 5: Commit** `feat: Carbon and Bloom app chrome`.

### Task 8: Today screens (M2)
**Files:** both look modules and CSS, `public/index.html` (call sites in `renderLog`, `focusCard`, `todayCard`, the level hero and banners, the sheets of Today), `tests/looks-today.test.js`, `tests-ui/smoke.test.mjs`.
**Interfaces:** builders `todayHtml`, `workoutCardHtml`, `setRowsHtml`, `levelHeroHtml`, `foodCardHtml`, `dayPickerHtml`, `demoHtml`, `addExerciseSheetHtml`, `infoSheetHtml`, `foodSheetHtml`, `cardioSheetHtml`, `targetSheetHtml` with the ctx fields from `docs/looks/today.md`.
- [ ] **Step 1: Failing tests:** every builder × state × (ltr, rtl) as strings (data-acts present, names escaped, long names, planned/logged/edit/deload/hold/bodyweight/avoided variants, empty); contract test rows for Today and its sheets; UI core flows per look (log three sets by ticking, edit a set, add an exercise by search, open info and demo viewer, rest bar, finish, food add) with the existing selectors or updated ones noted in the ledger. **Steps 2-4:** FAIL, implement, PASS, full suites. **Step 5: Commit.**

### Task 9: Plan screens (M3)
Files, interfaces and steps as Task 8 for `daysHtml`, `dayCardHtml`, `dayEditorHtml`, `gymHtml`, `planSheetHtml` (`docs/looks/plan.md`); UI flows: assign a weekday, edit a day, change split, My Gym presets and 53 items, injuries card. **Commit** `feat: Carbon and Bloom Plan screens`.

### Task 10: Progress screens (M4)
As Task 8 for `overviewHtml`, `bodyHtml`, `liftsHtml`, `goalsHtml`, `familySheetHtml`, `coachHtml`, `historyHtml` (`docs/looks/progress.md`); charts use `var()` colours from the look; UI flows: log weight, add a body entry, open a lift, open a badge family, copy summary, backup and restore. **Commit** `feat: Carbon and Bloom Progress screens`.

### Task 11: Friends screens (M5)
As Task 8 for `friendsHtml` (leaderboard, podium, requests), `friendPageHtml`, `findHtml`, `challengesHtml`, `challengePageHtml` (`docs/looks/friends.md`); UI flows with the harness `friends=1&ch=1` data: accept a request, open a friend, compare, create/open a challenge. **Commit** `feat: Carbon and Bloom Friends screens`.

### Task 12: Me, sheets, picker, journey, celebration (M6)
As Task 8 for `meHtml`, `appearanceHtml`, `lookPickerHtml`, `journeyHtml` (every step), `celebrateHtml`, `signinHtml`, `deleteHtml` (`docs/looks/me.md`, `flows.md`); UI flows: change look/accent/language/theme, the first-launch picker (`pick=1`), the journey click-through (`go=jr:...`), delete-my-account `idle|confirm` states. **Commit** `feat: Carbon and Bloom Me, picker and journey`.

### Task 13: Polish and parity (M7a)
**Files:** both look modules and CSS, `tests/looks-contract` tables, `docs/looks/INDEX.md`.
- [ ] **Step 1: Failing tests:** the contract test covers **every** screen in `SCREENS` with no fallback left (a test fails if a look lacks a builder the INDEX lists), the full screenshot matrix (3 looks × light/dark × en/ar × 360/390 px) is generated and a script asserts no horizontal overflow, no target under 44 px, no text under 12 px, focus ring visible on every control, `prefers-reduced-motion` stops transitions; a size guard pins each look module and CSS. **Step 2-4:** FAIL, fix, PASS. **Step 5: Commit** `feat: Looks 2.0 parity and accessibility pass`.

### Task 14: Whole-branch verification (no deploy)
- [ ] Run `npm test`, the full `tests-ui`, the control-character check on every changed file, regenerate the screenshot matrix and compare with the approved boards, update `CLAUDE.md` (files, the layout mechanism, the contract rule for new features: "add the feature to Classic and to both looks"), `docs/README.md`, `docs/open-points.md`. **Do not deploy or merge.** Report counts and screenshots to the owner and ask whether to start the final Opus review.
