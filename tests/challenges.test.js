import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_MEMBERS, MAX_INVITEES, MAX_OPEN, WEEK_CHOICES, addDaysISO, weekStart, nextSaturday, challengeDates,
  statusOf, dayNumber, countDays, rankMembers, winners, planCreate, planAccept, planLeave, planDelete, planProgress
} from "../public/challenges.js";

const paths = r => r.ops.map(o => o.op + " " + o.path.join("/"));

test("constants", () => {
  assert.equal(MAX_MEMBERS, 6); assert.equal(MAX_INVITEES, 5); assert.equal(MAX_OPEN, 5);
  assert.deepEqual(WEEK_CHOICES, [1, 2, 4]);
});

test("addDaysISO crosses months, years and goes backwards", () => {
  assert.equal(addDaysISO("2026-10-30", 3), "2026-11-02");
  assert.equal(addDaysISO("2026-12-30", 5), "2027-01-04");
  assert.equal(addDaysISO("2026-03-01", -1), "2026-02-28");
  assert.equal(addDaysISO("2026-10-19", 0), "2026-10-19");
});

test("weekStart is the Saturday on or before the date (2026-10-17 is a Saturday)", () => {
  assert.equal(weekStart("2026-10-17"), "2026-10-17");
  assert.equal(weekStart("2026-10-18"), "2026-10-17");
  assert.equal(weekStart("2026-10-19"), "2026-10-17");
  assert.equal(weekStart("2026-10-23"), "2026-10-17");
  assert.equal(weekStart("2026-10-24"), "2026-10-24");
});

test("nextSaturday is 1 to 7 days after today", () => {
  assert.equal(nextSaturday("2026-10-17"), "2026-10-24");
  assert.equal(nextSaturday("2026-10-20"), "2026-10-24");
  assert.equal(nextSaturday("2026-10-23"), "2026-10-24");
  assert.equal(nextSaturday("2026-10-24"), "2026-10-31");
});

test("challengeDates: start today or next Saturday, 1/2/4 weeks, last day inclusive", () => {
  assert.deepEqual(challengeDates({ startChoice: "today", weeks: 1, today: "2026-10-19" }), { start: "2026-10-19", end: "2026-10-25" });
  assert.deepEqual(challengeDates({ startChoice: "today", weeks: 2, today: "2026-10-19" }), { start: "2026-10-19", end: "2026-11-01" });
  assert.deepEqual(challengeDates({ startChoice: "today", weeks: 4, today: "2026-10-19" }), { start: "2026-10-19", end: "2026-11-15" });
  assert.deepEqual(challengeDates({ startChoice: "saturday", weeks: 1, today: "2026-10-19" }), { start: "2026-10-24", end: "2026-10-30" });
  assert.throws(() => challengeDates({ startChoice: "tomorrow", weeks: 1, today: "2026-10-19" }));
  assert.throws(() => challengeDates({ startChoice: "today", weeks: 3, today: "2026-10-19" }));
});

test("statusOf and dayNumber at the edges of a challenge", () => {
  const ch = { start: "2026-10-19", end: "2026-10-25", weeks: 1 };
  assert.equal(statusOf(ch, "2026-10-18"), "upcoming");
  assert.equal(statusOf(ch, "2026-10-19"), "active");
  assert.equal(statusOf(ch, "2026-10-25"), "active");
  assert.equal(statusOf(ch, "2026-10-26"), "finished");
  assert.equal(dayNumber(ch, "2026-10-18"), null);
  assert.deepEqual(dayNumber(ch, "2026-10-19"), { day: 1, total: 7 });
  assert.deepEqual(dayNumber(ch, "2026-10-22"), { day: 4, total: 7 });
  assert.deepEqual(dayNumber(ch, "2026-10-25"), { day: 7, total: 7 });
  assert.equal(dayNumber(ch, "2026-10-26"), null);
});

test("countDays: only trained dates inside the range, up to today, each date once", () => {
  const w = (date, trained = true) => ({ date, trained });
  const isTrained = x => x.trained;
  const ws = [w("2026-10-18"), w("2026-10-19"), w("2026-10-19"), w("2026-10-20", false), w("2026-10-21"), w("2026-10-25"), w("2026-10-26")];
  assert.equal(countDays(ws, "2026-10-19", "2026-10-25", "2026-10-30", isTrained), 3, "before start, a rest day and after end are ignored; the last day counts; duplicates once");
  assert.equal(countDays(ws, "2026-10-19", "2026-10-25", "2026-10-21", isTrained), 2, "days after today are not counted yet");
  assert.equal(countDays([], "2026-10-19", "2026-10-25", "2026-10-21", isTrained), 0);
  assert.equal(countDays([{ date: "2026-10-20", cardio: [1], entries: [] }], "2026-10-19", "2026-10-25", "2026-10-25", x => x.cardio.length > 0 || x.entries.length > 0), 1, "isTrained decides");
});

test("rankMembers: days desc, name asc, competition ranks, invited people last", () => {
  const rows = rankMembers({
    members: ["a", "b", "c", "d", "e"], joined: ["a", "b", "c", "d"],
    progress: { a: { days: 5 }, b: { days: 3 }, c: { days: 3 }, d: { days: 1 } },
    names: { a: "Ann", b: "bob", c: "Cara", d: "dan", e: "eve" }
  });
  assert.deepEqual(rows.map(r => r.uid), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(rows.map(r => r.rank), [1, 2, 2, 4, null]);
  assert.deepEqual(rows.map(r => r.days), [5, 3, 3, 1, 0]);
  assert.deepEqual(rows.map(r => r.joined), [true, true, true, true, false]);
  const lone = rankMembers({ members: ["x"], joined: ["x"], progress: {}, names: {} });
  assert.deepEqual(lone, [{ uid: "x", name: "?", days: 0, rank: 1, joined: true }]);
});

test("winners: only when finished, ties give several, nobody wins with zero days", () => {
  const rows = rankMembers({ members: ["a", "b", "c"], joined: ["a", "b", "c"], progress: { a: { days: 4 }, b: { days: 4 }, c: { days: 1 } }, names: { a: "A", b: "B", c: "C" } });
  assert.deepEqual(winners(rows, "active"), []);
  assert.deepEqual(winners(rows, "upcoming"), []);
  assert.deepEqual(winners(rows, "finished"), ["a", "b"]);
  const zero = rankMembers({ members: ["a", "b"], joined: ["a", "b"], progress: {}, names: { a: "A", b: "B" } });
  assert.deepEqual(winners(zero, "finished"), []);
});

test("planCreate writes one challenge document", () => {
  const r = planCreate({ cid: "c1", owner: "u1", ownerName: "ziad", invitees: [{ uid: "u2", name: "zed" }, { uid: "u3", name: "omar" }], weeks: 2, startChoice: "today", today: "2026-10-19", now: 7 });
  assert.deepEqual(paths(r), ["set challenges/c1"]);
  assert.deepEqual(r.ops[0].data, {
    owner: "u1", members: ["u1", "u2", "u3"], joined: ["u1"], names: { u1: "ziad", u2: "zed", u3: "omar" },
    start: "2026-10-19", weeks: 2, end: "2026-11-01", updated: 7
  });
  const sat = planCreate({ cid: "c1", owner: "u1", ownerName: "ziad", invitees: [{ uid: "u2", name: "zed" }], weeks: 1, startChoice: "saturday", today: "2026-10-19", now: 7 });
  assert.equal(sat.ops[0].data.start, "2026-10-24");
});

test("planCreate rejects bad input", () => {
  const base = { cid: "c1", owner: "u1", ownerName: "ziad", invitees: [{ uid: "u2", name: "zed" }], weeks: 1, startChoice: "today", today: "2026-10-19", now: 1 };
  assert.throws(() => planCreate({ ...base, invitees: [] }), "no invitee");
  const six = Array.from({ length: 6 }, (_, i) => ({ uid: "f" + i, name: "n" + i }));
  assert.throws(() => planCreate({ ...base, invitees: six }), "six invitees");
  assert.doesNotThrow(() => planCreate({ ...base, invitees: six.slice(0, 5) }));
  assert.throws(() => planCreate({ ...base, invitees: [{ uid: "u2", name: "a" }, { uid: "u2", name: "a" }] }), "duplicate");
  assert.throws(() => planCreate({ ...base, invitees: [{ uid: "u1", name: "ziad" }] }), "owner as invitee");
  assert.throws(() => planCreate({ ...base, weeks: 3 }), "weeks");
});

test("planAccept adds me to joined once; planLeave deletes my progress first and never lets the owner leave", () => {
  const cur = { owner: "u1", members: ["u1", "u2", "u3"], joined: ["u1"], names: { u1: "ziad", u2: "zed", u3: "omar" } };
  const a = planAccept({ cid: "c1", me: "u2", current: cur, now: 5 });
  assert.deepEqual(paths(a), ["update challenges/c1"]);
  assert.deepEqual(a.ops[0].data, { joined: ["u1", "u2"], updated: 5 });
  assert.throws(() => planAccept({ cid: "c1", me: "u2", current: { ...cur, joined: ["u1", "u2"] }, now: 5 }), "already joined");
  assert.throws(() => planAccept({ cid: "c1", me: "u9", current: cur, now: 5 }), "not invited");
  const l = planLeave({ cid: "c1", me: "u2", current: { ...cur, joined: ["u1", "u2"] }, now: 6 });
  assert.deepEqual(paths(l), ["delete challenges/c1/progress/u2", "update challenges/c1"]);
  assert.deepEqual(l.ops[1].data, { members: ["u1", "u3"], joined: ["u1"], names: { u1: "ziad", u3: "omar" }, updated: 6 }, "my username leaves with me");
  assert.throws(() => planLeave({ cid: "c1", me: "u1", current: cur, now: 6 }), "owner cannot leave");
});

test("planDelete removes every progress document before the challenge; planProgress sets my score", () => {
  assert.deepEqual(paths(planDelete({ cid: "c1", memberUids: ["u1", "u2"] })), ["delete challenges/c1/progress/u1", "delete challenges/c1/progress/u2", "delete challenges/c1"]);
  const p = planProgress({ cid: "c1", me: "u2", days: 3, now: 9 });
  assert.deepEqual(paths(p), ["set challenges/c1/progress/u2"]);
  assert.deepEqual(p.ops[0].data, { days: 3, updated: 9 });
});

import { standing, timeLeft, myResult } from "../public/challenges.js";
const row = (uid, name, days, rank, joined = true) => ({ uid, name, days, rank, joined });

test("standing: leading with the gap to second, tied for first, behind the leader, alone, not in it", () => {
  const rows = [row("a", "zed", 5, 1), row("me", "ziad", 2, 2), row("o", "omar", 0, null, false)];
  assert.deepEqual(standing(rows, "a"), { kind: "leading", rank: 1, of: 2, gap: 3, leader: "zed" });
  assert.deepEqual(standing(rows, "me"), { kind: "behind", rank: 2, of: 2, gap: 3, leader: "zed" });
  assert.equal(standing(rows, "o"), null);
  assert.equal(standing(rows, "nobody"), null);
  const tie = [row("a", "zed", 4, 1), row("me", "ziad", 4, 1)];
  assert.equal(standing(tie, "me").kind, "tied");
  assert.deepEqual(standing([row("me", "ziad", 1, 1)], "me"), { kind: "alone", rank: 1, of: 1, gap: 0, leader: "ziad" });
});

test("timeLeft: upcoming, active (day, left, percent) and finished", () => {
  const ch = { start: "2026-10-20", end: "2026-11-02", weeks: 2 };
  assert.deepEqual(timeLeft(ch, "2026-10-18"), { status: "upcoming", day: null, total: 14, left: 14, pct: 0, startsIn: 2 });
  assert.deepEqual(timeLeft(ch, "2026-10-23"), { status: "active", day: 4, total: 14, left: 10, pct: 29, startsIn: 0 });
  assert.deepEqual(timeLeft(ch, "2026-11-02"), { status: "active", day: 14, total: 14, left: 0, pct: 100, startsIn: 0 });
  assert.deepEqual(timeLeft(ch, "2026-11-05"), { status: "finished", day: null, total: 14, left: 0, pct: 100, startsIn: 0 });
});

test("myResult: rank and field size, null when not joined or nobody joined", () => {
  const rows = [row("a", "zed", 5, 1), row("me", "ziad", 2, 2), row("o", "omar", 0, null, false)];
  assert.deepEqual(myResult(rows, "me"), { rank: 2, of: 2 });
  assert.equal(myResult(rows, "o"), null);
  assert.equal(myResult([], "me"), null);
});
