# Look & Feel Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Iron Log in the "Clean plate" style (light + dark, theme setting), move navigation to a bottom bar with a More sheet, rebuild the Workout screen as Focus mode with an exercise chip row, and declutter Coach and Body.

**Architecture:** All changes are in `public/index.html` (CSS tokens + building blocks, markup, render functions) plus a few small pure helpers that get unit tests (`public/workout-tools.js`, new `public/ui-helpers.js`). No new Firestore data; theme lives in localStorage.

**Tech Stack:** Plain HTML/CSS/JS ES modules, no build step; Node 24 `node --test`; headless Edge for mock renders.

**Spec:** `docs/superpowers/specs/2026-10-17-look-and-feel-design.md` (mockups in `.superpowers/brainstorm/3972-1792267747/content/`)

Branch: `look-and-feel` (spec commit fcf864f).

## Global Constraints

- No build step, no runtime dependencies, no new Firestore fields. Offline-capable.
- 400px wide: no horizontal scroll except the exercise chip row. Light and dark both readable; colors only via tokens.
- Token values exactly as the spec table (light `--bg #f3f5f9`, `--surface #fff`, `--sunk #eef2f8`, `--line #e3e8ef`; dark `--bg #0f1319`, `--surface #171d26`, `--sunk #0b0f14`, `--line #283140`; accents unchanged; new `--shadow`, `--r-card: 18px`, `--r-btn: 14px`).
- Primary/secondary buttons and stepper buttons ≥ 48px tall/wide on the Workout screen; tab bar buttons ≥ 48px.
- Theme key `localStorage["ironlog.theme"]` = `"system" | "light" | "dark"`; view key `ironlog.view` unchanged (all 7 views stay valid).
- Tab bar height `--tabbar: 64px` (plus `env(safe-area-inset-bottom)`); rest bar and toasts sit above it.
- Every existing behavior keeps working: rest timer, set edit, prefill, wake lock, cardio, meals, badges + toasts, exercise info "!", backup/restore, date rollover, deferred redraw.
- `public/sw.js` `VERSION = "iron-log-v11"`; `/ui-helpers.js` in `APP_SHELL`.

## Review Focus

1. **Bottom stacking:** tab bar, rest bar and toast must never overlap each other or hide the last content on any page (incl. the Add set button and More sheet), with and without the rest bar, on phones with a home indicator. *(Task 3 mock render "rest bar + toast over tab bar"; manual 3b)*
2. **Actions inside sheets:** buttons, chips, the add-exercise form (submit) and the exercise datalist must work inside the `+ Exercise` / `+ Cardio` / More sheets (delegated handlers on `document`, `<dialog>` content). *(Task 4 manual 4c; parse + mock)*
3. **Theme "System"** must still follow the phone's dark mode (removing `data-theme`), and Light/Dark must win over it; no light flash on load in dark. *(Task 2 test `themeAttr`; manual 2b)*
4. **Open exercise disappears** (removed, or the day was edited so it's no longer in the workout) → focus card falls back to the first unfinished exercise; no crash. *(Task 1 test `nextUnfinished` with `fromIndex -1`; Task 4 code step uses it)*
5. **Quick weight on a day that already has measurements** keeps those fields. *(Task 1 test `withWeight keeps other fields`)*

---

### Task 1: Pure helpers

**Files:**
- Modify: `public/workout-tools.js`, `tests/workout-tools.test.js`
- Create: `public/ui-helpers.js`, `tests/ui-helpers.test.js`

**Interfaces:**
- Produces:
  - `nextUnfinished(entries: {done?}[], fromIndex: number) -> number` (index of the first not-done entry after `fromIndex`, wrapping around, never `fromIndex` itself; `-1` if none; `fromIndex -1` = search from the start)
  - `elapsedMin(workout, now: number) -> number | null` (whole minutes since the earliest positive set `t`; `null` when no set has `t`)
  - `themeAttr(setting) -> "light" | "dark" | null` (`null` for "system" or anything unknown)
  - `sortTips(items: {tone}[]) -> items` (stable order: `warn`, then `info`, then `good`)
  - `withWeight(entry | undefined, date: string, kg: number) -> entry` (returns a new body entry with `weight = kg` and `updated` untouched; keeps every other field; creates `{date, weight}` when there is no entry)

- [ ] **Step 1: Write failing tests**

```js
// tests/workout-tools.test.js (add)
test("nextUnfinished wraps and skips the current one", () => {
  const e = [{ done: true }, {}, { done: true }, {}];
  assert.equal(nextUnfinished(e, 1), 3);
  assert.equal(nextUnfinished(e, 3), 1);
  assert.equal(nextUnfinished(e, -1), 1);
  assert.equal(nextUnfinished([{ done: true }, {}], 1), -1);
  assert.equal(nextUnfinished([], -1), -1);
});
test("elapsedMin from the first timed set", () => {
  const T = 1760000000000;
  assert.equal(elapsedMin({ entries: [{ sets: [{ w: 1, r: 1, t: T + 60000 }, { w: 1, r: 1, t: T }] }] }, T + 38 * 60000 + 30000), 38);
  assert.equal(elapsedMin({ entries: [{ sets: [{ w: 1, r: 1 }] }] }, T), null);
  assert.equal(elapsedMin(null, T), null);
});
// tests/ui-helpers.test.js
test("themeAttr", () => {
  assert.equal(themeAttr("light"), "light"); assert.equal(themeAttr("dark"), "dark");
  assert.equal(themeAttr("system"), null); assert.equal(themeAttr(undefined), null); assert.equal(themeAttr("pink"), null);
});
test("sortTips puts warnings first, keeps order within a tone", () =>
  assert.deepEqual(sortTips([{ tone: "good", id: 1 }, { tone: "warn", id: 2 }, { tone: "info", id: 3 }, { tone: "warn", id: 4 }]).map(t => t.id), [2, 4, 3, 1]));
test("withWeight keeps other fields", () => {
  const e = { date: "2026-10-17", weight: 81, waist: 84, pbf: 18, updated: 5 };
  assert.deepEqual(withWeight(e, "2026-10-17", 80.4), { date: "2026-10-17", weight: 80.4, waist: 84, pbf: 18, updated: 5 });
  assert.deepEqual(withWeight(undefined, "2026-10-18", 80), { date: "2026-10-18", weight: 80 });
  assert.equal(e.weight, 81, "input not mutated");
});
```

- [ ] **Step 2:** `npm test` → FAIL (missing exports / module).
- [ ] **Step 3:** Implement the five functions (`nextUnfinished`, `elapsedMin` in `workout-tools.js`; the rest in `ui-helpers.js`).
- [ ] **Step 4:** `npm test` → all PASS.
- [ ] **Step 5: Commit** `feat: helpers for focus mode, theme, tips order and quick weight`

---

### Task 2: Visual system and theme setting

**Files:**
- Modify: `public/index.html` (`<head>`, `:root` tokens and both dark blocks, building-block CSS, hidden icon sprite after `<body>`)

**Interfaces:**
- Consumes: Task 1 `themeAttr`.
- Produces: CSS tokens `--shadow`, `--r-card`, `--r-btn`, `--tabbar`; classes `.card` (restyled), `.btn`, `.btn.primary`, `.btn.secondary` (outlined), `.bigstep` (stepper: `<div class="bigstep"><button>−</button><input><button>+</button></div>`), `.chip`, `.ebar`, `dialog.sheet` (existing); icon sprite ids `i-workout`, `i-coach`, `i-body`, `i-goals`, `i-more`, `i-chev`; JS `applyTheme(setting)` and `currentTheme()`.

- [ ] **Step 1: Tokens.** Update `:root` and both dark blocks (`@media (prefers-color-scheme:dark){:root:not([data-theme="light"])}` and `:root[data-theme="dark"]`) to the spec values; add `--shadow` (light `0 1px 3px rgb(20 30 50 / .08)`, dark `none`), `--r-card:18px`, `--r-btn:14px`, `--tabbar:64px`. Update `<meta name="theme-color">` handling: `applyTheme` sets its content to the current `--surface`.
- [ ] **Step 2: Building blocks.** `.card` → `--surface`, `border-radius:var(--r-card)`, `box-shadow:var(--shadow)`, border `1px solid transparent` in light / `var(--line)` in dark; `.btn` radius `--r-btn`, min-height 44px (48px for `.btn.primary`); add `.btn.secondary`; add `.bigstep` (full-width row: 48px round buttons on `--surface` inside a `--sunk` pill, centered 28px `--f-num` input). Keep existing class names working so untouched screens still look right.
- [ ] **Step 3: Icons.** Hidden `<svg width="0" height="0" style="position:absolute">` sprite with the six `<symbol>`s (24×24, stroke `currentColor`, width 2, round caps; shapes as in the navigation mockup).
- [ ] **Step 4: Theme.** Classic `<script>` in `<head>` (before the stylesheet link) that reads `ironlog.theme` in try/catch and sets `document.documentElement.dataset.theme` for light/dark (removes it otherwise), so there is no flash. In the module: `applyTheme(setting)` saves to localStorage (try/catch), applies `themeAttr(setting)`, updates theme-color; `currentTheme()` returns the saved value or `"system"`.
- [ ] **Step 5:** Parse-check (`node --check` on the extracted module); `npm test`; mock render of a card + buttons + bigstep + chips in light and dark (real CSS, 400px).
- [ ] **Step 6: Manual later (2b):** System follows the phone; Light/Dark override it; reload in dark shows no white flash.
- [ ] **Step 7: Commit** `feat: Clean plate tokens, building blocks, icons and theme setting`

---

### Task 3: Bottom navigation, More sheet, header

**Files:**
- Modify: `public/index.html` (header markup + CSS, remove top `<nav>`, add `<nav class="tabbar">` and `<dialog id="moresheet" class="sheet">`, `render()`, `go()`, restbar/toast/main CSS, sign-out wiring, `showAccount`)

**Interfaces:**
- Consumes: Task 2 icons, `applyTheme`, `currentTheme`, `dialog.sheet`.
- Produces: `openMore()`, `closeMore()`; actions `tab` (`data-view`), `more-open`, `more-go` (`data-view` = days | progress | history), `theme-set` (`data-v`), `signout`.

- [ ] **Step 1: Tab bar.** `<nav class="tabbar" id="nav" hidden>` fixed to the bottom, five buttons (`data-act="tab" data-view="log|coach|body|goals"` and `data-act="more-open"`), each `<svg><use href="#i-…"/></svg>` + label (Workout, Coach, Body, Goals, More). `render()` sets `aria-current="page"` on the current tab; for `days|progress|history` it marks More. Height `var(--tabbar)` + `padding-bottom: env(safe-area-inset-bottom)`, `--surface` background, top border `--line`. Remove the old top tab bar and its CSS/handlers.
- [ ] **Step 2: More sheet.** `<dialog id="moresheet" class="sheet">` with rows Days, Lifts, History & backup (`more-go`), a segmented control System / Light / Dark (`theme-set`, `aria-pressed` on the current value), the account line (first name) and a **Sign out** button. Open/close like the exercise info sheet: `showModal()` + `history.pushState({more:1})`; close on ✕, backdrop tap (outside the rect), Esc, `popstate`; the `close` event calls `history.back()` only if `history.state?.more`. `more-go` closes the sheet, then `go(view)`.
- [ ] **Step 3: Header.** Logo mark + current screen title (`Workout`, `Coach`, `Body`, `Goals`, `Days`, `Lifts`, `History`) + sync status. Remove the account name and Sign out button from the header (`showAccount` now fills the More sheet's account line).
- [ ] **Step 4: Bottom stacking.** `main` bottom padding `calc(var(--tabbar) + 24px + env(safe-area-inset-bottom))`; rest bar `bottom: calc(var(--tabbar) + env(safe-area-inset-bottom))` with its own safe-area padding removed; `body.has-restbar main` adds the rest bar height; toast `bottom` = above the tab bar (and above the rest bar when shown). Tab bar `z-index` below the rest bar, both below dialogs.
- [ ] **Step 5:** Parse-check; `npm test`; mock render (real CSS + markup) of: Workout page with tab bar, with rest bar shown, with a toast shown; More sheet open (light + dark). Fix any overlap.
- [ ] **Step 6: Manual later (3a–3c):** all tabs and More items open the right screen; reopening the app returns to the last view; rest bar sits above the tab bar; back gesture closes the More sheet; Sign out works from More.
- [ ] **Step 7: Commit** `feat: bottom tab bar, More sheet and simpler header`

---

### Task 4: Workout Focus mode

**Files:**
- Modify: `public/index.html` (`renderLog`, CSS, click handlers, two new sheets `#exsheet` and `#cardiosheet`)

**Interfaces:**
- Consumes: Task 1 `nextUnfinished`, `elapsedMin`; Task 2 `.bigstep`, `.btn.*`, `.chip`; existing `state.openEx`, `state.editSet`, `ui[ex]` drafts, `prefillFor`, `readSet`, `infoBtn`, `cardioCard()`, `suggestionsFor`, add-ex form.
- Produces: actions `jump-ex` (`data-name`), `next-ex`, `open-exsheet`, `open-cardiosheet`; `#exsheet` / `#cardiosheet` (`dialog.sheet`, same open/close pattern as Task 3).

- [ ] **Step 1: Which exercise is open.** `ei` = index of `state.openEx` if it exists in today's entries; otherwise `nextUnfinished(entries, -1)`; if that is `-1` (all done) → show the complete card. (This replaces the current collapsed-rows list.)
- [ ] **Step 2: Header + chips.** Keep the date input row. Then: day name, `N of M` (done count) and `· X min` when `elapsedMin(w, Date.now())` is non-null and the date is today, then the progress bar. Chip row (`overflow-x:auto`, no visible scrollbar): one chip per entry (`data-act="jump-ex" data-name`), states done (✓ green), started (number with accent ring), not started (number), open (filled accent); after render, scroll the open chip into view (`inline:"center"`). Long names truncate with ellipsis at 14ch.
- [ ] **Step 3: Focus card.** `Exercise i of M`, name + `infoBtn`, last time line, `.bigstep` for weight (`data-act="step" data-f="w" data-d="±2.5"`, input `id="w-${ei}"`) and reps (`±1`, `id="r-${ei}"`) — keep the existing ids, data attributes and `ui` draft handling so prefill, steppers, `readSet`, add-set, save-set, edit and the rest timer work unchanged. Primary **Add set N** (or **Save set** + Cancel when editing), logged sets list (existing set rows: tap to edit, ✕, PR tag), then a text button "Remove exercise" (existing `rm-ex`).
- [ ] **Step 4: Under the card.** `✓ Done` (existing `done-ex`) and `Next: <name> ›` (`next-ex`: `state.openEx = entries[nextUnfinished(entries, ei)].ex`, `stopEditing()`, render, scroll to top of the card); hide Next when `nextUnfinished` is `-1`. All done → "Workout complete" card (sets, volume kg, exercise kcal via `exerciseKcal(w, weightOn(...)).total` when not null) replaces the focus card.
- [ ] **Step 5: Sheets.** Row with `+ Exercise` (`open-exsheet`) and `+ Cardio` (`open-cardiosheet`). `#exsheet` contains the current "Add an exercise" content (suggestion chips + free-workout muscle chips + `add-ex-form`); adding an exercise closes the sheet and opens it in focus. `#cardiosheet` contains `cardioCard()` content; adding cardio keeps the sheet open (to see it in the list) and re-renders its content. Logged cardio shows as one-line rows under the buttons (`Treadmill · 25 min · 280 kcal`, ✕ = existing `rm-cardio`). The day-picker path (no workout / cardio-only) keeps today's layout, restyled, with the cardio card inline as now.
- [ ] **Step 6:** `jump-ex` = `stopEditing(); state.openEx=name; renderLog()`. Existing `open-ex`/`close-ex` handlers can stay for compatibility.
- [ ] **Step 7:** Parse-check; `npm test`; mock render of the real `renderLog()` with sample state (mid-set with one skipped exercise; editing a set; all done) at 400px light + dark.
- [ ] **Step 8: Manual later (4a–4d):** (4a) do exercises out of order via chips; Next goes to the skipped one; (4b) edit a set, Save; rest bar unaffected; (4c) add an exercise and a cardio session from the sheets; (4d) remove an exercise while it's open → next unfinished opens.
- [ ] **Step 9: Commit** `feat: Workout focus mode with exercise chips and add sheets`

---

### Task 5: Coach and Body decluttered

**Files:**
- Modify: `public/index.html` (`renderCoach`, `renderBody`, state, handlers, CSS)

**Interfaces:**
- Consumes: Task 1 `sortTips`, `withWeight`; existing `todayCard()`, `insights()`, `volumeBars()`, review card, body form, `store.saveBody`.
- Produces: `state.coachAllTips` (bool), `state.coachMore` (bool), `state.bodyFull` (bool); actions `tips-all`, `coach-more`, `body-full`; form `id="quickw-form"`.

- [ ] **Step 1: Coach.** Order: profile notice (if any), Today card, **Tips** card = `sortTips(insights())` showing 3 (all when `coachAllTips`), button `Show all tips (N)` / `Show fewer`; then a `More from Coach` disclosure button (`coach-more`) that reveals the volume bars and the "Get a written review" card. Tip chips (coach-add) keep working.
- [ ] **Step 2: Body.** First card: latest weight (`latestWith("weight")`) as a large number + date + change vs 4 weeks ago (same rule as the Trend card's "vs. 4 weeks ago"), and `quickw-form`: one decimal input + Save for `state.bdate`. Submit: validate number > 0 (same toast as the body form), `store.saveBody({...withWeight(existing, state.bdate, kg), updated: Date.now()})`, toast `Saved`. Then the profile line, then **Add measurements / scan** (`body-full`) which shows the existing full entry form (open by default when the selected date's entry already has non-weight values), then Trend and Recent entries.
- [ ] **Step 3:** Parse-check; `npm test`; mock render of Coach (5 tips, collapsed) and Body (with and without an entry) light + dark.
- [ ] **Step 4: Manual later (5a–5b):** quick weight on a day that already has a waist value keeps the waist; Show all tips / More from Coach expand and collapse.
- [ ] **Step 5: Commit** `feat: Coach tips first-3 and Body quick weight`

---

### Task 6: Restyle remaining screens + release

**Files:**
- Modify: `public/index.html` (Goals, Days, Lifts, History, day picker, sign-in CSS only where needed), `public/sw.js`, `CLAUDE.md`

- [ ] **Step 1:** Apply the building blocks to Goals, Days (cards, chips, buttons), Lifts (stats, chart card), History (compact cards), the day picker and the sign-in card. No behavior changes.
- [ ] **Step 2:** Mock render each of these screens (real render functions where practical, else real markup + CSS) at 400px light + dark; fix overflow/contrast.
- [ ] **Step 3:** `sw.js`: `"/ui-helpers.js"` in `APP_SHELL`; `VERSION = "iron-log-v11"`.
- [ ] **Step 4:** CLAUDE.md: design rules (tokens, building blocks, theme setting), navigation (tab bar + More), Workout focus mode, Coach/Body layout; files list (`ui-helpers.js`).
- [ ] **Step 5:** `npm test` all PASS; parse-check.
- [ ] **Step 6: Commit** `chore: restyle remaining screens, release look & feel (sw v11, docs)`
- [ ] **Step 7:** Final whole-branch review; then, with the user's go-ahead, merge to `main`, push, `firebase deploy --only hosting`; verify `sw.js` v11 and `/ui-helpers.js` 200 live.
