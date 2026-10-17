import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanBackupItems } from "../public/backup.js";

const OPTS = { bodyKeys: ["weight", "waist", "pbf"], goals: ["fat-loss", "muscle"], muscles: ["Chest", "Back"] };
const W = { id: "w-2026-10-17", data: { date: "2026-10-17", dayId: "d1", dayName: "Push", updated: 1,
  entries: [{ ex: "Bench Press", sets: [{ w: 60, r: 8 }], done: true }] } };

test("valid items pass through unchanged", () => {
  const items = [W,
    { id: "b-2026-10-17", data: { date: "2026-10-17", weight: 80.5, updated: 1 } },
    { id: "program", data: { v: 2, updated: 1, days: [{ id: "d1", name: "Push", focus: ["Chest"], exercises: ["Bench Press"], weekdays: [6] }] } },
    { id: "profile", data: { sex: "male", height: 180, birthYear: 1998, goal: "muscle" } },
    { id: "settings", data: { rest: { "Bench Press": 150 }, updated: 1 } }];
  const r = cleanBackupItems(items, OPTS);
  assert.equal(r.skipped, 0);
  assert.deepEqual(r.items, items);
});

test("a workout whose date doesn't match its id is skipped", () => {
  const bad = { id: "w-2026-10-17", data: { ...W.data, date: '"><img src=x onerror=alert(1)>' } };
  assert.deepEqual(cleanBackupItems([bad], OPTS), { items: [], skipped: 1 });
});

test("bad sets and entries are dropped, the rest of the workout kept", () => {
  const data = { ...W.data, entries: [
    { ex: "Bench Press", sets: [{ w: 60, r: 8 }, { w: "60", r: 8 }, { w: -5, r: 3 }, { w: 50, r: 0 }, { w: 50, r: 2.5 }] },
    { ex: "", sets: [] }, { ex: 42, sets: [] }, "nope", { ex: "Squat" }] };
  const r = cleanBackupItems([{ id: W.id, data }], OPTS);
  assert.equal(r.skipped, 0);
  assert.deepEqual(r.items[0].data.entries, [{ ex: "Bench Press", sets: [{ w: 60, r: 8 }] }, { ex: "Squat", sets: [] }]);
});

test("workout without an entries array is skipped", () =>
  assert.equal(cleanBackupItems([{ id: W.id, data: { date: "2026-10-17" } }], OPTS).skipped, 1));

test("body entry keeps only known numeric fields", () => {
  const r = cleanBackupItems([{ id: "b-2026-10-17", data: { date: "2026-10-17", weight: 80, waist: "<b>", junk: 5, pbf: -1 } }], OPTS);
  assert.deepEqual(r.items[0].data, { date: "2026-10-17", weight: 80 });
});

test("profile keeps only valid values", () => {
  const r = cleanBackupItems([{ id: "profile", data: { sex: "<script>", height: "180", birthYear: 1998, goal: "hack" } }], OPTS);
  assert.deepEqual(r.items[0].data, { sex: null, height: null, birthYear: 1998, goal: null });
});

test("program days are cleaned; a non-array days skips the item", () => {
  const r = cleanBackupItems([{ id: "program", data: { v: 2, days: [
    { id: "d1", name: "Push", focus: ["Chest", "Wings"], exercises: ["Bench Press", 7], weekdays: [6, 9, "1"] },
    { id: 5, name: "x" }] } }], OPTS);
  assert.deepEqual(r.items[0].data.days, [{ id: "d1", name: "Push", focus: ["Chest"], exercises: ["Bench Press"], weekdays: [6] }]);
  assert.equal(cleanBackupItems([{ id: "program", data: { days: "x" } }], OPTS).skipped, 1);
});

test("settings rest values must be 15-600 seconds", () => {
  const r = cleanBackupItems([{ id: "settings", data: { rest: { a: 90, b: 5, c: "90", d: 700 } } }], OPTS);
  assert.deepEqual(r.items[0].data.rest, { a: 90 });
});

test("unknown ids and non-objects are skipped", () =>
  assert.deepEqual(cleanBackupItems([{ id: "evil", data: {} }, null, { id: "profile", data: "x" }], OPTS), { items: [], skipped: 3 }));

test("long text is cut, not trusted", () => {
  const r = cleanBackupItems([{ id: W.id, data: { ...W.data, dayName: "x".repeat(500) } }], OPTS);
  assert.equal(r.items[0].data.dayName.length, 60);
});

test("set times and valid cardio are kept", () => {
  const data = { ...W.data, entries: [{ ex: "Bench Press", sets: [{ w: 60, r: 8, t: 1760000000000 }, { w: 60, r: 8, t: -1 }] }],
    cardio: [{ id: "c1", type: "bike", min: 30, intensity: "easy", kcal: null }, { id: "c2", type: "treadmill", min: 20, intensity: "hard", kcal: 250 },
             { id: "c3", type: "rocket", min: 20, intensity: "easy", kcal: null }, { id: "c4", type: "bike", min: 0, intensity: "easy", kcal: null },
             { id: "c5", type: "bike", min: 20, intensity: "easy", kcal: 9000 }] };
  const r = cleanBackupItems([{ id: W.id, data }], OPTS).items[0].data;
  assert.deepEqual(r.entries[0].sets, [{ w: 60, r: 8, t: 1760000000000 }, { w: 60, r: 8 }]);
  assert.deepEqual(r.cardio, [data.cardio[0], data.cardio[1]]);
});

test("old workouts without t or cardio restore unchanged", () =>
  assert.deepEqual(cleanBackupItems([W], OPTS).items, [W]));

test("food docs are cleaned; doc without valid meals is skipped", () => {
  const f = { id: "f-2026-10-17", data: { date: "2026-10-17", updated: 1, meals: [
    { id: "m1", name: "Lunch", kcal: 650, protein: 45 }, { id: "m2", name: null, kcal: 300, protein: null },
    { id: "m3", name: "x", kcal: 0, protein: null }, { id: "m4", name: "y".repeat(80), kcal: 100, protein: 900 }] } };
  const r = cleanBackupItems([f], OPTS).items[0].data;
  assert.deepEqual(r.meals.map(m => m.id), ["m1", "m2", "m4"]);
  assert.equal(r.meals[2].name.length, 40);
  assert.equal(r.meals[2].protein, null);
  assert.equal(cleanBackupItems([{ id: "f-2026-10-17", data: { date: "2026-10-17", meals: [] } }], OPTS).skipped, 1);
  assert.equal(cleanBackupItems([{ id: "f-2026-10-17", data: { date: "2026-10-16", meals: f.data.meals } }], OPTS).skipped, 1);
});

test("profile goal fields are kept when valid", () => {
  const r = cleanBackupItems([{ id: "profile", data: { sex: "male", height: 180, birthYear: 1998, goal: "muscle", goalWeight: 75, goalStart: "2026-10-01" } }], OPTS);
  assert.equal(r.items[0].data.goalWeight, 75);
  assert.equal(r.items[0].data.goalStart, "2026-10-01");
  const bad = cleanBackupItems([{ id: "profile", data: { goalWeight: 500, goalStart: "<b>" } }], OPTS).items[0].data;
  assert.equal(bad.goalWeight, null);
  assert.equal(bad.goalStart, null);
});

test("profile without goal fields is unchanged", () => {
  const p = { id: "profile", data: { sex: "male", height: 180, birthYear: 1998, goal: "muscle" } };
  assert.deepEqual(cleanBackupItems([p], OPTS).items, [p]);
});

test("settings seenBadges keeps short strings only", () => {
  const r = cleanBackupItems([{ id: "settings", data: { rest: {}, seenBadges: ["workouts-1", 5, "x".repeat(50), "pr-1"] } }], OPTS);
  assert.deepEqual(r.items[0].data.seenBadges, ["workouts-1", "pr-1"]);
  assert.equal("seenBadges" in cleanBackupItems([{ id: "settings", data: { rest: {} } }], OPTS).items[0].data, false);
});
