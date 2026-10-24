# Deload suggestions: design (sub-project 24)

Date: 2026-10-25. Status: spec for the owner's review. Decisions come from `docs/roadmap-v1-features.md` section 3 (a banner on Today suggests an easy week after 6 weeks of training in a row, or when several lifts stall; one tap accepts; accepting turns on "Deload week" for 7 days with advice of about 90% of last weight for about 60% of the sets; nothing is blocked; it can be ended any time; dismissing silences the suggestion for 4 weeks). Per-day targets and automatically planned deloads are out.

## Purpose
After many hard weeks, or when lifts stop moving, a lighter week lets the body recover, but nothing in the app says so and an easy week would also wreck the advice (it would look like a stall). Done when the app suggests a deload at the right time, a deload week changes the advice and pre-fill to a lighter plan, and the week's lighter sessions never count as stalls or as "last time".

## Non-goals
Automatic or scheduled deloads, changing targets or days, blocking or limiting logging, reminders or notifications, a deload for cardio, RPE or fatigue tracking, editing past workouts' deload status in bulk.

## Rules (pure module `public/deload.js`, new, unit-tested)
Constants: `DELOAD_DAYS = 7`, `DISMISS_DAYS = 28`, `COOLDOWN_DAYS = 42`, `STREAK_WEEKS = 6`, `STALLED_LIFTS = 3`, `SET_FACTOR = 0.6`, `WEIGHT_FACTOR = 0.9`.
- `cleanDeload(obj) -> {start?, end?, dismissedUntil?}`: dates only if `YYYY-MM-DD` and real; `end` only with a `start` and not before it; junk gives `{}`.
- `activeDeload(deload, today) -> {start, end, day} | null`: active when `start <= today <= end`, where `end` is the stored `end` or `start + 6 days`; `day` is 1..7.
- `deloadDate(date, deload) -> boolean`: a workout date inside the window (used when a workout is saved).
- `stalledLifts(workouts) -> [exercise names]`: weighted exercises (entries without `bw: true`) with at least 4 sessions of working sets, ignoring sessions of workouts flagged `deload: true`, where the best e1RM of the last 3 sessions is not above 1.005 x the best before them (the same rule Coach uses today; Coach is changed to call this function so there is one rule).
- `suggestDeload({deload, today, streakWeeks, stalled}) -> null | {reason: "streak"|"stalled", weeks?, lifts?}`: nothing while a deload is active, while `today <= dismissedUntil`, or within `COOLDOWN_DAYS` of the last deload `start`; `reason "streak"` when `streakWeeks >= STREAK_WEEKS`; `reason "stalled"` when `stalled.length >= STALLED_LIFTS`; streak wins when both.
- `deloadWeight(top) -> number`: `top * 0.9` rounded to the nearest 2.5 kg, never below 2.5 and never above `top`; `deloadSets(sets) -> number`: `max(1, round(sets * 0.6))`.
- Training streak comes from the existing `trainingStreak(workouts, days, today).weeks` (consecutive finished Saturday-Friday weeks that met the weekly target).

## Data
- `settings.deload = {start?, end?, dismissedUntil?}` (omitted when empty). `start`/`end` are the last accepted deload (kept after it ends: it drives the 42-day cooldown); `dismissedUntil` is set to today + 28 when "Not now" is tapped.
- A workout saved while the window is active gets `deload: true` (omitted otherwise): `store.save` writes it; `cleanWorkout` keeps it only when `true`.
- **Round trip (a field not carried everywhere is silently dropped):** settings snapshot parser, `store.saveSettings` merge, `settingsDoc` (ui-helpers.js), `cleanSettings` (backup.js, via `cleanDeload`), export (via `settingsDoc`); workouts: the explicit body object in `store.save` (index.html) and `cleanWorkout`.

## Where it shows
- **Suggestion banner** on Today (under the level hero, above the day picker), only when `suggestDeload` is not null: "Time for an easy week? You have trained {n} weeks in a row." / "Several lifts have stalled ({names})." with **Start a deload week** and **Not now**. Start writes `deload.start = today`; Not now writes `dismissedUntil`.
- **Active banner** while a deload is active: "Deload week · day {d} of 7. Use about 90% of your usual weight for about 60% of your sets." with **End deload** (writes `end = yesterday`... or `today` for a same-day end so the window closes immediately; the stored `start` stays for the cooldown).
- **Exercise card advice and pre-fill** (`focusCard`): during a deload, `suggestNext` is replaced by the deload line: weighted exercises "Deload: {w} kg for about {n} sets" where `w = deloadWeight(heaviest working weight of the last normal session)` and `n = deloadSets(target.sets)`; set 1 is pre-filled with `w` and the last normal session's reps at that weight. Bodyweight exercises and holds: "Deload: about {n} sets, stay well short of your best" (no weight). No last session: no deload line. Nothing is blocked: the person can log whatever they like.
- **Not counted afterwards:** workouts with `deload: true` are skipped by "Last time", `suggestNext` and pre-fill (the next normal week continues from the pre-deload numbers), by `stalledLifts`, and by Coach's stalled/progressing tips; Lifts, History, volume, XP, streaks and challenge counts treat them as normal training (a deload day is still a training day).
- Coach: its "Stalled" tip stays, using `stalledLifts`.

## UI details
Banners are cards under the existing patterns; buttons 44px; text 12px minimum; Arabic for every string; numbers 0-9; no new tab or pill.

## Testing
- Unit (`tests/deload.test.js`): `cleanDeload`; `activeDeload` (first day, last day, ended early, before/after, junk); `deloadDate`; `stalledLifts` (4-session minimum, 1.005 rule, deload workouts ignored, bodyweight entries ignored, warm-ups/drops ignored, case-insensitive names merge); `suggestDeload` (streak, stalled, both, cooldown, dismissal, active, exactly 5 vs 6 weeks, 2 vs 3 stalled); `deloadWeight` rounding, floor and ceiling; `deloadSets`; `settingsDoc`/backup carry `deload` and drop junk; `cleanWorkout` keeps `deload: true` only; Coach and the banner share `stalledLifts` (source guard).
- UI (harness, `?deload=` and `?streak=` style options): the suggestion banner appears for a 6-week streak and for 3 stalled lifts, not for 5 weeks; Not now hides it; Start shows the active banner and the exercise card shows the deload line and pre-filled weight; a workout logged during the deload is flagged and the next "Last time" ignores it; End deload removes the banner; Arabic renders.
- Rules: no change (private items).

## Docs
CLAUDE.md (data model `settings.deload`, workout `deload`, files list, Today bullet, Coach), docs/README.md, docs/open-points.md, roadmap item 3 marked built, `/deload.js` in `APP_SHELL`, sw `VERSION`.
