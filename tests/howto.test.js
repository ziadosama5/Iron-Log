import { test } from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { HOWTO } from "../public/exercise-howto.js";
import { CATALOG } from "../public/exercise-catalog.js";
import { MUSCLES } from "../public/exercise-library.js";
import { isHold, bwDefault } from "../public/bodyweight.js";
import { defaultTarget } from "../public/progression.js";
import { groupsOfWords } from "../tools/catalog-maps.mjs";

test("every catalog exercise has How-to steps (English, short) and valid extra muscle groups", () => {
  assert.equal(Object.keys(HOWTO).length, CATALOG.length);
  for (const [name, group] of CATALOG.map(r => [r[0], r[1]])) {
    const h = HOWTO[name.toLowerCase()];
    assert.ok(h && h.steps.length >= 1, name);
    for (const s of h.steps) { assert.ok(s.length > 5 && s.length <= 400, name + ": " + s); assert.ok(/[A-Za-z]/.test(s), name); }
    for (const g of h.s) { assert.ok(MUSCLES.includes(g), name + " " + g); assert.notEqual(g, group, name + ": the main group is not repeated"); }
  }
});

test("the lazily loaded How-to file stays under 700 KB", () => {
  assert.ok(statSync(new URL("../public/exercise-howto.js", import.meta.url)).size <= 700 * 1024);
});

test("groupsOfWords maps dataset muscle words to library groups, skipping the main one", () => {
  assert.deepEqual(groupsOfWords(["quadriceps", "hamstrings", "calves", "core"], "Quads"), ["Hamstrings & Glutes", "Calves", "Core"]);
  assert.deepEqual(groupsOfWords(["triceps", "chest", "nonsense"], "Chest"), ["Triceps"]);
  assert.deepEqual(groupsOfWords(undefined), []);
});

test("holds: every dataset exercise of the hold kind is a timed hold and the others are not; weights are never holds", () => {
  for (const [name, , , , kind] of CATALOG) assert.equal(isHold(name), kind === "hold", name);
  assert.equal(isHold("Bench Press"), false);
  assert.equal(isHold("Plank"), true);
  const hold = CATALOG.find(r => r[4] === "hold")[0];
  assert.deepEqual(defaultTarget(hold), { sets: 3, min: 30, max: 60 });
});

test("body weight by default: exercises with no equipment or only body-weight stations", () => {
  const free = CATALOG.filter(r => r[2].length === 0);
  assert.ok(free.length > 150, "body-weight rows: " + free.length);
  for (const [name] of free.slice(0, 40)) assert.equal(bwDefault(name), true, name);
  assert.equal(bwDefault(CATALOG.find(r => r[2].includes("dumbbell"))[0]), false);
  assert.equal(bwDefault(CATALOG.find(r => r[2].includes("cable"))[0]), false);
});
