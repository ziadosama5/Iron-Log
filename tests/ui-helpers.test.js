import { test } from "node:test";
import assert from "node:assert/strict";
import { themeAttr, sortTips, withWeight } from "../public/ui-helpers.js";

test("themeAttr", () => {
  assert.equal(themeAttr("light"), "light");
  assert.equal(themeAttr("dark"), "dark");
  assert.equal(themeAttr("system"), null);
  assert.equal(themeAttr(undefined), null);
  assert.equal(themeAttr("pink"), null);
});

test("sortTips puts warnings first, keeps order within a tone", () =>
  assert.deepEqual(sortTips([{ tone: "good", id: 1 }, { tone: "warn", id: 2 }, { tone: "info", id: 3 }, { tone: "warn", id: 4 }]).map(t => t.id), [2, 4, 3, 1]));

test("withWeight keeps other fields", () => {
  const e = { date: "2026-10-17", weight: 81, waist: 84, pbf: 18, updated: 5 };
  assert.deepEqual(withWeight(e, "2026-10-17", 80.4), { date: "2026-10-17", weight: 80.4, waist: 84, pbf: 18, updated: 5 });
  assert.deepEqual(withWeight(undefined, "2026-10-18", 80), { date: "2026-10-18", weight: 80 });
  assert.equal(e.weight, 81, "input not mutated");
});

import { visibleItems } from "../public/ui-helpers.js";

test("visibleItems shows the first N, or everything when expanded", () => {
  assert.deepEqual(visibleItems(["a", "b", "c"], false, 2), { shown: ["a", "b"], hidden: 1 });
  assert.deepEqual(visibleItems(["a", "b", "c"], true, 2), { shown: ["a", "b", "c"], hidden: 0 });
  assert.deepEqual(visibleItems(["a", "b"], false, 6), { shown: ["a", "b"], hidden: 0 });
  assert.deepEqual(visibleItems([], false), { shown: [], hidden: 0 });
  assert.equal(visibleItems(Array.from({ length: 9 }, (_, i) => i), false).shown.length, 6, "default limit is 6");
  assert.deepEqual(visibleItems(undefined, false), { shown: [], hidden: 0 });
});
