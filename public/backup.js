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

function cleanFood(date, d) {
  if (d.date !== date || !Array.isArray(d.meals)) return null;
  const meals = d.meals.filter(m => isObj(m) && text(m.id, 40) && num(m.kcal, 1, 5000))
    .map(m => ({ id: m.id.slice(0, 40), name: text(m.name, 40), kcal: m.kcal, protein: num(m.protein, 0, 500) ? m.protein : null }));
  return meals.length ? withUpdated({ date, meals }, d) : null;
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
  return {
    sex: d.sex === "male" || d.sex === "female" ? d.sex : null,
    height: num(d.height, 50, 300) ? d.height : null,
    birthYear: Number.isInteger(d.birthYear) && d.birthYear >= 1900 && d.birthYear <= 2100 ? d.birthYear : null,
    goal: goals.includes(d.goal) ? d.goal : null
  };
}

function cleanSettings(d) {
  const rest = {};
  if (isObj(d.rest)) Object.entries(d.rest).forEach(([k, v]) => { const n = text(k, 80); if (n && num(v, 15, 600)) rest[n] = v; });
  return withUpdated({ rest }, d);
}

// items: [{id, data}] from the file. opts: {bodyKeys, goals, muscles} from the app.
// Returns {items: cleaned [{id, data}], skipped: number of items left out}.
export function cleanBackupItems(items, { bodyKeys, goals, muscles }) {
  const out = [];
  let skipped = 0;
  for (const it of Array.isArray(items) ? items : []) {
    let data = null;
    if (isObj(it) && typeof it.id === "string" && isObj(it.data)) {
      const m = DATE_ID.exec(it.id);
      if (m) data = m[1] === "w" ? cleanWorkout(m[2], it.data) : m[1] === "f" ? cleanFood(m[2], it.data) : cleanBody(m[2], it.data, bodyKeys);
      else if (it.id === "program") data = cleanProgram(it.data, muscles);
      else if (it.id === "profile") data = cleanProfile(it.data, goals);
      else if (it.id === "settings") data = cleanSettings(it.data);
    }
    if (data) out.push({ id: it.id, data }); else skipped++;
  }
  return { items: out, skipped };
}
