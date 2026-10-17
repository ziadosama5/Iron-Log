// Exercise library and split templates. Shared by the app and the unit tests.

export const LIB = {
  "Chest":     ["Bench Press","Incline Barbell Press","Incline Dumbbell Press","Dumbbell Bench Press","Machine Chest Press","Dumbbell Fly","Cable Crossover","Push-up"],
  "Back":      ["Pull-up","Lat Pulldown","Barbell Row","One-arm Dumbbell Row","Seated Cable Row","T-bar Row","Chin-up","Deadlift"],
  "Shoulders": ["Overhead Press","Dumbbell Shoulder Press","Arnold Press","Lateral Raise","Cable Lateral Raise","Rear Delt Fly","Face Pull","Upright Row"],
  "Biceps":    ["Barbell Curl","Dumbbell Curl","Hammer Curl","Preacher Curl","Incline Dumbbell Curl","Cable Curl"],
  "Triceps":   ["Tricep Pushdown","Skull Crusher","Overhead Tricep Extension","Close-grip Bench Press","Dip"],
  "Quads":     ["Squat","Front Squat","Leg Press","Hack Squat","Bulgarian Split Squat","Walking Lunge","Leg Extension"],
  "Hamstrings & Glutes": ["Romanian Deadlift","Lying Leg Curl","Seated Leg Curl","Hip Thrust","Good Morning","Glute Bridge"],
  "Calves":    ["Standing Calf Raise","Seated Calf Raise"],
  "Core":      ["Plank","Hanging Leg Raise","Cable Crunch","Ab Wheel Rollout","Russian Twist"]
};
export const MUSCLES = Object.keys(LIB);
export const ALL_EX = [...new Set(Object.values(LIB).flat())];

export const TEMPLATES = [
  { name:"Push / Pull / Legs", note:"3 days · classic split", days:[
    {name:"Push", focus:["Chest","Shoulders","Triceps"], exercises:["Bench Press","Overhead Press","Incline Dumbbell Press","Lateral Raise","Tricep Pushdown"]},
    {name:"Pull", focus:["Back","Shoulders","Biceps"], exercises:["Pull-up","Barbell Row","Lat Pulldown","Face Pull","Barbell Curl","Hammer Curl"]},
    {name:"Legs", focus:["Quads","Hamstrings & Glutes","Calves"], exercises:["Squat","Romanian Deadlift","Leg Press","Lying Leg Curl","Standing Calf Raise"]}]},
  { name:"Upper / Lower", note:"4 days · strength + size", days:[
    {name:"Upper A", focus:["Chest","Back","Shoulders","Biceps","Triceps"], exercises:["Bench Press","Barbell Row","Overhead Press","Lat Pulldown","Barbell Curl","Tricep Pushdown"]},
    {name:"Lower A", focus:["Quads","Hamstrings & Glutes","Calves"], exercises:["Squat","Romanian Deadlift","Leg Press","Standing Calf Raise"]},
    {name:"Upper B", focus:["Chest","Back","Shoulders","Biceps","Triceps"], exercises:["Incline Dumbbell Press","Pull-up","Dumbbell Shoulder Press","Seated Cable Row","Hammer Curl","Skull Crusher"]},
    {name:"Lower B", focus:["Back","Quads","Hamstrings & Glutes","Core"], exercises:["Deadlift","Front Squat","Hip Thrust","Lying Leg Curl","Hanging Leg Raise"]}]},
  { name:"Full Body", note:"3 days · A / B / C", days:[
    {name:"Full Body A", focus:["Chest","Back","Quads","Core"], exercises:["Squat","Bench Press","Barbell Row","Plank"]},
    {name:"Full Body B", focus:["Back","Shoulders","Hamstrings & Glutes","Core"], exercises:["Deadlift","Overhead Press","Pull-up","Hanging Leg Raise"]},
    {name:"Full Body C", focus:["Chest","Back","Quads","Hamstrings & Glutes"], exercises:["Front Squat","Incline Dumbbell Press","Seated Cable Row","Hip Thrust"]}]},
  { name:"Bro Split", note:"5 days · one muscle a day", days:[
    {name:"Chest", focus:["Chest"], exercises:["Bench Press","Incline Dumbbell Press","Dumbbell Fly","Cable Crossover"]},
    {name:"Back", focus:["Back"], exercises:["Deadlift","Pull-up","Barbell Row","Seated Cable Row"]},
    {name:"Shoulders", focus:["Shoulders"], exercises:["Overhead Press","Lateral Raise","Rear Delt Fly","Face Pull"]},
    {name:"Arms", focus:["Biceps","Triceps"], exercises:["Barbell Curl","Close-grip Bench Press","Hammer Curl","Skull Crusher","Tricep Pushdown"]},
    {name:"Legs", focus:["Quads","Hamstrings & Glutes","Calves"], exercises:["Squat","Romanian Deadlift","Leg Press","Lying Leg Curl","Standing Calf Raise"]}]}
];

// Muscle group an exercise belongs to (first group listing it), or null for custom exercises.
export function muscleOf(name) {
  const n = String(name).toLowerCase();
  return MUSCLES.find(m => LIB[m].some(x => x.toLowerCase() === n)) || null;
}

// The day's focus plus the group of every library exercise on it, in the standard muscle order.
export function fillFocus(day) {
  const have = new Set(day.focus || []);
  (day.exercises || []).forEach(ex => { const m = muscleOf(ex); if (m) have.add(m); });
  return [...MUSCLES.filter(m => have.has(m)), ...(day.focus || []).filter(m => !MUSCLES.includes(m))];
}

// Fills focus on every day; days that need no change are returned as the same objects.
export function fillAllFocus(days) {
  let changed = false;
  const out = days.map(d => {
    const f = fillFocus(d), old = d.focus || [];
    if (f.length === old.length && f.every(m => old.includes(m))) return d;
    changed = true;
    return { ...d, focus: f };
  });
  return { days: out, changed };
}

// v2 = day focus has been filled from the day's exercises once. Runs once per account, so a
// tag the user removes on purpose afterwards stays removed.
export const PROGRAM_VERSION = 2;
export function migrateProgram(doc) {
  const days = (doc && doc.days) || [];
  if (!days.length || ((doc && doc.v) || 1) >= PROGRAM_VERSION) return { days, needsSave: false };
  return { days: fillAllFocus(days).days, needsSave: true };
}
