# Arabic Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A language switch (English / Arabic); in Arabic the whole app is translated, mirrored right-to-left, with 0-9 digits.

**Architecture:** English text is the translation key. A pure `i18n.js` provides `t`/`tn` for strings with numbers or names in them, and `trDom` which, after every render, swaps any whole-text node or `aria-label`/`placeholder`/`title` that exactly matches a key (so plain labels need no code change). Arabic text lives in `lang-ar.js`. A string scanner (`tools/scan-strings.mjs`) feeds a coverage test that fails when any English text in `index.html` has no Arabic entry or is glued to a `${}` outside `t()`. Names of library things (exercises, muscles, badges…) are looked up by `nameOf(kind, name)` at display time; stored data is never translated.

**Tech Stack:** plain JS ES modules, `node --test`, CSS logical properties, Google Fonts (IBM Plex Sans Arabic), headless Edge screenshots.

**Spec:** `docs/superpowers/specs/2026-10-18-arabic-language-design.md` (the accent picker is a separate plan, `2026-10-18-accent-colors.md`, built after this one).

## Global Constraints

- No build step, no new dependencies. Every new `public/*.js` goes into `APP_SHELL` in `public/sw.js`; bump `VERSION` to `"iron-log-v13"` in the last task.
- Language stored in `localStorage "ironlog.lang"` = `"en"` | `"ar"`; unset → `ar` if `navigator.language` starts with `ar`, else `en`.
- Arabic = simple Modern Standard Arabic. Digits stay 0-9. Units stay `kg`, `cm`, `kcal`, `g`, `min`, `%`. Brand "Iron Log" and the labels "English" / "العربية" are never translated. "Copy my summary" prompt text stays English; the button and surrounding text are translated.
- Stored data (Firestore, backups, `dayName`, cardio `type`, goal ids) is never translated; translate only when drawing.
- `index.html` has CRLF line endings: use single-line anchors, scratchpad scripts or the Edit tool; heredocs with apostrophes break.
- English app must look and behave exactly as today.
- Plural rule: `tn(one, other, n)` uses `one` only when `n === 1`.
- Charts, number inputs, ± steppers, exercise drawings stay left-to-right in RTL.

## Review Focus

- Strings built by concatenation or partial interpolation (`"Add " + name`, `` `${n} sets` ``) break Arabic word order. → Task 2's scanner rejects them; Tasks 4-6 fix every one.
- Stored values that double as labels (cardio type, goal, intensity, weekday, `dayName` "Cardio") shown untranslated, or accidentally saved translated. → Task 7 tests `nameOf`; Task 6 checks saved docs are untouched.
- Numbers inside Arabic lines reorder (`80 kg × 8` shown as `8 × 80 kg`). → Task 3 wraps numeric runs in `dir="ltr"` spans; Task 8 screenshots check.
- Switching language with a sheet or edit form open loses typed text or leaves English. → Task 3 test + manual check.
- A missing Arabic string silently shows English. → Task 2 coverage test (fails the build, since `npm test` runs before every deploy).

---

### Task 1: i18n core (`public/i18n.js`)

**Files:**
- Create: `public/i18n.js`, `tests/i18n.test.js`

**Interfaces:**
- Produces (all exported from `public/i18n.js`):
  - `registerLang(code: string, dict: {ui: Record<string,string>, names: Record<string, Record<string,string>>}): void`
  - `setLang(code: string): boolean` (false and no change if code unknown; `"en"` always valid) · `getLang(): string` · `isRtl(): boolean` (true for `ar`)
  - `detectLang(saved: string|null, navLang: string|undefined): "en"|"ar"`
  - `t(text: string, params?: Record<string, string|number>): string` — `ui[text]` if the current language has it, else `text`; then `{name}` placeholders replaced from `params`; unknown placeholders left as is.
  - `tn(one: string, other: string, n: number, params?): string` — `t(n === 1 ? one : other, {n, ...params})`.
  - `nameOf(kind: string, name: string): string` — `names[kind][name]` (exact, then case-insensitive) in the current language, else `name`.
  - `locale(): string | undefined` — `undefined` for `en`, `"ar-EG-u-nu-latn"` for `ar`.
  - `trDom(root: ParentNode): void` — see Step 3.

- [ ] **Step 1: Write the failing tests** in `tests/i18n.test.js` (no DOM; for `trDom` pass a tiny fake tree with `childNodes`, `nodeType`, `nodeValue`, `attributes`/`getAttribute`/`setAttribute`):
  - `t` returns the English text when lang is `en`; returns `dict.ui[text]` when `ar` registered and set; falls back to English when the key is missing in `ar`.
  - `t("{n} of {m} done", {n: 2, m: 5})` → `"2 of 5 done"` in `en`; with an Arabic entry `"{n} من {m} تم"` → `"2 من 5 تم"`; an unknown `{x}` stays `{x}`.
  - `tn("{n} set", "{n} sets", 1)` → `"1 set"`; with `0`, `2`, `5` → `"N sets"`.
  - `detectLang`: `("ar", "en-US")` → `ar`; `(null, "ar-EG")` → `ar`; `(null, "en-GB")` → `en`; `("en", "ar")` → `en`; `("xx", "ar")` → `ar` (invalid saved value ignored).
  - `setLang("zz")` returns false and leaves the language; `isRtl()` true only for `ar`; `locale()` values.
  - `nameOf("ex", "bench press")` finds `"Bench Press"`'s entry case-insensitively; a custom name returns itself.
  - `trDom`: a text node `"  Skip "` inside an element becomes `"  تخطي "` (whitespace preserved) when `ar` has `"Skip"`; an `aria-label="Close"` and `placeholder` and `title` attribute are translated; a text node with letters not in the dictionary is untouched; calling `trDom` twice changes nothing more; after `setLang("en")` and `trDom` the original English is restored.

- [ ] **Step 2: Run** `node --test tests/i18n.test.js` → Expected: FAIL (module missing).

- [ ] **Step 3: Implement `public/i18n.js`.** State is module-level (`current`, `dicts`). `trDom` walks text nodes and the attributes `aria-label`, `placeholder`, `title`, `alt`, translating when the trimmed value is a key of the current dictionary's `ui`; it remembers each node/attribute's original English (WeakMap for text nodes, a `data-en-<attr>` attribute for attributes) so switching back restores. Skip `<script>`, `<style>`, `<svg>` text and any element with `data-no-tr`.

- [ ] **Step 4: Run** `node --test tests/i18n.test.js` → Expected: PASS.

- [ ] **Step 5: Commit** `git add public/i18n.js tests/i18n.test.js && git commit -m "feat: i18n core (t, tn, nameOf, trDom)"`

---

### Task 2: String scanner and coverage test

**Files:**
- Create: `tools/scan-strings.mjs`, `tests/scan-strings.test.js`, `public/lang-ar.js` (starts with `export const AR = { ui: {}, names: {} };`), `tests/lang-coverage.test.js`

**Interfaces:**
- Consumes: `AR` from `public/lang-ar.js`.
- Produces from `tools/scan-strings.mjs`:
  - `scanSource(source: string, opts?: {fromMarker?: string}): { labels: string[], violations: {line: number, text: string, why: string}[] }`
    - Looks at (a) the static HTML before `<script type="module">` and (b) every template literal and the text segments inside them, including nested templates inside `${…}`.
    - A **text node** is the text between tag boundaries, `>`/`<`, and `${…}` interpolations (replace each interpolation with `\u0001`). Trimmed, with at least one Latin letter:
      - no `\u0001` in it → a **label** (needs an Arabic entry);
      - contains `\u0001` → a **violation** `"interpolated text outside t()"` (the fix is `${t("… {x} …", {x})}`).
    - Attribute values of `aria-label`, `placeholder`, `title`, `alt` follow the same rule.
    - `t("…")` / `tn("…","…", …)` calls with a plain string literal first (and second) argument → labels (even inside `${}`).
    - A string literal or template whose text starts with a letter passed directly to `toast(`, `setSync(`, or as the 3rd/4th argument of `add(` (coach insights) → violation `"untranslated message"`; arguments that are `t(`/`tn(` calls or plain identifiers are fine.
  - `LABEL_ALLOW`: set of non-translatable texts (`Iron Log`, `English`, `العربية`, `kg`, `cm`, `kcal`, `g`, `min`, `s`, `%`, single symbols, `PR`, `e1RM`, `1RM`, `RPE`).

- [ ] **Step 1: Write failing tests** `tests/scan-strings.test.js` with fixtures:
  - `'<button>Skip</button>'` → labels `["Skip"]`.
  - ``'`<span>Last time (${d}): <b>${x}</b></span>`'`` → one violation (text "Last time (…): " has an interpolation); `` `<span>${t("Last time ({d})",{d})}</span>` `` → no violation, label `"Last time ({d})"`.
  - `<input placeholder="Search" aria-label="Weight">` → labels Search, Weight; `aria-label="${esc(n)}"` → none.
  - `toast("Saved")` → violation; `toast(t("Saved"))` → none, label `Saved`; `toast(msg)` → none.
  - A nested template inside `${…}` is scanned too.
  - Text that is only numbers/symbols (`×`, `–`, `·`, `✕`) is ignored; `LABEL_ALLOW` items ignored.
  - Text inside `<script>`/`<style>` tags in the HTML part is ignored; JS comments are ignored.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the scanner (balanced-brace scan for `${…}`, no dependencies). **Step 4: Run** → PASS.
- [ ] **Step 5: Write `tests/lang-coverage.test.js`:** splits `public/index.html` into sections: `static` (HTML before the module script) and one section per `/* ---------- NAME ---------- */` comment; also reads `public/achievements.js`, `public/energy.js`, `public/workout-tools.js` as sections named by file. For every section **not** listed in `const PENDING = [...]` (initially every section name) it asserts: `violations` is empty (message lists `section:line text`), every label has `AR.ui[label]`, and every AR string keeps the same `{placeholders}` as its key. It also asserts `PENDING` is empty once `process.env.I18N_DONE === "1"` (Task 9 sets this check on permanently by emptying the list). Tasks 5-7 remove sections from `PENDING` as they finish them.
- [ ] **Step 6: Commit** `git add tools tests public/lang-ar.js && git commit -m "feat: string scanner + Arabic coverage test"`

---

### Task 3: Language setting, RTL switch and `<head>` script

**Files:**
- Modify: `public/index.html`, `public/sw.js` (APP_SHELL: `/i18n.js`, `/lang-ar.js`)
- Test: add cases to `tests/i18n.test.js` (language detection already covered)

**Interfaces:**
- Consumes: `registerLang, setLang, getLang, isRtl, detectLang, t, trDom, locale` (Task 1), `AR` (Task 2).
- Produces in `index.html`: `applyLang(code)` — saves `ironlog.lang`, `setLang`, sets `document.documentElement.lang` and `dir`, runs `trDom(document.body)`, re-renders the active view and refreshes open sheets (`refreshSheets()`), updates `<title>` unchanged and the language buttons' `aria-pressed`; `fmtDate`/`fmtDateY` pass `locale()`; `const LANG_LABEL`.

- [ ] **Step 1: Write the failing test** (add to `tests/i18n.test.js`): `detectLang` already tested; add a test that `locale()` is `undefined` after `setLang("en")` and the Arabic locale string after `setLang("ar")` (guards fmtDate input).
- [ ] **Step 2: Implement in `index.html`:**
  1. The existing theme `<head>` script gets a sibling line setting `<html lang dir>` from `localStorage "ironlog.lang"` (or `navigator.language`) before first paint.
  2. Import the modules; `registerLang("ar", AR)`; at startup `applyLang(detectLang(saved, navigator.language))` before the first render.
  3. More sheet: a "Language" row (label `Language`) with a `.seg` of two buttons `English` / `العربية` (`data-act="lang-set" data-v="en|ar"`, mark both `data-no-tr`), handled in the click switch by `applyLang`.
  4. `render()` and every sheet-opening function call `trDom` on what they filled (`#view-*`, sheet bodies, the rest bar, toast text via `t` instead).
  5. Wrap numeric runs that sit inside translated sentences in `<span dir="ltr" class="num">` where Task 8's screenshots show reordering (add the `.num` isolation CSS: `unicode-bidi:isolate`).
  6. Typed text is not lost: `applyLang` returns early without redrawing a view while `typing()` is true, and redraws on blur via the existing `renderSoon` path.
- [ ] **Step 3: Run** `npm test` → PASS (the coverage test's `PENDING` still lists every section). Open the app with `firebase serve` or the screenshot harness: switching to Arabic sets `dir="rtl"` and the Language buttons work.
- [ ] **Step 4: Commit** `git commit -am "feat: language setting and RTL switch"`

---

### Task 4: Logical CSS and RTL layout

**Files:**
- Modify: `public/index.html` (CSS, tab bar, chevron symbol use, fonts link)

- [ ] **Step 1: Replace directional CSS** (found by grep: `margin-left/right`, `padding-left/right`, `text-align:left/right`, `left:`/`right:`, `border-left/right`, `inset:0 auto 0 0`) with logical properties (`margin-inline-start`, `padding-inline-end`, `text-align:start/end`, `inset-inline-start`, `border-inline-start`, `inset:0 auto 0 0` → `inset-block:0;inset-inline-start:0;`). English rendering must not change: take before/after screenshots of Workout and Coach in English at 400 px and compare by eye.
- [ ] **Step 2: RTL specifics:** `[dir="rtl"] svg.flip{transform:scaleX(-1)}` applied to chevrons and arrows; `.stepper`/`.bigstep` and number inputs forced `direction:ltr`; charts (`svg` charts, `.bars`) `direction:ltr`; progress fills start from the inline start.
- [ ] **Step 3: Font:** add `family=IBM+Plex+Sans+Arabic:wght@400;500;600;700` to the Google Fonts link; `:root[lang="ar"]{--f-body:"IBM Plex Sans Arabic",system-ui,sans-serif;--f-display:"IBM Plex Sans Arabic",system-ui,sans-serif}` (numbers keep JetBrains Mono).
- [ ] **Step 4: Verify** with a headless-Edge frame of the real render functions (`mock-focus.mjs` pattern) with `dir=rtl`: tab bar order mirrored, chevrons mirrored, sheet close button on the correct side, steppers still − on the left. Fix what's off.
- [ ] **Step 5: Run** `npm test` → PASS. **Commit** `git commit -am "feat: logical CSS, RTL layout and Arabic font"`

---

### Task 5: Translate the Workout screen

**Files:**
- Modify: `public/index.html` (`renderLog`, `focusCard`, `completeCard`, `exSheetHtml`, `cardioSheetHtml`, `dayPicker`, `cardioCard`, rest bar, header, tab bar, toasts in this area), `public/lang-ar.js`, `public/energy.js` (labels exposed for translation if any user-visible text)

- [ ] **Step 1: Remove the `static`, `WORKOUT` and `REST TIMER` sections from `PENDING`** in `tests/lang-coverage.test.js`. Run -> FAIL listing every missing string and every violation (this is the to-do list).
- [ ] **Step 2: Fix violations** by wrapping interpolated text: `` `${n} sets` `` → `${tn("{n} set","{n} sets",n)}`, `"Last time (${d})"` → `${t("Last time ({d})",{d:fmtDate(x)})}`, `toast("…")` → `toast(t("…"))`. Plain labels need no wrapping.
- [ ] **Step 3: Add the Arabic** for every listed label to `AR.ui` (simple Modern Standard Arabic; keep `{placeholders}` identical; use `tn` pairs for counts).
- [ ] **Step 4: Run** `npm test` → PASS for this section. Spot-check in Arabic with the screenshot harness.
- [ ] **Step 5: Commit** `git commit -am "feat: Arabic for the Workout screen"`

### Task 6: Translate Days, Lifts, History/backup, sign-in, More

**Files:** `public/index.html` (`renderDays`, `tplGrid`, `weekStrip`, `renderProgress`, `lineChart` messages, `renderHistory`, `historySummary`, `backupCard`, `renderSignin`, `signInError`, `showAccount`, More sheet, `exinfo` sheet shell, `setSync` messages), `public/lang-ar.js`

- [ ] **Steps 1-5 exactly as Task 5** for these areas (remove the `DAYS`, `PROGRESS`, `HISTORY`, `EXERCISE INFO`, `storage` and `render + events` sections from `PENDING`; run → FAIL; wrap; add Arabic; run → PASS; commit `feat: Arabic for Days, Lifts, History and sign-in`).
- [ ] **Extra test:** `tests/lang-coverage.test.js` also asserts `AR.ui` has `Sign out`, `Language`, `Theme`, `System`, `Light`, `Dark`. Verify by reading `index.html` that backup export and restore code paths do not call `t()` on stored values.

### Task 7: Translate Body, Coach, Goals + names tables

**Files:** `public/index.html` (`renderBody`, `field`, `quickWeightCard`, `insights`, `todayCard`, `renderCoach`, `volumeBars`, `renderGoals`, `badgeProgress`), `public/achievements.js`, `public/lang-ar.js`, `tests/i18n.test.js`

**Interfaces:**
- Consumes: `nameOf` (Task 1).
- Produces: `AR.names` tables: `ex` (all 74 `ALL_EX`), `muscle` (the 9 `MUSCLES`), `template` (4 template names + their notes), `day` (built-in template day names), `badge` (24 badge names) and `badgeDesc`, `cardio` (treadmill, elliptical, bike, other), `intensity`, `goal` (the 5 goal ids → Arabic), `weekday` (7).

- [ ] **Step 1: Write failing tests** in `tests/lang-coverage.test.js`: every `ALL_EX`, `MUSCLES`, `TEMPLATES` name and day name, every `BADGES[].name`, every `CARDIO_TYPES`, `INTENSITIES`, goal id, weekday has an entry in the matching `AR.names` table; no Arabic name is empty; the Arabic names of `ALL_EX` are unique.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement:** replace display of stored values with `nameOf("ex", e.ex)` etc. everywhere they are drawn (exercise chips, rows, info sheet title, Lifts selector, history chips, suggestions, Days editor, muscle chips, cardio labels, goal select, weekday strip, badge cards); stored values (`data-name`, saved docs) keep the English name. Coach `insights()` messages use `t`/`tn` with `nameOf` for exercise and muscle names in params. Wrap/translate as in Task 5 for the rest of the areas.
- [ ] **Step 4: Remove `BODY`, `COACH`, `GOALS`, `derived`, `THEME`, `SCREEN WAKE LOCK` and the achievements/energy/workout-tools file sections from `PENDING`. Run** `npm test` → PASS (`PENDING` is now empty). Search for any remaining place that saves a displayed label (`grep -n "nameOf" public/index.html` vs `store.save*` arguments) and confirm none.
- [ ] **Step 5: Commit** `git commit -am "feat: Arabic for Body, Coach, Goals and library names"`

### Task 8: Exercise tips in Arabic

**Files:** `tools/exercise-sources.json` (add `"ar": {"tips": [...]}` to each of the 74 entries), `tools/import-exercises.mjs` (copy `ar` into `INFO[x].ar`), `public/exercise-info.js` (regenerated), `public/index.html` (`openExInfo`: use `INFO.ar.tips` and `nameOf` for title and muscles when Arabic), `tests/exercise-info.test.js`

- [ ] **Step 1: Write failing tests** in `tests/exercise-info.test.js`: every entry has `ar.tips` with the same length as `tips`; each Arabic tip ≤ 80 characters and has no trailing period; the generated `INFO` keeps `ar`.
- [ ] **Step 2: Run** → FAIL. **Step 3:** add the Arabic tips to `exercise-sources.json` (translate all 74 entries' tips, simple MSA), update the importer to write `ar`, run `node tools/import-exercises.mjs`, and render `ar.tips` in the info sheet when the language is Arabic (English tips otherwise; fall back to English if `ar` missing).
- [ ] **Step 4: Run** `npm test` → PASS. **Step 5: Commit** `git commit -am "feat: Arabic exercise tips"`

### Task 9: Visual check, review fixes and release

**Files:** `public/sw.js` (VERSION `iron-log-v13`), `CLAUDE.md`, `docs/README.md`

- [ ] **Step 1: Screenshots** (headless Edge, 400 px, light + dark, `dir=rtl lang=ar`) of: Workout focus card, Workout complete, Coach, Body, Goals, More sheet, exercise info sheet, Days editor, History, sign-in. Check: mirroring, no clipped or overlapping text, numbers not reordered, Arabic font applied, English still correct. Fix issues (add `dir="ltr"` number spans, widen buttons) and re-shoot.
- [ ] **Step 2: Manual list** (read the code, since sign-in is not testable headless): switch language with a sheet open; switch while typing; reload keeps language; sign-in screen translated; `<title>` unchanged.
- [ ] **Step 3: Docs:** `CLAUDE.md` (files: `i18n.js`, `lang-ar.js`, `tools/scan-strings.mjs`; "How to add a string": write English, wrap only if it has `${}`, add the Arabic to `lang-ar.js`; language setting; RTL rules), `docs/README.md` row 7.
- [ ] **Step 4: Run** `npm test` → all pass; `git commit -am "feat: Arabic language, release v13"`.
