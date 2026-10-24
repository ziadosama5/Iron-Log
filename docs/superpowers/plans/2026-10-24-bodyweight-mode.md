# Bodyweight Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bodyweight exercises log reps with an optional extra load (negative = assisted), statistics and progression advice treat them correctly, and any exercise can be flipped between weighted and bodyweight.

**Architecture:** A new pure module `public/bodyweight.js` decides what is bodyweight (library default plus `settings.bodyweight` overrides), scores sets and formats loads. `progression.js` gets a bodyweight branch in `suggestNext` and bodyweight default targets. A workout entry records `bw: true` when its first set is logged, so the pure statistics modules read the entry and never need the settings. The workout screen and Lifts view adapt.

**Tech Stack:** plain ES modules, no build; Node test runner (`npm test`), Playwright harness (`tests-ui`).

**Spec:** `docs/superpowers/specs/2026-10-24-bodyweight-mode-design.md`

## Global Constraints
- Windows, files are CRLF in git (autocrlf). Edit with the Edit/Write tools or a small Node patch script written with the Write tool. **Never put a regex or a `\b`/`\n` inside a shell heredoc**: backslashes get eaten or turned into control characters (this has bitten this repo twice). Verify with `grep -c $'\x08'` if in doubt.
- Every visible string needs an Arabic entry in `public/lang-ar.js` (`npm test` lists what is missing). No glued strings: `t("... {n}", {n})`. Digits 0-9, Latin units. Steppers stay LTR. Targets 44px minimum, text 12px minimum.
- Defaults change nothing for existing data: no `bw` on an entry and no `settings.bodyweight` mean weighted behaviour exactly as today; a weighted exercise's `w` stays 0..2000.
- Bodyweight entry: `{ex, sets, done?, bw: true}`; set `w` = extra kg, range -500..2000 on `bw` entries only; on holds (Plank, Side Plank, Wall Sit) `r` is seconds (1-1000).
- `settings.bodyweight`: `{ "<exercise>": boolean }`, stored only where it differs from `bwDefault`, at most 300 entries, names up to 80 characters, written only through `settingsDoc()`.
- Round-trip rule: a new field must be carried by the snapshot parser, `store.saveSettings`, `settingsDoc`, `cleanSettings`/`cleanWorkout` (backup) or it is silently dropped.
- Bump `VERSION` in `public/sw.js` to the next number after the current one (check the file; v44 is live at the time of writing, so `iron-log-v45`) and add `/bodyweight.js` to `APP_SHELL`. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus
- A first-time bodyweight set must not be pre-filled with the weighted starter `20 kg`, and a plain `0` extra must be accepted by `readSet`; a negative number must be refused on weighted entries.
- Assisted sets (negative `w`) must never make volume negative, never produce an e1RM, and must order correctly (less assistance = better).
- An exercise logged as weighted earlier and as bodyweight later (switch flipped between workouts) must not compare e1RM numbers with bodyweight scores (separate PR histories).
- `entry.bw` missing on old data = weighted; backups from before this change restore unchanged; a negative `w` on a non-`bw` entry in a backup is dropped.
- Hold exercises: no weight suggestions, the reps label says seconds, target editor allows up to 600.
- Prototype-like exercise names (`constructor`) in `settings.bodyweight`.

---

### Task 1: The bodyweight module

**Files:**
- Create: `public/bodyweight.js`, `tests/bodyweight.test.js`
- Modify: `public/sw.js` (APP_SHELL only)

**Interfaces:**
- Produces: `BW_STATIONS` (`["bench","decline-bench","pullup-bar","dip-station","captains-chair","box","ab-wheel","hyper-bench","assisted-machine"]`); `bwDefault(name) -> boolean` (in the library via `muscleOf(name) !== null` AND every id of `equipmentOf(name)` in `BW_STATIONS`); `isHold(name) -> boolean` (name contains `plank` or `wall sit`, case-insensitive); `bwFor(settings, name) -> boolean` (own-key override in `settings.bodyweight` wins, else `bwDefault`); `cleanBodyweight(obj) -> {}` (own boolean entries only, key length 1-80, not `__proto__`, at most 300); `loadKg(set) -> number` = `Math.max(0, Number(set.w) || 0)`; `bwScore(set) -> number` = `(clamp(w, -500, 2000) + 500) * 1000 + clamp(r, 1, 999)` (always positive; higher extra kg first, then reps; assisted ordering: less assistance scores higher); `bestBwSet(sets) -> set | null` (highest `bwScore` of the sets it is given; callers pass working sets); `formatLoad(w, bwLabel = "BW") -> string` (`0` -> `bwLabel`, positive -> `+10`, negative -> `−20` with U+2212, decimals shown without trailing zeros).
- Imports only `exercise-library.js` (`muscleOf`, `equipmentOf`); it must not import `progression.js` (cycle).

- [ ] **Step 1: Write the failing tests** (`tests/bodyweight.test.js`):
  - Pinned list: `ALL_EX.filter(bwDefault)` equals exactly these 38 names (sorted compare): Push-up, Chest Dip, Incline Push-up, Decline Push-up, Pull-up, Chin-up, Back Extension, Wide-grip Pull-up, Assisted Pull-up, Dip, Bench Dip, Diamond Push-up, Step-up, Bodyweight Squat, Sissy Squat, Wall Sit, Glute Bridge, Glute-Ham Raise, Donkey Kick, Donkey Calf Raise, Single-leg Calf Raise, Plank, Hanging Leg Raise, Ab Wheel Rollout, Russian Twist, Crunch, Side Plank, Lying Leg Raise, Hanging Knee Raise, Captain's Chair Leg Raise, Decline Sit-up, Sit-up, Reverse Crunch, Bicycle Crunch, V-up, Flutter Kick, Mountain Climber, Dead Bug.
  - `bwDefault("Bench Press")` false, `bwDefault("My custom move")` false (not in the library), `bwDefault("pull-up")` true (case-insensitive).
  - `isHold`: Plank, Side Plank, Wall Sit true; Push-up, Crunch false.
  - `bwFor`: override `true` makes a weighted exercise bodyweight, override `false` makes Push-up weighted, no override = default, `bwFor(undefined, "Push-up")` true, `bwFor({bodyweight:{}}, "constructor")` false (own keys only).
  - `cleanBodyweight`: keeps `{ "Row": true, "Push-up": false }`, drops non-boolean values, `__proto__`, empty and 81-character keys, non-objects, and caps at 300.
  - `loadKg`: `{w:0}` 0, `{w:10}` 10, `{w:-20}` 0, `{w:"x"}` 0.
  - `bwScore`: `{w:10,r:5}` > `{w:0,r:50}`; `{w:0,r:9}` > `{w:0,r:8}`; `{w:-10,r:5}` > `{w:-20,r:30}` (less assistance wins); always > 0 for `w` in -500..2000.
  - `bestBwSet`: picks the highest score, `[]` and `null` give `null`.
  - `formatLoad`: `0` -> `"BW"`, `10` -> `"+10"`, `2.5` -> `"+2.5"`, `-20` -> `"−20"`, custom label.
- [ ] **Step 2: Run to verify they fail.** `node --test tests/bodyweight.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `public/bodyweight.js`** per the Interfaces block.
- [ ] **Step 4: Add `/bodyweight.js` to `APP_SHELL` in `public/sw.js`.**
- [ ] **Step 5: Run.** `npm test`. Expected: all pass.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat: bodyweight.js (library default, overrides, load, score, format)"`

### Task 2: Bodyweight progression and default targets

**Files:**
- Modify: `public/progression.js`
- Test: `tests/progression.test.js`

**Interfaces:**
- Consumes: Task 1 `bwDefault`, `isHold`.
- Produces: `suggestNext({last, target, step, bw = false, hold = false})`; `defaultTarget(name)` knows bodyweight and holds; `validTarget` accepts `min`/`max` up to 600 (editor limits stay in the UI).
- Result shape additions: `bw: true` on bodyweight results; `unit: "s"` on hold results.

- [ ] **Step 1: Write the failing tests** (add to `tests/progression.test.js`):
  - `validTarget({sets:3,min:30,max:60})` true, `{max:600}` true, `{max:601}` false (replace the old `max:51` false case with `601`).
  - `defaultTarget`: `"Plank"`, `"Side Plank"`, `"Wall Sit"` -> `{3,30,60}`; `"Push-up"`, `"Bodyweight Squat"`, `"Crunch"` -> `{3,8,12}` (note Crunch stays 8-12 here, not the isolation 10-15, because bodyweight wins); `"Pull-up"`, `"Chin-up"`, `"Wide-grip Pull-up"`, `"Assisted Pull-up"`, `"Dip"`, `"Chest Dip"`, `"Bench Dip"` -> `{3,6,10}`; weighted results unchanged (existing tests stay green; `"Cable Crunch"` still 10-15).
  - `suggestNext` bodyweight with `target {sets:3,min:8,max:12}`, `step 2.5`, `bw:true`:
    - three sets `0x12` -> `{kind:"increase", w:2.5, r:8, bw:true}`.
    - `0x12, 0x12, 0x10` -> `{kind:"hold", w:0, r:11, bw:true}`.
    - `0x6, 0x6, 0x6` -> `{kind:"hold", w:0, r:8, low:true, bw:true}`.
    - `+10x12` x3 -> increase `w:12.5`.
    - assisted `-20x12` x3 -> increase `w:-17.5` (less assistance), `-20x6` x3 -> low hold at `-20`.
    - mixed loads `[0x15, +5x12, +5x12, +5x12]` -> judged at the top load `+5` -> increase `7.5`.
    - fewer sets than the target -> hold, not increase; warm-ups and drop sets ignored; `null`, `[]` -> `null`.
  - `suggestNext` hold exercises (`bw:true, hold:true`, target `{3,30,60}`): `0x60` x3 -> `{kind:"hold", w:0, r:60, bw:true, unit:"s"}` (never an increase, `r` capped at `max`); `0x35, 0x40, 0x30` -> `r:31`; below `min` -> `low:true`.
  - Weighted calls without the new flags behave exactly as before (existing tests).
- [ ] **Step 2: Run to verify they fail.** `npm test`. Expected: only the new cases fail.
- [ ] **Step 3: Implement.** `suggestNext`: when `bw`, the judged load is the highest `w` among working sets (any number, not only `> 0`); increase adds `step || 2.5` and rounds to 0.01; `hold` (seconds) never increases. `defaultTarget`: holds first, then the pull-up/dip family regex (`pull-up|chin-up|\bdips?\b`) for library bodyweight, then other `bwDefault` exercises, before the existing rules. Use the Write/Edit tools for the regex edits.
- [ ] **Step 4: Run.** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat: bodyweight progression (reps first, then extra kg) and bodyweight default targets"`

### Task 3: Saving and restoring the new fields

**Files:**
- Modify: `public/ui-helpers.js` (`settingsDoc`), `public/backup.js` (`cleanWorkout`, `cleanSettings`), `public/index.html` (settings snapshot parser only)
- Test: `tests/ui-helpers.test.js`, `tests/backup.test.js`

**Interfaces:**
- Consumes: Task 1 `cleanBodyweight`.
- Produces: `settings.bodyweight` carried everywhere; entry `bw` kept by the backup cleaner.

- [ ] **Step 1: Write the failing tests.**
  - `settingsDoc({rest:{}, bodyweight:{"Row":true}}, 1).bodyweight` equals it; no key when absent or `{}`.
  - `cleanBackupItems`: workout entry `{ex:"Push-up", bw:true, sets:[{w:-20,r:8}]}` keeps `bw:true` and the negative `w`; the same sets on an entry without `bw` drop the set with `w:-20` (kept: `{w:0,r:8}`); `bw:false`/`bw:"yes"` are dropped (key absent); `w:-501` is dropped even on `bw`; `w:2001` dropped; an old backup without `bw` restores byte-identical.
  - Settings item: valid `bodyweight` entries kept, non-booleans dropped, key absent when nothing valid, absent stays absent.
- [ ] **Step 2: Run to verify they fail.** `npm test`. Expected: only the new cases fail.
- [ ] **Step 3: Implement.** `settingsDoc` adds `...(x.bodyweight && Object.keys(x.bodyweight).length ? { bodyweight: x.bodyweight } : {})`; `cleanWorkout` computes per entry `const bw = e.bw === true` and filters sets with `num(s.w, bw ? -500 : 0, 2000)`, writes `bw: true` only when true; `cleanSettings` adds `bodyweight` via `cleanBodyweight`; the snapshot parser adds `...(v.bodyweight && typeof v.bodyweight === "object" ? { bodyweight: cleanBodyweight(v.bodyweight) } : {})` (import it).
- [ ] **Step 4: Run.** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat: bodyweight flag and overrides are saved, exported and restored"`

### Task 4: Statistics for bodyweight entries

**Files:**
- Modify: `public/achievements.js`, `public/overview.js`, `public/social.js`, `public/workout-tools.js`
- Test: `tests/achievements.test.js`, `tests/overview.test.js`, `tests/social.test.js`, `tests/workout-tools.test.js`

**Interfaces:**
- Consumes: Task 1 `loadKg`, `bwScore`; entries with `bw: true`.
- Produces: `prefillFor(entry, last, suggest, opts)` where `opts = {bw, hold}` only changes the no-history starter: weighted `{w:"20", r:"8"}` (unchanged), bodyweight `{w:"0", r:"8"}`, hold `{w:"0", r:"30"}`; `prEvents` keys sessions by exercise plus kind (a weighted history and a bodyweight history of the same name are separate).

- [ ] **Step 1: Write the failing tests.**
  - `prEvents`: a bodyweight exercise (entries with `bw:true`) gets a PR when its best set (higher extra kg, then reps) beats all earlier sessions (same "at least two earlier sessions" rule); `0x12` after three sessions of `0x10` is a PR; assisted `-10x6` beats `-20x15`; weighted and bodyweight sessions of the same name never compare with each other; warm-ups/drops ignored.
  - Volume (achievements `m.volume` via the volume badges, `social.buildSummary().volumeWeekKg`): a bodyweight set `0x50` adds 0; `+10x10` adds 100; assisted `-20x10` adds 0; weighted sets unchanged.
  - Strength-ratio badges: a bodyweight entry named like a ratio lift is ignored; weighted behaviour unchanged.
  - `topLifts` excludes bodyweight entries.
  - `prefillFor({sets:[]}, null, undefined, {bw:true})` -> `{w:"0", r:"8"}`; with `{bw:true, hold:true}` -> `{w:"0", r:"30"}`; with history it still follows last session; weighted default unchanged; with a suggestion it uses the suggestion.
- [ ] **Step 2: Run to verify they fail.** `npm test`. Expected: only the new cases fail.
- [ ] **Step 3: Implement.** `prEvents`: per entry `best = e.bw ? Math.max(0, ...working.map(bwScore)) : (existing e1RM)`, session key `ex + (e.bw ? "|bw" : "")` (the returned event keeps `ex` as today). Volume sums use `loadKg(s) * s.r`; ratio lifts skipped when `e.bw`; `topLifts` skips `e.bw`; `prefillFor` starter by `opts`.
- [ ] **Step 4: Run.** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat: PRs, volume and pre-fill understand bodyweight entries"`

### Task 5: The workout screen

**Files:**
- Modify: `public/index.html`, `public/lang-ar.js`
- Test: `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: Tasks 1-4. `isBw(e)` helper in index.html: `e.sets.length ? !!e.bw : bwFor(state.settings, e.ex)`; `isHold(e.ex)`.
- Produces: action `bw-toggle` (writes `settings.bodyweight` through `store.saveSettings`, storing only differences from `bwDefault`), `add-set` stamps `en.bw = true` on the entry when it is the first set and the exercise is bodyweight, `readSet` accepts negative values only for bodyweight, helper `loadText(s)` for set rows.

- [ ] **Step 1 (tests first, then watch them fail):** UI tests named `bodyweight:`: (a) Push-up (add it with + Exercise) shows the label "Extra weight · kg", the weight box is `0`, reps `8`; a weighted exercise (Bench Press) keeps the old label and 20 kg/history prefill; (b) a typed custom exercise starts weighted and the "Bodyweight" chip flips it to the extra-weight label; flipping Push-up back makes it weighted; (c) the weight stepper goes below 0 on a bodyweight exercise (click `−` from 0 gives `-2.5`) and logging `-20 x 8` shows `−20` in the row; on a weighted exercise the stepper still stops at 0; (d) a plain `0 x 12` set shows "BW" and `+10` shows `+10`, the e1RM cell is "–", a heavier extra load or more reps gets the PR badge; (e) after one set is logged the chip is disabled with a reason; (f) Plank shows "Seconds" instead of "Reps", prefills 30, and its advice never suggests weight; (g) advice for a bodyweight exercise after a session at the top of the range reads "Add 2.5 kg extra, start at 8 reps" (use the harness history: the harness has no bodyweight history, so log the previous session through the date strip or seed it via an init script following the pattern the `targets:` tests used, and note which in the test); (h) Arabic: chip, labels and set row render, steppers LTR. Run `cd tests-ui && node --test --test-name-pattern="bodyweight:" smoke.test.mjs`. Expected: FAIL.
- [ ] **Step 2: Entry flag and switch.** `add-set` sets `en.bw = true` when `en.sets.length === 0` and `bwFor(state.settings, en.ex)`; nothing writes `bw: false`. Add the "Bodyweight" chip beside the Target chip (`data-act="bw-toggle"`, `aria-pressed`, disabled with a one-line reason when `e.sets.length > 0`); `bw-toggle` flips via `setBodyweight(ex, value)`: compute the override (delete the key when it equals `bwDefault`, so only differences are stored), update `state.settings` immediately and call `store.saveSettings({bodyweight})`; also `delete ui[ex]` and redraw.
- [ ] **Step 3: The card.** Weight label "Extra weight · kg" plus hint "0 = your body. Negative = assisted." on bodyweight; reps label "Seconds" on holds; the stepper floor becomes -500 for bodyweight (`step` handler reads the entry via `data-ei`); `readSet` accepts `w >= -500` only for bodyweight and keeps the old message for weighted; prefill passes `{bw, hold}` to `prefillFor`; `suggestNext` gets `bw`/`hold` and the advice text uses the bodyweight strings from the spec (increase, assisted "Less assistance", hold, low, seconds); set rows show `loadText`; e1RM cell "–" and PR comparison by `bwScore` for bodyweight entries (`bestBefore` equivalent for bodyweight: add `bestScoreBefore(ex, date)` over sessions with `bw` entries); the "Last time" line uses `formatLoad`. The target editor allows up to 600 for holds (steps of 5) and 50 otherwise.
- [ ] **Step 4: Volume helper.** `vol(sets)` in index.html uses `loadKg`.
- [ ] **Step 5: Arabic.** Add every new string; run `npm test`.
- [ ] **Step 6: Run.** `npm test`, then the `bodyweight:` tests, then the whole `tests-ui` suite once. Expected: PASS.
- [ ] **Step 7: Commit.** `git add -A && git commit -m "feat: bodyweight exercises on the workout screen (extra kg, switch, BW rows, holds)"`

### Task 6: Lifts, Coach and History

**Files:**
- Modify: `public/index.html`, `public/lang-ar.js`
- Test: `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: Task 5 helpers. Sessions of an exercise carry `bw` (extend `exerciseSessions` in `progression.js` to return `{date, sets, bw}` where `bw` is the entry's flag; add a unit test).

- [ ] **Step 1: Write the failing tests.** Unit: `exerciseSessions` returns `bw: true` for bodyweight entries and omits it otherwise. UI (`bodyweight:` prefix): the Lifts picker lists a bodyweight exercise; its page shows "Best set" (for example `+10 × 8` or `BW × 12`), "Sessions" and a chart of the top set's reps, and never "Best e1RM"; Coach stalled/progressing lift insights skip bodyweight lifts without errors; History/summary volume for a bodyweight-only workout is 0 kg and still lists the sets. Expected: FAIL.
- [ ] **Step 2: Implement.** Lifts (`renderProgress`): for a bodyweight exercise replace the e1RM series and cards with the top set (`bestBwSet`) per session (chart y = reps of the top set; stats "Best set", "Sessions"); Coach lift trends (`insights`, ~`sessionsFor(ex)` users) skip sessions with `bw`; keep weighted behaviour byte-identical.
- [ ] **Step 3: Arabic and run.** Add strings; `npm test`; the `bodyweight:` UI tests. Expected: PASS.
- [ ] **Step 4: Commit.** `git add -A && git commit -m "feat: Lifts and Coach understand bodyweight lifts"`

### Task 7: Release

**Files:**
- Modify: `public/sw.js`, `CLAUDE.md`, `docs/README.md`, `docs/open-points.md`, `docs/roadmap-v1-features.md`

- [ ] **Step 1: Full suites.** `npm test`; `cd tests-ui && npm test` (one copy at a time, includes the 44px / 12px checks). Expected: all pass.
- [ ] **Step 2: Docs and version.** Bump `VERSION` (see Global Constraints). CLAUDE.md: the `w-` row (`entries[].bw`, `w` = extra kg on bodyweight entries), the `settings` row (`bodyweight?`), files list (`bodyweight.js`), the workout Features bullet (detection, switch, extra kg, holds, counting and advice rules). `docs/README.md`: sub-project 22 with spec and plan links. `docs/open-points.md` and `docs/roadmap-v1-features.md`: mark bodyweight mode built.
- [ ] **Step 3: Commit.** `git add -A && git commit -m "docs and sw version for bodyweight mode"`
