// Personal journey: builds a week of training days from a few answers. Pure (no DOM, no Firebase).
// Rules live here so they can be tested for every combination of answers.
import { LIB, MUSCLES, muscleOf, gymFilter } from "./exercise-library.js";

export const EXPERIENCE = ["beginner", "intermediate", "advanced"];
export const GOAL_DEFAULT_DAYS = { strength: 4, muscle: 4, recomp: 4, "fat-loss": 3, maintain: 3 };

// Two picks in one day from the same movement family would be the same exercise with other equipment
// (Bench Press / Dumbbell Bench Press). Incline, decline and grip words are kept on purpose.
const EQUIPMENT_WORDS = /\b(barbell|dumbbell|cable|machine|smith|ez-bar|ez|seated|standing|lying|one-arm|single-arm)\b/gi;
export function movementFamily(name) {
  return String(name).toLowerCase().replace(EQUIPMENT_WORDS, " ").replace(/\s+/g, " ").trim();
}

const KIND_MUSCLES = {
  push: ["Chest", "Shoulders", "Triceps"],
  pull: ["Back", "Biceps"],
  legs: ["Quads", "Hamstrings & Glutes", "Calves"],
  upper: ["Chest", "Back", "Shoulders", "Biceps", "Triceps"],
  lower: ["Quads", "Hamstrings & Glutes", "Calves", "Core"],
  full: ["Quads", "Chest", "Back", "Shoulders", "Hamstrings & Glutes", "Core"]
};

// Saturday-first week (JS getDay numbers), one weekday per day in plan order.
const WEEKDAYS = { 2: [6, 2], 3: [6, 1, 3], 4: [6, 0, 2, 3], 5: [6, 0, 1, 3, 4], 6: [6, 0, 1, 2, 3, 4] };

function layout(daysPerWeek, experience) {
  switch (daysPerWeek) {
    case 2: return { split: "Full Body", days: [["Full Body A", "full"], ["Full Body B", "full"]] };
    case 3: return experience === "beginner"
      ? { split: "Full Body", days: [["Full Body A", "full"], ["Full Body B", "full"], ["Full Body C", "full"]] }
      : { split: "Push / Pull / Legs", days: [["Push", "push"], ["Pull", "pull"], ["Legs", "legs"]] };
    case 4: return { split: "Upper / Lower", days: [["Upper A", "upper"], ["Lower A", "lower"], ["Upper B", "upper"], ["Lower B", "lower"]] };
    case 5: return { split: "Push / Pull / Legs + Upper / Lower", days: [["Push", "push"], ["Pull", "pull"], ["Legs", "legs"], ["Upper A", "upper"], ["Lower A", "lower"]] };
    default: return { split: "Push / Pull / Legs ×2", days: [["Push", "push"], ["Pull", "pull"], ["Legs", "legs"], ["Push B", "push"], ["Pull B", "pull"], ["Legs B", "legs"]] };
  }
}

const BIG_FOUR = ["Chest", "Back", "Quads", "Hamstrings & Glutes"];

// Exercises per muscle in one day (see the plan's volume rules).
function countFor(goal, experience, kind, muscle) {
  if (goal === "strength") {
    if (muscle === "Calves" || muscle === "Core") return 0;
    return muscle === "Quads" && (kind === "legs" || kind === "lower") ? 2 : 1;
  }
  let n = 1;
  if (goal === "muscle" || goal === "recomp") {
    if (kind !== "full") {
      if (experience === "intermediate") n = BIG_FOUR.includes(muscle) ? 2 : 1;
      else if (experience === "advanced") n = muscle === "Calves" || muscle === "Core" ? 1 : 2;
    }
    if (["push", "pull", "upper"].includes(kind) && ["Shoulders", "Biceps", "Triceps"].includes(muscle)) n += 1;
  }
  return n;
}

// Picks up to n names for a muscle: library order through the gym filter, never two of one family in a day,
// preferring names not already used elsewhere in the plan.
function pick(pool, n, day, usedInPlan) {
  const out = [];
  while (out.length < n) {
    const free = pool.filter(x => !out.includes(x) && !day.families.has(movementFamily(x)));
    if (!free.length) break;
    const chosen = free.find(x => !usedInPlan.has(x)) || free[0];
    out.push(chosen);
    day.families.add(movementFamily(chosen));
  }
  return out;
}

export function buildPlan({ goal, daysPerWeek, experience, gym }) {
  if (!(goal in GOAL_DEFAULT_DAYS)) throw new Error("unknown goal: " + goal);
  if (!EXPERIENCE.includes(experience)) throw new Error("unknown experience: " + experience);
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 2 || daysPerWeek > 6) throw new Error("daysPerWeek must be 2-6");
  const { split, days: shape } = layout(daysPerWeek, experience);
  const notes = [], usedInPlan = new Set(), days = [];
  const cap = goal === "strength" ? 5 : 7;

  // A muscle the split trains but that nothing in the gym can work.
  const trained = new Set(shape.flatMap(([, kind]) => KIND_MUSCLES[kind].filter(m => countFor(goal, experience, kind, m) > 0)));
  for (const m of MUSCLES) {
    if (trained.has(m) && gymFilter(LIB[m], gym).length === 0) notes.push({ text: "No {muscle} exercise fits your gym.", params: { muscle: m } });
  }

  shape.forEach(([name, kind], i) => {
    const day = { families: new Set() };
    let exercises = [];
    for (const m of KIND_MUSCLES[kind]) {
      const n = countFor(goal, experience, kind, m);
      if (n > 0) exercises.push(...pick(gymFilter(LIB[m], gym), n, day, usedInPlan));
    }
    if (kind === "pull") {
      const rear = gymFilter(LIB.Shoulders, gym).filter(x => /Rear Delt|Face Pull/.test(x));
      exercises.push(...pick(rear, 1, day, usedInPlan));
    }
    exercises = exercises.slice(0, cap);
    if (!exercises.length) { notes.push({ text: "{day} was left out: nothing in it fits your gym.", params: { day: name } }); return; }
    exercises.forEach(x => usedInPlan.add(x));
    days.push({ name, focus: MUSCLES.filter(m => exercises.some(x => muscleOf(x) === m)), exercises, weekdays: [WEEKDAYS[daysPerWeek][i]] });
  });
  return { split, days, notes };
}
