import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultRest, restFor, startRest, adjustRest, remaining, restPhase, fmtClock, prefillFor
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
