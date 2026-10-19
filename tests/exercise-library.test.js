import { test } from "node:test";
import assert from "node:assert/strict";
import { LIB, MUSCLES, ALL_EX, ALIASES, resolveAlias, TEMPLATES, muscleOf, fillFocus, fillAllFocus, migrateProgram, PROGRAM_VERSION } from "../public/exercise-library.js";

test("every template day is tagged with the muscle group of each exercise", () => {
  for (const t of TEMPLATES) for (const d of t.days) for (const ex of d.exercises) {
    const m = muscleOf(ex);
    assert.ok(m, `${ex} is not in the library`);
    assert.ok(d.focus.includes(m), `${t.name} / ${d.name}: ${ex} needs ${m}`);
  }
});

test("muscleOf is case-insensitive and null for custom exercises", () => {
  assert.equal(muscleOf("barbell curl"), "Biceps");
  assert.equal(muscleOf("Deadlift"), "Back");
  assert.equal(muscleOf("My Custom Thing"), null);
});

test("fillFocus adds missing groups in the standard order and keeps existing ones", () => {
  const day = { focus: ["Chest", "Back", "Shoulders"], exercises: ["Bench Press", "Barbell Curl", "Tricep Pushdown"] };
  assert.deepEqual(fillFocus(day), ["Chest", "Back", "Shoulders", "Biceps", "Triceps"]);
  assert.deepEqual(fillFocus({ focus: ["Core"], exercises: ["My Custom Thing"] }), ["Core"]);
  assert.deepEqual(fillFocus({ exercises: ["Squat"] }), ["Quads"]);
});

test("fillAllFocus reports changes and is idempotent", () => {
  const days = [
    { id: "a", name: "Upper A", focus: ["Chest"], exercises: ["Bench Press", "Hammer Curl"], weekdays: [1] },
    { id: "b", name: "Legs", focus: ["Quads"], exercises: ["Squat"], weekdays: [] }
  ];
  const r1 = fillAllFocus(days);
  assert.equal(r1.changed, true);
  assert.deepEqual(r1.days[0], { id: "a", name: "Upper A", focus: ["Chest", "Biceps"], exercises: ["Bench Press", "Hammer Curl"], weekdays: [1] });
  assert.equal(r1.days[1], days[1]);
  assert.deepEqual(days[0].focus, ["Chest"], "input not mutated");
  assert.equal(fillAllFocus(r1.days).changed, false);
});

test("MUSCLES follows LIB order", () => assert.deepEqual(MUSCLES, Object.keys(LIB)));

test("migrateProgram fills focus once for old program docs", () => {
  const old = { days: [{ id: "a", name: "Upper A", focus: ["Chest"], exercises: ["Bench Press", "Barbell Curl"], weekdays: [] }] };
  const r = migrateProgram(old);
  assert.equal(r.needsSave, true);
  assert.deepEqual(r.days[0].focus, ["Chest", "Biceps"]);
});
test("migrateProgram leaves v2 docs alone, even if a tag was removed on purpose", () => {
  const doc = { v: 2, days: [{ id: "a", name: "Upper A", focus: ["Chest"], exercises: ["Bench Press", "Barbell Curl"], weekdays: [] }] };
  const r = migrateProgram(doc);
  assert.equal(r.needsSave, false);
  assert.equal(r.days, doc.days);
});
test("migrateProgram stamps old docs even when nothing changes, and skips empty programs", () => {
  assert.equal(migrateProgram({ days: [{ id: "b", name: "Legs", focus: ["Quads"], exercises: ["Squat"] }] }).needsSave, true);
  assert.equal(migrateProgram({ days: [] }).needsSave, false);
  assert.equal(migrateProgram({}).needsSave, false);
});
test("PROGRAM_VERSION is 2", () => assert.equal(PROGRAM_VERSION, 2));

test("library names are unique ignoring case, and each is in one group", () => {
  const all = Object.values(LIB).flat().map(n => n.toLowerCase());
  assert.equal(new Set(all).size, all.length);
});

test("merged exercises are gone from the library but resolve to the one that stays", () => {
  for (const [old, keep] of Object.entries(ALIASES)) {
    assert.ok(!ALL_EX.some(n => n.toLowerCase() === old), `${old} should not be listed`);
    assert.ok(ALL_EX.includes(keep), `${keep} must exist`);
    assert.equal(muscleOf(old), muscleOf(keep));
    assert.equal(resolveAlias(old.toUpperCase()), keep);
  }
  assert.equal(resolveAlias("Bench Press"), "Bench Press");
});

// ---- equipment model (library 2.0) ----
import { EQUIPMENT, EXERCISES, equipmentOf, exercisesFor } from "../public/exercise-library.js";

test("EQUIPMENT: 39 unique ids in three groups; every tag used by an exercise exists", () => {
  assert.equal(EQUIPMENT.length, 39);
  assert.equal(new Set(EQUIPMENT.map(e => e.id)).size, 39);
  for (const e of EQUIPMENT) { assert.ok(["weights", "station", "machine"].includes(e.group), e.id); assert.ok(e.name.trim().length > 0, e.id); }
  const ids = new Set(EQUIPMENT.map(e => e.id));
  for (const x of EXERCISES) for (const q of x.eq) assert.ok(ids.has(q), `${x.name}: unknown equipment ${q}`);
});

test("EXERCISES: unique names, valid groups, LIB/ALL_EX derived from them", () => {
  const key = n => n.toLowerCase().replace(/[^a-z0-9]+/g, "");
  assert.equal(new Set(EXERCISES.map(x => key(x.name))).size, EXERCISES.length, "names unique ignoring case and punctuation");
  for (const x of EXERCISES) assert.ok(MUSCLES.includes(x.group), `${x.name}: ${x.group}`);
  for (const g of MUSCLES) assert.deepEqual(LIB[g], EXERCISES.filter(x => x.group === g).map(x => x.name));
  assert.equal(ALL_EX.length, EXERCISES.length);
});

test("equipment tags agree with the words in the exercise name", () => {
  const word = { Smith: "smith", Cable: "cable", Dumbbell: "dumbbell", Barbell: "barbell", "EZ-bar": "ez-bar", Kettlebell: "kettlebell", "Trap Bar": "trap-bar" };
  const machineIds = new Set(EQUIPMENT.filter(e => e.group === "machine").map(e => e.id));
  const machineName = /Machine|Pec Deck|Leg Press|Hack Squat|Leg Extension|Lat Pulldown|Close-grip Pulldown|Reverse-grip Pulldown|Assisted|T-bar|Leg Curl|^Hip (Abduction|Adduction)|^(Standing|Seated) Calf/;
  for (const x of EXERCISES) {
    for (const [w, id] of Object.entries(word)) if (x.name.includes(w)) assert.ok(x.eq.includes(id), `${x.name} needs ${id}`);
    if (machineName.test(x.name) && !/Smith|Cable|Dumbbell|Barbell/.test(x.name)) assert.ok(x.eq.some(q => machineIds.has(q)), `${x.name} needs a machine`);
  }
});

test("equipmentOf: required ids for library names, null for custom ones", () => {
  assert.deepEqual(equipmentOf("bench press"), ["barbell", "bench"]);
  assert.deepEqual(equipmentOf("Pec Deck"), ["pec-deck"]);
  assert.deepEqual(equipmentOf("Push-up"), []);
  assert.equal(equipmentOf("My Custom Thing"), null);
});

test("exercisesFor: only exercises whose every required item is in the gym", () => {
  const none = exercisesFor([]);
  for (const n of ["Push-up", "Plank", "Crunch"]) assert.ok(none.includes(n), n);
  assert.ok(none.every(n => equipmentOf(n).length === 0));
  const bb = exercisesFor(["barbell", "bench"]);
  assert.ok(bb.includes("Bench Press") && bb.includes("Incline Barbell Press"));
  assert.ok(!bb.includes("Dumbbell Bench Press") && !bb.includes("Squat"));
  assert.deepEqual(exercisesFor(EQUIPMENT.map(e => e.id)), ALL_EX);
});

test("ALIASES is empty and resolveAlias leaves every name alone, even names like constructor", () => {
  assert.deepEqual(ALIASES, {});
  for (const n of ["Squat", "constructor", "toString", "__proto__", "My Custom Thing"]) assert.equal(resolveAlias(n), n);
});

// ---- library 2.0 final shape ----
test("library 2.0: 183 exercises in the agreed per-group counts, every equipment item used", () => {
  assert.equal(EXERCISES.length, 183);
  const counts = { "Chest": 22, "Back": 28, "Shoulders": 22, "Biceps": 16, "Triceps": 18, "Quads": 23, "Hamstrings & Glutes": 24, "Calves": 8, "Core": 22 };
  for (const [g, n] of Object.entries(counts)) assert.equal(LIB[g].length, n, g);
  const used = new Set(EXERCISES.flatMap(x => x.eq));
  assert.deepEqual(EQUIPMENT.filter(e => !used.has(e.id)).map(e => e.id), [], "every equipment item is needed by at least one exercise");
});

test("library 2.0: the four exercises that were merged earlier are their own exercises again", () => {
  for (const n of ["Seated Leg Curl", "Cable Lateral Raise", "Dumbbell Shoulder Press", "Glute Bridge"]) assert.ok(ALL_EX.includes(n), n);
  assert.deepEqual(equipmentOf("Seated Leg Curl"), ["seated-leg-curl"]);
  assert.ok(!exercisesFor(["leg-curl"]).includes("Seated Leg Curl"));
});

// ---- review fixes ----
test("exercisesFor tolerates bad input", () => {
  assert.deepEqual(exercisesFor("barbell"), exercisesFor([]));
  assert.deepEqual(exercisesFor(null), exercisesFor([]));
});

test("equipment tags follow one rack rule: bar taken off a rack onto the back/shoulders needs a rack", () => {
  for (const n of ["Squat", "Front Squat", "Box Squat", "Good Morning", "Barbell Lunge", "Barbell Calf Raise"]) assert.ok(equipmentOf(n).includes("rack"), n);
  assert.deepEqual(equipmentOf("Spider Curl"), ["dumbbell", "bench"]);
  assert.deepEqual(equipmentOf("Smith Machine Split Squat"), ["smith", "bench"]);
});

test("the bench and seated-row machine have names users read correctly", () => {
  assert.equal(EQUIPMENT.find(e => e.id === "bench").name, "Bench (flat / incline)");
  assert.equal(EQUIPMENT.find(e => e.id === "seated-row").name, "Chest-supported row machine");
});

// ---- My Gym ----
import { GYM_PRESETS, gymFilter, gymCounts, sameGym, typeaheadNames } from "../public/exercise-library.js";

test("GYM_PRESETS: fixed order, real ids, nested from Bodyweight to Full gym", () => {
  assert.deepEqual(GYM_PRESETS.map(p => p.id), ["bodyweight", "home", "basic", "full"]);
  assert.deepEqual(GYM_PRESETS.map(p => p.name), ["Bodyweight only", "Home", "Basic gym", "Full gym"]);
  const all = new Set(EQUIPMENT.map(e => e.id));
  for (const p of GYM_PRESETS) {
    assert.equal(new Set(p.equipment).size, p.equipment.length, p.id + " has no duplicates");
    for (const id of p.equipment) assert.ok(all.has(id), p.id + ": " + id);
  }
  assert.deepEqual(GYM_PRESETS[0].equipment, []);
  assert.equal(GYM_PRESETS[3].equipment.length, EQUIPMENT.length);
  const basicIds = EQUIPMENT.filter(e => e.group === "weights" || e.group === "station").map(e => e.id);
  assert.deepEqual([...GYM_PRESETS[2].equipment].sort(), [...basicIds].sort());
  for (let i = 0; i < 3; i++) {
    const next = new Set(GYM_PRESETS[i + 1].equipment);
    for (const id of GYM_PRESETS[i].equipment) assert.ok(next.has(id), GYM_PRESETS[i].id + " is inside " + GYM_PRESETS[i + 1].id + ": " + id);
  }
});

test("gymFilter: unset keeps everything, [] keeps bodyweight and custom names, order is preserved", () => {
  const names = ["Bench Press", "Push-up", "My Custom Lift", "Pec Deck"];
  assert.deepEqual(gymFilter(names, undefined), names);
  assert.deepEqual(gymFilter(names, null), names);
  assert.deepEqual(gymFilter(names, []), ["Push-up", "My Custom Lift"]);
  assert.deepEqual(gymFilter(names, ["barbell", "bench"]), ["Bench Press", "Push-up", "My Custom Lift"]);
  assert.deepEqual(gymFilter(names, ["pec-deck", "bench", "barbell"]), names);
  assert.deepEqual(gymFilter(["Bench Press"], ["barbell", "bench", "nonsense"]), ["Bench Press"], "unknown ids are ignored");
  assert.deepEqual(gymFilter([], []), []);
});

test("gymCounts counts known items and available exercises", () => {
  const none = gymCounts([]);
  assert.equal(none.items, 0);
  assert.equal(none.itemsTotal, EQUIPMENT.length);
  assert.equal(none.exercisesTotal, EXERCISES.length);
  assert.equal(none.exercises, EXERCISES.filter(e => e.eq.length === 0).length);
  const all = gymCounts(EQUIPMENT.map(e => e.id));
  assert.equal(all.items, EQUIPMENT.length);
  assert.equal(all.exercises, EXERCISES.length);
  assert.equal(gymCounts(["barbell", "barbell", "nonsense"]).items, 1, "duplicates and unknown ids do not count");
  assert.equal(gymCounts(undefined).items, 0);
});

test("sameGym compares sets of ids", () => {
  assert.equal(sameGym(["a", "b"], ["b", "a"]), true);
  assert.equal(sameGym([], ["a"]), false);
  assert.equal(sameGym(undefined, []), false);
  assert.equal(sameGym([], []), true);
  assert.equal(equipmentOf("Push-up").length, 0);
});

import { hiddenCount } from "../public/exercise-library.js";

test("hiddenCount: 0 when unset, counts exactly what gymFilter drops, custom names never count", () => {
  assert.equal(hiddenCount([LIB.Chest], undefined), 0);
  assert.equal(hiddenCount([["My Custom Lift"]], []), 0);
  const gym = ["barbell", "bench"];
  assert.equal(hiddenCount([LIB.Chest], gym), LIB.Chest.length - gymFilter(LIB.Chest, gym).length);
  assert.ok(hiddenCount([LIB.Chest], []) > 0, "a bodyweight-only gym hides machine and bar exercises");
  assert.equal(hiddenCount([LIB.Chest, LIB.Back], gym), hiddenCount([LIB.Chest], gym) + hiddenCount([LIB.Back], gym));
  assert.equal(hiddenCount([], []), 0);
});

test("typeaheadNames: history and day exercises are never filtered, library names are, no duplicates", () => {
  const all = ["Bench Press", "Push-up", "Pec Deck"];
  assert.deepEqual(typeaheadNames({ history: ["Cable Fly"], dayNames: ["Bench Press"], all, gym: [] }), ["Cable Fly", "Bench Press", "Push-up"]);
  assert.deepEqual(typeaheadNames({ history: [], dayNames: [], all, gym: undefined }), all);
  assert.deepEqual(typeaheadNames({ history: ["Push-up"], dayNames: ["Push-up"], all, gym: [] }), ["Push-up"]);
});
