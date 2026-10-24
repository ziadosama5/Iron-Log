import { test } from "node:test";
import assert from "node:assert/strict";
import { SET_TYPES, setType, kOf, isWorking, countsForVolume, countsAsSet, workingSets, volumeSets, countedSets,
  validTarget, cleanTargets, defaultTarget, targetFor, stepFor, suggestNext } from "../public/progression.js";
import { defaultRest } from "../public/workout-tools.js";

const S = (w, r, k) => (k ? { w, r, k } : { w, r });

test("setType reads k; anything unknown is a normal set", () => {
  assert.deepEqual(SET_TYPES, ["normal", "warmup", "drop"]);
  assert.equal(setType({ k: "w" }), "warmup");
  assert.equal(setType({ k: "d" }), "drop");
  for (const s of [{}, { k: "x" }, { k: 1 }, { k: null }, null, undefined]) assert.equal(setType(s), "normal", JSON.stringify(s));
  assert.equal(kOf("warmup"), "w"); assert.equal(kOf("drop"), "d"); assert.equal(kOf("normal"), undefined); assert.equal(kOf("nope"), undefined);
});

test("which sets count where", () => {
  const sets = [S(20, 10, "w"), S(80, 8), S(60, 12, "d")];
  assert.deepEqual(workingSets(sets), [S(80, 8)]);
  assert.deepEqual(volumeSets(sets), [S(80, 8), S(60, 12, "d")]);
  assert.deepEqual(countedSets(sets), [S(80, 8), S(60, 12, "d")]);
  assert.equal(isWorking(sets[0]), false); assert.equal(isWorking(sets[2]), false); assert.equal(isWorking(sets[1]), true);
  assert.equal(countsForVolume(sets[0]), false); assert.equal(countsForVolume(sets[2]), true);
  assert.equal(countsAsSet(sets[0]), false); assert.equal(countsAsSet(sets[2]), true);
  for (const f of [workingSets, volumeSets, countedSets]) { assert.deepEqual(f(undefined), []); assert.deepEqual(f(null), []); assert.deepEqual(f("x"), []); }
});

test("validTarget", () => {
  assert.equal(validTarget({ sets: 3, min: 8, max: 12 }), true);
  assert.equal(validTarget({ sets: 1, min: 1, max: 1 }), true);
  assert.equal(validTarget({ sets: 10, min: 50, max: 50 }), true);
  for (const bad of [{ sets: 0, min: 8, max: 12 }, { sets: 3, min: 12, max: 8 }, { sets: 11, min: 8, max: 12 }, { sets: 3, min: 0, max: 12 },
    { sets: 3, min: 8, max: 601 }, { sets: "3", min: 8, max: 12 }, { sets: 3.5, min: 8, max: 12 }, { sets: 3, min: 8 }, null, undefined, [], "x"]) {
    assert.equal(validTarget(bad), false, JSON.stringify(bad));
  }
});

test("cleanTargets keeps own valid entries only, including prototype-like names", () => {
  const r = cleanTargets({ "Bench Press": { sets: 3, min: 5, max: 8, extra: 1 }, x: { sets: 99, min: 1, max: 2 }, constructor: { sets: 3, min: 8, max: 12 }, y: "no" });
  assert.deepEqual(Object.keys(r).sort(), ["Bench Press", "constructor"]);
  assert.deepEqual(r["Bench Press"], { sets: 3, min: 5, max: 8 }, "extra keys dropped");
  assert.deepEqual(cleanTargets(null), {}); assert.deepEqual(cleanTargets([1]), {}); assert.deepEqual(cleanTargets("x"), {});
  assert.deepEqual(cleanTargets(JSON.parse('{"__proto__":{"sets":3,"min":8,"max":12}}')), {});
  assert.deepEqual(cleanTargets({ ["n".repeat(81)]: { sets: 3, min: 8, max: 12 } }), {}, "names over 80 characters");
});

test("defaultTarget: heavy compounds 5-8, isolation 10-15, everything else 8-12", () => {
  for (const n of ["Squat", "Deadlift", "Bench Press", "Overhead Press", "Leg Press", "Romanian Deadlift"]) assert.deepEqual(defaultTarget(n), { sets: 3, min: 5, max: 8 }, n);
  for (const n of ["Lat Pulldown", "Barbell Row", "Incline Dumbbell Press", "My weird move"]) assert.deepEqual(defaultTarget(n), { sets: 3, min: 8, max: 12 }, n);
  for (const n of ["Lateral Raise", "Barbell Curl", "Standing Calf Raise", "Tricep Pushdown", "Cable Crunch"]) assert.deepEqual(defaultTarget(n), { sets: 3, min: 10, max: 15 }, n);
});

test("the 5-8 group is the same group the 3:00 rest timer uses", () => {
  for (const n of ["Squat", "Deadlift", "Bench Press", "Overhead Press", "Leg Press", "Barbell Row", "Pull-up", "Hip Thrust", "Lateral Raise", "Barbell Curl"]) {
    assert.equal(defaultTarget(n).min === 5, defaultRest(n) === 180, n);
  }
});

test("targetFor: a valid saved target wins, anything else is the default", () => {
  const saved = { sets: 4, min: 6, max: 10 };
  assert.deepEqual(targetFor({ targets: { "Squat": saved } }, "Squat"), saved);
  assert.deepEqual(targetFor({ targets: { "Squat": { sets: 3, min: 12, max: 8 } } }, "Squat"), defaultTarget("Squat"));
  assert.deepEqual(targetFor(undefined, "Squat"), defaultTarget("Squat"));
  assert.deepEqual(targetFor({}, "Squat"), defaultTarget("Squat"));
  assert.deepEqual(targetFor({ targets: {} }, "constructor"), defaultTarget("constructor"), "inherited names are not targets");
  assert.deepEqual(targetFor({ targets: { "Squat": saved } }, "Bench Press"), defaultTarget("Bench Press"));
});

test("stepFor: 5 kg for big lower-body and barbell back lifts, 2.5 kg otherwise", () => {
  for (const n of ["Squat", "Deadlift", "Leg Press", "Barbell Row", "Hip Thrust", "T-bar Row"]) assert.equal(stepFor(n), 5, n);
  for (const n of ["Bench Press", "Lateral Raise", "Dumbbell Squat", "One-arm Dumbbell Row", "Overhead Press", "My weird move"]) assert.equal(stepFor(n), 2.5, n);
});

test("suggestNext: double progression on the heaviest working weight", () => {
  const target = { sets: 3, min: 5, max: 8 }, step = 2.5, go = last => suggestNext({ last, target, step });
  assert.deepEqual(go([S(80, 8), S(80, 8), S(80, 8)]), { kind: "increase", w: 82.5, r: 5 });
  assert.deepEqual(go([S(80, 8), S(80, 8), S(80, 7)]), { kind: "hold", w: 80, r: 8 });
  assert.deepEqual(go([S(80, 6), S(80, 6), S(80, 5)]), { kind: "hold", w: 80, r: 6 });
  assert.deepEqual(go([S(80, 4), S(80, 4), S(80, 4)]), { kind: "hold", w: 80, r: 5, low: true });
  assert.deepEqual(go([S(80, 8), S(80, 8)]), { kind: "hold", w: 80, r: 8 }, "fewer sets than the target is not enough to add weight");
  assert.deepEqual(go([S(40, 10, "w"), S(80, 8), S(80, 8), S(80, 8), S(60, 12, "d")]), { kind: "increase", w: 82.5, r: 5 }, "warm-ups and drops are ignored");
  assert.deepEqual(go([S(60, 12), S(80, 8), S(80, 8), S(80, 8)]), { kind: "increase", w: 82.5, r: 5 }, "judged at the top weight");
  assert.deepEqual(go([S(82.25, 8), S(82.25, 8), S(82.25, 8)]), { kind: "increase", w: 84.75, r: 5 });
});

test("suggestNext: nothing to say without working sets or without a weight", () => {
  const target = { sets: 3, min: 5, max: 8 };
  for (const last of [null, undefined, [], [S(40, 10, "w")], [S(0, 15), S(0, 15), S(0, 15)]]) assert.equal(suggestNext({ last, target, step: 2.5 }), null, JSON.stringify(last));
});

test("exerciseSessions: one session per workout that has working sets of the exercise, oldest first", async () => {
  const { exerciseSessions } = await import("../public/progression.js");
  const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  const wk = (date, ex, sets) => ({ date, entries: [{ ex, sets }] });
  const ws = [
    wk("2026-10-01", "Bench Press", [S(40, 10, "w"), S(60, 8)]),
    wk("2026-10-03", "bench press", [S(40, 10, "w")]),           // only a warm-up: no session
    wk("2026-10-05", "Squat", [S(100, 5)]),
    wk("2026-10-07", "Bench Press", [S(62.5, 8), S(50, 12, "d")]),
    { date: "2026-10-09", entries: [{ ex: "Bench Press", sets: [] }] },
  ];
  assert.deepEqual(exerciseSessions(ws, "Bench Press", same), [{ date: "2026-10-01", sets: [S(60, 8)] }, { date: "2026-10-07", sets: [S(62.5, 8)] }]);
  assert.deepEqual(exerciseSessions(ws, "Deadlift", same), []);
  assert.deepEqual(exerciseSessions([], "Bench Press", same), []);
});

test("liftNames: only exercises with at least one working set (the Lifts picker)", async () => {
  const { liftNames } = await import("../public/progression.js");
  const ws = [
    { date: "2026-10-01", entries: [{ ex: "Bench Press", sets: [S(40, 10, "w")] }, { ex: "Squat", sets: [S(100, 5)] }, { ex: "Row", sets: [S(40, 10, "d")] }, { ex: "Curl", sets: [] }] },
    { date: "2026-10-02", entries: [{ ex: "Squat", sets: [S(100, 5)] }, { ex: "Bench Press", sets: [S(60, 8)] }] },
  ];
  assert.deepEqual(liftNames(ws), ["Squat", "Bench Press"]);
  assert.deepEqual(liftNames([]), []);
});

test("applyPendingTargets lays unsaved edits over the stored targets (null removes one)", async () => {
  const { applyPendingTargets } = await import("../public/progression.js");
  const stored = { Squat: { sets: 3, min: 5, max: 8 }, Curl: { sets: 3, min: 10, max: 15 } };
  const r = applyPendingTargets(stored, { Squat: { sets: 4, min: 5, max: 8 }, Curl: null, Row: { sets: 3, min: 6, max: 10 } });
  assert.deepEqual(r, { Squat: { sets: 4, min: 5, max: 8 }, Row: { sets: 3, min: 6, max: 10 } });
  assert.deepEqual(stored.Squat, { sets: 3, min: 5, max: 8 }, "the input is not changed");
  assert.deepEqual(applyPendingTargets(undefined, {}), {});
  assert.deepEqual(applyPendingTargets(stored, undefined), stored);
});

test("cleanTargets keeps at most 300 entries", () => {
  const big = {}; for (let i = 0; i < 350; i++) big["Exercise " + i] = { sets: 3, min: 8, max: 12 };
  assert.equal(Object.keys(cleanTargets(big)).length, 300);
});

test("defaultTarget: split squats and dips are in the 8-12 group like their 2:30 rest", () => {
  for (const n of ["Bulgarian Split Squat", "Smith Machine Split Squat", "Machine Dip", "Weighted Dip"]) assert.deepEqual(defaultTarget(n), { sets: 3, min: 8, max: 12 }, n);
});

test("validTarget allows long holds (seconds) but nothing past 600", () => {
  assert.equal(validTarget({ sets: 3, min: 30, max: 60 }), true);
  assert.equal(validTarget({ sets: 3, min: 30, max: 600 }), true);
  assert.equal(validTarget({ sets: 3, min: 30, max: 601 }), false);
});

test("defaultTarget: bodyweight exercises, the pull-up and dip family, and holds", () => {
  for (const n of ["Plank", "Side Plank", "Wall Sit"]) assert.deepEqual(defaultTarget(n), { sets: 3, min: 30, max: 60 }, n);
  for (const n of ["Push-up", "Bodyweight Squat", "Crunch", "Sit-up", "Step-up", "Glute Bridge"]) assert.deepEqual(defaultTarget(n), { sets: 3, min: 8, max: 12 }, n);
  for (const n of ["Pull-up", "Chin-up", "Wide-grip Pull-up", "Assisted Pull-up", "Dip", "Chest Dip", "Bench Dip"]) assert.deepEqual(defaultTarget(n), { sets: 3, min: 6, max: 10 }, n);
  assert.deepEqual(defaultTarget("Cable Crunch"), { sets: 3, min: 10, max: 15 }, "a weighted crunch is still an isolation lift");
  assert.deepEqual(defaultTarget("Weighted Dip"), { sets: 3, min: 8, max: 12 });
});

test("suggestNext for bodyweight: reps first, then 2.5 kg extra, assisted gets less assistance", () => {
  const target = { sets: 3, min: 8, max: 12 }, go = (last, extra = {}) => suggestNext({ last, target, step: 2.5, bw: true, ...extra });
  assert.deepEqual(go([S(0, 12), S(0, 12), S(0, 12)]), { kind: "increase", w: 2.5, r: 8, bw: true });
  assert.deepEqual(go([S(0, 12), S(0, 12), S(0, 10)]), { kind: "hold", w: 0, r: 11, bw: true });
  assert.deepEqual(go([S(0, 6), S(0, 6), S(0, 6)]), { kind: "hold", w: 0, r: 8, low: true, bw: true });
  assert.deepEqual(go([S(10, 12), S(10, 12), S(10, 12)]), { kind: "increase", w: 12.5, r: 8, bw: true });
  assert.deepEqual(go([S(-20, 12), S(-20, 12), S(-20, 12)]), { kind: "increase", w: -17.5, r: 8, bw: true }, "less assistance");
  assert.deepEqual(go([S(-20, 6), S(-20, 6), S(-20, 6)]), { kind: "hold", w: -20, r: 8, low: true, bw: true });
  assert.deepEqual(go([S(0, 15), S(5, 12), S(5, 12), S(5, 12)]), { kind: "increase", w: 7.5, r: 8, bw: true }, "judged at the top load");
  assert.deepEqual(go([S(0, 12), S(0, 12)]), { kind: "hold", w: 0, r: 12, bw: true }, "fewer sets than the target is not enough");
  assert.deepEqual(go([S(0, 5, "w"), S(0, 12), S(0, 12), S(0, 12), S(0, 20, "d")]), { kind: "increase", w: 2.5, r: 8, bw: true }, "warm-ups and drops ignored");
  assert.equal(go([]), null); assert.equal(go(null), null);
});

test("suggestNext for holds (seconds): never weight, hold advice only", () => {
  const target = { sets: 3, min: 30, max: 60 }, go = last => suggestNext({ last, target, step: 2.5, bw: true, hold: true });
  assert.deepEqual(go([S(0, 60), S(0, 60), S(0, 60)]), { kind: "hold", w: 0, r: 60, bw: true, unit: "s" });
  assert.deepEqual(go([S(0, 35), S(0, 40), S(0, 30)]), { kind: "hold", w: 0, r: 31, bw: true, unit: "s" });
  assert.deepEqual(go([S(0, 20), S(0, 25), S(0, 20)]), { kind: "hold", w: 0, r: 30, low: true, bw: true, unit: "s" });
});

test("suggestNext: a weighted lift at 0 kg still says nothing", () => {
  assert.equal(suggestNext({ last: [S(0, 15), S(0, 15), S(0, 15)], target: { sets: 3, min: 5, max: 8 }, step: 2.5 }), null);
});

test("exerciseSessions marks bodyweight sessions (bw) and leaves weighted ones as they were", async () => {
  const { exerciseSessions } = await import("../public/progression.js");
  const same = (a, b) => a === b;
  const ws = [{ date: "2026-10-01", entries: [{ ex: "Pull-up", sets: [S(60, 5)] }] }, { date: "2026-10-03", entries: [{ ex: "Pull-up", bw: true, sets: [S(0, 8), S(0, 6, "w")] }] }];
  assert.deepEqual(exerciseSessions(ws, "Pull-up", same), [{ date: "2026-10-01", sets: [S(60, 5)] }, { date: "2026-10-03", sets: [S(0, 8)], bw: true }]);
});

test("exerciseSessions passes an explicit bw:false through (weighted on purpose) and leaves it out when unset", async () => {
  const { exerciseSessions } = await import("../public/progression.js");
  const same = (a, b) => a === b;
  const ws = [{ date: "2026-10-01", entries: [{ ex: "Pull-up", sets: [S(60, 5)] }] }, { date: "2026-10-03", entries: [{ ex: "Pull-up", bw: false, sets: [S(60, 5)] }] }];
  assert.deepEqual(exerciseSessions(ws, "Pull-up", same), [{ date: "2026-10-01", sets: [S(60, 5)] }, { date: "2026-10-03", sets: [S(60, 5)], bw: false }]);
});

test("exerciseSessions marks the sessions of a deload workout", async () => {
  const { exerciseSessions } = await import("../public/progression.js");
  const same = (a, b) => a === b;
  const ws = [{ date: "2026-10-01", entries: [{ ex: "Squat", sets: [S(100, 5)] }] }, { date: "2026-10-03", deload: true, entries: [{ ex: "Squat", sets: [S(70, 5)] }] }];
  assert.deepEqual(exerciseSessions(ws, "Squat", same), [{ date: "2026-10-01", sets: [S(100, 5)] }, { date: "2026-10-03", sets: [S(70, 5)], deload: true }]);
});
