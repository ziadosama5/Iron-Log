# Exercise info ("!") — design

Date: 2026-10-17
Status: approved in chat, awaiting spec review
Sub-project 2 of 5 in the "improve Iron Log" effort. Ships together with the day-focus fix already on branch `fix-day-focus` (commit ae929d0).

## Goal

Tapping a "!" next to an exercise shows what the move looks like (start and finish drawings), which muscles it works, and a few form tips, so people can check an unfamiliar exercise without leaving the app.

**Success criteria**
- Every exercise in the built-in library (`LIB`, 60 names) has muscles and 2–4 form tips; about 50 also have start/finish drawings.
- The panel opens from the Workout tab (collapsed rows and open card), the Days tab editor, and the "Add an exercise" suggestion chips.
- Drawings use the app's colors in light and dark mode, and work offline after they have been viewed once.
- No photos of real people.

**Constraints (unchanged)**
- No build step and no runtime dependencies. Free Spark plan. Mobile-first, max-width 640px, safe-area insets, no horizontal scroll.
- The import script is a dev tool run by hand on a computer (Node 24, no npm packages). The app never fetches from Everkinetic.

## Image source

**Everkinetic** (github.com/everkinetic/data): line drawings, two poses per exercise (`dist/svg/NNNN-relaxation.svg` = start, `NNNN-tension.svg` = finish). SVGs use only two fills: `#333` (lines) and `#FFF` (body/background). License **CC BY-SA 4.0**: we must credit it and our recolored copies are shared under the same license.

- Credit line in the panel: `Illustrations: Everkinetic, CC BY-SA 4.0`. Same line plus a link in README.md.
- `public/exercises/LICENSE.md` states the drawings are adapted (recolored, minified) from Everkinetic under CC BY-SA 4.0.
- The free-exercise-db photos were rejected (real models).

**Coverage:** about 50 of the 60 library exercises have a good Everkinetic drawing. These have **no drawing** and show tips + muscles only: Face Pull, Hip Thrust, Hanging Leg Raise, Plank, Russian Twist, Arnold Press, One-arm Dumbbell Row, Bulgarian Split Squat. Where Everkinetic only has an approximate match, prefer no drawing over a misleading one. The exact name → id table is decided in the implementation plan and reviewed there.

## Architecture

| file | role |
|---|---|
| `tools/exercise-sources.json` | hand-written source of truth: per library exercise `{ek: "0042" or null, primary:[...], secondary:[...], tips:[...]}` |
| `tools/import-exercises.mjs` | dev script: reads the sources, downloads each Everkinetic SVG pair, recolors + minifies, writes `public/exercises/<slug>-start.svg` / `-end.svg` and generates `public/exercise-info.js` |
| `tools/svg-tools.mjs` | pure functions used by the script (`recolorSvg`, `slugify`), unit-tested |
| `public/exercise-info.js` | generated ES module: `export const INFO = {"bench press": {name, slug, img:true/false, primary, secondary, tips}, ...}` keyed by lowercase name, plus `infoFor(name)` |
| `public/exercises/*.svg` | about 100 recolored drawings (~25 KB each, ~2.5 MB total) |
| `public/index.html` | "!" buttons, the panel, SVG loading |
| `public/sw.js` | caches `exercise-info.js` with the app shell; caches `/exercises/*.svg` on first view; VERSION bump |

`infoFor(name)` matches case-insensitively (same rule as the app's `same()`), returning `null` for unknown names.

**Muscle names** in `primary`/`secondary` use the app's existing groups (`MUSCLES` from `exercise-library.js`: Chest, Back, Shoulders, Biceps, Triceps, Quads, Hamstrings & Glutes, Calves, Core). An exercise's first primary group must equal `muscleOf(name)`, so the panel never disagrees with the Days tab.

**Tips:** 2–4 per exercise, each under ~60 characters, plain imperative style matching the app copy ("Brace before you unrack", "Knees track over toes").

## Recoloring

`recolorSvg(text)`:
- `fill="#333"` (and `#333333`, any case) → `fill="currentColor"`
- `fill="#FFF"` (and `#FFFFFF`, `white`, any case) → `fill="var(--ex-bg)"`
- Removes the root `width`/`height` attributes (keeps `viewBox`) so CSS sizes it; strips XML prolog, comments and editor metadata; collapses whitespace.
- Throws if the input contains any other fill color, so a surprising source file is caught at import time rather than shipped.

In the panel, the drawing container sets `color: var(--fg)` and `--ex-bg: var(--surface)`, so lines are dark-on-white in light mode and light-on-dark in dark mode.

## UI

**"!" button:** a small round outlined "!" (visual ~22px, tap area ≥44px via padding), `data-act="ex-info" data-name="<exercise>"`, `aria-label="About <exercise>"`. Shown only when `infoFor(name)` is non-null.
- *Workout collapsed rows:* today each row is one `<button class="exrow">`. Wrap it in a container so the "!" is a sibling button (no nested buttons); tapping the row still opens the exercise.
- *Workout open card:* next to the exercise name in the header.
- *Days tab editor:* next to each exercise in a day's list.
- *Suggestion chips:* a compact "!" attached to the end of each chip, as a separate button; tapping the chip itself still adds the exercise.

**Panel:** a native `<dialog>` styled as a bottom sheet (max-width 640px, rounded top corners, bottom padding includes `env(safe-area-inset-bottom)`), opened with `showModal()`.
- Closes with ✕, a tap on the backdrop, or Esc. On Android, the back gesture closes it: opening pushes a history entry, and `popstate` closes the dialog.
- Content: exercise name (display font); **Start** and **Finish** drawings side by side in two equal columns, each in a square-ish box; "Works:" primary groups in bold, then secondary in muted text; tips as a short list; credit line in small muted text.
- No drawing: drawings row omitted. Unknown exercise: no "!" is shown at all.
- Drawings are loaded with `fetch()` and inserted as inline SVG so CSS colors apply. While loading, the boxes show the surface color; if a fetch fails (offline and never viewed), the box shows "Drawing not available offline yet" and the rest of the panel still works.

## Offline

`exercise-info.js` is in `APP_SHELL`. SVGs are not precached (keeps install light): the service worker's fetch handler stores any `/exercises/*.svg` response in the versioned cache on first successful load and serves from cache afterwards (cache-first for that path).

## Testing

- **Unit (`npm test`):**
  - `recolorSvg`: maps both colors (all spellings), drops width/height and keeps viewBox, throws on an unexpected fill.
  - `slugify("Close-grip Bench Press") === "close-grip-bench-press"`; slugs are unique across the library.
  - Data checks on the generated `exercise-info.js`: every `LIB` exercise has an entry; 2–4 tips each; non-empty `primary`; all groups are valid `MUSCLES`; first primary equals `muscleOf(name)`; every entry with `img:true` has both SVG files on disk; no SVG file on disk is unreferenced.
  - `infoFor` is case-insensitive and returns null for unknown names.
- **Manual (phone):** "!" in all three places opens the right exercise; tapping the row/chip still does its normal action; panel closes by ✕, backdrop and back gesture; drawings readable in light and dark; an exercise without a drawing shows tips only; airplane mode after viewing a drawing still shows it; the day-focus fix shows arm suggestions on Upper days.
- **Release:** sw VERSION `iron-log-v7` (v6 was used by the unreleased day-focus commit; the combined release ships as v7). Update CLAUDE.md and README credit.
