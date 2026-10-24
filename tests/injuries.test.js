import { test } from "node:test";
import assert from "node:assert/strict";
import { AREAS, JOINTS, jointsOf, avoidFilter, avoidedBecause, cleanAvoid, hiddenAvoidCount } from "../public/injuries.js";

const J = { "Squat": ["knee", "hip", "lower-back", "ankle"], "Bench Press": ["shoulder", "elbow", "wrist"], "Crunch": [], "Lateral Raise": ["shoulder"] };

test("the seven body areas, in order", () => {
  assert.deepEqual(AREAS, ["shoulder", "elbow", "wrist", "lower-back", "hip", "knee", "ankle"]);
  assert.equal(typeof JOINTS, "object");
});

test("jointsOf: case-insensitive, copies, and never throws on odd names", () => {
  assert.deepEqual(jointsOf("Squat", J), ["knee", "hip", "lower-back", "ankle"]);
  assert.deepEqual(jointsOf("squat", J), ["knee", "hip", "lower-back", "ankle"]);
  for (const n of ["Zottman", "constructor", "__proto__", undefined, null, 5, "Crunch"]) assert.deepEqual(jointsOf(n, J), [], String(n));
  jointsOf("Squat", J).push("x");
  assert.equal(J.Squat.length, 4, "the table is not changed through the result");
});

test("avoidFilter: by area, by single name (any case), both, and nothing", () => {
  const names = ["Squat", "Bench Press", "Crunch", "Zottman"];
  assert.deepEqual(avoidFilter(names, { areas: ["knee"] }, J), ["Bench Press", "Crunch", "Zottman"]);
  assert.deepEqual(avoidFilter(names, { exercises: ["bench press"] }, J), ["Squat", "Crunch", "Zottman"]);
  assert.deepEqual(avoidFilter(names, { areas: ["knee"], exercises: ["BENCH PRESS"] }, J), ["Crunch", "Zottman"]);
  assert.deepEqual(avoidFilter(names, { exercises: ["zottman"] }, J), ["Squat", "Bench Press", "Crunch"], "a custom name can be avoided by name");
  assert.deepEqual(avoidFilter(names, { areas: ["moon"] }, J), names, "an unknown area removes nothing");
  for (const none of [{ areas: [], exercises: [] }, {}, null, undefined]) assert.equal(avoidFilter(names, none, J), names, JSON.stringify(none));
  assert.deepEqual(names, ["Squat", "Bench Press", "Crunch", "Zottman"], "the input is not changed");
});

test("avoidedBecause says why, areas in the fixed order", () => {
  assert.deepEqual(avoidedBecause("Squat", { areas: ["ankle", "knee"], exercises: ["squat"] }, J), { exercise: true, areas: ["knee", "ankle"] });
  assert.deepEqual(avoidedBecause("Squat", { areas: ["shoulder"] }, J), { exercise: false, areas: [] });
  assert.deepEqual(avoidedBecause("Crunch", { areas: ["knee"] }, J), { exercise: false, areas: [] });
  assert.deepEqual(avoidedBecause("Squat", null, J), { exercise: false, areas: [] });
  assert.deepEqual(avoidedBecause("Zottman", { exercises: ["Zottman"] }, J), { exercise: true, areas: [] });
});

test("cleanAvoid keeps known areas in order and tidy exercise names", () => {
  assert.deepEqual(cleanAvoid({ areas: ["knee", "knee", "moon", "shoulder"], exercises: [" Squat ", "squat", "", 5, "x".repeat(81)] }), { areas: ["shoulder", "knee"], exercises: ["Squat"] });
  const many = Array.from({ length: 120 }, (_, i) => "Exercise " + i);
  assert.equal(cleanAvoid({ exercises: many }).exercises.length, 100);
  for (const bad of [{ areas: [], exercises: [] }, null, [], "x", 5, undefined, { areas: "knee" }, { exercises: "Squat" }]) assert.deepEqual(cleanAvoid(bad), {}, JSON.stringify(bad));
  assert.deepEqual(cleanAvoid({ areas: ["hip"] }), { areas: ["hip"] }, "a key without entries is left out");
});

test("hiddenAvoidCount adds up what the filter removes", () => {
  assert.equal(hiddenAvoidCount([["Squat", "Crunch"], ["Bench Press", "Squat"]], { areas: ["knee"] }, J), 2);
  assert.equal(hiddenAvoidCount([["Squat"]], {}, J), 0);
  assert.equal(hiddenAvoidCount([], { areas: ["knee"] }, J), 0);
});
