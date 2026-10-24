// Progress Overview: the series behind the headline numbers and graphs. Pure (no DOM/Firebase), unit-tested in tests/overview.test.js.
import { weekKey, addDays, weeklyTarget, e1rm, prEvents } from "./achievements.js";
import { trainedOn } from "./workout-tools.js";
import { weightOn, bmrFor, dayEnergy } from "./energy.js";

export const weeklyTargetFor = weeklyTarget;
// Key for the memoised Overview series: a different account, data revision or day must never reuse another's.
export const cacheKey = (uid, rev, today) => [uid || "", rev || 0, today].join("|");
const r1 = n => Math.round(n * 10) / 10;

// Trained days per Saturday-to-Friday week, `weeks` entries, oldest first, the last one is the week of `today`.
export function weeklyCounts(workouts, today, weeks = 8) {
  const cur = weekKey(today), byWeek = new Map();
  (workouts || []).filter(w => w.date <= today && trainedOn(w)).forEach(w => {
    const k = weekKey(w.date);
    if (!byWeek.has(k)) byWeek.set(k, new Set());
    byWeek.get(k).add(w.date);
  });
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(cur, -7 * (weeks - 1 - i));
    return { start, count: (byWeek.get(start) || new Set()).size };
  });
}

export function weightSeries(body, today, span = 90) {
  const from = addDays(today, -span);
  return (body || []).filter(e => typeof e.weight === "number" && Number.isFinite(e.weight) && e.date >= from && e.date <= today)
    .map(e => ({ date: e.date, weight: e.weight })).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Latest weight minus the latest weight on or before `span` days ago (null when either is missing).
export function weightChange(series, today, span = 28) {
  if (!series || !series.length) return null;
  const limit = addDays(today, -span), ref = series.filter(p => p.date <= limit).pop();
  return ref && series[series.length - 1].date > limit ? r1(series[series.length - 1].weight - ref.weight) : null;
}

// Seven days ending `today`: kcal eaten (null = no meals logged that day) and that day's target (null = unknown).
export function caloriesWeek(food, workouts, body, profile, today) {
  const p = profile || {};
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, -(6 - i)), f = (food && food[date]) || null, b = bmrFor(p, body, date);
    const e = dayEnergy({ bmr: b ? b.bmr : null, kg: weightOn(body, date), goal: p.goal, activity: p.activity, adjust: p.adjust, workout: (workouts || []).find(w => w.date === date) || null, food: f });
    return { date, eaten: f && (f.meals || []).length ? e.eaten : null, target: e.target };
  });
}

// The n most-trained lifts: best e1RM ever, and how it moved over the last 30 days against what came before.
export function topLifts(workouts, today, n = 3) {
  const by = new Map(), cut = addDays(today, -30);
  (workouts || []).filter(w => w.date <= today).forEach(w => (w.entries || []).forEach(e => {
    const best = Math.max(0, ...(e.sets || []).map(s => e1rm(s.w, s.r)));
    if (!best) return;
    const k = String(e.ex).toLowerCase();
    if (!by.has(k)) by.set(k, { ex: e.ex, list: [] });
    by.get(k).list.push({ date: w.date, best });
  }));
  return [...by.values()].map(({ ex, list }) => {
    const recent = list.filter(s => s.date > cut).map(s => s.best), older = list.filter(s => s.date <= cut).map(s => s.best);
    return { ex, best: r1(Math.max(...list.map(s => s.best))), change30: recent.length && older.length ? r1(Math.max(...recent) - Math.max(...older)) : null, sessions: list.length };
  }).sort((a, b) => b.sessions - a.sessions || (a.ex < b.ex ? -1 : a.ex > b.ex ? 1 : 0)).slice(0, n);
}

export function prsThisMonth(workouts, today) {
  const cut = addDays(today, -30);
  return prEvents(workouts).filter(e => e.date > cut && e.date <= today).length;
}
