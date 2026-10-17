// Achievements: streaks, badges, XP levels and goal progress, all derived from logged data.
// Pure functions (no DOM/Firebase), unit-tested in tests/achievements.test.js.
import { trainedOn } from "./workout-tools.js";

const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function addDays(date, n) { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); }
export const e1rm = (w, r) => (r <= 0 || w <= 0 ? 0 : r === 1 ? w : w * (1 + r / 30));

// Weeks run Saturday to Friday (Egypt); a week is named by its Saturday.
export function weekKey(date) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return iso(d);
}

// Trained days needed per week: days that have weekdays assigned, else all days; 2–6.
export function weeklyTarget(days) {
  if (!days || !days.length) return 3;
  const scheduled = days.filter(d => (d.weekdays || []).length).length;
  return Math.min(6, Math.max(2, scheduled || days.length));
}

function trainedDatesByWeek(workouts, today) {
  const byWeek = new Map();
  (workouts || []).filter(w => w.date <= today && trainedOn(w)).forEach(w => {
    const k = weekKey(w.date);
    if (!byWeek.has(k)) byWeek.set(k, new Set());
    byWeek.get(k).add(w.date);
  });
  return byWeek;
}

export function trainingStreak(workouts, days, today) {
  const target = weeklyTarget(days), byWeek = trainedDatesByWeek(workouts, today);
  const count = k => (byWeek.get(k) || new Set()).size;
  const cur = weekKey(today), thisWeek = count(cur);
  let weeks = 0;
  for (let k = addDays(cur, -7); count(k) >= target; k = addDays(k, -7)) weeks++;
  if (thisWeek >= target) weeks++;
  return { weeks, thisWeek, target };
}

const hasMeals = (food, d) => !!(food && food[d] && (food[d].meals || []).length);

export function foodStreak(food, today) {
  let d = hasMeals(food, today) ? today : addDays(today, -1), n = 0;
  while (hasMeals(food, d)) { n++; d = addDays(d, -1); }
  return n;
}

// A session is a PR when its best e1RM beats every earlier session and there were at least 2 earlier.
export function prEvents(workouts) {
  const byEx = new Map();
  [...(workouts || [])].sort((a, b) => (a.date < b.date ? -1 : 1)).forEach(w => (w.entries || []).forEach(e => {
    const best = Math.max(0, ...(e.sets || []).map(s => e1rm(s.w, s.r)));
    if (!best) return;
    const ex = String(e.ex).toLowerCase();
    if (!byEx.has(ex)) byEx.set(ex, []);
    byEx.get(ex).push({ date: w.date, best });
  }));
  const out = [];
  byEx.forEach((sessions, ex) => sessions.forEach((s, i) => {
    if (i >= 2 && s.best > Math.max(...sessions.slice(0, i).map(x => x.best))) out.push({ date: s.date, ex });
  }));
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
