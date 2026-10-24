// Built-in food table: data (FOODS), search, serving math, meal totals and recents. Pure: no DOM, no Firebase.
// Entry: {id, en, ar, alt:[spellings], group, kcal100, protein100, servings:[{id, en, ar, grams?, kcal?, protein?}], def}
//   A serving has grams (kcal/protein come from the per-100 g values) or fixed kcal/protein (My foods, scanned products without per-100 g data).
// Item (what a saved meal keeps): {src:"table"|"mine"|"scan", ref, name, serving, amount, grams|null, kcal, protein|null}
// All figures are estimates.

export const FOODS = [];

const MAX_SERVINGS = 100, MAX_GRAMS = 5000, RECENT_DAYS = 14;

// Lower-case, no diacritics, Arabic letter variants unified, single spaces.
export function normalizeText(s) {
  return String(s ?? "").normalize("NFD").toLowerCase()
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/\s+/g, " ").trim();
}

// 0 = a name starts with the query, 1 = a word does, 2 = it appears inside; -1 = no match.
function matchRank(entry, q) {
  let best = -1;
  for (const raw of [entry.en, entry.ar, ...(entry.alt || [])]) {
    const f = normalizeText(raw); if (!f) continue;
    const r = f.startsWith(q) ? 0 : f.split(" ").some(w => w.startsWith(q)) ? 1 : f.includes(q) ? 2 : -1;
    if (r >= 0 && (best < 0 || r < best)) best = r;
  }
  return best;
}

export function searchFoods(query, { foods = FOODS, extra = [], limit = 50 } = {}) {
  const q = normalizeText(query); if (!q) return [];
  const hits = [];
  [...extra, ...foods].forEach((e, i) => { const r = matchRank(e, q); if (r >= 0) hits.push({ e, r, i }); });
  return hits.sort((a, b) => a.r - b.r || a.i - b.i).slice(0, limit).map(h => h.e);
}

const round1 = n => Math.round(n * 10) / 10;
const has = n => typeof n === "number" && Number.isFinite(n);

// sel: {serving, amount} for a serving, or {serving:"g", grams}. null when the food or numbers can't give a result.
export function portionTotals(food, sel) {
  if (!food || !sel) return null;
  let grams = null, kcal, protein;
  if (sel.serving === "g") {
    if (!has(sel.grams) || sel.grams <= 0 || sel.grams > MAX_GRAMS || !has(food.kcal100)) return null;
    grams = sel.grams; kcal = food.kcal100 * grams / 100; protein = has(food.protein100) ? food.protein100 * grams / 100 : null;
  } else {
    const s = (food.servings || []).find(x => x.id === sel.serving);
    if (!s || !has(sel.amount) || sel.amount <= 0 || sel.amount > MAX_SERVINGS) return null;
    if (has(s.grams)) {
      if (!has(food.kcal100)) return null;
      grams = s.grams * sel.amount; kcal = food.kcal100 * grams / 100; protein = has(food.protein100) ? food.protein100 * grams / 100 : null;
    } else if (has(s.kcal)) { kcal = s.kcal * sel.amount; protein = has(s.protein) ? s.protein * sel.amount : null; }
    else return null;
  }
  return { grams, kcal: Math.round(kcal), protein: protein === null ? null : round1(protein) };
}

export function mealTotals(items) {
  let kcal = 0, protein = 0, anyProtein = false;
  for (const it of items || []) { kcal += it.kcal || 0; if (has(it.protein)) { protein += it.protein; anyProtein = true; } }
  return { kcal: Math.round(kcal), protein: anyProtein ? round1(protein) : null };
}

export function defaultMealName(items) {
  return (items || []).slice(0, 3).map(i => i.name).join(" + ").slice(0, 40);
}

const dayShift = (iso, days) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

// Foods from meals in the last 14 days, most recently logged first, one per src+ref.
export function recentFoods(foodDocs, today, n) {
  const from = dayShift(today, -RECENT_DAYS), seen = new Set(), out = [];
  const docs = [...(foodDocs || [])].filter(d => d && d.date >= from && d.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const d of docs) {
    for (const m of [...(d.meals || [])].reverse()) {
      for (const it of [...(m.items || [])].reverse()) {
        const key = it.src + ":" + it.ref;
        if (seen.has(key)) continue;
        seen.add(key); out.push(it); if (out.length >= n) return out;
      }
    }
  }
  return out;
}

// A stored My food {id, name, per100:{kcal,protein}|null, servings, barcode?} as a table-shaped entry.
export function asEntry(mine) {
  return { id: mine.id, en: mine.name, ar: mine.name, alt: [], group: "mine", kcal100: mine.per100 ? mine.per100.kcal : null,
    protein100: mine.per100 ? mine.per100.protein : null, servings: mine.servings.map(s => ({ id: s.id, en: s.name, ar: s.name, ...(s.grams != null ? { grams: s.grams } : {}), ...(s.kcal != null ? { kcal: s.kcal } : {}), ...(s.protein != null ? { protein: s.protein } : {}) })),
    def: mine.servings[0].id, ...(mine.barcode ? { barcode: mine.barcode } : {}) };
}
