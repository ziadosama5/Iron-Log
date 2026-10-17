# Faster Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rest timer with per-exercise remembered length, set-by-set prefill from last session, in-place set editing, and screen wake lock on the Workout tab.

**Architecture:** Pure logic (rest defaults, timer math, prefill, wake-lock wrapper) goes in a new ES module `public/workout-tools.js`, unit-tested with Node's built-in runner. `public/index.html` imports it and owns all DOM, events and Firestore writes. A new Firestore doc `users/{uid}/items/settings` stores per-exercise rest seconds.

**Tech Stack:** Plain JS ES modules, no build step; Firebase JS SDK 10.12.2 (Firestore); Node 24 `node --test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-10-17-faster-logging-design.md`

## Global Constraints

- No build step, no framework, no runtime dependencies. Browser code imports only relative modules and the existing gstatic Firebase URLs.
- Firestore rejects `undefined`: every written object uses explicit values or `null`.
- Free Spark plan: rest timer writes only when a rest length changes (debounced ~1.5 s), never per tick or per set.
- Mobile-first, max-width 640px, safe-area insets respected (`env(safe-area-inset-bottom)` on the bottom bar), no horizontal scroll.
- Colors only via existing CSS tokens (`--accent`, `--surface`, `--fg`, `--muted`, `--good`, ...), working in light and dark.
- Copy style: plain, direct, short. Units kg, seconds shown as `m:ss`.
- Rest clamp: 15–600 s. Adjust step: 15 s. Default 90 s; compound tiers 180 s / 150 s (see Task 1 table).
- `public/sw.js`: `/workout-tools.js` in `APP_SHELL`; `VERSION` becomes `"iron-log-v5"` in the release task.

## Review Focus

1. **Deleting the set being edited** (✕ on a row while `state.editSet` points at it or a later index) → edit mode must clear; never overwrite the wrong set. *(Task 5, manual check 5c)*
2. **Stale timer in localStorage** (app reopened hours later) → `restPhase` returns `"expired"` and the bar does not appear. *(Task 1 test `restPhase expired after 60s`, Task 4 load path)*
3. **Timer running for an exercise no longer in the workout** (removed, or user switched date/day) → bar still counts down and Skip works; ±15s still saves for that exercise name. *(Task 4, manual check 4f)*
4. **Past-date workouts** → no wake lock when `state.date !== today()`. *(Task 6 test `want false for past date` via the condition helper)*
5. **Exercise names as map keys** ("Pull-up", "Close-grip Bench Press", custom names with dots) → written with `setDoc` on the whole object, never with `updateDoc` field paths, so dots are safe. *(Task 3, manual check 3c with a custom name containing ".")*

---

### Task 1: Rest logic module + test setup

**Files:**
- Create: `package.json`, `public/workout-tools.js`, `tests/workout-tools.test.js`
- Modify: `public/sw.js` (add `"/workout-tools.js"` to `APP_SHELL`)

**Interfaces:**
- Produces (all named exports of `public/workout-tools.js`):
  - `defaultRest(exName: string) -> number` (seconds)
  - `restFor(exName: string, settings: {rest?: Object<string,number>} | null) -> number`
  - `startRest(ex: string, seconds: number, now: number) -> {ex, endsAt, total}`
  - `adjustRest(rest, deltaSec: number, now: number) -> {ex, endsAt, total}`: shifts `endsAt` by delta; `total` = old total + delta clamped to 15–600; `endsAt` never earlier than `now`
  - `remaining(endsAt: number, now: number) -> number`: whole seconds left, ceil, ≥ 0
  - `restPhase(rest | null, now: number) -> "none" | "resting" | "go" | "expired"`: `go` while `now` is in `[endsAt, endsAt+60000)`
  - `fmtClock(sec: number) -> string`
  - `REST_MIN = 15`, `REST_MAX = 600`

- [ ] **Step 1: Create `package.json`**

```json
{ "private": true, "type": "module", "scripts": { "test": "node --test" } }
```

- [ ] **Step 2: Write failing tests in `tests/workout-tools.test.js`** (`import { test } from "node:test"; import assert from "node:assert/strict";` and import from `../public/workout-tools.js`)

```js
test("defaultRest tiers", () => {
  const cases = {
    "Squat":180, "Front Squat":180, "Hack Squat":180, "Deadlift":180, "Romanian Deadlift":180,
    "Bench Press":180, "Close-grip Bench Press":180, "Overhead Press":180, "Leg Press":180,
    "Barbell Row":150, "T-bar Row":150, "Seated Cable Row":150, "One-arm Dumbbell Row":150,
    "Pull-up":150, "Chin-up":150, "Dip":150, "Hip Thrust":150, "Incline Barbell Press":150,
    "Bulgarian Split Squat":150,
    "Leg Extension":90, "Upright Row":90, "Lateral Raise":90, "Barbell Curl":90, "Plank":90,
    "My Custom Thing":90, "squat":180, "PULL-UP":150
  };
  for (const [n, s] of Object.entries(cases)) assert.equal(defaultRest(n), s, n);
});
test("restFor uses saved value", () => {
  assert.equal(restFor("Squat", { rest: { "Squat": 240 } }), 240);
  assert.equal(restFor("Squat", { rest: {} }), 180);
  assert.equal(restFor("Squat", null), 180);
});
test("startRest", () => assert.deepEqual(startRest("Dip", 150, 1000), { ex:"Dip", endsAt:151000, total:150 }));
test("adjustRest shifts and clamps", () => {
  const r = startRest("Dip", 150, 0);
  assert.deepEqual(adjustRest(r, 15, 10000), { ex:"Dip", endsAt:165000, total:165 });
  assert.equal(adjustRest(startRest("Dip", 20, 0), -15, 0).total, 15);
  assert.equal(adjustRest(startRest("Dip", 600, 0), 15, 0).total, 600);
  assert.ok(adjustRest(startRest("Dip", 30, 0), -15, 25000).endsAt >= 25000);
});
test("remaining", () => {
  assert.equal(remaining(10000, 0), 10);
  assert.equal(remaining(10000, 9500), 1);
  assert.equal(remaining(10000, 20000), 0);
});
test("restPhase", () => {
  const r = startRest("Dip", 60, 0);
  assert.equal(restPhase(null, 0), "none");
  assert.equal(restPhase(r, 59999), "resting");
  assert.equal(restPhase(r, 60000), "go");
});
test("restPhase expired after 60s", () => assert.equal(restPhase(startRest("Dip", 60, 0), 120000), "expired"));
test("fmtClock", () => {
  assert.equal(fmtClock(84), "1:24"); assert.equal(fmtClock(5), "0:05"); assert.equal(fmtClock(600), "10:00");
});
```

- [ ] **Step 3: Run `npm test`**: expect FAIL (module not found).

- [ ] **Step 4: Implement the exports in `public/workout-tools.js`.** `defaultRest` uses case-insensitive regex rules checked in this order (first match wins):
  1. `/upright row|leg extension/` → 90
  2. `/split squat|row\b|pull-?up|chin-?up|\bdips?\b|hip thrust|incline (barbell|bench)/` → 150
  3. `/squat|deadlift|\brdl\b|bench press|overhead press|military press|leg press/` → 180
  4. otherwise 90

- [ ] **Step 5: Run `npm test`**: expect all PASS.

- [ ] **Step 6: Add `"/workout-tools.js"` to `APP_SHELL` in `public/sw.js`.**

- [ ] **Step 7: Commit** `feat: add rest timer logic module with unit tests`

---

### Task 2: Smarter prefill

**Files:**
- Modify: `public/workout-tools.js`, `tests/workout-tools.test.js`, `public/index.html` (`defaults()` near line 450, `renderLog` line ~404, `add-set` handler line ~971, module import line ~200)

**Interfaces:**
- Produces: `prefillFor(entry: {sets:[{w,r}]}, last: {sets:[{w,r}]} | null) -> {w: string, r: string}`. Weight formatted like the existing `kg()` (`String(Math.round(w*100)/100)`).

- [ ] **Step 1: Write failing tests**

```js
const L = { sets: [{w:60,r:8},{w:62.5,r:6},{w:65,r:5}] };
test("prefill: set N from last session set N", () =>
  assert.deepEqual(prefillFor({ sets:[{w:60,r:8}] }, L), { w:"62.5", r:"6" }));
test("prefill: beyond last session repeats today's last set", () =>
  assert.deepEqual(prefillFor({ sets:[{w:60,r:8},{w:62.5,r:6},{w:65,r:5},{w:65,r:4}] }, L), { w:"65", r:"4" }));
test("prefill: first set from last session set 0", () =>
  assert.deepEqual(prefillFor({ sets:[] }, L), { w:"60", r:"8" }));
test("prefill: no history", () =>
  assert.deepEqual(prefillFor({ sets:[] }, null), { w:"20", r:"8" }));
test("prefill: today's sets but no last session", () =>
  assert.deepEqual(prefillFor({ sets:[{w:40,r:10}] }, null), { w:"40", r:"10" }));
```

- [ ] **Step 2: Run `npm test`**: expect the 5 new tests FAIL.
- [ ] **Step 3: Implement `prefillFor`** following the spec's 4 branches in order.
- [ ] **Step 4: Run `npm test`**: expect PASS.
- [ ] **Step 5: Wire into `index.html`.** Import `prefillFor` (and Task 1's exports) from `./workout-tools.js` in the existing `<script type="module">`. Delete `defaults()`; in `renderLog` use `ui[e.ex] || (ui[e.ex] = prefillFor(e, last))`. In the `add-set` handler replace `ui[en.ex]={w:kg(wt),r:String(r)}` with `delete ui[en.ex]` so the next prefill applies.
- [ ] **Step 6: Manual check** (`firebase serve`, http://localhost:5000): with a past session of 3 differing sets, opening that exercise today and tapping Add set 3 times without touching steppers reproduces the same 3 sets; a 4th tap repeats set 3. Typing a value before Add set still uses the typed value.
- [ ] **Step 7: Commit** `feat: prefill set N from last session's set N`

---

### Task 3: Settings doc in storage + backup

**Files:**
- Modify: `public/index.html`: `state` init (line ~254), `store.init` snapshot (line ~278), `store` object, signed-out reset (line ~273), `exportData`/`importData` (lines ~880–900)

**Interfaces:**
- Produces: `state.settings: {rest: Object<string,number>}` (always defined, default `{rest:{}}`); `store.saveSettings(s)` writes `{rest: s.rest, updated: Date.now()}` to doc id `"settings"` via `this.write`.

- [ ] **Step 1:** Add `settings:{rest:{}}` to the initial `state`; reset it on sign-out alongside `profile`.
- [ ] **Step 2:** In the snapshot loop add `else if(d.id==="settings") settings={rest:v.rest||{}}` **before** the workout fallthrough; assign `state.settings=settings` (default `{rest:{}}` when missing).
- [ ] **Step 3:** Add `saveSettings(s)` to `store` (updates `state.settings`, then `this.write("settings", {...})`).
- [ ] **Step 4:** `exportData` adds `{id:"settings", data:{rest:state.settings.rest, updated:Date.now()}}`; `importData`'s regex becomes `/^(w-|b-)\d{4}-\d{2}-\d{2}$|^program$|^profile$|^settings$/`.
- [ ] **Step 5: Manual check:** (a) from the devtools console call `store.saveSettings({rest:{"Squat":200}})` (temporarily expose `window.store` only while testing, then remove); reload: History shows no phantom workout and `state.settings.rest.Squat===200`. (b) Download backup: JSON contains a `settings` item; restoring it reports it among restored items. (c) Save a custom name containing a dot (`"Smith 2.0 Squat"`): it round-trips after reload.
- [ ] **Step 6: Commit** `feat: add settings doc for per-exercise rest`

---

### Task 4: Rest bar UI

**Files:**
- Modify: `public/index.html`: CSS block, markup next to `#toast` (line ~196), `add-set` handler, click `switch`, init code

**Interfaces:**
- Consumes: Task 1 `restFor, startRest, adjustRest, remaining, restPhase, fmtClock, REST_MIN, REST_MAX`; Task 3 `state.settings`, `store.saveSettings`.
- Produces: `state.rest` (`{ex,endsAt,total}` or `null`); `clearRest()`; `startRestFor(exName)`. Task 5 relies on `add-set` being the only caller of `startRestFor`.

- [ ] **Step 1: Markup + CSS.** `<div class="restbar" id="restbar" hidden role="timer" aria-live="off">` containing a label span (`Rest · <exercise>` / `Rest over · <exercise>`), a `.num` clock span, and buttons `data-act="rest-adj" data-d="-15"` (`−15s`), `data-d="15"` (`+15s`), `data-act="rest-skip"` (`Skip`). Fixed to bottom, full width, inner content max-width 640px, `padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px))`, surface background with top border. `.restbar.go` uses `--accent` background with contrasting text. When the bar is visible add `body.has-restbar{padding-bottom:<bar height>}` so it never covers "Add set". Stack above content, below `#toast`.
- [ ] **Step 2: Timer state.** `startRestFor(ex)`: `state.rest = startRest(ex, restFor(ex, state.settings), Date.now())`, persist to `localStorage["ironlog.rest"]` (try/catch), unlock audio (Step 4), start the tick. `clearRest()`: null state, remove key, hide bar, stop tick. Tick = `setInterval` 250 ms that updates only the bar's text/class via `restPhase`: `resting` → clock = `fmtClock(remaining(...))`; first transition to `go` → alert once (Step 4); `expired` → `clearRest()`. On app start, read `ironlog.rest`; if `restPhase` is `resting` or `go`, resume the tick, else drop the key.
- [ ] **Step 3: Events.** `add-set` calls `startRestFor(en.ex)` after saving. `rest-adj`: `state.rest = adjustRest(state.rest, +b.dataset.d, Date.now())`, persist, refresh bar, then debounce 1.5 s → `store.saveSettings({rest:{...state.settings.rest, [state.rest.ex]: state.rest.total}})`. Pressing ± in `go` phase restarts resting from now with the adjusted total. `rest-skip` → `clearRest()`.
- [ ] **Step 4: Alert.** Create one `AudioContext` lazily inside the `add-set` click (and `resume()` it) so later beeps are allowed. On `go`: `navigator.vibrate?.([200,100,200])`, then a ~0.25 s 880 Hz sine beep via an oscillator with a quick gain ramp, all in try/catch. Visual `go` class always applies.
- [ ] **Step 5: Manual check:** (a) Add set on Squat shows `Rest · Squat 3:00` counting down; Lateral Raise shows 1:30. (b) +15s twice → reload → next Squat rest starts at 3:30, one Firestore write (Network tab). (c) Bar visible on every tab and doesn't cover Add set at 400px width. (d) Reaching zero: Go state, vibration on Android, beep. (e) Switch apps 30 s and return: clock correct. Reload mid-rest: bar resumes. (f) Remove the exercise mid-rest: bar keeps counting, Skip clears. (g) Dark mode readable.
- [ ] **Step 6: Commit** `feat: rest timer bar with per-exercise remembered rest`

---

### Task 5: Edit logged sets

**Files:**
- Modify: `public/index.html`: `renderLog` set table + adder (lines ~408–420), click `switch` (`rm-set`, `open-ex`, `close-ex`, `rm-ex`, `change-day`, date change), CSS

**Interfaces:**
- Consumes: existing `store.save`, `ensureWorkout`, `ui`.
- Produces: `state.editSet: {ex: string, si: number} | null`.

- [ ] **Step 1: Render.** Each set row gets `data-act="edit-set" data-ei data-si` (the row's ✕ button keeps its own `data-act`, so the delegated handler hits the button first). The edited row gets class `editing` (accent-tinted background). When `state.editSet` matches the open exercise: steppers show that set's values, the primary button is `data-act="save-set"` labelled **Save set**, plus a ghost `data-act="cancel-edit"` **Cancel** button, and a small label "Editing set N".
- [ ] **Step 2: Handlers.** `edit-set`: set `state.editSet`, `ui[ex]={w:kg(s.w), r:String(s.r)}`, `renderLog()`. `save-set`: validate like `add-set` (same toast), replace `sets[si]`, `store.save(w)`, clear `editSet` and `delete ui[ex]`, `renderLog()`; does **not** call `startRestFor`. `cancel-edit`: clear `editSet`, `delete ui[ex]`, `renderLog()`.
- [ ] **Step 3: Clear edit mode** in `open-ex`, `close-ex`, `rm-ex`, `change-day`, date change, and in `rm-set` whenever the deleted index is ≤ `editSet.si` for that exercise.
- [ ] **Step 4: Manual check:** (a) tap set 2 → steppers show its values, "Editing set 2"; change reps → Save set → table updated, rest bar unchanged. (b) Cancel restores normal Add set with prefill. (c) While editing set 2, delete set 1 → edit mode clears, set 2 (now set 1) untouched. (d) PR badge recomputes after editing a set into a PR.
- [ ] **Step 5: Commit** `feat: tap a logged set to edit it`

---

### Task 6: Keep screen awake

**Files:**
- Modify: `public/workout-tools.js`, `tests/workout-tools.test.js`, `public/index.html` (end of `render()` and `renderLog()`)

**Interfaces:**
- Produces:
  - `shouldWake({view, date, today, exerciseCount}) -> boolean`: `view==="log" && date===today && exerciseCount>0`
  - `createWakeLock(env = globalThis) -> {want(on: boolean): void}`: uses `env.navigator.wakeLock.request("screen")`, holds the sentinel, releases when `want(false)`, re-requests on `env.document` `visibilitychange` when visible and still wanted, swallows all errors, no-op if `env.navigator.wakeLock` is missing.

- [ ] **Step 1: Write failing tests**

```js
test("shouldWake", () => {
  assert.equal(shouldWake({view:"log", date:"2026-10-17", today:"2026-10-17", exerciseCount:3}), true);
  assert.equal(shouldWake({view:"body", date:"2026-10-17", today:"2026-10-17", exerciseCount:3}), false);
  assert.equal(shouldWake({view:"log", date:"2026-10-17", today:"2026-10-17", exerciseCount:0}), false);
});
test("want false for past date", () =>
  assert.equal(shouldWake({view:"log", date:"2026-10-10", today:"2026-10-17", exerciseCount:3}), false));
test("createWakeLock acquires once, releases, reacquires on visible", async () => {
  // fake env: navigator.wakeLock.request counts calls and returns {release(){released++}};
  // document has addEventListener capturing the handler and visibilityState settable
  // want(true) twice -> 1 request; want(false) -> 1 release;
  // want(true), simulate browser dropping lock (visibilityState "hidden"), then "visible" + handler() -> 2nd request
});
test("createWakeLock no-op without API", () => {
  assert.doesNotThrow(() => createWakeLock({ navigator:{}, document:{ addEventListener(){} } }).want(true));
});
```
(Flesh the third test out with the fake described in the comments; `await` a microtask after each `want` since `request` is async.)

- [ ] **Step 2: Run `npm test`**: expect new tests FAIL.
- [ ] **Step 3: Implement** both exports.
- [ ] **Step 4: Run `npm test`**: expect PASS.
- [ ] **Step 5: Wire.** One module-level `const wake = createWakeLock();` and `syncWake()` calling `wake.want(shouldWake({view:state.view, date:state.date, today:today(), exerciseCount:(workoutFor(state.date)?.entries.length)||0}) && state.authed)`. Call it at the end of `render()` and `renderLog()`.
- [ ] **Step 6: Manual check (phone, Chrome Android):** on today's workout the screen doesn't dim past the system timeout; on the Body tab it does; after switching apps and back it stays awake.
- [ ] **Step 7: Commit** `feat: keep screen awake during today's workout`

---

### Task 7: Release

**Files:**
- Modify: `public/sw.js`, `CLAUDE.md`

- [ ] **Step 1:** `VERSION = "iron-log-v5"` in `public/sw.js`.
- [ ] **Step 2:** Update `CLAUDE.md`: files list (`workout-tools.js`, `tests/`, `package.json`, `npm test`), data model table (`settings` row), Workout tab features (rest timer, prefill, edit sets, wake lock), and remove "Rest timer" from "Ideas not built yet".
- [ ] **Step 3:** `npm test`: all PASS. Run the whole manual checklist from Tasks 2–6 once more on `firebase serve`.
- [ ] **Step 4: Commit** `chore: release faster logging (sw v5, docs)`
- [ ] **Step 5:** Ask the user before `git push` and `firebase deploy --only hosting`. After deploying, check on the phone that the new version loads (reopen the app twice so the service worker updates).
