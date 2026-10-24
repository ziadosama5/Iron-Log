# Calorie target explainer: design (sub-project 20)

Date: 2026-10-24. Status: design approved in chat, spec for review.

## Purpose
The daily calorie target is a single number today. A person cannot see where it comes from, and two of its parts are fixed guesses (everyday activity x1.2, the goal's adjustment such as -450 kcal). Done when a person can open the target, see how it is built from named parts with their sources, and change the two assumptions.

Nothing changes for anyone who does not touch it: with no saved choice the numbers are exactly today's.

## Non-goals
- No per-day stored targets (the target stays derived from current settings and logged data).
- No change to how lifting or cardio kcal are estimated, and no new goals.
- No change to the shared summary or challenge scores (they do not use the target).

## Model
`energy.js`:
- `ACTIVITY = { sitting: 1.2, light: 1.3, active: 1.4, very: 1.5 }`, `DEFAULT_ACTIVITY = "sitting"`. The factors stay low because lifting and cardio are added separately (the usual "exercise included" factors would count them twice).
- `ADJUST_MIN = -1000`, `ADJUST_MAX = 1000`.
- `baselineBurn(bmr, activity)`: bmr x factor, rounded; unknown or missing activity = 1.2.
- `goalAdjustment(goal, adjust)`: the person's own `adjust` when it is an integer in range, otherwise `GOAL_ADJ[goal] || 0`.
- `dayEnergy({bmr, kg, goal, activity, adjust, workout, food})` returns the existing fields plus `factor` and `adj` (the adjustment used). Existing keys and numbers are unchanged when `activity` and `adjust` are absent.
- `explainTarget({bmr, src, kg, goal, activity, adjust, energy})`: pure, returns the ordered breakdown rows `{id, kcal, note}` for: resting (note = source `inbody` or `formula`), everyday (factor), lifting, cardio, goal adjustment, and totals `burned` and `target`. Returns `null` when the target is unknown.

## Data
Two optional fields on the private `users/{uid}/items/profile` document:
- `activity`: one of `sitting | light | active | very`. Absent = sitting.
- `adjust`: integer kcal, -1000..1000. Absent = the goal's default.

Round trip (a field not carried everywhere is silently dropped):
1. Snapshot parser: the profile document is stored whole, nothing to add.
2. `store.saveProfile` writes the whole object. The profile form builds a fresh object, so it must carry `activity` and `adjust` over from `state.profile`.
3. `plan-tools.mergeProfile` already spreads the existing profile (no change; a test pins it).
4. Backup: `cleanProfile` keeps `activity` when valid and `adjust` when an integer in range, only when the backup has them.
5. Export writes the profile document as it is.

## Callers
Three places compute a day with `dayEnergy` and must pass `activity: p.activity, adjust: p.adjust`: `energyView` (index.html), `achievements.js` (calorie badges) and `overview.js` (calories chart). Changing a setting therefore also changes how past days are judged; the target is a standing setting. The sheet says so in one line.

## UI
- Today's food card gets a small link "How is this built?" under the target (only when a target exists).
- It opens `#targetsheet` (`dialog.sheet`, same history/Back machinery as the other sheets) titled "Your daily target":
  1. The breakdown for the day on the Today date strip: Resting rate (with its source: "InBody scan, {date}" or "Estimated from your height, weight and age"), Everyday x{factor}, Lifting, Cardio, Goal adjustment, then Burned and Target.
  2. "Everyday activity": four options with plain examples (Mostly sitting: desk job, studying; Light: on your feet some of the day; Active: on your feet most of the day; Very active: physical work).
  3. "Daily adjustment": -/+ steps of 50 kcal, the value, and "Use goal default" (clears it). Shows the goal's default when unset.
  4. One line: "Changing these also changes how past days are judged."
- Changes save at once through `saveProfile` and redraw the card behind the sheet. Missing weight or About-you data: the sheet shows the same "fill in" message the card uses instead of the breakdown, and the settings stay available only when a profile exists.
- Arabic for every string; digits 0-9, units Latin; steppers LTR.

## Testing
- Unit: `ACTIVITY`/`baselineBurn`, `goalAdjustment` (range, non-integer, absent), `dayEnergy` unchanged without the new inputs and changed with them, `explainTarget` rows and null case, `cleanProfile` round trip, `mergeProfile` keeps both fields.
- UI (harness): the link opens the sheet, rows add up to the target, picking Active raises the target by the expected amount, the stepper changes it by 50, "Use goal default" restores it, saving the About-you form keeps both choices.
- Rules: the profile document is owner-only like all items; no rule change.

## Docs
CLAUDE.md (data model `profile` row, Food and energy card bullet, files list), docs/README.md index entry, docs/open-points.md (explainer item done), sw `VERSION` v43, privacy policy unchanged (same private profile data).
