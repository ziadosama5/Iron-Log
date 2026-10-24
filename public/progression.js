// Set types, targets and "what to try today". Pure: no DOM, no Firebase; unit-tested in tests/progression.test.js.
//
// A set is {w, r, t?, k?}. k = "w" warm-up, "d" drop set, absent = normal.
//   normal  : counts everywhere
//   warm-up : not in PRs, best sets, volume, sets per muscle, progression, "last time" or prefill
//   drop set: counts as volume and sets per muscle, but not for PRs, best sets, progression, "last time" or prefill
import { muscleOf } from "./exercise-library.js";

export const SET_TYPES = ["normal", "warmup", "drop"];
export const setType = s => (s && s.k === "w" ? "warmup" : s && s.k === "d" ? "drop" : "normal");
export const kOf = type => (type === "warmup" ? "w" : type === "drop" ? "d" : undefined);

export const isWorking = s => setType(s) === "normal";
export const countsForVolume = s => setType(s) !== "warmup";
export const countsAsSet = s => setType(s) !== "warmup";
const only = (sets, keep) => (Array.isArray(sets) ? sets.filter(keep) : []);
export const workingSets = sets => only(sets, isWorking);
export const volumeSets = sets => only(sets, countsForVolume);
export const countedSets = sets => only(sets, countsAsSet);

// ---- targets: {sets, min, max} per exercise ----
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
export function validTarget(t) {
  return !!t && typeof t === "object" && !Array.isArray(t) && int(t.sets, 1, 10) && int(t.min, 1, 50) && int(t.max, 1, 50) && t.min <= t.max;
}
// The valid entries of a saved targets object, as plain {sets, min, max}. Keys are exercise names (up to 80 characters).
export function cleanTargets(obj) {
  const out = {};
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (k === "__proto__" || !k || k.length > 80 || !validTarget(v)) continue;
    out[k] = { sets: v.sets, min: v.min, max: v.max };
  }
  return out;
}

// Same groups the rest timer uses for its 3:00 default (workout-tools.js defaultRest); a test pins the agreement.
const BIG = /squat|deadlift|\brdl\b|bench press|overhead press|military press|leg press/i;
const ISOLATION_NAME = /raise|fly|flye|curl|extension|pushdown|kickback|shrug|crunch/i;
const ISOLATION_MUSCLE = ["Biceps", "Triceps", "Calves", "Core"];
export function defaultTarget(exName) {
  const name = String(exName ?? "");
  if (BIG.test(name) && !/calf/i.test(name)) return { sets: 3, min: 5, max: 8 };
  if (ISOLATION_MUSCLE.includes(muscleOf(name)) || ISOLATION_NAME.test(name)) return { sets: 3, min: 10, max: 15 };
  return { sets: 3, min: 8, max: 12 };
}
export function targetFor(settings, exName) {
  const all = settings && settings.targets;
  const saved = all && typeof all === "object" && Object.hasOwn(all, exName) ? all[exName] : null;
  return validTarget(saved) ? saved : defaultTarget(exName);
}

// Smallest sensible jump: 5 kg for the big lower-body and barbell back lifts, 2.5 kg for everything else.
const BIG_STEP = /squat|deadlift|leg press|hip thrust|rack pull|good morning|(barbell|t-bar|smith machine) row/i;
const SMALL_STEP = /dumbbell|goblet|single-leg|one-arm/i;
export function stepFor(exName) {
  const name = String(exName ?? "");
  return BIG_STEP.test(name) && !SMALL_STEP.test(name) ? 5 : 2.5;
}

// Double progression on the previous session of an exercise (its sets), working sets only, judged at the heaviest weight:
//   every target set at that weight reached the top of the range -> add weight and start at the bottom of the range;
//   best rep count below the range                                -> same weight, build up to the bottom of the range;
//   otherwise                                                      -> same weight, one more rep than the weakest set.
// null when there is nothing to judge (no working sets, or no weight such as a bodyweight exercise).
const round2 = x => Math.round(x * 100) / 100;
export function suggestNext({ last, target, step }) {
  const ws = workingSets(last);
  if (!ws.length || !validTarget(target)) return null;
  const top = Math.max(...ws.map(s => s.w));
  if (!(top > 0)) return null;
  const atTop = ws.filter(s => s.w === top);
  if (atTop.length >= target.sets && atTop.every(s => s.r >= target.max)) return { kind: "increase", w: round2(top + (step || 2.5)), r: target.min };
  if (Math.max(...atTop.map(s => s.r)) < target.min) return { kind: "hold", w: top, r: target.min, low: true };
  return { kind: "hold", w: top, r: Math.min(target.max, Math.min(...atTop.map(s => s.r)) + 1) };
}
