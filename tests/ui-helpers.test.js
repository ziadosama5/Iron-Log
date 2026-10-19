import { test } from "node:test";
import assert from "node:assert/strict";
import { themeAttr, sortTips, withWeight, settingsDoc, showGymHint } from "../public/ui-helpers.js";

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

test("settingsDoc keeps rest, seenBadges and gym together", () => {
  const d = settingsDoc({ rest: { "Bench Press": 150 }, seenBadges: ["a"], gym: ["barbell"] }, 9);
  assert.deepEqual(d, { rest: { "Bench Press": 150 }, seenBadges: ["a"], gym: ["barbell"], updated: 9 });
});

test("settingsDoc leaves gym out when unset but keeps an empty list", () => {
  assert.equal("gym" in settingsDoc({ rest: {} }, 1), false);
  assert.deepEqual(settingsDoc({ rest: {}, gym: [] }, 1).gym, []);
});

test("settingsDoc without rest or seenBadges still writes a valid doc", () => {
  assert.deepEqual(settingsDoc({}, 3), { rest: {}, updated: 3 });
  assert.equal("seenBadges" in settingsDoc({ rest: {}, gym: ["x"] }, 3), false);
});

test("showGymHint: only after the first sync, only while the gym is unset, never once dismissed", () => {
  assert.equal(showGymHint({ gym: undefined, dismissed: false, synced: true }), true);
  assert.equal(showGymHint({ gym: undefined, dismissed: false, synced: false }), false, "settings may not have loaded yet");
  assert.equal(showGymHint({ gym: undefined, dismissed: true, synced: true }), false);
  assert.equal(showGymHint({ gym: [], dismissed: false, synced: true }), false, "bodyweight only is a choice, not unset");
  assert.equal(showGymHint({ gym: ["barbell"], dismissed: false, synced: true }), false);
});

import { daysSince } from "../public/ui-helpers.js";
test("daysSince counts whole calendar days and is never negative for today", () => {
  assert.equal(daysSince("2026-10-20", "2026-10-20"), 0);
  assert.equal(daysSince("2026-10-19", "2026-10-20"), 1);
  assert.equal(daysSince("2026-09-20", "2026-10-20"), 30);
  assert.equal(daysSince("2026-03-28", "2026-03-30"), 2);   // across a daylight-saving change
  assert.equal(daysSince("2026-10-21", "2026-10-20"), 0);   // a date in the future clamps to 0
});
