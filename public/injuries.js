// Injuries and exercises to avoid. Pure: no DOM, no Firebase, no imports; unit-tested in tests/injuries.test.js.
//
// A person marks body areas that hurt (AREAS) and single exercises to avoid. Every library exercise lists the joints it loads
// (JOINTS), so one area hides all the exercises that load it. The filter only trims suggestions; what the person already has
// (days, workouts, history) is never hidden or removed, only marked (avoidedBecause).

export const AREAS = ["shoulder", "elbow", "wrist", "lower-back", "hip", "knee", "ankle"];

// { "<library exercise>": [area ids in AREAS order] }, one entry per library exercise (an empty list is allowed).
export const JOINTS = {};

const MAX_EXERCISES = 100;
const norm = s => String(s ?? "").trim().toLowerCase();

// Lower-cased lookup of a joints table, built once per table.
const indexes = new WeakMap();
function indexOf(joints) {
  let ix = indexes.get(joints);
  if (!ix) { ix = new Map(Object.entries(joints).map(([name, areas]) => [name.toLowerCase(), areas])); indexes.set(joints, ix); }
  return ix;
}

// The areas an exercise loads; [] for custom or unknown names. A copy, so callers cannot change the table.
export function jointsOf(name, joints = JOINTS) {
  if (typeof name !== "string") return [];
  const areas = indexOf(joints).get(name.trim().toLowerCase());
  return areas ? [...areas] : [];
}

// Why a name is avoided: by name (exercise) and/or by the areas it loads, in AREAS order. Both empty = not avoided.
export function avoidedBecause(name, avoid, joints = JOINTS) {
  const a = avoid && typeof avoid === "object" ? avoid : {};
  const byName = Array.isArray(a.exercises) && a.exercises.some(x => norm(x) === norm(name));
  const chosen = new Set(Array.isArray(a.areas) ? a.areas : []);
  const areas = AREAS.filter(id => chosen.has(id) && jointsOf(name, joints).includes(id));
  return { exercise: byName, areas };
}

const isActive = avoid => !!avoid && typeof avoid === "object" && ((Array.isArray(avoid.areas) && avoid.areas.length > 0) || (Array.isArray(avoid.exercises) && avoid.exercises.length > 0));

// The names left after removing what the person avoids. Returns `names` itself when nothing is avoided.
export function avoidFilter(names, avoid, joints = JOINTS) {
  if (!isActive(avoid)) return names;
  return names.filter(n => { const w = avoidedBecause(n, avoid, joints); return !w.exercise && w.areas.length === 0; });
}

// How many names the filter removes over several lists (for the "Hiding N" note).
export function hiddenAvoidCount(lists, avoid, joints = JOINTS) {
  if (!isActive(avoid)) return 0;
  return lists.reduce((n, l) => n + (l.length - avoidFilter(l, avoid, joints).length), 0);
}

// A saved or restored avoid object, tidied: known areas in AREAS order without repeats, exercise names of 1-80 characters
// without repeats (case-insensitive, first spelling kept, at most 100). A key with nothing left is left out; junk gives {}.
export function cleanAvoid(obj) {
  const out = {};
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  if (Array.isArray(obj.areas)) {
    const chosen = new Set(obj.areas);
    const areas = AREAS.filter(id => chosen.has(id));
    if (areas.length) out.areas = areas;
  }
  if (Array.isArray(obj.exercises)) {
    const seen = new Set(), exercises = [];
    for (const x of obj.exercises) {
      if (typeof x !== "string") continue;
      const name = x.trim();
      if (!name || name.length > 80 || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase()); exercises.push(name);
      if (exercises.length >= MAX_EXERCISES) break;
    }
    if (exercises.length) out.exercises = exercises;
  }
  return out;
}
