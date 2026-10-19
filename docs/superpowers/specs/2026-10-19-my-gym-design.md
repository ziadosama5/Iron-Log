# My Gym — design

Part of "a special journey for each user" (next after friends: personal journey / generated plan). This one lets a person say which equipment their gym has, and hides exercises they cannot do from the suggestion lists.

## Goal
A user picks their gym's equipment (preset, then adjust), and the exercise suggestions, type-ahead and Coach's suggestions only offer library exercises whose equipment they have. Nothing already in their days or history is ever hidden, typed custom exercises always work, and the choice syncs to all their devices.

## What was agreed
- **Setup:** presets plus a checklist. Four presets as starting points; any item can then be ticked or unticked.
- **Filtering:** hidden from suggestions, with a "Show all exercises" switch to bring the rest back. Items already in a day or in history are never hidden.
- **One gym** per person for now (several named gyms are a later extension; the data shape does not prevent it).
- Unset = no filtering, exactly like today.

## Non-goals
Several gyms, generating a plan from the gym (personal journey), adapting templates ("Change split" still adds template exercises as they are), equipment photos, a bodyweight-exercise mode, server code, sharing the gym with friends.

## Data
- `users/{uid}/items/settings` gains `gym?: string[]`: ids from `EQUIPMENT`. **Absent = not set** (no filtering). `[]` = bodyweight only (valid). No more than the 39 known ids, no duplicates. Rules for `users/{uid}/items/*` are unchanged.
- Three places must carry the field (it is easy to drop it): the snapshot parser that builds `state.settings`, `store.saveSettings` (which writes `rest` and `seenBadges` explicitly), and `cleanSettings` in `backup.js` (drops unknown ids, de-duplicates, keeps `[]`; absent stays absent).

## Logic (pure, in `public/exercise-library.js`, unit-tested)
- `GYM_PRESETS`: `[{id, name, equipment: [ids]}]` for **Bodyweight only** (`[]`), **Home** (dumbbell, bench, pull-up bar, kettlebell, box, ab wheel), **Basic gym** (all weights, all stations, no machines), **Full gym** (all 39 ids). Tests: every id exists in `EQUIPMENT`, Full gym equals all ids, ids and names unique, each preset is a subset of the next (Bodyweight ⊂ Home ⊂ Basic ⊂ Full).
- `gymFilter(names, gym) → names`: when `gym` is not an array, returns `names` unchanged; otherwise keeps a name when `equipmentOf(name)` is `null` (custom or unknown) or every required id is in `gym`. Order preserved.
- `gymCounts(gym) → {items, itemsTotal, exercises, exercisesTotal}` for the live "27 of 39 items · 143 exercises available" line (`exercises` = `exercisesFor(gym).length`).

## Where it applies
- `suggestionsFor(focus, exclude)` (Days editor chips, + Exercise sheet): filtered through `gymFilter` unless "Show all" is on. It also returns how many names it hid, so the UI can say "Hiding N exercises that need other equipment" with a **Show all** / **Hide them again** switch (session only, `state.showAllGym`).
- The type-ahead list (`fillDatalist`): library names filtered; the person's own history names always included.
- Coach's "Under-trained muscle groups" suggestion (`LIB[m].slice(0,2)`): take the first two that pass the filter.
- Never filtered: exercises in `state.days`, in history (`exerciseNames()`), templates, backups, Lifts charts.

## Screens
- **My Gym** (More › My Gym, new view `gym`): preset buttons (current one highlighted when the ticked set equals it exactly), then the checklist grouped **Weights / Stations / Machines** as toggle chips with `aria-pressed` and the library's English/Arabic equipment names, the live counts line, and **Show everything** (clears the setting back to "not set"). Each tap saves (debounced ~600 ms, like the rest timer) and redraws the counts.
- **Hint card** on the Days tab while `gym` is unset: "Tell Iron Log what your gym has, so it only suggests exercises you can do." with **Set up** (opens My Gym) and **Not now** (remembered in `localStorage` `ironlog.gymHint`, per device). Never shown once the gym is set.
- Arabic for every new string; equipment names already translated; the chips and counts keep LTR numbers.

## Testing
Unit tests: presets (rules above), `gymFilter` (unset, `[]`, custom name kept, order kept, unknown id in `gym` ignored), `gymCounts`, `cleanSettings` (valid list, unknown ids dropped, duplicates removed, `[]` kept, absent stays absent). `tests/lang-coverage.test.js` for new strings. Headless screenshots (English light, Arabic dark) of My Gym and of a Days suggestion list with the "Hiding N" line, using the existing stub harness.

## Review focus (for the plan)
- `gym` surviving every round trip: Firestore write, snapshot, other `saveSettings` callers (rest, seenBadges must not erase it and vice versa), backup export and restore.
- `[]` (bodyweight only) behaving differently from unset.
- A person's own exercises never vanishing from any list after they untick equipment.
- The "Hiding N" count matching what is actually hidden; Show all toggling both ways.
- Typing while the checklist re-renders (taps must not be swallowed).
