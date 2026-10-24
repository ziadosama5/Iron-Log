// Achievements: streaks, badges, XP levels and goal progress, all derived from logged data.
// Pure functions (no DOM/Firebase), unit-tested in tests/achievements.test.js.
import { trainedOn } from "./workout-tools.js";
import { exerciseKcal, weightOn, dayEnergy, bmrFor } from "./energy.js";
import { workingSets, volumeSets, isWorking } from "./progression.js";

const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function addDays(date, n) { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); }
export const e1rm = (w, r) => (r <= 0 || w <= 0 ? 0 : r === 1 ? w : w * (1 + r / 30));

/* ---------- weeks and streaks ---------- */

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
    const best = Math.max(0, ...workingSets(e.sets).map(s => e1rm(s.w, s.r)));   // warm-ups and drop sets are never a lift's best
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

/* ---------- badges ---------- */

export const BADGES = [
  { id: "workouts-1", name: "First workout", group: "milestone", metric: "workouts", target: 1 },
  { id: "workouts-10", name: "10 workouts", group: "milestone", metric: "workouts", target: 10 },
  { id: "workouts-50", name: "50 workouts", group: "milestone", metric: "workouts", target: 50 },
  { id: "workouts-100", name: "100 workouts", group: "milestone", metric: "workouts", target: 100 },
  { id: "workouts-250", name: "250 workouts", group: "milestone", metric: "workouts", target: 250 },
  { id: "kcal-10k", name: "10k kcal burned", group: "milestone", metric: "kcal", target: 10000 },
  { id: "kcal-50k", name: "50k kcal burned", group: "milestone", metric: "kcal", target: 50000 },
  { id: "kcal-100k", name: "100k kcal burned", group: "milestone", metric: "kcal", target: 100000 },
  { id: "cardio-1000", name: "1,000 cardio minutes", group: "milestone", metric: "cardioMin", target: 1000 },
  { id: "cardio-5000", name: "5,000 cardio minutes", group: "milestone", metric: "cardioMin", target: 5000 },
  { id: "goal-first-kg", name: "First kg", group: "milestone", metric: "goalKg", target: 1 },
  { id: "goal-reached", name: "Goal reached", group: "milestone", metric: "goalReached", target: 1 },
  { id: "streak-4", name: "4-week streak", group: "streak", metric: "streak", target: 4 },
  { id: "streak-12", name: "12-week streak", group: "streak", metric: "streak", target: 12 },
  { id: "streak-26", name: "26-week streak", group: "streak", metric: "streak", target: 26 },
  { id: "food-7", name: "7-day food streak", group: "streak", metric: "foodStreak", target: 7 },
  { id: "food-30", name: "30-day food streak", group: "streak", metric: "foodStreak", target: 30 },
  { id: "pr-1", name: "First PR", group: "strength", metric: "prs", target: 1 },
  { id: "pr-10", name: "10 PRs", group: "strength", metric: "prs", target: 10 },
  { id: "bench-bw", name: "Bodyweight bench", group: "strength", metric: "bench", target: 1 },
  { id: "squat-1.5", name: "1.5× bodyweight squat", group: "strength", metric: "squat", target: 1.5 },
  { id: "deadlift-2", name: "2× bodyweight deadlift", group: "strength", metric: "deadlift", target: 2 },
  { id: "volume-100t", name: "100 t lifted", group: "strength", metric: "volume", target: 100000 },
  { id: "volume-1000t", name: "1,000 t lifted", group: "strength", metric: "volume", target: 1000000 },
];
const RATIO_LIFTS = { bench: "bench press", squat: "squat", deadlift: "deadlift" };

const HOLD_KG = 0.5; // a target this close to the start weight means "hold", not lose/gain

// Start weight for a goal: the weight on or before goalStart, else the first one logged after it
// (people often set the target before their first weigh-in).
export function startWeight(body, goalStart) {
  const before = weightOn(body, goalStart);
  if (before != null) return before;
  const after = (body || []).filter(b => typeof b.weight === "number" && b.date > goalStart).sort((a, b) => (a.date < b.date ? -1 : 1));
  return after.length ? after[0].weight : null;
}

function goalInfo(profile, body) {
  const p = profile || {};
  if (p.goalWeight == null || !p.goalStart) return null;
  const start = startWeight(body, p.goalStart);
  if (start == null || Math.abs(p.goalWeight - start) < HOLD_KG) return null;
  return { start, goal: p.goalWeight, from: p.goalStart, lose: p.goalWeight < start };
}

// Replays history day by day; a badge's earned date is the first day its metric reached the target.
// Streak values can drop again, so locked streak badges show the current streak.
export function badges({ workouts = [], body = [], food = {}, days = [], profile = {}, today }) {
  const ws = workouts.filter(w => w.date <= today);
  const byDate = new Map(ws.map(w => [w.date, w]));
  const prs = new Map();
  prEvents(ws).forEach(e => prs.set(e.date, (prs.get(e.date) || 0) + 1));
  const bodyOn = new Map(body.filter(b => typeof b.weight === "number").map(b => [b.date, b.weight]));
  const dates = [...new Set([...ws.map(w => w.date), ...body.map(b => b.date), ...Object.keys(food || {}), today])]
    .filter(d => d <= today).sort();
  const N = weeklyTarget(days), g = goalInfo(profile, body);
  const weekCount = new Map();
  const m = { workouts: 0, kcal: 0, cardioMin: 0, volume: 0, prs: 0, bench: 0, squat: 0, deadlift: 0, goalKg: 0, goalReached: 0, streak: 0, foodStreak: 0 };
  const earned = {};
  // Running values carried from day to day (recounting them for every day was quadratic).
  const weights = [...bodyOn].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  let wi = 0, kg = null;                    // latest weight on or before the day
  let week = null, finishedChain = 0;       // qualifying weeks in a row before the current week
  let lastMealDay = null, mealRun = 0;      // consecutive days with meals
  for (const d of dates) {
    while (wi < weights.length && weights[wi][0] <= d) kg = weights[wi++][1];
    const wk = weekKey(d);
    if (wk !== week) {
      finishedChain = week !== null && addDays(week, 7) === wk && (weekCount.get(week) || 0) >= N ? finishedChain + 1 : 0;
      week = wk;
    }
    if (hasMeals(food, d)) { mealRun = lastMealDay === addDays(d, -1) ? mealRun + 1 : 1; lastMealDay = d; }
    const w = byDate.get(d);
    if (w && trainedOn(w)) {
      m.workouts++;
      weekCount.set(wk, (weekCount.get(wk) || 0) + 1);
      m.kcal += exerciseKcal(w, kg).total || 0;
      m.cardioMin += (w.cardio || []).reduce((a, c) => a + (c.min || 0), 0);
      (w.entries || []).forEach(e => volumeSets(e.sets).forEach(s => {   // volume: normal + drop sets; strength ratios: normal sets
        m.volume += s.w * s.r;
        if (kg && isWorking(s)) for (const [metric, name] of Object.entries(RATIO_LIFTS)) {
          if (String(e.ex).toLowerCase() === name) m[metric] = Math.max(m[metric], s.w / kg);
        }
      }));
    }
    m.prs += prs.get(d) || 0;
    // Training streak as of this day: qualifying weeks before this one, plus this week once it is met.
    m.streak = finishedChain + ((weekCount.get(wk) || 0) >= N ? 1 : 0);
    // Food streak as of this day: ends today, or yesterday when today has no meals yet.
    m.foodStreak = lastMealDay === d || lastMealDay === addDays(d, -1) ? mealRun : 0;
    if (g && d >= g.from && bodyOn.has(d)) {
      const wt = bodyOn.get(d);
      m.goalKg = Math.max(m.goalKg, g.lose ? g.start - wt : wt - g.start);
      if (g.lose ? wt <= g.goal : wt >= g.goal) m.goalReached = 1;
    }
    for (const b of BADGES) if (!earned[b.id] && m[b.metric] >= b.target - 1e-9) earned[b.id] = d;
  }
  return BADGES.map(b => ({ id: b.id, name: b.name, group: b.group, earned: earned[b.id] || null, value: m[b.metric], target: b.target }));
}

/* ---------- XP and levels ---------- */

const TITLES = [[15, "Iron"], [10, "Committed"], [5, "Regular"], [1, "Rookie"]];
const levelXp = L => 50 * L * (L - 1);

export function levelFor(xp) {
  let L = 1;
  while (xp >= levelXp(L + 1)) L++;
  return { level: L, title: TITLES.find(([min]) => L >= min)[1], into: xp - levelXp(L), needed: levelXp(L + 1) - levelXp(L) };
}

export function xpSummary({ workouts = [], food = {}, today }, badgeList) {
  const items = [];
  const ws = workouts.filter(w => w.date <= today);
  ws.forEach(w => {
    if (trainedOn(w)) items.push({ date: w.date, xp: 50 });
    (w.cardio || []).forEach(c => items.push({ date: w.date, xp: Math.min(30, 10 + Math.floor((c.min || 0) / 5)) }));
  });
  Object.keys(food || {}).filter(d => d <= today && hasMeals(food, d)).forEach(d => items.push({ date: d, xp: 10 }));
  prEvents(ws).forEach(e => items.push({ date: e.date, xp: 20 }));
  (badgeList || []).filter(b => b.earned).forEach(b => items.push({ date: b.earned, xp: 100 }));
  const xp = items.reduce((a, i) => a + i.xp, 0), wk = weekKey(today);
  return { ...levelFor(xp), xp, weekXp: items.filter(i => weekKey(i.date) === wk).reduce((a, i) => a + i.xp, 0) };
}

/* ---------- goal progress ---------- */

const KCAL_PER_KG = 7700, FINISH_WINDOW = 14, MIN_AVG = 50;
const clamp01 = v => Math.max(0, Math.min(1, v));

export function goalProgress({ workouts = [], body = [], food = {}, profile = {}, today }) {
  const p = profile || {};
  if (p.goalWeight == null || !p.goalStart) return null;
  const start = startWeight(body, p.goalStart);
  if (start == null) return { needsStartWeight: true };
  if (Math.abs(p.goalWeight - start) < HOLD_KG) return { hold: true };
  const target = Math.round((p.goalWeight - start) * KCAL_PER_KG);
  const balances = [];
  let totalDays = 0;
  for (let d = p.goalStart; d <= today; d = addDays(d, 1)) {
    totalDays++;
    if (!hasMeals(food, d)) continue;
    const b = bmrFor(p, body, d);
    const e = dayEnergy({ bmr: b ? b.bmr : null, kg: weightOn(body, d), goal: p.goal, activity: p.activity, adjust: p.adjust, workout: workouts.find(w => w.date === d) || null, food: food[d] });
    if (e.balance != null) balances.push(e.balance);
  }
  const bank = balances.reduce((a, x) => a + x, 0);
  const now = weightOn(body, today);
  const recent = balances.slice(-FINISH_WINDOW);
  const avg = recent.length ? recent.reduce((a, x) => a + x, 0) / recent.length : 0;
  const remaining = target - bank;
  // Direction is judged against the goal itself, so passing the target never reads as "moving away".
  const bankReached = Math.sign(remaining) !== Math.sign(target);
  const toward = avg !== 0 && Math.sign(avg) === Math.sign(target);
  const finish = !bankReached && toward && Math.abs(avg) >= MIN_AVG ? addDays(today, Math.round(remaining / avg)) : null;
  return {
    direction: p.goalWeight < start ? "lose" : "gain", start, now, goalWeight: p.goalWeight,
    bank, target, bankPct: clamp01(bank / target),
    weightPct: now == null ? 0 : clamp01((start - now) / (start - p.goalWeight)),
    loggedDays: balances.length, totalDays, finish, bankReached, awayFromGoal: !bankReached && avg !== 0 && !toward,
  };
}
