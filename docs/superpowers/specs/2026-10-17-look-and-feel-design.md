# Look & feel refresh — design

Date: 2026-10-17
Status: approved in chat (with browser mockups), awaiting spec review
Sub-project 3 of 5. Mockups: `.superpowers/brainstorm/3972-1792267747/content/` (style-direction, navigation, workout-layout-v2).

## Goal

Make Iron Log feel like a polished phone app and easier to use mid-workout: a refined light style with a matching dark mode, native-style bottom navigation, a focus-mode Workout screen, and less clutter on Coach and Body.

**What the user said bothers them:** looks plain/generic; cluttered, long pages; 7 tabs in a scrolling top bar; Workout screen hard to use at the gym.

**Success criteria**
- Every screen uses the same small set of building blocks and looks right at 400px in light and dark.
- The four daily screens (Workout, Coach, Body, Goals) are one tap from anywhere.
- Mid-set, the Workout screen shows one exercise with large controls; any exercise can be done in any order.
- Coach and Body show their most-used thing first; the rest is one tap away.

**Constraints (unchanged)**
- No build step, no runtime dependencies, no new data in Firestore. Offline-capable. No horizontal scroll at 400px (except the exercise chip row, which scrolls by design).
- All existing behavior (rest timer, set editing, prefill, cardio, meals, badges, exercise info, backup) keeps working.

## Decisions (from brainstorming)

- Style **B "Clean plate"** with a dark variant.
- Navigation **A**: bottom bar **Workout · Coach · Body · Goals · More**; More = Days, Lifts, History & backup.
- Workout **Focus mode** with an exercise chip row so exercises can be done in any order.

## Visual system

**Tokens** (same names as today on `:root`; values updated; dark values under the existing `prefers-color-scheme` + `[data-theme]` blocks):

| token | light | dark |
|---|---|---|
| `--bg` | `#f3f5f9` | `#0f1319` |
| `--surface` | `#ffffff` | `#171d26` |
| `--sunk` | `#eef2f8` | `#0b0f14` |
| `--line` | `#e3e8ef` | `#283140` |
| `--fg` / `--muted` | `#141a23` / `#5b6676` | `#e6ebf2` / `#8c97a8` |
| `--accent` / `--accent-ink` / `--accent-soft` | `#1f5fd1` / `#fff` / `#dbe6fb` | `#6c9cff` / `#0b1220` / `#1b2a47` |
| `--good` / `--danger` | unchanged | unchanged |
| new `--shadow` | `0 1px 3px rgb(20 30 50 / .08)` | `none` |
| new `--r-card` / `--r-btn` | `18px` / `14px` | same |

**Building blocks** (reused on every screen): card (`--surface`, `--r-card`, `--shadow`), primary button (accent, `--r-btn`, ≥48px tall), secondary button (outlined), big stepper (− value +, 48px round buttons, 28px tabular number), chip, progress bar (`.ebar`), bottom sheet (`dialog.sheet`, already used by exercise info). Fonts unchanged (Barlow Condensed display, IBM Plex Sans body, JetBrains Mono numbers).

**Icons:** inline SVG line icons (24×24, 2px stroke, `currentColor`) defined once in a hidden `<svg>` sprite: workout (dumbbell), coach (speech bubble), body (scale), goals (trophy), more (three dots), plus chevrons. No image files.

**Theme setting:** System / Light / Dark under More, stored in `localStorage["ironlog.theme"]`. Light/Dark set `data-theme` on `<html>`; System removes it. A tiny inline classic script in `<head>` applies the saved theme before first paint (no flash). Unreadable storage → System.

## Navigation

- **Bottom tab bar** fixed to the bottom (padding includes `env(safe-area-inset-bottom)`), five buttons with icon + label; the current one uses `--accent` and `aria-current="page"`. When the current view is Days, Lifts or History, **More** is highlighted.
- **More sheet** (`dialog.sheet`): Days, Lifts, History & backup (each opens that view and closes the sheet), Theme segmented control (System / Light / Dark), account line (first name) and **Sign out**. Back gesture/✕/backdrop close it (same pattern as the exercise info sheet).
- **Header:** logo + current screen title + sync status. The old top tab bar, account name and Sign out button are removed from the header.
- **Rest bar and toasts** sit above the tab bar (bottom offset = tab bar height + safe area); page bottom padding grows accordingly.
- `state.view` and `localStorage["ironlog.view"]` work as today (all seven views stay valid).

## Workout — Focus mode

Applies when a workout for the selected date exists and isn't a cardio-only day (the day picker and cardio-only behavior are unchanged, restyled).

- **Header row:** date (small date input as today), day name, `N of M · X min` where X = whole minutes since the first timed set of that workout (shown only when the date is today and a set has a time), and the progress bar.
- **Chip row:** one chip per exercise in order: done (✓, green), started (number, accent ring), not started (number). The open exercise's chip is filled with the accent. Tapping a chip opens that exercise (`state.openEx`). The row scrolls horizontally and scrolls the open chip into view on render.
- **Open exercise** = the chosen one, else the first not-done exercise (today's rule).
- **Focus card:** `Exercise i of M`, name (display font) with the "!" info button, `Last time: …` (or "First time logging this one"), weight stepper (±2.5 kg) and reps stepper (±1) each full width, **Add set N** primary button (or **Save set** + Cancel while editing a set), then the logged sets (tap to edit, ✕ delete, PR tag), then a small text button "Remove exercise".
- **Under the card:** **✓ Done** (marks done; opens the next unfinished exercise — same as today's "Done with X") and **Next: <name> ›** (opens the next unfinished exercise without marking this one done; hidden when no other exercise is unfinished). When every exercise is done: a "Workout complete" card replaces the focus card (sets, volume, exercise kcal), chips remain tappable to edit.
- **+ Exercise** opens a bottom sheet with the current suggestion chips (muscle groups, free-workout focus) and the "type any exercise" field. **+ Cardio** opens a bottom sheet with the existing cardio form. Logged cardio appears as a one-line list under these buttons (with ✕).
- Pure helpers in `public/workout-tools.js` (unit-tested): `nextUnfinished(entries, fromIndex) -> index | -1` (first not-done entry after `fromIndex`, wrapping around, skipping `fromIndex`); `elapsedMin(workout, now) -> number | null` (minutes since the earliest set `t`; null without timed sets).

## Decluttering

- **Coach:** Today card first. Then a **Tips** card showing the first 3 insights (warnings first, then info, then good) and **Show all tips (N)** to expand (`state.coachAllTips`). "Sets per muscle · last 7 days" and "Get a written review" move into a **More from Coach** expandable section (closed by default).
- **Body:** a top card with the latest weight in large numbers (`80.4 kg`, date, change vs 4 weeks ago) and a **quick weight** field + Save for the selected date (merges into that day's body entry; other fields kept). Measurements and InBody fields open with **Add measurements / scan** (the existing form, closed by default unless the entry already has those values). Trend card and recent entries follow. Profile line unchanged.
- **Goals, Days, Lifts, History:** restyle only (new cards, spacing, buttons); no layout or behavior changes.

## Error handling

- Nothing new is stored in Firestore; theme lives in localStorage with try/catch.
- Sheets degrade like the exercise info sheet (history entry for back gesture).
- Quick weight validates like the existing body form (number > 0) and uses the same toast.

## Testing

- **Unit (`npm test`):** `nextUnfinished` (forward, wrap, skips current, all done → −1), `elapsedMin` (timed sets, none, single set). Existing 108 tests stay green.
- **Mock renders** (real render functions with sample state, headless Edge, 400px, light + dark): Workout mid-set, Workout complete, More sheet open, Coach, Body, Goals. Check: no horizontal overflow (except chip row), tab bar and rest bar don't cover content, contrast readable in both themes.
- **Manual (phone):** switch tabs and More items; theme switch (System/Light/Dark) persists after reload with no flash; do exercises out of order with chips and Next; edit a set in focus mode; add exercise and cardio from the sheets; quick weight on Body; rest bar above tab bar; back gesture closes sheets.
- **Release:** sw VERSION bump; CLAUDE.md (design rules, navigation, Workout focus mode).
