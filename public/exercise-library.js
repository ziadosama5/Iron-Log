// Exercise library and split templates. Shared by the app and the unit tests.

// Equipment a gym can have. `group` is how the My Gym checklist will lay them out.
export const EQUIPMENT = [
  { id: "barbell", group: "weights", name: "Barbell" },
  { id: "dumbbell", group: "weights", name: "Dumbbells" },
  { id: "ez-bar", group: "weights", name: "EZ bar" },
  { id: "trap-bar", group: "weights", name: "Trap bar" },
  { id: "kettlebell", group: "weights", name: "Kettlebell" },
  { id: "bench", group: "station", name: "Adjustable bench" },
  { id: "decline-bench", group: "station", name: "Decline bench" },
  { id: "rack", group: "station", name: "Squat rack" },
  { id: "smith", group: "station", name: "Smith machine" },
  { id: "cable", group: "station", name: "Cable station" },
  { id: "pullup-bar", group: "station", name: "Pull-up bar" },
  { id: "dip-station", group: "station", name: "Dip station" },
  { id: "captains-chair", group: "station", name: "Captain's chair" },
  { id: "preacher-bench", group: "station", name: "Preacher bench" },
  { id: "hyper-bench", group: "station", name: "Back extension bench" },
  { id: "box", group: "station", name: "Box / step" },
  { id: "ab-wheel", group: "station", name: "Ab wheel" },
  { id: "chest-press", group: "machine", name: "Chest press machine" },
  { id: "incline-press-machine", group: "machine", name: "Incline chest press machine" },
  { id: "pec-deck", group: "machine", name: "Pec deck (butterfly)" },
  { id: "shoulder-press-machine", group: "machine", name: "Shoulder press machine" },
  { id: "lateral-raise-machine", group: "machine", name: "Lateral raise machine" },
  { id: "lat-pulldown", group: "machine", name: "Lat pulldown machine" },
  { id: "seated-row", group: "machine", name: "Seated row machine" },
  { id: "assisted-machine", group: "machine", name: "Assisted pull-up/dip machine" },
  { id: "tbar-row", group: "machine", name: "T-bar row machine" },
  { id: "biceps-curl-machine", group: "machine", name: "Biceps curl machine" },
  { id: "triceps-machine", group: "machine", name: "Triceps extension/dip machine" },
  { id: "leg-press", group: "machine", name: "Leg press machine" },
  { id: "hack-squat", group: "machine", name: "Hack squat machine" },
  { id: "leg-extension", group: "machine", name: "Leg extension machine" },
  { id: "leg-curl", group: "machine", name: "Lying leg curl machine" },
  { id: "seated-leg-curl", group: "machine", name: "Seated leg curl machine" },
  { id: "hip-abduction", group: "machine", name: "Hip abduction machine" },
  { id: "hip-adduction", group: "machine", name: "Hip adduction machine" },
  { id: "glute-kickback", group: "machine", name: "Glute kickback machine" },
  { id: "standing-calf-machine", group: "machine", name: "Standing calf raise machine" },
  { id: "seated-calf-machine", group: "machine", name: "Seated calf raise machine" },
  { id: "ab-crunch-machine", group: "machine", name: "Ab crunch machine" }
];

// Every exercise: name, muscle group and ALL the equipment it needs (none = bodyweight).
// Order inside a group is the order suggestions show first (popular first).
const GROUPS = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Quads", "Hamstrings & Glutes", "Calves", "Core"];
const X = (group, rows) => rows.map(([name, ...eq]) => ({ name, group, eq }));
export const EXERCISES = [
  ...X("Chest", [
    ["Bench Press", "barbell", "bench"], ["Incline Barbell Press", "barbell", "bench"], ["Incline Dumbbell Press", "dumbbell", "bench"],
    ["Dumbbell Bench Press", "dumbbell", "bench"], ["Machine Chest Press", "chest-press"], ["Dumbbell Fly", "dumbbell", "bench"],
    ["Cable Crossover", "cable"], ["Push-up"], ["Decline Bench Press", "barbell", "decline-bench"], ["Pec Deck", "pec-deck"],
    ["Chest Dip", "dip-station"], ["Decline Dumbbell Press", "dumbbell", "decline-bench"], ["Incline Machine Press", "incline-press-machine"],
    ["Smith Machine Bench Press", "smith", "bench"], ["Smith Machine Incline Press", "smith", "bench"], ["Incline Dumbbell Fly", "dumbbell", "bench"],
    ["Low Cable Crossover", "cable"], ["Cable Fly (Flat Bench)", "cable", "bench"], ["Incline Push-up", "bench"], ["Decline Push-up", "bench"],
    ["Dumbbell Pullover", "dumbbell", "bench"], ["Dumbbell Floor Press", "dumbbell"]]),
  ...X("Back", [
    ["Pull-up", "pullup-bar"], ["Lat Pulldown", "lat-pulldown"], ["Barbell Row", "barbell"], ["One-arm Dumbbell Row", "dumbbell", "bench"],
    ["Seated Cable Row", "cable"], ["T-bar Row", "tbar-row"], ["Chin-up", "pullup-bar"], ["Deadlift", "barbell"], ["Barbell Shrug", "barbell"],
    ["Dumbbell Shrug", "dumbbell"], ["Straight-arm Pulldown", "cable"], ["Back Extension", "hyper-bench"], ["Close-grip Pulldown", "lat-pulldown"]]),
  ...X("Shoulders", [
    ["Overhead Press", "barbell"], ["Arnold Press", "dumbbell"], ["Lateral Raise", "dumbbell"], ["Rear Delt Fly", "dumbbell"], ["Face Pull", "cable"],
    ["Upright Row", "barbell"], ["Machine Shoulder Press", "shoulder-press-machine"], ["Reverse Pec Deck", "pec-deck"]]),
  ...X("Biceps", [
    ["Barbell Curl", "barbell"], ["Dumbbell Curl", "dumbbell"], ["Hammer Curl", "dumbbell"], ["Preacher Curl", "ez-bar", "preacher-bench"],
    ["Incline Dumbbell Curl", "dumbbell", "bench"], ["Cable Curl", "cable"], ["EZ-bar Curl", "ez-bar"], ["Concentration Curl", "dumbbell"]]),
  ...X("Triceps", [
    ["Tricep Pushdown", "cable"], ["Skull Crusher", "ez-bar", "bench"], ["Overhead Tricep Extension", "dumbbell"],
    ["Close-grip Bench Press", "barbell", "bench"], ["Dip", "dip-station"], ["Overhead Cable Extension", "cable"], ["Triceps Kickback", "dumbbell"]]),
  ...X("Quads", [
    ["Squat", "barbell", "rack"], ["Front Squat", "barbell", "rack"], ["Leg Press", "leg-press"], ["Hack Squat", "hack-squat"],
    ["Bulgarian Split Squat", "dumbbell", "bench"], ["Walking Lunge", "dumbbell"], ["Leg Extension", "leg-extension"], ["Lunge", "dumbbell"],
    ["Step-up", "box"], ["Smith Machine Squat", "smith"]]),
  ...X("Hamstrings & Glutes", [
    ["Romanian Deadlift", "barbell"], ["Lying Leg Curl", "leg-curl"], ["Hip Thrust", "barbell", "bench"], ["Good Morning", "barbell", "rack"],
    ["Stiff-leg Deadlift", "barbell"], ["Hip Abduction", "hip-abduction"]]),
  ...X("Calves", [
    ["Standing Calf Raise", "standing-calf-machine"], ["Seated Calf Raise", "seated-calf-machine"], ["Donkey Calf Raise", "box"]]),
  ...X("Core", [
    ["Plank"], ["Hanging Leg Raise", "pullup-bar"], ["Cable Crunch", "cable"], ["Ab Wheel Rollout", "ab-wheel"], ["Russian Twist"], ["Crunch"],
    ["Side Plank"], ["Lying Leg Raise"]])
];
export const LIB = Object.fromEntries(GROUPS.map(g => [g, EXERCISES.filter(e => e.group === g).map(e => e.name)]));
// Exercises merged into another one. Saved days and workouts keep the old name; these only decide
// which info/muscle to show for it and what a typed old name turns into.
export const ALIASES = {
  "dumbbell shoulder press": "Overhead Press",
  "cable lateral raise": "Lateral Raise",
  "glute bridge": "Hip Thrust",
  "seated leg curl": "Lying Leg Curl"
};
export const resolveAlias = name => ALIASES[String(name).toLowerCase()] || name;
export const MUSCLES = Object.keys(LIB);
export const ALL_EX = [...new Set(Object.values(LIB).flat())];

// Required equipment ids of a library exercise (aliases resolved), or null for custom names.
const EQ_BY_NAME = new Map(EXERCISES.map(e => [e.name.toLowerCase(), e.eq]));
export function equipmentOf(name) {
  const eq = EQ_BY_NAME.get(String(resolveAlias(name)).toLowerCase());
  return eq ? [...eq] : null;
}
// Names of library exercises whose every required item is in the gym (list of equipment ids).
export function exercisesFor(gym) {
  const have = new Set(gym || []);
  return EXERCISES.filter(e => e.eq.every(q => have.has(q))).map(e => e.name);
}

export const TEMPLATES = [
  { name:"Push / Pull / Legs", note:"3 days · classic split", days:[
    {name:"Push", focus:["Chest","Shoulders","Triceps"], exercises:["Bench Press","Overhead Press","Incline Dumbbell Press","Lateral Raise","Tricep Pushdown"]},
    {name:"Pull", focus:["Back","Shoulders","Biceps"], exercises:["Pull-up","Barbell Row","Lat Pulldown","Face Pull","Barbell Curl","Hammer Curl"]},
    {name:"Legs", focus:["Quads","Hamstrings & Glutes","Calves"], exercises:["Squat","Romanian Deadlift","Leg Press","Lying Leg Curl","Standing Calf Raise"]}]},
  { name:"Upper / Lower", note:"4 days · strength + size", days:[
    {name:"Upper A", focus:["Chest","Back","Shoulders","Biceps","Triceps"], exercises:["Bench Press","Barbell Row","Overhead Press","Lat Pulldown","Barbell Curl","Tricep Pushdown"]},
    {name:"Lower A", focus:["Quads","Hamstrings & Glutes","Calves"], exercises:["Squat","Romanian Deadlift","Leg Press","Standing Calf Raise"]},
    {name:"Upper B", focus:["Chest","Back","Shoulders","Biceps","Triceps"], exercises:["Incline Dumbbell Press","Pull-up","Overhead Press","Seated Cable Row","Hammer Curl","Skull Crusher"]},
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
  const n = String(resolveAlias(name)).toLowerCase();
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
