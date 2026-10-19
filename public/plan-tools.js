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
    // Main lifts only: arms get one isolation on their own push/pull day, back gets a vertical and a row on pull days.
    if (muscle === "Calves" || muscle === "Core") return 0;
    if (muscle === "Biceps") return kind === "pull" ? 1 : 0;
    if (muscle === "Triceps") return kind === "push" ? 1 : 0;
    if (muscle === "Back") return kind === "pull" ? 2 : 1;
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
    // Slots in muscle order; Pull days also get one rear-delt slot. Over the cap, the biggest counts shrink first
    // (last muscle first) so every muscle keeps an exercise before any muscle is dropped.
    const slots = KIND_MUSCLES[kind].map(m => ({ pool: gymFilter(LIB[m], gym), n: countFor(goal, experience, kind, m) })).filter(x => x.n > 0);
    if (kind === "pull") slots.push({ pool: gymFilter(LIB.Shoulders, gym).filter(x => /Rear Delt|Face Pull/.test(x)), n: 1 });
    const total = () => slots.reduce((a, x) => a + x.n, 0);
    while (total() > cap) {
      const top = Math.max(...slots.map(x => x.n));
      if (top > 1) slots.findLast(x => x.n === top).n--; else slots.pop();
    }
    // Strength repeats its main lifts on every day that trains them; the other goals prefer variety.
    const used = goal === "strength" ? new Set() : usedInPlan;
    const exercises = slots.flatMap(x => pick(x.pool, x.n, day, used));
    if (!exercises.length) { notes.push({ text: "{day} was left out: nothing in it fits your gym.", params: { day: name } }); return; }
    exercises.forEach(x => usedInPlan.add(x));
    days.push({ name, focus: MUSCLES.filter(m => exercises.some(x => muscleOf(x) === m)), exercises, weekdays: [WEEKDAYS[daysPerWeek][i]] });
  });
  return { split, days, notes };
}

// ---- entry rule and profile helpers ----

// The automatic journey is only for a signed-in person whose data has fully synced from the server and
// is still empty (a fresh device's cached empty snapshot must not count), once per session, unless skipped.
export function shouldAutoJourney({ authed, synced, days, workouts, skipped, shown }) {
  return authed === true && synced === true && Array.isArray(days) && days.length === 0
    && Array.isArray(workouts) && workouts.length === 0 && !skipped && !shown;
}

export function needsAbout(profile) {
  const p = profile || {};
  return !p.sex || !p.height || !p.birthYear;
}

const toNum = v => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
const validSex = s => s === "male" || s === "female";
const validHeight = h => h !== null && h >= 100 && h <= 250;
const validBirthYear = (y, year) => y !== null && Number.isInteger(y) && y >= year - 100 && y <= year - 10;

// Same ranges as the Body-tab profile form.
export function checkProfile({ sex, height, birthYear, goal }, year) {
  const h = toNum(height), y = toNum(birthYear);
  if (!validSex(sex) || !validHeight(h) || !validBirthYear(y, year) || !(goal in GOAL_DEFAULT_DAYS)) return { ok: false };
  return { ok: true, profile: { sex, height: h, birthYear: y, goal } };
}

// The profile after the journey: the chosen goal plus any valid body basics; everything else (target weight
// included) is kept as it was.
export function mergeProfile(existing, answers) {
  const out = { ...(existing || {}), goal: answers.goal };
  const year = new Date().getFullYear();
  if (validSex(answers.sex)) out.sex = answers.sex;
  const h = toNum(answers.height);
  if (answers.height != null && validHeight(h)) out.height = h;
  const y = toNum(answers.birthYear);
  if (answers.birthYear != null && validBirthYear(y, year)) out.birthYear = y;
  return out;
}
