import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultRest, restFor, startRest, adjustRest, remaining, restPhase, fmtClock, prefillFor, shouldWake, createWakeLock, editIndexFor, rolloverDate
} from "../public/workout-tools.js";

test("defaultRest tiers", () => {
  const cases = {
    "Squat":180, "Front Squat":180, "Hack Squat":180, "Deadlift":180, "Romanian Deadlift":180,
    "Bench Press":180, "Close-grip Bench Press":180, "Overhead Press":180, "Leg Press":180,
    "Barbell Row":150, "T-bar Row":150, "Seated Cable Row":150, "One-arm Dumbbell Row":150,
    "Pull-up":150, "Chin-up":150, "Dip":150, "Hip Thrust":150, "Incline Barbell Press":150,
    "Bulgarian Split Squat":150,
    "Leg Extension":90, "Upright Row":90, "Lateral Raise":90, "Barbell Curl":90, "Plank":90,
    "My Custom Thing":90, "squat":180, "PULL-UP":150
  };
  for (const [n, s] of Object.entries(cases)) assert.equal(defaultRest(n), s, n);
});

test("restFor uses saved value", () => {
  assert.equal(restFor("Squat", { rest: { "Squat": 240 } }), 240);
  assert.equal(restFor("Squat", { rest: {} }), 180);
  assert.equal(restFor("Squat", null), 180);
});

test("startRest", () => assert.deepEqual(startRest("Dip", 150, 1000), { ex:"Dip", endsAt:151000, total:150 }));

test("adjustRest shifts and clamps", () => {
  const r = startRest("Dip", 150, 0);
  assert.deepEqual(adjustRest(r, 15, 10000), { ex:"Dip", endsAt:165000, total:165 });
  assert.equal(adjustRest(startRest("Dip", 20, 0), -15, 0).total, 15);
  assert.equal(adjustRest(startRest("Dip", 600, 0), 15, 0).total, 600);
  assert.ok(adjustRest(startRest("Dip", 30, 0), -15, 25000).endsAt >= 25000);
});

test("remaining", () => {
  assert.equal(remaining(10000, 0), 10);
  assert.equal(remaining(10000, 9500), 1);
  assert.equal(remaining(10000, 20000), 0);
});

test("restPhase", () => {
  const r = startRest("Dip", 60, 0);
  assert.equal(restPhase(null, 0), "none");
  assert.equal(restPhase(r, 59999), "resting");
  assert.equal(restPhase(r, 60000), "go");
});

test("restPhase expired after 60s", () => assert.equal(restPhase(startRest("Dip", 60, 0), 120000), "expired"));

test("fmtClock", () => {
  assert.equal(fmtClock(84), "1:24"); assert.equal(fmtClock(5), "0:05"); assert.equal(fmtClock(600), "10:00");
});

const L = { sets: [{w:60,r:8},{w:62.5,r:6},{w:65,r:5}] };
test("prefill: set N from last session set N", () =>
  assert.deepEqual(prefillFor({ sets:[{w:60,r:8}] }, L), { w:"62.5", r:"6" }));
test("prefill: beyond last session repeats today's last set", () =>
  assert.deepEqual(prefillFor({ sets:[{w:60,r:8},{w:62.5,r:6},{w:65,r:5},{w:65,r:4}] }, L), { w:"65", r:"4" }));
test("prefill: first set from last session set 0", () =>
  assert.deepEqual(prefillFor({ sets:[] }, L), { w:"60", r:"8" }));
test("prefill: no history", () =>
  assert.deepEqual(prefillFor({ sets:[] }, null), { w:"20", r:"8" }));
test("prefill: today's sets but no last session", () =>
  assert.deepEqual(prefillFor({ sets:[{w:40,r:10}] }, null), { w:"40", r:"10" }));

test("shouldWake", () => {
  assert.equal(shouldWake({view:"log", date:"2026-10-17", today:"2026-10-17", exerciseCount:3}), true);
  assert.equal(shouldWake({view:"body", date:"2026-10-17", today:"2026-10-17", exerciseCount:3}), false);
  assert.equal(shouldWake({view:"log", date:"2026-10-17", today:"2026-10-17", exerciseCount:0}), false);
});
test("want false for past date", () =>
  assert.equal(shouldWake({view:"log", date:"2026-10-10", today:"2026-10-17", exerciseCount:3}), false));

function fakeEnv() {
  const env = { requests:0, releases:0, handler:null };
  env.navigator = { wakeLock: { request: async (type) => {
    assert.equal(type, "screen"); env.requests++;
    const s = { released:false, release: async () => { s.released = true; env.releases++; } };
    env.last = s; return s;
  } } };
  env.document = { visibilityState:"visible", addEventListener: (ev, fn) => { if (ev === "visibilitychange") env.handler = fn; } };
  return env;
}
const tick = () => new Promise(r => setTimeout(r, 0));

test("createWakeLock acquires once, releases, reacquires on visible", async () => {
  const env = fakeEnv(), wl = createWakeLock(env);
  wl.want(true); await tick(); wl.want(true); await tick();
  assert.equal(env.requests, 1);
  wl.want(false); await tick();
  assert.equal(env.releases, 1);
  wl.want(true); await tick();
  assert.equal(env.requests, 2);
  env.last.released = true;                 // browser drops the lock when the app is hidden
  env.document.visibilityState = "hidden"; env.handler(); await tick();
  assert.equal(env.requests, 2);
  env.document.visibilityState = "visible"; env.handler(); await tick();
  assert.equal(env.requests, 3);
});
test("createWakeLock does not reacquire when no longer wanted", async () => {
  const env = fakeEnv(), wl = createWakeLock(env);
  wl.want(true); await tick(); wl.want(false); await tick();
  env.handler(); await tick();
  assert.equal(env.requests, 1);
});
test("createWakeLock swallows request errors", async () => {
  const env = fakeEnv();
  env.navigator.wakeLock.request = async () => { throw new Error("NotAllowedError"); };
  const wl = createWakeLock(env);
  assert.doesNotThrow(() => wl.want(true)); await tick();
});
test("createWakeLock no-op without API", () => {
  assert.doesNotThrow(() => createWakeLock({ navigator:{}, document:{ addEventListener(){} } }).want(true));
});

const S3 = [{w:60,r:8},{w:62.5,r:6},{w:65,r:5}];
test("editIndexFor: matching date, exercise and set", () =>
  assert.equal(editIndexFor({date:"2026-10-17", ex:"Bench Press", si:1}, "2026-10-17", "Bench Press", S3), 1));
test("editIndexFor: edit from another day does not apply", () =>
  assert.equal(editIndexFor({date:"2026-10-17", ex:"Bench Press", si:1}, "2026-10-10", "Bench Press", S3), -1));
test("editIndexFor: other exercise, missing set, or no edit", () => {
  assert.equal(editIndexFor({date:"2026-10-17", ex:"Bench Press", si:1}, "2026-10-17", "Squat", S3), -1);
  assert.equal(editIndexFor({date:"2026-10-17", ex:"Bench Press", si:5}, "2026-10-17", "Bench Press", S3), -1);
  assert.equal(editIndexFor(null, "2026-10-17", "Bench Press", S3), -1);
});

test("rolloverDate moves 'today' forward after midnight", () =>
  assert.equal(rolloverDate("2026-10-17", "2026-10-17", "2026-10-18"), "2026-10-18"));
test("rolloverDate keeps a past date the user picked on purpose", () =>
  assert.equal(rolloverDate("2026-10-10", "2026-10-17", "2026-10-18"), "2026-10-10"));
test("rolloverDate does nothing on the same day", () =>
  assert.equal(rolloverDate("2026-10-17", "2026-10-17", "2026-10-17"), "2026-10-17"));
