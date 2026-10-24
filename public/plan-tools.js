// Personal journey: builds a week of training days from a few answers. Pure (no DOM, no Firebase).
// Rules live here so they can be tested for every combination of answers.
import { LIB, MUSCLES, muscleOf, gymFilter } from "./exercise-library.js";
import { avoidFilter, hasAvoid } from "./injuries.js";

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
  full: ["Quads", "Chest", "Back", "Shoulders", "Hamstrings & Glutes", "Core"],
  chest: ["Chest"], back: ["Back"], shoulders: ["Shoulders"], arms: ["Biceps", "Triceps"],
  brolegs: ["Quads", "Hamstrings & Glutes", "Calves"]
};
const BRO_KINDS = new Set(["chest", "back", "shoulders", "arms", "brolegs"]);

// Saturday-first week (JS getDay numbers), one weekday per day in plan order.
const WEEKDAYS = { 2: [6, 2], 3: [6, 1, 3], 4: [6, 0, 2, 3], 5: [6, 0, 1, 3, 4], 6: [6, 0, 1, 2, 3, 4] };

const D = (...pairs) => pairs;
const PPL = D(["Push", "push"], ["Pull", "pull"], ["Legs", "legs"]);
const UPPER_LOWER_4 = D(["Upper A", "upper"], ["Lower A", "lower"], ["Upper B", "upper"], ["Lower B", "lower"]);
// Every choice per days per week. The first is the default (for 3 days beginners start with Full Body).
const SPLITS = {
  2: [
    { id: "full", name: "Full Body", days: D(["Full Body A", "full"], ["Full Body B", "full"]) },
    { id: "upper-lower", name: "Upper / Lower", days: D(["Upper A", "upper"], ["Lower A", "lower"]) }
  ],
  3: [
    { id: "ppl", name: "Push / Pull / Legs", days: PPL },
    { id: "full", name: "Full Body", days: D(["Full Body A", "full"], ["Full Body B", "full"], ["Full Body C", "full"]) }
  ],
  4: [
    { id: "upper-lower", name: "Upper / Lower", days: UPPER_LOWER_4 },
    { id: "ppl-full", name: "Push / Pull / Legs + Full Body", days: [...PPL, ["Full Body A", "full"]] }
  ],
  5: [
    { id: "ppl-upper-lower", name: "Push / Pull / Legs + Upper / Lower", days: [...PPL, ["Upper A", "upper"], ["Lower A", "lower"]] },
    { id: "bro", name: "Bro Split", days: D(["Chest", "chest"], ["Back", "back"], ["Shoulders", "shoulders"], ["Arms", "arms"], ["Legs", "brolegs"]) }
  ],
  6: [
    { id: "ppl-x2", name: "Push / Pull / Legs ×2", days: [...PPL, ["Push B", "push"], ["Pull B", "pull"], ["Legs B", "legs"]] },
    { id: "upper-lower-x3", name: "Upper / Lower ×3", days: [...UPPER_LOWER_4, ["Upper C", "upper"], ["Lower C", "lower"]] }
  ]
};

// The splits a person can pick, and the days per week each one supports.
export const SPLIT_FAMILIES = [
  { id: "full", name: "Full Body", days: [2, 3] },
  { id: "upper-lower", name: "Upper / Lower", days: [2, 4, 6] },
  { id: "ppl", name: "Push / Pull / Legs", days: [3, 6] },
  { id: "bro", name: "Bro Split", days: [5] }
];
const FAMILY_SPLIT = { full: { 2: "full", 3: "full" }, "upper-lower": { 2: "upper-lower", 4: "upper-lower", 6: "upper-lower-x3" }, ppl: { 3: "ppl", 6: "ppl-x2" }, bro: { 5: "bro" } };
// The plan split (a splitId for buildPlan) for a picked split and a days count; null when that split does not run that many days.
export function splitFor(family, daysPerWeek) {
  const m = Object.hasOwn(FAMILY_SPLIT, family) ? FAMILY_SPLIT[family] : null;
  return m && Object.hasOwn(m, daysPerWeek) ? m[daysPerWeek] : null;
}

// The choices for a number of days, default first: [{id, name}].
export function splitOptions(daysPerWeek, experience) {
  const list = SPLITS[daysPerWeek];
  if (!list) throw new Error("daysPerWeek must be 2-6");
  const ordered = daysPerWeek === 3 && experience === "beginner" ? [list[1], list[0]] : list;
  return ordered.map(({ id, name }) => ({ id, name }));
}

const BIG_FOUR = ["Chest", "Back", "Quads", "Hamstrings & Glutes"];

// Exercises per muscle in one day (see the plan's volume rules).
function countFor(goal, experience, kind, muscle) {
  if (BRO_KINDS.has(kind)) {
    // One muscle a day, so more exercises each: heavier for muscle/recomp once past the beginner stage.
    if (goal === "strength" && (muscle === "Calves" || muscle === "Core")) return 0;
    const heavy = (goal === "muscle" || goal === "recomp") && experience !== "beginner";
    if (kind === "arms") return heavy ? 3 : 2;
    if (kind === "brolegs") return muscle === "Quads" ? (heavy ? 3 : 2) : muscle === "Hamstrings & Glutes" ? (heavy ? 2 : 1) : 1;
    return heavy ? 4 : 3;
  }
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

// `avoid` (optional, from settings.avoid) takes avoided exercises and areas out of every pool, like the gym does.
export function buildPlan({ goal, daysPerWeek, experience, gym, splitId, avoid }) {
  if (!(goal in GOAL_DEFAULT_DAYS)) throw new Error("unknown goal: " + goal);
  if (!EXPERIENCE.includes(experience)) throw new Error("unknown experience: " + experience);
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 2 || daysPerWeek > 6) throw new Error("daysPerWeek must be 2-6");
  const options = splitOptions(daysPerWeek, experience);
  const chosen = splitId === undefined ? options[0] : options.find(o => o.id === splitId);
  if (!chosen) throw new Error("unknown split for " + daysPerWeek + " days: " + splitId);
  const { name: split, days: shape } = SPLITS[daysPerWeek].find(x => x.id === chosen.id);
  const notes = [], usedInPlan = new Set(), days = [];
  const cap = goal === "strength" ? 5 : 7;
  const pool = names => avoidFilter(gymFilter(names, gym), avoid), inj = hasAvoid(avoid);

  // A muscle the split trains but that nothing in the gym can work.
  const trained = new Set(shape.flatMap(([, kind]) => KIND_MUSCLES[kind].filter(m => countFor(goal, experience, kind, m) > 0)));
  for (const m of MUSCLES) {
    if (trained.has(m) && pool(LIB[m]).length === 0) notes.push({ text: inj ? "No {muscle} exercise fits your gym and injuries." : "No {muscle} exercise fits your gym.", params: { muscle: m } });
  }

  shape.forEach(([name, kind], i) => {
    const day = { families: new Set() };
    // Slots in muscle order; Pull days also get one rear-delt slot. Over the cap, the biggest counts shrink first
    // (last muscle first) so every muscle keeps an exercise before any muscle is dropped.
    const slots = KIND_MUSCLES[kind].map(m => ({ pool: pool(LIB[m]), n: countFor(goal, experience, kind, m) })).filter(x => x.n > 0);
    if (kind === "pull") slots.push({ pool: pool(LIB.Shoulders).filter(x => /Rear Delt|Face Pull/.test(x)), n: 1 });
    const total = () => slots.reduce((a, x) => a + x.n, 0);
    while (total() > cap) {
      const top = Math.max(...slots.map(x => x.n));
      if (top > 1) slots.findLast(x => x.n === top).n--; else slots.pop();
    }
    // Strength repeats its main lifts on every day that trains them; the other goals prefer variety.
    const used = goal === "strength" ? new Set() : usedInPlan;
    const exercises = slots.flatMap(x => pick(x.pool, x.n, day, used));
    if (!exercises.length) { notes.push({ text: inj ? "{day} was left out: nothing in it fits your gym and injuries." : "{day} was left out: nothing in it fits your gym.", params: { day: name } }); return; }
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
  if (existing && existing.goal !== answers.goal) delete out.adjust;   // an own daily adjustment belongs to the goal it was set for
  const year = new Date().getFullYear();
  if (validSex(answers.sex)) out.sex = answers.sex;
  const h = toNum(answers.height);
  if (answers.height != null && validHeight(h)) out.height = h;
  const y = toNum(answers.birthYear);
  if (answers.birthYear != null && validBirthYear(y, year)) out.birthYear = y;
  return out;
}

// Put a weekday (JS getDay number) on one training day, or make it a rest day (dayId null / unknown).
// A weekday belongs to at most one day; a day may have several weekdays. Returns new day objects; the input is not changed.
export function assignWeekday(days, weekday, dayId) {
  return (days || []).map(d => {
    const rest = (d.weekdays || []).filter(w => w !== weekday);
    return { ...d, weekdays: d.id === dayId ? [...rest, weekday] : rest };
  });
}
