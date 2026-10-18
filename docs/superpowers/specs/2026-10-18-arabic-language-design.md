# Arabic language — design

Sub-project 1 of 2 ("language + accent colors"). The accent picker has its own spec: `2026-10-18-accent-colors-design.md`.

## Goal
A language switch (English / Arabic). In Arabic the **whole app** is translated, mirrored right-to-left, and shows Western digits 0-9. Written in simple Modern Standard Arabic.

## What was agreed
- Scope: everything: screens, buttons, toasts, coach tips, achievements, exercise names, muscle names, exercise tips.
- Arabic: simple Modern Standard Arabic (not Egyptian colloquial).
- Digits: Western 0-9 everywhere (matches number keypads and gym machines).
- Approach: English text is the translation key (`t("Add set")`), with a test that no string is missed.

## Non-goals
- More than two languages, but the design should make a third easy (add one `lang-xx.js`).
- Translating what users type (custom exercise names, meal names, day names they typed).
- Changing stored data. Firestore and backups stay in English; only display is translated.
- Arabic-Indic digits, hijri dates, runtime machine translation.

## Language setting
- `localStorage "ironlog.lang"`: `"en"` or `"ar"`. Not set → follow the phone: `navigator.language` starting with `ar` → `ar`, else `en`.
- Switch: More sheet, a "Language" row next to Theme (two buttons: English · العربية). The labels "English" and "العربية" are never translated.
- A tiny `<head>` script sets `<html lang dir>` before first paint (like the theme script), so there is no flash of left-to-right.
- Changing it sets `lang`/`dir`, redraws the active view and open sheets, and updates `document.title`/header.

## Translation layer
New `public/i18n.js` (pure, no DOM, unit-tested):
- `setLang(code)`, `getLang()`, `isRtl()`.
- `t(text, params?)`: returns `LANGS[lang][text]` if present, else `text`. `{name}` placeholders are replaced from `params`. Missing key in `ar` → English text (never blank).
- `tn(oneText, otherText, n, params?)`: picks `oneText` when `n === 1`, else `otherText`, then translates it (see Plurals).
- `exName(name)`, `muscleName(name)`, `dayName(day)`: return the Arabic name for library exercises/muscles/built-in template day names, otherwise the name as stored.
- `fmtNum`: unchanged (Western digits). `fmtDate` and any `toLocaleDateString` take a locale: `"en"` or `"ar-EG-u-nu-latn"`.

New `public/lang-ar.js`: `export const AR = { "Add set": "إضافة مجموعة", … }` for UI strings, and the Arabic for: exercise names (74), muscle names (9), template names and their built-in day names, badge names and descriptions, cardio types and intensities, goal names, coach tip titles/texts. Exercise tips (≈2-4 per exercise) are generated into `exercise-info.js` from `tools/exercise-sources.json`: each entry gets an optional `ar: { name, tips }`; the importer copies it into `INFO[x].ar`, and the info sheet picks it by language.

### Plurals
Where a count is shown with a noun, use two keys (`one` / `other`). Arabic uses the "other" form for 0 and 3+ and the singular for 1; the dual (2) is written with the plural form too. This is a deliberate simplification: correct enough for sets, reps, days, workouts, minutes, meals; no ordinals.

## What gets translated
Every user-visible string in `public/index.html` (headers, buttons, labels, placeholders, aria-labels, empty states, toasts, confirm texts, sheet titles, notices, the Today card, Goals tab, Body form fields, History/backup, sign-in screen), plus module strings: `achievements.js` badge names/descriptions and level labels, `energy.js` cardio/intensity labels, `workout-tools.js` anything user-visible, coach insights built in `index.html`, the rest-timer bar states, and the exercise-library display names.
- **Not translated:** units (`kg`, `cm`, `kcal`, `g`, `min`, `%` are kept as the short Latin symbols, a common convention), brand name "Iron Log" (wordmark stays; the page title stays "Iron Log"), numbers, user-typed text.
- **"Copy my summary"** (the text for pasting into an AI chat) stays in English: it is read by an AI, not the user; the button and surrounding text are translated.

## Right-to-left
- `<html dir="rtl" lang="ar">` when Arabic. Layout uses **logical** CSS: replace `margin-left/right`, `padding-left/right`, `text-align:left/right`, `left/right` positioning, `border-left/right`, and `inset:0 auto 0 0` with their `inline-start/end` equivalents (≈50 occurrences found).
- Mirrored: tab bar order, chevrons (`#i-chev` flips via `[dir=rtl] .flip`), back arrows, progress bars fill from the right, sheets, set tables (columns read right-to-left), left border stripes on tips become right border.
- **Stay left-to-right:** SVG charts (time runs left → right), number inputs and the ± steppers (− on the left, + on the right in both languages), the exercise drawings, the numeric parts of a line (a `<bdi>`/`dir=ltr` span around weights, reps, times, dates).
- Fonts: `IBM Plex Sans Arabic` (weights 400/500/600/700) from Google Fonts, added to the stylesheet link and the service worker's font cache (cache-first rule already covers `fonts.gstatic.com`). Display headings use it too in Arabic (Barlow Condensed has no Arabic glyphs). Keep JetBrains Mono for numbers.
- Text expands: layouts must not clip on narrow phones (see Testing).

## Files
- Create: `public/i18n.js`, `public/lang-ar.js`, `tests/i18n.test.js`, `tests/lang-coverage.test.js`.
- Modify: `public/index.html` (wrap strings, logical CSS, language row, head script, fonts), `public/achievements.js`, `public/energy.js` (names via `t`-able data), `tools/exercise-sources.json` (+ `ar` blocks), `tools/import-exercises.mjs`, `public/exercise-info.js` (regenerated), `public/sw.js` (APP_SHELL + VERSION), `CLAUDE.md`, `docs/README.md`.

## Testing
- `i18n.test.js`: `t` fallback to English, placeholder replacement, missing key falls back, `tn` picks one/other, `isRtl`, language detection from `navigator.language`, exercise/muscle/day-name lookup with custom names untouched.
- `lang-coverage.test.js` (the safety net): scans `public/index.html` and the module files for every `t("…")` / `tn("…","…")` literal and asserts each exists in `AR` and that its `{placeholders}` match the English ones; asserts every `ALL_EX`, `MUSCLES`, template/day name and badge name has an Arabic entry; asserts every `INFO[x].ar.tips` has the same number of tips as English and no tip exceeds 80 characters.
- Visual: headless-Edge screenshots (Workout focus card, Coach, Body, Goals, More sheet, an exercise info sheet, the Days editor) in Arabic light and dark at 400 px, checked for mirroring, clipped text, and mixed-direction numbers.
- The English app must be unchanged: a test renders `t` with `en` and checks a sample of strings is identity.

## Review focus
- A string built by concatenation (`"Add " + name`) breaks in Arabic word order: all such must use placeholders.
- Stored values that double as labels (cardio type `treadmill`, goal `fat-loss`, intensity, `dayName` "Cardio", weekday names) must be translated at display, never stored translated.
- Mixed-direction lines (Arabic text + `80 kg × 8`) must not reorder numbers.
- Switching language while a sheet or an edit form is open must not lose typed text or leave stale English.
- Service worker: new `public/*.js` files added to `APP_SHELL`; version bumped.
- Offline first run in Arabic still shows the Arabic font (system Arabic font as fallback).

## Rollout
One deploy once the final review is clean: sw v13. Existing users see no change unless their phone language is Arabic or they switch it.
