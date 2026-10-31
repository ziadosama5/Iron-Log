// Search the exercise library. Pure: the caller passes the candidate names (already through the gym and injury filters) and how to label them.
// Every typed word must be found (any order) in the English name, the displayed name, the muscle group or an equipment name; Arabic letters
// fold like in the food search (أ/ا, ة/ه, ى/ي, diacritics). Unit-tested in tests/exercise-search.test.js.
import { normalizeText } from "./food-table.js";

const CAP = 300;

// -> names, best first (exact name, starts with, all words in the name, words anywhere); equal ranks keep the library order.
export function searchExercises(query, { names, label, equipmentLabels, muscleLabel }) {
  const q = normalizeText(query);
  if (!q) return [];
  const words = q.split(" ").filter(Boolean), out = [];
  names.forEach((name, i) => {
    const en = normalizeText(name), shown = normalizeText(label(name)), extra = normalizeText([muscleLabel(name), ...equipmentLabels(name)].join(" "));
    const inName = `${en} ${shown}`, everything = `${inName} ${extra}`;
    if (!words.every(w => everything.includes(w))) return;
    const rank = en === q || shown === q ? 0 : en.startsWith(q) || shown.startsWith(q) ? 1 : words.every(w => inName.includes(w)) ? 2 : 3;
    out.push({ name, rank, i });
  });
  out.sort((a, b) => a.rank - b.rank || a.i - b.i);
  return [...new Set(out.map(x => x.name))].slice(0, CAP);
}
