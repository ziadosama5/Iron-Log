# Workout screen 2.0 and the two looks: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put an animated exercise demo (thumbnail + full-screen viewer), pre-filled tickable set rows and a "why this weight" line on the Today workout card, add the Carbon and Bloom looks (Classic stays the default) with a first-launch picker and an offline "Download exercise pictures" button, without changing any stored data.

**Architecture:** Pure logic goes in small tested modules (`looks.js`, `exercise-gifs.js`, additions to `progression.js`); UI stays in `index.html` following the existing delegated-`data-act` pattern; looks are CSS-token sets in a new `looks.css` switched by `<html data-look>` (set by a `<head>` script from `localStorage ironlog.look`, like theme and accent). Demo GIFs load from a commit-pinned jsDelivr URL through one constant, cached by the service worker.

**Tech Stack:** Plain ES modules, no build step, Node built-in test runner (`npm test`), Playwright UI tests in `tests-ui` against the stubbed-Firebase harness.

**Spec:** `docs/superpowers/specs/2026-10-31-workout-screen-2-design.md` (roadmap: `...-standalone-health-data-roadmap.md`). Design boards: https://claude.ai/artifact/35ekGA7CkuEcnEQAtKJbDL.

**Deviation from the spec (fixed in Task 2):** the "why" is a new pure function `whyFor(...)`, not an extra field on `suggestNext`, so the existing `suggestNext` tests (which `deepEqual` its result) stay untouched.

## Global Constraints
- Branch `workout-screen-2`. **Never deploy or run `firebase deploy`**; the live app stays as it is until the owner says the build is bug-free.
- No new Firestore field, no `firestore.rules` change, no change to backup/`wipePlan`. Look, demo size and hints are per-device `localStorage` keys: `ironlog.look` (`classic`|`carbon`|`bloom`, anything else = `classic`), `ironlog.demo` (`mini` default | `full`), `ironlog.lookHint`. Every localStorage access in try/catch.
- Every visible string has an Arabic entry in `public/lang-ar.js` (`npm test` fails otherwise); use `t()`/`tn()` for text with values, never glue strings.
- Targets ≥ 44 px, no text under 12 px, no hardcoded blue (use `var(--accent)`), logical CSS properties (RTL).
- Every new `public/*.js` / `public/*.css` goes into `APP_SHELL` in `public/sw.js`; bump `VERSION` once (Task 9) to `iron-log-v48`.
- Counting rules stay: normal sets = working sets; warm-ups and drop sets never use up a planned row.
- Files are CRLF in git; use the Edit/Write tools, never backslashes in shell heredocs.
- Every commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Demo GIF base: `https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/` (`videos/<id>.gif`, `images/<id>.jpg`).

## Review Focus
1. **Custom or unmapped exercise** (no GIF, no drawings): no demo box, no empty gap, sets still log. (Task 4)
2. **More sets logged than the target** (e.g. 5 logged, target 3) or a warm-up first: zero planned rows, "Add set N" present, nothing negative. (Tasks 2, 5)
3. **GIF fails or first view offline:** drawings crossfade, no broken-image icon, the GIF replaces them when it loads. (Task 4)
4. **Corrupt or unreadable `ironlog.look` / `ironlog.demo`, or localStorage throwing:** Classic and mini, no exception, page draws. (Tasks 1, 6)
5. **Editing a set while planned rows exist, a deload week, and Arabic/RTL:** the tick becomes "Save set N", planned count follows the deload set count, thumbnail and rows mirror. (Tasks 5, 4)

---

### Task 1: `looks.js` (pure look model)

**Files:**
- Create: `public/looks.js`, `tests/looks.test.js`

**Interfaces:**
- Consumes: `PRESETS`, `deriveAccent`, `contrast`, `parseHex` from `public/theme-tools.js`.
- Produces: `LOOKS = ["classic","carbon","bloom"]`; `cleanLook(v): string` (valid id or `"classic"`); `suggestLook(sex): "carbon"|"bloom"|null` (`"male"`→carbon, `"female"`→bloom, else null); `accentPresetsFor(look): {id,name,hex}[]` (classic = `PRESETS`; carbon = ember `#ff7a2f` (default), amber `#ffc61a`, mint `#3ddc97`, blue `#4da3ff`, red `#ff5c7a`, violet `#b79bff`; bloom = rose `#c2255c` (default), violet `#7c3aed`, teal `#0f8b8d`, coral `#d9480f`, gold `#b8860b`, blue `#2563eb`); `defaultAccentFor(look): string` (`"plate"` for classic, else the first preset's hex); `LOOK_ENV: {[look]: {light:{surface,bg}, dark:{surface,bg}}}` and `envFor(look)` (classic = `{light:{surface:"#ffffff",bg:"#f3f5f9"},dark:{surface:"#171d26",bg:"#0f1319"}}`; carbon light `#ffffff`/`#f4f1ee`, dark `#181a1f`/`#101114`; bloom light `#ffffff`/`#fff4f6`, dark `#2a1c3a`/`#17102a`).

- [ ] **Step 1: Write failing tests** in `tests/looks.test.js`: `cleanLook` maps `"carbon"`/`"bloom"`/`"classic"` to themselves and `undefined`, `""`, `"Carbon "`, `{}`, `"__proto__"` to `"classic"`; `suggestLook("male")==="carbon"`, `("female")==="bloom"`, `(undefined)`, `("other")`, `("")` are `null`; `accentPresetsFor("carbon")` and `("bloom")` have 6 entries, unique ids, valid `parseHex`; `defaultAccentFor` values (`"plate"`, `"#ff7a2f"`, `"#c2255c"`); **contrast**: for every look × `light`/`dark` × every preset, `deriveAccent(hex, mode, env.surface, env.bg)` gives `accent` ≥ 4.5 vs `surface` and `ink` ≥ 4.5 vs `accent` (using `contrast`).
- [ ] **Step 2: Run** `node --test tests/looks.test.js` → FAIL (module missing).
- [ ] **Step 3: Implement** `public/looks.js` per the Interfaces block (own-key lookups so `"__proto__"` is safe). If a preset fails the contrast test, `deriveAccent` already moves lightness; adjust only the env hex values, not the test.
- [ ] **Step 4: Run** `node --test tests/looks.test.js` → PASS; `npm test` still passes except nothing new missing.
- [ ] **Step 5: Commit** `feat: looks model (classic, carbon, bloom) with accent presets and contrast tests`.

### Task 2: `progression.js` additions (`plannedRows`, `whyFor`)

**Files:**
- Modify: `public/progression.js`, `tests/progression.test.js`, the spec line about `why` (change "gains an extra field `why`" to "gets the pure function `whyFor`")

**Interfaces:**
- Consumes: `workingSets`, `validTarget`, existing `suggestNext` result shape `{kind:"increase"|"hold", w, r, low?, bw?, unit?}`.
- Produces: `plannedRows(target, sets, deloadSets?): number` = `max(0, (deloadSets ?? target.sets) − workingSets(sets).length)`, 0 for an invalid target; `whyFor({last, target, sug, bw, hold, deload}): null | {code, n?, r?, min?}` with codes `"top"` (increase: `n` = sets at top, `r` = target.max), `"more"` (hold: `r` = lowest working reps at the top weight), `"low"` (hold with `low`: `min` = target.min), `"hold-sec"` (hold exercise: `r` = seconds), `"bw-top"` (bodyweight increase), `"deload"`; null when `sug` is null.

- [ ] **Step 1: Write failing tests** (append to `tests/progression.test.js`): `plannedRows({sets:3,min:8,max:12}, [], undefined)===3`; with 1 normal set → 2; with 3 → 0; with 5 → 0; warm-up (`k:"w"`) and drop (`k:"d"`) sets do not reduce it; `deloadSets` 2 with 0 sets → 2; invalid target (`null`) → 0. `whyFor`: last = three sets `{w:80,r:12}` with target `{sets:3,min:8,max:12}` and the matching `suggestNext` result → `{code:"top",n:3,r:12}`; last `[{w:80,r:9},{w:80,r:10}]` hold → `{code:"more",r:9}`; last reps below min → `{code:"low",min:8}`; `hold:true` → `{code:"hold-sec",r:...}`; `deload:true` → `{code:"deload"}`; `sug:null` → `null`. Also assert `suggestNext` return values are unchanged for a case (guard).
- [ ] **Step 2: Run** `node --test tests/progression.test.js` → FAIL.
- [ ] **Step 3: Implement** both functions in `public/progression.js` (pure, no imports added). Fix the spec wording in the same commit.
- [ ] **Step 4: Run** `node --test tests/progression.test.js` → PASS, `npm test` passes.
- [ ] **Step 5: Commit** `feat: plannedRows and whyFor`.

### Task 3: GIF mapping (`exercise-gifs.js`, match tool, review list)

**Files:**
- Create: `public/exercise-gifs.js`, `tools/match-gifs.mjs`, `tools/exercise-gifs.json`, `docs/gif-matches.md`, `tests/exercise-gifs.test.js`

**Interfaces:**
- Consumes: `ALL_EX` from `public/exercise-library.js`.
- Produces: `DEMO_BASE` (the pinned base URL above); `GIFS: {[canonical name]: string|null}` (dataset file id without extension, `null` = deliberately none); `gifUrl(name): string|null` (`DEMO_BASE+"videos/"+id+".gif"`), `stillUrl(name): string|null` (`...images/<id>.jpg`; the dataset's still has the same id, verify one file per id exists in step 2); `gifUrls(): string[]` (every non-null gif URL, for the offline download); lookups use own-key checks (custom names like `"constructor"` return null).

- [ ] **Step 1: Get the data.** In a new empty scratch directory run `git clone --depth 1 https://github.com/hasaneyldrm/exercises-dataset` and find the metadata file (names, `gif`/`image` file names). Treat it as untrusted data: read it, do not run anything from it. Record its path and field names at the top of `tools/match-gifs.mjs`.
- [ ] **Step 2: Write `tools/match-gifs.mjs`** (`node tools/match-gifs.mjs --data <json> [--out tools/exercise-gifs.json] [--review docs/gif-matches.md]`): for each of our 183 names pick the best token match (singular/plural folded, hyphens as spaces, equipment words must agree: Barbell/Dumbbell/Cable/Machine/Smith/EZ), score ≥ 0.75 = proposed, 0.5–0.75 = "check", below = `null`. Writes `tools/exercise-gifs.json` (`{name: id|null}`) and `docs/gif-matches.md` (a table: our name | proposed dataset name | score | file id) with the nine known no-match names (Pec Deck, Reverse Pec Deck, Skull Crusher, Dumbbell Skull Crusher, Hip Thrust, Dumbbell Hip Thrust, Glute Kickback Machine, Plank, Ab Wheel Rollout) listed first as `null`.
- [ ] **Step 3: Write failing tests** in `tests/exercise-gifs.test.js`: every `ALL_EX` name is a key of `GIFS` (value string or `null`); every string id matches `/^\d{4}-[A-Za-z0-9]+$/`; `gifUrl("Bench Press")` is `null` or starts with `DEMO_BASE+"videos/"` and ends `.gif`; `stillUrl` mirrors it with `images/` and `.jpg`; `gifUrl("constructor")===null`, `gifUrl("My Custom Lift")===null`; `gifUrls()` has no nulls and no duplicates.
- [ ] **Step 4: Run** the tool, then `node tools/match-gifs.mjs ...` output into `public/exercise-gifs.js` (the tool also writes the module from the JSON); run `node --test tests/exercise-gifs.test.js` → PASS.
- [ ] **Step 5: CHECKPOINT for the owner:** hand `docs/gif-matches.md` to the owner for review; apply their corrections to `tools/exercise-gifs.json` and regenerate. Unmatched or rejected entries stay `null` (the drawings remain).
- [ ] **Step 6: Commit** `feat: exercise GIF mapping and review list`.

### Task 4: Demo thumbnail on the card (+ shared figures helper)

**Files:**
- Modify: `public/index.html` (`focusCard`, `openExInfo`, CSS, imports), `public/lang-ar.js`, `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: `gifUrl`, `stillUrl` (Task 3); `infoFor(name)`; `equipmentOf(name)`; `nameOf`.
- Produces: in `index.html`: `exerciseFigures(name): string` (the Start/Finish figure markup now inside `openExInfo`, extracted so the card fallback and the sheet share it); `demoThumbHtml(name): string` (`""` when the exercise has neither GIF nor drawings); `demoPref(): "mini"|"full"` (reads `ironlog.demo`, default `"mini"`); `data-act="demo-full"` and `data-act="demo-load-fail"` hooks used by Task 5.

- [ ] **Step 1: Write failing UI tests** (tests-ui, route `https://cdn.jsdelivr.net/**` to a 1×1 GIF with `access-control-allow-origin: *`): the open card has `.demo img[src*="/videos/"]` and it is ≤ 112 px wide; the name, muscle chips and equipment chip sit beside it; a custom exercise typed via + Exercise has no `.demo` element and the card top is not blank; with the GIF route aborted the thumbnail shows two `.ex-fig` drawings (class `.demo-fallback`) and no `img` with a broken `naturalWidth===0` stays visible; with `localStorage ironlog.demo="garbage"` or localStorage throwing (init script) the card still renders as mini.
- [ ] **Step 2: Run** the new tests → FAIL.
- [ ] **Step 3: Implement.** `demoThumbHtml` renders `<div class="demo" data-name>` with the GIF `<img crossorigin="anonymous" decoding="async" alt="{name}">` (`onerror` hook swaps to `.demo-fallback`: both drawings stacked, opacity crossfade about 2.4 s per loop, `@media (prefers-reduced-motion: reduce)` shows only the start drawing) and a 44 px `⤢` button `data-act="demo-full"` (`aria-label` "Full screen"). Place it at the inline-start of the name row in `focusCard`; the tags row (primary muscles from `infoFor`, equipment via `eqLabel`/`equipmentOf`) goes under the name, "Best" stays. `demoPref()==="full"` renders the large inline box (white tile, `max-height:min(180px,26vh)`, `object-fit:contain`) instead of the thumbnail. Add the three new visible strings (Full screen, tags use existing labels) to `lang-ar.js`.
- [ ] **Step 4: Run** `node --test tests/*.test.js` (lang coverage) and `cd tests-ui && npm test -- --test-name-pattern demo` → PASS; the existing focus-card tests still pass.
- [ ] **Step 5: Commit** `feat: exercise demo thumbnail on the workout card`.

### Task 5: Full-screen viewer and the "large demo" switch

**Files:**
- Modify: `public/index.html` (new `<dialog id="demoview" class="sheet">`, handlers, Me › Appearance card), `public/lang-ar.js`, `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: `demoThumbHtml`, `demoPref` (Task 4), the `#exinfo` open/close/history pattern (`openExInfo`, `closeExInfo`, popstate handler).
- Produces: `openDemoView(name)`, `closeDemoView()`; actions `demo-full` (open), `demo-pause` (toggle GIF/still, `aria-pressed`), `demo-view-close`; Appearance switch action `demo-size-set` (`data-v="mini|full"`) calling `setDemoPref(v)` which writes `ironlog.demo` in try/catch and redraws.

- [ ] **Step 1: Write failing UI tests:** tapping `⤢` opens `#demoview` with the GIF at ≥ 90% of the viewport width; pause swaps to the `jpg` still and `aria-pressed="true"`; ✕ closes; the Back gesture (`page.goBack()`) closes it and stays on Today; Me › Appearance "Large demo on the card" switch → card shows the large box, persists after `page.reload()`; with `lang=ar` the viewer and the switch render RTL without overflow.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** following the `#exinfo` pattern exactly (push a history entry, close event removes it, backdrop click closes). Reduced motion: viewer opens on the still, play button starts the GIF. The Appearance switch is two chips (`aria-pressed`) in the existing Appearance card.
- [ ] **Step 4: Run** the demo tests and `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: full-screen demo viewer and large-demo switch`.

### Task 6: Planned set rows and the "why" line

**Files:**
- Modify: `public/index.html` (`focusCard`, `adviceText` neighbourhood, CSS), `public/lang-ar.js`, `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: `plannedRows`, `whyFor` (Task 2); existing `add-set`/`save-set`/`edit-set` handlers (`readSet(ei)`), `prefillFor` draft `ui[e.ex]`, `deloadAdvice`.
- Produces: `whyText(why): string` (t()/tn() sentences: top "All {n} sets reached {r} reps last time, the top of your range."; more "Last time your lowest set was {r} reps. One more rep each set."; low "Last time was under {min} reps. Build up to {min} first."; hold-sec "Last time you held {r} seconds. Aim for a little longer."; bw-top "You reached the top of your range last time. Add a little extra weight."; deload "Easy week: about 90% of your last weight for about 60% of the sets."); `setRowsHtml(w, ei, ctx): string` replacing the table. Planned-row tick uses `data-act="add-set"` so logging is exactly today's path.

- [ ] **Step 1: Write failing UI tests** (harness default data, an exercise with target 3): card shows 3 rows (set 1 active with steppers' values), only set 1's tick is enabled (others `aria-disabled="true"`); tapping the tick logs one set with the steppers' values, starts `#restbar`, row 1 becomes logged with a ✓ and row 2 becomes the live one; after 3 sets there is no planned row and the "Add set 4" button appears and works; **review-focus cases:** a warm-up logged first does not reduce the planned count; 5 logged sets with target 3 show no planned rows and "Add set 6"; tapping a logged row loads it and the live control reads "Save set N"; deload week (`deloadwk=1`) shows the deload set count; hold exercise shows seconds; bodyweight (`bw=1`) shows BW/+10/−20; `lang=ar` mirrors rows; the "why" line text appears under the advice for an exercise with history (`stalled=1`/default last session) and never for a first-time exercise.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Logged rows keep today's table fields (set no. + type tag, weight, reps, e1RM + PR badge, ✕ `rm-set`, tap row = `edit-set`); planned rows show the prefilled draft values dimmed with a hollow 44 px tick; the big steppers stay above the list. The old "Add set N" primary button renders only when `plannedRows===0`; when all planned rows are done the `✓ Done` button gets the highlighted style (`class` change only, no auto-done). Add `whyText` sentences to `lang-ar.js`.
- [ ] **Step 4: Run** the new tests, the whole `tests-ui` suite and `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: planned set rows with a tick and the why line`.

### Task 7: Looks plumbing (head script, `looks.css` tokens, accent per look, Appearance tiles)

**Files:**
- Create: `public/looks.css`
- Modify: `public/index.html` (head: Google Fonts link adds Oswald, Manrope, DM Sans, Fraunces; `<link rel="stylesheet" href="/looks.css">`; early `<script>` setting `document.documentElement.dataset.look`; `applyLook`, `currentLook`, `ACCENT_ENV` → `envFor(currentLook())`; Appearance card tiles), `public/lang-ar.js`, `tests/accent-css.test.js` if it asserts the head scripts, `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: `LOOKS`, `cleanLook`, `accentPresetsFor`, `defaultAccentFor`, `envFor` (Task 1); `applyAccent`, `drawSwatches`, `applyTheme`.
- Produces: `currentLook(): string` (reads `ironlog.look` through `cleanLook`, try/catch); `applyLook(look, {resetAccent})` (writes `ironlog.look`, sets `data-look` (removed for classic), when `resetAccent` applies `defaultAccentFor(look)` via `applyAccent`, redraws swatches from `accentPresetsFor(look)`); action `look-set` (`data-v`); `looks.css` rules scoped `:root[data-look="carbon"]` / `[data-look="bloom"]` that override the existing tokens (`--bg --surface --sunk --line --fg --muted --shadow --card-border --r-card --r-btn --hero --bar --bar-ink --bar-on --pop --bg-grad --f-display --f-body`) for light and dark (mirror the three-block structure of `:root` in `index.html` lines 22–48: light, `prefers-color-scheme:dark` with `:not([data-theme="light"])`, `[data-theme="dark"]`). Arabic keeps `--f-display/--f-body` from the existing `:root[lang="ar"]` rule (it must win: put it after).

- [ ] **Step 1: Write failing UI tests:** with no saved look the computed `--accent`/`--bg`/`--r-card` equal today's values (Classic is byte-for-byte; compare against a run with the stylesheet removed); with `ironlog.look="carbon"` set by init script, `<html data-look="carbon">` is present before first paint and `--r-card` differs; `"bloom"` likewise; `"CARBON"`/`"x"`/throwing localStorage → no `data-look`; Me › Appearance shows three tiles (Classic, Carbon, Bloom), tapping Carbon applies it at once, sets accent `#ff7a2f` and swatches show the carbon presets; survives reload; switching back to Classic restores plate blue; light and dark both render for each look (screenshot, no horizontal scroll at 360 px, targets ≥ 44 px, text ≥ 12 px) in English and Arabic.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `looks.css` tokens from the design boards (`Carbon.dc.html`, `Bloom.dc.html`: carbon = charcoal `#101114`/`#181a1f`, text `#f4f1ee`, display Oswald uppercase, body Manrope, angled cut corners via `clip-path` on `.demo`, `.chip`, `.bigstep button`, `.btn.primary`; bloom = blush `#fff4f6`, plum text `#3a1d2e`, Fraunces display, DM Sans body, `--r-card:24px`, `--r-btn:22px`, white floating `.tabbar`), the head script (same try/catch style as the theme script), and the tile UI. Per-look overrides for `.tabbar`, `.hero`, `.card`, `.chip`, `.btn.primary`, `#restbar`, `.card.focus`, set rows go in `looks.css`. `--good`, `--danger` and reward colours are never overridden.
- [ ] **Step 4: Run** `npm test`, the new UI tests and the whole `tests-ui` suite (the Classic suite must pass unchanged) → PASS.
- [ ] **Step 5: Commit** `feat: Carbon and Bloom looks with per-look accents`.

### Task 8: First-launch picker and the "New looks" card

**Files:**
- Modify: `public/index.html` (picker view/sheet, `maybeStartJourney` ordering, Today card), `public/lang-ar.js`, `public/looks.js` only if a helper is missing, `tools/screenshot-harness/stubs/fb.js` only if a query param is needed (`fresh=2` already gives no days, no workouts, no profile), `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: `suggestLook`, `applyLook` (Tasks 1, 7), `shouldAutoJourney` conditions in `maybeStartJourney`, `store.saveProfile(mergeProfile(...))`, `needsAbout`.
- Produces: `shouldPickLook({authed, synced, days, workouts, savedLook, shown}): boolean` (pure, in `looks.js`, tested): true only when signed in, server-synced, no days, no workouts and no saved look; `openLookPicker()`; actions `lp-sex` (`male|female|skip`), `lp-choose` (`classic|carbon|bloom`), `lp-skip`; `lookHintHtml(): string` for the Today card (`ironlog.lookHint="1"` after dismiss via `look-hint-close`, opens the Appearance tiles via `look-hint-open`).

- [ ] **Step 1: Write failing tests.** Unit (`tests/looks.test.js`): `shouldPickLook` truth table (each missing condition → false; all met → true; `savedLook:"carbon"` → false). UI (`fresh=2`): the picker appears before the journey; asks "I am… Male / Female / Prefer not to say" only when the profile has no sex; "Male" preselects and labels **Suggested** the Carbon preview, "Female" Bloom, "Prefer not to say" preselects neither; two live previews render with each look's tokens; **Choose** applies look + default accent, saves `sex` through the existing profile save (assert the write log shows the `profile` doc and no other new field), then the journey opens and does not ask for sex again; "Keep the classic look" and Back keep Classic and still continue to the journey; reload before choosing shows the picker again; a user with data (`fresh` absent) sees no picker but sees the one "New looks" card on Today, dismissing it is remembered across reload; with `lang=ar` all of it is RTL.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** The picker runs from `maybeStartJourney` just before `openJourney(true)`; the journey starts after Choose/Skip. Previews are small `div`s carrying `data-look="…"` on the container with their own scoped tokens (the CSS in `looks.css` must be selectable on a descendant, e.g. `[data-look="carbon"]` as well as `:root[data-look="carbon"]`, so a preview shows the real look). The sex question never labels a look as gendered.
- [ ] **Step 4: Run** `npm test` and the UI suite → PASS.
- [ ] **Step 5: Commit** `feat: first-launch look picker and New looks card`.

### Task 9: Offline (service worker, warm-up, Download exercise pictures)

**Files:**
- Modify: `public/sw.js` (VERSION `iron-log-v48`, `APP_SHELL` += `/looks.js`, `/looks.css`, `/exercise-gifs.js`, caches), `public/index.html` (warm-up call, Appearance "Download exercise pictures" row), `public/lang-ar.js`, `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: `gifUrls()`, `gifUrl(name)` (Task 3).
- Produces: in the service worker: cache `ironlog-demo` (cache-first for URLs starting `DEMO_BASE`, keeps at most 80 entries, oldest dropped) and `ironlog-demo-all` (never trimmed, checked first); message API `postMessage({type:"demo-download", urls})` → posts back `{type:"demo-progress", done, total}` / `{type:"demo-done"}`, `{type:"demo-clear"}` clears `ironlog-demo-all`; both demo caches are kept across version bumps (the activate step deletes only older `iron-log-v*` caches). In `index.html`: `warmDemos(names)` (fetch the open day's GIFs once per day with `crossorigin`), `downloadPictures()`, `clearPictures()`.

- [ ] **Step 1: Write failing tests.** UI: opening a workout day triggers requests for that day's GIFs once (route counter); a second open of the card makes no network request for a cached GIF (served from `ironlog-demo`); the "Download exercise pictures" row shows a progress line and ends with "Downloaded"; after download, with the route set offline (`ctx.setOffline(true)`) every mapped exercise's GIF still loads; "Remove downloads" clears it; the download button is disabled with a message when `navigator.onLine` is false. Unit: `sw.js` text contains the three new shell files and `iron-log-v48` (extend the existing sw test if present, else a small `tests/sw.test.js`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** in `sw.js` (add a branch before the existing `url.origin` checks: `url.href.startsWith(DEMO_BASE)` → check `ironlog-demo-all`, then `ironlog-demo` then network; trim after put) and the page code. Downloads run 4 at a time, skip files already cached, are resumable (re-running skips cached ones), and show "{done} of {total}" through `t()`.
- [ ] **Step 4: Run** `npm test`, UI suite → PASS.
- [ ] **Step 5: Commit** `feat: offline exercise pictures (cache, warm-up, download button)`.

### Task 10: Credits, privacy sentence, docs

**Files:**
- Modify: `public/privacy.html` (English + Arabic blocks), `tests/pages.test.js`, `public/index.html` (credit line in the "!" sheet), `docs/README.md`, `CLAUDE.md`, `docs/open-points.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: the statement "the exercise pictures are loaded from a public CDN (jsDelivr), which sees the phone's IP address like any website would; no account data is sent" in both language blocks; credit line "Animations: hasaneyldrm/exercises-dataset" in the info sheet.

- [ ] **Step 1: Write failing test** in `tests/pages.test.js`: both `data-l="en"` and `data-l="ar"` blocks of `privacy.html` mention `jsDelivr`; the block shapes (h2 counts) still match.
- [ ] **Step 2: Run** `node --test tests/pages.test.js` → FAIL.
- [ ] **Step 3: Write** the two sentences (Arabic in simple MSA, Latin "jsDelivr"), the credit line, the CLAUDE.md "Files" and feature entries (looks, demo, planned rows, offline downloads, new localStorage keys), `docs/README.md` index row, `docs/open-points.md` (note: old versions ignore the look; per-device look; sw v48).
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `docs: privacy sentence, credits and project docs for workout screen 2.0`.

### Task 11: Whole-branch verification (no deploy)

**Files:**
- Modify: nothing planned; fixes only

- [ ] **Step 1:** Run `npm test` and `cd tests-ui && npm test` (Edge, about 2.5 min, one copy at a time); every test passes and the pre-existing tests were not edited.
- [ ] **Step 2:** `grep -c $'\x08' public/index.html public/looks.js public/looks.css public/exercise-gifs.js public/sw.js` returns 0 for each (stray control characters).
- [ ] **Step 3:** With the harness (`node tools/screenshot-harness/run.cjs public tools/screenshot-harness 5071`) take screenshots of Today, a workout card, the viewer, Appearance and the picker in Classic, Carbon, Bloom × light/dark × English/Arabic at 360 px; confirm Classic matches the pre-branch screenshots.
- [ ] **Step 4:** Report to the owner: what was built, the test counts, the screenshots, the deferred minors; ask whether to start the final Opus review. **Do not deploy and do not merge**; the owner tests locally with `firebase serve --only hosting --port 5000` and says when the build is bug-free.
