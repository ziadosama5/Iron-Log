# Personal Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A short setup (goal, days per week, gym, experience, body basics if missing) builds a ready week of training days; shown automatically to brand-new people and rerunnable by anyone.

**Architecture:** A pure, unit-tested `public/plan-tools.js` holds the generator (`buildPlan`), the entry rule (`shouldAutoJourney`) and the profile check. `index.html` gets a full-screen `journey` view, entry points (auto, Workout card, Days button, More row) and saves through the existing `saveDays` / `saveProfile` / `saveSettings`. No new stored fields, no Firestore rules change.

**Tech Stack:** plain JS ES modules, `node --test`, headless Edge + Firebase-stub harness (`$TEMP/harness`, port 5071; restart `run.cjs` after editing `index.html`, it rebuilds the page only at start) for screenshots.

**Spec:** `docs/superpowers/specs/2026-10-19-personal-journey-design.md` (binding; it holds the split table, weekday table, volume rules and screens, which this plan does not repeat).

## Global Constraints

- No new dependency, no build step. `public/plan-tools.js` is new: add `/plan-tools.js` to `APP_SHELL` and bump `iron-log-v21` in the release task only. `npm test` must keep passing with nothing installed.
- `index.html`, `lang-ar.js`, `sw.js` have CRLF endings: edit with Edit or Write-tool scripts (heredocs mangle backslashes and apostrophes).
- Generator inputs: `goal` ∈ `fat-loss|muscle|recomp|strength|maintain`, `daysPerWeek` 2–6, `experience` ∈ `beginner|intermediate|advanced`, `gym` = list of equipment ids or `undefined` (everything). Day names come only from: `Push, Pull, Legs, Push B, Pull B, Legs B, Upper A, Lower A, Upper B, Lower B, Full Body A, Full Body B, Full Body C`; each must exist in `AR.names.day` (add the missing ones in Task 1).
- Volume rules (the spec leaves "1–2" open; fixed here): counts are per muscle per day. beginner / fat-loss / maintain = 1 for every muscle. intermediate = 2 for Chest, Back, Quads, Hamstrings & Glutes and 1 for the rest. advanced = 2 for every muscle except Calves and Core (1). Full Body days are always 1. `muscle` and `recomp` add +1 for Shoulders, Biceps and Triceps on Push, Pull and Upper days. `strength` is 1 per muscle except Calves and Core (0), and at most 5 exercises a day. Every day is cut to at most 7 exercises (from the end).
- Pick rule: per muscle, walk `LIB[muscle]` (popular first) through `gymFilter`; skip a name whose movement family is already used that day; prefer names not yet used anywhere in the plan, and only reuse a plan-used name when no unused candidate remains. Pull days also take one rear-delt exercise: the first Shoulders name containing "Rear Delt" or "Face Pull" that passes the filter (silently skipped if none).
- `focus` of a generated day = the muscle groups of its exercises (`muscleOf`) in `MUSCLES` order.
- Every new user-visible string goes through `t()`/`tn()` with an Arabic entry; usernames and numbers behave as elsewhere. Nothing is deployed before the final review and the user's go-ahead.

## Review Focus

- A returning user on a fresh device (cached empty snapshot) must not get the automatic journey before the server sync → Task 2 tests of `shouldAutoJourney`.
- Rerun must not delete history or erase `settings` fields it does not own (rest, seenBadges, gym when the gym step is left alone) → Task 3: Start passes only `{gym}` to `saveSettings` and only when a preset was chosen; verified by code read and a harness run.
- Unusual gyms (bodyweight only, home) → Task 1 exhaustive test plus tests of the `notes` output and dropped empty days.
- "Start" tapped twice, offline, or during a snapshot → Task 3 `state.journey.busy` guard (second tap does nothing) and reading the answers before any write.
- Back / skip at every step leaves a normal app → Task 3 (history entry, `closeJourney` always returns to a normal view, skip stored in `localStorage ironlog.journey`).

---

### Task 1: `public/plan-tools.js` — the generator

**Files:**
- Create: `public/plan-tools.js`, `tests/plan-tools.test.js`
- Modify: `public/lang-ar.js` (only the missing day names)

**Interfaces:**
- Produces (exported):
  - `EXPERIENCE: ["beginner","intermediate","advanced"]`
  - `GOAL_DEFAULT_DAYS: {strength:4, muscle:4, recomp:4, "fat-loss":3, maintain:3}`
  - `movementFamily(name: string) → string`: lower-case name with the words Barbell, Dumbbell, Cable, Machine, Smith, EZ-bar/EZ, Seated, Standing, Lying, One-arm, Single-arm removed and whitespace collapsed; Incline, Decline, Close-grip, Wide-grip, Reverse etc. are kept.
  - `buildPlan({goal, daysPerWeek, experience, gym}) → {split: string, days: [{name, focus, exercises, weekdays}], notes: [{text, params}]}`; `split` ∈ `"Full Body"`, `"Push / Pull / Legs"`, `"Upper / Lower"`, `"Push / Pull / Legs + Upper / Lower"`, `"Push / Pull / Legs ×2"`. `notes` texts: `"No {muscle} exercise fits your gym."` (params `{muscle}`) when a required muscle ended with no pick, `"{day} was left out: nothing in it fits your gym."` (params `{day}`) when a whole day is empty and removed (its weekday is dropped and the remaining days keep their own weekdays). Deterministic. Invalid input values throw `Error`.
- Consumes: `LIB, MUSCLES, muscleOf, gymFilter` from `exercise-library.js`.

- [ ] **Step 1: Write the failing tests** in `tests/plan-tools.test.js`:
  - `movementFamily("Dumbbell Bench Press") === movementFamily("Bench Press")`; `movementFamily("Incline Dumbbell Press") !== movementFamily("Bench Press")`; `movementFamily("Seated Cable Row") === movementFamily("Barbell Row")` is **false** is not required — assert only the first two plus `"Lat Pulldown"` unchanged lower-cased.
  - split choice: `(2) → "Full Body"` with days `Full Body A, Full Body B`; `(3, beginner) → "Full Body"` with A, B, C; `(3, intermediate) → "Push / Pull / Legs"` with `Push, Pull, Legs`; `(4)` → `Upper A, Lower A, Upper B, Lower B`; `(5)` → `Push, Pull, Legs, Upper A, Lower A`; `(6)` → `Push, Pull, Legs, Push B, Pull B, Legs B`.
  - weekday table: for each days-per-week the weekdays equal the spec's list in plan order (2 → `[6,2]`, 3 → `[6,1,3]`, 4 → `[6,0,2,3]`, 5 → `[6,0,1,3,4]`, 6 → `[6,0,1,2,3,4]`), each day carrying exactly one.
  - exhaustive: for every goal × daysPerWeek 2–6 × experience × gym in `[undefined, ...GYM_PRESETS equipment]` (import `GYM_PRESETS` from `exercise-library.js`): no day empty; no exercise repeated inside a day; no two exercises of one day share a `movementFamily`; every exercise passes `gymFilter([name], gym).length === 1`; every day has ≤ 7 exercises, and for `strength` ≤ 5; `focus` equals the muscle groups of the exercises in `MUSCLES` order; names unique; weekdays unique across days; calling twice gives deep-equal results; with the Full gym every day has ≥ 3 exercises.
  - quality: `buildPlan({goal:"muscle", daysPerWeek:3, experience:"beginner"})` Full Body A contains a Quads exercise matching `/Squat|Leg Press/`, a Chest exercise matching `/Press/` and a Back exercise matching `/Row|Pulldown|Pull-up/`; days B and C use exercises not in A where the library has alternatives (assert `A ∩ B` has fewer than half of A's items).
  - volume: for `advanced`/`muscle` the Push day has more exercises than for `beginner`/`fat-loss`; `strength` has fewer exercises than `muscle` for the same other inputs.
  - unusual gyms: `gym: []` (bodyweight only) with `daysPerWeek: 4` returns days with only bodyweight exercises and `notes` includes `{text:"No Back exercise fits your gym.", params:{muscle:"Back"}}` (or Back is filled by a bodyweight pull exercise if the library has one: assert whichever is true by checking `muscleOf` of the picks, and that a note exists exactly when Back is missing); if a day would be empty it is removed and noted with the `"{day} was left out…"` text.
  - invalid input throws (`daysPerWeek: 1`, `goal: "x"`, `experience: "x"`).
  - `AR.names.day` has an entry for every generated day name (import `AR` from `../public/lang-ar.js`).
- [ ] **Step 2: Run** `node --test tests/plan-tools.test.js` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `public/plan-tools.js` per the spec and the Global Constraints above (split table → per-day muscle lists → pick rule → volume rules → focus from `muscleOf` → weekdays → notes). Add the missing Arabic day names (`Push B`, `Pull B`, `Legs B`, and any other absent from `AR.names.day`) to `lang-ar.js`.
- [ ] **Step 4: Run** `npm test` — Expected: all pass.
- [ ] **Step 5: Commit** `git add public/plan-tools.js public/lang-ar.js tests/plan-tools.test.js && git commit -m "feat: plan generator (buildPlan, splits, weekdays, volume rules)"`

---

### Task 2: Entry rule and profile check (same module)

**Files:**
- Modify: `public/plan-tools.js`, `tests/plan-tools.test.js`

**Interfaces:**
- Produces (exported):
  - `shouldAutoJourney({authed, synced, days, workouts, skipped, shown}) → boolean`: true only when `authed === true`, `synced === true`, `days` and `workouts` are both empty arrays, `skipped` is false and `shown` is false.
  - `needsAbout(profile) → boolean`: true when `sex`, `height` or `birthYear` is missing/falsy in the profile object (null/undefined profile → true).
  - `checkProfile({sex, height, birthYear, goal}, year) → {ok:true, profile:{sex,height,birthYear,goal}} | {ok:false}`: sex `"male"|"female"`, height number 100–250, birthYear integer from `year-100` to `year-10`, goal one of the five goals; values may be strings (comma decimal accepted) and are converted to numbers.
  - `mergeProfile(existing, answers) → object`: `{...existing, goal: answers.goal}` plus `sex`, `height`, `birthYear` from `answers` only when they are present and valid; never removes `goalWeight`/`goalStart`.
- Consumes: Task 1 constants.

- [ ] **Step 1: Write the failing tests:** `shouldAutoJourney` is false for each single failing condition (not authed, not synced — the cached-empty-snapshot case, has a day, has a workout, skipped, already shown) and true for the all-clear case; `needsAbout` for `{}`, `null`, a full profile, one missing field; `checkProfile` accepts `"178,5"`/`"1996"` strings, rejects height 99 and 251, birthYear `year-9` and `year-101`, bad sex, bad goal; `mergeProfile` keeps `goalWeight` and `goalStart`, sets the goal, ignores invalid height, adds sex/height/birthYear when valid.
- [ ] **Step 2: Run** `node --test tests/plan-tools.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** the four functions in `plan-tools.js`.
- [ ] **Step 4: Run** `npm test` — Expected: pass.
- [ ] **Step 5: Commit** `feat: journey entry rule, profile check and merge`.

---

### Task 3: The Journey screen

**Files:**
- Modify: `public/index.html`, `public/lang-ar.js`, `tests/lang-coverage.test.js` (only for strings shown through conditions or constants)

**Interfaces:**
- Consumes: Tasks 1–2, `GYM_PRESETS`, `GOALS`, `store.saveDays/saveProfile/saveSettings`, `uid()`, `PROGRAM_VERSION`.
- Produces:
  - `state.journey = null | {step, goal, days, preset, experience, about:{sex,height,birthYear}, busy, fromAuto}`; step order `goal, days, gym, experience, about (only when needsAbout(state.profile)), preview`.
  - view `journey` (`<section id="view-journey">`, title "Plan my training"), tab bar hidden while it is open (`render()` hides `#nav`), progress dots, **Back** / **Next**, **Skip** on every step but the preview.
  - `openJourney(fromAuto)` (pushes a history entry, defaults: goal from `state.profile.goal`, `days = GOAL_DEFAULT_DAYS[goal]`, preset = the `GYM_PRESETS` entry equal to `state.settings.gym` via `sameGym`, else `null`), `closeJourney()` (always returns to `log`, never saves; `fromAuto` or Skip writes `localStorage ironlog.journey = "skip"` in try/catch), click actions `jr-goal`, `jr-days`, `jr-gym` (a preset id or `none` = "Not sure, suggest everything"), `jr-exp`, `jr-next`, `jr-back`, `jr-skip`, `jr-start`.
  - Gym used for the plan: the chosen preset's equipment; if none chosen, `state.settings.gym` (may be `undefined`). The preview line says "Planned for: <preset name or My Gym list or Every exercise>".
  - `jr-start`: ignored when `busy`; sets `busy`, reads `state.journey` into locals, then `store.saveDays(plan.days.map(d=>({id:uid(),...d})))`, `store.saveProfile(mergeProfile(state.profile, {goal, ...about}))`, and `store.saveSettings({gym})` **only** when a preset was chosen; clears `state.journey`, `go("log")`, toast "Your plan is ready". When `state.days.length>0` the preview shows "This replaces your current training days. Your workout history stays."
  - About step: sex (two chips), height (cm), birth year; **Skip** moves on without saving them; invalid values show the existing profile error style toast and stay on the step (use `checkProfile` with `goal` filled from the answers).

- [ ] **Step 1: Register the view:** `<section id="view-journey" class="view" hidden>`, `SCREEN_TITLES.journey`, `VIEWS`, render map, `#nav` hidden while `state.view==="journey"`, popstate handler for the history entry (closes without saving), `state.journey` reset on sign-out.
- [ ] **Step 2: Implement** `renderJourney()` per step (cards/chips reuse `.card`, `.chip`, `.btn`), the actions above and the preview built from `buildPlan` (days with weekday names via the existing weekday labels, exercise names via `nameOf("ex", n)`, notes via `t(note.text, note.params)`).
- [ ] **Step 4 (Arabic):** run `npm test`, add every missing string to `AR.ui` (identical `{placeholders}`, including the two note texts, the five split names and "Planned for…" lines), add condition/constant strings to the coverage test list, run until green.
- [ ] **Step 5: Verify:** `node --check` of the page script (slice between `<script type="module">` and the last `</script>` into `$TEMP/page.mjs`); restart the harness; add `go=journey` to `run.cjs` (More row not needed yet: open via `openJourney` exposed on `window` only inside the harness script, or via the More row from Task 4 — if the row is not there yet, do this step after Task 4); screenshots of Goal, Gym and Preview steps in English light and Arabic dark; no horizontal scroll at 500 px; the preview for `gym=[]` shows notes.
- [ ] **Step 6: Commit** `feat: Journey screen (steps, preview, start, skip, back)`.

---

### Task 4: Entry points

**Files:**
- Modify: `public/index.html`, `public/lang-ar.js`

**Interfaces:**
- Consumes: Task 3 `openJourney`, Task 2 `shouldAutoJourney`.
- Produces:
  - `maybeStartJourney()` called from the `store.init` data callback: builds the arguments from state (`authed:state.authed, synced:state.serverSynced===true, days:state.days, workouts:state.workouts, skipped:(localStorage ironlog.journey==="skip", try/catch), shown:state.journeyShown`), sets `state.journeyShown=true` and calls `openJourney(true)` when true.
  - "Plan my training" entry points, all calling `openJourney(false)`: a card on the Workout tab when `state.days` is empty (text "Plan my training — answer 4 quick questions and get a week that fits you." and a **Start** button), a button in the Days tab header next to "Change split" and on its empty state above the template grid, and a row in the More sheet (above "My Gym").

- [ ] **Step 1: Implement** `maybeStartJourney`, the three entry points and the More row (`data-act="more-go"` replaced by `data-act="journey-open"`: close the sheet, then `openJourney(false)`).
- [ ] **Step 2: Verify in the harness:** with seeded data (days and workouts) nothing opens automatically; with a stub flag `?fresh=1` that seeds no days and no workouts the Journey opens by itself after the first server snapshot, Skip returns to the Workout tab with the card, and a reload keeps it skipped; run through all steps in the harness and confirm Start writes days (the Days tab then lists the generated days).
- [ ] **Step 3: Arabic + checks:** `npm test` (add missing strings), `node --check` of the page script.
- [ ] **Step 4: Commit** `feat: journey entry points (auto, Workout card, Days, More)`.

---

### Task 5: Docs and release

**Files:**
- Modify: `public/sw.js`, `CLAUDE.md`, `README.md`, `docs/README.md`

- [ ] **Step 1:** `sw.js` → `VERSION = "iron-log-v21"` and add `"/plan-tools.js"` to `APP_SHELL`.
- [ ] **Step 2:** `CLAUDE.md`: Files list (`plan-tools.js`: buildPlan, movementFamily, shouldAutoJourney, needsAbout, checkProfile, mergeProfile), a Features bullet for the Journey (steps, auto rule, entry points, what Start writes, skip key `ironlog.journey`), More-sheet list, and the Planned/Ideas lines (journey done; challenges and readiness pass remain). `README.md`: one line in "What it does". `docs/README.md`: row 13 ✓ sw v21; next = readiness pass and challenges.
- [ ] **Step 3:** Final checks: `npm test`; `node --check` of the page script; screenshots still fine.
- [ ] **Step 4: Commit** `feat: personal journey, sw v21`.
