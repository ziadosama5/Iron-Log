# Less Crowded (Today, Progress, Friends) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Today, the Progress sections and the Friends screens calmer: forms live in sheets, long lists are cut to a few rows with "Show more", and Friends gets avatars, a who's-ahead strip and a collapsed Manage card.

**Architecture:** No data or rules change. `index.html` draws less by default; two small pure helpers (`rankWeek`, `initialsOf`/`avatarHue`) carry the new logic and are unit-tested. The meal form moves into a new `#mealsheet` that reuses the existing sheet machinery (`openSheet`, `closeSheet`, `refreshSheets`, popstate Back handling). One generic "show more" toggle (`state.showMore[key]`, session only) serves Body, Lifts, History and the Manage card.

**Tech Stack:** plain JS in `public/index.html`, ES modules `friends.js` and `ui-helpers.js`, Node built-in test runner (`npm test`), Playwright smoke tests (`tests-ui`), screenshot harness.

**Spec:** `docs/superpowers/specs/2026-10-23-less-crowded-design.md`

## Global Constraints

- Every visible string needs an Arabic entry in `public/lang-ar.js` (`npm test` fails otherwise); never glue strings, use `t("... {n}",{n})` / `tn(one,other,n)`.
- Use logical CSS properties (`margin-inline-start`, `text-align:start`); no hardcoded blue, use `var(--accent)` etc.
- Touch targets at least 44px, text at least 12px (tests-ui checks both).
- Writes, Firestore data, rules, badges, XP, the focus-mode workout card, navigation and swipe do not change.
- Bump `VERSION` in `public/sw.js` (v33 to v34) in the last task; no new `public/*.js` file is added, so `APP_SHELL` does not change.
- Never deploy without the owner's explicit approval.

## Review Focus

- A half-typed meal (kcal typed, sheet closed by Back or a snapshot redraw) must not lose the draft: sheet inputs write to `state.mealDraft`.
- A snapshot arriving while the meal sheet is open must not redraw the sheet under the person's finger or wipe typed text (typing guard).
- Back (Android) with the meal sheet open closes only the sheet, not the app or the tab.
- Friends with no summary (not sharing), me alone with no friends, and ties in "workouts this week" must still draw a sensible strip.
- Names that are one letter, Arabic, empty or emoji must give a non-empty avatar and never break the layout.
- Arabic/RTL: sheet, strip and avatars mirror correctly; numbers stay in LTR isolates.

---

### Task 1: Pure helpers `rankWeek`, `initialsOf`, `avatarHue`

**Files:**
- Modify: `public/friends.js` (add `rankWeek`), `public/ui-helpers.js` (add `initialsOf`, `avatarHue`)
- Test: `tests/friends.test.js`, `tests/ui-helpers.test.js`

**Interfaces:**
- Produces: `rankWeek(me, friends) -> [{uid, name, isMe, workoutsWeek, rank}]` where `me = {uid, name, summary}` and `friends = [{uid, name, summary}]` (`summary` may be null/undefined). Sorted by `workoutsWeek` descending; people without a summary count as `null`, are listed last in the given order and get `rank: null`; ties share a rank (1,1,3).
- Produces: `initialsOf(name) -> string` (1 to 2 characters, upper-cased; first letters of the first two words, or the first two characters of a single word; `"?"` for empty/whitespace; works for Arabic and emoji by splitting on code points with `Array.from`).
- Produces: `avatarHue(name) -> integer 0..359`, stable for the same string.

- [ ] **Step 1: Write failing tests**
  - `rankWeek` ranks 3 > 2 > 2 as ranks 1,2,2; me appears with `isMe:true`; a friend with `summary:null` is last with `workoutsWeek:null, rank:null`; empty friends gives just me with rank 1.
  - `initialsOf("zed")==="ZE"`, `initialsOf("Ziad Osama")==="ZO"`, `initialsOf("")==="?"`, `initialsOf("  ")==="?"`, `initialsOf("زياد")` has length 2 code points, `initialsOf("🏋️")` is non-empty.
  - `avatarHue("zed")===avatarHue("zed")` and is an integer in 0..359; two different names differ for at least one pair in a small sample.
- [ ] **Step 2: Run `npm test`, expect the new tests to fail** (functions not defined).
- [ ] **Step 3: Implement** the three functions as exported pure functions (hash = simple string sum/multiply modulo 360).
- [ ] **Step 4: Run `npm test`, expect all pass.**
- [ ] **Step 5: Commit** `feat: rankWeek, initialsOf, avatarHue helpers`.

---

### Task 2: Meal sheet and compact Food and energy card

**Files:**
- Modify: `public/index.html` (`todayCard`, new `mealSheetHtml`, `#mealsheet` dialog next to `#cardiosheet` at ~line 478, `openSheet`/`refreshSheets`/sheet loops at ~1224-1243, the `submit` handler for `meal-form` at ~2344, `case "meal-name"`, `case "rm-meal"`, `case "sheet-close"`, CSS for the compact card), `public/lang-ar.js`
- Test: `tests-ui/smoke.test.mjs` (update "adding a meal on Today shows it in the list"; add the cases below)

**Interfaces:**
- Consumes: `state.mealDraft`, `store.saveFood`, `dayEnergy`, `kcalTxt`, `signedTxt`, `balanceGood` (all already used by `todayCard`).
- Produces: `mealSheetHtml()` returns the sheet markup (header with close button, "Everyday · Lifting · Cardio" line, protein line, then the existing `#meal-form` markup unchanged). `todayCard()` returns only: heading with "+ Add meal" button (`data-act="open-mealsheet"`), the three stats collapsed to "Eaten X / Y kcal" with the `.ebar`, the line "Burned N · Balance M", the missing-weight/profile hints, and the meals list (with the existing delete buttons). The whole stats area is also a button with `data-act="open-mealsheet"`.

- [ ] **Step 1: Write failing UI tests** (tests-ui): on Today, `#meal-form` is not in the DOM until "+ Add meal" is tapped; after tapping, `#mealsheet` is open and `#meal-kcal` is focused; typing 400 and submitting closes the sheet and the meal row shows "400 kcal"; typing 300, pressing Back (`page.goBack()`) closes the sheet and reopening shows 300 still in `#meal-kcal`.
- [ ] **Step 2: Run `cd tests-ui && npm test`, expect these to fail.**
- [ ] **Step 3: Implement.** Add the dialog and `mealSheetHtml()`; extend `openSheet` (it picks the markup by id) and the two lists of sheet ids (`refreshSheets`, the `forEach` close/click handlers, the popstate loop) to include `#mealsheet`; `sheet-close` closes it too. Inputs in the sheet keep writing `state.mealDraft` (reuse the existing input handler) and `refreshSheets` must not redraw the sheet while `typing()` is true (same guard as `renderSoon`). After a successful submit call `closeSheet("#mealsheet")` before `renderLog()`. Focus `#meal-kcal` after `showModal`. Hide the sheet's duplicate ids when closed (content is cleared on close, as for the other sheets).
- [ ] **Step 4: Add Arabic** for "+ Add meal", "Add a meal" (if missing) and any new label; run `npm test` until `lang-coverage` passes.
- [ ] **Step 5: Run `npm test` and `cd tests-ui && npm test`, expect pass** (the 44px/12px test included).
- [ ] **Step 6: Commit** `feat: meals open in a sheet, compact Food and energy card`.

---

### Task 3: Cardio only in its sheet, calmer hero on Today

**Files:**
- Modify: `public/index.html` (`renderLog` line ~1141, `levelHero`, `case "hero-go"`, `cardioCard` use), `public/lang-ar.js`
- Test: `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: `openSheet("#cardiosheet")`, `cardioSheetHtml()` (which keeps calling `cardioCard()`), `closestFamily`, `allFamilies`, `openFamily(id)`.
- Produces: `levelHero()` has no "Next badge" line; tapping the hero on Today calls `openFamily(closestFamily(allFamilies(list)).id)` when a closest family exists, else `go("goals")`. `renderLog` in the "pick a day" branch draws `h + dayPicker(...) + <row with a single "+ Cardio" button data-act="open-cardiosheet"> + cardio-list (if any) + todayCard()` instead of the inline `cardioCard()`.

- [ ] **Step 1: Write failing UI tests:** on Today with no workout open, `#cardio-card` (and `#cardio-min`) is not in the DOM; tapping "+ Cardio" opens `#cardiosheet` containing `#cardio-min`; adding cardio closes nothing but lists the session under the button; tapping the hero opens `#familysheet`.
- [ ] **Step 2: Run tests-ui, expect failure.**
- [ ] **Step 3: Implement** the three changes above. Keep `cardioCard()` as the sheet's body (it is still used there). `go("goals")` fallback only when `closestFamily` returns nothing.
- [ ] **Step 4: Run `npm test` and tests-ui, expect pass.**
- [ ] **Step 5: Commit** `feat: cardio form only in its sheet, quieter level hero`.

---

### Task 4: Goals page lighter

**Files:**
- Modify: `public/index.html` (`renderGoals` ~1937-1959), `public/lang-ar.js`
- Test: `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: `closestFamily(allFamilies(list))`, `familyTile`, existing `badges-all` action.
- Produces: `renderGoals` draws, in order: Target weight card, Streaks card, Badges card whose body is the heading `Badges · {a} of {b}`, the closest family's `familyTile` only, and the existing "Show all {n} badges" button. The second `levelHero(false)` call is removed.

- [ ] **Step 1: Write failing UI test:** on the Goals section there is no `.hero`, exactly one `.tile` (family tile) is visible, and "Show all 24 badges" still opens the all-badges page listing 24 badges (the existing test keeps passing).
- [ ] **Step 2: Run tests-ui, expect the new assertions to fail.**
- [ ] **Step 3: Implement.** If `closestFamily` returns nothing (all maxed), show the first family tile.
- [ ] **Step 4: Run both suites, expect pass.**
- [ ] **Step 5: Commit** `feat: Goals shows one badge family and a Show all button`.

---

### Task 5: "Show more" lists in Body, Lifts and History

**Files:**
- Modify: `public/index.html` (`renderBody` recent entries ~1678, `renderProgress` sessions table ~1551, `renderHistory` ~2019, new `case "more-list"`), `public/lang-ar.js`
- Test: `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: `visibleItems(items, expanded, limit)` from `ui-helpers.js`.
- Produces: `state.showMore` (object, session only, reset on sign-out with the rest of `state`); a helper `moreBtn(key, hidden)` returning the button markup `data-act="more-list" data-k="<key>"` with the label `Show all ({n})` (or `Show fewer` when open); `case "more-list"` toggles `state.showMore[key]` and re-renders the view of that key (`body`, `lifts`, `history`). Limits: Body entries 5 (was 12 max), Lifts sessions 5, History workouts 5.

- [ ] **Step 1: Write failing UI tests** with the harness sample data (extend the sample so each list has more than 5 rows if it does not): each list shows 5 rows and a "Show all (N)" button; tapping it shows all rows and the label becomes "Show fewer".
- [ ] **Step 2: Run tests-ui, expect failure.**
- [ ] **Step 3: Implement** with `visibleItems(..., 5)`; the History backup card stays below the list; the Lifts table keeps its `<thead>`.
- [ ] **Step 4: Arabic** strings, then both suites pass.
- [ ] **Step 5: Commit** `feat: Body, Lifts and History lists show 5 rows with Show all`.

---

### Task 6: Friends: avatars, who's-ahead strip, requests banner, Manage fold

**Files:**
- Modify: `public/index.html` (`renderFriends` ~997, `friendRow`, `friendLabel` use, new `avatarHtml`, new `aheadStrip`, CSS `.avatar`, `.ahead`, `.banner`), `public/lang-ar.js`
- Test: `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: `rankWeek`, `initialsOf`, `avatarHue` (Task 1); `currentSummary()` (my summary, line ~801); `state.friends.data[uid].profile.summary`; `groupFriendships`; `frBtn`; `moreBtn`/`state.showMore` (Task 5).
- Produces: `avatarHtml(name) -> string`: a 40px circle `<span class="avatar" style="--h:<hue>" aria-hidden="true">INITIALS</span>` using `hsl(var(--h) 55% 38%)` background with white text. `aheadStrip(g) -> string`: a card "Who's ahead this week" listing `rankWeek` rows horizontally scrollable (avatar, name or "You", count `{n} workouts`, rank number); drawn only when there is at least one friend. `renderFriends` order: requests banner (highlighted card with Accept, Decline and Block, so no capability is lost), strip, Friends list (`friendRow` now starts with `avatarHtml` and shows a level chip plus "N workouts this week"), one collapsed "Manage" card (button `data-act="more-list" data-k="manage"`) that contains Sent and Blocked when open (Cancel, Unblock keep working); with no friends and nothing else, an "Invite a friend" card with a button going to the Find section (`go("find")`).

- [ ] **Step 1: Write failing UI tests** (harness `friends=1`): the strip shows "You" and "Zed"; each friend row has an `.avatar`; Sent and Blocked are not visible until "Manage" is tapped, then Cancel and Unblock are; with the harness opened without `friends=1` (no friends) the "Invite a friend" card is shown and its button opens Find; Arabic mode draws without script errors.
- [ ] **Step 2: Run tests-ui, expect failure.**
- [ ] **Step 3: Implement** as above. Requests keep the existing `frBtn` actions so the write plans are untouched.
- [ ] **Step 4: Arabic** strings ("Who's ahead this week", "You", "Manage", "Invite a friend", the chip text), then both suites pass.
- [ ] **Step 5: Commit** `feat: Friends avatars, who's-ahead strip, Manage fold, invite card`.

---

### Task 7: Docs, spec correction, sw v34, before/after screenshots

**Files:**
- Modify: `public/sw.js` (`VERSION = "iron-log-v34"`), `CLAUDE.md` (Today, Goals, Friends, sheets lists), `docs/README.md` (row 17), `docs/open-points.md`, `docs/superpowers/specs/2026-10-23-less-crowded-design.md`

- [ ] **Step 1: Correct the spec** where the code already did the work: Coach already shows the top 3 tips and starts "More from Coach" collapsed; Body already has one trend chart with a metric select, so only the entries list is trimmed.
- [ ] **Step 2: Update CLAUDE.md** feature text (Today: meals and cardio in sheets, `#mealsheet`; Goals: one family tile; Friends: strip, avatars, Manage; `state.showMore`).
- [ ] **Step 3: Bump the sw version**; run `npm test` and `cd tests-ui && npm test`; both must pass.
- [ ] **Step 4: Take harness screenshots** of Today (picker and workout), Goals, Friends in light, dark and Arabic into the scratchpad; look at them for overlap and clipped text.
- [ ] **Step 5: Commit** `docs: less-crowded shipped notes, sw v34`.

(Review by one whole-branch reviewer, fixes, then the owner tries it on the phone and approves the deploy; deploy is not part of this plan.)
