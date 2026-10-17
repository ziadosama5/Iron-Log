import { test } from "node:test";
import assert from "node:assert/strict";
import { weekKey, weeklyTarget, trainingStreak, foodStreak, prEvents } from "../public/achievements.js";

const S = (w, r) => ({ w, r });
const wo = (date, sets = [S(60, 5)], ex = "Bench Press", cardio) => ({ id: "w-" + date, date, entries: [{ ex, sets }], ...(cardio ? { cardio } : {}) });
const DAYS2 = [{ id: "a", weekdays: [6] }, { id: "b", weekdays: [2] }]; // N = 2

test("weekKey: Saturday starts the week", () => {
  assert.equal(weekKey("2026-10-17"), "2026-10-17"); // Saturday
  assert.equal(weekKey("2026-10-23"), "2026-10-17"); // Friday
  assert.equal(weekKey("2026-10-16"), "2026-10-10");
});

test("weeklyTarget", () => {
  assert.equal(weeklyTarget(DAYS2), 2);
  assert.equal(weeklyTarget([{ weekdays: [1] }]), 2);
  assert.equal(weeklyTarget([{}, {}, {}]), 3);
  assert.equal(weeklyTarget(Array(7).fill({})), 6);
  assert.equal(weeklyTarget([]), 3);
});

test("trainingStreak counts finished weeks and adds the current one when met", () => {
  const ws = ["2026-09-26", "2026-09-28", "2026-10-03", "2026-10-05", "2026-10-10", "2026-10-12", "2026-10-17"].map(d => wo(d));
  assert.deepEqual(trainingStreak(ws, DAYS2, "2026-10-18"), { weeks: 3, thisWeek: 1, target: 2 });
  assert.deepEqual(trainingStreak([...ws, wo("2026-10-18")], DAYS2, "2026-10-18"), { weeks: 4, thisWeek: 2, target: 2 });
});

test("trainingStreak breaks on a short week; cardio-only days count", () => {
  const ws = [wo("2026-09-26"), wo("2026-09-28"), wo("2026-10-03"),
    wo("2026-10-10"), { id: "w-2026-10-12", date: "2026-10-12", entries: [], cardio: [{ type: "bike", min: 30, intensity: "easy", kcal: null }] }];
  assert.deepEqual(trainingStreak(ws, DAYS2, "2026-10-17"), { weeks: 1, thisWeek: 0, target: 2 });
});

test("foodStreak ends today, or yesterday when today is empty", () => {
  const f = d => ({ date: d, meals: [{ id: "m", kcal: 500 }] });
  const food = { "2026-10-15": f("2026-10-15"), "2026-10-16": f("2026-10-16"), "2026-10-17": f("2026-10-17") };
  assert.equal(foodStreak(food, "2026-10-18"), 3);
  assert.equal(foodStreak(food, "2026-10-17"), 3);
  assert.equal(foodStreak({ ...food, "2026-10-14": { date: "2026-10-14", meals: [] } }, "2026-10-17"), 3);
  assert.equal(foodStreak(food, "2026-10-20"), 0);
});

test("prEvents needs 2 earlier sessions and a higher best", () => {
  const ws = [wo("2026-10-01", [S(60, 5)]), wo("2026-10-03", [S(60, 5)], "bench press"), wo("2026-10-05", [S(62.5, 5)]), wo("2026-10-07", [S(62.5, 5)])];
  assert.deepEqual(prEvents(ws), [{ date: "2026-10-05", ex: "bench press" }]);
});
