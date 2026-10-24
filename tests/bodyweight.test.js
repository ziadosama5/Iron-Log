import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_EX } from "../public/exercise-library.js";
import { BW_STATIONS, bwDefault, isHold, bwFor, cleanBodyweight, loadKg, bwScore, bestBwSet, formatLoad } from "../public/bodyweight.js";

const PINNED = ["Push-up", "Chest Dip", "Incline Push-up", "Decline Push-up", "Pull-up", "Chin-up", "Back Extension", "Wide-grip Pull-up", "Assisted Pull-up",
  "Dip", "Bench Dip", "Diamond Push-up", "Step-up", "Bodyweight Squat", "Sissy Squat", "Wall Sit", "Glute Bridge", "Glute-Ham Raise", "Donkey Kick",
  "Donkey Calf Raise", "Single-leg Calf Raise", "Plank", "Hanging Leg Raise", "Ab Wheel Rollout", "Russian Twist", "Crunch", "Side Plank", "Lying Leg Raise",
  "Hanging Knee Raise", "Captain's Chair Leg Raise", "Decline Sit-up", "Sit-up", "Reverse Crunch", "Bicycle Crunch", "V-up", "Flutter Kick", "Mountain Climber", "Dead Bug"];

test("the bodyweight exercises of the library are exactly the pinned list (a library change must be a conscious one)", () => {
  assert.deepEqual(ALL_EX.filter(bwDefault).sort(), [...PINNED].sort());
  assert.equal(PINNED.length, 38);
  assert.equal(BW_STATIONS.length, 9);
});

test("bwDefault: weighted lifts, custom names and case", () => {
  assert.equal(bwDefault("Bench Press"), false);
  assert.equal(bwDefault("Barbell Row"), false);
  assert.equal(bwDefault("My custom move"), false, "not in the library");
  assert.equal(bwDefault("pull-up"), true, "case-insensitive");
  assert.equal(bwDefault(undefined), false);
});

test("isHold: planks and wall sits count seconds", () => {
  for (const n of ["Plank", "Side Plank", "Wall Sit", "plank"]) assert.equal(isHold(n), true, n);
  for (const n of ["Push-up", "Crunch", "Pull-up", undefined]) assert.equal(isHold(n), false, String(n));
});

test("bwFor: an override wins, own keys only", () => {
  assert.equal(bwFor({ bodyweight: { "Barbell Row": true } }, "Barbell Row"), true);
  assert.equal(bwFor({ bodyweight: { "Push-up": false } }, "Push-up"), false);
  assert.equal(bwFor({}, "Push-up"), true);
  assert.equal(bwFor(undefined, "Push-up"), true);
  assert.equal(bwFor({ bodyweight: {} }, "constructor"), false, "inherited names are not overrides");
  assert.equal(bwFor({ bodyweight: { constructor: true } }, "constructor"), true);
});

test("cleanBodyweight keeps own boolean entries only", () => {
  assert.deepEqual(cleanBodyweight({ Row: true, "Push-up": false, A: "yes", B: 1, C: null }), { Row: true, "Push-up": false });
  assert.deepEqual(cleanBodyweight(JSON.parse('{"__proto__":true}')), {});
  assert.deepEqual(cleanBodyweight({ ["n".repeat(81)]: true, "": true }), {});
  for (const bad of [null, undefined, [], "x", 5]) assert.deepEqual(cleanBodyweight(bad), {});
  const big = {}; for (let i = 0; i < 350; i++) big["Exercise " + i] = true;
  assert.equal(Object.keys(cleanBodyweight(big)).length, 300);
});

test("loadKg is the extra load that counts as lifted", () => {
  assert.equal(loadKg({ w: 0 }), 0); assert.equal(loadKg({ w: 10 }), 10); assert.equal(loadKg({ w: -20 }), 0);
  assert.equal(loadKg({ w: "x" }), 0); assert.equal(loadKg({}), 0); assert.equal(loadKg(null), 0);
});

test("bwScore: more extra kg first, then more reps, less assistance is better, always positive", () => {
  assert.ok(bwScore({ w: 10, r: 5 }) > bwScore({ w: 0, r: 50 }));
  assert.ok(bwScore({ w: 0, r: 9 }) > bwScore({ w: 0, r: 8 }));
  assert.ok(bwScore({ w: -10, r: 5 }) > bwScore({ w: -20, r: 30 }));
  assert.ok(bwScore({ w: 2.5, r: 1 }) > bwScore({ w: 0, r: 999 }));
  for (const w of [-500, -20, 0, 2000]) assert.ok(bwScore({ w, r: 1 }) > 0, String(w));
  assert.ok(bwScore({ w: -9999, r: 1 }) > 0, "clamped, not negative");
});

test("bestBwSet picks the highest score; nothing to pick gives null", () => {
  const sets = [{ w: 0, r: 12 }, { w: 10, r: 6 }, { w: 10, r: 8 }, { w: -5, r: 30 }];
  assert.deepEqual(bestBwSet(sets), { w: 10, r: 8 });
  assert.equal(bestBwSet([]), null); assert.equal(bestBwSet(null), null); assert.equal(bestBwSet(undefined), null);
});

test("formatLoad: BW, plus, minus with the real minus sign", () => {
  assert.equal(formatLoad(0), "BW"); assert.equal(formatLoad(10), "+10"); assert.equal(formatLoad(2.5), "+2.5");
  assert.equal(formatLoad(-20), "−20"); assert.equal(formatLoad(-17.5), "−17.5");
  assert.equal(formatLoad(0, "وزن الجسم"), "وزن الجسم");
  assert.equal(formatLoad(12.50), "+12.5");
});
