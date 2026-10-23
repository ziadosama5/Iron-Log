import test from "node:test";
import assert from "node:assert/strict";
import { weeklyCounts, weightSeries, weightChange, caloriesWeek, topLifts, prsThisMonth } from "../public/overview.js";

const TODAY = "2026-10-23"; // a Friday; its week started Saturday 2026-10-17
const wk = (date, ex = "Bench Press", w = 60, r = 8) => ({ date, dayId: "d1", dayName: "Push", entries: [{ ex, sets: [{ w, r }] }] });

test("weeklyCounts: 8 weeks oldest first, ending with this week's Saturday", () => {
  const r = weeklyCounts([wk("2026-10-18"), wk("2026-10-20"), wk("2026-10-12")], TODAY);
  assert.equal(r.length, 8);
  assert.equal(r[7].start, "2026-10-17");
  assert.deepEqual(r.slice(-2).map(x => x.count), [1, 2]);
});
test("weeklyCounts: same date counts once, future dates are ignored, empty gives eight zeros", () => {
  assert.equal(weeklyCounts([wk("2026-10-20"), { ...wk("2026-10-20"), id: "x" }], TODAY)[7].count, 1);
  assert.equal(weeklyCounts([wk("2026-10-30")], TODAY)[7].count, 0);
  assert.deepEqual(weeklyCounts([], TODAY).map(x => x.count), [0, 0, 0, 0, 0, 0, 0, 0]);
});
test("weeklyCounts: on a Saturday the last week is that Saturday", () => {
  const r = weeklyCounts([wk("2026-10-24")], "2026-10-24");
  assert.equal(r[7].start, "2026-10-24");
  assert.equal(r[7].count, 1);
});

test("weightSeries keeps numeric weights from the last 90 days, ascending", () => {
  const s = weightSeries([{ date: "2026-10-01", weight: 89 }, { date: "2026-07-01", weight: 95 }, { date: "2026-10-10" }, { date: "2026-09-01", weight: 91 }], TODAY);
  assert.deepEqual(s, [{ date: "2026-09-01", weight: 91 }, { date: "2026-10-01", weight: 89 }]);
});
test("weightChange: last minus the latest weight on or before 28 days ago, null without one", () => {
  const body = [{ date: "2026-09-18", weight: 90 }, { date: "2026-10-23", weight: 88 }];
  assert.equal(weightChange(weightSeries(body, TODAY), TODAY), -2);
  assert.equal(weightChange(weightSeries([{ date: "2026-10-23", weight: 88 }], TODAY), TODAY), null);
  assert.equal(weightChange([], TODAY), null);
});

test("caloriesWeek: seven days ending today, null eaten without meals, null target without profile data", () => {
  const food = { "2026-10-23": { meals: [{ kcal: 1000 }, { kcal: 800 }] } };
  const r = caloriesWeek(food, [], [], {}, TODAY);
  assert.equal(r.length, 7);
  assert.equal(r[6].date, TODAY);
  assert.equal(r[6].eaten, 1800);
  assert.equal(r[5].eaten, null);
  assert.ok(r.every(x => x.target === null));
});
test("caloriesWeek: target is a number when weight and profile are known", () => {
  const profile = { sex: "male", height: 180, birthYear: 1995, goal: "maintain" };
  const r = caloriesWeek({}, [], [{ date: "2026-10-01", weight: 80 }], profile, TODAY);
  assert.ok(Number.isFinite(r[6].target) && r[6].target > 1000);
});

test("topLifts orders by sessions then name; change30 is null without an older session", () => {
  const ws = [wk("2026-10-20", "Squat"), wk("2026-10-21", "Bench Press"), wk("2026-10-22", "Bench Press")];
  const r = topLifts(ws, TODAY);
  assert.deepEqual(r.map(x => x.ex), ["Bench Press", "Squat"]);
  assert.equal(r[0].sessions, 2);
  assert.equal(r[0].change30, null);
  assert.ok(r[0].best > 60);
});
test("topLifts: change30 compares the last 30 days to what came before", () => {
  const ws = [wk("2026-08-01", "Squat", 100, 5), wk("2026-10-20", "Squat", 110, 5)];
  const [s] = topLifts(ws, TODAY);
  assert.ok(s.change30 > 0);
});

test("prsThisMonth counts only PR events inside the last 30 days", () => {
  const ws = [wk("2026-08-01", "Bench Press", 50), wk("2026-08-08", "Bench Press", 55), wk("2026-10-20", "Bench Press", 70)];
  assert.equal(prsThisMonth(ws, TODAY), 1);
  assert.equal(prsThisMonth([], TODAY), 0);
});

import { cacheKey } from "../public/overview.js";
test("cacheKey differs per account, data revision and day", () => {
  assert.notEqual(cacheKey("a", 3, TODAY), cacheKey("b", 3, TODAY));
  assert.notEqual(cacheKey("a", 3, TODAY), cacheKey("a", 4, TODAY));
  assert.notEqual(cacheKey("a", 3, TODAY), cacheKey("a", 3, "2026-10-24"));
  assert.equal(cacheKey("a", 3, TODAY), cacheKey("a", 3, TODAY));
  assert.equal(typeof cacheKey(undefined, undefined, TODAY), "string");
});
test("weightChange is null when the latest weigh-in is itself older than the window", () => {
  assert.equal(weightChange(weightSeries([{ date: "2026-09-01", weight: 90 }, { date: "2026-09-10", weight: 89 }], TODAY), TODAY), null);
});
