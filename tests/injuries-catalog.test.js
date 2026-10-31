import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jointRules } from "../tools/joint-rules.mjs";
import { AREAS, JOINTS, jointsOf, avoidFilter } from "../public/injuries.js";
import { JOINTS_CATALOG } from "../public/injuries-catalog.js";
import { CATALOG } from "../public/exercise-catalog.js";
import { ALL_EX, isCurated } from "../public/exercise-library.js";

const META = JSON.parse(readFileSync(new URL("../tools/catalog-meta.json", import.meta.url), "utf8"));
const rule = (dataset, group, equipment = "body weight", category = "waist") => jointRules({ name: dataset, equipment, category }, group);

test("jointRules: squats and lunges load the knee and hip, barbell squats the lower back too", () => {
  assert.deepEqual(rule("barbell full squat", "Quads", "barbell", "upper legs"), ["lower-back", "hip", "knee"]);
  assert.ok(["hip", "knee"].every(a => rule("dumbbell lunge", "Quads", "dumbbell", "upper legs").includes(a)));
  assert.ok(rule("jump squat", "Quads", "body weight", "upper legs").includes("ankle"));
});

test("jointRules: pushing loads shoulder, elbow and wrist; curls the elbow; calves the ankle; stretches the joint they name", () => {
  assert.deepEqual(rule("push-up", "Chest", "body weight", "chest"), ["shoulder", "elbow", "wrist"]);
  assert.ok(rule("dumbbell biceps curl", "Biceps", "dumbbell", "upper arms").includes("elbow"));
  assert.ok(rule("standing calf raise", "Calves", "body weight", "lower legs").includes("ankle"));
  assert.ok(rule("shoulder stretch", "Shoulders", "body weight", "shoulders").includes("shoulder"));
  assert.ok(rule("calf stretch", "Calves", "body weight", "lower legs").includes("ankle"));
  assert.ok(rule("hamstring stretch", "Hamstrings & Glutes", "body weight", "upper legs").includes("hip"));
});

test("jointRules: pulls and hinges", () => {
  assert.ok(["shoulder", "elbow"].every(a => rule("pull-up", "Back", "body weight", "back").includes(a)));
  assert.ok(["lower-back", "hip"].every(a => rule("barbell romanian deadlift", "Hamstrings & Glutes", "barbell", "upper legs").includes(a)));
  assert.ok(rule("barbell bent over row", "Back", "barbell", "back").includes("lower-back"));
  assert.ok(rule("hanging leg raise", "Core", "body weight", "waist").includes("hip"));
});

test("every catalog exercise has joint tags: valid areas, in order, at most 5, merged into JOINTS", () => {
  for (const [name] of CATALOG) {
    const areas = JOINTS_CATALOG[name];
    assert.ok(Array.isArray(areas), name);
    assert.deepEqual(areas, AREAS.filter(a => areas.includes(a)), name + ": known, unique, in order");
    assert.ok(areas.length <= 5, name);
    assert.deepEqual(JOINTS[name], areas, name + " is in the merged table");
    assert.deepEqual(areas, jointRules({ ...META[name], name: META[name].dataset }, CATALOG.find(r => r[0] === name)[1]), name + " matches the rules");
  }
  assert.equal(Object.keys(JOINTS).length, ALL_EX.length);
});

test("lower-body strength exercises never end up with no joints", () => {
  for (const [name, group, , , kind] of CATALOG) if (["Quads", "Hamstrings & Glutes", "Calves"].includes(group) && !kind) assert.ok(JOINTS_CATALOG[name].length > 0, name);
});

test("avoiding the knee hides dataset squats and lunges; avoiding the wrist hides push-ups and wrist curls", () => {
  const knee = avoidFilter(ALL_EX, { areas: ["knee"], exercises: [] });
  assert.ok(!knee.includes("Smith Machine Full Squat") && !knee.some(n => /Lunge/.test(n) && !isCurated(n)));
  assert.ok(knee.includes("Bench Press"), "unrelated exercises stay");
  const wrist = avoidFilter(ALL_EX, { areas: ["wrist"], exercises: [] });
  assert.ok(!wrist.some(n => /^Push-up|Wrist Curl/.test(n)));
  assert.deepEqual(jointsOf("smith machine full squat"), JOINTS["Smith Machine Full Squat"]);
});

test("review: planches, wheel rollouts and the stretches named in the review get joint tags", () => {
  for (const n of ["Full Planche", "Frog Planche", "Lean Planche", "Straddle Planche"]) assert.ok(["shoulder", "wrist"].every(a => JOINTS[n].includes(a)), n + ": " + JOINTS[n]);
  for (const n of Object.keys(JOINTS).filter(x => /rollerout/i.test(x))) assert.ok(JOINTS[n].includes("shoulder") && JOINTS[n].includes("wrist"), n + ": " + JOINTS[n]);
  for (const n of ["Rear Deltoid Stretch", "Peroneals Stretch", "Posterior Tibialis Stretch"]) assert.ok(JOINTS[n] && JOINTS[n].length > 0, n);
  const wrist = avoidFilter(["Full Planche", "Barbell Rollerout", "Bench Press"], { areas: ["wrist"], exercises: [] });
  assert.deepEqual(wrist, []);
});

test("review: no strength exercise (not a hold) is left without joint tags", () => {
  const holds = new Set(CATALOG.filter(r => r[4] === "hold").map(r => r[0]));
  const bare = CATALOG.filter(r => !holds.has(r[0]) && JOINTS_CATALOG[r[0]].length === 0).map(r => r[0]);
  assert.deepEqual(bare, []);
});
