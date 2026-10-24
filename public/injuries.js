// Injuries and exercises to avoid. Pure: no DOM, no Firebase, no imports; unit-tested in tests/injuries.test.js.
//
// A person marks body areas that hurt (AREAS) and single exercises to avoid. Every library exercise lists the joints it loads
// (JOINTS), so one area hides all the exercises that load it. The filter only trims suggestions; what the person already has
// (days, workouts, history) is never hidden or removed, only marked (avoidedBecause).

export const AREAS = ["shoulder", "elbow", "wrist", "lower-back", "hip", "knee", "ankle"];

export const AREA_EN = { shoulder: "Shoulder", elbow: "Elbow", wrist: "Wrist", "lower-back": "Lower back", hip: "Hip", knee: "Knee", ankle: "Ankle" };

// { "<library exercise>": [area ids in AREAS order] }, one entry per library exercise (an empty list is allowed).
// A joint is listed when the movement puts real load on it or holds it in a stressed position. Reviewed by the owner
// (docs/injury-tags.md is generated from this table: node tools/injury-review.mjs). Letters: shoulder, elbow, wrist,
// lower-back, hip, knee, ankle.
const [S, E, W, B, H, K, A] = AREAS;
export const JOINTS = {
  // Chest
  "Bench Press": [S, E, W], "Incline Barbell Press": [S, E, W], "Incline Dumbbell Press": [S, E, W], "Dumbbell Bench Press": [S, E, W],
  "Machine Chest Press": [S, E], "Dumbbell Fly": [S, E], "Cable Crossover": [S, E], "Push-up": [S, E, W], "Decline Bench Press": [S, E, W],
  "Pec Deck": [S], "Chest Dip": [S, E, W], "Decline Dumbbell Press": [S, E, W], "Incline Machine Press": [S, E],
  "Smith Machine Bench Press": [S, E, W], "Smith Machine Incline Press": [S, E, W], "Incline Dumbbell Fly": [S, E], "Low Cable Crossover": [S, E],
  "Cable Fly (Flat Bench)": [S, E], "Incline Push-up": [S, E, W], "Decline Push-up": [S, E, W], "Dumbbell Pullover": [S], "Dumbbell Floor Press": [S, E, W],
  // Back
  "Pull-up": [S, E, W], "Lat Pulldown": [S, E], "Barbell Row": [S, E, B], "One-arm Dumbbell Row": [S, E], "Seated Cable Row": [S, E],
  "T-bar Row": [S, E, B], "Chin-up": [S, E, W], "Deadlift": [W, B, H, K], "Barbell Shrug": [S, W], "Dumbbell Shrug": [S], "Straight-arm Pulldown": [S],
  "Back Extension": [B, H], "Close-grip Pulldown": [S, E], "Wide-grip Pull-up": [S, E, W], "Assisted Pull-up": [S, E, W], "Reverse-grip Pulldown": [S, E],
  "Underhand Barbell Row": [E, W, B], "Smith Machine Row": [S, E, B], "Chest-supported Dumbbell Row": [S, E], "Bent-over Dumbbell Row": [S, E, B],
  "Wide-grip Cable Row": [S, E], "One-arm Cable Row": [S, E], "Machine Row": [S, E], "Trap Bar Deadlift": [B, H, K], "Rack Pull": [W, B, H],
  "Cable Shrug": [S], "Smith Machine Shrug": [S], "Inverted Row": [S, E, W],
  // Shoulders
  "Overhead Press": [S, E, W, B], "Arnold Press": [S, E, W], "Lateral Raise": [S], "Rear Delt Fly": [S], "Face Pull": [S, E], "Upright Row": [S, W],
  "Machine Shoulder Press": [S, E], "Reverse Pec Deck": [S], "Dumbbell Shoulder Press": [S, E, W], "Seated Barbell Press": [S, E, W],
  "Seated Dumbbell Press": [S, E, W], "Smith Machine Shoulder Press": [S, E, W], "Push Press": [S, E, W, B], "Cable Lateral Raise": [S],
  "Machine Lateral Raise": [S], "Front Raise": [S], "Cable Front Raise": [S], "Cable Rear Delt Fly": [S], "Cable Upright Row": [S, W],
  "Dumbbell Upright Row": [S, W], "Barbell Rear Delt Row": [S, E, B], "Lying Rear Lateral Raise": [S],
  // Biceps
  "Barbell Curl": [E, W], "Dumbbell Curl": [E, W], "Hammer Curl": [E, W], "Preacher Curl": [E], "Incline Dumbbell Curl": [S, E], "Cable Curl": [E, W],
  "EZ-bar Curl": [E, W], "Concentration Curl": [E], "Cross-body Hammer Curl": [E, W], "Dumbbell Preacher Curl": [E], "Machine Biceps Curl": [E],
  "High Cable Curl": [S, E], "Rope Hammer Curl": [E, W], "Spider Curl": [E], "Reverse Curl": [E, W], "Zottman Curl": [E, W],
  // Triceps
  "Tricep Pushdown": [E], "Skull Crusher": [E, W], "Overhead Tricep Extension": [S, E], "Close-grip Bench Press": [S, E, W], "Dip": [S, E, W],
  "Overhead Cable Extension": [S, E], "Triceps Kickback": [E], "Rope Pushdown": [E], "Reverse-grip Pushdown": [E, W], "One-arm Cable Pushdown": [E],
  "Dumbbell Skull Crusher": [E, W], "Smith Close-grip Press": [S, E, W], "JM Press": [E, W], "Bench Dip": [S, E, W], "Machine Dip": [S, E],
  "Machine Triceps Extension": [E], "Cable Kickback": [E], "Diamond Push-up": [S, E, W],
  // Quads
  "Squat": [B, H, K, A], "Front Squat": [W, B, H, K, A], "Leg Press": [H, K], "Hack Squat": [H, K, A], "Bulgarian Split Squat": [H, K, A],
  "Walking Lunge": [H, K, A], "Leg Extension": [K], "Lunge": [H, K, A], "Step-up": [H, K, A], "Smith Machine Squat": [B, H, K, A], "Box Squat": [B, H, K],
  "Goblet Squat": [H, K, A], "Dumbbell Squat": [B, H, K, A], "Narrow-stance Leg Press": [H, K], "Single-leg Leg Press": [H, K],
  "Smith Machine Split Squat": [H, K, A], "Reverse Lunge": [H, K], "Barbell Lunge": [B, H, K, A], "Side Lunge": [H, K, A], "Dumbbell Step-up": [H, K, A],
  "Bodyweight Squat": [H, K, A], "Sissy Squat": [K, A], "Wall Sit": [H, K],
  // Hamstrings & Glutes
  "Romanian Deadlift": [B, H], "Lying Leg Curl": [K], "Hip Thrust": [B, H], "Good Morning": [B, H], "Stiff-leg Deadlift": [B, H], "Hip Abduction": [H],
  "Dumbbell Romanian Deadlift": [B, H], "Single-leg Romanian Deadlift": [B, H, A], "Sumo Deadlift": [B, H, K], "Kettlebell Deadlift": [B, H],
  "Seated Leg Curl": [K], "Dumbbell Hip Thrust": [B, H], "Smith Machine Hip Thrust": [B, H], "Glute Bridge": [B, H], "Barbell Glute Bridge": [B, H],
  "Cable Pull-through": [B, H], "Glute Kickback Machine": [H], "Cable Glute Kickback": [H], "Cable Hip Abduction": [H], "Hip Adduction": [H],
  "Kettlebell Swing": [B, H], "Dumbbell Sumo Squat": [H, K], "Glute-Ham Raise": [B, H, K], "Donkey Kick": [H],
  // Calves
  "Standing Calf Raise": [A], "Seated Calf Raise": [A], "Donkey Calf Raise": [B, A], "Calf Press (Leg Press)": [K, A], "Smith Calf Raise": [A],
  "Dumbbell Calf Raise": [A], "Barbell Calf Raise": [A], "Single-leg Calf Raise": [A],
  // Core
  "Plank": [S, W, B], "Hanging Leg Raise": [S, W, B, H], "Cable Crunch": [B], "Ab Wheel Rollout": [S, W, B], "Russian Twist": [B], "Crunch": [],
  "Side Plank": [S, W], "Lying Leg Raise": [B, H], "Hanging Knee Raise": [S, W, H], "Captain's Chair Leg Raise": [E, H], "Machine Crunch": [],
  "Decline Sit-up": [B, H], "Sit-up": [B, H], "Reverse Crunch": [B], "Bicycle Crunch": [], "V-up": [B, H], "Flutter Kick": [B, H],
  "Mountain Climber": [S, W, H], "Dead Bug": [], "Cable Woodchop": [S, B], "Pallof Press": [B], "Dumbbell Side Bend": [B],
};

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
