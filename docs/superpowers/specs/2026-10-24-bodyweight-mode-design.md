# Bodyweight mode: design (sub-project 22)

Date: 2026-10-24. Status: spec for the owner's review. Decisions come from `docs/roadmap-v1-features.md` section 1 (detection: automatic from the library plus a per-exercise switch; weight box = extra kg, negative for assisted; reps first, then add 2.5 kg).

## Purpose
Push-ups, pull-ups, dips and planks are logged today with a 20 kg default and a weight that cannot be zero-or-below, and every statistic treats them like barbell lifts. Done when bodyweight exercises log reps with an optional extra load, the statistics and progression advice treat them correctly, and a person can flip any exercise between weighted and bodyweight.

## Non-goals
Using the person's logged body weight in any calculation (no total-weight maths, no strength ratios for bodyweight lifts), changing weighted exercises in any way, per-set time units other than seconds for holds, timers.

## Which exercises are bodyweight
- **Library default** (`bwDefault(name)`): the exercise is in the library and every piece of equipment it needs is one of `bench, decline-bench, pullup-bar, dip-station, captains-chair, box, ab-wheel, hyper-bench, assisted-machine` (including none). That is 38 exercises today (Push-up, Pull-up, Chin-up, Dip, Chest Dip, Bench Dip, Plank, Side Plank, Wall Sit, Bodyweight Squat, Assisted Pull-up, Back Extension, Hanging Leg Raise, ...); a test pins the list so a library change is noticed. Custom (typed) exercises are weighted by default.
- **Holds** (`isHold(name)`): Plank, Side Plank, Wall Sit (matched by name). The "reps" of a hold are **seconds**.
- **Override:** `settings.bodyweight = { "<exercise>": true|false }`, stored only where it differs from `bwDefault`. The exercise card has a "Bodyweight" chip (`aria-pressed`) that flips it. It is disabled (with a one-line reason) once the exercise has sets logged today, so a workout entry never mixes meanings.
- **Snapshot on the entry:** when an exercise is added to a workout, the entry records `bw: true` (omitted when false). Pure statistics modules read `entry.bw`; they never need the settings, and turning the switch later does not rewrite history.

## Data
- Set: unchanged `{w, r, t?, k?}`. On a bodyweight entry `w` is **extra kg**: `0` = just the body, `+10` weighted pull-up, `-20` assisted. Range -500..2000 on bodyweight entries (weighted entries stay 0..2000). On a hold `r` is seconds (1-1000).
- Entry: `{ex, sets, done?, bw?: true}`.
- Settings: `bodyweight` map (at most 300 entries, names up to 80 characters, boolean values), written only through `settingsDoc()`.
- **Round trip:** snapshot parser (`settings=` branch), `store.saveSettings` merge, `settingsDoc`, `cleanSettings`, backup export (via `settingsDoc`); workout `bw` is kept by `cleanWorkout` (only `true`), `w` below 0 is accepted only when the entry has `bw: true`, and `store.save`/entry creation write the flag.

## Pure module `public/bodyweight.js` (new, unit-tested)
- `BW_STATIONS`, `bwDefault(name)`, `isHold(name)`, `bwFor(settings, name)` (override wins, own-key lookup only), `cleanBodyweight(obj)`.
- `loadKg(set)` -> `max(0, w)` (extra load that counts as lifted), used for volume everywhere.
- `bwScore(set)` -> a comparable number for "better set": higher extra kg first, then more reps (`w * 1000 + r`, with `w` clamped to -500..2000 and `r` to 1..999); assisted sets order correctly (less assistance = better).
- `bestSet(sets, bw)` -> the highest-scoring working set (weighted entries keep using e1RM).
- `formatLoad(w)` -> `"BW"`, `"+10"`, `"-20"` (used by the UI with `t()` for "BW").

## Counting rules for bodyweight entries (`entry.bw`)
| place | rule |
|---|---|
| PR (row badge, toast, `prEvents`, `prs30`, XP) | a working set is a PR when its `bwScore` beats every earlier session's best (same two-earlier-sessions rule as today) |
| e1RM column, Lifts "Best e1RM", Overview top lifts | "–" / excluded; Lifts shows "Best set" and "Sessions" for these lifts, and charts the top set's reps |
| volume (workout card, History, shared summary, volume badges, later volume challenges) | `loadKg(set) * r`: 0 for plain bodyweight, extra kg for weighted, 0 for assisted |
| strength-ratio badges (bench/squat/deadlift by name) | unchanged (not bodyweight exercises) |
| sets per muscle, workout time, lifting kcal, trained day | unchanged (every counted set counts) |
| "Last time" line | `BW x 12 · +10 x 8` (`formatLoad`) |

Set types (warm-up / drop) behave as in `progression.js` on top of these rules.

## Progression advice (extends `suggestNext` in `progression.js`)
- `suggestNext({last, target, step, bw, hold})`.
- Bodyweight, not a hold: judged at the highest extra load among working sets (may be `0` or negative). All target sets at that load reached `target.max` -> `{kind:"increase", w: load + 2.5, r: target.min, bw:true}`; best reps below `target.min` -> hold with `low`; otherwise hold at the same load with the weakest set's reps + 1 (capped at `max`). `w` rounds to 0.01 kg.
- Hold exercises (seconds): never suggest weight; hold advice only ("aim for {r} s").
- Weighted exercises: unchanged (a top weight of 0 still gives no suggestion).
- Text: increase "Add {w} kg extra, start at {r} reps" (negative extra for assisted reads "Less assistance: {w} kg, start at {r} reps"), hold "Aim for {r} reps on every set", low "Build up to {r} reps", hold exercises "Aim for {r} seconds on every set".
- Default targets: bodyweight exercises get `{sets:3, min:8, max:12}` (pull-up, dip family 6-10), holds `{sets:3, min:30, max:60}`; the existing editor and `settings.targets` work unchanged (min/max up to 50 for reps; the editor allows up to 600 for holds, validation widens to `max <= 600` only for holds).

## UI (Today > workout focus card)
- Weight box label becomes "Extra weight · kg" on a bodyweight exercise, with the hint "0 = your body. Negative = assisted." The stepper may go below 0 (floor -500) and starts at 0 for a first time (reps start at 8, holds at 30 seconds). Reps label becomes "Seconds" on holds.
- Set rows show the load with `formatLoad`; e1RM cell is "–"; PR badge as today.
- "Bodyweight" chip next to the Target chip (disabled with a reason once sets exist today).
- Arabic for every string; digits 0-9; steppers stay LTR; 44px / 12px minimums.

## Testing
- Unit: `bodyweight.js` (the pinned 38-exercise list, holds, override precedence, prototype-key names, `loadKg`, `bwScore` ordering including assisted, `bestSet`, `formatLoad`); `suggestNext` bodyweight cases (0 kg increase to 2.5, reps-first hold, assisted -20 -> -17.5, hold exercises, weighted unchanged); stats modules (PR via `bwScore`, volume 0 for plain bodyweight, Overview excludes bodyweight lifts); backup (`bw` kept, negative `w` only with `bw`, `settings.bodyweight` cleaned, old backups unchanged); `settingsDoc`.
- UI (harness): Push-up starts as bodyweight with the extra-weight label and 0 default; a custom exercise starts weighted and the chip flips it; a negative weight can be stepped to; a bodyweight set row shows BW/+kg; the chip is disabled once a set is logged; advice for bodyweight and hold exercises; Arabic labels and LTR steppers.
- Rules: no change.

## Docs
CLAUDE.md (workout bullet, data model rows for the entry `bw` and `settings.bodyweight`, files list), docs/README.md, docs/open-points.md, roadmap item 1 marked built, sw `VERSION` (and `/bodyweight.js` in `APP_SHELL`).
