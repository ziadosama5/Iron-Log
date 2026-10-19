# Personal journey — design

Roadmap item "a special journey for each user" (after profiles, friends and My Gym). A short setup asks a few questions and builds a ready week of training days that fits the person's goal, days per week, experience and gym. Free and offline: rules inside the app, no server, no AI calls.

## Goal
A new person signs in, answers four short questions (plus their body basics if missing) and ends on the Workout tab with a week of training days they can start today. Anyone can rerun it later. Nothing is a locked plan: the result is ordinary Days-tab data that stays fully editable.

## What was agreed
- **Output:** a ready week of training days (name, muscle focus, exercises, weekdays) in the existing Days format. No sets/reps targets.
- **Questions:** goal, days per week (2–6), gym (presets, fine-tune later in My Gym), experience (beginner / intermediate / advanced). Sex, height and birth year only when the profile is missing them (skippable).
- **Entry:** automatic for brand-new people, plus anyone can rerun it ("Plan my training"); rerun asks before replacing days. Workout history is never touched.

## Non-goals
Sets/reps/rest targets, injuries or exercises to avoid, progression or deload over time, cardio scheduling, nutrition, anything AI-based, a stored "journey done" flag, changing the plan automatically later.

## Generator (pure, `public/plan-tools.js`, unit-tested)
`buildPlan({goal, daysPerWeek, experience, gym}) → {split, days, notes}`:
- `goal` ∈ `fat-loss | muscle | recomp | strength | maintain` (the app's `GOALS` keys); `daysPerWeek` 2–6; `experience` ∈ `beginner | intermediate | advanced`; `gym` = list of equipment ids or `undefined` (everything).
- `days`: `[{name, focus: [muscle], exercises: [name], weekdays: [0-6]}]`, ids are added by the app. `split`: the split name shown in the preview. `notes`: short plain strings for muscles that could not be filled (for example "No back exercise fits a bodyweight-only gym") — translated through `t()` by the screen.
- **Splits (fixed by days per week):** 2 → Full Body A, B. 3 → beginners Full Body A, B, C; others Push, Pull, Legs. 4 → Upper A, Lower A, Upper B, Lower B. 5 → Push, Pull, Legs, Upper A, Lower A. 6 → Push, Pull, Legs, Push B, Pull B, Legs B (the B round takes the next unused picks). Day names must exist in the Arabic day-name table (new names are added there).
- **Muscles per day:** Push = Chest, Shoulders, Triceps; Pull = Back, Biceps (+ rear-delt/Shoulders work through the Shoulders list); Legs = Quads, Hamstrings & Glutes, Calves; Upper = Chest, Back, Shoulders, Biceps, Triceps; Lower = Quads, Hamstrings & Glutes, Calves, Core; Full Body = one or two exercises for each of Chest, Back, Shoulders, Quads, Hamstrings & Glutes plus a Core finisher (A/B/C rotate which exercises are picked).
- **Picking exercises:** from each muscle's library list in its existing popular-first order, after `gymFilter`. No two picks in a day from the same movement family (the name with equipment words removed — Barbell, Dumbbell, Cable, Machine, Smith, EZ, Seated, Standing, Lying — keeping Incline/Decline/Close-grip etc., so Bench Press and Dumbbell Bench Press never both appear). Second-round days (B / repeated) take the next unused picks so the same exercise does not fill every day when the library has alternatives. When a muscle has no usable exercise it is skipped and a note is added; a day left with no exercises is dropped from the plan and noted.
- **Volume by experience and goal** (exercises per muscle group in a day): beginner 1, intermediate 1–2, advanced 2; on a Full Body day always 1. `muscle` and `recomp` add one isolation exercise for Shoulders/Biceps/Triceps on Push/Pull/Upper days; `strength` keeps compounds only (first pick per muscle) and at most 5 exercises a day; `fat-loss` and `maintain` use the beginner volume. Every day has between 3 and 7 exercises when the gym allows it.
- **Weekdays (Saturday-first week):** 2 → Sat, Tue. 3 → Sat, Mon, Wed. 4 → Sat, Sun, Tue, Wed. 5 → Sat, Sun, Mon, Wed, Thu. 6 → Sat, Sun, Mon, Tue, Wed, Thu. Each day gets exactly one weekday, in plan order.
- **Always true (tests run every goal × days × experience × gym preset):** no empty day; no repeated exercise inside a day; every exercise is available in the gym (`gymFilter`); `focus` equals the set of muscle groups of the day's exercises (`muscleOf`); day names are unique; weekdays are unique across days; deterministic (same input, same plan).

## Screens
- **Journey** (new view `journey`, full screen, no tab bar while open): steps 1 Goal (five cards with the existing goal names), 2 Days per week (chips 2–6; the goal pre-selects a sensible default: strength 4, muscle 4, recomp 4, fat-loss 3, maintain 3), 3 Gym (presets from `GYM_PRESETS`, pre-selected from `settings.gym` when set, otherwise none selected = "Full gym" is not assumed; a line says details can be fine-tuned in My Gym), 4 Experience, 5 About you (only when sex, height or birth year are missing; fields reuse the Body-tab profile validation; **Skip** allowed), 6 Preview (the split name, each day with its weekday and exercise names, notes, a **Back** button and **Start**). Progress dots, Back/Next, answers kept in memory while the screen is open (`state.journey`).
- **Start** saves in one go: `saveProfile` (only changed or new fields, never clearing existing ones), `saveSettings({gym})` (only when the person chose a preset; skipping the gym step leaves `settings.gym` untouched), `saveDays(days)` (with ids and `PROGRAM_VERSION`), then `go("log")` with a toast. When days already exist the preview says "This replaces your current training days. Your workout history stays." and Start needs that to be visible (no extra dialog).
- **Entry points:**
  - Automatic: shown once the app has fully synced from the server (`state.serverSynced`), the person is signed in, `state.days` and `state.workouts` are both empty, and they did not skip on this device (`localStorage ironlog.journey = "skip"`, try/catch). Skip closes it and shows the card below.
  - Card "Plan my training — answer 4 quick questions and get a week that fits you." (a single **Start** button) on the Workout tab when there are no days, and a **Plan my training** button in the Days tab header (and on its empty state next to the template picker). A **Plan my training** row in the More sheet.
- Back gesture/browser back closes the journey like other full-screen views (history entry) without saving.
- Arabic for every new string, including the new day names, the notes and the step texts; usernames and numbers behave as elsewhere.

## Data
No new stored fields and no Firestore rule changes. It writes only the existing `program` (days + `v`), `profile` and `settings.gym` documents through the existing store methods (so the settings round-trip lessons from My Gym apply: `settingsDoc` carries `gym`).

## Testing
Unit tests for `plan-tools.js`: the exhaustive combination test above, split choice per days/experience, weekday table, movement-family de-duplication, bodyweight-only and Basic-gym fallbacks and notes, goal/experience volume rules, determinism, and a template-quality check (a 3-day beginner Full Body plan from the Full gym contains a squat pattern, a press and a row/pulldown). Language-coverage test for the new strings. Headless screenshots (English light, Arabic dark) of the Goal step, the Gym step, and the Preview.

## Review focus (for the plan)
- A returning user on a fresh device (cached empty snapshot) must never get the automatic journey before the server sync confirms they have no data.
- Rerun must not delete history or lose `settings` fields it does not own (rest, seenBadges, gym when skipped).
- Plans in unusual gyms (bodyweight only, home) must still be usable or say clearly why not.
- "Start" tapped twice, offline, or while a snapshot arrives must not write two plans or crash.
- Back/skip at every step must leave the app in a normal state.
