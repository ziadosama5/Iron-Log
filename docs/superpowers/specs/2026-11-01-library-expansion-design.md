# Exercise library expansion (sub-project 26): design

Status: owner answered (2026-11-01): **add them all**, cardio and stretches included. Open items 2 and 3 were left to the defaults below (English How-to steps only; ship the review lists as-is and fix what the owner reports). Branch `library-expansion` (cut from `workout-screen-2`, because it builds on its GIF mapping). Nothing deployed; the live app is untouched.

## Why
Today the app knows 183 curated exercises. The GIF dataset it now uses (`hasaneyldrm/exercises-dataset`, names, muscles and instructions MIT-licensed; the media is © Gym visual, see the licence gate in CLAUDE.md) has **1,324 exercises, every one with a GIF**. The owner asked to use all of them, so every exercise has a picture that matches it exactly (right equipment, right movement) instead of a "closest match".

## What is in the dataset (measured)
- 1,324 records; fields: name, category (body part), target muscle, secondary muscles, muscle group, equipment (28 kinds), instructions in 10 languages (**no Arabic**), step lists, GIF/image ids.
- 77 are the same exercise repeated as "v. 2", "(male)", "(female)" or "pov" views → **1,286 distinct**.
- 157 are already in our library (the pictures we use now) → **1,129 new**: 1,034 strength-type, 68 stretch/mobility/foam-roller, 29 cardio.
- New ones by equipment: dumbbell 245, body weight 236, cable 132, barbell 115, machine ("leverage") 51, band 60, smith 37, kettlebell 40, weighted 33, stability ball 20, EZ bar 21, sled machine 11, medicine ball 13, other 20.

## Scope
**In:** import **all 1,129** new exercises into the library with name, muscle group, equipment, GIF and a How-to; Arabic names; injury joint tags; a real search in the Add-exercise sheet; My Gym and Injuries keep working on all of them.
**Out:** Arabic instructions (English steps are shown), tips for the new ones (the curated 183 keep their tips), changing generated training plans, new muscle groups, any change to stored data (workouts keep storing the exercise name).

## Design

### Data pipeline (dev tool, not shipped)
`tools/import-catalog.mjs --data <dataset exercises.json>` reads the dataset and writes generated modules; the repo never contains the 560 KB of 10-language text, only what we use.
- `public/exercise-catalog.js` (eager, ~120 KB): one row per new exercise `[name, group, equipmentIds, gifId, secondaryGroups]` plus helpers; merged by `exercise-library.js` **after** the curated 183 so "popular first" order and every existing test of the curated list keep working. A `CURATED` set marks the original 183.
- `public/exercise-howto.js` (lazy, `import()` when an info sheet opens, cached by the service worker): English step lists by lowercase name (~450 KB). Missing/unloaded = the sheet shows the muscles and equipment only.
- `public/lang-ar-catalog.js` (eager): Arabic names for the new exercises, merged into `AR.names.ex`. Written by me, short and in plain Modern Standard Arabic like the rest of the app; the owner reviews `docs/arabic-names-catalog.md` (a table).
- `public/injuries-catalog.js`: joint tags for the new exercises, derived by explicit rules (`tools/joint-rules.mjs`: target muscle + movement words, conservative = more joints rather than fewer) with a review list `docs/injury-tags-catalog.md`.
- `public/exercise-gifs.js` is regenerated: a new exercise maps to **its own** GIF id (exact), the 157 curated ones keep their reviewed mapping.

### Names, folding, collisions
Title Case of the dataset name ("barbell full squat" → "Barbell Full Squat"). The "(male)/(female)/v. N/pov" duplicates are folded into one entry. A new name that equals a curated name (case-insensitive) is dropped. Curated names never change, so no workout, program or backup is affected.

### Muscle groups and equipment
- Our 9 muscle groups stay (no new group, no change to Coach, plans or Days chips). Mapping table by dataset target: pectorals→Chest; lats, upper back, traps, spine, levator scapulae→Back; delts→Shoulders; biceps→Biceps; **forearms→Biceps (arms)**; triceps→Triceps; quads→Quads; hamstrings, glutes, adductors, abductors→Hamstrings & Glutes; calves→Calves; abs, serratus→Core; neck→Back.
- Equipment: the 39 ids stay; **new ids** (each with an English and Arabic name) for kinds we do not have: `stability-ball`, `bosu-ball`, `medicine-ball`, `resistance-band`, `battle-rope`, `foam-roller`, `wheel-roller`, `sled-machine`, `lever-machine` (generic selectorized machine when no specific machine id fits), `weight-plate`, `tire`, `sledgehammer`, `ergometer`, `olympic-barbell`. Specific machines map by name words (e.g. "lever seated fly" → `pec-deck`). My Gym presets are updated: Bodyweight/Home/Basic/Full gym keep their meaning (Full gym = everything; Home gains band, stability ball, medicine ball, roller).
- Bodyweight, holds and rest defaults for the new ones come from rules: dataset equipment "body weight" → bodyweight by default; names with plank/hold/wall sit/isometric/stretch → timed hold; compound keywords → the 3:00 rest.

### Where the new exercises show up
- **Everywhere a library list is shown:** the Add-exercise sheet, Days editor suggestions, the type-ahead, My Gym counts ("N of M exercises available"), the injuries filter. Lists stay "6 per muscle, popular first, Show more"; the remainder is alphabetical.
- **New: search in the Add-exercise sheet.** A search box (type any part of the name, English or Arabic, equipment words too) with live results (name, muscle chip, equipment chip, tiny GIF), 20 results and "Show more". The current "type any exercise" form stays for custom exercises.
- **Generated training plans and Coach "under-trained" suggestions use only the curated 183** (reviewed splits, movement-family rules and the exhaustive plan tests stay valid). The owner can later widen this.
- **Info sheet:** GIF, "Works:" (target + secondary), Equipment, **How to** (lazy English steps) and Avoid; tips only for the curated 183.

### Size and speed
Eager: about +120 KB catalog, +70 KB Arabic names, +60 KB joint tags (minified-ish JSON-like arrays; the service worker caches them). Lazy: the How-to file. A unit test pins the eager size so it cannot grow unnoticed; a UI test opens Today with the full library and checks no long task over 200 ms on the harness.

### Licence note (unchanged gate)
Dataset text/data are MIT (the LICENSE is copied to `docs/notices/exercises-dataset-LICENSE.txt`). The pictures remain © Gym visual: the same owner decision and kill switch as before applies to all 1,324 pictures; a wider catalog makes the Play review more likely to look at it, so settle it first.

## The UI is not redesigned here
The owner pointed out that the Carbon and Bloom looks so far change colours, type and a few shapes but the **screens are laid out as before**. This sub-project adds only the one new screen element it needs (the search in the Add-exercise sheet) and builds it from the existing components and tokens, so it follows whatever look is active and is restyled for free when the layouts change. The real layout redesign (the screens shown on the design canvas: big-number workout card, floating bars, new Today, etc.) is its own sub-project, tracked in `docs/superpowers/specs/2026-10-31-standalone-health-data-roadmap.md` as "Looks 2.0: real layouts".

## Decisions (defaults I chose; tell me to change any)
1. **Fold the 77 duplicates** (v. 2, male, female, pov) into one entry each.
2. **All 1,129 are included (owner's decision).** Strength-type (1,034) log weight × reps as usual. **Stretch/mobility/foam-roller (68) and cardio-category (29)** are logged as **timed holds** (seconds, no weight, like Plank); in the library they appear under their body part (cardio under Core). The separate "+ Cardio" log (minutes, kcal) is unchanged.
3. **Forearm exercises go under "Biceps"** (no new muscle group).
4. **Arabic for names only;** the How-to steps show in English in the Arabic app (translating ~560 KB of steps is a separate, optional step).
5. **Generated plans and Coach suggestions stay on the curated 183.**
6. Specific machines map to our existing machine ids; unmatched machines use the generic `lever-machine` id.

## Tests
- **Tool/unit:** every new row has a unique non-colliding name, a valid group, valid equipment ids, a GIF id that exists in the dataset, an Arabic name and joint tags; counts (1,129 minus exclusions) pinned; curated 183 untouched (names, order, equipment, tips); My Gym preset counts; `exercisesFor(gym)` and the injury filter work over the whole list; no new exercise shares a GIF with another; the equipment-agreement test from the GIF work now covers every exercise.
- **UI:** the search finds "full squat", "سكوات" and "dumbbell" results and adds one; adding an imported exercise logs sets (weight/reps, bodyweight, hold variants); My Gym hides/shows by equipment; Arabic names show; the info sheet loads How-to lazily and offline from cache; Today stays fast with the whole library.

## Risks
- Wrong automatic muscle/equipment/joint tags → rule tables + review lists for the owner, conservative joint rules, the equipment-agreement test.
- Machine-written Arabic names → review table; a wrong name is cosmetic (stored data stays English).
- Parse cost on very old phones → measured, pinned size, How-to lazy.
- A person's old custom exercise with the same name as a new library one → history is unchanged; it simply becomes a library exercise (tips/equipment filter now apply).

## Open questions for you
1. Are the six defaults above right (especially cardio excluded, stretches included as holds)?
2. OK that Arabic instructions are not part of this step?
3. Should the owner-review lists (Arabic names, injury tags, equipment mapping) be done by you before deploy, or do you want me to ship with them as-is and fix what you report?
