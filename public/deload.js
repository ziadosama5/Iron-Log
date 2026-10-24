// Deload weeks: when to suggest one, the 7-day window, the lighter weight and sets, and the stall rule Coach shares.
// Pure: no DOM, no Firebase; unit-tested in tests/deload.test.js.
//
// settings.deload = { start?, end?, dismissedUntil? } (all YYYY-MM-DD). `start` is the last accepted deload (kept after it
// ends: it drives the cooldown); `end` is the last day included, and may be the day before `start` (= cancelled on day 1);
// `dismissedUntil` silences the suggestion. A workout saved inside the window carries deload: true.
import { addDays, e1rm } from "./achievements.js";
import { workingSets } from "./progression.js";

export const DELOAD_DAYS = 7, DISMISS_DAYS = 28, COOLDOWN_DAYS = 42, STREAK_WEEKS = 6, STALLED_LIFTS = 3;
export const SET_FACTOR = 0.6, WEIGHT_FACTOR = 0.9;

const isDate = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;

export function cleanDeload(obj) {
  const o = obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {}, out = {};
  if (isDate(o.start)) {
    out.start = o.start;
    if (isDate(o.end) && o.end >= addDays(o.start, -1)) out.end = o.end;
  }
  if (isDate(o.dismissedUntil)) out.dismissedUntil = o.dismissedUntil;
  return out;
}

const windowOf = d => (d.start ? { start: d.start, end: d.end || addDays(d.start, DELOAD_DAYS - 1) } : null);
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);

// The running deload on `today` ({start, end, day 1..7}), or null.
export function activeDeload(deload, today) {
  const w = windowOf(cleanDeload(deload));
  if (!w || today < w.start || today > w.end) return null;
  return { start: w.start, end: w.end, day: daysBetween(w.start, today) + 1 };
}
// Whether a workout date falls inside the deload window (independent of today).
export function deloadDate(date, deload) {
  const w = windowOf(cleanDeload(deload));
  return !!w && date >= w.start && date <= w.end;
}

// Weighted exercises whose last 3 sessions did not beat what came before (needs 4 sessions). Warm-ups, drop sets, bodyweight
// entries and deload workouts are ignored; names are merged ignoring case. The same rule Coach uses.
export function stalledLifts(workouts) {
  const by = new Map();
  [...(workouts || [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).forEach(w => {
    if (w.deload === true) return;
    (w.entries || []).forEach(e => {
      if (e.bw === true) return;
      const best = Math.max(0, ...workingSets(e.sets).map(s => e1rm(s.w, s.r)));
      if (!best) return;
      const key = String(e.ex).toLowerCase();
      if (!by.has(key)) by.set(key, { name: e.ex, bests: [] });
      by.get(key).bests.push(best);
    });
  });
  const out = [];
  by.forEach(({ name, bests }) => {
    if (bests.length < 4) return;
    if (Math.max(...bests.slice(-3)) <= Math.max(...bests.slice(0, -3)) * 1.005) out.push(name);
  });
  return out;
}

// null, or why an easy week is worth suggesting: a long streak of finished weeks wins over stalled lifts.
export function suggestDeload({ deload, today, streakWeeks, stalled }) {
  const d = cleanDeload(deload);
  if (activeDeload(d, today)) return null;
  if (d.dismissedUntil && today <= d.dismissedUntil) return null;
  if (d.start && today < addDays(d.start, COOLDOWN_DAYS)) return null;
  if (streakWeeks >= STREAK_WEEKS) return { reason: "streak", weeks: streakWeeks };
  if (Array.isArray(stalled) && stalled.length >= STALLED_LIFTS) return { reason: "stalled", lifts: stalled.length };
  return null;
}

// About 90% of the heaviest weight, to the nearest 2.5 kg (halves go down), never above it and never below 2.5 kg.
export function deloadWeight(top) {
  if (!(top >= 2.5)) return top;
  return Math.min(top, Math.max(2.5, Math.ceil(top * WEIGHT_FACTOR / 2.5 - 0.5) * 2.5));
}
export const deloadSets = n => Math.max(1, Math.round(n * SET_FACTOR));

// The deload line for one exercise from its last normal session: weighted lifts get a lighter weight and the reps done at the
// top weight; bodyweight and holds only get a set count. null when there is nothing to base it on.
export function deloadAdvice({ last, target, bw = false, hold = false }) {
  const ws = workingSets(last);
  if (!ws.length) return null;
  const sets = deloadSets(target && target.sets ? target.sets : 3);
  if (bw || hold) return { sets };
  const top = Math.max(...ws.map(s => s.w));
  if (!(top > 0)) return null;
  return { w: deloadWeight(top), r: Math.max(...ws.filter(s => s.w === top).map(s => s.r)), sets };
}
