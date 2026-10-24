# Injuries and exercises to avoid: design (sub-project 23)

Date: 2026-10-24. Status: spec for the owner's review. Decisions come from `docs/roadmap-v1-features.md` section 2 (body areas plus hiding single exercises; avoided exercises leave suggestions, the Add list, type-ahead and the generated week; exercises already in days or history stay with a warning; nothing is deleted; "show anyway" exists; no automatic swap).

## Purpose
A person with a sore knee or shoulder keeps being offered squats and presses, and the generated training week ignores it. Done when a person can say which body areas hurt and which single exercises they want to avoid, every place the app suggests an exercise leaves those out, and anything already on their days or in their history is clearly marked instead of silently changed.

## Non-goals
Medical advice or diagnosis (the screen says it is a filter, not treatment), automatic swapping of exercises on existing days, pain scales or injury dates, hiding anything the person already has (days, history, templates they apply), per-set pain logging.

## Body areas
Seven fixed areas, ids in this order: `shoulder`, `elbow`, `wrist`, `lower-back`, `hip`, `knee`, `ankle`. Each has an English name and an Arabic name (`AR.names.area`, a missing name fails the tests like every library name).

## The joint table (`public/injuries.js`, new, pure, unit-tested)
- `AREAS` (the seven ids), `JOINTS` an explicit table `{ "<library exercise>": [area ids] }` with **one entry for every one of the 183 library exercises** (an empty list is allowed: Plank loads shoulders and lower back, Crunch loads none). A test fails when a library exercise has no entry, when an entry names an exercise that is not in the library, or when an area id is unknown, so every future exercise forces a decision, exactly like Arabic names do.
- Meaning of a tag: the joint carries real load or is held in a stressed position by the movement (for example Squat: knee, hip, lower-back, ankle; Bench Press: shoulder, elbow, wrist; Pull-up: shoulder, elbow, wrist; Romanian Deadlift: lower-back, hip; Lateral Raise: shoulder; Bicep Curl: elbow, wrist; Calf Raise: ankle; Hip Thrust: hip, lower-back; Plank: shoulder, lower-back, wrist). A few sanity tests pin these examples.
- **Review gate:** Claude writes the table, then publishes it as a review list (`docs/injury-tags.md`, grouped by muscle) for the owner to correct before the feature is finished. Corrections are edits to the table.
- `jointsOf(name) -> [area ids]` (own-key lookup; custom exercises and unknown names give `[]`).
- `avoidFilter(names, avoid) -> names`: removes names that the person avoids: a name in `avoid.exercises` (case-insensitive) or a name whose `jointsOf` intersects `avoid.areas`. `avoid` missing or empty returns `names` unchanged.
- `avoidedBecause(name, avoid) -> { exercise: boolean, areas: [area ids] }`: why a name is avoided (used by the warning text); empty result when it is not.
- `cleanAvoid(obj) -> {areas?, exercises?}`: areas filtered to known ids and de-duplicated in `AREAS` order; exercises: strings of 1-80 characters, de-duplicated case-insensitively, at most 100; each key omitted when empty.
- `hiddenAvoidCount(lists, avoid)` for the "Hiding N" note.

## Data
- `settings.avoid = { areas?: [area ids], exercises?: [exercise names] }`, omitted entirely when both are empty. Written only through `settingsDoc()`.
- **Round trip (a field not carried everywhere is silently dropped):** the settings snapshot parser, `store.saveSettings` merge, `settingsDoc` (ui-helpers.js), `cleanSettings` (backup.js, via `cleanAvoid`), export (via `settingsDoc`). Saved immediately on each tap (no debounce) like My Gym's setting after 600 ms; a draft overlay like `gymEdit` is not needed because writes are single taps, but the parser keeps `state.avoidDraft` laid over snapshots while a save is pending, the same pattern as `pendingTargets`.

## Where the filter applies
Exactly where the gym filter applies today, through the same functions, never hiding what the person already has:
| place | rule |
|---|---|
| suggestion chips in the Days editor and the Add exercise sheet (`suggestionsFor`) | `avoidFilter` after `gymFilter` |
| "type any exercise" list (`typeaheadNames` / `exDatalist`) | library names through `avoidFilter`; the person's own history and day names always stay |
| Coach "low muscle" suggestions | `avoidFilter` |
| Plan my training (`buildPlan` in plan-tools.js) | the pools go through `avoidFilter` too; a muscle that nothing is left for adds a note ("No {muscle} exercise fits your gym and injuries."), a day left empty is left out with the existing note wording extended |
| templates applied from Days | unchanged (they are the person's explicit choice); avoided exercises in them are marked by the warning below |
| exercises already in days, today's workout, history, Lifts | never hidden, never removed |

The note under the suggestion chips becomes one line covering both filters: "Hiding {n} exercises (gym and injuries). Show all", driven by the existing `state.showAllGym` switch (it now means "show everything the filters hide"); text keys for the gym-only and avoid-only cases are kept so existing wording stays when only one filter is active.

## Warnings on what is already there
`avoidedBecause` marks, with a small warning icon and an accessible label ("Avoided: knee" / "Avoided by you"):
- the exercise chips on Today's workout and the focus card (a one-line banner under the name: "You chose to avoid this: it loads your knee." with a "Skip it" button that removes the exercise from today's workout only when it has no sets),
- the exercise rows in the Days editor and the day cards' exercise list,
- the exercise info sheet.
Nothing else changes: the person can still log it, it just never surprises them.

## UI: where it is set
My Gym screen (Plan > My Gym) gets a second card "Injuries" under the equipment card (no new pill, so `nav.js` is untouched):
- Intro line: "Pick the areas that hurt. Exercises that load them are left out of suggestions. This is a filter, not medical advice."
- Seven area chips (`aria-pressed`), 44px targets, named with `names.area`.
- "Exercises I avoid": a list with a remove button per entry, and a text field with type-ahead over the library (Add button). The exercise info sheet gets an "Avoid this exercise" / "Stop avoiding" button as the quick path.
- Counts line: "{n} exercises hidden from suggestions" (matches `hiddenAvoidCount` over the whole library).
- Arabic for every string; chips and buttons follow the existing RTL rules.

## Testing
- Unit (`tests/injuries.test.js`): table completeness and validity against the library (both directions), the pinned sanity examples, `jointsOf` (custom, prototype-like names), `avoidFilter` (areas, single names case-insensitive, both, empty), `avoidedBecause`, `cleanAvoid` (junk, caps, order, de-dup), `hiddenAvoidCount`; `settingsDoc` carries `avoid` only when non-empty; backup keeps valid `avoid`, drops junk, old backups unchanged; `buildPlan` with avoid: no avoided exercise appears in any generated day for every goal x days x experience x gym preset (the existing exhaustive loop extended), notes when a muscle or day is emptied; `typeaheadNames` keeps history and day names; `suggestionsFor` equivalent through the pure helper.
- UI (harness): an area chip hides matching suggestions and the note appears; "Show all" reveals them; an avoided exercise already on today's day keeps showing with the warning; the info sheet button adds and removes an avoided exercise; the injuries card persists across a re-render; Plan my training avoids a chosen area; Arabic renders.
- Rules: no change (private items).

## Docs
CLAUDE.md (data model `settings.avoid`, files list, My Gym bullet, features), docs/README.md, docs/open-points.md, roadmap item 2 marked built, `docs/injury-tags.md` (the reviewed table), `/injuries.js` in `APP_SHELL`, sw `VERSION`, `AR.names.area`.
