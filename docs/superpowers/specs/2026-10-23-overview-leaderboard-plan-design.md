# Progress Overview, Friends leaderboard, calmer Plan page

Date: 2026-10-23. Status: design approved by the owner in chat; written for review.

## Why
After "less crowded" (sw v34) the owner said Today feels better, and asked for three more things: the Plan page is still crowded; Friends should be a leaderboard with a crown next to the first place; Progress should open with the analytics and graphs, an overall picture.

## Decisions (owner)
- Overview graphs: weight trend, training per week, calories vs target, strength and PRs (all four).
- Leaderboard ranking: a switch between **This week**, **This month** and **Level**.
- No data, rules or Firestore changes. Everything is drawn from data the app already has.

## 1. Progress Overview (new first section)
- New view id `overview`, first pill of the Progress tab: Overview · Body · Lifts · Goals · Coach · History (`nav.js`: TABS views, `PILL_LABEL`, `FIRST`; `migrateView` keeps old saved views valid; opening the Progress tab lands on Overview).
- Content, top to bottom:
  1. **Headline row** (4 small stats): current weight, change vs 4 weeks ago (kg), workouts this week, training streak (weeks).
  2. **Weight trend:** line chart of the last 90 days using the existing `lineChart()`. Taps through to Body.
  3. **Training per week:** 8 bars, one per Saturday-to-Friday week (`weekStart`), count of training days (`trainedOn`), plus the weekly target as a line (from `trainingStreak`'s target). Taps through to History.
  4. **Calories vs target:** 7 bars for the last 7 days (eaten) with the target line (`dayEnergy`); a day without meals has no bar. Taps through to Today.
  5. **Strength:** the 3 most-trained lifts, each with best estimated 1RM, its change over the last 30 days, and the count of PRs this month. Taps through to Lifts.
- Pure module `public/overview.js` (unit-tested) builds the series; the page only draws:
  - `weeklyCounts(workouts, days, today, weeks=8) -> [{start, count}]` oldest first.
  - `weightSeries(body, today, days=90) -> [{date, weight}]` and `weightChange(series, today, days=28) -> number|null`.
  - `caloriesWeek(food, workouts, body, profile, today) -> [{date, eaten, target}]` (7 days, `eaten:null` when no meals).
  - `topLifts(workouts, today, n=3) -> [{ex, best, change30, sessions}]` and `prsThisMonth` taken from the existing PR logic.
- Empty states: a graph with fewer than two points shows a one-line hint ("Log your weight on two days to see the trend") instead of a chart. A brand-new account sees the headline row and four hints, never a blank page.
- Charts are hand-written SVG like `lineChart()`; colours use `var(--accent)`, `--good`, `--muted`; no chart library. Each chart has a text summary for screen readers (`role="img"` + `aria-label`).

## 2. Friends leaderboard
- A segmented control at the top of Friends: **This week · This month · Level** (stored per device in `ironlog.board`, anything invalid = This week). Metrics come from the shared summaries: `weekCount` (stale-aware, already in friends.js), `workouts30`, and `level` (ties broken by `xp`).
- `rankBoard(me, friends, metric, today) -> [{uid, name, isMe, value, rank}]` in `friends.js` generalises `rankWeek` (which stays as the "week" case): ties share a rank, people with no usable summary are last with `rank:null`.
- Layout: the top 3 as a podium with a crown on first place (reuse the challenge podium markup and CSS: 2-1-3, ties share a step), then the rest as ranked rows (rank, avatar, name, value), you highlighted. Fewer than 3 people: podium shows who exists. The current "Who's ahead this week" strip is replaced by this board.
- Below it, unchanged: Requests banner, Friends list (tap = friend page), Manage, Invite card. The board is drawn only when there is at least one friend.

## 3. Plan page (Days) calmer
- The gym hint card becomes a one-line banner with "Set up" and a close button (same `ironlog.gymHint` dismissal).
- "Plan my training", "+ Add day" and "Change split" move into one **Edit plan** menu button (a small sheet with the three actions; Back closes it). The header row keeps the "Training days" title and that one button.
- The week strip is unchanged. Each day card shows name, muscle tags and exercises with one **Train this day** button; tapping the card opens Edit day (the separate "Edit day" button goes away).
- Journey and Days empty states are unchanged.

## Not changing
Firestore data and rules, the shared summary, badges and XP, the workout focus card, Today, Coach, Body, Lifts and History contents, My Gym.

## Files
`public/overview.js` (new, add to `APP_SHELL`), `public/nav.js`, `public/friends.js` (`rankBoard`), `public/index.html` (renderOverview, renderFriends, renderDays, an Edit plan sheet, CSS), `public/lang-ar.js`, `public/sw.js` (VERSION v35 + APP_SHELL), tests: `tests/overview.test.js`, `tests/friends.test.js`, `tests/nav.test.js`, `tests-ui/smoke.test.mjs`, CLAUDE.md and docs.

## Testing
- Unit: every `overview.js` function (week boundaries, missing data, DST-safe dates, empty inputs), `rankBoard` for the three metrics (ties, no summary, one person), nav pills and `migrateView`.
- `tests-ui`: Overview is the first Progress section and shows its charts and hint states, each card taps through to its section; leaderboard switch changes the order and the crown is on first place; Edit plan sheet opens, Back closes it, its actions work; day card tap opens the editor; 44px targets, 12px text, Arabic.
- Harness screenshots in light, dark and Arabic; owner tries it on the phone before any deploy.

## Risks
- Overview adds computation on every redraw: build the series only when `state.dataRev` changed (memoised) so Today and snapshots stay fast.
- Moving three Plan buttons into a menu adds one tap for "Add day"; the empty state keeps its direct buttons.
- Level ranking favours people who started earlier; that is why it is a switch and not the default.
