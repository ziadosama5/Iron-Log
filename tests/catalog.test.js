import { test } from "node:test";
import assert from "node:assert/strict";
import { titleCase, foldKey, GROUP_OF_TARGET, groupFor, eqIdsFor, isHoldKind } from "../tools/catalog-maps.mjs";
import { CATALOG, CATALOG_HOLDS } from "../public/exercise-catalog.js";
import { EXERCISES, EQUIPMENT, MUSCLES, ALL_EX, CURATED, CURATED_LIB, LIB, isCurated, exercisesFor, equipmentOf } from "../public/exercise-library.js";
import { buildPlan } from "../public/plan-tools.js";

test("titleCase follows the library's style", () => {
  assert.equal(titleCase("barbell full squat"), "Barbell Full Squat");
  assert.equal(titleCase("lever seated fly"), "Machine Seated Fly");
  assert.equal(titleCase("smith squat"), "Smith Machine Squat");
  assert.equal(titleCase("ez barbell curl"), "EZ-bar Curl");
  assert.equal(titleCase("lever t bar row"), "Machine T-bar Row");
  assert.equal(titleCase("close-grip push-up"), "Close-grip Push-up");
  assert.equal(titleCase("3/4 sit-up"), "3/4 Sit-up");
  assert.equal(titleCase("45° side bend"), "45° Side Bend");
  assert.equal(titleCase("cable pushdown (with rope attachment)"), "Cable Pushdown (with Rope Attachment)");
  assert.equal(titleCase("squat to overhead reach"), "Squat to Overhead Reach");
});

test("foldKey folds v. N copies, male/female and pov views into one", () => {
  assert.equal(foldKey("dumbbell arnold press v. 2"), foldKey("dumbbell arnold press"));
  assert.equal(foldKey("glute bridge two legs on bench (male)"), foldKey("glute bridge two legs on bench (female)"));
  assert.equal(foldKey("barbell full squat (back pov)"), foldKey("barbell full squat (side pov)"));
  assert.notEqual(foldKey("barbell squat"), foldKey("barbell full squat"));
});

test("GROUP_OF_TARGET covers every dataset target and only the library's groups", () => {
  const targets = ["abs", "pectorals", "biceps", "glutes", "delts", "triceps", "upper back", "lats", "calves", "quads", "forearms", "cardiovascular system", "hamstrings", "spine", "traps", "adductors", "serratus anterior", "abductors", "levator scapulae"];
  for (const t of targets) assert.ok(MUSCLES.includes(GROUP_OF_TARGET[t]), t);
  assert.equal(GROUP_OF_TARGET.forearms, "Biceps");
  assert.equal(groupFor({ name: "barbell full squat", target: "glutes", category: "upper legs" }), "Quads");
  assert.equal(groupFor({ name: "barbell romanian deadlift", target: "glutes", category: "upper legs" }), "Hamstrings & Glutes");
  assert.equal(groupFor({ name: "neck flexion", target: "levator scapulae", category: "neck" }), "Back");
});

test("eqIdsFor maps dataset equipment to library equipment ids", () => {
  const ids = (name, equipment) => eqIdsFor({ name, equipment });
  assert.deepEqual(ids("dumbbell lateral raise", "dumbbell"), ["dumbbell"]);
  assert.deepEqual(ids("push-up", "body weight"), []);
  assert.deepEqual(ids("lever seated fly", "leverage machine"), ["pec-deck"]);
  assert.deepEqual(ids("lever chest press", "leverage machine"), ["chest-press"]);
  assert.deepEqual(ids("lever shoulder press", "leverage machine"), ["shoulder-press-machine"]);
  assert.deepEqual(ids("lever gripper thing", "leverage machine"), ["lever-machine"]);
  assert.deepEqual(ids("sled hack squat", "sled machine"), ["hack-squat"]);
  assert.deepEqual(ids("sled calf press on leg press", "sled machine"), ["seated-calf-machine"]);
  assert.deepEqual(ids("sled something odd", "sled machine"), ["sled-machine"]);
  assert.deepEqual(ids("smith squat", "smith machine"), ["smith"]);
  assert.deepEqual(ids("barbell bench press", "barbell").sort(), ["barbell", "bench"]);
  assert.deepEqual(ids("barbell decline bench press", "barbell").sort(), ["barbell", "decline-bench"]);
  assert.deepEqual(ids("stability ball crunch", "stability ball"), ["stability-ball"]);
  assert.deepEqual(ids("band squat", "band"), ["resistance-band"]);
  assert.deepEqual(ids("chest dip", "body weight"), ["dip-station"]);
  assert.deepEqual(ids("pull-up", "body weight"), ["pullup-bar"]);
  assert.deepEqual(ids("assisted pull-up", "leverage machine"), ["assisted-machine"]);
  assert.deepEqual(ids("weighted bench dip", "weighted").sort(), ["bench", "weight-plate"]);   // a bench dip needs its bench
  assert.deepEqual(ids("dumbbell preacher curl", "dumbbell").sort(), ["dumbbell", "preacher-bench"]);
  assert.deepEqual(ids("burpee", "body weight"), []);
});

test("isHoldKind: stretches, rollers, planks, holds and the cardio category are timed", () => {
  assert.equal(isHoldKind({ name: "neck side stretch", equipment: "body weight", category: "neck" }), true);
  assert.equal(isHoldKind({ name: "burpee", equipment: "body weight", category: "cardio" }), true);
  assert.equal(isHoldKind({ name: "front plank with twist", equipment: "body weight", category: "waist" }), true);
  assert.equal(isHoldKind({ name: "roller back stretch", equipment: "roller", category: "back" }), true);
  assert.equal(isHoldKind({ name: "barbell full squat", equipment: "barbell", category: "upper legs" }), false);
  assert.equal(isHoldKind({ name: "hanging leg raise", equipment: "body weight", category: "waist" }), false);
});

// ---- the generated catalog and the merged library ----
test("the catalog has 1,131 new exercises with valid groups, equipment ids and picture ids", () => {
  assert.equal(CATALOG.length, 1131);
  const ids = new Set(EQUIPMENT.map(e => e.id)), seen = new Set(), gifs = new Set();
  for (const [name, group, eq, gif, kind] of CATALOG) {
    assert.ok(name.trim() && !seen.has(name.toLowerCase()), "unique name " + name);
    seen.add(name.toLowerCase());
    assert.ok(MUSCLES.includes(group), name + " group " + group);
    for (const id of eq) assert.ok(ids.has(id), name + " equipment " + id);
    assert.match(gif, /^\d{4}-[A-Za-z0-9_-]+$/, name);
    assert.ok(!gifs.has(gif), "picture used twice: " + gif); gifs.add(gif);
    assert.ok(kind === "" || kind === "hold", name);
  }
  assert.equal(CATALOG_HOLDS.size, CATALOG.filter(r => r[4] === "hold").length);
  assert.ok(CATALOG_HOLDS.size > 60 && CATALOG_HOLDS.size < 200, "holds: " + CATALOG_HOLDS.size);
});

test("the library is the 183 curated exercises plus the catalog, curated names unchanged", () => {
  assert.equal(CURATED.size, 183);
  assert.equal(EXERCISES.length, 183 + 1131);
  assert.equal(ALL_EX.length, 1314);
  assert.equal(Object.values(CURATED_LIB).flat().length, 183);
  for (const m of MUSCLES) assert.deepEqual(LIB[m].filter(isCurated), CURATED_LIB[m], m + ": curated names keep their order, first");
  assert.ok(isCurated("bench press") && !isCurated(CATALOG[0][0]));
  for (const [name] of CATALOG) assert.ok(!CURATED.has(name.toLowerCase()));
  assert.deepEqual(equipmentOf("Bench Press"), ["barbell", "bench"]);
});

test("every equipment id is used by some exercise now that the catalog is merged", () => {
  const used = new Set(EXERCISES.flatMap(x => x.eq));
  assert.deepEqual(EQUIPMENT.filter(e => !used.has(e.id)).map(e => e.id), []);
});

test("generated plans only ever use curated exercises", () => {
  for (const goal of ["strength", "muscle", "recomp", "fat-loss", "maintain"]) for (const daysPerWeek of [2, 3, 4, 5, 6]) for (const experience of ["beginner", "intermediate", "advanced"]) {
    for (const gym of [undefined, [], ["dumbbell", "bench"]]) {
      const plan = buildPlan({ goal, daysPerWeek, experience, gym });
      for (const d of plan.days) for (const n of d.exercises) assert.ok(isCurated(n), `${n} in ${goal}/${daysPerWeek}/${experience}`);
    }
  }
});

test("the gym filter works over the whole library", () => {
  const dumbbellOnly = exercisesFor(["dumbbell"]);
  assert.ok(dumbbellOnly.length > 200, "dumbbell-only: " + dumbbellOnly.length);
  for (const n of dumbbellOnly) assert.ok(equipmentOf(n).every(q => q === "dumbbell"), n);
  assert.ok(!exercisesFor(["dumbbell"]).some(n => (equipmentOf(n) || []).includes("lever-machine")));
  assert.equal(exercisesFor(EQUIPMENT.map(e => e.id)).length, 1314);
  assert.ok(exercisesFor([]).length > 250, "body weight only");
});

// ---- final review fixes ----
import { bwDefault } from "../public/bodyweight.js";
import { readFileSync } from "node:fs";
const META = JSON.parse(readFileSync(new URL("../tools/catalog-meta.json", import.meta.url), "utf8"));

test("review: hold kind has no false positives (rollerout, hang clean) and every hold is a body-weight entry so it is logged in seconds", () => {
  assert.equal(isHoldKind({ name: "barbell rollerout", equipment: "barbell", category: "waist" }), false);
  assert.equal(isHoldKind({ name: "standing wheel rollerout", equipment: "wheel roller", category: "waist" }), false);
  assert.equal(isHoldKind({ name: "kettlebell alternating hang clean", equipment: "kettlebell", category: "upper legs" }), false);
  assert.equal(isHoldKind({ name: "roller back stretch", equipment: "roller", category: "back" }), true);
  assert.equal(isHoldKind({ name: "dead hang", equipment: "body weight", category: "back" }), true);
  for (const name of CATALOG_HOLDS) assert.equal(bwDefault(name), true, name + " must open as a body-weight hold, not as kg x reps");
  assert.ok(!CATALOG.some(r => /rollerout|hang clean|hang snatch/i.test(META[r[0]].dataset) && r[4] === "hold"));
});

test("review: eqIdsFor knows the stations bodyweight moves need and ignores partner help and jump ropes", () => {
  const ids = (name, equipment) => eqIdsFor({ name, equipment }).sort();
  assert.deepEqual(ids("archer pull up", "body weight"), ["pullup-bar"]);
  assert.deepEqual(ids("pull up (neutral grip)", "body weight"), ["pullup-bar"]);
  assert.deepEqual(ids("gorilla chin", "body weight"), ["pullup-bar"]);
  assert.deepEqual(ids("muscle-up (on vertical bar)", "body weight"), ["pullup-bar"]);
  assert.deepEqual(ids("front lever", "body weight"), ["pullup-bar"]);
  assert.deepEqual(ids("weighted one hand pull up", "weighted"), ["pullup-bar", "weight-plate"]);
  assert.deepEqual(ids("weighted hanging leg-hip raise", "weighted"), ["pullup-bar", "weight-plate"]);
  assert.deepEqual(ids("vertical leg raise (on parallel bars)", "body weight"), ["dip-station"]);
  assert.deepEqual(ids("triceps dip", "body weight"), ["dip-station"]);
  assert.deepEqual(ids("three bench dip", "body weight"), ["bench"]);
  assert.deepEqual(ids("bench hip extension", "body weight"), ["bench"]);
  assert.deepEqual(ids("incline push-up", "body weight"), ["bench"]);
  assert.deepEqual(ids("decline push-up", "body weight"), ["bench"]);
  assert.deepEqual(ids("decline crunch", "body weight"), ["bench"]);
  assert.deepEqual(ids("dumbbell incline fly", "dumbbell"), ["bench", "dumbbell"]);
  assert.deepEqual(ids("assisted lying glutes stretch", "assisted"), []);
  assert.deepEqual(ids("assisted sit-up", "assisted"), []);
  assert.deepEqual(ids("assisted hanging knee raise", "assisted"), ["pullup-bar"]);
  assert.deepEqual(ids("assisted pull-up", "leverage machine"), ["assisted-machine"]);
  assert.deepEqual(ids("jump rope", "rope"), []);
  assert.deepEqual(ids("calf stretch with rope", "rope"), []);
  assert.deepEqual(ids("battling ropes", "rope"), ["battle-rope"]);
  assert.deepEqual(ids("walking on incline treadmill", "leverage machine"), ["ergometer"]);
  assert.deepEqual(ids("stationary bike walk", "leverage machine"), ["ergometer"]);
});

test("review: across the catalog, bar and bench moves carry their station and no partner move needs a machine", () => {
  for (const [name, , eq] of CATALOG) {
    const d = META[name].dataset, e = META[name].equipment;
    if (/pull[- ]?ups?\b|chin[- ]?ups?\b|muscle[- ]?up|front lever|back lever|skin the cat|hanging/.test(d) && e !== "leverage machine") assert.ok(eq.includes("pullup-bar"), name + " needs a bar");
    if (/parallel bars/.test(d)) assert.ok(eq.includes("dip-station"), name);
    if (/\bbench\b/.test(d) && e !== "leverage machine") assert.ok(eq.includes("bench") || eq.includes("decline-bench"), name + " needs a bench");
    if (e === "assisted") assert.ok(!eq.includes("assisted-machine"), name);
  }
  const home = GYM_PRESETS_HOME();
  assert.ok(exercisesFor(home).includes("Jump Rope") && exercisesFor(home).includes("Assisted Lying Glutes Stretch"), "Home keeps what needs no gear");
  assert.ok(!exercisesFor([]).includes("Archer Pull Up") && !exercisesFor([]).includes("Front Lever"), "Bodyweight only has no bar");
});
function GYM_PRESETS_HOME() { return EQUIPMENT.length ? ["dumbbell", "bench", "pullup-bar", "kettlebell", "box", "ab-wheel", "resistance-band", "stability-ball", "medicine-ball", "foam-roller"] : []; }
