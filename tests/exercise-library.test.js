import { test } from "node:test";
import assert from "node:assert/strict";
import { LIB, MUSCLES, TEMPLATES, muscleOf, fillFocus, fillAllFocus, migrateProgram, PROGRAM_VERSION } from "../public/exercise-library.js";

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
