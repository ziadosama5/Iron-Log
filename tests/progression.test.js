import { test } from "node:test";
import assert from "node:assert/strict";
import { SET_TYPES, setType, kOf, isWorking, countsForVolume, countsAsSet, workingSets, volumeSets, countedSets,
  validTarget, cleanTargets, defaultTarget, targetFor, stepFor, suggestNext } from "../public/progression.js";
import { defaultRest } from "../public/workout-tools.js";

const S = (w, r, k) => (k ? { w, r, k } : { w, r });

test("setType reads k; anything unknown is a normal set", () => {
  assert.deepEqual(SET_TYPES, ["normal", "warmup", "drop"]);
  assert.equal(setType({ k: "w" }), "warmup");
  assert.equal(setType({ k: "d" }), "drop");
  for (const s of [{}, { k: "x" }, { k: 1 }, { k: null }, null, undefined]) assert.equal(setType(s), "normal", JSON.stringify(s));
  assert.equal(kOf("warmup"), "w"); assert.equal(kOf("drop"), "d"); assert.equal(kOf("normal"), undefined); assert.equal(kOf("nope"), undefined);
});

test("which sets count where", () => {
  const sets = [S(20, 10, "w"), S(80, 8), S(60, 12, "d")];
  assert.deepEqual(workingSets(sets), [S(80, 8)]);
  assert.deepEqual(volumeSets(sets), [S(80, 8), S(60, 12, "d")]);
  assert.deepEqual(countedSets(sets), [S(80, 8), S(60, 12, "d")]);
  assert.equal(isWorking(sets[0]), false); assert.equal(isWorking(sets[2]), false); assert.equal(isWorking(sets[1]), true);
  assert.equal(countsForVolume(sets[0]), false); assert.equal(countsForVolume(sets[2]), true);
  assert.equal(countsAsSet(sets[0]), false); assert.equal(countsAsSet(sets[2]), true);
  for (const f of [workingSets, volumeSets, countedSets]) { assert.deepEqual(f(undefined), []); assert.deepEqual(f(null), []); assert.deepEqual(f("x"), []); }
});

test("validTarget", () => {
  assert.equal(validTarget({ sets: 3, min: 8, max: 12 }), true);
  assert.equal(validTarget({ sets: 1, min: 1, max: 1 }), true);
  assert.equal(validTarget({ sets: 10, min: 50, max: 50 }), true);
  for (const bad of [{ sets: 0, min: 8, max: 12 }, { sets: 3, min: 12, max: 8 }, { sets: 11, min: 8, max: 12 }, { sets: 3, min: 0, max: 12 },
    { sets: 3, min: 8, max: 51 }, { sets: "3", min: 8, max: 12 }, { sets: 3.5, min: 8, max: 12 }, { sets: 3, min: 8 }, null, undefined, [], "x"]) {
    assert.equal(validTarget(bad), false, JSON.stringify(bad));
  }
});

test("cleanTargets keeps own valid entries only, including prototype-like names", () => {
  const r = cleanTargets({ "Bench Press": { sets: 3, min: 5, max: 8, extra: 1 }, x: { sets: 99, min: 1, max: 2 }, constructor: { sets: 3, min: 8, max: 12 }, y: "no" });
  assert.deepEqual(Object.keys(r).sort(), ["Bench Press", "constructor"]);
  assert.deepEqual(r["Bench Press"], { sets: 3, min: 5, max: 8 }, "extra keys dropped");
  assert.deepEqual(cleanTargets(null), {}); assert.deepEqual(cleanTargets([1]), {}); assert.deepEqual(cleanTargets("x"), {});
  assert.deepEqual(cleanTargets(JSON.parse('{"__proto__":{"sets":3,"min":8,"max":12}}')), {});
  assert.deepEqual(cleanTargets({ ["n".repeat(81)]: { sets: 3, min: 8, max: 12 } }), {}, "names over 80 characters");
});

test("defaultTarget: heavy compounds 5-8, isolation 10-15, everything else 8-12", () => {
  for (const n of ["Squat", "Deadlift", "Bench Press", "Overhead Press", "Leg Press", "Romanian Deadlift"]) assert.deepEqual(defaultTarget(n), { sets: 3, min: 5, max: 8 }, n);
  for (const n of ["Lat Pulldown", "Barbell Row", "Pull-up", "Incline Dumbbell Press", "My weird move"]) assert.deepEqual(defaultTarget(n), { sets: 3, min: 8, max: 12 }, n);
  for (const n of ["Lateral Raise", "Barbell Curl", "Standing Calf Raise", "Tricep Pushdown", "Cable Crunch"]) assert.deepEqual(defaultTarget(n), { sets: 3, min: 10, max: 15 }, n);
});

test("the 5-8 group is the same group the 3:00 rest timer uses", () => {
  for (const n of ["Squat", "Deadlift", "Bench Press", "Overhead Press", "Leg Press", "Barbell Row", "Pull-up", "Hip Thrust", "Lateral Raise", "Barbell Curl"]) {
    assert.equal(defaultTarget(n).min === 5, defaultRest(n) === 180, n);
  }
});

test("targetFor: a valid saved target wins, anything else is the default", () => {
  const saved = { sets: 4, min: 6, max: 10 };
  assert.deepEqual(targetFor({ targets: { "Squat": saved } }, "Squat"), saved);
  assert.deepEqual(targetFor({ targets: { "Squat": { sets: 3, min: 12, max: 8 } } }, "Squat"), defaultTarget("Squat"));
  assert.deepEqual(targetFor(undefined, "Squat"), defaultTarget("Squat"));
  assert.deepEqual(targetFor({}, "Squat"), defaultTarget("Squat"));
  assert.deepEqual(targetFor({ targets: {} }, "constructor"), defaultTarget("constructor"), "inherited names are not targets");
  assert.deepEqual(targetFor({ targets: { "Squat": saved } }, "Bench Press"), defaultTarget("Bench Press"));
});

test("stepFor: 5 kg for big lower-body and barbell back lifts, 2.5 kg otherwise", () => {
  for (const n of ["Squat", "Deadlift", "Leg Press", "Barbell Row", "Hip Thrust", "T-bar Row"]) assert.equal(stepFor(n), 5, n);
  for (const n of ["Bench Press", "Lateral Raise", "Dumbbell Squat", "One-arm Dumbbell Row", "Overhead Press", "My weird move"]) assert.equal(stepFor(n), 2.5, n);
});

test("suggestNext: double progression on the heaviest working weight", () => {
  const target = { sets: 3, min: 5, max: 8 }, step = 2.5, go = last => suggestNext({ last, target, step });
  assert.deepEqual(go([S(80, 8), S(80, 8), S(80, 8)]), { kind: "increase", w: 82.5, r: 5 });
  assert.deepEqual(go([S(80, 8), S(80, 8), S(80, 7)]), { kind: "hold", w: 80, r: 8 });
  assert.deepEqual(go([S(80, 6), S(80, 6), S(80, 5)]), { kind: "hold", w: 80, r: 6 });
  assert.deepEqual(go([S(80, 4), S(80, 4), S(80, 4)]), { kind: "hold", w: 80, r: 5, low: true });
  assert.deepEqual(go([S(80, 8), S(80, 8)]), { kind: "hold", w: 80, r: 8 }, "fewer sets than the target is not enough to add weight");
  assert.deepEqual(go([S(40, 10, "w"), S(80, 8), S(80, 8), S(80, 8), S(60, 12, "d")]), { kind: "increase", w: 82.5, r: 5 }, "warm-ups and drops are ignored");
  assert.deepEqual(go([S(60, 12), S(80, 8), S(80, 8), S(80, 8)]), { kind: "increase", w: 82.5, r: 5 }, "judged at the top weight");
  assert.deepEqual(go([S(82.25, 8), S(82.25, 8), S(82.25, 8)]), { kind: "increase", w: 84.75, r: 5 });
});

test("suggestNext: nothing to say without working sets or without a weight", () => {
  const target = { sets: 3, min: 5, max: 8 };
  for (const last of [null, undefined, [], [S(40, 10, "w")], [S(0, 15), S(0, 15), S(0, 15)]]) assert.equal(suggestNext({ last, target, step: 2.5 }), null, JSON.stringify(last));
});
