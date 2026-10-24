import { test } from "node:test";
import assert from "node:assert/strict";
import { weightOn, bmrFor, baselineBurn, liftMinutes, liftKcal, cardioKcal, exerciseKcal, dayEnergy, ACTIVITY, ACTIVITY_IDS, ADJUST_MIN, ADJUST_MAX, activityFactor, goalAdjustment, explainTarget } from "../public/energy.js";

const min = m => m * 60000;
const T0 = 1760000000000; // real set times are ms since epoch; offsets below are added to it
const W = (times, extra = {}) => ({ entries: [{ ex: "Squat", sets: times.map(t => ({ w: 100, r: 5, ...(t == null ? {} : { t: T0 + t }) })) }], ...extra });

test("weightOn uses the latest weight on or before the date", () => {
  const body = [{ date: "2026-10-01", weight: 82 }, { date: "2026-10-10", weight: 81 }, { date: "2026-10-12", waist: 80 }];
  assert.equal(weightOn(body, "2026-10-12"), 81);
  assert.equal(weightOn(body, "2026-10-05"), 82);
});

test("weightOn ignores later entries", () => assert.equal(weightOn([{ date: "2026-10-17", weight: 80 }], "2026-10-10"), null));

test("bmrFor prefers a recent InBody scan", () =>
  assert.deepEqual(bmrFor({ sex: "male", height: 180, birthYear: 1998 }, [{ date: "2026-09-01", bmr: 1750, weight: 80 }], "2026-10-17"), { bmr: 1750, src: "inbody" }));

test("bmrFor falls back to Mifflin-St Jeor when the scan is over 120 days old", () =>
  assert.deepEqual(bmrFor({ sex: "male", height: 180, birthYear: 1998 }, [{ date: "2026-01-01", bmr: 1750, weight: 80 }], "2026-10-17"), { bmr: 1790, src: "formula" }));

test("bmrFor female formula and missing data", () => {
  assert.equal(bmrFor({ sex: "female", height: 165, birthYear: 1996 }, [{ date: "2026-10-01", weight: 60 }], "2026-10-17").bmr, 1320);
  assert.equal(bmrFor({}, [{ date: "2026-10-01", weight: 60 }], "2026-10-17"), null);
  assert.equal(bmrFor({ sex: "male", height: 180, birthYear: 1998 }, [], "2026-10-17"), null);
});

test("baselineBurn", () => { assert.equal(baselineBurn(1700), 2040); assert.equal(baselineBurn(null), null); });

test("liftMinutes from set times plus 2 min", () => assert.equal(liftMinutes(W([0, min(20), min(45)])), 47));

test("liftMinutes falls back to 2.5 min per set", () => {
  assert.equal(liftMinutes(W([null, null, null, null])), 10);
  assert.equal(liftMinutes(W([0])), 2.5);
  assert.equal(liftMinutes(W([0, min(200)])), 5);
  assert.equal(liftMinutes({ entries: [] }), 0);
  assert.equal(liftMinutes(null), 0);
});

test("liftKcal", () => {
  assert.equal(liftKcal(W([0, min(20), min(45)]), 80), 157);
  assert.equal(liftKcal(W([0]), null), null);
  assert.equal(liftKcal({ entries: [] }, 80), 0);
});

test("cardioKcal: machine number as typed, else estimate", () => {
  assert.equal(cardioKcal({ type: "treadmill", min: 25, intensity: "moderate", kcal: 280 }, null), 280);
  assert.equal(cardioKcal({ type: "treadmill", min: 25, intensity: "moderate", kcal: null }, 80), 233);
  assert.equal(cardioKcal({ type: "bike", min: 30, intensity: "easy", kcal: null }, 70), 88);
  assert.equal(cardioKcal({ type: "bike", min: 30, intensity: "easy", kcal: null }, null), null);
});

test("exerciseKcal sums lifting and cardio", () => {
  const w = W([0, min(20), min(45)], { cardio: [{ type: "treadmill", min: 25, intensity: "moderate", kcal: 280 }] });
  assert.deepEqual(exerciseKcal(w, 80), { lift: 157, cardio: 280, total: 437 });
  assert.deepEqual(exerciseKcal(null, 80), { lift: 0, cardio: 0, total: 0 });
  assert.deepEqual(exerciseKcal(w, null), { lift: null, cardio: 280, total: null });
});

test("dayEnergy combines everything", () => {
  const w = W([0, min(20), min(45)], { cardio: [{ type: "treadmill", min: 25, intensity: "moderate", kcal: 280 }] });
  const food = { meals: [{ kcal: 600, protein: 40 }, { kcal: 900, protein: null }] };
  assert.deepEqual(dayEnergy({ bmr: 1700, kg: 80, goal: "fat-loss", workout: w, food }),
    { baseline: 2040, lift: 157, cardio: 280, burned: 2477, target: 2027, eaten: 1500, protein: 40, balance: -977, factor: 1.2, adj: -450 });
});

test("dayEnergy with missing data", () => {
  const r = dayEnergy({ bmr: null, kg: null, goal: null, workout: null, food: null });
  assert.deepEqual(r, { baseline: null, lift: 0, cardio: 0, burned: null, target: null, eaten: 0, protein: null, balance: null, factor: 1.2, adj: 0 });
  assert.equal(dayEnergy({ bmr: 1700, kg: 80, goal: undefined, workout: null, food: null }).target, 2040);
});

test("liftMinutes falls back when sets were logged after the workout (less than 1 min per set)", () => {
  // 15 sets typed in within 2 minutes: the span says ~4 min, the 2.5 min/set fallback says 37.5
  const quick = W(Array.from({ length: 15 }, (_, i) => i * 8000));
  assert.equal(liftMinutes(quick), 37.5);
});

test("liftMinutes falls back when only some sets have times", () =>
  assert.equal(liftMinutes(W([min(0), min(30), null, null])), 10));

test("activity levels: factors, order, and unknown values count as sitting", () => {
  assert.deepEqual(ACTIVITY_IDS, ["sitting", "light", "active", "very"]);
  assert.deepEqual(ACTIVITY, { sitting: 1.2, light: 1.3, active: 1.4, very: 1.5 });
  for (const a of [undefined, null, "banana", 3]) assert.equal(activityFactor(a), 1.2, String(a));
  assert.equal(activityFactor("very"), 1.5);
});

test("goalAdjustment: own value when valid (0 included), else the goal's", () => {
  assert.equal(ADJUST_MIN, -1000); assert.equal(ADJUST_MAX, 1000);
  assert.equal(goalAdjustment("fat-loss"), -450);
  assert.equal(goalAdjustment("fat-loss", -300), -300);
  assert.equal(goalAdjustment("fat-loss", 0), 0, "zero is a choice");
  assert.equal(goalAdjustment("muscle", 1000), 1000);
  for (const bad of [5000, -1001, 12.5, "200", NaN, null]) assert.equal(goalAdjustment("fat-loss", bad), -450, String(bad));
  assert.equal(goalAdjustment("nope"), 0);
  assert.equal(goalAdjustment(undefined, undefined), 0);
});

test("baselineBurn follows the activity level", () => {
  assert.equal(baselineBurn(1700, "light"), 2210);
  assert.equal(baselineBurn(1700, "active"), 2380);
  assert.equal(baselineBurn(1700, "very"), 2550);
  assert.equal(baselineBurn(1700, "banana"), 2040);
  assert.equal(baselineBurn(null, "light"), null);
});

test("dayEnergy: no activity and no adjust gives today's numbers; with them the target moves", () => {
  const base = dayEnergy({ bmr: 1700, kg: 80, goal: "fat-loss", workout: null, food: null });
  assert.equal(base.baseline, 2040); assert.equal(base.target, 1590); assert.equal(base.factor, 1.2); assert.equal(base.adj, -450);
  const own = dayEnergy({ bmr: 1700, kg: 80, goal: "fat-loss", activity: "active", adjust: -300, workout: null, food: null });
  assert.equal(own.baseline, 2380); assert.equal(own.target, 2080); assert.equal(own.factor, 1.4); assert.equal(own.adj, -300);
  assert.equal(dayEnergy({ bmr: 1700, kg: 80, goal: "fat-loss", adjust: 0, workout: null, food: null }).target, 2040, "adjust 0 means none");
});

test("explainTarget lists the parts in order and they add up", () => {
  const w = W([0, min(20), min(45)], { cardio: [{ type: "treadmill", min: 25, intensity: "moderate", kcal: 280 }] });
  const input = { bmr: 1700, kg: 80, goal: "fat-loss", activity: "light", adjust: -300, workout: w, food: null };
  const energy = dayEnergy(input);
  const r = explainTarget({ bmr: 1700, src: "inbody", activity: "light", goal: "fat-loss", adjust: -300, energy });
  assert.deepEqual(r.rows.map(x => x.id), ["resting", "everyday", "lifting", "cardio", "goal"]);
  assert.deepEqual(r.rows[0], { id: "resting", kcal: 1700, src: "inbody" });
  assert.deepEqual(r.rows[1], { id: "everyday", kcal: 2210, factor: 1.3 });
  assert.equal(r.rows[2].kcal, 157); assert.equal(r.rows[3].kcal, 280);
  assert.deepEqual(r.rows[4], { id: "goal", kcal: -300, custom: true });
  assert.equal(r.burned, 2210 + 157 + 280);
  assert.equal(r.target, r.burned - 300);
  assert.equal(r.target, energy.target);
  const dflt = explainTarget({ bmr: 1700, src: "formula", activity: undefined, goal: "fat-loss", adjust: undefined, energy: dayEnergy({ ...input, activity: undefined, adjust: undefined }) });
  assert.equal(dflt.rows[4].custom, false); assert.equal(dflt.rows[4].kcal, -450); assert.equal(dflt.rows[0].src, "formula");
});

test("explainTarget is null when the target is unknown", () => {
  const energy = dayEnergy({ bmr: null, kg: null, goal: "fat-loss", workout: null, food: null });
  assert.equal(explainTarget({ bmr: null, src: null, activity: undefined, goal: "fat-loss", adjust: undefined, energy }), null);
});
