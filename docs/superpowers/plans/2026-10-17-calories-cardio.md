# Calories and Cardio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log cardio and meals, estimate daily calories burned (everyday + lifting + cardio), and show eaten vs burned vs target on a Coach "Today" card.

**Architecture:** All calorie math lives in a new pure module `public/energy.js` (unit-tested). Storage changes are small: set timestamps `t`, a `cardio` array in the existing `w-` docs, and new `f-YYYY-MM-DD` food docs. `index.html` renders a Cardio card (Workout tab) and a Today card (Coach tab) from `dayEnergy()`.

**Tech Stack:** Plain JS ES modules, no build step; Firebase Firestore (existing `store`); Node 24 `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-17-calories-cardio-design.md`

Branch: `calories-cardio` (spec commit 2120c19).

## Global Constraints

- No build step, no runtime dependencies; Firestore never receives `undefined`.
- Mobile-first, 400px without horizontal scroll, colors only via CSS tokens (light + dark), plain short copy; units kg, kcal, min, g.
- Every number shown as kcal is rounded to a whole number; thousands use the device locale (`toLocaleString()`).
- Validation ranges: cardio `min` 1–600, cardio `kcal` 1–5000 or null, meal `kcal` 1–5000, meal `protein` 0–500 or null, meal `name` ≤ 40 chars or null.
- MET table, `GOAL_ADJ`, 1.2 baseline factor, 3.5 lifting MET, 2 min tail, 2.5 min/set fallback, 180 min cap, 120-day InBody window: exactly as in the spec.
- Training-day rotation (`nextDay`, `lastTrained`) stays sets-only.
- `public/sw.js` `VERSION = "iron-log-v9"` at release; `/energy.js` in `APP_SHELL`.

## Review Focus

1. **Body weight logged after the date being viewed** (looking at last week while the only weight is from today) → numbers needing weight show "Log your weight on the Body tab", never use a future weight. *(Task 1 test `weightOn ignores later entries`)*
2. **Cardio-only day with no workout doc yet** → adding cardio creates the doc (`dayName: "Cardio"`), and the day picker still lets you pick a training day afterwards, keeping the cardio. *(Task 3 manual 3c; Task 3 step on `startDay` keeping `cardio`)*
3. **Deleting the last meal of a day** → the `f-` doc is deleted, Today card shows Eaten 0. *(Task 4 manual 4c)*
4. **Editing a set** keeps its original `t`, so the workout length doesn't jump. *(Task 2 manual 2b; covered by code step)*
5. **A restored backup made before this feature** (no `t`, no `cardio`, no `f-` docs) → restores cleanly; lifting time falls back to 2.5 min/set. *(Task 2 test `old workouts without t or cardio restore unchanged`)*

---

### Task 1: Energy calculations

**Files:**
- Create: `public/energy.js`, `tests/energy.test.js`

**Interfaces:**
- Produces (named exports of `public/energy.js`):
  - `MET: {treadmill|elliptical|bike|other: {easy, moderate, hard}}`, `GOAL_ADJ`, `CARDIO_TYPES = ["treadmill","elliptical","bike","other"]`, `INTENSITIES = ["easy","moderate","hard"]`
  - `weightOn(body: Entry[], date: string) -> number|null` (latest `weight` with `entry.date <= date`)
  - `bmrFor(profile, body, date) -> {bmr: number, src: "inbody"|"formula"}|null`
  - `baselineBurn(bmr: number|null) -> number|null`
  - `liftMinutes(workout|null) -> number`
  - `liftKcal(workout|null, kg: number|null) -> number|null`
  - `cardioKcal(c, kg) -> number|null` (machine kcal works without kg)
  - `exerciseKcal(workout|null, kg) -> {lift, cardio, total}` (each number or null; `total` null if either part is null)
  - `dayEnergy({bmr, kg, goal, workout, food}) -> {baseline, lift, cardio, burned, target, eaten, protein, balance}`

- [ ] **Step 1: Write failing tests** (`tests/energy.test.js`):

```js
const min = m => m * 60000;
const W = (times, extra = {}) => ({ entries: [{ ex: "Squat", sets: times.map(t => ({ w: 100, r: 5, ...(t == null ? {} : { t }) })) }], ...extra });
test("weightOn uses the latest weight on or before the date", () => {
  const body = [{ date: "2026-10-01", weight: 82 }, { date: "2026-10-10", weight: 81 }, { date: "2026-10-12", waist: 80 }];
  assert.equal(weightOn(body, "2026-10-12"), 81); assert.equal(weightOn(body, "2026-10-05"), 82);
});
test("weightOn ignores later entries", () => assert.equal(weightOn([{ date: "2026-10-17", weight: 80 }], "2026-10-10"), null));
test("bmrFor prefers a recent InBody scan", () =>
  assert.deepEqual(bmrFor({ sex: "male", height: 180, birthYear: 1998 }, [{ date: "2026-09-01", bmr: 1750, weight: 80 }], "2026-10-17"), { bmr: 1750, src: "inbody" }));
test("bmrFor falls back to Mifflin-St Jeor when the scan is over 120 days old", () =>
  assert.deepEqual(bmrFor({ sex: "male", height: 180, birthYear: 1998 }, [{ date: "2026-01-01", bmr: 1750, weight: 80 }], "2026-10-17"), { bmr: 1790, src: "formula" }));
test("bmrFor female formula and missing data", () => {
  assert.equal(bmrFor({ sex: "female", height: 165, birthYear: 1996 }, [{ date: "2026-10-01", weight: 60 }], "2026-10-17").bmr, 1320);
  assert.equal(bmrFor({}, [{ date: "2026-10-01", weight: 60 }], "2026-10-17"), null);
  assert.equal(bmrFor({ sex: "male", height: 180, birthYear: 1998 }, [], "2026-10-17"), null);
});
test("baselineBurn", () => { assert.equal(baselineBurn(1700), 2040); assert.equal(baselineBurn(null), null); });
test("liftMinutes from set times plus 2 min", () => assert.equal(liftMinutes(W([0, min(20), min(45)])), 47));
test("liftMinutes falls back to 2.5 min per set", () => {
  assert.equal(liftMinutes(W([null, null, null, null])), 10);
  assert.equal(liftMinutes(W([0])), 2.5);
  assert.equal(liftMinutes(W([0, min(200)])), 5);
  assert.equal(liftMinutes({ entries: [] }), 0); assert.equal(liftMinutes(null), 0);
});
test("liftKcal", () => { assert.equal(liftKcal(W([0, min(20), min(45)]), 80), 157); assert.equal(liftKcal(W([0]), null), null); assert.equal(liftKcal({ entries: [] }, 80), 0); });
test("cardioKcal: machine number as typed, else estimate", () => {
  assert.equal(cardioKcal({ type: "treadmill", min: 25, intensity: "moderate", kcal: 280 }, null), 280);
  assert.equal(cardioKcal({ type: "treadmill", min: 25, intensity: "moderate", kcal: null }, 80), 233);
  assert.equal(cardioKcal({ type: "bike", min: 30, intensity: "easy", kcal: null }, 70), 88);
  assert.equal(cardioKcal({ type: "bike", min: 30, intensity: "easy", kcal: null }, null), null);
});
test("exerciseKcal sums lifting and cardio", () => {
  const w = W([0, min(20), min(45)], { cardio: [{ type: "treadmill", min: 25, intensity: "moderate", kcal: 280 }] });
  assert.deepEqual(exerciseKcal(w, 80), { lift: 157, cardio: 280, total: 437 });
  assert.deepEqual(exerciseKcal(null, 80), { lift: 0, cardio: 0, total: 0 });
  assert.deepEqual(exerciseKcal(w, null), { lift: null, cardio: 280, total: null });
});
test("dayEnergy combines everything", () => {
  const w = W([0, min(20), min(45)], { cardio: [{ type: "treadmill", min: 25, intensity: "moderate", kcal: 280 }] });
  const food = { meals: [{ kcal: 600, protein: 40 }, { kcal: 900, protein: null }] };
  assert.deepEqual(dayEnergy({ bmr: 1700, kg: 80, goal: "fat-loss", workout: w, food }),
    { baseline: 2040, lift: 157, cardio: 280, burned: 2477, target: 2027, eaten: 1500, protein: 40, balance: -977 });
});
test("dayEnergy with missing data", () => {
  const r = dayEnergy({ bmr: null, kg: null, goal: null, workout: null, food: null });
  assert.deepEqual(r, { baseline: null, lift: 0, cardio: 0, burned: null, target: null, eaten: 0, protein: null, balance: null });
  assert.equal(dayEnergy({ bmr: 1700, kg: 80, goal: undefined, workout: null, food: null }).target, 2040);
});
```

- [ ] **Step 2:** `npm test` → FAIL (module not found).
- [ ] **Step 3:** Implement `public/energy.js` per the spec table. Age for Mifflin = `Number(date.slice(0,4)) − birthYear`. InBody scan = latest body entry with numeric `bmr`, `date <= date` and fewer than 120 days before `date`. The Mifflin branch needs `weightOn(body, date)`. `liftKcal` is 0 when the workout has no sets (even without kg) and `null` when it has sets but no kg. `protein` = sum of numeric meal protein, or `null` if no meal has protein. `burned`/`target`/`balance` are `null` whenever `baseline` or `exercise.total` is `null`.
- [ ] **Step 4:** `npm test` → all PASS.
- [ ] **Step 5: Commit** `feat: energy calculations for daily calories burned and targets`

---

### Task 2: Storage: set times, cardio, food docs, restore

**Files:**
- Modify: `public/index.html` (`add-set`, `save-set`, snapshot loop, `store`, `exportData`, "trained" filters), `public/backup.js`, `public/workout-tools.js`, `tests/backup.test.js`, `tests/workout-tools.test.js`

**Interfaces:**
- Consumes: Task 1 `CARDIO_TYPES`, `INTENSITIES`.
- Produces: `state.food: {[date]: {date, meals}}`; `store.saveFood(doc)` (writes `f-<date>`, or deletes it when `meals` is empty); `trainedOn(w) -> boolean` in `workout-tools.js` (`entries` with sets, or non-empty `cardio`); workouts may carry `cardio: [...]`.

- [ ] **Step 1: Write failing tests.** In `tests/workout-tools.test.js`:

```js
test("trainedOn counts sets or cardio", () => {
  assert.equal(trainedOn({ entries: [{ ex: "Squat", sets: [{ w: 1, r: 1 }] }] }), true);
  assert.equal(trainedOn({ entries: [{ ex: "Squat", sets: [] }], cardio: [{ type: "bike", min: 20 }] }), true);
  assert.equal(trainedOn({ entries: [{ ex: "Squat", sets: [] }] }), false);
  assert.equal(trainedOn({ entries: [], cardio: [] }), false);
});
```

In `tests/backup.test.js` (OPTS unchanged):

```js
test("set times and valid cardio are kept", () => {
  const data = { ...W.data, entries: [{ ex: "Bench Press", sets: [{ w: 60, r: 8, t: 1760000000000 }, { w: 60, r: 8, t: -1 }] }],
    cardio: [{ id: "c1", type: "bike", min: 30, intensity: "easy", kcal: null }, { id: "c2", type: "treadmill", min: 20, intensity: "hard", kcal: 250 },
             { id: "c3", type: "rocket", min: 20, intensity: "easy", kcal: null }, { id: "c4", type: "bike", min: 0, intensity: "easy", kcal: null },
             { id: "c5", type: "bike", min: 20, intensity: "easy", kcal: 9000 }] };
  const r = cleanBackupItems([{ id: W.id, data }], OPTS).items[0].data;
  assert.deepEqual(r.entries[0].sets, [{ w: 60, r: 8, t: 1760000000000 }, { w: 60, r: 8 }]);
  assert.deepEqual(r.cardio, [data.cardio[0], data.cardio[1]]);
});
test("old workouts without t or cardio restore unchanged", () =>
  assert.deepEqual(cleanBackupItems([W], OPTS).items, [W]));
test("food docs are cleaned; doc without valid meals is skipped", () => {
  const f = { id: "f-2026-10-17", data: { date: "2026-10-17", updated: 1, meals: [
    { id: "m1", name: "Lunch", kcal: 650, protein: 45 }, { id: "m2", name: null, kcal: 300, protein: null },
    { id: "m3", name: "x", kcal: 0, protein: null }, { id: "m4", name: "y".repeat(80), kcal: 100, protein: 900 }] } };
  const r = cleanBackupItems([f], OPTS).items[0].data;
  assert.deepEqual(r.meals.map(m => m.id), ["m1", "m2", "m4"]);
  assert.equal(r.meals[2].name.length, 40); assert.equal(r.meals[2].protein, null);
  assert.equal(cleanBackupItems([{ id: "f-2026-10-17", data: { date: "2026-10-17", meals: [] } }], OPTS).skipped, 1);
  assert.equal(cleanBackupItems([{ id: "f-2026-10-17", data: { date: "2026-10-16", meals: f.data.meals } }], OPTS).skipped, 1);
});
```

- [ ] **Step 2:** `npm test` → the new tests FAIL.
- [ ] **Step 3:** `trainedOn` in `workout-tools.js`. In `backup.js`: keep set `t` when it is a positive finite number; `cardio` entries need `id` (text ≤ 40), `type` in `CARDIO_TYPES`, integer `min` 1–600, `intensity` in `INTENSITIES`, `kcal` null or 1–5000 (output omits `cardio` when the input had none); accept ids `f-YYYY-MM-DD` (extend `DATE_ID` to `(w|b|f)`), meals need `id` text ≤ 40 and `kcal` 1–5000, `name` text ≤ 40 or null, `protein` 0–500 or null; skip the doc if no meal survives. Import the constants from `./energy.js`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: index.html.**
  - `add-set` pushes `{w, r, t: Date.now()}`; `save-set` keeps the old set's `t` when present.
  - Snapshot: `f-` docs → `state.food[date]` (initial state `food:{}`, reset on sign-out).
  - `store.saveFood({date, meals})`: if `meals.length` write `f-<date>` `{date, meals, updated}`, else delete it; updates `state.food`.
  - `store.save` keeps `cardio` when the workout has one (write `cardio: w.cardio || []` only if `w.cardio` exists, never `undefined`).
  - `startDay` keeps the existing `cardio` array when switching days.
  - `exportData` adds `f-` docs.
  - Replace "has sets" checks with `trainedOn(w)` in: `renderHistory` list filter and weekly count, Coach "workouts in the last 7 days" (`wk`) and the training-section guard, `reviewPrompt` workouts. Leave `nextDay`/`lastTrained` unchanged.
- [ ] **Step 6:** Parse-check the inline script; `npm test`. Manual later: (2a) add sets → Firestore doc shows `t`; (2b) edit a set → `t` unchanged.
- [ ] **Step 7: Commit** `feat: store set times, cardio and daily food; restore validates them`

---

### Task 3: Cardio card (Workout tab) + History

**Files:**
- Modify: `public/index.html` (`renderLog`, `dayPicker` path, click/input handlers, `renderHistory`, CSS)

**Interfaces:**
- Consumes: Task 1 `cardioKcal`, `weightOn`, `CARDIO_TYPES`, `INTENSITIES`; Task 2 `store.save`, workout `cardio`.
- Produces: `state.cardioDraft: {type, min, intensity, kcal}` (defaults `treadmill`, `20`, `moderate`, `""`); actions `cardio-type`, `cardio-int`, `cardio-step` (`data-d` ±5), `add-cardio`, `rm-cardio` (`data-id`).

- [ ] **Step 1:** `cardioCard()` returns the card HTML: heading "Cardio"; sessions list (`Treadmill · 25 min · 280 kcal` / `Bike · 30 min · ~210 kcal est.` via `cardioKcal(c, weightOn(state.body, state.date))`; when an estimate can't be made, `· log weight for kcal`), each with a ✕ `rm-cardio` button (`aria-label="Delete Treadmill session"`); type chips (`aria-pressed`), minutes stepper (−5/+5, input `id="cardio-min"` `inputmode="numeric"`), intensity chips with hint "Used when kcal is blank", input `id="cardio-kcal"` placeholder "kcal from machine (optional)", **Add cardio** primary button. Labels: Treadmill, Elliptical, Bike, Other / Easy, Moderate, Hard.
- [ ] **Step 2:** Render `cardioCard()` at the end of `renderLog` both in the normal path and the day-picker path.
- [ ] **Step 3: Handlers.** Chips/stepper update `state.cardioDraft` and re-render the card only (`renderLog`). The input handler keeps `cardioDraft.min`/`kcal` in sync. `add-cardio`: validate (`min` integer 1–600; `kcal` blank or 1–5000) else toast "Enter 1–600 minutes and, if you have it, 1–5000 kcal"; `w=ensureWorkout()`, set `w.dayName ||= "Cardio"` when the doc is new and has no day, push `{id: uid(), type, min, intensity, kcal: number|null}`, `store.save(w)`, reset `kcal` draft, `renderLog()`, toast "Cardio added". `rm-cardio` removes by id and saves. No rest timer.
- [ ] **Step 4: History:** cards show cardio chips (`Treadmill 25 min`) after exercise chips, and the summary line becomes `N sets · V kg · K kcal exercise` where K = `exerciseKcal(w, weightOn(state.body, w.date)).total` (omit the kcal part when null).
- [ ] **Step 5:** Parse-check; `npm test`; mock render (headless Edge, real CSS, 400px, light + dark) of the Cardio card with one machine and one estimated session. Fix any overflow.
- [ ] **Step 6: Manual (phone):** (3a) add cardio with machine kcal and without; (3b) ✕ deletes; (3c) on a day with no workout, add cardio from the day picker screen, then pick "Push": cardio still listed; "Up next" on Days unchanged by a cardio-only day; (3d) History shows the cardio day.
- [ ] **Step 7: Commit** `feat: cardio logging on the Workout tab`

---

### Task 4: Coach "Today" card + meals

**Files:**
- Modify: `public/index.html` (`renderCoach`, `insights()` Nutrition block, `reviewPrompt`, state, handlers, CSS)

**Interfaces:**
- Consumes: Task 1 `dayEnergy`, `bmrFor`, `weightOn`, `GOAL_ADJ`; Task 2 `state.food`, `store.saveFood`, `trainedOn`.
- Produces: `state.cdate` (Coach date, default `today()`, included in `checkNewDay` rollover); actions `meal-name` (`data-name`), `add-meal`, `rm-meal` (`data-id`); form `id="meal-form"`.

- [ ] **Step 1: Today card** (first in `renderCoach`, before the profile notice): date input `id="coach-date"` (max today); compute `kg=weightOn(state.body,cdate)`, `b=bmrFor(state.profile,state.body,cdate)`, `e=dayEnergy({bmr:b?.bmr??null, kg, goal:state.profile.goal, workout:workoutFor(cdate)||null, food:state.food[cdate]||null})`.
  - Figures: **Eaten** `e.eaten / e.target kcal`, **Burned** `e.burned kcal` with line `Everyday X · Lifting Y · Cardio Z`, **Balance** signed `e.balance kcal`, class `good` when it matches the goal (spec rule: deficit for fat-loss/recomp, surplus for muscle/strength, |balance| ≤ 200 for maintain), else muted.
  - Progress bar `min(100, eaten/target·100)%`; label `over by N kcal` when eaten > target.
  - Missing data: replace null figures with `–` and one line naming what's missing ("Log your weight on the Body tab" / "Fill in About you on the Body tab").
  - Protein line when `e.protein != null`: `Protein P g of LO–HI g` (LO/HI = round(kg × 1.6 / 2.2); omit range if no kg).
  - Meal form: kcal input (`inputmode="numeric"`, required), name chips Breakfast/Lunch/Dinner/Snack filling `#meal-name`, protein input (optional), **Add meal**; meal list `Lunch · 650 kcal · 45 g` with ✕.
- [ ] **Step 2: Handlers.** `coach-date` change → `state.cdate`, `renderCoach`. `meal-form` submit: validate (kcal integer 1–5000; protein blank or 0–500; name ≤ 40) else toast "Enter 1–5000 kcal (protein 0–500 g)"; append `{id: uid(), name: name||null, kcal, protein: p ?? null}` to `state.food[cdate]?.meals` and `store.saveFood`; clear the form, `renderCoach`. `rm-meal` removes and saves (empty → doc deleted).
- [ ] **Step 3:** Remove the Nutrition "Daily targets" insight from `insights()` (and `nutrition()` if unused). The protein range moves to the Today card.
- [ ] **Step 4:** `reviewPrompt`: add `foodLast28Days: [{date, kcal, protein}]` and `cardio` per workout (`{type, min, kcal}` with estimated kcal filled in).
- [ ] **Step 5:** Parse-check; `npm test`; mock render of the Today card (full data, and missing weight) at 400px light + dark.
- [ ] **Step 6: Manual (phone):** (4a) add meals: Eaten and Balance update; (4b) add a set or cardio on Workout: Burned and Target rise on Coach; (4c) delete the last meal: Eaten 0 and the doc is gone; (4d) pick yesterday and add a meal.
- [ ] **Step 7: Commit** `feat: Coach Today card with meals, burned and target`

---

### Task 5: Release

**Files:**
- Modify: `public/sw.js`, `CLAUDE.md`

- [ ] **Step 1:** `sw.js`: add `"/energy.js"` to `APP_SHELL`, `VERSION = "iron-log-v9"`.
- [ ] **Step 2:** `CLAUDE.md`: data model rows (`w-` cardio + set `t`, new `f-` doc), files (`energy.js`), features (Cardio card, Today card, target model A and the "MET − 1" rule), remove the Coach "Daily targets" mention.
- [ ] **Step 3:** `npm test` all PASS; parse-check.
- [ ] **Step 4: Commit** `chore: release calories and cardio (sw v9, docs)`
- [ ] **Step 5:** Final whole-branch review; then, with the user's go-ahead, merge to `main`, push, `firebase deploy --only hosting` (predeploy runs the tests). Verify `sw.js` v9 and `/energy.js` 200 on the live site.
