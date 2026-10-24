# Set Types, Targets and Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a person mark sets as warm-up or drop set, count every statistic correctly, give every exercise an editable target (sets x rep range), and show "what to try today" on the exercise card with set 1 pre-filled.

**Architecture:** A new pure module `public/progression.js` owns set types, the counting filters, default targets, the weight step and `suggestNext`. The pure stat modules (achievements, overview, social, workout-tools) and the single `index.html` use its filters. Targets live in `settings.targets`; the set marker `k` lives on each set.

**Tech Stack:** plain ES modules, no build; Node test runner (`npm test`), Playwright harness (`tests-ui`).

**Spec:** `docs/superpowers/specs/2026-10-24-set-types-and-progression-design.md`

## Global Constraints
- Files are CRLF in git on Windows (autocrlf). Edit with the Edit/Write tools or a CRLF-tolerant helper script; shell heredocs eat backslashes, so never put regexes through them.
- Every visible string needs an Arabic entry in `public/lang-ar.js` (`npm test` lists what is missing). No glued strings: `t("... {n}", {n})`. Digits 0-9, Latin units (`kg`). Steppers stay LTR (`dir="ltr"`). Targets 44px minimum, text 12px minimum.
- Defaults must not change anything for existing data: a set without `k` is normal; no `settings.targets` means computed defaults; with no suggestion, prefill behaves exactly as today.
- Set marker `k`: `"w"` warm-up, `"d"` drop set, absent = normal. Target: `{sets: int 1-10, min: int 1-50, max: int 1-50, min <= max}`.
- Counting: PRs / e1RM / best sets / progression / "last time" / prefill = normal sets only; volume and sets-per-muscle = normal + drop; workout time, lifting kcal, rest timer and `trainedOn` use every set (unchanged).
- Round-trip rule: a new field must be carried by the snapshot parser, the save function, `settingsDoc`, `cleanSettings`/`cleanWorkout` (backup) or it is silently dropped.
- Bump `VERSION` in `public/sw.js` to `iron-log-v44`; add `/progression.js` to `APP_SHELL`. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus
- A workout with only warm-ups must not crash any stat (empty working sets: `Math.max(...[])`, divide by zero, `last.sets[0]` undefined) and must not create PRs or "last time" lines.
- Editing a logged set (`save-set`) must keep both its type `k` and its time `t`; restoring a backup must keep `k`.
- The first working set after a warm-up still gets the suggestion pre-fill (prefill is decided by working sets, not by total sets).
- Invalid or hand-edited targets (`min > max`, `0`, strings, huge) behave like "no saved target"; an exercise name that is a prototype key (`constructor`) must not break lookups.
- Same exercise logged under different capitalisation (`same(a,b)` in index.html) still finds its history and its saved target.
- Arabic/RTL: chips, tags and the target editor render and keep LTR steppers.

---

### Task 1: The progression module

**Files:**
- Create: `public/progression.js`, `tests/progression.test.js`
- Modify: `public/sw.js` (APP_SHELL only; version is bumped in Task 6)

**Interfaces:**
- Produces: `SET_TYPES = ["normal","warmup","drop"]`; `setType(s) -> "normal"|"warmup"|"drop"` (from `s.k`; anything else normal); `kOf(type) -> "w"|"d"|undefined`; `isWorking(s)`, `countsForVolume(s)`, `countsAsSet(s)`; `workingSets(sets)`, `volumeSets(sets)`, `countedSets(sets)` (array in, filtered array out; non-arrays give `[]`); `validTarget(t) -> boolean`; `cleanTargets(obj) -> {}` (own valid entries only, keys up to 80 chars, at most 300); `defaultTarget(exName) -> {sets, min, max}`; `targetFor(settings, exName) -> {sets, min, max}`; `stepFor(exName) -> 2.5|5`; `suggestNext({last, target, step}) -> null | {kind:"increase"|"hold", w, r, low?}`.
- Reuses the big-compound regexes of `defaultRest` (workout-tools.js) by exporting a shared `BIG_COMPOUND`/`MID_COMPOUND` pair from `progression.js` only if that avoids duplication; otherwise a local copy with a test that pins agreement.

- [ ] **Step 1: Write the failing tests** in `tests/progression.test.js`:
  - `setType`: `{k:"w"}` warmup, `{k:"d"}` drop, `{}`, `{k:"x"}`, `{k:1}`, `null` normal. `kOf("warmup")` is `"w"`, `kOf("normal")` is `undefined`.
  - Filters on `[{w:20,r:10,k:"w"},{w:80,r:8},{w:60,r:12,k:"d"}]`: `workingSets` has 1 (the 80), `volumeSets` has 2, `countedSets` has 2; `workingSets(undefined)` is `[]`.
  - `validTarget`: `{sets:3,min:8,max:12}` true; `{sets:0,...}`, `{min:12,max:8}`, `{sets:11}`, `{min:0}`, `{max:51}`, `{sets:"3"}`, `{sets:3.5}`, `null` false. `cleanTargets({"Bench Press":{sets:3,min:5,max:8}, "x":{sets:99}, "constructor":{sets:3,min:8,max:12}})` keeps Bench Press and `constructor` as own plain keys and drops x.
  - `defaultTarget`: `"Barbell Squat"`, `"Deadlift"`, `"Bench Press"`, `"Overhead Press"` -> `{3,5,8}`; `"Lat Pulldown"`, `"Dumbbell Row"` -> `{3,8,12}`; `"Lateral Raise"`, `"Bicep Curl"`, `"Calf Raise"` -> `{3,10,15}` (choose the isolation test by `muscleOf`/name from exercise-library: shoulders-lateral/arms/calves/abs); unknown custom name -> `{3,8,12}`.
  - `targetFor`: saved valid target wins; saved invalid (`min>max`) falls back to default; `targetFor(undefined, "Squat")` and `targetFor({targets:{}}, "constructor")` do not throw.
  - `stepFor`: `"Barbell Squat"`, `"Deadlift"`, `"Leg Press"`, `"Barbell Row"`, `"Hip Thrust"` -> 5; `"Bench Press"`, `"Lateral Raise"` -> 2.5.
  - `suggestNext` with `target {sets:3,min:5,max:8}`, `step 2.5`:
    - three sets `80x8` -> `{kind:"increase", w:82.5, r:5}`.
    - `80x8, 80x8, 80x7` -> `{kind:"hold", w:80, r:8}` (lowest at top weight 7, +1, capped at max).
    - `80x6, 80x6, 80x5` -> `{kind:"hold", w:80, r:6}`.
    - `80x4, 80x4, 80x4` -> `{kind:"hold", w:80, r:5, low:true}`.
    - two sets `80x8, 80x8` (fewer than target.sets) -> hold, not increase.
    - warm-ups and drop sets in `last` are ignored (`[{w:40,r:10,k:"w"},{w:80,r:8}x3,{w:60,r:12,k:"d"}]` -> increase 82.5).
    - mixed weights `[60x12, 80x8, 80x8, 80x8]` -> judged at the top weight 80 -> increase.
    - `null`, `[]`, only warm-ups, and top weight 0 (`0x15`) -> `null`.
    - rounding: `step 2.5` on `82.25x8` x3 -> `84.75`.
- [ ] **Step 2: Run to verify they fail.** Run: `node --test tests/progression.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `public/progression.js`** per the Interfaces block and the rules in the spec's "Pure module" section. `suggestNext` receives the previous session's sets (it applies `workingSets` itself).
- [ ] **Step 4: Add `/progression.js` to `APP_SHELL` in `public/sw.js`.**
- [ ] **Step 5: Run.** `npm test`. Expected: all pass.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat: progression.js (set types, counting filters, default targets, suggestNext)"`

### Task 2: Counting rules in the pure modules

**Files:**
- Modify: `public/achievements.js`, `public/overview.js`, `public/social.js`, `public/workout-tools.js`
- Test: `tests/achievements.test.js`, `tests/overview.test.js`, `tests/social.test.js`, `tests/workout-tools.test.js`

**Interfaces:**
- Consumes: Task 1 filters.
- Produces: `prefillFor(entry, last, suggest?)` where `last` is a session `{sets}` and `suggest` is `{w, r}` or undefined. Behaviour: uses working sets only (`workingSets(entry.sets)`, `workingSets(last.sets)`); with `suggest` and no working set logged today it returns `{w: String(rounded suggest.w), r: String(suggest.r)}`; otherwise the old rule on the working sets (same position in last session, else repeat today's last working set, else last session's first working set, else `{w:"20",r:"8"}`).

- [ ] **Step 1: Write the failing tests.**
  - `achievements`: `prEvents` / PR counting ignores a heavy warm-up and a drop set (a session whose only heavy-looking sets are `k:"w"` is not a PR); the weekly/total `volume` metric (`m.volume`) excludes warm-ups and includes drop sets; a workout containing only warm-ups does not throw and yields no PR.
  - `overview`: `topLifts` best e1RM ignores warm-up and drop sets; an exercise with only warm-ups does not appear.
  - `social`: `buildSummary(...).volumeWeekKg` excludes warm-ups and includes drop sets (build one workout with a 100x10 warm-up, 60x10 normal, 40x10 drop: expected volume = 60*10 + 40*10 = 1000).
  - `workout-tools`: `prefillFor` ignores warm-ups and drops in both `entry` and `last`; with a suggestion and an entry that has only a warm-up it still returns the suggestion; with a suggestion and one working set already it repeats that set; with no suggestion nothing changes (existing tests stay green); `last` with only warm-ups falls back to the starter `{w:"20", r:"8"}`.
- [ ] **Step 2: Run to verify they fail.** `npm test`. Expected: only the new cases fail.
- [ ] **Step 3: Implement.** In `achievements.js` apply `workingSets` before the best-e1RM maths (line ~59, `prEvents`) and `volumeSets` in the per-day volume sum (~154); `overview.js` `topLifts` uses `workingSets` (~52); `social.js` volume uses `volumeSets` (~59); `workout-tools.js` `prefillFor` as above (import from `./progression.js`). Keep `Math.max(0, ...[])` safe on empty arrays.
- [ ] **Step 4: Run.** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat: warm-ups and drop sets are counted correctly in PRs, volume, prefill and the shared summary"`

### Task 3: Saving and restoring the new fields

**Files:**
- Modify: `public/ui-helpers.js` (`settingsDoc`), `public/backup.js` (`cleanWorkout`, `cleanSettings`), `public/index.html` (snapshot parser `settings=` branch only)
- Test: `tests/ui-helpers.test.js`, `tests/backup.test.js`

**Interfaces:**
- Consumes: Task 1 `cleanTargets`, `validTarget`.
- Produces: `settingsDoc(s, now)` includes `targets` when `s.targets` is an object with at least one entry (omitted otherwise, like `gym`); backup keeps `k` and `targets`.

- [ ] **Step 1: Write the failing tests.**
  - `settingsDoc({rest:{}, targets:{"Squat":{sets:3,min:5,max:8}}}, 1)` contains `targets`; without targets or with `{}` the result has no `targets` key (existing expectations unchanged).
  - `cleanBackupItems` workout set `{w:80,r:8,t:123,k:"w"}` keeps `k` and `t`; `{k:"x"}` and `{k:1}` lose `k`; a set without `k` is byte-identical to before.
  - Settings item with `targets` keeps valid entries and drops invalid ones (`min>max`, `sets:99`, string values); a settings item without `targets` comes back unchanged.
- [ ] **Step 2: Run to verify they fail.** `npm test`. Expected: only the new cases fail.
- [ ] **Step 3: Implement.** `settingsDoc` adds `...(x.targets && Object.keys(x.targets).length ? {targets: x.targets} : {})`. `cleanWorkout` set mapper adds `k` when `"w"|"d"`. `cleanSettings` adds `out.targets = cleanTargets(d.targets)` when it has entries. In `index.html` the settings snapshot branch (line ~611) adds `...(v.targets && typeof v.targets==="object" ? {targets: cleanTargets(v.targets)} : {})` (import `cleanTargets`).
- [ ] **Step 4: Run.** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat: set types and targets are saved, exported and restored"`

### Task 4: Set types on the workout screen

**Files:**
- Modify: `public/index.html`, `public/lang-ar.js`
- Test: `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: Task 1 filters and `kOf`/`setType`.
- Produces: `state.setKind` (`"normal"|"warmup"|"drop"`, session only, reset to `"normal"` after every added set and by `stopEditing`), actions `set-kind` (`data-k`), CSS class `.settag`.

- [ ] **Step 1: Write the failing UI tests first** (names start with `set types:`): (a) three chips Normal / Warm-up / Drop set above "Add set" (`aria-pressed`, default Normal); (b) choosing Warm-up then adding a set shows a Warm-up tag on that row, no PR badge on it, and the chip is back on Normal; (c) a drop set shows a Drop tag and no PR badge; (d) tapping a logged warm-up row loads it into the steppers with the Warm-up chip pressed, "Save set" keeps it a warm-up, and switching the chip to Normal then saving makes it a normal set (tag gone); (e) the "Last time" line of an exercise whose only previous sets were warm-ups says "First time logging this one."; (f) a finished workout card / History row counts sets and volume without the warm-ups (compute from the harness history); (g) Arabic: chips render, steppers LTR. Run: `cd tests-ui && node --test --test-name-pattern="set types" smoke.test.mjs`. Expected: FAIL.
- [ ] **Step 2: Counting in `index.html`.** Import the filters. `sessionsFor` returns `{date, sets: workingSets(e.sets)}` and skips sessions with no working sets (this feeds `lastBefore`, `bestBefore`, the Lifts view and Coach lift trends); the set-row PR badge and `runBest` use only `isWorking` sets; the "New PR" toast in `add-set` only for a new normal set; workout summary (`completeCard`, ~1331) and History rows (~2517) use `countedSets` for the set count and `volumeSets` for volume; sets-per-muscle (~1879) uses `countedSets`; the Coach export (~2353) lists `countedSets` only.
- [ ] **Step 3: Chips and tags.** Above the Add/Save button in `focusCard` render `<div class="chips" role="group" aria-label="Set type">` with three `button.chip[data-act="set-kind"][data-k]`, `aria-pressed` from `state.setKind`. Each logged row shows `<span class="settag">{Warm-up|Drop}</span>` after the set number. `add-set` pushes `{w,r,t,...(k?{k}:{})}` then sets `state.setKind="normal"`; `edit-set` sets `state.setKind` from the set; `save-set` rewrites the set with `t` and `k` preserved from the chosen chip (not from the old set); `stopEditing` resets `setKind`. `set-kind` handler sets the state and calls `renderLog()` (typed weight/reps survive in `ui[ex]`).
- [ ] **Step 4: CSS and Arabic.** `.settag` small pill (12px+, uses tokens, no hardcoded blue); chips meet 44px. Arabic: "Set type", "Normal", "Warm-up", "Drop set" and the tag texts.
- [ ] **Step 5: Run.** `npm test`, then the `set types` UI tests. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat: warm-up and drop set chips, tags and correct counting on the workout screen"`

### Task 5: Targets and progression advice on the exercise card

**Files:**
- Modify: `public/index.html`, `public/lang-ar.js`
- Test: `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: Task 1 `targetFor`, `stepFor`, `suggestNext`, `validTarget`; Task 2 `prefillFor(entry,last,suggest)`; Task 3 `settings.targets` persistence through `store.saveSettings({targets})`.
- Produces: `state.targetEdit` (exercise name being edited or null), actions `target-edit`, `tgt-step` (`data-f` = sets|min|max, `data-d` = -1|1), `tgt-reset`, `tgt-done`; `adviceFor(ex)` returning the advice text or `""`.

- [ ] **Step 1: Write the failing UI tests first** (names start with `targets:`): (a) every exercise card shows "Target 3 × 5–8" style text (default for Bench Press) and a tappable control; (b) tapping it opens the editor, `+` on max raises it, `−` on min lowers it, min can never exceed max (steppers clamp), Done closes it and the line shows the new values; the choice survives a page reload (settings saved); (c) "Reset to default" removes the saved target and the default shows again; (d) with a history whose last session hit the top of the range on every target set (seed through the harness query or an init script that edits the harness history; pick the simplest way the harness already supports and document it in the test) the card shows "Try {w + step} kg × {min}" and set 1's weight/reps inputs are pre-filled with it; (e) a last session that did not reach the top shows the "Same weight" advice and keeps today's prefill weight; (f) a logged warm-up does not remove the suggestion for the first working set's pre-fill; (g) steppers in the editor are LTR in Arabic. Run: `node --test --test-name-pattern="targets:" smoke.test.mjs`. Expected: FAIL.
- [ ] **Step 2: Wire the data.** `focusCard`: `const target = targetFor(state.settings, e.ex)`, `const sug = suggestNext({last: last && last.sets, target, step: stepFor(e.ex)})`, `ui[e.ex] = prefillFor(e, last, sug)`. Show under "Last time": the target chip (`Target {sets} × {min}–{max}`, `data-act="target-edit"`) and the advice line from `sug` (increase: "Try {w} kg × {r}"; hold: "Same weight: aim for {r} on every set"; hold with `low`: "Same weight: build up to {r} reps"; none: no line).
- [ ] **Step 3: The editor.** When `state.targetEdit` is this exercise, render three LTR stepper rows (Sets 1-10, Min reps, Max reps; each `−`/`+` is a `button` with `data-act="tgt-step"`) plus "Reset to default" and "Done". `tgt-step` changes the working copy with clamping (`min <= max`, ranges per Global Constraints) and saves debounced (1500 ms, like the rest time) through `store.saveSettings({targets: {...state.settings.targets, [ex]: next}})`; `tgt-reset` saves `targets` without that key; both redraw. Do not save a target equal to the default unless the person changed it.
- [ ] **Step 4: Arabic.** Add every new string ("Target", the three advice texts, editor labels, "Reset to default", "Done"); run `npm test` to list anything missing.
- [ ] **Step 5: Run.** `npm test`, then the `targets:` UI tests. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat: per-exercise targets and 'what to try today' advice with pre-filled first set"`

### Task 6: Release

**Files:**
- Modify: `public/sw.js`, `CLAUDE.md`, `docs/README.md`, `docs/open-points.md`

- [ ] **Step 1: Full suites.** `npm test`; `cd tests-ui && npm test` (one copy at a time; includes the 44px / 12px checks). Expected: all pass.
- [ ] **Step 2: Docs and version.** `sw.js` `VERSION` to `iron-log-v44`. CLAUDE.md: `w-` row (`sets:[{w,r,t?,k?}]`, `k` meaning), `settings` row (`targets?`), files list (`progression.js`), the workout Features bullet (set types, targets, advice, counting rules). `docs/README.md`: sub-project 21 with spec and plan links. `docs/open-points.md`: remove "target sets/reps and progression" and "warm-up / drop set types" from the unfinished-projects list and the ideas list, keeping the remaining training-depth pieces (bodyweight mode, injuries, several gyms).
- [ ] **Step 3: Commit.** `git add -A && git commit -m "docs and sw v44 for set types, targets and progression"`
