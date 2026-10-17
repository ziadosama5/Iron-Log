# Achievements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Goals tab with a target-weight goal bar (calorie bank + weight), weekly training and daily food streaks, 27 badges and XP levels, plus one-time badge toasts.

**Architecture:** All rules live in a new pure module `public/achievements.js`, computed from existing state on every render. The only new stored state is `settings.seenBadges` and two optional profile fields (`goalWeight`, `goalStart`). `index.html` adds the tab, the profile field and the toast check.

**Tech Stack:** Plain JS ES modules, no build step; Firestore via the existing `store`; Node 24 `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-17-achievements-design.md`

Branch: `achievements` (spec commit 0ef1305).

## Global Constraints

- No build step, no runtime dependencies; Firestore never receives `undefined`.
- 400px without horizontal scroll, CSS tokens only (light + dark), plain short copy; kg, kcal.
- Week = Saturday–Friday; key = that Saturday's `YYYY-MM-DD`.
- Values exactly as the spec: N clamp 2–6 (3 with no days); 7,700 kcal/kg; 14-day finish window; |avg| ≥ 50 kcal/day; goal "hold" when |goal − start| < 0.5 kg; XP 50 / 10 + 1 per 5 min (cardio part ≤ 30) / 10 / 20 / 100; level L needs `50·L·(L−1)`; titles Rookie 1–4, Regular 5–9, Committed 10–14, Iron 15+.
- Badge ids and names exactly as the spec table.
- `public/sw.js` `VERSION = "iron-log-v10"`; `/achievements.js` in `APP_SHELL`.

## Review Focus

1. **New device / empty offline cache:** the first snapshot (from cache) has no settings yet; the badge check must not write `seenBadges` until server data has arrived, or it would overwrite the real list and cause a toast storm later. *(Task 4 step 3: check only after a non-cache snapshot; manual 4d)*
2. **Rest-timer save after this change:** `saveSettings({rest})` must keep `seenBadges`, and the badge save must keep `rest`. *(Task 3 code step; manual 4e)*
3. **Old backups and old profiles** (no goal fields, no seenBadges) restore unchanged and don't get `null` fields added. *(Task 3 test `profile without goal fields is unchanged`)*
4. **Target weight equal to current weight, or no weight logged at goalStart** → no crash, Goal card says "hold within ±1 kg" / "Log your weight to start". *(Task 2 tests `goalProgress hold` and `goalProgress needs a start weight`)*
5. **Lifts logged before any body weight** don't earn bodyweight-ratio badges. *(Task 2 test `ratio badges need a weight on the lift date`)*

---

### Task 1: Weeks, streaks and PRs

**Files:**
- Create: `public/achievements.js`, `tests/achievements.test.js`

**Interfaces:**
- Consumes: `trainedOn(w)` from `public/workout-tools.js`.
- Produces: `weekKey(date) -> string`, `weeklyTarget(days) -> number`, `trainingStreak(workouts, days, today) -> {weeks, thisWeek, target}`, `foodStreak(food, today) -> number` (`food` is `{[date]: {meals}}`), `prEvents(workouts) -> [{date, ex}]`, `e1rm(w, r) -> number`.

- [ ] **Step 1: Write failing tests** (shared helpers at the top of `tests/achievements.test.js`):

```js
const S = (w, r) => ({ w, r });
const wo = (date, sets = [S(60, 5)], ex = "Bench Press", cardio) => ({ id: "w-" + date, date, entries: [{ ex, sets }], ...(cardio ? { cardio } : {}) });
const DAYS2 = [{ id: "a", weekdays: [6] }, { id: "b", weekdays: [2] }]; // N = 2
test("weekKey: Saturday starts the week", () => {
  assert.equal(weekKey("2026-10-17"), "2026-10-17"); // Saturday
  assert.equal(weekKey("2026-10-23"), "2026-10-17"); // Friday
  assert.equal(weekKey("2026-10-16"), "2026-10-10");
});
test("weeklyTarget", () => {
  assert.equal(weeklyTarget(DAYS2), 2);
  assert.equal(weeklyTarget([{ weekdays: [1] }]), 2);
  assert.equal(weeklyTarget([{}, {}, {}]), 3);
  assert.equal(weeklyTarget(Array(7).fill({})), 6);
  assert.equal(weeklyTarget([]), 3);
});
test("trainingStreak counts finished weeks and adds the current one when met", () => {
  const ws = ["2026-09-26","2026-09-28","2026-10-03","2026-10-05","2026-10-10","2026-10-12","2026-10-17"].map(d => wo(d));
  assert.deepEqual(trainingStreak(ws, DAYS2, "2026-10-18"), { weeks: 3, thisWeek: 1, target: 2 });
  assert.deepEqual(trainingStreak([...ws, wo("2026-10-18")], DAYS2, "2026-10-18"), { weeks: 4, thisWeek: 2, target: 2 });
});
test("trainingStreak breaks on a short week; cardio-only days count", () => {
  const ws = [wo("2026-09-26"), wo("2026-09-28"), wo("2026-10-03"),
    wo("2026-10-10"), { id: "w-2026-10-12", date: "2026-10-12", entries: [], cardio: [{ type: "bike", min: 30, intensity: "easy", kcal: null }] }];
  assert.deepEqual(trainingStreak(ws, DAYS2, "2026-10-17"), { weeks: 1, thisWeek: 0, target: 2 });
});
test("foodStreak ends today, or yesterday when today is empty", () => {
  const f = d => ({ date: d, meals: [{ id: "m", kcal: 500 }] });
  const food = { "2026-10-15": f("2026-10-15"), "2026-10-16": f("2026-10-16"), "2026-10-17": f("2026-10-17") };
  assert.equal(foodStreak(food, "2026-10-18"), 3);
  assert.equal(foodStreak(food, "2026-10-17"), 3);
  assert.equal(foodStreak({ ...food, "2026-10-14": { date: "2026-10-14", meals: [] } }, "2026-10-17"), 3);
  assert.equal(foodStreak(food, "2026-10-20"), 0);
});
test("prEvents needs 2 earlier sessions and a higher best", () => {
  const ws = [wo("2026-10-01", [S(60, 5)]), wo("2026-10-03", [S(60, 5)], "bench press"), wo("2026-10-05", [S(62.5, 5)]), wo("2026-10-07", [S(62.5, 5)])];
  assert.deepEqual(prEvents(ws), [{ date: "2026-10-05", ex: "bench press" }]);
});
```

- [ ] **Step 2:** `npm test` → FAIL (module not found).
- [ ] **Step 3:** Implement in `public/achievements.js`. `weekKey` uses `new Date(date + "T12:00:00")` and steps back to Saturday (`getDay() === 6`). `trainingStreak`: count trained days (`trainedOn`) per week key; walk back from the week before the current one while count ≥ N; add 1 when the current week's count ≥ N. `prEvents` returns lowercased exercise names.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: weeks, streaks and PR detection for achievements`

---

### Task 2: Badges, XP, levels, goal progress

**Files:**
- Modify: `public/achievements.js`, `tests/achievements.test.js`

**Interfaces:**
- Consumes: Task 1 functions; `exerciseKcal`, `weightOn`, `dayEnergy`, `bmrFor` from `public/energy.js`.
- Produces:
  - `BADGES: [{id, name, group: "milestone"|"streak"|"strength"}]` (27 entries, spec table order).
  - `badges(input) -> [{id, name, group, earned: string|null, value: number, target: number}]`, `input = {workouts, body, food, days, profile, today}`.
  - `xpSummary(input, badgeList) -> {level, title, xp, into, needed, weekXp}`; `levelFor(xp) -> {level, title, into, needed}`.
  - `goalProgress(input) -> null | {hold: true} | {needsStartWeight: true} | {direction, start, now, goalWeight, bank, target, bankPct, weightPct, loggedDays, totalDays, finish: string|null, awayFromGoal: boolean}`.

- [ ] **Step 1: Write failing tests:**

```js
const B = (list, id) => list.find(b => b.id === id);
const base = { body: [], food: {}, days: DAYS2, profile: {}, today: "2026-10-18" };
test("milestone badge earned date and locked progress", () => {
  const list = badges({ ...base, workouts: [wo("2026-10-02"), wo("2026-10-04")] });
  assert.equal(B(list, "workouts-1").earned, "2026-10-02");
  assert.deepEqual([B(list, "workouts-10").earned, B(list, "workouts-10").value, B(list, "workouts-10").target], [null, 2, 10]);
  assert.equal(list.length, 27);
});
test("ratio badges use the weight on the lift date", () => {
  const body = [{ date: "2026-10-01", weight: 80 }];
  const list = badges({ ...base, body, workouts: [wo("2026-10-05", [S(80, 1)]), wo("2026-10-06", [S(160, 1)], "Deadlift"), wo("2026-10-07", [S(119, 1)], "Squat")] });
  assert.equal(B(list, "bench-bw").earned, "2026-10-05");
  assert.equal(B(list, "deadlift-2").earned, "2026-10-06");
  assert.equal(B(list, "squat-1.5").earned, null);
});
test("ratio badges need a weight on the lift date", () =>
  assert.equal(B(badges({ ...base, body: [{ date: "2026-10-10", weight: 80 }], workouts: [wo("2026-10-05", [S(100, 1)])] }), "bench-bw").earned, null));
test("volume and cardio minute badges", () => {
  const list = badges({ ...base, workouts: [wo("2026-10-05", [S(1000, 100)], "Leg Press", [{ id: "c", type: "bike", min: 600, intensity: "easy", kcal: 300 }]),
    wo("2026-10-06", [S(10, 1)], "Leg Press", [{ id: "d", type: "bike", min: 400, intensity: "easy", kcal: 200 }])] });
  assert.equal(B(list, "volume-100t").earned, "2026-10-05");
  assert.equal(B(list, "cardio-1000").earned, "2026-10-06");
});
test("goal badges", () => {
  const profile = { goalWeight: 75, goalStart: "2026-10-01" };
  const body = [{ date: "2026-10-01", weight: 80 }, { date: "2026-10-10", weight: 78.9 }];
  const list = badges({ ...base, profile, body, workouts: [] });
  assert.equal(B(list, "goal-first-kg").earned, "2026-10-10");
  assert.equal(B(list, "goal-reached").earned, null);
});
test("streak badges", () => {
  const ws = ["2026-09-19","2026-09-21","2026-09-26","2026-09-28","2026-10-03","2026-10-05","2026-10-10","2026-10-12"].map(d => wo(d));
  assert.equal(B(badges({ ...base, workouts: ws }), "streak-4").earned, "2026-10-12");
  const food = Object.fromEntries(["10","11","12","13","14","15","16"].map(d => ["2026-10-" + d, { date: "2026-10-" + d, meals: [{ id: "m", kcal: 1 }] }]));
  assert.equal(B(badges({ ...base, food, workouts: [] }), "food-7").earned, "2026-10-16");
});
test("PR badges", () => {
  const ws = [wo("2026-10-01", [S(60, 5)]), wo("2026-10-03", [S(60, 5)]), wo("2026-10-05", [S(62.5, 5)])];
  assert.equal(B(badges({ ...base, workouts: ws }), "pr-1").earned, "2026-10-05");
});
test("levelFor thresholds and titles", () => {
  assert.deepEqual(levelFor(0), { level: 1, title: "Rookie", into: 0, needed: 100 });
  assert.deepEqual(levelFor(100), { level: 2, title: "Rookie", into: 0, needed: 200 });
  assert.deepEqual(levelFor(650), { level: 4, title: "Rookie", into: 50, needed: 400 });
  assert.equal(levelFor(1000).title, "Regular");
  assert.equal(levelFor(50 * 15 * 14).title, "Iron");
});
test("xpSummary adds workouts, cardio, meals, PRs and badges; weekXp is this week", () => {
  const input = { ...base, workouts: [wo("2026-10-17", [S(60, 5)], "Bench Press", [{ id: "c", type: "bike", min: 30, intensity: "easy", kcal: 200 }])],
    food: { "2026-10-17": { date: "2026-10-17", meals: [{ id: "m", kcal: 500 }] } } };
  const s = xpSummary(input, badges(input));
  assert.equal(s.xp, 50 + 16 + 10 + 100); // workout, cardio 10+6, meals, badge workouts-1
  assert.equal(s.weekXp, s.xp);
});
const goalInput = extra => ({ ...base, today: "2026-10-03", workouts: [],
  profile: { sex: "male", height: 180, birthYear: 1998, goal: "fat-loss", goalWeight: 75, goalStart: "2026-10-01" },
  body: [{ date: "2026-10-01", weight: 80 }, { date: "2026-10-03", weight: 79 }],
  food: { "2026-10-01": { date: "2026-10-01", meals: [{ id: "a", kcal: 1648 }] }, "2026-10-02": { date: "2026-10-02", meals: [{ id: "b", kcal: 1648 }] } }, ...extra });
test("goalProgress: bank, weight and finish date", () => {
  const g = goalProgress(goalInput());
  assert.equal(g.direction, "lose"); assert.equal(g.target, -38500); assert.equal(g.bank, -1000);
  assert.equal(g.loggedDays, 2); assert.equal(g.totalDays, 3);
  assert.equal(Math.round(g.bankPct * 1000), 26); assert.equal(g.weightPct, 0.2);
  assert.equal(g.finish, "2026-12-17"); assert.equal(g.awayFromGoal, false);
});
test("goalProgress: away from goal", () => {
  const g = goalProgress(goalInput({ food: { "2026-10-02": { date: "2026-10-02", meals: [{ id: "b", kcal: 2448 }] } } }));
  assert.equal(g.finish, null); assert.equal(g.awayFromGoal, true);
});
test("goalProgress hold", () => assert.deepEqual(goalProgress(goalInput({ profile: { goalWeight: 80.2, goalStart: "2026-10-01" } })), { hold: true }));
test("goalProgress needs a start weight", () => assert.deepEqual(goalProgress(goalInput({ body: [{ date: "2026-10-02", weight: 79 }] })), { needsStartWeight: true }));
test("goalProgress without a goal", () => assert.equal(goalProgress({ ...base, workouts: [] }), null));
```

- [ ] **Step 2:** `npm test` → new tests FAIL.
- [ ] **Step 3:** Implement. Approach for earned dates: build the sorted list of all dates that have a workout, body entry or food doc (plus `today`); walk them once keeping running totals (trained days, exercise kcal, cardio minutes, volume, PR count) and record, per badge, the first date its value reaches the target. Streak badges: compute each finished-or-current week's qualification in order; the earned date is the trained day that made the k-th consecutive qualifying week reach N; food streak badges: the k-th consecutive logged day. Exercise names for ratio badges: `same(name, "Bench Press" | "Squat" | "Deadlift")` case-insensitive. Goal: `start = weightOn(body, goalStart)`; `bank` sums `dayEnergy({bmr: bmrFor(profile, body, d)?.bmr ?? null, kg: weightOn(body, d), goal: profile.goal, workout, food})` balances for days from goalStart to today with ≥ 1 meal and non-null balance; finish = today + `Math.round((target − bank) / avg)` days.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: badges, XP levels and goal progress`

---

### Task 3: Storage: target weight, seenBadges, restore

**Files:**
- Modify: `public/backup.js`, `tests/backup.test.js`, `public/index.html` (profile form + submit, snapshot settings, `store.saveSettings`, `exportData`)

**Interfaces:**
- Produces: `state.profile.goalWeight|goalStart` (number/string or null); `state.settings.seenBadges` (string[] or `undefined` = never set); `store.saveSettings(patch)` merges `patch` into `state.settings` and writes `{rest, updated}` plus `seenBadges` when defined.

- [ ] **Step 1: Write failing tests** in `tests/backup.test.js`:

```js
test("profile goal fields are kept when valid", () => {
  const r = cleanBackupItems([{ id: "profile", data: { sex: "male", height: 180, birthYear: 1998, goal: "muscle", goalWeight: 75, goalStart: "2026-10-01" } }], OPTS);
  assert.equal(r.items[0].data.goalWeight, 75); assert.equal(r.items[0].data.goalStart, "2026-10-01");
  const bad = cleanBackupItems([{ id: "profile", data: { goalWeight: 500, goalStart: "<b>" } }], OPTS).items[0].data;
  assert.equal(bad.goalWeight, null); assert.equal(bad.goalStart, null);
});
test("profile without goal fields is unchanged", () => {
  const p = { id: "profile", data: { sex: "male", height: 180, birthYear: 1998, goal: "muscle" } };
  assert.deepEqual(cleanBackupItems([p], OPTS).items, [p]);
});
test("settings seenBadges keeps short strings only", () => {
  const r = cleanBackupItems([{ id: "settings", data: { rest: {}, seenBadges: ["workouts-1", 5, "x".repeat(50), "pr-1"] } }], OPTS);
  assert.deepEqual(r.items[0].data.seenBadges, ["workouts-1", "pr-1"]);
  assert.equal("seenBadges" in cleanBackupItems([{ id: "settings", data: { rest: {} } }], OPTS).items[0].data, false);
});
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** `backup.js`: profile adds `goalWeight` (30–300 else null) and `goalStart` (`YYYY-MM-DD` else null) **only when the key exists in the input**; settings adds `seenBadges` (strings ≤ 40, max 200) only when the input has an array.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: index.html.**
  - Profile form: field `Target weight · kg` (`name="goalWeight"`, `inputmode="decimal"`, placeholder "optional"). Submit: blank → `goalWeight:null, goalStart:null`; else number 30–300 (else toast "Target weight must be 30–300 kg"); `goalStart` = today when the value changed, else the previous `goalStart`.
  - Snapshot: `settings={rest:v.rest||{}, ...(Array.isArray(v.seenBadges)?{seenBadges:v.seenBadges}:{})}`.
  - `store.saveSettings(patch)`: `const s={...state.settings,...patch}; state.settings=s;` write `{rest:s.rest||{}, ...(s.seenBadges?{seenBadges:s.seenBadges}:{}), updated:Date.now()}`. Existing rest-timer call `saveSettings({rest:...})` keeps working.
  - `exportData` settings item includes `seenBadges` when defined.
- [ ] **Step 6:** Parse-check; `npm test`.
- [ ] **Step 7: Commit** `feat: target weight in profile, seenBadges in settings`

---

### Task 4: Goals tab and badge toasts

**Files:**
- Modify: `public/index.html` (nav, `<section id="view-goals">`, `VIEWS`, `render()` map, `renderGoals()`, CSS, toast check, store snapshot flag)

**Interfaces:**
- Consumes: Task 2 `badges`, `xpSummary`, `goalProgress`, `trainingStreak`, `foodStreak`, `weeklyTarget`; Task 3 `saveSettings`, profile fields.
- Produces: `renderGoals()`; `checkBadges()`; `state.serverSynced` (true after a snapshot with `fromCache === false`); action `set-goal` (opens the Body tab with `state.editProfile = true`).

- [ ] **Step 1: Tab:** nav button `Goals` (`data-view="goals"`, between Coach and Lifts), section `#view-goals`, add `"goals"` to `VIEWS` and `goals:renderGoals` to the render map.
- [ ] **Step 2: `renderGoals()`** builds `input={workouts:state.workouts, body:state.body, food:state.food, days:state.days, profile:state.profile, today:today()}`, `list=badges(input)`, and renders, in order:
  1. Level card: `Level L · Title`, bar `into/needed` (reuse `.ebar`), `+W XP this week`, small `X XP total`.
  2. Goal card from `goalProgress(input)`: `null` → text "Set a target weight to track your progress." + `set-goal` button; `{hold:true}` → "Your target is your current weight: hold within ±1 kg."; `{needsStartWeight:true}` → "Log your weight to start tracking this goal."; otherwise two labelled bars ("Calorie bank" `bank / target kcal`, "Weight" `start → goalWeight kg (P%)`, both signed with `−`), `Based on X of Y days with meals logged`, and `Estimated finish: <fmtDate>` or `At this pace you're moving away from your goal`.
  3. Streaks card: `Training: N weeks` with `target` dots (`●` for each trained day this week up to target, `○` for the rest, `aria-label="2 of 4 this week"`) and `2 of 4 this week`; `Food log: D days`.
  4. Badges: earned (sorted by earned date, newest first) then locked; tile = medal mark (CSS circle; accent when earned, muted when locked), name, `earned date` or `value / target` (use `toLocaleString()`; volume shown in tonnes, kcal as `12,345`).
- [ ] **Step 3: Toasts.** In `store.init`'s snapshot callback set `state.serverSynced=!snap.metadata.fromCache` before `onData()`. `checkBadges()`: return unless `state.authed && state.serverSynced`; `earned=badges(input).filter(b=>b.earned).map(b=>b.id)`; if `state.settings.seenBadges===undefined` → `store.saveSettings({seenBadges:earned})` silently; else `fresh=earned.filter(id=>!seen.includes(id))` → if any, queue toasts `Badge earned: <name>` shown one at a time every 2600 ms, and `store.saveSettings({seenBadges:[...seen,...fresh]})` once. Call `checkBadges()` after each snapshot render (inside the `store.init` callback, after `renderSoon`).
- [ ] **Step 4:** Parse-check; `npm test`; mock render of `renderGoals()` output (run the real function in Node with sample state, like the Today card mock) at 400px light + dark, with and without a goal. Fix overflow.
- [ ] **Step 5: Manual (phone):** (4a) set a target weight on Body; Goals shows both bars; (4b) earn a badge (e.g. log your 10th workout) → one toast; reload → no toast; (4c) delete that workout → badge back to locked; (4d) open the app on a second device → no toast storm; (4e) adjust rest ±15s after a badge → `seenBadges` still in the settings doc.
- [ ] **Step 6: Commit** `feat: Goals tab with level, goal progress, streaks and badges`

---

### Task 5: Release

**Files:**
- Modify: `public/sw.js`, `CLAUDE.md`

- [ ] **Step 1:** `sw.js`: `"/achievements.js"` in `APP_SHELL`; `VERSION = "iron-log-v10"`.
- [ ] **Step 2:** CLAUDE.md: files (`achievements.js`), data model (`profile.goalWeight/goalStart`, `settings.seenBadges`), features (Goals tab, badge rules summary, toasts once, first-run silent), tab list.
- [ ] **Step 3:** `npm test` all PASS; parse-check.
- [ ] **Step 4: Commit** `chore: release achievements (sw v10, docs)`
- [ ] **Step 5:** Final whole-branch review; then, with the user's go-ahead, merge to `main`, push, `firebase deploy --only hosting`; verify `sw.js` v10 and `/achievements.js` 200 live.
