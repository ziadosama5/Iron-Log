# Set types, targets and progression: design (sub-project 21, first piece of "training depth")

Date: 2026-10-24. Status: design approved in chat, spec for review.

## Purpose
Today every logged set is the same, and the app only shows last time's numbers. Two gaps: (1) warm-ups and drop sets pollute PRs, volume and "last time", and (2) nothing tells a person when to add weight. Done when a person can mark a set as warm-up or drop set, every statistic treats those sets correctly, every exercise has a target (sets x rep range, automatic by default, editable), and the exercise card tells them what to try today and pre-fills it.

Later pieces of training depth (separate specs): bodyweight mode, injuries / exercises to avoid, several gyms.

## Non-goals
Per-day targets, deloads, RPE, auto-regulation, advice for bodyweight or cardio exercises, changing how workout time or calories are estimated, changing what counts as a trained day (`trainedOn` stays as is, so a day with only warm-ups still counts).

## Data
- **Set type:** `k` on a set: `"w"` warm-up, `"d"` drop set; absent = normal. Sets stay `{w, r, t?, k?}`. Old workouts and backups are valid and count as before.
- **Targets:** `settings.targets = { "<exercise>": {sets, min, max} }`, `sets` integer 1-10, `min` and `max` integers 1-50 with `min <= max`. Absent exercise = the computed default. Written only through `settingsDoc()`.
- **Round trip (a field not carried everywhere is silently dropped):**
  - sets: `store.save` writes `entries` as they are; the edit-set path (`index.html` "edit-set"/"save-set") rebuilds the set object and must keep `k` and `t`; the backup cleaner (`backup.js` set cleaning) keeps `k` when `"w"`/`"d"` and drops anything else.
  - targets: snapshot parser (`settings=` branch), `store.saveSettings` (merge), `settingsDoc` (ui-helpers.js), `cleanSettings` (backup.js), export (via `settingsDoc`).

## Pure module: `public/progression.js` (new, unit-tested)
- `SET_TYPES = ["normal","warmup","drop"]`, `setType(s)` -> `"warmup"|"drop"|"normal"` from `s.k`.
- Counting helpers: `isWorking(s)` (normal only: PRs, best sets, e1RM, progression, prefill), `countsForVolume(s)` (normal and drop), `countsAsSet(s)` (normal and drop). `workingSets(sets)`, `volumeSets(sets)` filter accordingly.
- `defaultTarget(exName)` -> `{sets:3, min, max}`: big compounds (the same classification `defaultRest` uses for 3:00) 5-8; the 2:30 group and other multi-joint lifts 8-12; everything else 8-12; small isolation lifts (arms, delts, calves, abs by `muscleOf`) 10-15. `targetFor(settings, exName)` returns the saved target when valid, else the default. `validTarget(t)`.
- `stepFor(exName)`: 5 kg for big lower-body and back compounds (squat, deadlift, leg press, hip thrust and their variants by name/muscle group), else 2.5 kg.
- `suggestNext({last, target, step})` where `last` is the previous session's sets of the exercise and `target` the target:
  - Uses working sets only. Returns `null` when there are none, or when the heaviest working weight is 0 (bodyweight).
  - Let `top` = the heaviest working weight. `atTop` = working sets at `top`.
  - If `atTop.length >= target.sets` and every one has `r >= target.max`: `{kind:"increase", w: top + step, r: target.min}`.
  - Else if the best `r` among `atTop` is below `target.min`: `{kind:"hold", w: top, r: target.min, low:true}`.
  - Else `{kind:"hold", w: top, r: min(target.max, (lowest r among atTop) + 1)}`.
  - Rounded to 0.01 kg like prefill.

## Where the counting rules apply
| place | rule |
|---|---|
| PR badges on a set row, `bestBefore`, "New PR" toast, Lifts e1RM/top-set chart (`sessionsFor`), Overview strength/topLifts, achievements PR counting and `prs30`, Coach stalled/progressing lifts | working sets only |
| volume: workout summary (`vol`), History rows, shared summary `volumeWeekKg` (social.js), Overview if it sums volume | normal + drop |
| sets per muscle (Coach, Goals), "sets" count in summaries | normal + drop |
| prefill (`prefillFor`) and "Last time" line | last session's working sets (warm-ups and drops are not "last time") |
| workout length / lifting kcal (`energy.js`), rest-timer, trained-day rule | all sets, unchanged |

Because `social.js` and `achievements.js` are pure modules that already receive workouts, they use the helpers from `progression.js`.

## UI (Today > workout, focus card)
- **Target line** under the exercise name: "Target {sets} x {min}-{max}" (a tappable chip). Tapping opens an inline editor in the card: sets, min and max steppers (LTR, 44px), "Reset to default" (removes the saved entry), Done. Saves debounced into `settings.targets` like the rest time.
- **Advice line** below "Last time": "{Increase} Try {w} kg x {r}" / "Same weight: aim for {r} on every set" / "Same weight: build up to {min} reps". None when `suggestNext` is null.
- **Prefill:** with a suggestion, set 1's weight and reps start at the suggested values; later sets repeat today's last working set as today. Without a suggestion, behaviour is exactly as today.
- **Set type chips** (Normal, Warm-up, Drop set) above "Add set", `aria-pressed`; they reset to Normal after each added set. Logged rows show a small tag for warm-up and drop. Editing a logged set shows the same chips and can change its type. A warm-up never shows a PR badge.
- Arabic for every string; digits 0-9, units Latin; steppers stay LTR.

## Testing
- Unit (`tests/progression.test.js`): type helpers, filters, `defaultTarget` groups, `targetFor` with valid/invalid saved targets, `stepFor`, `suggestNext` for increase / hold / low / none / bodyweight / too few sets / warm-ups ignored / mixed weights.
- Unit: PR/volume/set-count helpers in achievements, overview, social (warm-up excluded from PRs and volume, drop in volume only); `prefillFor` ignores warm-ups and drops; backup keeps `k` and `targets`, drops invalid; `settingsDoc` carries `targets`.
- UI (harness): chips add a warm-up that shows a tag and no PR; editing a set keeps its type; the target editor changes the line and persists; a hit-the-top history shows "Try ..." and pre-fills set 1; Arabic opens with LTR steppers.
- Rules: no change (private items).

## Docs
CLAUDE.md (data model `w-` sets and `settings.targets`, Features: workout focus card, files list), docs/README.md index, docs/open-points.md, sw `VERSION`. Privacy policy unchanged (same private data).
