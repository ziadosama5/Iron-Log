import test from "node:test";
import assert from "node:assert/strict";
import { weeklyCounts, weightSeries, weightChange, caloriesWeek, topLifts, prsThisMonth, yearActivity } from "../public/overview.js";
import { weekKey, addDays as addD } from "../public/achievements.js";

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

test("caloriesWeek: activity level and own adjustment reach the target", () => {
  const profile = { sex: "male", height: 180, birthYear: 1995, goal: "maintain" }, body = [{ date: "2026-10-01", weight: 80 }];
  const base = caloriesWeek({}, [], body, profile, TODAY)[6].target;
  const active = caloriesWeek({}, [], body, { ...profile, activity: "active" }, TODAY)[6].target;
  assert.ok(active > base);
  assert.equal(caloriesWeek({}, [], body, { ...profile, adjust: -300 }, TODAY)[6].target, base - 300);
});

test("topLifts: warm-ups and drop sets are not a lift's best, a warm-up-only exercise does not appear", () => {
  const w = (date, sets, ex = "Bench Press") => ({ date, dayId: "d1", dayName: "Push", entries: [{ ex, sets }] });
  const ws = [w("2026-10-20", [{ w: 100, r: 5, k: "w" }, { w: 90, r: 5, k: "d" }, { w: 60, r: 8 }]), w("2026-10-21", [{ w: 30, r: 10, k: "w" }], "Squat")];
  const r = topLifts(ws, TODAY);
  assert.deepEqual(r.map(x => x.ex), ["Bench Press"]);
  assert.equal(r[0].best, Math.round(60 * (1 + 8 / 30) * 10) / 10);
});

test("topLifts leaves bodyweight lifts out (they have no one-rep max)", () => {
  const ws = [{ date: "2026-10-20", entries: [{ ex: "Pull-up", bw: true, sets: [{ w: 10, r: 8 }] }, { ex: "Bench Press", sets: [{ w: 60, r: 8 }] }] }];
  assert.deepEqual(topLifts(ws, TODAY).map(x => x.ex), ["Bench Press"]);
});

// ---- Year activity (GitHub-style heatmap, shaded by time trained) ----

const YT = "2026-10-31";   // a Saturday
const lift = (date, nSets, bw) => ({ date, entries: [{ ex: "Bench Press", bw: !!bw, sets: Array.from({ length: nSets }, () => ({ w: bw ? 0 : 50, r: 10 })) }] });

test("yearActivity: 53 Saturday-first weeks of 7 days, the last column holds today", () => {
  const y = yearActivity([], YT);
  assert.equal(y.weeks.length, 53);
  for (const w of y.weeks) assert.equal(w.days.length, 7);
  assert.equal(y.weeks[52].start, weekKey(YT));
  assert.equal(y.weeks[0].start, addD(weekKey(YT), -52 * 7));
  assert.equal(y.weeks[52].days[0].date, YT);
  assert.equal(y.weeks[52].days[0].today, true);
  assert.equal(y.weeks.flatMap(w => w.days).filter(d => d.today).length, 1);
});

test("yearActivity: days after today are future with no level", () => {
  const y = yearActivity([lift("2026-11-02", 3)], YT), days = y.weeks[52].days;
  assert.equal(days[1].future, true);
  assert.equal(days[1].level, 0);
  assert.equal(days[0].future, false);
});

test("yearActivity: a day with no workout is level 0, a workout without sets or cardio is not counted", () => {
  const y = yearActivity([{ date: "2026-10-20", entries: [{ ex: "Bench Press", sets: [] }] }], YT);
  assert.equal(y.trainedDays, 0);
  assert.ok(y.weeks.flatMap(w => w.days).every(d => d.level === 0));
});

test("yearActivity: shade follows time trained in quartiles of the days that have time", () => {
  const ws = [lift("2026-10-01", 2), lift("2026-10-02", 4), lift("2026-10-03", 8), lift("2026-10-04", 16)];   // 5, 10, 20, 40 min (2.5 min a set)
  const y = yearActivity(ws, YT), by = Object.fromEntries(y.weeks.flatMap(w => w.days).map(d => [d.date, d]));
  assert.deepEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map(d => by[d].level), [1, 2, 3, 4]);
  assert.equal(by["2026-10-04"].minutes, 40);
  assert.equal(by["2026-10-04"].workouts, 1);
  assert.equal(y.trainedDays, 4);
});

test("yearActivity: a cardio-only day counts, with its minutes", () => {
  const y = yearActivity([{ date: "2026-10-10", entries: [], cardio: [{ min: 30 }, { min: 15 }] }], YT), d = y.weeks.flatMap(w => w.days).find(x => x.date === "2026-10-10");
  assert.equal(d.minutes, 45);
  assert.ok(d.level >= 1);
});

test("yearActivity: volume counts only extra load, never body weight", () => {
  const y = yearActivity([lift("2026-10-05", 3), lift("2026-10-06", 3, true)], YT), by = Object.fromEntries(y.weeks.flatMap(w => w.days).map(d => [d.date, d]));
  assert.equal(by["2026-10-05"].volume, 1500);
  assert.equal(by["2026-10-06"].volume, 0);
});

test("yearActivity: month labels are one per month, on the first column whose first day is in the first week, never in the last two columns", () => {
  const y = yearActivity([], YT), cols = y.months.map(m => m.col);
  assert.equal(new Set(y.months.map(m => m.month + ":" + y.weeks[m.col].start.slice(0, 4))).size, y.months.length);
  for (const m of y.months) { assert.ok(m.col < 51); assert.ok(Number(y.weeks[m.col].start.slice(8)) <= 7); }
  assert.deepEqual(cols, [...cols].sort((a, b) => a - b));
  assert.ok(y.months.length >= 11 && y.months.length <= 13);
});

test("yearActivity: workouts older than the grid are ignored and bad rows never throw", () => {
  const y = yearActivity([lift("2024-01-01", 3), null, { date: "bad" }, {}, lift("2026-10-30", 2)], YT);
  assert.equal(y.trainedDays, 1);
});
