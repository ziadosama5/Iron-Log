# Exercise library 2.0 — design

Sub-project 1 of 3 of "a personal journey for every user" (2 = My Gym equipment filter, 3 = personal journey / generated plan). This one only grows and tags the library; filtering by a user's gym is sub-project 2.

## Goal
Grow the library from 74 to about 183 gym exercises, every one tagged with the equipment it needs, so a later "My Gym" setting can show only what a user can do. Machines are separate items ("butterfly machine" = Pec Deck is its own piece of equipment).

## What was agreed
- Curated list of the exercises a normal gym offers (all common machines, cables, Smith machine, free weights, bodyweight). Not: bosu, balance board, towel, strongman, stretching, rare band/ball work.
- Equipment is fine-grained: each specific machine is its own item.
- Variants that differ by equipment are separate exercises. So the four earlier merges are undone: Seated Leg Curl, Cable Lateral Raise, Dumbbell Shoulder Press and Glute Bridge come back as their own exercises.
- Everything gets muscles, tips, an English and Arabic name, Arabic tips and a drawing.
- Existing saved data keeps working (names unchanged).

## Non-goals
- Filtering by the user's gym, onboarding, plan generation (sub-projects 2 and 3).
- New muscle groups (still 9). Shrugs stay under Back.
- Stretching, warm-up, mobility, plyometrics, strongman, kettlebell flows beyond the few listed.

## Data model
`public/exercise-library.js` gets two exported lists, and `LIB`, `MUSCLES`, `ALL_EX`, `TEMPLATES`, `muscleOf` stay as they are (LIB is built from the list):
- `EQUIPMENT: {id, group}[]`: ids below, `group` is `"weights" | "station" | "machine"` (used by sub-project 2 to lay out the checklist). English display names live in `AR`/`EN` tables via `nameOf("equipment", id)`: the English name is the id's `name` field.
- `EXERCISES: {name, group: MuscleName, eq: string[]}[]`: `eq` = ALL required equipment ids (empty = bodyweight / no equipment). The order inside a muscle group is the order suggestions show first (popular first).
- `exercisesFor(gym: string[]): string[]` (pure, used by sub-project 2): names whose `eq` are all in `gym`. Defined and tested here, not used by the UI yet.
- `ALIASES` stays supported (empty after the undo; old aliased names keep resolving only if someone re-adds one).
- Exercises typed by users (custom) stay custom: no equipment, never filtered out.

### Equipment (39)
| group | ids |
|---|---|
| weights | `barbell`, `dumbbell`, `ez-bar`, `trap-bar`, `kettlebell` |
| station | `bench` (adjustable flat/incline), `decline-bench`, `rack`, `smith`, `cable`, `pullup-bar`, `dip-station`, `captains-chair`, `preacher-bench`, `hyper-bench`, `box`, `ab-wheel` |
| machine | `chest-press`, `incline-press-machine`, `pec-deck`, `shoulder-press-machine`, `lateral-raise-machine`, `lat-pulldown`, `seated-row`, `assisted-machine`, `tbar-row`, `biceps-curl-machine`, `triceps-machine`, `leg-press`, `hack-squat`, `leg-extension`, `leg-curl`, `seated-leg-curl`, `hip-abduction`, `hip-adduction`, `glute-kickback`, `standing-calf-machine`, `seated-calf-machine`, `ab-crunch-machine` |

Each id has an Arabic name in `AR.names.equipment`.

## The exercises (183). Equipment in brackets; `-` = none
**Chest (22)**: Bench Press [barbell, bench] · Incline Barbell Press [barbell, bench] · Decline Bench Press [barbell, decline-bench] · Dumbbell Bench Press [dumbbell, bench] · Incline Dumbbell Press [dumbbell, bench] · Decline Dumbbell Press [dumbbell, decline-bench] · Machine Chest Press [chest-press] · Incline Machine Press [incline-press-machine] · Smith Machine Bench Press [smith, bench] · Smith Machine Incline Press [smith, bench] · Dumbbell Fly [dumbbell, bench] · Incline Dumbbell Fly [dumbbell, bench] · Cable Crossover [cable] · Low Cable Crossover [cable] · Cable Fly (Flat Bench) [cable, bench] · Pec Deck [pec-deck] · Push-up [-] · Incline Push-up [bench] · Decline Push-up [bench] · Chest Dip [dip-station] · Dumbbell Pullover [dumbbell, bench] · Dumbbell Floor Press [dumbbell]

**Back (28)**: Pull-up [pullup-bar] · Chin-up [pullup-bar] · Wide-grip Pull-up [pullup-bar] · Assisted Pull-up [assisted-machine] · Lat Pulldown [lat-pulldown] · Close-grip Pulldown [lat-pulldown] · Reverse-grip Pulldown [lat-pulldown] · Straight-arm Pulldown [cable] · Barbell Row [barbell] · Underhand Barbell Row [barbell] · Smith Machine Row [smith] · One-arm Dumbbell Row [dumbbell, bench] · Chest-supported Dumbbell Row [dumbbell, bench] · Bent-over Dumbbell Row [dumbbell] · Seated Cable Row [cable] · Wide-grip Cable Row [cable] · One-arm Cable Row [cable] · T-bar Row [tbar-row] · Machine Row [seated-row] · Deadlift [barbell] · Trap Bar Deadlift [trap-bar] · Rack Pull [barbell, rack] · Back Extension [hyper-bench] · Barbell Shrug [barbell] · Dumbbell Shrug [dumbbell] · Cable Shrug [cable] · Smith Machine Shrug [smith] · Inverted Row [rack]

**Shoulders (22)**: Overhead Press [barbell] · Seated Barbell Press [barbell, bench] · Dumbbell Shoulder Press [dumbbell] · Seated Dumbbell Press [dumbbell, bench] · Arnold Press [dumbbell] · Machine Shoulder Press [shoulder-press-machine] · Smith Machine Shoulder Press [smith, bench] · Push Press [barbell] · Lateral Raise [dumbbell] · Cable Lateral Raise [cable] · Machine Lateral Raise [lateral-raise-machine] · Front Raise [dumbbell] · Cable Front Raise [cable] · Rear Delt Fly [dumbbell] · Reverse Pec Deck [pec-deck] · Cable Rear Delt Fly [cable] · Face Pull [cable] · Upright Row [barbell] · Cable Upright Row [cable] · Dumbbell Upright Row [dumbbell] · Barbell Rear Delt Row [barbell] · Lying Rear Lateral Raise [dumbbell, bench]

**Biceps (16)**: Barbell Curl [barbell] · EZ-bar Curl [ez-bar] · Dumbbell Curl [dumbbell] · Hammer Curl [dumbbell] · Cross-body Hammer Curl [dumbbell] · Preacher Curl [ez-bar, preacher-bench] · Dumbbell Preacher Curl [dumbbell, preacher-bench] · Machine Biceps Curl [biceps-curl-machine] · Incline Dumbbell Curl [dumbbell, bench] · Cable Curl [cable] · High Cable Curl [cable] · Rope Hammer Curl [cable] · Concentration Curl [dumbbell] · Spider Curl [dumbbell, bench] · Reverse Curl [ez-bar] · Zottman Curl [dumbbell]

**Triceps (18)**: Tricep Pushdown [cable] · Rope Pushdown [cable] · Reverse-grip Pushdown [cable] · One-arm Cable Pushdown [cable] · Overhead Tricep Extension [dumbbell] · Overhead Cable Extension [cable] · Skull Crusher [ez-bar, bench] · Dumbbell Skull Crusher [dumbbell, bench] · Close-grip Bench Press [barbell, bench] · Smith Close-grip Press [smith, bench] · JM Press [barbell, bench] · Dip [dip-station] · Bench Dip [bench] · Machine Dip [triceps-machine] · Machine Triceps Extension [triceps-machine] · Triceps Kickback [dumbbell] · Cable Kickback [cable] · Diamond Push-up [-]

**Quads (23)**: Squat [barbell, rack] · Front Squat [barbell, rack] · Box Squat [barbell, rack, box] · Smith Machine Squat [smith] · Goblet Squat [dumbbell] · Dumbbell Squat [dumbbell] · Leg Press [leg-press] · Narrow-stance Leg Press [leg-press] · Single-leg Leg Press [leg-press] · Hack Squat [hack-squat] · Bulgarian Split Squat [dumbbell, bench] · Smith Machine Split Squat [smith] · Walking Lunge [dumbbell] · Lunge [dumbbell] · Reverse Lunge [dumbbell] · Barbell Lunge [barbell] · Side Lunge [dumbbell] · Step-up [box] · Dumbbell Step-up [dumbbell, box] · Leg Extension [leg-extension] · Bodyweight Squat [-] · Sissy Squat [-] · Wall Sit [-]

**Hamstrings & Glutes (24)**: Romanian Deadlift [barbell] · Dumbbell Romanian Deadlift [dumbbell] · Single-leg Romanian Deadlift [dumbbell] · Stiff-leg Deadlift [barbell] · Sumo Deadlift [barbell] · Kettlebell Deadlift [kettlebell] · Good Morning [barbell, rack] · Lying Leg Curl [leg-curl] · Seated Leg Curl [seated-leg-curl] · Hip Thrust [barbell, bench] · Dumbbell Hip Thrust [dumbbell, bench] · Smith Machine Hip Thrust [smith, bench] · Glute Bridge [-] · Barbell Glute Bridge [barbell] · Cable Pull-through [cable] · Glute Kickback Machine [glute-kickback] · Cable Glute Kickback [cable] · Hip Abduction [hip-abduction] · Cable Hip Abduction [cable] · Hip Adduction [hip-adduction] · Kettlebell Swing [kettlebell] · Dumbbell Sumo Squat [dumbbell] · Glute-Ham Raise [hyper-bench] · Donkey Kick [-]

**Calves (8)**: Standing Calf Raise [standing-calf-machine] · Seated Calf Raise [seated-calf-machine] · Donkey Calf Raise [box] · Calf Press (Leg Press) [leg-press] · Smith Calf Raise [smith] · Dumbbell Calf Raise [dumbbell] · Barbell Calf Raise [barbell] · Single-leg Calf Raise [-]

**Core (22)**: Plank [-] · Side Plank [-] · Hanging Leg Raise [pullup-bar] · Hanging Knee Raise [pullup-bar] · Captain's Chair Leg Raise [captains-chair] · Lying Leg Raise [-] · Cable Crunch [cable] · Ab Wheel Rollout [ab-wheel] · Machine Crunch [ab-crunch-machine] · Decline Sit-up [decline-bench] · Sit-up [-] · Crunch [-] · Reverse Crunch [-] · Bicycle Crunch [-] · V-up [-] · Flutter Kick [-] · Mountain Climber [-] · Dead Bug [-] · Russian Twist [-] · Cable Woodchop [cable] · Pallof Press [cable] · Dumbbell Side Bend [dumbbell]

All 74 current names are in this list. The 109 new names come with the data below.

## Per-exercise data
`tools/exercise-sources.json` keeps being the source of truth. Each new entry has `primary`, `secondary`, 2-4 English tips (≤ 60 chars, no trailing period), `ar.tips` (same count, ≤ 80 chars), and a drawing source:
- `"ek": "<id>"`: Everkinetic drawing (only when the file really exists; the importer fails otherwise), or
- `"draw": true`: hand-drawn in `tools/draw-exercises.mjs`, or
- `"drawing": "<other exercise name>"`: the same figure as another exercise (e.g. Narrow-stance Leg Press uses Leg Press) — no new files; `INFO[x].slug` points at the other exercise's files.
Arabic names go in `AR.names.ex`. Equipment is in `EXERCISES`, not in the JSON.

## UI in this sub-project
- Info sheet: a line "Equipment: Barbell · Bench" (bodyweight: "No equipment"), names via `nameOf("equipment", id)`; new labels `Equipment`, `No equipment`.
- Suggestions (the "+ Exercise" sheet and the Days editor): still the first 6 per muscle, plus a "Show more" button that reveals the rest of that muscle's exercises (`Show more` / `Show fewer` labels, Arabic).
- Nothing else changes; the typed-name box with its suggestion list already finds every exercise (English and Arabic names).

## Files
- Modify: `public/exercise-library.js` (EXERCISES, EQUIPMENT, exercisesFor), `tools/exercise-sources.json`, `tools/import-exercises.mjs` (`drawing` reuse), `tools/draw-exercises.mjs` (+ new hand-drawn figures), `public/exercise-info.js` (generated), `public/exercises/` (new SVGs), `public/lang-ar.js`, `public/index.html` (info sheet line, Show more), `public/sw.js` (v16), `CLAUDE.md`, `docs/README.md`.
- Tests: `tests/exercise-library.test.js`, `tests/exercise-info.test.js`, `tests/lang-coverage.test.js`, `tests/draw-exercises.test.js`.

## Testing
- Library: names unique (case-insensitive); every `eq` id exists in EQUIPMENT; every EQUIPMENT id is used by at least one exercise; every muscle group non-empty; the 74 old names and the 4 restored ones exist; `exercisesFor([])` = bodyweight ones only; `exercisesFor(all ids)` = everything; Smith + bench gives Smith bench presses but not barbell ones.
- Info: tips counts/lengths, Arabic tips, primary muscle matches the group, every exercise has a drawing file (own or reused), no unreferenced files.
- Arabic: every exercise and equipment id has an Arabic name; coverage test stays green.
- Compatibility: a saved day/workout using an old name (including a former alias such as "Seated Leg Curl") shows info and muscle, now as its own exercise.

## Review focus
- Two exercises that look the same to a user but differ only in the list (e.g. Lunge vs Walking Lunge, Dumbbell Squat vs Goblet Squat): keep only ones with a real difference in movement or equipment.
- Required-equipment mistakes (e.g. an exercise tagged with a machine it doesn't need, or missing the bench): these would hide or show exercises wrongly in sub-project 2.
- Reused drawings (`drawing`) pointing at the wrong pose; hand-drawn figures that mislead.
- Arabic names that clash or are ambiguous (two exercises with the same Arabic name — test).
- Bundle size: `exercise-info.js` grows to ~250 KB; check first-load time stays fine (service worker caches it).
- The "Show more" button must work in the Days editor and survive re-renders without losing the open state.

## Rollout
One deploy after the final review: sw v16. Existing users see more exercises and the Equipment line; nothing they logged changes.
