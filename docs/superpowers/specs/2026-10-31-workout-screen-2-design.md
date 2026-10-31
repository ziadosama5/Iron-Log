# Workout screen 2.0 (sub-project 25): design

Status: draft for the owner's review (2026-10-31). Branch `workout-screen-2`.

## Why
The owner compared Iron Log with the open-source openGym (github.com/emilfunk/opengym, a fork of DuarteSantos8/openGym) and found two things better there: the **exercise pictures** (a large animated demo on the workout screen itself) and the **set tracking** (a list of pre-filled sets you tick off one by one, with a "why this weight" line). This sub-project brings both into the Today workout card, keeps everything Iron Log already does better, and adds no new data.

What I read in openGym (for reference, nothing is copied): a big autoplaying GIF at the top of the exercise screen with a tap-to-pause and a Minimize/Expand button (the choice is remembered); the exercise name with a muscle tag, an equipment tag and "Best: 85 kg"; "Last time (20 Jul): 85×8, 85×8…"; one green line "Last time you hit all reps, try 87.5 kg"; then one row per planned set (weight stepper, reps stepper, a round tick); ticking a set starts the rest timer.

## Understanding (please correct)
- **Goal:** the workout card should feel like following a guided session: see how the move looks, see the sets you are about to do, tick them off in one tap, know why the app suggests this weight.
- **Constraints:** no build step, same Firestore data (no migration, no rules change), Arabic for every string, 44 px targets, no text under 12 px, offline-friendly, the exercise GIFs come from the public dataset openGym uses (the owner confirmed no licence is needed; see Licence note).
- **Success:** on a 360 px phone, opening an exercise shows the demo, the advice and the first set row without scrolling; the common case (did what was planned) is one tap per set; all existing behaviour (set types, bodyweight, holds, deload, PRs, edit a set, rest timer) keeps working.
- **Assumptions I made** (change any of them): see "Decisions" below.

## Scope
**In:**
1. Demo on the exercise card (animated GIF with a line-drawing fallback, pause, minimize, muscle and equipment tags).
2. Planned set rows with a tick.
3. A "why" line under the advice.

**Out (follow-up sub-projects, none started):** supersets, muscle map (MuscleMap geometry is MIT), work timer for holds, RIR/RPE per set, 1RM calculator, imports from Strong/Hevy/FitNotes, year heatmap, plan sharing, a choice of progression rules, move a day's workout to another day.

## 1. Demo on the card
**Today:** the two line drawings (`/exercises/<slug>-start.svg`, `-end.svg`) only appear inside the "!" sheet.

**New:** a demo box at the top of `focusCard`, above the exercise name, showing the **animated GIF** of the exercise (the same pictures openGym uses, from `hasaneyldrm/exercises-dataset`; the owner confirmed they are public and need no licence).
- **Source and delivery.** The GIFs are loaded from the jsDelivr CDN, pinned to one commit so the files can never change under us: `https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/<file>.gif` (still frame: `images/<file>.jpg`). Reasons: the dataset is ~128 MB, a GIF is ~90 KB, and Firebase's free plan allows 360 MB of hosting transfer per day (about 4,000 GIF views), which a shared app could exceed; the CDN has no such limit and sends CORS headers. Self-hosting only the mapped GIFs (~183 files, ~17 MB) stays possible later by changing one base-URL constant (`DEMO_BASE`).
- **Which GIF for which exercise.** A reviewed table `tools/exercise-gifs.json` maps each of our 183 exercise names to a dataset file id (`{"Bench Press": "0025-…"}`). Their names differ from ours ("barbell bench press"), so a dev script `tools/match-gifs.mjs` proposes the best match for each name (a quick token match found a good candidate for 85, a likely one for 89 and none for 9: Pec Deck, Reverse Pec Deck, Skull Crusher, Dumbbell Skull Crusher, Hip Thrust, Dumbbell Hip Thrust, Glute Kickback Machine, Plank, Ab Wheel Rollout) and writes a **review list** like `docs/injury-tags.md` for the owner to check, because a wrong picture (a barbell shown for a dumbbell lift) is worse than none. The generated `public/exercise-gifs.js` exports `GIFS` and `gifFor(name)`; a unit test fails for a library exercise that has neither a mapping nor an explicit `none`.
- **Fallback.** An exercise with no GIF, a GIF that fails to load (offline, first view) or a custom exercise keeps showing the line drawings: the Start and Finish figures alternate with a CSS crossfade (about 2.4 s per loop, opacity only, theme-aware). Nothing is deleted: the drawings stay in the "!" sheet, with their credit line.
- **Tap** = pause/play (the still JPG replaces the GIF while paused; `aria-pressed`). A small hint ("Tap to pause") shows on the first view only.
- **Minimize / Expand** button on the box. Minimized = a 56 px thumbnail beside the name row (still animated), full = the box. The choice is a per-device preference in `localStorage` `ironlog.demo` (`"full"` default, `"mini"`), like Accent and Theme, so there is **no settings round trip**. Wrapped in try/catch like the other localStorage reads.
- **Size cap:** `max-height: min(180px, 26vh)` so the sets stay on screen on short phones; the GIF is `object-fit: contain` on a white tile (the pictures have a white background in both themes), `loading="eager"` for the open exercise only, `decoding="async"`, `alt` = the exercise name.
- **Reduced motion** (`prefers-reduced-motion: reduce`): the still image is shown, no animation, and tapping plays it.
- **Offline.** The service worker gets a cache-first rule for the demo host (`cdn.jsdelivr.net/gh/hasaneyldrm/`), images requested with `crossorigin="anonymous"` so the responses are cacheable (not opaque), in its own cache that keeps at most 80 files (oldest dropped). When the day's workout opens, the GIFs of its exercises are fetched in the background so they are there at the gym. The Android app gets the same behaviour from the same code.
- **Tags row** under the name: primary muscles and equipment from `infoFor` / `equipmentOf` (plain chips, translated with `nameOf`). The "Best" value stays where it is.
- The "!" button stays (tips, Avoid). The sheet shows the GIF at the top when there is one, then the drawings; both the card and the sheet use one `exerciseFigures(name)` helper so they never differ.
- **Credit and privacy.** The credit line gains "Animations: hasaneyldrm/exercises-dataset". `privacy.html` (English + Arabic) gets one sentence: the exercise pictures are loaded from a public CDN (jsDelivr), which sees the phone's IP address like any website would, and no account data is sent. `tests/pages.test.js` checks the statement.

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
2. The demo is the dataset's **GIF** (owner's decision), loaded from a pinned jsDelivr URL and cached by the service worker; the line drawings are the fallback.
3. A tick logs immediately with no confirmation or undo toast; ✕ on the row already removes a mistaken set.
4. Out-of-order ticking is not allowed.
5. No auto "done" on the last set.
6. Planned rows are a view over existing data: **nothing new is stored**.

## Licence note
The owner checked that the dataset's GIFs are public and need no licence, so they are used. For the record (not a blocker): the repository declares no licence file (GitHub shows "NOASSERTION") and openGym's NOTICE says the media keeps the dataset's own terms. Because of that the design keeps the risk small: nothing is copied into this repo, the files are loaded from a commit-pinned URL through one `DEMO_BASE` constant, and the line drawings remain as a complete fallback, so removing the GIFs later (for a Play listing or a takedown) is a one-line change that loses no feature.

## Files touched
- `public/index.html`: `focusCard` (demo box, tags row, rows), `openExInfo` (shared figures helper), CSS (`.demo`, `.demo.mini`, crossfade fallback, rows, reduced motion), event handlers (`demo-toggle`, `demo-size`, `log-planned`), background fetch of the day's GIFs when a workout opens.
- `public/exercise-gifs.js` (new, generated from `tools/exercise-gifs.json` by `tools/match-gifs.mjs`): `DEMO_BASE`, `GIFS`, `gifFor(name)`, `stillFor(name)`. Added to `APP_SHELL`.
- `tools/exercise-gifs.json`, `tools/match-gifs.mjs`, `docs/gif-matches.md` (the review list for the owner).
- `public/progression.js`: `plannedRows`, `why` field on `suggestNext` results (+ `deloadAdvice` already has its own kind).
- `public/lang-ar.js`: every new string.
- `public/sw.js`: bump `VERSION` to v48, new `exercise-gifs.js` in `APP_SHELL`, a capped runtime cache for the demo host.
- `public/privacy.html` (EN + AR) one sentence, `tests/pages.test.js`.
- No change to Firestore documents, `firestore.rules`, backup or `wipePlan`.

## Tests
- **Unit (`npm test`):** every library exercise has a GIF mapping or an explicit `none`, every mapped id looks like a dataset file id, `gifFor`/`stillFor` build the pinned URLs, a custom name has none; `plannedRows` (target 3 with 0/1/2/3/4 working sets; warm-ups and drop sets do not use a row; deload count; hold; bodyweight), `suggestNext` still returns the same `kind/w/r` (existing tests untouched) and now the right `why` for increase / hold / low / bw / hold-seconds, Arabic coverage.
- **UI (`tests-ui`, Playwright on the harness; the harness serves a tiny local GIF for the demo host so tests need no internet):** demo shows the GIF; a failed GIF falls back to the two drawings; tap pauses (still image); Minimize persists after reload; reduced motion shows the still; first tick logs one set with the pre-filled values and starts the rest bar; later ticks are disabled; extra sets after the last planned row via "Add set"; edit-set and ✕ still work; a warm-up does not consume a row; deload, bodyweight (`bw=1..3`) and hold cases; Arabic/RTL (`lang=ar`); every target ≥ 44 px and text ≥ 12 px; on a 360×640 viewport the first planned row's tick is visible without scrolling when the demo is minimized, and with the capped demo when full.
- Local check by the owner with `firebase serve`, then deploy as usual.

## Risks and how they are handled
- **A tall demo pushes the sets off-screen:** capped height, minimize, default checked on a 360×640 viewport.
- **A tick is easier to mis-tap than "Add set":** the tick is 44 px, only the next row is live, ✕ removes a wrong set.
- **A wrong or missing picture:** the match table is reviewed by the owner (`docs/gif-matches.md`), the 9 unmatched names start as `none` and keep the drawings.
- **CDN down or slow, or the first view offline:** the drawings show at once, the GIF replaces them when it loads, cached GIFs work offline.
- **Mobile data and battery:** about 90 KB per new exercise, cached afterwards; the cache is capped at 80 files; reduced motion shows the still.
- **Third-party dependency:** one constant (`DEMO_BASE`) switches to self-hosting the mapped files.
- **Snapshot re-render under a finger:** rows are drawn by the same `renderLog` path that already defers while typing.

## Open questions for you
1. Is the default **full** demo right, or should it start minimized once you have trained a few weeks?
2. Load the GIFs from the CDN (my recommendation: no hosting quota, small app) or copy the ~183 mapped files into `public/` (works fully offline from the first run, but counts against the free 360 MB/day hosting transfer)?
3. Which follow-up comes first after this one: supersets, the muscle map, or the hold timer?
