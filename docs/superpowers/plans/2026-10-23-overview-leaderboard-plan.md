# Progress Overview, Friends Leaderboard, Calmer Plan Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Progress Overview (headline numbers + four graphs) as the first Progress section, turn Friends into a ranked leaderboard with a crowned podium and a This week / This month / Level switch, and calm the Plan (Days) page.

**Architecture:** A new pure module `public/overview.js` builds the chart series from data the app already holds; `index.html` only draws them (hand-written SVG next to `lineChart()`). `friends.js` gains `rankBoard` (generalising `rankWeek`). The challenge podium markup is extracted into one shared renderer used by both Challenges and Friends. Plan page controls move into one "Edit plan" sheet using the existing sheet/Back machinery.

**Tech Stack:** plain JS ES modules, hand-written SVG, Node built-in test runner (`npm test`), Playwright smoke tests (`tests-ui`), screenshot harness.

**Spec:** `docs/superpowers/specs/2026-10-23-overview-leaderboard-plan-design.md`

## Global Constraints

- Every visible string needs an Arabic entry in `public/lang-ar.js` (`npm test` fails otherwise); no glued strings: use `t("... {n}",{n})` / `tn(one,other,n)`.
- Logical CSS properties only; charts stay LTR (`direction:ltr`); colours from `var(--accent)`, `--good`, `--muted`, never hardcoded blue.
- Touch targets at least 44px, text at least 12px (tests-ui checks both).
- No Firestore, rules or data-model change. Weeks run Saturday to Friday (`weekKey`, `addDays` from `achievements.js`).
- New `public/overview.js` goes into `APP_SHELL` in `public/sw.js`; bump `VERSION` v34 to v35 in the last task.
- Never deploy without the owner's explicit approval.

## Review Focus

- Week boundaries: `weeklyCounts` on a Friday, on a Saturday, with workouts on the boundary day, and with no workouts at all (8 zero bars, not a crash).
- Charts with 0 or 1 data point show a hint, never an empty or broken SVG; `target:null` (no weight/profile) must not draw a target line or NaN.
- Overview must not redraw slowly: series are memoised per `state.dataRev` plus `state.date`/today.
- Leaderboard: one person only (podium with a single step), exactly two or three people, ties, friends with no summary or a stale weekly summary, an invalid saved `ironlog.board` value.
- Challenges podium still looks and behaves the same after the shared-renderer refactor.
- Edit plan sheet: Back closes only the sheet; its actions (Plan my training, Add day, Change split) still work; the empty-days state keeps its direct buttons.
- Arabic/RTL: Overview charts and podium keep left-to-right data order; numbers readable.

---

### Task 1: `overview.js` pure series builders

**Files:**
- Create: `public/overview.js`, `tests/overview.test.js`

**Interfaces:**
- Consumes: `weekKey(date)`, `addDays(date, n)`, `weeklyTarget(days)`, `e1rm(w, r)` from `public/achievements.js`; `trainedOn(w)` from `public/workout-tools.js`; `weightOn(body, date)`, `bmrFor(profile, body, date)`, `dayEnergy({bmr, kg, goal, workout, food})` from `public/energy.js`. Workout shape: `{date, entries:[{ex, sets:[{w,r}]}], cardio?}`; body entry `{date, weight?}`; `food` is an object keyed by date with `{meals:[{kcal}]}`.
- Produces (all pure, no DOM):
  - `weeklyCounts(workouts, today, weeks = 8) -> [{start, count}]` oldest first, `start` = the week's Saturday (`weekKey`), `count` = distinct trained dates (`trainedOn`) in that week up to `today`; always `weeks` entries.
  - `weeklyTargetFor(days) -> number` (re-export of `weeklyTarget`, for the chart's target line).
  - `weightSeries(body, today, span = 90) -> [{date, weight}]` ascending, only numeric weights within `span` days up to `today`.
  - `weightChange(series, today, span = 28) -> number | null`: last weight minus the latest weight on or before `today - span` (rounded to 0.1); null when either is missing.
  - `caloriesWeek(food, workouts, body, profile, today) -> [{date, eaten, target}]` seven days ending `today`, oldest first; `eaten` is `null` when the day has no meals; `target` from `dayEnergy` (null when weight/profile are missing).
  - `topLifts(workouts, today, n = 3) -> [{ex, best, change30, sessions}]`: the `n` exercises with most sessions; `best` = best e1RM ever (1 decimal); `change30` = best e1RM in the last 30 days minus best before that window (null when either side is empty); sorted by sessions desc then name.
  - `prsThisMonth(workouts, today) -> number`: count of `prEvents(workouts)` with `date` in the last 30 days (import `prEvents` from `achievements.js`).

- [ ] **Step 1: Write failing tests** in `tests/overview.test.js` with explicit dates (today = `"2026-10-23"`, a Friday; its week started Saturday `"2026-10-17"`):
  - `weeklyCounts` returns 8 entries ending with `start:"2026-10-17"`; two workouts on different days this week and one a week earlier give counts `[..., 1, 2]`; two workouts on the same date count once; a workout dated after `today` is ignored; with `[]` all eight counts are 0; on a Saturday `today` the last entry is that Saturday.
  - `weightSeries` drops entries without a numeric weight and entries older than 90 days; `weightChange` of weights 90 (35 days ago), 88 (today) is `-2`; with no entry old enough it is `null`.
  - `caloriesWeek` has 7 entries ending today; a day with meals totalling 1800 has `eaten:1800`; a day without has `eaten:null`; with an empty profile and no body entries `target` is `null` for every day.
  - `topLifts` orders by session count, ties by name; `change30` is `null` when there is no session older than 30 days; `prsThisMonth` counts only recent PR events (build three sessions of one lift with rising weight, the third inside the window).
- [ ] **Step 2: Run `npm test`, expect the new tests to fail** (module not found).
- [ ] **Step 3: Implement `public/overview.js`** with the signatures above; dates are `YYYY-MM-DD` strings handled with `addDays`, never `Date` arithmetic across DST.
- [ ] **Step 4: Run `npm test`, expect all pass.**
- [ ] **Step 5: Commit** `feat: overview series builders`.

---

### Task 2: Overview section skeleton (nav, view container, empty page)

**Files:**
- Modify: `public/nav.js` (`TABS` progress views `["overview","body","progress","goals","coach","history"]`, `PILL_LABEL.overview = "Overview"`), `public/index.html` (`<section id="view-overview" class="view" hidden></section>` before `view-body`, `VIEWS`, `SCREEN_TITLES.overview = "Overview"`, the `render()` dispatch map, new `renderOverview()` stub drawing `<h2>Overview</h2>`), `tools/screenshot-harness/run.cjs` (line 12 maps: `TAB.overview = "progress"`, `FIRST.progress = "overview"`), `public/lang-ar.js` ("Overview")
- Test: `tests/nav.test.js`, `tests-ui/smoke.test.mjs`

**Interfaces:**
- Produces: view id `overview` (first pill of Progress; opening the Progress tab lands on it); `renderOverview()` in `index.html` that later tasks fill.

- [ ] **Step 1: Write failing tests.** nav test: `tabOf("overview") === "progress"`, `pillsFor("progress")[0] === "overview"`, `PILL_LABEL.overview === "Overview"`, `migrateView("overview") === "overview"`. tests-ui: update the "every tab opens its first section" expectation to `progress: ["Overview","Body","Lifts","Goals","Coach","History"]`; add a test that after tapping the Progress tab `#view-overview` is visible.
- [ ] **Step 2: Run both suites, expect these to fail.**
- [ ] **Step 3: Implement** the wiring above. Existing tests that open the Progress tab and then tap a specific pill (`.pill[data-view="body"]` etc.) keep working; any test that relied on Body being first must tap the Body pill explicitly.
- [ ] **Step 4: Run `npm test` and `cd tests-ui && npm test`, expect pass.**
- [ ] **Step 5: Commit** `feat: Overview section in Progress (skeleton)`.

---

### Task 3: Overview content: headline row and four graphs

**Files:**
- Modify: `public/index.html` (`renderOverview`, new `barChart(bars, opts)` next to `lineChart`, CSS `.ovgrid`, `.ovcard`, `.bars8`), `public/lang-ar.js`
- Test: `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: Task 1 functions; `lineChart(all, series, aria, emptyMsg)` (existing); `trainingStreak(state.workouts, state.days, today())`, `weightOn`, `fmtDate`, `state.dataRev`.
- Produces: `barChart(bars, {target, aria, emptyMsg}) -> string`: `bars = [{label, value}]` (value `null` = no bar), optional numeric `target` drawn as a dashed line (omitted when `null`/NaN), `role="img"` + `aria-label`, `direction:ltr`. `renderOverview()` draws, in order: headline row (4 `.stat`: current weight, `weightChange` over 28 days, workouts this week, streak weeks), then four `.ovcard` cards each ending in a tap-through button `data-act="pill" data-view="<view>"`: Weight trend (`lineChart` over `weightSeries`, to `body`), Training per week (`barChart` of `weeklyCounts`, target `weeklyTarget`, to `history`), Calories vs target (`barChart` of `caloriesWeek` eaten with target from the latest non-null day target, to `log`... use `go("log")` via `data-act="tab" data-tab="today"`), Strength (`topLifts` rows "name · best kg · ±change" plus the `prsThisMonth` count, to `progress`). Series are cached in a module variable keyed by `state.dataRev + "|" + today()` so repeated redraws do no work.
- Empty states (strings need Arabic): weight chart with fewer than 2 points uses `lineChart`'s `emptyMsg` "Log your weight on two days to see the trend."; all-zero training bars show "Log a workout to start your weekly chart."; no meals in 7 days show "Add meals on Today to compare with your target."; no lifts show "Log a few sessions to see your strongest lifts."

- [ ] **Step 1: Write failing UI tests** (harness sample data has weights, 10 workouts, meals): Overview shows 4 `.stat` in the headline; 4 `.ovcard`; the weight card contains an `svg.chart`; the training card has 8 bars (`rect.bar` count 8); each card's button opens the right section (`Body`, `History`, Today, `Lifts` titles); opening Overview with `?fresh=2` (no data) shows the four hint messages and no script error.
- [ ] **Step 2: Run tests-ui, expect failure.**
- [ ] **Step 3: Implement** `barChart` (SVG, viewBox like `lineChart`, bars use `var(--accent)`, target line dashed `var(--muted)`, labels 12px) and `renderOverview` as above; show a bar for value 0 as a thin baseline tick so a zero week is visible.
- [ ] **Step 4: Arabic strings,** then run `npm test` and tests-ui, expect pass (includes the 44px/12px test).
- [ ] **Step 5: Commit** `feat: Overview headline and four graphs`.

---

### Task 4: `rankBoard` for the leaderboard

**Files:**
- Modify: `public/friends.js`
- Test: `tests/friends.test.js`

**Interfaces:**
- Consumes: `weekCount(summary, today)` and `rankWeek` (existing in friends.js).
- Produces: `rankBoard(me, friends, metric, today) -> [{uid, name, isMe, value, rank}]` where `metric` is `"week" | "month" | "level"` (any other value behaves as `"week"`); `value` is `weekCount(summary, today)` for week, `Number(summary.workouts30)` for month (null when not a finite number; a month count older than 30 days is not adjusted), `Number(summary.level)` for level with ties broken by `Number(summary.xp)` descending (rank still shared only when both equal). Sorting, shared ranks (1,2,2,4) and last-placed null-rank entries behave exactly as in `rankWeek`; `rankWeek` is reimplemented as `rankBoard(me, friends, "week", today)` mapped to its current output shape (keep its existing tests green).

- [ ] **Step 1: Write failing tests:** month ordering by `workouts30`; level ordering with an xp tie-break (same level, higher xp first, ranks 1 and 2); equal level and xp share a rank; a friend with `summary:null` is last with `rank:null` for every metric; unknown metric string equals `"week"`; one person gives `[{rank:1}]`.
- [ ] **Step 2: Run `npm test`, expect the new tests to fail.**
- [ ] **Step 3: Implement `rankBoard`** and make `rankWeek` delegate to it.
- [ ] **Step 4: Run `npm test`, expect all pass** (old `rankWeek` tests included).
- [ ] **Step 5: Commit** `feat: rankBoard (week, month, level)`.

---

### Task 5: Friends leaderboard UI with crown

**Files:**
- Modify: `public/index.html` (`podiumHtml` refactor, `aheadStrip` replaced by `boardHtml`, `renderFriends`, CSS `.seg`, `.boardrow`), `public/lang-ar.js`
- Test: `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: `rankBoard` (Task 4), `avatarHtml`, `personName`, `currentSummary()`, `lsGet`/`lsSet` (existing localStorage helpers), `esc`, `t`, `tn`.
- Produces: `podiumMarkup(steps, ariaLabel) -> string` where `steps = [{rank, label, valueText, isMe}]` already in display order (2-1-3 for three, 2-1 for two, 1 alone for one); crown is drawn on `rank === 1` when `valueText` is not the zero/none marker the caller passes as `crown:true`. `podiumHtml(rows, me)` (Challenges) is rewritten on top of it with identical output, and its existing behaviour (crown only when the winner has days, ties share a step, needs at least 2 joined) is unchanged. `boardHtml(g) -> string` for Friends: a three-button segmented control (`data-act="board-set" data-v="week|month|level"`, `aria-pressed`), the podium of the top 3 (crown on rank 1 when its value is above 0, for level always), then the remaining ranked entries as `.boardrow` (rank, avatar, name, value text, you highlighted). `state.board` holds the metric: read once from `localStorage "ironlog.board"` (only `week|month|level` accepted, else `week`), written on change. Value text: week/month use `tn("{n} workout","{n} workouts",n)`, level uses `t("Level {n}",{n})`, null shows "–". The board draws only when `g.friends.length > 0`; Requests banner, Friends list, Manage and Invite card stay as they are, below it.

- [ ] **Step 1: Write failing UI tests:** with `friends=1` the Friends tab shows `.seg` with three buttons, "This week" pressed; `.podium` exists with a `.crown` inside the first-place step; tapping "Level" sets `aria-pressed` on it and the order/labels update (no script errors), and a reload keeps "Level" (localStorage); the Challenges page (`go=ch:open`) still shows its podium and crown (existing behaviour); Arabic mode renders the board without errors.
- [ ] **Step 2: Run tests-ui, expect failure.**
- [ ] **Step 3: Implement** the refactor and `boardHtml`; add `case "board-set"` to the click switch that sets `state.board`, persists it, and calls `renderFriends()`. Remove `aheadStrip` and its CSS (`.ahead`, `.aheadp`) once unused.
- [ ] **Step 4: Arabic strings** ("This week", "This month", "Level", segmented label), then run both suites, expect pass.
- [ ] **Step 5: Commit** `feat: Friends leaderboard with podium and crown`.

---

### Task 6: Calmer Plan page

**Files:**
- Modify: `public/index.html` (`gymHintHtml`, `renderDays`, new `#plansheet` dialog and `planSheetHtml`, sheet id lists in `sheetHtml`/`refreshSheets`/close-click/popstate loops, click cases), `public/lang-ar.js`
- Test: `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: existing actions `journey-open`, `add-day`, `change-split`, `gym-hint-go`, `gym-hint-no`, `edit-day`, `train-day`; `openSheet/closeSheet` machinery.
- Produces: `#plansheet` bottom sheet (`planSheetHtml()`: header "Edit plan" with close button, then three full-width buttons "Plan my training", "Add a day", "Change split"; each existing action closes the sheet first). `gymHintHtml()` returns a one-line banner (`.notice` style: the sentence, a "Set up" button, a ✕ close button with `aria-label`) using the same dismissal as today. `renderDays` header row: `<h2>Training days</h2>` and one `Edit plan` button (`data-act="open-plansheet"`) when days exist; the empty-days state is unchanged (direct buttons). A non-editing day card shows one tappable summary (`data-act="edit-day"`, the day head + muscle chips + exercise list as a single button, `aria-expanded`) and a single "Train this day" button; the separate "✎ Edit day" button is gone while not editing (the "✓ Done" button stays when editing).

- [ ] **Step 1: Write failing UI tests:** the Days section shows one `Edit plan` button and none of "Plan my training"/"+ Add day"/"Change split" until it is tapped; tapping opens `#plansheet` with the three actions; "Add a day" closes the sheet and adds a day in edit mode; Back closes the sheet without leaving the tab; a day card has no "Edit day" button and tapping its summary opens the editor; the gym hint is a single-line banner (height under 80px) and ✕ dismisses it for good.
- [ ] **Step 2: Run tests-ui, expect failure.**
- [ ] **Step 3: Implement** as above; extend every list of sheet ids to include `#plansheet`; `sheet-close` closes it as well.
- [ ] **Step 4: Arabic strings,** then run both suites, expect pass (existing week-strip and journey tests must stay green).
- [ ] **Step 5: Commit** `feat: Plan page with Edit plan menu and one-tap day cards`.

---

### Task 7: Docs, offline shell, version, screenshots

**Files:**
- Modify: `public/sw.js` (`VERSION = "iron-log-v35"`, add `"/overview.js"` to `APP_SHELL`), `CLAUDE.md` (files list: `overview.js`; features: Overview, leaderboard, Edit plan; sw version), `docs/README.md` (row 18), `docs/open-points.md`

- [ ] **Step 1: Update sw.js and the docs.**
- [ ] **Step 2: Run `npm test` and `cd tests-ui && npm test`, both must pass** (the sw/APP_SHELL test checks every `public/*.js`).
- [ ] **Step 3: Take harness screenshots** of Overview, Friends (all three switch states), Challenges, Plan (with the sheet open) in light, dark and Arabic into the scratchpad and look at each for overlap, clipped text and wrong crown placement; fix anything found with a test first.
- [ ] **Step 4: Commit** `docs: Overview, leaderboard and Plan notes, sw v35`.

(Then: one whole-branch review, a fix pass, the owner tries it on the phone, and only on the owner's explicit approval deploy.)
