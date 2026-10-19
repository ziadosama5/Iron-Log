import { test } from "node:test";
import assert from "node:assert/strict";
import { LIB, MUSCLES, muscleOf, gymFilter, GYM_PRESETS } from "../public/exercise-library.js";
import { AR } from "../public/lang-ar.js";
import { EXPERIENCE, GOAL_DEFAULT_DAYS, movementFamily, buildPlan } from "../public/plan-tools.js";

const GOALS = ["fat-loss", "muscle", "recomp", "strength", "maintain"];
const GYMS = [undefined, ...GYM_PRESETS.map(p => p.equipment)];
const names = p => p.days.map(d => d.name);

test("movementFamily drops equipment words but keeps incline/decline and grips", () => {
  assert.equal(movementFamily("Dumbbell Bench Press"), movementFamily("Bench Press"));
  assert.equal(movementFamily("Incline Dumbbell Press"), movementFamily("Incline Barbell Press"));
  assert.notEqual(movementFamily("Incline Dumbbell Press"), movementFamily("Bench Press"));
  assert.equal(movementFamily("Lat Pulldown"), "lat pulldown");
});

test("constants: experience levels and default days per goal", () => {
  assert.deepEqual(EXPERIENCE, ["beginner", "intermediate", "advanced"]);
  assert.deepEqual(GOAL_DEFAULT_DAYS, { strength: 4, muscle: 4, recomp: 4, "fat-loss": 3, maintain: 3 });
});

test("split and day names per days per week", () => {
  const p2 = buildPlan({ goal: "muscle", daysPerWeek: 2, experience: "beginner" });
  assert.equal(p2.split, "Full Body"); assert.deepEqual(names(p2), ["Full Body A", "Full Body B"]);
  const p3b = buildPlan({ goal: "muscle", daysPerWeek: 3, experience: "beginner" });
  assert.equal(p3b.split, "Full Body"); assert.deepEqual(names(p3b), ["Full Body A", "Full Body B", "Full Body C"]);
  const p3i = buildPlan({ goal: "muscle", daysPerWeek: 3, experience: "intermediate" });
  assert.equal(p3i.split, "Push / Pull / Legs"); assert.deepEqual(names(p3i), ["Push", "Pull", "Legs"]);
  const p4 = buildPlan({ goal: "muscle", daysPerWeek: 4, experience: "beginner" });
  assert.equal(p4.split, "Upper / Lower"); assert.deepEqual(names(p4), ["Upper A", "Lower A", "Upper B", "Lower B"]);
  const p5 = buildPlan({ goal: "muscle", daysPerWeek: 5, experience: "advanced" });
  assert.equal(p5.split, "Push / Pull / Legs + Upper / Lower"); assert.deepEqual(names(p5), ["Push", "Pull", "Legs", "Upper A", "Lower A"]);
  const p6 = buildPlan({ goal: "muscle", daysPerWeek: 6, experience: "advanced" });
  assert.equal(p6.split, "Push / Pull / Legs ×2"); assert.deepEqual(names(p6), ["Push", "Pull", "Legs", "Push B", "Pull B", "Legs B"]);
});

test("weekday table in plan order, one weekday per day", () => {
  const want = { 2: [6, 2], 3: [6, 1, 3], 4: [6, 0, 2, 3], 5: [6, 0, 1, 3, 4], 6: [6, 0, 1, 2, 3, 4] };
  for (const n of [2, 3, 4, 5, 6]) {
    const p = buildPlan({ goal: "muscle", daysPerWeek: n, experience: "intermediate" });
    assert.deepEqual(p.days.map(d => d.weekdays), want[n].map(w => [w]), "days per week " + n);
  }
});

test("every goal x days x experience x gym gives a sound plan", () => {
  for (const goal of GOALS) for (const daysPerWeek of [2, 3, 4, 5, 6]) for (const experience of EXPERIENCE) for (const gym of GYMS) {
    const label = [goal, daysPerWeek, experience, gym ? gym.length : "all"].join("/");
    const p = buildPlan({ goal, daysPerWeek, experience, gym });
    const again = buildPlan({ goal, daysPerWeek, experience, gym });
    assert.deepEqual(again, p, "deterministic " + label);
    assert.ok(p.days.length > 0, "has days " + label);
    assert.equal(new Set(names(p)).size, p.days.length, "unique names " + label);
    const wds = p.days.flatMap(d => d.weekdays);
    assert.equal(new Set(wds).size, wds.length, "unique weekdays " + label);
    for (const d of p.days) {
      assert.ok(d.exercises.length > 0, "non-empty " + d.name + " " + label);
      assert.ok(d.exercises.length <= (goal === "strength" ? 5 : 7), "size " + d.name + " " + label);
      assert.equal(new Set(d.exercises).size, d.exercises.length, "no repeats " + d.name + " " + label);
      const fam = d.exercises.map(movementFamily);
      assert.equal(new Set(fam).size, fam.length, "no same family " + d.name + " " + label);
      for (const ex of d.exercises) assert.equal(gymFilter([ex], gym).length, 1, ex + " fits the gym " + label);
      const groups = MUSCLES.filter(m => d.exercises.some(ex => muscleOf(ex) === m));
      assert.deepEqual(d.focus, groups, "focus " + d.name + " " + label);
      if (!gym || gym.length === GYM_PRESETS[3].equipment.length) assert.ok(d.exercises.length >= 3, "full gym day has 3+ " + d.name + " " + label);
    }
  }
});

test("quality: a beginner 3-day Full Body week has a squat pattern, a press and a pull, and B/C vary", () => {
  const p = buildPlan({ goal: "muscle", daysPerWeek: 3, experience: "beginner" });
  const [a, b, c] = p.days.map(d => d.exercises);
  assert.ok(a.some(n => muscleOf(n) === "Quads" && /Squat|Leg Press/.test(n)), a.join());
  assert.ok(a.some(n => muscleOf(n) === "Chest" && /Press/.test(n)), a.join());
  assert.ok(a.some(n => muscleOf(n) === "Back" && /Row|Pulldown|Pull-up/.test(n)), a.join());
  for (const other of [b, c]) assert.ok(a.filter(n => other.includes(n)).length < a.length / 2, "A and the next day differ");
});

test("volume: more exercises for advanced muscle than beginner fat-loss, and strength stays small", () => {
  const push = o => buildPlan({ daysPerWeek: 3, ...o }).days.find(d => d.name === "Push");
  const big = push({ goal: "muscle", experience: "advanced" }), small = push({ goal: "fat-loss", experience: "intermediate" });
  assert.ok(big.exercises.length > small.exercises.length);
  const st = buildPlan({ goal: "strength", daysPerWeek: 4, experience: "advanced" });
  const mu = buildPlan({ goal: "muscle", daysPerWeek: 4, experience: "advanced" });
  assert.ok(st.days.every((d, i) => d.exercises.length <= mu.days[i].exercises.length));
});

test("bodyweight-only gym: only bodyweight picks, a note when a muscle has no exercise, empty days dropped and noted", () => {
  const p = buildPlan({ goal: "muscle", daysPerWeek: 6, experience: "advanced", gym: [] });
  assert.ok(p.days.length > 0);
  for (const d of p.days) for (const ex of d.exercises) assert.equal(gymFilter([ex], []).length, 1);
  const noBack = !p.days.some(d => d.focus.includes("Back"));
  assert.equal(p.notes.some(n => n.text === "No {muscle} exercise fits your gym." && n.params.muscle === "Back"), noBack);
  const dropped = ["Push", "Pull", "Legs", "Push B", "Pull B", "Legs B"].filter(n => !names(p).includes(n));
  for (const day of dropped) assert.ok(p.notes.some(n => n.text === "{day} was left out: nothing in it fits your gym." && n.params.day === day), day);
});

test("invalid input throws", () => {
  assert.throws(() => buildPlan({ goal: "x", daysPerWeek: 3, experience: "beginner" }));
  assert.throws(() => buildPlan({ goal: "muscle", daysPerWeek: 1, experience: "beginner" }));
  assert.throws(() => buildPlan({ goal: "muscle", daysPerWeek: 7, experience: "beginner" }));
  assert.throws(() => buildPlan({ goal: "muscle", daysPerWeek: 3, experience: "x" }));
});

test("every generated day name has an Arabic name", () => {
  for (const n of ["Push", "Pull", "Legs", "Push B", "Pull B", "Legs B", "Upper A", "Lower A", "Upper B", "Lower B", "Full Body A", "Full Body B", "Full Body C"]) {
    assert.ok(AR.names.day[n], n);
  }
});

import { shouldAutoJourney, needsAbout, checkProfile, mergeProfile } from "../public/plan-tools.js";

test("shouldAutoJourney: only for a signed-in, fully synced person with no data who has not skipped or seen it", () => {
  const ok = { authed: true, synced: true, days: [], workouts: [], skipped: false, shown: false };
  assert.equal(shouldAutoJourney(ok), true);
  assert.equal(shouldAutoJourney({ ...ok, authed: false }), false);
  assert.equal(shouldAutoJourney({ ...ok, synced: false }), false, "a cached empty snapshot on a fresh device must not trigger it");
  assert.equal(shouldAutoJourney({ ...ok, days: [{ id: "d1" }] }), false);
  assert.equal(shouldAutoJourney({ ...ok, workouts: [{ id: "w-2026-10-19" }] }), false);
  assert.equal(shouldAutoJourney({ ...ok, skipped: true }), false);
  assert.equal(shouldAutoJourney({ ...ok, shown: true }), false);
  assert.equal(shouldAutoJourney({ ...ok, synced: undefined }), false);
});

test("needsAbout is true when sex, height or birth year is missing", () => {
  assert.equal(needsAbout(null), true);
  assert.equal(needsAbout({}), true);
  assert.equal(needsAbout({ sex: "male", height: 178, birthYear: 1996 }), false);
  assert.equal(needsAbout({ sex: "male", height: 178 }), true);
  assert.equal(needsAbout({ sex: "female", birthYear: 1996 }), true);
});

test("checkProfile validates like the Body tab: ranges, strings and a comma decimal", () => {
  const Y = 2026;
  const ok = checkProfile({ sex: "male", height: "178,5", birthYear: "1996", goal: "muscle" }, Y);
  assert.deepEqual(ok, { ok: true, profile: { sex: "male", height: 178.5, birthYear: 1996, goal: "muscle" } });
  assert.equal(checkProfile({ sex: "male", height: 99, birthYear: 1996, goal: "muscle" }, Y).ok, false);
  assert.equal(checkProfile({ sex: "male", height: 251, birthYear: 1996, goal: "muscle" }, Y).ok, false);
  assert.equal(checkProfile({ sex: "male", height: 178, birthYear: Y - 9, goal: "muscle" }, Y).ok, false);
  assert.equal(checkProfile({ sex: "male", height: 178, birthYear: Y - 101, goal: "muscle" }, Y).ok, false);
  assert.equal(checkProfile({ sex: "male", height: 178, birthYear: Y - 10, goal: "muscle" }, Y).ok, true);
  assert.equal(checkProfile({ sex: "other", height: 178, birthYear: 1996, goal: "muscle" }, Y).ok, false);
  assert.equal(checkProfile({ sex: "male", height: 178, birthYear: 1996, goal: "x" }, Y).ok, false);
});

test("mergeProfile sets the goal, adds valid body basics, and never drops the target weight", () => {
  const existing = { sex: "female", height: 165, birthYear: 1990, goal: "maintain", goalWeight: 60, goalStart: "2026-10-01" };
  const m = mergeProfile(existing, { goal: "strength" });
  assert.deepEqual(m, { ...existing, goal: "strength" });
  const fresh = mergeProfile({}, { goal: "muscle", sex: "male", height: 180, birthYear: 1995 });
  assert.deepEqual(fresh, { goal: "muscle", sex: "male", height: 180, birthYear: 1995 });
  const bad = mergeProfile({ height: 170 }, { goal: "muscle", height: 5, sex: "robot" });
  assert.deepEqual(bad, { goal: "muscle", height: 170 }, "invalid values are ignored, existing ones kept");
  assert.deepEqual(mergeProfile(null, { goal: "recomp" }), { goal: "recomp" });
});

// ---- review fixes: no muscle disappears under the exercise cap; strength is a strength program ----
const DAY_MUSCLES = {
  Push: ["Chest", "Shoulders", "Triceps"], Pull: ["Back", "Biceps"], Legs: ["Quads", "Hamstrings & Glutes", "Calves"],
  Upper: ["Chest", "Back", "Shoulders", "Biceps", "Triceps"], Lower: ["Quads", "Hamstrings & Glutes", "Calves", "Core"],
  "Full Body": ["Quads", "Chest", "Back", "Shoulders", "Hamstrings & Glutes", "Core"]
};
const baseName = n => n.replace(/ [ABC]$/, "");

test("every muscle a day trains keeps at least one exercise when the gym can work it (all goals except strength)", () => {
  for (const goal of GOALS.filter(g => g !== "strength")) for (const daysPerWeek of [2, 3, 4, 5, 6]) for (const experience of EXPERIENCE) for (const gym of GYMS) {
    const p = buildPlan({ goal, daysPerWeek, experience, gym });
    for (const d of p.days) {
      for (const m of DAY_MUSCLES[baseName(d.name)]) {
        if (gymFilter(LIB[m], gym).length > 0) assert.ok(d.focus.includes(m), [d.name, m, goal, daysPerWeek, experience, gym ? gym.length : "all"].join("/"));
      }
    }
  }
});

test("advanced muscle 4-day plan keeps arms in both Upper days", () => {
  const p = buildPlan({ goal: "muscle", daysPerWeek: 4, experience: "advanced" });
  for (const d of p.days.filter(x => x.name.startsWith("Upper"))) {
    assert.ok(d.focus.includes("Biceps") && d.focus.includes("Triceps"), d.name + ": " + d.exercises.join());
    assert.equal(d.exercises.length, 7);
  }
});

test("strength: compounds first, rows on pull days, no arm isolation on Upper days, main lifts repeat on B days", () => {
  const p = buildPlan({ goal: "strength", daysPerWeek: 4, experience: "intermediate" });
  for (const d of p.days.filter(x => x.name.startsWith("Upper"))) {
    assert.ok(!d.focus.includes("Biceps") && !d.focus.includes("Triceps"), d.name + ": " + d.exercises.join());
  }
  const p3 = buildPlan({ goal: "strength", daysPerWeek: 3, experience: "intermediate" });
  const pull = p3.days.find(d => d.name === "Pull");
  assert.ok(pull.exercises.filter(n => muscleOf(n) === "Back").length >= 2, pull.exercises.join());
  const p6 = buildPlan({ goal: "strength", daysPerWeek: 6, experience: "advanced" });
  const push = p6.days.find(d => d.name === "Push"), pushB = p6.days.find(d => d.name === "Push B");
  assert.equal(pushB.exercises[0], push.exercises[0], "the main press repeats on the B day");
});
