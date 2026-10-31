import { test } from "node:test";
import assert from "node:assert/strict";
import { searchExercises } from "../public/exercise-search.js";
import { ALL_EX, EQUIPMENT, equipmentOf, muscleOf, gymFilter } from "../public/exercise-library.js";
import { AR } from "../public/lang-ar.js";

const opts = (lang = "en", names = ALL_EX) => ({
  names,
  label: n => (lang === "ar" ? AR.names.ex[n] || n : n),
  equipmentLabels: n => (equipmentOf(n) || []).map(id => (lang === "ar" ? AR.names.equipment[id] : EQUIPMENT.find(e => e.id === id).name)),
  muscleLabel: n => (lang === "ar" ? AR.names.muscle[muscleOf(n)] : muscleOf(n))
});

test("empty or blank queries find nothing", () => {
  for (const q of ["", "   ", null, undefined]) assert.deepEqual(searchExercises(q, opts()), []);
});

test("every typed word must match, in any order", () => {
  const a = searchExercises("full squat", opts()), b = searchExercises("squat full", opts());
  assert.ok(a.includes("Smith Machine Full Squat"));
  assert.deepEqual(a, b);
  assert.ok(a.every(n => /full/i.test(n) && /squat/i.test(n)));
  assert.deepEqual(searchExercises("zzzz qqqq", opts()), []);
});

test("equipment and muscle words match too", () => {
  const dumbbell = searchExercises("dumbbell", opts());
  assert.ok(dumbbell.length > 100 && dumbbell.every(n => /dumbbell/i.test(n) || (equipmentOf(n) || []).includes("dumbbell")));
  const chest = searchExercises("chest dumbbell press", opts());
  assert.ok(chest.includes("Dumbbell Bench Press") || chest.includes("Incline Dumbbell Press"));
});

test("ranking: the exact name first, then names that start with the query, then the rest", () => {
  assert.equal(searchExercises("Bench Press", opts())[0], "Bench Press");
  assert.equal(searchExercises("pec deck", opts())[0], "Pec Deck");
  const r = searchExercises("curl", opts());
  const firstStarts = r.findIndex(n => /^curl/i.test(n)), firstInside = r.findIndex(n => !/^curl/i.test(n));
  assert.ok(firstStarts === -1 || firstStarts < firstInside || firstInside === -1);
});

test("Arabic: letters fold (أ/ا, ة/ه, ى/ي, diacritics) and the Arabic name is searched", () => {
  const sq = searchExercises("سكوات", opts("ar"));
  assert.ok(sq.length > 20, "squats found by their Arabic name: " + sq.length);
  assert.ok(sq.every(n => /سكوات/.test(AR.names.ex[n]) || (equipmentOf(n) || []).some(id => /سكوات/.test(AR.names.equipment[id]))));
  assert.deepEqual(searchExercises("سَكوات", opts("ar")), sq, "diacritics are ignored");
  assert.deepEqual(searchExercises("اندفاع", opts("ar")), searchExercises("أندفاع", opts("ar")), "alef forms fold");
});

test("a name the caller filtered out never appears; the result is capped", () => {
  const names = gymFilter(ALL_EX, ["dumbbell"]);
  const r = searchExercises("squat", opts("en", names));
  assert.ok(r.every(n => names.includes(n)));
  assert.ok(!r.includes("Bench Press") && !r.some(n => (equipmentOf(n) || []).includes("barbell")));
  assert.ok(searchExercises("a", opts()).length <= 300);
});

test("results are unique and stable between calls", () => {
  const r = searchExercises("press", opts());
  assert.equal(new Set(r).size, r.length);
  assert.deepEqual(r, searchExercises("press", opts()));
});
