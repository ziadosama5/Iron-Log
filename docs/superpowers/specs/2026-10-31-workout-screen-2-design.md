# Workout screen 2.0 (sub-project 25): design

Status: draft for the owner's review (2026-10-31). Branch `workout-screen-2`.

## Why
The owner compared Iron Log with the open-source openGym (github.com/emilfunk/opengym, a fork of DuarteSantos8/openGym) and found two things better there: the **exercise pictures** (a large animated demo on the workout screen itself) and the **set tracking** (a list of pre-filled sets you tick off one by one, with a "why this weight" line). This sub-project brings both into the Today workout card, keeps everything Iron Log already does better, and adds no new data.

What I read in openGym (for reference, nothing is copied): a big autoplaying GIF at the top of the exercise screen with a tap-to-pause and a Minimize/Expand button (the choice is remembered); the exercise name with a muscle tag, an equipment tag and "Best: 85 kg"; "Last time (20 Jul): 85×8, 85×8…"; one green line "Last time you hit all reps, try 87.5 kg"; then one row per planned set (weight stepper, reps stepper, a round tick); ticking a set starts the rest timer.

## Understanding (please correct)
- **Goal:** the workout card should feel like following a guided session: see how the move looks, see the sets you are about to do, tick them off in one tap, know why the app suggests this weight.
- **Constraints:** no build step, same Firestore data (no migration, no rules change), Arabic for every string, 44 px targets, no text under 12 px, offline-friendly, nothing from openGym's media is copied (see Licence).
- **Success:** on a 360 px phone, opening an exercise shows the demo, the advice and the first set row without scrolling; the common case (did what was planned) is one tap per set; all existing behaviour (set types, bodyweight, holds, deload, PRs, edit a set, rest timer) keeps working.
- **Assumptions I made** (change any of them): see "Decisions" below.

## Scope
**In:**
1. Demo on the exercise card (animated two-pose figure, pause, minimize, muscle and equipment tags).
2. Planned set rows with a tick.
3. A "why" line under the advice.

**Out (follow-up sub-projects, none started):** supersets, muscle map (MuscleMap geometry is MIT), work timer for holds, RIR/RPE per set, 1RM calculator, imports from Strong/Hevy/FitNotes, year heatmap, plan sharing, a choice of progression rules, realistic photos/GIFs, move a day's workout to another day.

## 1. Demo on the card
**Today:** the two line drawings (`/exercises/<slug>-start.svg`, `-end.svg`) only appear inside the "!" sheet.

**New:** a demo box at the top of `focusCard`, above the exercise name.
- Shows the Start and Finish figures **alternating** (CSS opacity crossfade, about 2.4 s per loop, `ease-in-out`, a short hold on each pose). Pure CSS keyframes on two stacked inlined SVGs, so no new library and it follows the theme like the info sheet does (`currentColor`, `.exbg`).
- **Tap** = pause/play (`aria-pressed`; paused shows the Start pose). A small hint ("Tap to pause") shows on the first view only.
- **Minimize / Expand** button on the box. Minimized = a 56 px thumbnail beside the name row (still animated), full = the box. The choice is a per-device preference in `localStorage` `ironlog.demo` (`"full"` default, `"mini"`), like Accent and Theme, so there is **no settings round trip**. Wrapped in try/catch like the other localStorage reads.
- **Size cap:** `max-height: min(180px, 26vh)` so the sets stay on screen on short phones.
- **Reduced motion** (`prefers-reduced-motion: reduce`): no animation; Start and Finish shown side by side (as in the info sheet).
- **Tags row** under the name: primary muscles and equipment from `infoFor` / `equipmentOf` (plain chips, translated with `nameOf`). The "Best" value stays where it is.
- The "!" button stays (tips, Avoid, credit line). Exercises without drawings (custom typed ones) show no demo and no gap.
- **Offline:** when the workout of the day opens, the drawings of its exercises are fetched once in the background so the service worker has cached them (about 12 exercises × 2 files, small). Failure is silent; the box shows the existing "Drawing not available offline yet" text.
- The "!" sheet is refactored to share one `exerciseFigures(info)` helper with the card so the two never differ.

## 2. Planned set rows
**Today:** the card has big steppers, an "Add set N" button and a table of logged sets. Nothing shows how many sets are planned.

**New:** one list of rows, in this order:
- **Logged rows** (as today's table rows): set number (+ Warm-up / Drop tag), weight, reps, e1RM and PR badge, a filled green tick, a ✕ delete. Tapping the values still loads the set into the steppers to edit it (`edit-set`, unchanged).
- **Planned rows:** `plannedRows({target, sets, deload})` (pure, in `progression.js`) returns how many working sets are still planned: `max(0, target.sets − workingSets(sets).length)`; in a deload week the planned count is the deload set count and the weight is the deload weight. Warm-ups and drop sets never use up a planned row (same counting rule as everywhere else). Planned rows show the **pre-filled values** (the suggestion or last session's set N, i.e. what `prefillFor` already produces) dimmed, with a hollow tick.
- **Only the next planned row's tick is active.** Tapping it logs a set with the values in the steppers (exactly what "Add set" does today: same `readSet`, same set type from the chips, same PR/e1RM, same rest timer, same one write). The other planned rows are `aria-disabled` and dimmed so sets are always logged in order, as now.
- The big steppers (±2.5 kg, ±1 rep) stay directly above the list and edit the next planned row; the list shows their values live.
- After the planned rows are used up, the primary **"Add set N"** button stays for extra sets. Before that, it is replaced by the tick (the rows are the button), so the card has one clear action.
- When the last planned row is logged, **✓ Done** becomes the highlighted button and "Next: …" stays beside it. Nothing is marked done automatically.
- Holds show seconds, bodyweight shows BW / +10 / −20, exactly as the table does today.

## 3. The "why" line
`suggestNext` stays the only rule (double progression). It gains an extra field `why` (a code plus numbers), and `adviceWhy(sug)` in index.html turns it into one short sentence shown under the advice:
- increase: "All {n} sets reached {r} reps last time, the top of your range."
- same weight, more reps: "Last time your lowest set was {r} reps. One more rep each set."
- below the range: "Last time was under {min} reps. Build up to {min} first."
- bodyweight and holds: the matching wording (reps, seconds, less assistance).
- deload: "Easy week: about 90% of your last weight for about 60% of the sets."
All strings go through `t()`/`tn()` with Arabic entries. No new rule, no changed numbers.

## Decisions (defaults I chose; tell me if you want others)
1. Demo default is **full**, remembered per device.
2. Animation is two crossfading line figures, **not** GIFs or photos.
3. A tick logs immediately with no confirmation or undo toast; ✕ on the row already removes a mistaken set.
4. Out-of-order ticking is not allowed.
5. No auto "done" on the last set.
6. Planned rows are a view over existing data: **nothing new is stored**.

## Licence and the "perfect pictures" question
openGym's images are animated 3D-style GIFs from `hasaneyldrm/exercises-dataset`. openGym's own NOTICE says they are not covered by its AGPL licence and keep the dataset's terms, and I could not confirm a clear licence. **We do not copy, bundle or hotlink them.** Our figures are Everkinetic (CC BY-SA 4.0) and our own drawings, which is safe for a public app and a Play listing. If you want realistic images later, that is a separate decision: I would first research a source with a clear free licence (public domain or CC) and check its size against offline use. This spec does not depend on it, and the demo box works with any image source.

## Files touched
- `public/index.html`: `focusCard` (demo box, tags row, rows), `openExInfo` (shared figures helper), CSS (crossfade keyframes, `.demo`, `.demo.mini`, rows, reduced motion), event handlers (`demo-toggle`, `demo-size`, `log-planned`), warm-up fetch when a workout opens.
- `public/progression.js`: `plannedRows`, `why` field on `suggestNext` results (+ `deloadAdvice` already has its own kind).
- `public/lang-ar.js`: every new string.
- `public/sw.js`: bump `VERSION` to v48. No new `public/*.js`, so `APP_SHELL` is unchanged.
- No change to Firestore documents, `firestore.rules`, backup, `wipePlan` or the privacy policy.

## Tests
- **Unit (`npm test`):** `plannedRows` (target 3 with 0/1/2/3/4 working sets; warm-ups and drop sets do not use a row; deload count; hold; bodyweight), `suggestNext` still returns the same `kind/w/r` (existing tests untouched) and now the right `why` for increase / hold / low / bw / hold-seconds, Arabic coverage.
- **UI (`tests-ui`, Playwright on the harness):** demo present with two figures and an animation; tap pauses; Minimize persists after reload; reduced motion shows two figures and no animation; first tick logs one set with the pre-filled values and starts the rest bar; later ticks are disabled; extra sets after the last planned row via "Add set"; edit-set and ✕ still work; a warm-up does not consume a row; deload, bodyweight (`bw=1..3`) and hold cases; Arabic/RTL (`lang=ar`); every target ≥ 44 px and text ≥ 12 px; on a 360×640 viewport the first planned row's tick is visible without scrolling when the demo is minimized, and with the capped demo when full.
- Local check by the owner with `firebase serve`, then deploy as usual.

## Risks and how they are handled
- **A tall demo pushes the sets off-screen:** capped height, minimize, default checked on a 360×640 viewport.
- **A tick is easier to mis-tap than "Add set":** the tick is 44 px, only the next row is live, ✕ removes a wrong set.
- **Animation cost on old phones:** opacity-only keyframes, paused while the tab is hidden and when minimized-off-screen is not needed; reduced-motion honoured.
- **Snapshot re-render under a finger:** rows are drawn by the same `renderLog` path that already defers while typing.

## Open questions for you
1. Is the default **full** demo right, or should it start minimized once you have trained a few weeks?
2. Do you want me to research licence-clean realistic images as a separate follow-up, or are the line drawings enough?
3. Which follow-up comes first after this one: supersets, the muscle map, or the hold timer?
