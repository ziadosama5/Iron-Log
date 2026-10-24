import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  RESERVED_USERNAMES, SUMMARY_LIMITS, normalizeUsername, validUsername, normalizeEmail,
  buildSummary, clampSummary, summaryEqual, shareLabel, planShare
} from "../public/social.js";

const W = (date, sets) => ({ id: "w-" + date, date, dayId: "d1", dayName: "Push", entries: [{ ex: "Bench Press", sets: sets.map(([w, r]) => ({ w, r })) }] });
const base = { body: [], food: {}, days: [{ id: "d1", name: "Push", focus: ["Chest"], exercises: ["Bench Press"], weekdays: [] }], profile: {} };

test("normalizeUsername trims, drops one leading @ and lower-cases", () => {
  assert.equal(normalizeUsername("  @Ziad_99 "), "ziad_99");
  assert.equal(normalizeUsername(null), "");
  assert.equal(normalizeUsername("@@x"), "@x");
});

test("validUsername: format rules and the reserved list", () => {
  for (const ok of ["ziad", "a_b.c9", "abc", "a".repeat(20)]) assert.deepEqual(validUsername(ok), { ok: true }, ok);
  assert.equal(validUsername("ab").reason, "short");
  assert.equal(validUsername("a".repeat(21)).reason, "long");
  for (const bad of ["zi ad", "zi-ad", "زياد", "Ziad", "a@b"]) assert.equal(validUsername(bad).reason, "chars", bad);
  for (const bad of [".abc", "abc_", "_abc", "abc."]) assert.equal(validUsername(bad).reason, "edges", bad);
  assert.equal(validUsername("a..b").reason, "dots");
  for (const r of RESERVED_USERNAMES) assert.equal(validUsername(r).ok, false, r);
  assert.ok(RESERVED_USERNAMES.includes("admin") && RESERVED_USERNAMES.includes("iron-log") === true);
});

test("normalizeEmail accepts plain addresses only", () => {
  assert.equal(normalizeEmail(" Ziad@Example.COM "), "ziad@example.com");
  for (const bad of ["a@b", "a b@c.d", "a/b@c.de", "", null, "x@@y.zz", undefined, 5]) assert.equal(normalizeEmail(bad), null, String(bad));
});

test("buildSummary: empty data", () => {
  const s = buildSummary({ ...base, workouts: [], today: "2026-10-17" }, 111);
  assert.deepEqual(
    { w: s.workoutsWeek, w30: s.workouts30, t: s.workoutsTotal, v: s.volumeWeekKg, p: s.prs30, l: s.lastWorkout, lv: s.level, u: s.updated },
    { w: 0, w30: 0, t: 0, v: 0, p: 0, l: null, lv: 1, u: 111 });
});

test("buildSummary: the week runs Saturday to Friday and volume uses only that week", () => {
  const ws = [W("2026-10-17", [[100, 10]]), W("2026-10-16", [[50, 10]]), W("2026-10-14", [[40, 10]])];
  const s = buildSummary({ ...base, workouts: ws, today: "2026-10-17" }, 1);
  assert.equal(s.workoutsWeek, 1, "only Saturday 17th is in this week");
  assert.equal(s.workouts30, 3);
  assert.equal(s.workoutsTotal, 3);
  assert.equal(s.volumeWeekKg, 1000);
  assert.equal(s.lastWorkout, "2026-10-17");
  const mid = buildSummary({ ...base, workouts: ws, today: "2026-10-16" }, 1);
  assert.equal(mid.workoutsWeek, 2, "on Friday the 16th the week started Saturday the 10th: 16th and 14th");
});

test("buildSummary: PRs only count inside the last 30 days; cardio-only days count as trained days like everywhere else in the app", () => {
  const ws = [W("2026-08-01", [[60, 5]]), W("2026-08-08", [[62.5, 5]]), W("2026-08-15", [[65, 5]]), W("2026-10-10", [[80, 5]]),
    { id: "w-2026-10-12", date: "2026-10-12", dayId: null, dayName: "Cardio", entries: [], cardio: [{ id: "c", type: "bike", min: 20, intensity: "easy", kcal: null }] }];
  const s = buildSummary({ ...base, workouts: ws, today: "2026-10-17" }, 1);
  assert.equal(s.prs30, 1);
  assert.equal(s.workoutsTotal, 5, "trainedOn counts a cardio-only day");
  assert.equal(s.lastWorkout, "2026-10-12");
});

test("clampSummary keeps every field inside the limits the rules enforce", () => {
  const huge = { level: 9999, xp: 1e12, title: "x".repeat(50), badges: 500, streakWeeks: 99999, foodDays: 99999, workoutsWeek: 500, workouts30: 5000, workoutsTotal: 1e9, volumeWeekKg: 1e12, prs30: 9999, lastWorkout: "2026-10-17", updated: 5 };
  const c = clampSummary(huge);
  for (const [k, [lo, hi]] of Object.entries(SUMMARY_LIMITS)) assert.ok(c[k] >= lo && c[k] <= hi, k);
  assert.ok(c.title.length <= 20);
  const neg = clampSummary({ ...huge, level: -5, xp: -1, volumeWeekKg: -3 });
  assert.equal(neg.level, SUMMARY_LIMITS.level[0]);
  assert.equal(neg.xp, 0);
  assert.equal(neg.volumeWeekKg, 0);
  assert.equal(buildSummary({ ...base, workouts: [W("2026-10-17", [[1e7, 100]])], today: "2026-10-17" }, 1).volumeWeekKg, SUMMARY_LIMITS.volumeWeekKg[1]);
});

test("summaryEqual ignores updated", () => {
  const a = buildSummary({ ...base, workouts: [], today: "2026-10-17" }, 1);
  assert.equal(summaryEqual(a, { ...a, updated: 999 }), true);
  assert.equal(summaryEqual(a, { ...a, level: 2 }), false);
  assert.equal(summaryEqual(null, null), true);
  assert.equal(summaryEqual(null, a), false);
});

test("shareLabel", () => {
  assert.equal(shareLabel("friends"), "Friends");
  assert.equal(shareLabel("public"), "Public");
  assert.equal(shareLabel("private"), "Private");
  assert.equal(shareLabel("whatever"), "Private");
});

const S = buildSummary({ ...base, workouts: [], today: "2026-10-17" }, 1);
const nxt = (o = {}) => ({ username: "ziad", displayName: "Ziad", visibility: "private", findByEmail: false, ...o });
const paths = r => r.ops.map(o => o.op + " " + o.path.join("/"));

test("planShare: first claim", () => {
  const r = planShare({ uid: "u1", current: null, next: nxt(), email: "z@x.com", summary: null, now: 50 });
  assert.deepEqual(paths(r), ["set usernames/ziad", "set profiles/u1"]);
  assert.deepEqual(r.ops[0].data, { uid: "u1", updated: 50 });
  assert.equal(r.ops[1].data.updated, 50);
});

test("planShare: renaming frees the old name", () => {
  const cur = { username: "ziad", displayName: "Ziad", visibility: "private", findByEmail: false };
  const r = planShare({ uid: "u1", current: cur, next: nxt({ username: "zed" }), email: null, summary: null, now: 1 });
  assert.deepEqual(paths(r), ["set usernames/zed", "delete usernames/ziad", "set profiles/u1"]);
});

test("planShare: only the display name changed touches just the profile", () => {
  const cur = { username: "ziad", displayName: "Ziad", visibility: "private", findByEmail: false };
  const r = planShare({ uid: "u1", current: cur, next: nxt({ displayName: "Z" }), email: null, summary: null, now: 9 });
  assert.deepEqual(paths(r), ["set profiles/u1"]);
});

test("planShare: the summary is written only when friends or public", () => {
  const cur = { username: "ziad", displayName: "Ziad", visibility: "public", findByEmail: false };
  const priv = planShare({ uid: "u1", current: cur, next: nxt({ visibility: "private" }), email: null, summary: S, now: 1 });
  assert.equal("summary" in priv.ops.find(o => o.path[0] === "profiles").data, false);
  for (const v of ["friends", "public"]) {
    const r = planShare({ uid: "u1", current: cur, next: nxt({ visibility: v }), email: null, summary: S, now: 1 });
    assert.deepEqual(r.ops.find(o => o.path[0] === "profiles").data.summary, S);
  }
});

test("planShare: e-mail search on and off", () => {
  const off = { username: "ziad", displayName: "Ziad", visibility: "private", findByEmail: false };
  const on = { ...off, findByEmail: true };
  assert.deepEqual(planShare({ uid: "u1", current: off, next: nxt({ findByEmail: true }), email: null, summary: null, now: 1 }), { error: "email-needed" });
  const a = planShare({ uid: "u1", current: off, next: nxt({ findByEmail: true }), email: "z@x.com", summary: null, now: 1 });
  assert.equal(paths(a).at(-1), "set emails/z@x.com");
  assert.deepEqual(a.ops.at(-1).data, { uid: "u1" });
  assert.equal(paths(a).indexOf("set profiles/u1") < paths(a).indexOf("set emails/z@x.com"), true, "profile before e-mail");
  const b = planShare({ uid: "u1", current: on, next: nxt({ findByEmail: false }), email: "z@x.com", summary: null, now: 1 });
  assert.equal(paths(b).at(-1), "delete emails/z@x.com");
});

test("every Summary field is mentioned in firestore.rules (kept in sync)", { skip: !/profiles/.test(readFileSync(new URL("../firestore.rules", import.meta.url), "utf8")) }, () => {
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  for (const k of Object.keys(SUMMARY_LIMITS)) assert.ok(rules.includes(k), `${k} missing in firestore.rules`);
  assert.ok(existsSync(new URL("../firestore.rules", import.meta.url)));
});

import { shouldPublish } from "../public/social.js";

test("shouldPublish: never while private, never for an unchanged summary, not inside the minimum gap", () => {
  const a = buildSummary({ ...base, workouts: [], today: "2026-10-17" }, 1);
  const b = { ...a, workoutsWeek: 1 };
  const at = (o) => shouldPublish({ visibility: "public", last: a, next: b, lastAt: 0, now: 25000, ...o });
  assert.equal(at({ visibility: "private" }), false);
  assert.equal(at({ next: { ...a, updated: 77 } }), false, "only `updated` differs");
  assert.equal(at({ now: 5000 }), false, "5 s after the last publish");
  assert.equal(at({ now: 25000 }), true);
  assert.equal(at({ visibility: "friends" }), true);
  assert.equal(at({ last: null }), true, "never published before");
  assert.equal(at({ visibility: undefined }), false);
});

import { lookupResult } from "../public/social.js";

test("lookupResult: blank, invalid, and the same answer for missing and hidden", () => {
  assert.equal(lookupResult("   ", null).kind, "empty");
  assert.equal(lookupResult("a", null).kind, "invalid");
  assert.equal(lookupResult("a b", null).kind, "invalid");
  assert.deepEqual(lookupResult("zed", { status: "none" }), lookupResult("zed", null));
  assert.deepEqual(lookupResult("zed", null), { kind: "none" });
});

test("lookupResult: a found profile becomes a card, summary only when readable", () => {
  const prof = { username: "zed", displayName: "Zed", visibility: "public", summary: { level: 2 } };
  assert.deepEqual(lookupResult("@Zed", { status: "found", uid: "u2", profile: prof }), { kind: "card", card: { uid: "u2", displayName: "Zed", username: "zed", summary: { level: 2 } } });
  const noSummary = lookupResult("zed", { status: "found", profile: { username: "zed", displayName: "Zed" } });
  assert.equal(noSummary.card.summary, null);
  assert.equal(lookupResult("Zed@Example.com", { status: "found", uid: "u2", profile: prof }).kind, "card", "e-mail input is accepted");
});

test("lookupResult: an existing username with an unreadable profile is a bare user; an e-mail never is", () => {
  assert.deepEqual(lookupResult("@Hidden", { status: "hidden", uid: "u3", username: "hidden" }), { kind: "user", user: { uid: "u3", username: "hidden" } });
  assert.deepEqual(lookupResult("hidden@example.com", { status: "hidden", uid: "u3", username: "hidden" }), { kind: "none" });
  assert.deepEqual(lookupResult("hidden", { status: "hidden" }), { kind: "none" }, "no uid, no card");
});

test("cleanDisplayName strips control and direction characters, squeezes spaces, cuts at 40", async () => {
  const { cleanDisplayName } = await import("../public/social.js");
  assert.equal(cleanDisplayName("  Ziad‮  Osama\u0000 \n"), "Ziad Osama");
  assert.equal(cleanDisplayName("‏أحمد⁦ علي⁩"), "أحمد علي");
  assert.equal(cleanDisplayName("x".repeat(60)).length, 40);
  assert.equal(cleanDisplayName("‮\u0007  "), "");
  assert.equal(cleanDisplayName(null), "");
});

test("buildSummary: volume counts normal and drop sets, not warm-ups", () => {
  const w = { id: "w-2026-10-17", date: "2026-10-17", dayId: "d1", dayName: "Push", entries: [{ ex: "Bench Press", sets: [{ w: 100, r: 10, k: "w" }, { w: 60, r: 10 }, { w: 40, r: 10, k: "d" }] }] };
  assert.equal(buildSummary({ ...base, workouts: [w], today: "2026-10-17" }, 1).volumeWeekKg, 1000);
  const onlyWarm = { ...w, entries: [{ ex: "Bench Press", sets: [{ w: 100, r: 10, k: "w" }] }] };
  assert.equal(buildSummary({ ...base, workouts: [onlyWarm], today: "2026-10-17" }, 1).volumeWeekKg, 0, "only warm-ups: no volume, no crash");
});
