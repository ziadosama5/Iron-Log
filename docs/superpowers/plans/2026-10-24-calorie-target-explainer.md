# Calorie Target Explainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a person open their daily calorie target, see how it is built, and change the everyday activity level and the daily adjustment.

**Architecture:** `energy.js` gains an activity table, a goal-adjustment resolver and a pure `explainTarget`; `dayEnergy` takes two optional inputs and is otherwise unchanged. Two optional fields live on the private `profile` document. The three `dayEnergy` callers pass them. A new `#targetsheet` bottom sheet, opened from a link on Today's food card, shows the breakdown and the two controls.

**Tech Stack:** plain ES modules, no build; Node test runner (`npm test`), Playwright harness (`tests-ui`).

**Spec:** `docs/superpowers/specs/2026-10-24-calorie-target-explainer-design.md`

## Global Constraints
- Files are CRLF in git on Windows (autocrlf): edit with the Edit/Write tools or a CRLF-aware helper; never rely on a shell regex with backslashes.
- Every visible string needs an Arabic entry in `public/lang-ar.js` (`npm test` fails otherwise); digits 0-9, Latin units (`kcal`, `g`); steppers stay LTR; no glued strings (`t("...",{n})` only).
- Defaults must not change anyone's numbers: no `activity` and no `adjust` = factor 1.2 and `GOAL_ADJ[goal]`.
- `activity` is one of `sitting | light | active | very`; `adjust` is an integer from -1000 to 1000. Anything else is ignored (treated as unset).
- Factors: sitting 1.2, light 1.3, active 1.4, very 1.5.
- Round-trip rule: a new profile field must be carried by the profile form save, `mergeProfile`, `cleanProfile` (backup) or it is silently dropped.
- Targets 44px minimum, text 12px minimum (tests-ui checks both). Bump `VERSION` in `public/sw.js` to `iron-log-v43`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus
- `adjust` of 0 is a real choice ("no adjustment"), not "unset": use `Number.isInteger` and `!== undefined`, never truthiness.
- Saving the About-you form (`profile-form`) must keep `activity` and `adjust`; the Plan-my-training journey (`mergeProfile`) must too.
- A stale or hand-edited profile with `activity: "banana"` or `adjust: 5000` behaves like unset, in the app and in a restored backup.
- Weight or About-you data missing: the sheet must not show a breakdown with `NaN`/`null`, and must not offer the controls.
- Past days: Overview and badges use the same setting as Today (one source), so changing it moves them together.

---

### Task 1: Energy model and breakdown

**Files:**
- Modify: `public/energy.js`
- Test: `tests/energy.test.js`

**Interfaces:**
- Produces: `ACTIVITY` (`{sitting:1.2, light:1.3, active:1.4, very:1.5}`), `ACTIVITY_IDS` (its keys in that order), `ADJUST_MIN = -1000`, `ADJUST_MAX = 1000`, `activityFactor(activity) -> number` (unknown = 1.2), `goalAdjustment(goal, adjust) -> number`, `baselineBurn(bmr, activity?) -> number|null`, `dayEnergy({bmr, kg, goal, activity?, adjust?, workout, food})` (existing result plus `factor` and `adj`), `explainTarget({bmr, src, activity, goal, adjust, energy}) -> {rows, burned, target} | null`.
- `rows` is `[{id:"resting", kcal:bmr, src}, {id:"everyday", kcal:baseline, factor}, {id:"lifting", kcal:energy.lift}, {id:"cardio", kcal:energy.cardio}, {id:"goal", kcal:adj, custom:boolean}]`; `src` is `"inbody"` or `"formula"` as returned by `bmrFor`.

- [ ] **Step 1: Write the failing tests** in `tests/energy.test.js` (import the new names):
  - `activityFactor`: `sitting 1.2, light 1.3, active 1.4, very 1.5`; `undefined`, `"banana"`, `null` give `1.2`.
  - `goalAdjustment("fat-loss")` is `-450`; `goalAdjustment("fat-loss", -300)` is `-300`; `goalAdjustment("fat-loss", 0)` is `0` (zero is a choice); `5000`, `-1001`, `12.5`, `"200"`, `NaN` fall back to `-450`; unknown goal with no adjust is `0`.
  - `baselineBurn(1700)` is `2040`; `baselineBurn(1700, "light")` `2210`; `baselineBurn(1700, "very")` `2550`; `baselineBurn(null, "light")` is `null`.
  - `dayEnergy` with `bmr:1700, kg:80, goal:"fat-loss"`, no workout, no food: unchanged result without new inputs (`baseline 2040`, `target 1590`, `factor 1.2`, `adj -450`); with `activity:"active", adjust:-300` it is `baseline 2380`, `target 2080`, `factor 1.4`, `adj -300`.
  - `explainTarget`: for the case above with one cardio session and a workout, rows come back in the order resting, everyday, lifting, cardio, goal with `custom:true` on the goal row when `adjust` was valid, `burned` equals everyday+lifting+cardio and `target` equals `burned + adj`; it returns `null` when `energy.target` is `null`.
- [ ] **Step 2: Run to verify they fail.** Run: `node --test tests/energy.test.js`. Expected: FAIL (new exports missing).
- [ ] **Step 3: Implement in `public/energy.js`.** Replace `BASELINE_FACTOR` use with `activityFactor`; `baselineBurn(bmr, activity)` multiplies `bmr * activityFactor(activity)` and rounds; `goalAdjustment` uses `Number.isInteger(adjust) && adjust >= ADJUST_MIN && adjust <= ADJUST_MAX`; `dayEnergy` accepts `activity` and `adjust`, uses them, and returns `factor` and `adj` beside the existing keys; `explainTarget` builds the rows from `energy` (it recomputes nothing).
- [ ] **Step 4: Run to verify they pass.** Run: `npm test`. Expected: all pass (existing energy tests unchanged).
- [ ] **Step 5: Commit.** `git add public/energy.js tests/energy.test.js && git commit -m "feat: activity level, own daily adjustment and target breakdown in energy.js"`

### Task 2: Callers and the profile round trip

**Files:**
- Modify: `public/achievements.js` (line with `dayEnergy`, ~219), `public/overview.js` (~43), `public/backup.js` (`cleanProfile`), `public/index.html` (`energyView`, the `profile-form` submit branch)
- Test: `tests/achievements.test.js`, `tests/overview.test.js`, `tests/backup.test.js`, `tests/plan-tools.test.js`

**Interfaces:**
- Consumes: Task 1 `dayEnergy` inputs.
- Produces: profile fields `activity`, `adjust` handled everywhere a profile is cleaned, merged or saved.

- [ ] **Step 1: Write the failing tests.**
  - `tests/backup.test.js`: a profile item with `activity:"active", adjust:-300` comes back with both; `activity:"banana"` and `adjust:5000`, `adjust:12.5` are dropped (keys absent); a profile without them comes back exactly as before (no new keys); `adjust:0` is kept.
  - `tests/plan-tools.test.js`: `mergeProfile({sex:"male", height:180, birthYear:1998, goal:"muscle", activity:"light", adjust:100}, {goal:"fat-loss"})` still has `activity:"light"` and `adjust:100`.
  - `tests/overview.test.js` and `tests/achievements.test.js`: find the existing case that exercises a calorie target; add a case with the same data and `profile.activity:"very"` showing a different (higher) target outcome than without it, and one with `adjust` proving the profile fields reach `dayEnergy` (pick the smallest observable output of each module; read the existing test to choose the assertion).
- [ ] **Step 2: Run to verify they fail.** Run: `npm test`. Expected: FAIL on the new cases only.
- [ ] **Step 3: Implement.** In `achievements.js` and `overview.js` pass `activity: p.activity, adjust: p.adjust` to `dayEnergy`. In `cleanProfile` add: `if (ACTIVITY_IDS.includes(d.activity)) out.activity = d.activity;` and `if (Number.isInteger(d.adjust) && d.adjust >= ADJUST_MIN && d.adjust <= ADJUST_MAX) out.adjust = d.adjust;` (import from `energy.js`). In `index.html`: `energyView` passes `activity:p.activity, adjust:p.adjust`; in the `profile-form` branch carry them over after building `p` (`if(state.profile.activity!==undefined) p.activity=state.profile.activity;` and the same for `adjust`).
- [ ] **Step 4: Run to verify they pass.** Run: `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat: activity and adjust flow through every energy caller, backup and the profile form"`

### Task 3: The target sheet

**Files:**
- Modify: `public/index.html` (markup near the other `<dialog class="sheet">`, `todayCard`, sheet registry, click handler), `public/lang-ar.js`
- Test: `tests-ui/smoke.test.mjs` (Task 4 writes the tests first; this task makes them pass)

**Interfaces:**
- Consumes: Task 1 `explainTarget`, `ACTIVITY_IDS`, `ADJUST_MIN/MAX`, `goalAdjustment`; `energyView()` returns `{p,kg,e,missing}`; `bmrFor` for the source (add `b` to the object returned by `energyView`).
- Produces: `<dialog id="targetsheet" class="sheet" aria-label="Your daily target">`, functions `targetSheetHtml()` and `saveTargetPrefs(patch)`, actions `target-open`, `target-activity` (`data-id`), `target-adjust` (`data-d` = `-50` or `50`), `target-adjust-reset`.

- [ ] **Step 1 (tests first): do Task 4 Step 1 now and run it to see the UI tests fail** (`cd tests-ui && node --test --test-name-pattern="target sheet" smoke.test.mjs`; Expected: FAIL, no link/sheet yet).
- [ ] **Step 2: Wire the sheet like the others.** Add the `<dialog id="targetsheet">` next to `#plansheet`; add `#targetsheet` to: `sheetHtml(id)`, `refreshSheets()` (redraw while open), the `["#exsheet",...]` close/backdrop loop, the `popstate` list, and the `sheet-close` case.
- [ ] **Step 3: Link on Today.** In `todayCard`, after the `eatsum` button and only when `e.target!=null`, add `<button type="button" class="btn ghost small" data-act="target-open">How is this built?</button>`. Case `target-open`: `openSheet("#targetsheet")`.
- [ ] **Step 4: `targetSheetHtml()`.** Header with title "Your daily target" and the ✕ close button (same markup as the other sheets). If `missing` is not empty show that message and nothing else. Otherwise, from `explainTarget(...)`: one row per part with plain labels ("Resting rate" + source line "InBody scan, {date}" using the scan's date or "Estimated from your height, weight and age"; "Everyday ×{factor}"; "Lifting"; "Cardio"; "Goal adjustment" + "your own" when `custom`), then "Burned" and "Target". Then "Everyday activity" as four `aria-pressed` chips with examples ("Mostly sitting: desk job, studying", "Light: on your feet some of the day", "Active: on your feet most of the day", "Very active: physical work"), then "Daily adjustment" with − / value / + buttons (LTR group), a "Use goal default" button (shown only when `adjust` is set) and the line "Changing these also changes how past days are judged." Numbers via `kcalTxt`/`toLocaleString("en-US")`; signed values use `signedTxt`.
- [ ] **Step 5: Actions.** `saveTargetPrefs(patch)`: build `{...state.profile, ...patch}`, delete keys whose patch value is `undefined`, `store.saveProfile(next)`, then `renderLog()` and redraw `#targetsheet`. `target-activity`: set `activity` (picking "sitting" stores `"sitting"`). `target-adjust`: current = `goalAdjustment(p.goal, p.adjust)`, new = clamp(current + d, `ADJUST_MIN`, `ADJUST_MAX`). `target-adjust-reset`: patch `{adjust: undefined}`.
- [ ] **Step 6: Arabic.** Add every new string to `lang-ar.js` (run `npm test`; it lists what is missing): the link, title, all row labels and notes, the four activity names and examples, "Daily adjustment", "Use goal default", "your own", the past-days line. Keep `{placeholders}` identical.
- [ ] **Step 7: Run.** `npm test` then the UI target-sheet tests. Expected: PASS.
- [ ] **Step 8: Commit.** `git add -A && git commit -m "feat: target sheet with breakdown, activity level and own daily adjustment"`

### Task 4: UI tests, docs, release

**Files:**
- Modify: `tests-ui/smoke.test.mjs`, `public/sw.js`, `CLAUDE.md`, `docs/README.md`, `docs/open-points.md`

**Interfaces:**
- Consumes: Task 3 actions and ids. Read the harness fixtures first (`tools/screenshot-harness`, the `mine=1` data) to know the profile, weight and body entries the Today card already uses.

- [ ] **Step 1: Write the UI tests** (names start with `target sheet:`): (a) the link opens `#targetsheet`, the visible Burned and Target numbers equal the numbers on the Today card; (b) choosing "Active" raises the Target on the card by `round(bmr*0.2)` kcal (compute from the harness bmr/weight), and a reload of the page state keeps the choice (profile saved); (c) `+` changes the adjustment by 50, `−` back, "Use goal default" restores the goal value and hides itself; (d) with `adjust` at the goal value of `0` ("maintain") the control still shows `0` and a custom marker only when explicitly set; (e) saving the About-you form (Progress › Body edit) keeps `activity` and `adjust`; (f) with no weight logged the sheet shows the fill-in message and no controls; (g) Arabic: sheet opens, steppers keep LTR order.
- [ ] **Step 2: Run the whole suites.** `npm test`; `cd tests-ui && npm test` (one copy at a time). Expected: all pass.
- [ ] **Step 3: Docs and version.** `sw.js` `VERSION` to `iron-log-v43`. CLAUDE.md: `energy.js` entry (activity, `explainTarget`), the data-model `profile` row (`activity?`, `adjust?`), the "Target model" bullet and the Food and energy card bullet (link and sheet). `docs/README.md`: add sub-project 20 with spec and plan links. `docs/open-points.md`: mark the explainer done.
- [ ] **Step 4: Commit.** `git add -A && git commit -m "docs, tests and sw v43 for the calorie target explainer"`
