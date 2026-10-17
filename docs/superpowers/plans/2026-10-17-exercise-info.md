# Exercise Info ("!") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "!" button next to exercises opens a bottom sheet with Everkinetic start/finish line drawings (recolored to the app theme), muscles worked and 2–4 form tips.

**Architecture:** A hand-written `tools/exercise-sources.json` is the source of truth. A dev-only Node script downloads and recolors the Everkinetic SVGs into `public/exercises/` and generates `public/exercise-info.js`. `index.html` imports `infoFor()` from it, renders "!" buttons and a `<dialog>` sheet that inlines the SVGs so CSS colors apply.

**Tech Stack:** Plain JS ES modules, no build step; Node 24 (`node --test`, global `fetch`) for the dev script and tests; Everkinetic SVGs (CC BY-SA 4.0).

**Spec:** `docs/superpowers/specs/2026-10-17-exercise-info-design.md`

Work continues on branch `fix-day-focus` (already holds the day-focus fix, commit ae929d0, sw v6 unreleased). Release is v7.

## Global Constraints

- No build step, no runtime dependencies, no npm packages (dev script uses only Node built-ins).
- The app never requests anything from Everkinetic/GitHub; only `public/` files are served.
- Credit text exactly: `Illustrations: Everkinetic, CC BY-SA 4.0`.
- Muscle names only from `MUSCLES` (`public/exercise-library.js`); an entry's `primary[0]` equals `muscleOf(name)`.
- Tips: 2–4 per exercise, each ≤ 60 characters, plain imperative, no trailing period.
- Mobile-first, max-width 640px, safe-area insets, no horizontal scroll at 400px; colors only via CSS tokens; light and dark.
- "!" tap target ≥ 44×44 px; no `<button>` nested inside another `<button>`.
- `public/sw.js` `VERSION = "iron-log-v7"` at release.

## Exercise → Everkinetic table (decided; reviewed with the user)

`null` = no drawing (tips + muscles only).

| Exercise | ek | Exercise | ek | Exercise | ek |
|---|---|---|---|---|---|
| Bench Press | 0042 | Arnold Press | null | Close-grip Bench Press | 0049 |
| Incline Barbell Press | 0043 | Lateral Raise | 0018 | Dip | 0172 |
| Incline Dumbbell Press | 0080 | Cable Lateral Raise | null | Squat | 0122 |
| Dumbbell Bench Press | 0055 | Rear Delt Fly | 0032 | Front Squat | 0138 |
| Machine Chest Press | 0066 | Face Pull | null | Leg Press | 0127 |
| Dumbbell Fly | 0056 | Upright Row | 0014 | Hack Squat | 0123 |
| Cable Crossover | 0048 | Barbell Curl | 0211 | Bulgarian Split Squat | null |
| Push-up | 0077 | Dumbbell Curl | 0224 | Walking Lunge | 0121 |
| Pull-up | 0087 | Hammer Curl | 0227 | Leg Extension | 0142 |
| Lat Pulldown | 0093 | Preacher Curl | 0239 | Romanian Deadlift | 0118 |
| Barbell Row | 0026 | Incline Dumbbell Curl | 0214 | Lying Leg Curl | 0117 |
| One-arm Dumbbell Row | null | Cable Curl | 0212 | Seated Leg Curl | 0119 |
| Seated Cable Row | 0025 | Tricep Pushdown | 0205 | Hip Thrust | null |
| T-bar Row | 0029 | Skull Crusher | 0183 | Good Morning | 0101 |
| Chin-up | null | Overhead Tricep Extension | 0201 | Glute Bridge | 0109 |
| Deadlift | 0099 | Standing Calf Raise | 0282 | Plank | null |
| Overhead Press | 0004 | Seated Calf Raise | 0279 | Hanging Leg Raise | null |
| Dumbbell Shoulder Press | null | Cable Crunch | 0288 | Ab Wheel Rollout | 0285 |
| | | | | Russian Twist | null |

44 with drawings, 11 without. Everkinetic files: `https://raw.githubusercontent.com/everkinetic/data/main/dist/svg/<ek>-relaxation.svg` (= start) and `<ek>-tension.svg` (= finish).

## Review Focus

1. **Tapping "!" for A, then quickly for B** → B's panel never shows A's drawings (late fetch for A is ignored). *(Task 3 step 4 token check; manual 3d)*
2. **Back gesture / ✕ / Esc / backdrop** → panel closes, app stays put; closing with ✕ doesn't leave a dead history entry (the next back still works normally). *(Task 3, manual 3b)*
3. **Offline, drawing never viewed** → boxes show "Drawing not available offline yet"; muscles and tips still show. *(Task 3, manual 3c)*
4. **Exercise name in a different case** ("bench press" typed by the user) → "!" still appears with Bench Press info. *(Task 2 test `infoFor is case-insensitive`)*
5. **A source SVG with an unexpected color** → import script stops with an error naming the file, nothing half-written ships. *(Task 1 test `recolorSvg throws on unexpected fill`)*

---

### Task 1: SVG tools (recolor + slug)

**Files:**
- Create: `tools/svg-tools.mjs`, `tests/svg-tools.test.js`

**Interfaces:**
- Produces: `recolorSvg(text: string, label?: string) -> string`; `slugify(name: string) -> string`.

Spec amendment (ruling, recorded in the ledger): two source files (0099) use dark grays `#2e2e2c`/`#40413f`, so "line" means **any fill whose R, G and B are all ≤ 0x60**, not only `#333`.

- [ ] **Step 1: Write failing tests**

```js
const SRC = '<?xml version="1.0"?><!-- c --><svg width="268pt" height="275pt" viewBox="0 0 268 275" xmlns="http://www.w3.org/2000/svg"><g fill="#FFF"><path d="M0 0h1"/></g><g fill="#333"><path d="M1 1h1"/></g></svg>';
test("recolorSvg maps line and background fills", () => {
  const out = recolorSvg(SRC);
  assert.match(out, /fill="currentColor"/); assert.match(out, /fill="var\(--ex-bg\)"/);
  assert.doesNotMatch(out, /#333|#FFF/i);
});
test("recolorSvg accepts other near-black and white spellings", () => {
  for (const c of ["#2e2e2c", "#40413F", "#333333", "#000"]) assert.match(recolorSvg(SRC.replace("#333", c)), /currentColor/, c);
  for (const c of ["#ffffff", "white", "#FfF"]) assert.match(recolorSvg(SRC.replace("#FFF", c)), /var\(--ex-bg\)/, c);
});
test("recolorSvg drops width/height, keeps viewBox, strips prolog and comments", () => {
  const out = recolorSvg(SRC);
  assert.ok(out.startsWith("<svg")); assert.doesNotMatch(out, /\swidth=|\sheight=|<!--|<\?xml/);
  assert.match(out, /viewBox="0 0 268 275"/);
});
test("recolorSvg throws on unexpected fill", () =>
  assert.throws(() => recolorSvg(SRC.replace("#333", "#ff0000"), "0042-tension"), /0042-tension.*#ff0000/));
test("slugify", () => {
  assert.equal(slugify("Close-grip Bench Press"), "close-grip-bench-press");
  assert.equal(slugify("Hamstrings & Glutes"), "hamstrings-glutes");
  assert.equal(slugify("  Push-up "), "push-up");
});
```

- [ ] **Step 2:** `npm test` → FAIL (module not found).
- [ ] **Step 3:** Implement both in `tools/svg-tools.mjs`. `recolorSvg` also rejects `style="...fill..."` (throws) so only attribute fills exist; collapses runs of whitespace between tags. `slugify`: lowercase, non-alphanumerics → `-`, trim/collapse dashes.
- [ ] **Step 4:** `npm test` → all PASS.
- [ ] **Step 5: Commit** `feat: svg recolor and slug helpers for exercise drawings`

---

### Task 2: Exercise data, import script, drawings

**Files:**
- Create: `tools/exercise-sources.json`, `tools/import-exercises.mjs`, `public/exercise-info.js` (generated), `public/exercises/*.svg` (generated), `public/exercises/LICENSE.md`, `tests/exercise-info.test.js`

**Interfaces:**
- Consumes: Task 1 `recolorSvg`, `slugify`; `LIB`, `MUSCLES`, `ALL_EX`, `muscleOf` from `public/exercise-library.js`.
- Produces: `public/exercise-info.js` exporting `INFO: {[lowercaseName]: {name, slug, img: boolean, primary: string[], secondary: string[], tips: string[]}}` and `infoFor(name: string) -> entry | null`. Drawing URLs are `/exercises/${slug}-start.svg` and `/exercises/${slug}-end.svg`.

- [ ] **Step 1: Write failing data tests** in `tests/exercise-info.test.js` (import `INFO, infoFor` from `../public/exercise-info.js`, library exports, `node:fs`):

```js
test("every library exercise has an entry", () => { for (const n of ALL_EX) assert.ok(infoFor(n), n); });
test("no entries for unknown exercises", () => assert.equal(Object.keys(INFO).length, ALL_EX.length));
test("tips: 2-4 each, short, no trailing period", () => { for (const e of Object.values(INFO)) {
  assert.ok(e.tips.length >= 2 && e.tips.length <= 4, e.name);
  for (const t of e.tips) { assert.ok(t.length <= 60, t); assert.ok(!t.endsWith("."), t); } } });
test("muscles valid and primary matches the library group", () => { for (const e of Object.values(INFO)) {
  assert.ok(e.primary.length > 0, e.name);
  for (const m of [...e.primary, ...e.secondary]) assert.ok(MUSCLES.includes(m), `${e.name}: ${m}`);
  assert.equal(e.primary[0], muscleOf(e.name), e.name); } });
test("drawing files exist for img:true and none are unreferenced", () => {
  const files = new Set(readdirSync("public/exercises").filter(f => f.endsWith(".svg")));
  const want = new Set(Object.values(INFO).filter(e => e.img).flatMap(e => [`${e.slug}-start.svg`, `${e.slug}-end.svg`]));
  assert.deepEqual([...files].sort(), [...want].sort());
});
test("44 exercises have drawings", () => assert.equal(Object.values(INFO).filter(e => e.img).length, 44));
test("slugs are unique", () => { const s = Object.values(INFO).map(e => e.slug); assert.equal(new Set(s).size, s.length); });
test("infoFor is case-insensitive", () => {
  assert.equal(infoFor("bench press").name, "Bench Press"); assert.equal(infoFor("BENCH PRESS").name, "Bench Press");
  assert.equal(infoFor("My Custom Thing"), null);
});
```

- [ ] **Step 2:** `npm test` → FAIL (module not found).
- [ ] **Step 3: Write `tools/exercise-sources.json`**: object keyed by the exact `LIB` name, every one of the 55, `{ "ek": "<id>" | null, "primary": [...], "secondary": [...], "tips": [...] }`, `ek` values exactly from the table above. Author muscles (primary[0] = `muscleOf`) and tips per the Global Constraints, e.g. Squat: `["Brace your core before each rep", "Knees track over your toes", "Hit at least parallel depth", "Drive up through the whole foot"]`.
- [ ] **Step 4: Write `tools/import-exercises.mjs`** (run as `node tools/import-exercises.mjs`): reads the sources; verifies the key set equals `ALL_EX` (exit 1 listing differences); for each `ek` downloads both poses (skip a file already on disk unless `--force`), runs `recolorSvg(text, "<ek>-<pose>")`, writes `public/exercises/<slug>-start.svg` / `-end.svg`; deletes any `public/exercises/*.svg` not in the expected set; writes `public/exercise-info.js` with a "Generated by tools/import-exercises.mjs — edit tools/exercise-sources.json instead" header, `export const INFO = {...}` (keys lowercased, sorted) and `export function infoFor(name){ return INFO[String(name).toLowerCase()] || null; }`. Any error → non-zero exit and no info file written.
- [ ] **Step 5:** Run `node tools/import-exercises.mjs`. Expected: 88 SVGs in `public/exercises/`, total under 2.5 MB (`du -ch public/exercises/*.svg | tail -1`).
- [ ] **Step 6:** Write `public/exercises/LICENSE.md`: drawings adapted (recolored, minified) from Everkinetic (github.com/everkinetic/data), licensed CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/); these adapted files are shared under the same license.
- [ ] **Step 7:** `npm test` → all PASS.
- [ ] **Step 8: Commit** `feat: exercise info data and recolored Everkinetic drawings`

---

### Task 3: Info panel (bottom sheet)

**Files:**
- Modify: `public/index.html`: CSS, markup next to `#restbar`, import line, a new `/* ---------- EXERCISE INFO ---------- */` section before `/* ---------- SCREEN WAKE LOCK ---------- */`, click `switch`

**Interfaces:**
- Consumes: Task 2 `infoFor`, drawing URL pattern.
- Produces: `openExInfo(name: string): void`, `closeExInfo(): void`; click action `data-act="ex-info" data-name="<exercise>"` (Task 4 renders these).

- [ ] **Step 1: Markup + CSS.** `<dialog id="exinfo" class="sheet" aria-labelledby="exinfo-title">` filled on open. Sheet: fixed to the bottom, `width:100%; max-width:640px; margin:auto auto 0`, `border-radius:16px 16px 0 0`, surface background, `padding-bottom: calc(16px + env(safe-area-inset-bottom,0px))`, `max-height:85vh; overflow:auto`; `::backdrop` translucent. Content: header row with `<h2 id="exinfo-title">` (display font) and a ✕ button `data-act="exinfo-close" aria-label="Close"`; a two-column `.ex-figs` grid with two `<figure>`s (`<div class="ex-fig">` box with `aspect-ratio:1`, `color:var(--fg); --ex-bg:var(--surface)`, inline svg `width:100%;height:100%`) and captions **Start** / **Finish**; `<p>` "Works: <b>primary</b> · secondary" (secondary muted); `<ul>` tips; credit `<p class="prev">` with the exact credit text. Omit `.ex-figs` when `img` is false.
- [ ] **Step 2: Open/close.** `openExInfo(name)`: `infoFor(name)` (return if null), render, `showModal()`, `history.pushState({exinfo:1}, "")`. Close paths: ✕ and backdrop click (`e.target === dialog`) call `closeExInfo()` = `dialog.close()`; Esc closes natively. Dialog `close` event: if `history.state?.exinfo` then `history.back()`. `popstate`: if dialog open, `dialog.close()`.
- [ ] **Step 3: Drawings.** After opening, fetch both SVG URLs; insert each response text as the box's `innerHTML` (files are our own generated, same-origin SVGs). Failure → the box shows `<span class="prev">Drawing not available offline yet</span>`.
- [ ] **Step 4: Stale-fetch guard.** Module-level `let exInfoToken = 0`; each open increments it and fetch callbacks drop their result if the token changed.
- [ ] **Step 5: Wire** `case "ex-info": openExInfo(b.dataset.name); break;` and `case "exinfo-close": closeExInfo(); break;`. Parse-check the inline script (`node --check` on the extracted module) and `npm test`.
- [ ] **Step 6: Manual (phone, after Task 4 adds buttons):** (a) panel shows name, both drawings, muscles, tips, credit; readable in light and dark. (b) ✕, backdrop, Esc, and Android back each close it; after ✕, one back press still navigates normally. (c) Airplane mode with a never-viewed exercise → offline message, rest of panel fine. (d) Tap "!" on A then B fast → only B's drawings. (e) At 400px, no horizontal scroll; long tips wrap.
- [ ] **Step 7: Commit** `feat: exercise info bottom sheet`

---

### Task 4: "!" buttons

**Files:**
- Modify: `public/index.html`: `renderLog` (collapsed `exrow`, open-card header, suggestion chips), `renderDays` editor exercise list and its suggestion chips, CSS

**Interfaces:**
- Consumes: Task 3 action `ex-info`; Task 2 `infoFor`.
- Produces: `infoBtn(name: string) -> string` (button HTML, or `""` when `infoFor(name)` is null).

- [ ] **Step 1:** Add `infoBtn(name)`: `<button class="infobtn" data-act="ex-info" data-name="${esc(name)}" aria-label="About ${esc(name)}">!</button>`. CSS: 22px round outlined glyph (muted color, accent on focus/hover), padding so the hit box is ≥44×44 px, `flex:none`.
- [ ] **Step 2: Workout collapsed rows.** Wrap each `button.exrow` in `<div class="exrow-wrap">` (flex row; the row button `flex:1`) with `infoBtn(e.ex)` after it, so tapping the row still opens the exercise. Keep the existing `exrow` look (move border/background to the wrapper if needed so the "!" sits inside the visual row).
- [ ] **Step 3: Open card header:** `infoBtn(e.ex)` right after the exercise-name button, before Remove.
- [ ] **Step 4: Suggestion chips** (Workout "Add an exercise", free-workout muscle suggestions, and the Days editor suggestions): render each as `<span class="chipgrp"><button class="chip add" …>name</button>${infoBtn(name)}</span>`; tapping the chip still adds the exercise. On chips the "!" is a compact variant (`.chipgrp .infobtn`), still ≥44px tall hit area via negative margins/padding without changing chip row spacing noticeably.
- [ ] **Step 5: Days editor exercise list:** `infoBtn(name)` next to each exercise name in the editing day's list.
- [ ] **Step 6:** Parse-check and `npm test`. Manual: "!" appears in all places for library exercises and not for a custom one; tapping a row/chip still opens/adds; the "!" opens the right exercise; no layout overflow at 400px.
- [ ] **Step 7: Commit** `feat: "!" exercise info buttons on workout, days and suggestions`

---

### Task 5: Offline caching + release

**Files:**
- Modify: `public/sw.js`, `README.md`, `CLAUDE.md` (local, untracked)

- [ ] **Step 1: `sw.js`:** add `"/exercise-info.js"` to `APP_SHELL`; in the fetch handler, same-origin requests whose path starts with `/exercises/` use `cacheFirst` (drawings never change at the same address within a VERSION); `VERSION = "iron-log-v7"`.
- [ ] **Step 2: README:** a short "Exercise drawings" section: credit line + link to Everkinetic and the license, and how to regenerate (`node tools/import-exercises.mjs` after editing `tools/exercise-sources.json`).
- [ ] **Step 3: CLAUDE.md:** files list (`tools/`, `public/exercise-info.js`, `public/exercises/`), features (exercise info "!"), "Ideas not built yet" drops the figures item.
- [ ] **Step 4:** `npm test` all PASS; parse-check.
- [ ] **Step 5: Commit** `chore: cache exercise drawings offline, sw v7, docs`
- [ ] **Step 6:** Final whole-branch review, then merge `fix-day-focus` into `main`, push, `firebase deploy --only hosting` (the user asked to ship the day-focus fix and the figures together). Verify live: `sw.js` shows v7, `/exercise-info.js` and one `/exercises/*.svg` return 200.
