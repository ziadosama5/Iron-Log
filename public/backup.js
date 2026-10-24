// Checks and cleans items from a backup file before they are restored. A backup file can come
// from anywhere, so nothing in it is trusted: bad items are skipped, bad fields dropped, text cut.
import { CARDIO_TYPES, INTENSITIES } from "./energy.js";

const DATE_ID = /^(w|b|f)-(\d{4}-\d{2}-\d{2})$/;
const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const num = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const text = (v, max) => (typeof v === "string" && v.trim() ? v.slice(0, max) : null);
const withUpdated = (out, d) => (num(d.updated, 0, Number.MAX_SAFE_INTEGER) ? { ...out, updated: d.updated } : out);

function cleanWorkout(date, d) {
  if (d.date !== date || !Array.isArray(d.entries)) return null;
  const entries = d.entries.filter(isObj).map(e => {
    const ex = text(e.ex, 80); if (!ex) return null;
    const sets = (Array.isArray(e.sets) ? e.sets : [])
      .filter(s => isObj(s) && num(s.w, 0, 2000) && Number.isInteger(s.r) && s.r >= 1 && s.r <= 1000)
      .map(s => (num(s.t, 1, Number.MAX_SAFE_INTEGER) ? { w: s.w, r: s.r, t: s.t } : { w: s.w, r: s.r }));
    const out = { ex, sets };
    if (typeof e.done === "boolean") out.done = e.done;
    return out;
  }).filter(Boolean);
  const out = { date, dayId: text(d.dayId, 40), dayName: text(d.dayName, 60), entries };
  if (Array.isArray(d.cardio)) out.cardio = d.cardio.filter(c => isObj(c) && text(c.id, 40) && CARDIO_TYPES.includes(c.type)
      && Number.isInteger(c.min) && c.min >= 1 && c.min <= 600 && INTENSITIES.includes(c.intensity) && (c.kcal === null || num(c.kcal, 1, 5000)))
    .map(c => ({ id: c.id.slice(0, 40), type: c.type, min: c.min, intensity: c.intensity, kcal: c.kcal }));
  return withUpdated(out, d);
}

const MEAL_SRC = ["table", "mine", "scan"];

// One food of a meal (a snapshot), or null.
function cleanMealItem(i) {
  if (!isObj(i) || !MEAL_SRC.includes(i.src)) return null;
  const ref = text(i.ref, 40), name = text(i.name, 60), serving = text(i.serving, 40);
  if (!ref || !name || !serving || !num(i.amount, 0, 5000) || i.amount <= 0) return null;
  if (!(i.grams === null || (num(i.grams, 0, 5000) && i.grams > 0)) || !Number.isInteger(i.kcal) || !num(i.kcal, 0, 5000)) return null;
  return { src: i.src, ref, name, serving, amount: i.amount, grams: i.grams, kcal: i.kcal, protein: num(i.protein, 0, 500) ? i.protein : null };
}

function cleanFood(date, d) {
  if (d.date !== date || !Array.isArray(d.meals)) return null;
  const meals = d.meals.filter(m => isObj(m) && text(m.id, 40) && num(m.kcal, 1, 5000))
    .map(m => {
      const out = { id: m.id.slice(0, 40), name: text(m.name, 40), kcal: m.kcal, protein: num(m.protein, 0, 500) ? m.protein : null };
      const items = (Array.isArray(m.items) ? m.items : []).map(cleanMealItem).filter(Boolean).slice(0, 20);
      if (items.length) out.items = items;
      return out;
    });
  return meals.length ? withUpdated({ date, meals }, d) : null;
}

// My own foods: {list:[{id, name, per100:{kcal,protein}|null, servings:[{id, name, grams?|kcal?, protein?}], barcode?}]}.
function cleanMyFood(f) {
  if (!isObj(f)) return null;
  const id = text(f.id, 40), name = text(f.name, 60); if (!id || !name) return null;
  let per100 = null;
  if (f.per100 != null) {
    if (!isObj(f.per100) || !num(f.per100.kcal, 0, 900) || (f.per100.protein !== null && !num(f.per100.protein, 0, 100))) return null;
    per100 = { kcal: f.per100.kcal, protein: f.per100.protein };
  }
  const servings = (Array.isArray(f.servings) ? f.servings : []).map(s => {
    if (!isObj(s)) return null;
    const sid = text(s.id, 40), sname = text(s.name, 60); if (!sid || !sname) return null;
    const out = { id: sid, name: sname };
    if (per100 && num(s.grams, 1, 5000)) out.grams = s.grams;
    if (num(s.kcal, 0, 5000)) out.kcal = s.kcal;
    if (out.grams === undefined && out.kcal === undefined) return null;
    if (num(s.protein, 0, 500)) out.protein = s.protein;
    return out;
  }).filter(Boolean).slice(0, 5);
  if (!servings.length) return null;
  const out = { id, name, per100, servings };
  if (typeof f.barcode === "string" && /^\d{8,14}$/.test(f.barcode)) out.barcode = f.barcode;
  return out;
}

function cleanMyFoods(d) {
  if (!Array.isArray(d.list)) return null;
  const seen = new Set();
  const list = d.list.map(cleanMyFood).filter(f => f && !seen.has(f.id) && seen.add(f.id)).slice(0, 200);
  return list.length ? withUpdated({ list }, d) : null;
}

function cleanBody(date, d, bodyKeys) {
  if (d.date !== date) return null;
  const out = { date };
  bodyKeys.forEach(k => { if (num(d[k], 0, 100000)) out[k] = d[k]; });
  return withUpdated(out, d);
}

function cleanProgram(d, muscles) {
  if (!Array.isArray(d.days)) return null;
  const days = d.days.filter(isObj).map(x => {
    const id = text(x.id, 40); if (!id) return null;
    return {
      id, name: text(x.name, 40) || "Day",
      focus: (Array.isArray(x.focus) ? x.focus : []).filter(m => muscles.includes(m)),
      exercises: (Array.isArray(x.exercises) ? x.exercises : []).map(n => text(n, 80)).filter(Boolean),
      weekdays: [...new Set((Array.isArray(x.weekdays) ? x.weekdays : []).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))]
    };
  }).filter(Boolean);
  const out = { days };
  if (num(d.v, 0, 1000)) out.v = d.v;
  return withUpdated(out, d);
}

function cleanProfile(d, goals) {
  const out = {
    sex: d.sex === "male" || d.sex === "female" ? d.sex : null,
    height: num(d.height, 50, 300) ? d.height : null,
    birthYear: Number.isInteger(d.birthYear) && d.birthYear >= 1900 && d.birthYear <= 2100 ? d.birthYear : null,
    goal: goals.includes(d.goal) ? d.goal : null
  };
  // Target weight fields only when the backup has them, so older profiles come back unchanged.
  if ("goalWeight" in d) out.goalWeight = num(d.goalWeight, 30, 300) ? d.goalWeight : null;
  if ("goalStart" in d) out.goalStart = typeof d.goalStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.goalStart) ? d.goalStart : null;
  return out;
}

function cleanSettings(d, equipment) {
  const rest = {};
  if (isObj(d.rest)) Object.entries(d.rest).forEach(([k, v]) => { const n = text(k, 80); if (n && num(v, 15, 600)) rest[n] = v; });
  const out = { rest };
  if (Array.isArray(d.seenBadges)) out.seenBadges = d.seenBadges.filter(s => typeof s === "string" && s.length <= 40).slice(0, 200);
  if (Array.isArray(d.gym)) {
    const known = new Set(equipment);
    out.gym = [...new Set(d.gym.filter(id => typeof id === "string" && known.has(id)))];
  }
  return withUpdated(out, d);
}

// items: [{id, data}] from the file. opts: {bodyKeys, goals, muscles, equipment} from the app (equipment = valid gym ids).
// Returns {items: cleaned [{id, data}], skipped: number of items left out}.
export function cleanBackupItems(items, { bodyKeys, goals, muscles, equipment = [] }) {
  const out = [];
  let skipped = 0;
  for (const it of Array.isArray(items) ? items : []) {
    let data = null;
    if (isObj(it) && typeof it.id === "string" && isObj(it.data)) {
      const m = DATE_ID.exec(it.id);
      if (m) data = m[1] === "w" ? cleanWorkout(m[2], it.data) : m[1] === "f" ? cleanFood(m[2], it.data) : cleanBody(m[2], it.data, bodyKeys);
      else if (it.id === "program") data = cleanProgram(it.data, muscles);
      else if (it.id === "profile") data = cleanProfile(it.data, goals);
      else if (it.id === "settings") data = cleanSettings(it.data, equipment);
      else if (it.id === "foods") data = cleanMyFoods(it.data);
    }
    if (data) out.push({ id: it.id, data }); else skipped++;
  }
  return { items: out, skipped };
}
