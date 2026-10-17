# Calories and cardio — design

Date: 2026-10-17
Status: approved in chat, awaiting spec review
Part 1 of the user's "Coach improvements" request. Part 2 (achievements: streaks, badges, progress bars) is a separate later project built on the numbers defined here.

## Goal

Each day, show calories **eaten vs burned vs target**, where "burned" includes the lifting and cardio actually done that day, and let people log cardio and meals quickly. The user wants both an accurate daily balance for their goal and visible effort that keeps them motivated.

**Success criteria**
- Logging a cardio session takes: type → minutes → (optional kcal) → Add.
- Logging a meal takes: kcal → Add (name and protein optional).
- The Coach "Today" card shows eaten, target, burned (with breakdown) and balance for any chosen date; the numbers change the moment a set, cardio session or meal is added.
- Exercise is never counted twice in the target.

**Constraints (unchanged)**
- No build step, no runtime dependencies, free Spark plan, offline-capable, mobile-first (400px, no horizontal scroll), light/dark tokens, plain short copy, units kg/kcal/min.
- Firestore rejects `undefined`.

## Decisions (from brainstorming)

- Intake: quick add per meal (kcal required; name, protein optional). No food database.
- Cardio calories: the machine's number when typed, otherwise an estimate from minutes × intensity × body weight.
- Target model **A**: the daily target rises with exercise done that day. It replaces the Coach's current fixed activity-multiplier estimate (the "Daily targets" insight), so there is one calorie number in the app.

## Calculations — `public/energy.js` (pure, unit-tested)

| function | rule |
|---|---|
| `baselineBurn(bmr)` | `bmr × 1.2` (everyday life without workouts), rounded |
| `bmrFor(profile, body, today)` | latest InBody `bmr` if < 120 days old; else Mifflin-St Jeor (`10·kg + 6.25·cm − 5·age + 5` male / `− 161` female) from profile + latest weight; else `null` |
| `liftMinutes(workout)` | sets with `t`: (last t − first t)/60000 + 2; if that span > 180 min or fewer than 2 timed sets, fall back to `2.5 × total sets`; no sets → 0 |
| `liftKcal(workout, kg)` | `(3.5 − 1) × kg × liftMinutes/60`, rounded |
| `cardioKcal(c, kg)` | `c.kcal` when it is a number (machine), else `(MET − 1) × kg × c.min/60`, rounded, MET from the table below |
| `exerciseKcal(workout, kg)` | `liftKcal + Σ cardioKcal` → `{lift, cardio, total}` |
| `dayEnergy({bmr, kg, goal, workout, food})` | `{baseline, lift, cardio, burned: baseline+lift+cardio, target: burned + GOAL_ADJ[goal], eaten: Σ meal kcal, protein: Σ meal protein or null, balance: eaten − burned}`; any part that needs missing data is `null` |

`GOAL_ADJ = {"fat-loss": -450, "muscle": 250, "recomp": -150, "strength": 150, "maintain": 0}` (same values the Coach uses today; missing goal → 0).

Estimates subtract 1 MET because the resting part of the burn is already in the baseline. Machine numbers are used as typed.

**MET table (Compendium of Physical Activities, rounded):**

| type | easy | moderate | hard |
|---|---|---|---|
| treadmill | 4.3 | 8.0 | 10.0 |
| elliptical | 4.0 | 5.0 | 7.0 |
| bike | 3.5 | 6.8 | 8.8 |
| other | 4.0 | 6.0 | 8.0 |

Body weight `kg` = latest logged weight on or before the date. Without it, `lift`, estimated `cardio`, `baseline` (if it needs Mifflin) and `target` are `null` and the UI says "Log your weight on the Body tab".

## Data model

- **Set times:** every new set gets `t` (ms since epoch) in `entries[].sets[]`: `{w, r, t}`. Editing a set keeps its `t`. Old sets have none.
- **Cardio:** in the day's workout doc `w-YYYY-MM-DD`: `cardio: [{id, type: "treadmill"|"elliptical"|"bike"|"other", min: 1–600, intensity: "easy"|"moderate"|"hard", kcal: number|null}]`. A day with only cardio is a workout doc with `entries: []`, `dayId: null`, `dayName: "Cardio"` unless a day was already chosen.
- **Food:** new doc `f-YYYY-MM-DD`: `{date, meals: [{id, name: string|null (≤40), kcal: 1–5000, protein: number|null (0–500)}], updated}`. Deleting the last meal deletes the doc.
- **Snapshot:** ids starting `f-` load into `state.food`; nothing else changes. Workouts without `cardio` behave as `[]`.
- **Backup/restore:** export includes `f-` docs. `cleanBackupItems` keeps set `t` (finite, positive), `cardio` (validated per the shape above, bad items dropped) and `f-` docs (date must match id; bad meals dropped; doc skipped if no valid meals).

**"Trained that day"** now means *has sets or has cardio* for: History list and counts, the Coach "workouts in the last 7 days" insight, and the AI summary. Training-day rotation (`nextDay`, `lastTrained`) keeps using sets only, so a cardio day doesn't advance Push → Pull → Legs.

## UI

**Workout tab — Cardio card** (below the exercise list and "Add an exercise"; also shown under the day picker so a cardio-only day needs no training day):
- Logged sessions: `Treadmill · 25 min · 280 kcal` or `Bike · 30 min · ~210 kcal est.`, each with ✕ (aria-label "Delete <type> session").
- Add form: type chips (Treadmill, Elliptical, Bike, Other; one selected, Treadmill default), minutes input with −5/+5 buttons (default 20), intensity chips (Easy, Moderate, Hard; default Moderate; hint "Used when kcal is blank"), "kcal from machine" input (optional), **Add cardio** button. Invalid minutes (not 1–600) or kcal (not 1–5000 when given) → toast, nothing saved.
- Adding cardio writes the workout doc once; it does not start the rest timer.

**Coach tab — Today card** (first card, above Body insights; replaces the "Daily targets" insight):
- Date input (max today, default today).
- Three figures: **Eaten** `1,640 / 2,180 kcal`, **Burned** `2,510 kcal` with a small breakdown line `Everyday 2,050 · Lifting 180 · Cardio 280`, **Balance** `−870 kcal`. Balance is shown in the good color when its sign matches the goal (deficit for fat-loss/recomp, surplus for muscle/strength, within ±200 for maintain), otherwise muted.
- Progress bar: eaten ÷ target (capped visually at 100%, with an "over by N kcal" label when above).
- Add a meal: kcal (required, numeric), name chips Breakfast / Lunch / Dinner / Snack that fill the name field (free text allowed, optional), protein g (optional), **Add meal** button. Meal list below with ✕.
- Protein line when any meal has protein: `Protein 96 g of 128–176 g` (existing 1.6–2.2 g/kg range).
- Missing profile/weight: the card still allows logging meals and shows what's missing instead of numbers.

**History:** cards include cardio chips (`Treadmill 25 min`) and `· N kcal exercise` in the summary line.

**AI summary ("Copy my summary"):** add `foodLast28Days` (date, total kcal, protein) and cardio per workout.

## Error handling

- All numbers validated before writing; invalid input → toast, no write.
- Writes go through `store.write` (existing error toasts). Food and cardio edits are one doc write each.
- Missing data never throws: functions return `null` parts and the UI explains what to log.

## Testing

- **Unit (`npm test`):** `energy.js` (each function, including fallbacks: no timed sets, >180 min span, machine vs estimated cardio, missing weight/profile, goal adjustments, InBody vs Mifflin BMR, protein null vs sum); `cleanBackupItems` for `t`, `cardio`, `f-` docs.
- **Mock renders** (headless Edge, real CSS) of the Cardio card and Today card at 400px, light and dark.
- **Manual (phone):** log cardio with and without machine kcal; log meals; Today card updates live; cardio-only day appears in History and doesn't change "Up next"; restore a backup containing food and cardio.
- **Release:** sw VERSION bump, `energy.js` in APP_SHELL, CLAUDE.md data model + features.
