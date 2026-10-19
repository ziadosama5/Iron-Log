import test from "node:test";
import assert from "node:assert/strict";
import { BADGES } from "../public/achievements.js";
import { FAMILIES, familyOf, tierFor, familyState, allFamilies, closestFamily, ICONS } from "../public/badge-art.js";

const mk = (earnedIds = [], values = {}) => BADGES.map(b => ({ id: b.id, name: b.name, group: b.group, earned: earnedIds.includes(b.id) ? "2026-01-01" : null, value: values[b.id] ?? (earnedIds.includes(b.id) ? b.target : 0), target: b.target }));
const fam = id => FAMILIES.find(f => f.id === id);

test("every badge belongs to exactly one family and no id is invented", () => {
  const ids = FAMILIES.flatMap(f => f.ids);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), BADGES.map(b => b.id).sort());
  assert.equal(FAMILIES.length, 9);
  assert.equal(new Set(FAMILIES.map(f => f.name)).size, FAMILIES.length);
  assert.equal(familyOf("pr-10").id, "pr");
  assert.equal(familyOf("nope"), null);
});

test("tierFor", () => {
  assert.equal(tierFor(0, 5), "locked");
  assert.equal(tierFor(1, 5), "bronze");
  assert.equal(tierFor(3, 5), "silver");
  assert.equal(tierFor(5, 5), "gold");
  assert.equal(tierFor(1, 2), "silver");
  assert.equal(tierFor(2, 2), "gold");
  assert.equal(tierFor(1, 3), "bronze");
  assert.equal(tierFor(2, 3), "silver");
  assert.equal(tierFor(3, 3), "gold");
});

test("familyState counts earned levels and points at the next one", () => {
  const s = familyState(fam("workouts"), mk(["workouts-1", "workouts-10"], { "workouts-50": 20 }));
  assert.equal(s.level, 2); assert.equal(s.of, 5); assert.equal(s.tier, "silver");
  assert.equal(s.next.id, "workouts-50"); assert.ok(Math.abs(s.pct - 0.4) < 1e-9);
  assert.equal(s.steps.length, 5); assert.equal(s.steps[0].earned, "2026-01-01"); assert.equal(s.steps[2].earned, null);
});

test("a later level earned without an earlier one counts only the earned", () => {
  const s = familyState(fam("workouts"), mk(["workouts-100"]));
  assert.equal(s.level, 1); assert.equal(s.next.id, "workouts-1");
});

test("a finished family is gold with no next", () => {
  const s = familyState(fam("pr"), mk(["pr-1", "pr-10"]));
  assert.equal(s.level, 2); assert.equal(s.tier, "gold"); assert.equal(s.next, null); assert.equal(s.pct, 1);
});

test("pct is clamped and never NaN", () => {
  const list = mk([], { "workouts-1": 99 });
  assert.equal(familyState(fam("workouts"), list).pct, 1);
  const odd = mk().map(b => (b.id === "workouts-1" ? { ...b, target: 0, value: undefined } : b));
  assert.equal(familyState(fam("workouts"), odd).pct, 0);
  assert.equal(familyState(fam("workouts"), mk([], { "workouts-1": -3 })).pct, 0);
});

test("closestFamily picks the highest progress among unfinished families", () => {
  const list = mk(["pr-1", "pr-10"], { "workouts-1": 0.5, "streak-4": 3 });
  const c = closestFamily(allFamilies(list));
  assert.equal(c.id, "streak");
  assert.equal(closestFamily(allFamilies(mk(BADGES.map(b => b.id)))), null);
});

test("every family icon exists", () => {
  for (const f of FAMILIES) assert.ok(ICONS[f.icon], f.icon);
  for (const k of ["lock", "star", "flame", "trophy", "crown", "bolt"]) assert.ok(ICONS[k], k);
});
