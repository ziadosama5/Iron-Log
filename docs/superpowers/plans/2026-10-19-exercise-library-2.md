# Exercise Library 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the library from 74 to 183 gym exercises, each tagged with the equipment it needs, with tips, Arabic and a drawing for every one.

**Architecture:** `exercise-library.js` gets `EQUIPMENT` and `EXERCISES` (name, muscle group, required equipment ids); `LIB`/`MUSCLES`/`ALL_EX` are derived from `EXERCISES`, so the rest of the app keeps working. Each muscle group is added in its own task, and every task keeps the suite green because a new exercise only counts as done when its tips, Arabic name/tips and drawing exist (the existing tests enforce that). A pure `exercisesFor(gym)` is built and tested now for sub-project 2.

**Tech Stack:** plain JS ES modules, `node --test`, the existing generator `tools/import-exercises.mjs` + hand-drawing code `tools/draw-exercises.mjs`, headless Edge screenshots.

**Spec:** `docs/superpowers/specs/2026-10-19-exercise-library-2-design.md` (it holds the full exercise list with equipment per exercise and the 39 equipment ids; this plan does not repeat the equipment tags).

## Global Constraints

- No build step, no new dependencies. `index.html`, `exercise-library.js`, `lang-ar.js` have CRLF endings: use the Edit tool or Write-tool scripts; heredocs/shell mangle backslashes and apostrophes.
- Exact exercise names, groups and equipment ids come from the spec lists. A name appears once (case-insensitive). 183 exercises, 39 equipment ids.
- Tips: 2–4 per exercise, ≤ 60 characters, no trailing period. Arabic tips (`ar.tips`): same count, ≤ 80 characters, no trailing period, simple Modern Standard Arabic. Arabic exercise names unique. Every `primary[0]` equals the exercise's group; muscle names from `MUSCLES`.
- Drawings: every exercise has start/finish figures: Everkinetic (`"ek"` id, only if the file exists), hand-drawn (`"draw": true` with a `DRAWINGS` entry), or reused (`"drawing": "<other exercise name>"`, never a chain).
- Stored data is never renamed; old names (including the four restored ones) keep resolving.
- Bump `iron-log-v16` in `public/sw.js` in the last task only; nothing is deployed before the final review and the user's go-ahead.

## Review Focus

- Two entries a user would see as the same exercise (differing only in wording) → pinned by the Task 1 test (names unique ignoring case and punctuation); the final reviewer checks the rest of the list by judgment.
- Wrong equipment tags (name says "Cable" but no `cable`, "Smith" without `smith`, "Dumbbell" without `dumbbell`, "Barbell" without `barbell`, a machine name without its machine) → Task 1 test enforces name-word ↔ equipment consistency; every group task re-runs it.
- Reused drawings pointing at the wrong or a missing exercise, or chained → Task 2 test.
- Duplicate or empty Arabic names → existing coverage test + Task 1 uniqueness check over all Arabic names.
- "Show more" losing its state or not working in the Days editor → Task 3 (helper tests + screenshots of both places).

---

### Task 1: Library model, equipment and the old 74 tagged

**Files:**
- Modify: `public/exercise-library.js`, `public/lang-ar.js`, `tests/exercise-library.test.js`, `tests/lang-coverage.test.js`

**Interfaces:**
- Produces (exported from `public/exercise-library.js`):
  - `EQUIPMENT: {id: string, group: "weights"|"station"|"machine", name: string}[]` — the 39 ids from the spec table, in that order; `name` is the English display name (e.g. `{id:"pec-deck", group:"machine", name:"Pec deck (butterfly)"}`).
  - `EXERCISES: {name: string, group: string, eq: string[]}[]` — built with a local helper `X(group, rows)` where each row is `[name, ...equipmentIds]`.
  - `LIB`, `MUSCLES`, `ALL_EX` — same shapes as today, now derived from `EXERCISES` (group order: Chest, Back, Shoulders, Biceps, Triceps, Quads, Hamstrings & Glutes, Calves, Core).
  - `equipmentOf(name: string): string[] | null` — required ids for a library exercise (case-insensitive, aliases resolved), `null` for custom names.
  - `exercisesFor(gym: string[]): string[]` — names whose `eq` are all in `gym`.
- Existing `TEMPLATES`, `muscleOf`, `fillFocus`, `migrateProgram`, `resolveAlias`, `ALIASES` unchanged here.

- [ ] **Step 1: Write the failing tests** in `tests/exercise-library.test.js`:
  - `EQUIPMENT` has 39 unique ids; every `group` is one of the three; every id is used by at least one exercise **once all tasks are done** — for now assert only "used ids ⊆ EQUIPMENT ids" (the used-by-at-least-one check is added in Task 12).
  - `EXERCISES` length is 74 now; names unique ignoring case; every `group` is in `MUSCLES`; `LIB[g]` equals the names of that group in order; `ALL_EX.length === EXERCISES.length`.
  - Equipment tags are consistent with names: for each exercise, if the name contains `Smith` then `eq` includes `smith`; `Cable` → `cable`; `Dumbbell` → `dumbbell` (except `Dumbbell` in a group where equipment is a kettlebell: none); `Barbell` → `barbell`; `EZ-bar` → `ez-bar`; `Kettlebell` → `kettlebell`; `Trap Bar` → `trap-bar`; a name containing `Machine` but not `Smith` (and the names Pec Deck, Leg Press, Hack Squat, Leg Extension, Lat Pulldown, Close-grip/Reverse-grip Pulldown, Assisted Pull-up, T-bar Row, Seated/Lying Leg Curl, Hip Abduction/Adduction, Standing/Seated Calf Raise) has at least one machine-group id in `eq`.
  - Spot checks: `equipmentOf("bench press")` equals `["barbell","bench"]`; `equipmentOf("Pec Deck")` equals `["pec-deck"]`; `equipmentOf("Push-up")` equals `[]`; `equipmentOf("My Custom Thing")` is `null`.
  - `exercisesFor([])` contains Push-up, Plank, Crunch and nothing needing equipment; `exercisesFor(["barbell","bench"])` contains Bench Press and Incline Barbell Press but not Dumbbell Bench Press; `exercisesFor(EQUIPMENT.map(e => e.id))` equals `ALL_EX`.
  In `tests/lang-coverage.test.js` add: every `EQUIPMENT` id has `AR.names.equipment[id]` (non-empty) and the Arabic equipment names are unique.
- [ ] **Step 2: Run** `node --test tests/exercise-library.test.js tests/lang-coverage.test.js` → Expected: FAIL (EQUIPMENT/EXERCISES not exported).
- [ ] **Step 3: Implement** the model in `exercise-library.js`: write `EQUIPMENT` (39, English names), `EXERCISES` for the 74 current exercises with the equipment from the spec lists, build `LIB`/`ALL_EX`, add `equipmentOf` and `exercisesFor`. Add `names.equipment` (39 Arabic names) to `lang-ar.js`.
- [ ] **Step 4: Run** `npm test` → Expected: PASS (all existing tests unchanged and green).
- [ ] **Step 5: Commit** `git add public tests && git commit -m "feat: equipment model and tags for the current exercises"`

---

### Task 2: Drawing reuse and a finder for Everkinetic drawings

**Files:**
- Modify: `tools/import-exercises.mjs`, `tests/exercise-info.test.js`
- Create: `tools/find-drawing.mjs`, `tests/find-drawing.test.js`

**Interfaces:**
- Produces:
  - Source field `"drawing": "<exercise name>"` in `tools/exercise-sources.json`: the generated `INFO[x]` gets `slug`, `img`, `own` copied from the target exercise, and writes no files of its own. The importer fails if the target is missing, is itself a reuse (no chains), or has no drawing.
  - `matchTitles(index: {id: string, title: string}[], query: string): {id: string, title: string}[]` exported from `tools/find-drawing.mjs` — every entry whose title contains all query words (case-insensitive, punctuation ignored), best (shortest title) first. CLI: `node tools/find-drawing.mjs "leg curl"` downloads (and caches in the OS temp dir) the Everkinetic index `https://raw.githubusercontent.com/everkinetic/data/main/dist/exercises.json` and prints `id  title  (files: yes|no)` after checking that `<id>-relaxation.svg` exists.

- [ ] **Step 1: Write failing tests:**
  - `tests/find-drawing.test.js`: `matchTitles([{id:"0126",title:"Leg Press"},{id:"0127",title:"Narrow Stance Leg Press"},{id:"0001",title:"Neck"}], "leg press")` returns ids `["0126","0127"]` in that order; query `"narrow press"` returns only `0127`; a query with punctuation (`"Leg-Press!"`) still matches; empty query returns `[]`.
  - `tests/exercise-info.test.js`: replace the "slugs are unique" test with: slugs are unique among entries that do not reuse a drawing; every entry's `slug` has start/end files; for entries that reuse a drawing, `slug` equals the target's slug and the target is not itself a reuse (read `tools/exercise-sources.json`).
- [ ] **Step 2: Run** `node --test tests/find-drawing.test.js tests/exercise-info.test.js` → Expected: FAIL.
- [ ] **Step 3: Implement** `matchTitles` + CLI in `tools/find-drawing.mjs`, and the `drawing` handling in the importer (resolve after all entries are built; unreferenced-file cleanup keeps working).
- [ ] **Step 4: Run** `npm test` → Expected: PASS.
- [ ] **Step 5: Commit** `git add tools tests && git commit -m "feat: reuse a drawing across exercises; Everkinetic finder"`

---

### Task 3: Equipment line in the info sheet and "Show more" in suggestions

**Files:**
- Modify: `public/ui-helpers.js`, `public/index.html`, `public/lang-ar.js`, `tests/ui-helpers.test.js`

**Interfaces:**
- Consumes: `equipmentOf(name)`, `EQUIPMENT` (Task 1); `nameOf`, `t`.
- Produces: `visibleItems(items: string[], expanded: boolean, limit = 6): { shown: string[], hidden: number }` in `ui-helpers.js` — `expanded` shows all; otherwise the first `limit`; `hidden` = how many are not shown.

- [ ] **Step 1: Write failing tests** in `tests/ui-helpers.test.js`: `visibleItems(["a","b","c"], false, 2)` → `{shown:["a","b"], hidden:1}`; `expanded=true` → all shown, `hidden: 0`; lists shorter than the limit → `hidden: 0`; default limit is 6; empty list → `{shown:[], hidden:0}`.
- [ ] **Step 2: Run** `node --test tests/ui-helpers.test.js` → Expected: FAIL.
- [ ] **Step 3: Implement** `visibleItems`. In `index.html`: (a) the exercise info sheet gets a line `Equipment: <b>…</b>` using `equipmentOf(info.name)` (names via `nameOf("equipment", id)` joined with ` · ` / `، ` in Arabic; empty list → `No equipment`; custom names show nothing); (b) the "+ Exercise" sheet and the Days editor suggestion lists use `visibleItems` per muscle group with a `Show more (N)` / `Show fewer` button (`data-act="more-ex"`, `data-k` = a key like `sheet:Chest` or `day:<dayId>:Chest`), open state kept in `state.showAllEx` (an object of keys → true) so a re-render keeps it; the click handler toggles the key and redraws the sheet (`refreshSheets()`) or `renderDays()`. Add labels `Equipment`, `No equipment`, `Show more ({n})`, `Show fewer` with Arabic to `AR.ui`.
- [ ] **Step 4: Run** `npm test` → Expected: PASS (the coverage test enforces the new Arabic labels). Screenshot check with the Firebase-stub harness (`go=sheet:ex` and the Days editor) in English and Arabic: the button appears when a muscle has more than 6 exercises (add temporary test data or wait for Task 4), expands and collapses.
- [ ] **Step 5: Commit** `git add public tests && git commit -m "feat: equipment line and Show more in suggestions"`

---

### Tasks 4–12: add the exercises, one muscle group per task

All nine tasks follow **Procedure G** (each task lists only the group, the new names and the tests it adds).

**Procedure G — for every new exercise:**
1. In `tools/exercise-sources.json` add `{ "ek"|"draw"|"drawing", "start"?, "primary": [...], "secondary": [...], "tips": [...], "ar": {"tips": [...]} }` (primary[0] = the group). Find drawings with `node tools/find-drawing.mjs "<words>"`; use `"ek"` only when it says `files: yes`, and set `"start": "tension"` for exercises that start at the top of the movement (squat/press family) as in the existing entries. If none fits, add a hand-drawn figure to `tools/draw-exercises.mjs` in the existing style (`draw-lib.mjs`: `fig`, `tap`, `chain`, `body`, `arm`, `leg`, `delt`, `dumbbell`, `barbell`, `plate`, `cable`, `rect`, `line`, `floor`, side view facing right, front view for symmetric moves) and mark `"draw": true`; if the movement and equipment look the same as another exercise, use `"drawing": "<name>"`. Look at hand-drawn figures with `node tools/draw-exercises.mjs --sheet <file.html>` and a headless-Edge screenshot before keeping them.
2. Add the exercise to `EXERCISES` (spec list order; popular first) with its equipment ids from the spec.
3. Add its Arabic name to `AR.names.ex` (unique across all exercises).
4. Run `node tools/import-exercises.mjs` (writes SVGs, regenerates `exercise-info.js`).
5. For the four restored names (Dumbbell Shoulder Press, Cable Lateral Raise, Seated Leg Curl, Glute Bridge): also delete its entry from `ALIASES` and update the alias tests that mention it (`tests/exercise-library.test.js` "merged exercises…", `tests/exercise-info.test.js` "merged names still show…") so they use a remaining alias or are removed when `ALIASES` is empty.
6. Update the group's count in the library test (`EXERCISES.length` and per-group expectations) and, when a drawing count test exists, the totals.

Each task ends with `npm test` green and one commit (`feat: library — <group>`). After the last task of Procedure G changes, `tests/exercise-library.test.js` has the per-group counts: Chest 22, Back 28, Shoulders 22, Biceps 16, Triceps 18, Quads 23, Hamstrings & Glutes 24, Calves 8, Core 22 (total 183).

### Task 4: Chest (+11 → 22)
**New:** Decline Dumbbell Press, Incline Machine Press, Smith Machine Bench Press, Smith Machine Incline Press, Incline Dumbbell Fly, Low Cable Crossover, Cable Fly (Flat Bench), Incline Push-up, Decline Push-up, Dumbbell Pullover, Dumbbell Floor Press.
- [ ] Steps: Procedure G 1–4 and 6 → `npm test` → Expected: PASS → commit.

### Task 5: Back (+15 → 28)
**New:** Wide-grip Pull-up, Assisted Pull-up, Reverse-grip Pulldown, Underhand Barbell Row, Smith Machine Row, Chest-supported Dumbbell Row, Bent-over Dumbbell Row, Wide-grip Cable Row, One-arm Cable Row, Machine Row, Trap Bar Deadlift, Rack Pull, Cable Shrug, Smith Machine Shrug, Inverted Row.
- [ ] Steps: Procedure G 1–4 and 6 → `npm test` → Expected: PASS → commit.

### Task 6: Shoulders (+14 → 22, restores two names)
**New:** Dumbbell Shoulder Press (restored), Seated Barbell Press, Seated Dumbbell Press, Smith Machine Shoulder Press, Push Press, Cable Lateral Raise (restored), Machine Lateral Raise, Front Raise, Cable Front Raise, Cable Rear Delt Fly, Cable Upright Row, Dumbbell Upright Row, Barbell Rear Delt Row, Lying Rear Lateral Raise.
- [ ] Steps: Procedure G 1–6 → `npm test` → Expected: PASS → commit. Extra test: `infoFor("Dumbbell Shoulder Press").name` is `"Dumbbell Shoulder Press"` (no longer redirected) and `muscleOf` of both restored names is `"Shoulders"`.

### Task 7: Biceps (+8 → 16)
**New:** Cross-body Hammer Curl, Dumbbell Preacher Curl, Machine Biceps Curl, High Cable Curl, Rope Hammer Curl, Spider Curl, Reverse Curl, Zottman Curl.
- [ ] Steps: Procedure G 1–4 and 6 → `npm test` → Expected: PASS → commit.

### Task 8: Triceps (+11 → 18)
**New:** Rope Pushdown, Reverse-grip Pushdown, One-arm Cable Pushdown, Dumbbell Skull Crusher, Smith Close-grip Press, JM Press, Bench Dip, Machine Dip, Machine Triceps Extension, Cable Kickback, Diamond Push-up.
- [ ] Steps: Procedure G 1–4 and 6 → `npm test` → Expected: PASS → commit.

### Task 9: Quads (+13 → 23)
**New:** Box Squat, Goblet Squat, Dumbbell Squat, Narrow-stance Leg Press, Single-leg Leg Press, Smith Machine Split Squat, Reverse Lunge, Barbell Lunge, Side Lunge, Dumbbell Step-up, Bodyweight Squat, Sissy Squat, Wall Sit.
- [ ] Steps: Procedure G 1–4 and 6 → `npm test` → Expected: PASS → commit.

### Task 10: Hamstrings & Glutes (+18 → 24, restores two names)
**New:** Dumbbell Romanian Deadlift, Single-leg Romanian Deadlift, Sumo Deadlift, Kettlebell Deadlift, Seated Leg Curl (restored), Dumbbell Hip Thrust, Smith Machine Hip Thrust, Glute Bridge (restored), Barbell Glute Bridge, Cable Pull-through, Glute Kickback Machine, Cable Glute Kickback, Cable Hip Abduction, Hip Adduction, Kettlebell Swing, Dumbbell Sumo Squat, Glute-Ham Raise, Donkey Kick.
- [ ] Steps: Procedure G 1–6 → `npm test` → Expected: PASS (`ALIASES` is now empty; `resolveAlias` still works with an empty map: add a test that `resolveAlias("Anything")` returns it unchanged) → commit.

### Task 11: Calves (+5 → 8) and Core (+14 → 22)
**New calves:** Calf Press (Leg Press), Smith Calf Raise, Dumbbell Calf Raise, Barbell Calf Raise, Single-leg Calf Raise.
**New core:** Hanging Knee Raise, Captain's Chair Leg Raise, Machine Crunch, Decline Sit-up, Sit-up, Reverse Crunch, Bicycle Crunch, V-up, Flutter Kick, Mountain Climber, Dead Bug, Cable Woodchop, Pallof Press, Dumbbell Side Bend.
- [ ] Steps: Procedure G 1–4 and 6 for both groups → `npm test` → Expected: PASS → commit.

---

### Task 12: Final checks, docs and release

**Files:**
- Modify: `tests/exercise-library.test.js`, `public/sw.js` (VERSION `iron-log-v16`), `CLAUDE.md`, `docs/README.md`

- [ ] **Step 1: Write the final tests** in `tests/exercise-library.test.js`: `EXERCISES.length === 183`; every `EQUIPMENT` id is used by at least one exercise; `ALIASES` is empty; every new exercise name from the spec exists; in `tests/lang-coverage.test.js` the Arabic exercise names are unique across all 183 (already covered by the existing uniqueness test); in `tests/exercise-info.test.js` every exercise has `ar.tips` and a drawing (own, Everkinetic or reused).
- [ ] **Step 2: Run** `npm test` → Expected: PASS (fix any gap the new tests find).
- [ ] **Step 3: Visual check** with the Firebase-stub harness in English and Arabic: the "+ Exercise" sheet (Show more expands/collapses and keeps state after a redraw), the Days editor suggestions, the info sheet with the Equipment line for a barbell, a machine and a bodyweight exercise, and a sample of 10 new drawings (hand-drawn and Everkinetic) in light and dark. Fix what looks wrong.
- [ ] **Step 4: Docs and version:** `CLAUDE.md` (files list: `EQUIPMENT/EXERCISES/equipmentOf/exercisesFor`, `find-drawing`, `drawing` reuse; replace the "Exercise list rules" section: how to add an exercise with equipment, 183 exercises, no aliases left, equipment ids are fixed), `docs/README.md` row 9, bump `VERSION` to `iron-log-v16`.
- [ ] **Step 5: Commit** `git add . && git commit -m "feat: exercise library 2.0 (183 exercises, equipment tags), sw v16"`
