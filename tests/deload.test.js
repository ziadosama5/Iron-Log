import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanDeload, activeDeload, deloadDate, stalledLifts, suggestDeload, deloadWeight, deloadSets, deloadAdvice } from "../public/deload.js";

const S = (w, r, k) => (k ? { w, r, k } : { w, r });

test("cleanDeload keeps real dates, drops junk, allows end one day before start (cancelled)", () => {
  assert.deepEqual(cleanDeload({ start: "2026-10-20", end: "2026-10-24", dismissedUntil: "2026-11-10", junk: 1 }), { start: "2026-10-20", end: "2026-10-24", dismissedUntil: "2026-11-10" });
  assert.deepEqual(cleanDeload({ start: "2026-02-30" }), {}, "not a real date");
  assert.deepEqual(cleanDeload({ start: "x", end: "2026-10-24" }), {}, "a bad start drops the end too");
  assert.deepEqual(cleanDeload({ end: "2026-10-24" }), {}, "an end needs a start");
  assert.deepEqual(cleanDeload({ start: "2026-10-20", end: "2026-10-19" }), { start: "2026-10-20", end: "2026-10-19" }, "cancelled on day 1");
  assert.deepEqual(cleanDeload({ start: "2026-10-20", end: "2026-10-18" }), { start: "2026-10-20" }, "an end before that is junk");
  assert.deepEqual(cleanDeload({ dismissedUntil: "bad" }), {});
  for (const none of [null, undefined, [], "x", 5]) assert.deepEqual(cleanDeload(none), {}, String(none));
});

test("activeDeload: seven days from the start, ended early, cancelled, month boundary", () => {
  const d = { start: "2026-10-20" };
  assert.deepEqual(activeDeload(d, "2026-10-20"), { start: "2026-10-20", end: "2026-10-26", day: 1 });
  assert.equal(activeDeload(d, "2026-10-26").day, 7);
  assert.equal(activeDeload(d, "2026-10-19"), null); assert.equal(activeDeload(d, "2026-10-27"), null);
  assert.equal(activeDeload({ start: "2026-10-28" }, "2026-11-03").day, 7);
  assert.equal(activeDeload({ start: "2026-10-20", end: "2026-10-22" }, "2026-10-22").day, 3);
  assert.equal(activeDeload({ start: "2026-10-20", end: "2026-10-22" }, "2026-10-23"), null, "ended early");
  assert.equal(activeDeload({ start: "2026-10-20", end: "2026-10-19" }, "2026-10-20"), null, "cancelled on the first day");
  for (const none of [undefined, null, {}, { start: "bad" }]) assert.equal(activeDeload(none, "2026-10-20"), null);
});

test("deloadDate: the same window, whatever today is", () => {
  const d = { start: "2026-10-20" };
  assert.equal(deloadDate("2026-10-20", d), true); assert.equal(deloadDate("2026-10-26", d), true);
  assert.equal(deloadDate("2026-10-19", d), false); assert.equal(deloadDate("2026-10-27", d), false);
  assert.equal(deloadDate("2026-10-23", { start: "2026-10-20", end: "2026-10-22" }), false);
  assert.equal(deloadDate("2026-10-20", { start: "2026-10-20", end: "2026-10-19" }), false);
  assert.equal(deloadDate("2026-10-20", undefined), false);
});

test("suggestDeload: streak or stalled lifts, never while active, dismissed or inside the cooldown", () => {
  const base = { deload: undefined, today: "2026-10-25", streakWeeks: 0, stalled: [] };
  assert.equal(suggestDeload({ ...base, streakWeeks: 5 }), null);
  assert.deepEqual(suggestDeload({ ...base, streakWeeks: 6 }), { reason: "streak", weeks: 6 });
  assert.equal(suggestDeload({ ...base, stalled: ["a", "b"] }), null);
  assert.deepEqual(suggestDeload({ ...base, stalled: ["a", "b", "c"] }), { reason: "stalled", lifts: 3 });
  assert.equal(suggestDeload({ ...base, streakWeeks: 8, stalled: ["a", "b", "c"] }).reason, "streak", "streak wins");
  assert.equal(suggestDeload({ ...base, streakWeeks: 6, deload: { start: "2026-10-22" } }), null, "active");
  assert.equal(suggestDeload({ ...base, streakWeeks: 6, deload: { dismissedUntil: "2026-10-25" } }), null, "dismissed until today");
  assert.notEqual(suggestDeload({ ...base, streakWeeks: 6, deload: { dismissedUntil: "2026-10-24" } }), null, "yesterday has passed");
  assert.equal(suggestDeload({ ...base, streakWeeks: 6, deload: { start: "2026-09-14" } }), null, "41 days after the last start");
  assert.notEqual(suggestDeload({ ...base, streakWeeks: 6, deload: { start: "2026-09-13" } }), null, "42 days after");
  assert.notEqual(suggestDeload({ ...base, streakWeeks: 6, deload: { dismissedUntil: "bad", start: "bad" } }), null, "junk is ignored");
});

const wk = (date, ex, sets, extra = {}) => ({ date, entries: [{ ex, sets, ...extra }] });
const flat = (n, ex = "Bench Press", w = 60, extra = {}, w0 = {}) => Array.from({ length: n }, (_, i) => ({ ...wk("2026-09-" + String(i + 1).padStart(2, "0"), ex, [S(w, 8)], extra), ...w0 }));

test("stalledLifts: four sessions, the last three no better than before, names merged, noise ignored", () => {
  assert.deepEqual(stalledLifts(flat(4)), ["Bench Press"]);
  assert.deepEqual(stalledLifts(flat(3)), [], "three sessions are not enough");
  const rising = [60, 62.5, 65, 67.5].map((w, i) => wk("2026-09-0" + (i + 1), "Squat", [S(w, 8)]));
  assert.deepEqual(stalledLifts(rising), []);
  const mixedCase = [wk("2026-09-01", "Bench Press", [S(60, 8)]), wk("2026-09-02", "bench press", [S(60, 8)]), wk("2026-09-03", "Bench Press", [S(60, 8)]), wk("2026-09-04", "BENCH PRESS", [S(60, 8)])];
  assert.equal(stalledLifts(mixedCase).length, 1);
  assert.deepEqual(stalledLifts(flat(5, "Pull-up", 0, { bw: true })), [], "bodyweight entries have no one-rep max");
  const warm = flat(4).map(w => ({ ...w, entries: [{ ex: "Bench Press", sets: [S(100, 8, "w"), S(60, 8)] }] }));
  assert.deepEqual(stalledLifts(warm), ["Bench Press"], "a heavy warm-up never counts as a best");
  const dropOnly = flat(4).map(w => ({ ...w, entries: [{ ex: "Bench Press", sets: [S(50, 8, "d")] }] }));
  assert.deepEqual(stalledLifts(dropOnly), [], "drop sets are not working sets");
});

test("stalledLifts: a deload week after a plateau does not create or hide a stall", () => {
  const normal = [60, 62.5, 65, 67.5, 70].map((w, i) => wk("2026-09-0" + (i + 1), "Squat", [S(w, 8)]));
  const withDeload = [...normal, { ...wk("2026-09-09", "Squat", [S(50, 8)]), deload: true }, { ...wk("2026-09-10", "Squat", [S(50, 8)]), deload: true }, { ...wk("2026-09-11", "Squat", [S(50, 8)]), deload: true }];
  assert.deepEqual(stalledLifts(withDeload), [], "still progressing without the deload sessions");
});

test("deloadWeight and deloadSets", () => {
  for (const [top, want] of [[80, 72.5], [100, 90], [20, 17.5], [3, 2.5], [62.5, 55], [2, 2]]) assert.equal(deloadWeight(top), want, String(top));
  for (const top of [2.5, 5, 40, 62.5, 142.5]) assert.ok(deloadWeight(top) <= top, "never above " + top);
  for (const [n, want] of [[3, 2], [4, 2], [5, 3], [1, 1], [10, 6]]) assert.equal(deloadSets(n), want, String(n));
});

test("deloadAdvice: lighter weight for weighted lifts, sets only for bodyweight and holds, nothing without history", () => {
  const target = { sets: 3, min: 5, max: 8 };
  assert.deepEqual(deloadAdvice({ last: [S(80, 8), S(80, 8), S(80, 7)], target }), { w: 72.5, r: 8, sets: 2 });
  assert.deepEqual(deloadAdvice({ last: [S(40, 10, "w"), S(80, 6), S(60, 12, "d")], target }), { w: 72.5, r: 6, sets: 2 }, "warm-ups and drops ignored");
  assert.deepEqual(deloadAdvice({ last: [S(0, 12), S(0, 12)], target, bw: true }), { sets: 2 });
  assert.deepEqual(deloadAdvice({ last: [S(0, 60)], target, bw: true, hold: true }), { sets: 2 });
  for (const last of [null, undefined, [], [S(40, 10, "w")]]) assert.equal(deloadAdvice({ last, target }), null, JSON.stringify(last));
  assert.equal(deloadAdvice({ last: [S(0, 15)], target }), null, "a weighted lift with no weight");
});
