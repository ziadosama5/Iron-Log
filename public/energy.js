// Daily calories: everyday burn + lifting + cardio, food eaten and the day's target.
// Pure functions (no DOM/Firebase), unit-tested in tests/energy.test.js.

// MET values (Compendium of Physical Activities, rounded). Estimates use MET − 1, because the
// resting part of the burn is already in the everyday baseline.
export const MET = {
  treadmill:  { easy: 4.3, moderate: 8.0, hard: 10.0 },
  elliptical: { easy: 4.0, moderate: 5.0, hard: 7.0 },
  bike:       { easy: 3.5, moderate: 6.8, hard: 8.8 },
  other:      { easy: 4.0, moderate: 6.0, hard: 8.0 },
};
export const CARDIO_TYPES = Object.keys(MET);
export const INTENSITIES = ["easy", "moderate", "hard"];
export const GOAL_ADJ = { "fat-loss": -450, "muscle": 250, "recomp": -150, "strength": 150, "maintain": 0 };

const BASELINE_FACTOR = 1.2;   // everyday life without workouts
const LIFT_MET = 3.5;          // moderate weight training, rests included
const LIFT_TAIL_MIN = 2;       // time for the last set
const MIN_PER_SET = 2.5;       // when set times are missing
const MAX_LIFT_MIN = 180;      // longer spans are treated as missing times
const INBODY_DAYS = 120;

const days = (a, b) => (new Date(a) - new Date(b)) / 864e5;
const sets = w => (w && Array.isArray(w.entries) ? w.entries.flatMap(e => e.sets || []) : []);

// Latest body weight logged on or before the date.
export function weightOn(body, date) {
  const e = (body || []).filter(x => typeof x.weight === "number" && x.date <= date).sort((a, b) => (a.date < b.date ? -1 : 1));
  return e.length ? e[e.length - 1].weight : null;
}

export function bmrFor(profile, body, date) {
  const scans = (body || []).filter(x => typeof x.bmr === "number" && x.date <= date && days(date, x.date) < INBODY_DAYS)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (scans.length) return { bmr: scans[scans.length - 1].bmr, src: "inbody" };
  const p = profile || {}, kg = weightOn(body, date);
  if (!(p.sex === "male" || p.sex === "female") || !p.height || !p.birthYear || kg == null) return null;
  const age = Number(date.slice(0, 4)) - p.birthYear;
  return { bmr: Math.round(10 * kg + 6.25 * p.height - 5 * age + (p.sex === "male" ? 5 : -161)), src: "formula" };
}

export function baselineBurn(bmr) { return bmr == null ? null : Math.round(bmr * BASELINE_FACTOR); }

// Workout length: first to last timed set + 2 min, else 2.5 min per set.
export function liftMinutes(workout) {
  const all = sets(workout);
  if (!all.length) return 0;
  const t = all.map(s => s.t).filter(x => typeof x === "number" && x > 0).sort((a, b) => a - b);
  if (t.length >= 2) {
    const span = (t[t.length - 1] - t[0]) / 60000 + LIFT_TAIL_MIN;
    if (span <= MAX_LIFT_MIN) return span;
  }
  return all.length * MIN_PER_SET;
}

export function liftKcal(workout, kg) {
  const m = liftMinutes(workout);
  if (!m) return 0;
  return kg == null ? null : Math.round((LIFT_MET - 1) * kg * m / 60);
}

// The machine's number when typed, otherwise an estimate from minutes, intensity and weight.
export function cardioKcal(c, kg) {
  if (typeof c.kcal === "number") return c.kcal;
  const met = (MET[c.type] || MET.other)[c.intensity] || MET.other.moderate;
  return kg == null ? null : Math.round((met - 1) * kg * c.min / 60);
}

export function exerciseKcal(workout, kg) {
  const lift = liftKcal(workout, kg);
  const parts = ((workout && workout.cardio) || []).map(c => cardioKcal(c, kg));
  const cardio = parts.some(x => x == null) ? null : parts.reduce((a, b) => a + b, 0);
  return { lift, cardio, total: lift == null || cardio == null ? null : lift + cardio };
}

export function dayEnergy({ bmr, kg, goal, workout, food }) {
  const baseline = baselineBurn(bmr);
  const ex = exerciseKcal(workout, kg);
  const burned = baseline == null || ex.total == null ? null : baseline + ex.total;
  const meals = (food && food.meals) || [];
  const eaten = meals.reduce((a, m) => a + (m.kcal || 0), 0);
  const withP = meals.filter(m => typeof m.protein === "number");
  return {
    baseline, lift: ex.lift, cardio: ex.cardio, burned,
    target: burned == null ? null : burned + (GOAL_ADJ[goal] || 0),
    eaten,
    protein: withP.length ? withP.reduce((a, m) => a + m.protein, 0) : null,
    balance: burned == null ? null : eaten - burned,
  };
}
