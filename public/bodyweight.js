// Bodyweight exercises: which ones are, how a set is scored, how a load is shown. Pure: no DOM, no Firebase;
// unit-tested in tests/bodyweight.test.js. (Imports only the exercise library; it must not import progression.js.)
//
// On a bodyweight exercise the weight of a set is EXTRA kg: 0 = just the body, +10 a weighted pull-up, -20 an assisted one.
// A workout entry records `bw: true` when its first set is logged, so statistics never need the settings.
import { equipmentOf } from "./exercise-library.js";

// Stations a bodyweight exercise may need; any weights or machine (other than the assisted one) make it a weighted lift.
export const BW_STATIONS = ["bench", "decline-bench", "pullup-bar", "dip-station", "captains-chair", "box", "ab-wheel", "hyper-bench", "assisted-machine"];

// Library exercises whose every needed item is a station above (none at all counts). Typed (custom) exercises are weighted.
export function bwDefault(name) {
  const eq = equipmentOf(String(name ?? ""));
  return !!eq && eq.every(id => BW_STATIONS.includes(id));
}

// Isometric holds: their "reps" are seconds.
export const isHold = name => /plank|wall sit/i.test(String(name ?? ""));

// A saved override ({exercise: boolean}) wins over the library default; only the person's own keys count.
export function bwFor(settings, name) {
  const o = settings && settings.bodyweight;
  return o && typeof o === "object" && Object.hasOwn(o, name) && typeof o[name] === "boolean" ? o[name] : bwDefault(name);
}

// The valid entries of a saved overrides object. Keys are exercise names (1-80 characters), at most 300.
export function cleanBodyweight(obj) {
  const out = {};
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (k === "__proto__" || !k || k.length > 80 || typeof v !== "boolean") continue;
    out[k] = v;
    if (Object.keys(out).length >= 300) break;   // a settings document must stay small
  }
  return out;
}

// Extra load that counts as lifted (volume): never negative, so assisted and plain bodyweight sets add nothing.
export const loadKg = set => Math.max(0, Number(set && set.w) || 0);

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
// One comparable number per set: more extra kg first, then more reps (less assistance is "more kg" on the negative side).
// Always positive, so it can sit next to Math.max(0, ...).
export const bwScore = set => (clamp(Number(set && set.w) || 0, -500, 2000) + 500) * 1000 + clamp(Number(set && set.r) || 0, 1, 999);

// The best of the sets it is given (callers pass working sets only), or null.
export function bestBwSet(sets) {
  if (!Array.isArray(sets) || !sets.length) return null;
  return sets.reduce((best, s) => (bwScore(s) > bwScore(best) ? s : best));
}

// "BW", "+10", "−20" (a real minus sign). The label is passed in so the caller can translate it.
export function formatLoad(w, bwLabel = "BW") {
  const n = Math.round((Number(w) || 0) * 100) / 100;
  return n === 0 ? bwLabel : n > 0 ? "+" + n : "−" + Math.abs(n);
}

// A session logged before bodyweight mode (no bw flag) of a bodyweight exercise: its reps are real, but what the weight meant is
// unknown (people typed 0, their body weight or a real extra load), so it counts as plain bodyweight: weight 0. The input is not changed.
export function legacyBodyweight(session) {
  return { ...session, sets: (session.sets || []).map(s => ({ ...s, w: 0 })) };
}
