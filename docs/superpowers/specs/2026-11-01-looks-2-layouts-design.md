# Looks 2.0: real layouts for Carbon and Bloom (sub-project 27): design

Status: draft for the owner's review (2026-11-01). Branch `looks-2` (cut from `library-expansion`, which is cut from `workout-screen-2`). Nothing deployed; the live app is untouched.

## Why
Carbon and Bloom (sub-project 25) change colours, fonts and a few shapes, but every screen still has the old layout. The owner wants each look to feel like its own app: the layouts of the design-canvas boards (https://claude.ai/artifact/35ekGA7CkuEcnEQAtKJbDL: Carbon = a glanceable workout card with big weight/rep numbers and one large "Log set" button, flat full-width bar; Bloom = soft rounded cards, a floating bar, serif headings), for **every** screen.

## Decisions (owner, 2026-11-01)
1. **Different layouts per look.** Carbon and Bloom are two separate sets of screen layouts, not one layout with two skins.
2. **Every screen in both looks**: all five tabs (Today, Plan, Progress, Friends, Me), their sections, the sheets, the first-launch look picker and the journey. Classic stays exactly as it is today and remains the default.
3. **What each screen shows is decided per screen in the design phase** (the owner can cut or move things while looking at the drawing). The default rule until then: the same features exist in both looks, arranged differently.
4. **Design everything first, then build** (milestone M0 below), so the tabs, navigation, spacing and cards form one consistent system per look.
5. **One deploy at the end.** Looks are opt-in, so a half-finished look is never forced on anyone, but nothing ships until every milestone is done and tested.
6. Unchanged: the look is per device (`localStorage ironlog.look`), no stored-data change, no rules change, Arabic/RTL and light/dark in both looks, accent colours per look, the library, search and wearables plans.

## Approach: per-look layouts on one shared engine
- **Logic and data stay shared.** `state`, `store`, the delegated `data-act` handlers, `renderLog()` and the other `render*()` entry points are the single engine. A look only decides the **markup and CSS** of a screen.
- **Layout modules.** New `public/looks/carbon.js` and `public/looks/bloom.js` (loaded with `import()` only when that look is active, so Classic users download nothing extra). Each exports one pure HTML builder per screen/card, e.g. `todayHtml(ctx)`, `workoutCardHtml(ctx)`, `restBarHtml(ctx)`, `tabBarHtml(ctx)`, `progressOverviewHtml(ctx)`, ... Classic keeps the builders that live in `index.html` today.
- **Dispatch with fallback.** `LAYOUT = {classic: built-in, carbon, bloom}`; a render function asks `layoutFor(look).screen(ctx)` and falls back to the Classic builder (plus the look's CSS tokens) when a look has no version of that screen yet. This lets every milestone be tested on its own and keeps the screens that are not done working.
- **Context object.** Builders get a `ctx` with already-computed data and tiny helpers (`t`, `esc`, `nameOf`, `kg`, icons) and never touch `state`, Firestore or the DOM, so they stay unit-testable strings.
- **The action contract.** Every `data-act` of a Classic screen must exist in the Carbon and Bloom versions of that screen (a feature may be moved, never silently lost; a feature the owner explicitly removes is listed in the screen's design note and in the test's allow-list). A contract test renders each screen in the three looks with the same data and compares the sets of `data-act` values.
- **Layout CSS** lives in `public/looks-carbon.css` and `public/looks-bloom.css` (scoped `:root[data-look="..."]`), loaded when the look is active; `looks.css` keeps the shared tokens.

## Milestones (each covers both looks)
- **M0 Design.** Every screen and sheet, light and dark, English and Arabic samples, drawn on the design canvas for each look (about 25-30 screens: the five tab roots and their section pills, the workout card in its states (empty, logging, finished, rest running), Days editor, My Gym, Overview, Body, Lifts, Goals, Coach, History, Friends, friend page, Challenges, Find, Me, Appearance, and the sheets: Add exercise with search, info, food, cardio, target, demo viewer, look picker, journey steps). The owner approves or corrects screen by screen; the approved boards are the spec for the build and are linked from `docs/looks/`. **No code before this is approved.**
- **M1 Plumbing.** `layoutFor`, the module loading, `ctx` helpers, the contract test, per-look screenshot tests, the two tab bars (and the tab-bar state, swipe, safe areas).
- **M2 Today** (workout card and set rows, rest bar, demo, level hero, deload banner, food and energy card, look hint).
- **M3 Plan** (Days, My Gym, plan sheet). **M4 Progress** (Overview, Body, Lifts, Goals, Coach, History). **M5 Friends** (Friends, Challenges, Find, friend page). **M6 Me, sheets, picker, journey.**
- **M7 Polish and release gate.** Arabic/RTL and light/dark pass for every screen in both looks, 44 px targets and 12 px text, reduced motion, focus order, the final Opus review and fix pass, the owner's local test, then the one deploy.

## Tests
- **Contract test** (above) over every screen × look.
- **tests-ui per look:** the existing suite runs unchanged in Classic; a parametrised copy of the core flows (log a set, add an exercise, switch tabs, search, open sheets, Arabic) runs in Carbon and Bloom; the old selectors must keep working inside the new markup or the test is updated with a ledger note.
- **Screenshots:** the harness takes every screen in Classic, Carbon, Bloom × light/dark × en/ar at 360 px and 390 px, checked for horizontal overflow, 44 px targets and 12 px text by script; the owner reviews them against the approved boards.
- **Unit tests** for each builder (pure strings): states, empty data, long names, RTL.

## Risks and how they are handled
- **Three layouts to maintain** (every future feature touches three builders): the action contract test fails when a look misses a feature; new features are added to Classic first and the contract list shows what the looks still lack.
- **`index.html` size and merge risk:** layouts move out into modules rather than growing the file; extraction of Classic builders is not required (Classic stays put).
- **Size and speed:** look modules and CSS load only for the active look; a size guard test pins each module.
- **Design churn:** M0 approval per screen before M1, so rework is design edits, not code.
- **Arabic/RTL in two more layouts:** every builder is tested with `dir="rtl"`; logical CSS only.
- **Scope:** this is the largest sub-project so far (about two thirds of the UI); the milestones are internally reviewable and the final review is one Opus review of the whole branch plus a fix pass, as usual.

## Open items (answered inside M0, not now)
- Navigation shape per look (five tabs with a centre action? labels or icons only?).
- What Carbon's glance card shows by default and what moves behind a tap; what Bloom shows more of.
- Whether Today's watch card (Health Connect, later sub-project) gets a reserved slot in both Today layouts.
- Light/dark: Carbon is dark-first, Bloom light-first; both keep both modes.
