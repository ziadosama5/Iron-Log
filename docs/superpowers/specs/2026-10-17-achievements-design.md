# Achievements — design

Date: 2026-10-17
Status: approved in chat, awaiting spec review
Part 2 of the "Coach improvements" request (part 1, calories and cardio, shipped as sw v9). Builds on `energy.js`.

## Goal

Keep people coming back with visible progress: a target-weight goal bar driven by the calorie balance, weekly training and daily food streaks, badges (milestones, streaks, strength) and XP levels, all on a new **Goals** tab, with a one-time toast when a badge is earned.

**Success criteria**
- With a target weight set, the Goals tab shows calorie-bank progress, weight progress and an estimated finish date.
- Badges, streaks and XP always match the logged data: editing or deleting a workout updates them.
- Each newly earned badge toasts exactly once across devices; existing badges never toast on first run.

**Constraints (unchanged)**
- No build step, no runtime dependencies, free Spark plan, offline-capable, 400px without horizontal scroll, light/dark tokens, plain short copy.
- Firestore rejects `undefined`.

## Decisions (from brainstorming)

- Goal bar measures progress to a **target weight**.
- All four achievement types: streaks, milestone badges, strength badges, levels/XP.
- New **Goals** tab (after Coach).
- **Approach A:** everything is derived from logged data on every render; the only stored state is which badges have been shown (`seenBadges`).

## Data model changes

- **Profile** (`profile` doc) gains optional `goalWeight` (kg, 30–300) and `goalStart` (`YYYY-MM-DD`). The Body tab profile form adds "Target weight · kg (optional)". Saving a changed `goalWeight` sets `goalStart` to today; clearing it removes both (stored as `null`).
- **Settings** (`settings` doc) gains `seenBadges: string[]` (badge ids). `store.saveSettings` writes the whole settings object (`{rest, seenBadges, updated}`) so neither field drops the other; the snapshot loads both (`seenBadges` stays `undefined` when the doc has never had it, which marks "first run").
- **Backup/restore:** `cleanBackupItems` keeps profile `goalWeight` (30–300) and `goalStart` (valid date string) and settings `seenBadges` (array of strings ≤ 40 chars, at most 200).

## Rules — `public/achievements.js` (pure, unit-tested)

Inputs: `{workouts, body, food, days, profile, today}` (the app's state shapes). Uses `trainedOn` (workout-tools.js), `exerciseKcal`, `weightOn`, `dayEnergy`, `bmrFor` (energy.js) and Epley `e1rm(w, r) = r === 1 ? w : w × (1 + r/30)`.

**Week:** Saturday to Friday; a week's key is its Saturday's date.

**Training target N:** the number of training days with at least one weekday assigned; if none, the number of training days; clamped to 2–6; 3 when there are no training days.

**Training streak:** consecutive weeks with ≥ N trained days (`trainedOn`), counted back from the most recent finished week; the current week is added when it already has ≥ N. Returns `{weeks, thisWeek: trainedDaysThisWeek, target: N}`.

**Food streak:** consecutive days with ≥ 1 meal, ending today, or ending yesterday when today has none yet.

**PRs:** per exercise (case-insensitive name), sessions in date order; a session is a PR when its best e1RM is higher than every earlier session's best and there are at least 2 earlier sessions. One PR per exercise per day.

**Badges** (id → rule; earned date = the first date the rule became true, replaying history in date order):

| id | name | rule |
|---|---|---|
| `workouts-1/10/50/100/250` | First workout / 10 / 50 / 100 / 250 workouts | count of trained days |
| `kcal-10k/50k/100k` | 10k / 50k / 100k kcal burned | Σ `exerciseKcal(w, weightOn(body, w.date)).total` over trained days (null skipped) |
| `cardio-1000/5000` | 1,000 / 5,000 cardio minutes | Σ cardio `min` |
| `goal-first-kg` | First kg | weight on a date ≥ `goalStart` is ≥ 1 kg from the start weight in the goal's direction |
| `goal-reached` | Goal reached | weight on a date ≥ `goalStart` reaches `goalWeight` (≤ for loss, ≥ for gain) |
| `streak-4/12/26` | 4 / 12 / 26-week streak | training streak length reached |
| `food-7/30` | 7 / 30-day food streak | food streak length reached |
| `pr-1/10` | First PR / 10 PRs | PR count |
| `bench-bw` | Bodyweight bench | a Bench Press set with `w ≥` weight on that date |
| `squat-1.5` | 1.5× bodyweight squat | a Squat set with `w ≥ 1.5 ×` weight on that date |
| `deadlift-2` | 2× bodyweight deadlift | a Deadlift set with `w ≥ 2 ×` weight on that date |
| `volume-100t/1000t` | 100 t / 1,000 t lifted | Σ `w × r` ≥ 100,000 / 1,000,000 kg |

Goal badges need `goalWeight` and `goalStart`. Strength-ratio badges need a weight on or before the lift date. Each badge also reports progress `{value, target}` for the locked view (e.g. 37 / 50).

**XP:** trained day +50; each cardio session +10 + 1 per 5 min (cardio part capped at +30 per session); day with ≥ 1 meal +10; each PR +20; each earned badge +100. Every XP item has a date.

**Levels:** level L needs `50 × L × (L − 1)` XP total (L2 = 100, L3 = 300, L4 = 600, L5 = 1,000). Titles: Rookie (1–4), Regular (5–9), Committed (10–14), Iron (15+). Returns `{level, title, xp, into, needed, weekXp}`.

**Goal progress** (`goalProgress`), when `goalWeight`, `goalStart` and a start weight (`weightOn(body, goalStart)`) exist and differ by ≥ 0.5 kg:
- `direction`: "lose" or "gain".
- Calorie bank: Σ `dayEnergy(...).balance` for each day from `goalStart` to today with ≥ 1 meal and a non-null balance; `target = (goalWeight − start) × 7700`; `pct = clamp(bank / target, 0, 1)`; also `loggedDays` and `totalDays`.
- Weight: `pct = clamp((start − now) / (start − goalWeight), 0, 1)` with `now` = latest weight.
- Finish estimate: average balance over the last 14 days with meals logged; when it points toward the goal and |avg| ≥ 50 kcal/day, `finish = today + (target − bank) / avg` days; otherwise `finish = null` and `awayFromGoal = true` if it points away.
- Otherwise `null` (the UI shows "Set a target weight", or "hold within ±1 kg" for an equal target).

## UI

**Tab:** "Goals", between Coach and Lifts.

**Goals tab:**
1. **Level card:** `Level 7 · Regular`, XP bar `into / needed`, `+120 XP this week`.
2. **Goal card:** two labelled bars, "Calorie bank −12,400 of −38,500 kcal" and "Weight 81.2 → 75 kg (40%)", plus `Based on 23 of 30 days with meals logged` and `Estimated finish: 12 Mar` or `At this pace you're moving away from your goal`. Without a goal: short text plus a **Set a target weight** button (opens the Body tab profile form).
3. **Streaks card:** `Training: 5 weeks` with this week's dots (●●○○ `2 of 4 this week`); `Food log: 9 days`.
4. **Badges:** earned first (name + earned date), then locked ones greyed with `value / target`. Each badge is a small tile with a simple CSS medal mark; no images.

**Toasts:** after every render caused by a data change, compute earned badge ids; ids not in `seenBadges` are shown as `Badge earned: <name>`, one at a time (≈2.6 s each), and saved to `seenBadges` in one settings write. **First run** (`seenBadges` undefined): store all currently earned ids without toasts. A badge lost (data deleted) and earned again later does not toast a second time.

## Error handling

- Missing data never throws; rules that need missing inputs simply aren't earned yet (progress shows what's needed).
- One settings write per batch of new badges.

## Testing

- **Unit (`npm test`):** week keys and N; training streak (in-progress week, broken week, cardio counts); food streak (today empty → from yesterday); PR detection; every badge rule incl. earned dates and ratio badges using weight on the lift date; XP totals and weekly XP; level thresholds and titles; goal progress (lose and gain, skipped days, finish estimate, away from goal, no goal); `cleanBackupItems` for the new profile/settings fields.
- **Mock renders** (real render functions, 400px, light + dark) of the Goals tab with and without a goal.
- **Manual (phone):** set a target weight; earn a badge (toast once; not again after reload or on a second device); delete a workout that earned a badge (badge goes back to locked); first run shows no toast storm.
- **Release:** sw VERSION bump, `achievements.js` in APP_SHELL, CLAUDE.md.
