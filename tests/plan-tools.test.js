import { test } from "node:test";
import assert from "node:assert/strict";
import { LIB, MUSCLES, muscleOf, gymFilter, GYM_PRESETS } from "../public/exercise-library.js";
import { AR } from "../public/lang-ar.js";
import { EXPERIENCE, GOAL_DEFAULT_DAYS, movementFamily, buildPlan, splitOptions, SPLIT_FAMILIES, splitFor } from "../public/plan-tools.js";

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
  for (const goal of GOALS) for (const daysPerWeek of [2, 3, 4, 5, 6]) for (const experience of EXPERIENCE) for (const gym of GYMS) for (const so of splitOptions(daysPerWeek, experience)) {
    const label = [goal, daysPerWeek, experience, gym ? gym.length : "all", so.id].join("/");
    const p = buildPlan({ goal, daysPerWeek, experience, gym, splitId: so.id });
    const again = buildPlan({ goal, daysPerWeek, experience, gym, splitId: so.id });
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
  for (const n of ["Push", "Pull", "Legs", "Push B", "Pull B", "Legs B", "Upper A", "Lower A", "Upper B", "Lower B", "Upper C", "Lower C", "Full Body A", "Full Body B", "Full Body C", "Chest", "Back", "Shoulders", "Arms"]) {
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
  "Full Body": ["Quads", "Chest", "Back", "Shoulders", "Hamstrings & Glutes", "Core"],
  Chest: ["Chest"], Back: ["Back"], Shoulders: ["Shoulders"], Arms: ["Biceps", "Triceps"]
};
const baseName = n => n.replace(/ [ABC]$/, "");

test("every muscle a day trains keeps at least one exercise when the gym can work it (all goals except strength)", () => {
  for (const goal of GOALS.filter(g => g !== "strength")) for (const daysPerWeek of [2, 3, 4, 5, 6]) for (const experience of EXPERIENCE) for (const gym of GYMS) for (const so of splitOptions(daysPerWeek, experience)) {
    const p = buildPlan({ goal, daysPerWeek, experience, gym, splitId: so.id });
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

test("splitOptions: two choices per days per week, the first one is today's default", () => {
  const ids = (n, e = "intermediate") => splitOptions(n, e).map(o => o.id);
  assert.deepEqual(ids(2), ["full", "upper-lower"]);
  assert.deepEqual(ids(3, "beginner"), ["full", "ppl"]);
  assert.deepEqual(ids(3, "intermediate"), ["ppl", "full"]);
  assert.deepEqual(ids(4), ["upper-lower", "ppl-full"]);
  assert.deepEqual(ids(5), ["ppl-upper-lower", "bro"]);
  assert.deepEqual(ids(6), ["ppl-x2", "upper-lower-x3"]);
  assert.deepEqual(splitOptions(4, "beginner").map(o => o.name), ["Upper / Lower", "Push / Pull / Legs + Full Body"]);
  for (const n of [2, 3, 4, 5, 6]) for (const e of EXPERIENCE) {
    const first = splitOptions(n, e)[0];
    const def = buildPlan({ goal: "muscle", daysPerWeek: n, experience: e });
    assert.deepEqual(buildPlan({ goal: "muscle", daysPerWeek: n, experience: e, splitId: first.id }), def, "default = first option");
    assert.equal(def.split, first.name);
  }
});

test("each split option builds the days it names", () => {
  const days = (n, id) => names(buildPlan({ goal: "muscle", daysPerWeek: n, experience: "intermediate", splitId: id }));
  assert.deepEqual(days(2, "upper-lower"), ["Upper A", "Lower A"]);
  assert.deepEqual(days(3, "full"), ["Full Body A", "Full Body B", "Full Body C"]);
  assert.deepEqual(days(4, "ppl-full"), ["Push", "Pull", "Legs", "Full Body A"]);
  assert.deepEqual(days(5, "bro"), ["Chest", "Back", "Shoulders", "Arms", "Legs"]);
  assert.deepEqual(days(6, "upper-lower-x3"), ["Upper A", "Lower A", "Upper B", "Lower B", "Upper C", "Lower C"]);
});

test("a split id that does not belong to the days per week throws", () => {
  assert.throws(() => buildPlan({ goal: "muscle", daysPerWeek: 4, experience: "beginner", splitId: "bro" }));
  assert.throws(() => buildPlan({ goal: "muscle", daysPerWeek: 3, experience: "beginner", splitId: "nope" }));
});

test("bro split: one muscle a day with more exercises for muscle goals, light for strength", () => {
  const heavy = buildPlan({ goal: "muscle", daysPerWeek: 5, experience: "advanced", splitId: "bro" });
  const light = buildPlan({ goal: "strength", daysPerWeek: 5, experience: "advanced", splitId: "bro" });
  const chestH = heavy.days.find(d => d.name === "Chest"), chestL = light.days.find(d => d.name === "Chest");
  assert.deepEqual(chestH.focus, ["Chest"]);
  assert.ok(chestH.exercises.length > chestL.exercises.length);
  assert.deepEqual(heavy.days.find(d => d.name === "Arms").focus, ["Biceps", "Triceps"]);
  assert.equal(heavy.split, "Bro Split");
});

test("SPLIT_FAMILIES: four splits to choose from, each with the days it supports", () => {
  assert.deepEqual(SPLIT_FAMILIES.map(f => f.id), ["full", "upper-lower", "ppl", "bro"]);
  assert.deepEqual(SPLIT_FAMILIES.map(f => f.name), ["Full Body", "Upper / Lower", "Push / Pull / Legs", "Bro Split"]);
  assert.deepEqual(SPLIT_FAMILIES.map(f => f.days), [[2, 3], [2, 4, 6], [3, 6], [5]]);
});

test("splitFor maps a split and a days count to a plan split, always one of that day count's options", () => {
  const want = { "full:2": "full", "full:3": "full", "upper-lower:2": "upper-lower", "upper-lower:4": "upper-lower", "upper-lower:6": "upper-lower-x3", "ppl:3": "ppl", "ppl:6": "ppl-x2", "bro:5": "bro" };
  for (const f of SPLIT_FAMILIES) for (const d of f.days) {
    assert.equal(splitFor(f.id, d), want[f.id + ":" + d], f.id + d);
    for (const e of EXPERIENCE) {
      assert.ok(splitOptions(d, e).some(o => o.id === splitFor(f.id, d)), f.id + d + e);
      const p = buildPlan({ goal: "muscle", daysPerWeek: d, experience: e, splitId: splitFor(f.id, d) });
      assert.equal(p.days.length, d);
    }
  }
  assert.equal(splitFor("bro", 4), null, "a split with a days count it does not support");
  assert.equal(splitFor("nope", 3), null);
});

test("choosing Push / Pull / Legs for 3 days gives Push, Pull, Legs even to a beginner", () => {
  const p = buildPlan({ goal: "muscle", daysPerWeek: 3, experience: "beginner", splitId: splitFor("ppl", 3) });
  assert.deepEqual(names(p), ["Push", "Pull", "Legs"]);
});

import { assignWeekday } from "../public/plan-tools.js";
test("assignWeekday moves a weekday to one day, clears it for Rest, and keeps every other weekday", () => {
  const days = [{ id: "a", name: "Push", weekdays: [6, 2] }, { id: "b", name: "Pull", weekdays: [0] }, { id: "c", name: "Legs" }];
  const wd = r => Object.fromEntries(r.map(d => [d.id, (d.weekdays || []).slice().sort((x, y) => x - y)]));
  assert.deepEqual(wd(assignWeekday(days, 0, "c")), { a: [2, 6], b: [], c: [0] });   // Sunday: Pull -> Legs
  assert.deepEqual(wd(assignWeekday(days, 3, "c")), { a: [2, 6], b: [0], c: [3] });  // a free weekday
  assert.deepEqual(wd(assignWeekday(days, 2, null)), { a: [6], b: [0], c: [] });     // Rest
  assert.deepEqual(wd(assignWeekday(days, 6, "a")), { a: [2, 6], b: [0], c: [] });   // same day again: no duplicate
  assert.deepEqual(wd(assignWeekday(assignWeekday(days, 4, "c"), 1, "c")), { a: [2, 6], b: [0], c: [1, 4] }); // one day on several weekdays
  assert.equal(days[1].weekdays[0], 0);                                              // input is not changed
  assert.deepEqual(wd(assignWeekday(days, 3, "zzz")), { a: [2, 6], b: [0], c: [] }); // unknown id: weekday just cleared
});

test("mergeProfile keeps the calorie-target choices", async () => {
  const { mergeProfile } = await import("../public/plan-tools.js");
  const r = mergeProfile({ sex: "male", height: 180, birthYear: 1998, goal: "muscle", activity: "light", adjust: 100 }, { goal: "fat-loss" });
  assert.equal(r.activity, "light"); assert.equal(r.adjust, 100); assert.equal(r.goal, "fat-loss");
});
