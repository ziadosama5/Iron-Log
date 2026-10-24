import { test } from "node:test";
import assert from "node:assert/strict";
import { weekKey, weeklyTarget, trainingStreak, foodStreak, prEvents, badges, levelFor, xpSummary, goalProgress } from "../public/achievements.js";

const S = (w, r) => ({ w, r });
const wo = (date, sets = [S(60, 5)], ex = "Bench Press", cardio) => ({ id: "w-" + date, date, entries: [{ ex, sets }], ...(cardio ? { cardio } : {}) });
const DAYS2 = [{ id: "a", weekdays: [6] }, { id: "b", weekdays: [2] }]; // N = 2

test("weekKey: Saturday starts the week", () => {
  assert.equal(weekKey("2026-10-17"), "2026-10-17"); // Saturday
  assert.equal(weekKey("2026-10-23"), "2026-10-17"); // Friday
  assert.equal(weekKey("2026-10-16"), "2026-10-10");
});

test("weeklyTarget", () => {
  assert.equal(weeklyTarget(DAYS2), 2);
  assert.equal(weeklyTarget([{ weekdays: [1] }]), 2);
  assert.equal(weeklyTarget([{}, {}, {}]), 3);
  assert.equal(weeklyTarget(Array(7).fill({})), 6);
  assert.equal(weeklyTarget([]), 3);
});

test("trainingStreak counts finished weeks and adds the current one when met", () => {
  const ws = ["2026-09-26", "2026-09-28", "2026-10-03", "2026-10-05", "2026-10-10", "2026-10-12", "2026-10-17"].map(d => wo(d));
  assert.deepEqual(trainingStreak(ws, DAYS2, "2026-10-18"), { weeks: 3, thisWeek: 1, target: 2 });
  assert.deepEqual(trainingStreak([...ws, wo("2026-10-18")], DAYS2, "2026-10-18"), { weeks: 4, thisWeek: 2, target: 2 });
});

test("trainingStreak breaks on a short week; cardio-only days count", () => {
  const ws = [wo("2026-09-26"), wo("2026-09-28"), wo("2026-10-03"),
    wo("2026-10-10"), { id: "w-2026-10-12", date: "2026-10-12", entries: [], cardio: [{ type: "bike", min: 30, intensity: "easy", kcal: null }] }];
  assert.deepEqual(trainingStreak(ws, DAYS2, "2026-10-17"), { weeks: 1, thisWeek: 0, target: 2 });
});

test("foodStreak ends today, or yesterday when today is empty", () => {
  const f = d => ({ date: d, meals: [{ id: "m", kcal: 500 }] });
  const food = { "2026-10-15": f("2026-10-15"), "2026-10-16": f("2026-10-16"), "2026-10-17": f("2026-10-17") };
  assert.equal(foodStreak(food, "2026-10-18"), 3);
  assert.equal(foodStreak(food, "2026-10-17"), 3);
  assert.equal(foodStreak({ ...food, "2026-10-14": { date: "2026-10-14", meals: [] } }, "2026-10-17"), 3);
  assert.equal(foodStreak(food, "2026-10-20"), 0);
});

test("prEvents needs 2 earlier sessions and a higher best", () => {
  const ws = [wo("2026-10-01", [S(60, 5)]), wo("2026-10-03", [S(60, 5)], "bench press"), wo("2026-10-05", [S(62.5, 5)]), wo("2026-10-07", [S(62.5, 5)])];
  assert.deepEqual(prEvents(ws), [{ date: "2026-10-05", ex: "bench press" }]);
});

const B = (list, id) => list.find(b => b.id === id);
const base = { body: [], food: {}, days: DAYS2, profile: {}, today: "2026-10-18" };

test("milestone badge earned date and locked progress", () => {
  const list = badges({ ...base, workouts: [wo("2026-10-02"), wo("2026-10-04")] });
  assert.equal(B(list, "workouts-1").earned, "2026-10-02");
  assert.deepEqual([B(list, "workouts-10").earned, B(list, "workouts-10").value, B(list, "workouts-10").target], [null, 2, 10]);
  assert.equal(list.length, 24);
});

test("ratio badges use the weight on the lift date", () => {
  const body = [{ date: "2026-10-01", weight: 80 }];
  const list = badges({ ...base, body, workouts: [wo("2026-10-05", [S(80, 1)]), wo("2026-10-06", [S(160, 1)], "Deadlift"), wo("2026-10-07", [S(119, 1)], "Squat")] });
  assert.equal(B(list, "bench-bw").earned, "2026-10-05");
  assert.equal(B(list, "deadlift-2").earned, "2026-10-06");
  assert.equal(B(list, "squat-1.5").earned, null);
});

test("ratio badges need a weight on the lift date", () =>
  assert.equal(B(badges({ ...base, body: [{ date: "2026-10-10", weight: 80 }], workouts: [wo("2026-10-05", [S(100, 1)])] }), "bench-bw").earned, null));

test("volume and cardio minute badges", () => {
  const list = badges({ ...base, workouts: [wo("2026-10-05", [S(1000, 100)], "Leg Press", [{ id: "c", type: "bike", min: 600, intensity: "easy", kcal: 300 }]),
    wo("2026-10-06", [S(10, 1)], "Leg Press", [{ id: "d", type: "bike", min: 400, intensity: "easy", kcal: 200 }])] });
  assert.equal(B(list, "volume-100t").earned, "2026-10-05");
  assert.equal(B(list, "cardio-1000").earned, "2026-10-06");
});

test("goal badges", () => {
  const profile = { goalWeight: 75, goalStart: "2026-10-01" };
  const body = [{ date: "2026-10-01", weight: 80 }, { date: "2026-10-10", weight: 78.9 }];
  const list = badges({ ...base, profile, body, workouts: [] });
  assert.equal(B(list, "goal-first-kg").earned, "2026-10-10");
  assert.equal(B(list, "goal-reached").earned, null);
});

test("streak badges", () => {
  const ws = ["2026-09-19", "2026-09-21", "2026-09-26", "2026-09-28", "2026-10-03", "2026-10-05", "2026-10-10", "2026-10-12"].map(d => wo(d));
  assert.equal(B(badges({ ...base, workouts: ws }), "streak-4").earned, "2026-10-12");
  const food = Object.fromEntries(["10", "11", "12", "13", "14", "15", "16"].map(d => ["2026-10-" + d, { date: "2026-10-" + d, meals: [{ id: "m", kcal: 1 }] }]));
  assert.equal(B(badges({ ...base, food, workouts: [] }), "food-7").earned, "2026-10-16");
});

test("PR badges", () => {
  const ws = [wo("2026-10-01", [S(60, 5)]), wo("2026-10-03", [S(60, 5)]), wo("2026-10-05", [S(62.5, 5)])];
  assert.equal(B(badges({ ...base, workouts: ws }), "pr-1").earned, "2026-10-05");
});

test("levelFor thresholds and titles", () => {
  assert.deepEqual(levelFor(0), { level: 1, title: "Rookie", into: 0, needed: 100 });
  assert.deepEqual(levelFor(100), { level: 2, title: "Rookie", into: 0, needed: 200 });
  assert.deepEqual(levelFor(650), { level: 4, title: "Rookie", into: 50, needed: 400 });
  assert.equal(levelFor(1000).title, "Regular");
  assert.equal(levelFor(50 * 15 * 14).title, "Iron");
});

test("xpSummary adds workouts, cardio, meals, PRs and badges; weekXp is this week", () => {
  const input = { ...base, workouts: [wo("2026-10-17", [S(60, 5)], "Bench Press", [{ id: "c", type: "bike", min: 30, intensity: "easy", kcal: 200 }])],
    food: { "2026-10-17": { date: "2026-10-17", meals: [{ id: "m", kcal: 500 }] } } };
  const s = xpSummary(input, badges(input));
  assert.equal(s.xp, 50 + 16 + 10 + 100); // workout, cardio 10+6, meals, badge workouts-1
  assert.equal(s.weekXp, s.xp);
});

const goalInput = extra => ({ ...base, today: "2026-10-03", workouts: [],
  profile: { sex: "male", height: 180, birthYear: 1998, goal: "fat-loss", goalWeight: 75, goalStart: "2026-10-01" },
  body: [{ date: "2026-10-01", weight: 80 }, { date: "2026-10-03", weight: 79 }],
  food: { "2026-10-01": { date: "2026-10-01", meals: [{ id: "a", kcal: 1648 }] }, "2026-10-02": { date: "2026-10-02", meals: [{ id: "b", kcal: 1648 }] } }, ...extra });

test("goalProgress: bank, weight and finish date", () => {
  const g = goalProgress(goalInput());
  assert.equal(g.direction, "lose"); assert.equal(g.target, -38500); assert.equal(g.bank, -1000);
  assert.equal(g.loggedDays, 2); assert.equal(g.totalDays, 3);
  assert.equal(Math.round(g.bankPct * 1000), 26); assert.equal(g.weightPct, 0.2);
  assert.equal(g.finish, "2026-12-17"); assert.equal(g.awayFromGoal, false);
});

test("goalProgress: away from goal", () => {
  const g = goalProgress(goalInput({ food: { "2026-10-02": { date: "2026-10-02", meals: [{ id: "b", kcal: 2448 }] } } }));
  assert.equal(g.finish, null); assert.equal(g.awayFromGoal, true);
});

test("goalProgress hold", () => assert.deepEqual(goalProgress(goalInput({ profile: { goalWeight: 80.2, goalStart: "2026-10-01" } })), { hold: true }));
test("goalProgress needs a start weight (no weight logged at all)", () => assert.deepEqual(goalProgress(goalInput({ body: [] })), { needsStartWeight: true }));
test("goalProgress without a goal", () => assert.equal(goalProgress({ ...base, workouts: [] }), null));

test("goalProgress uses the first weight after goalStart when none was logged before it", () => {
  const g = goalProgress(goalInput({ body: [{ date: "2026-10-02", weight: 80 }, { date: "2026-10-03", weight: 79 }] }));
  assert.equal(g.start, 80);
  assert.equal(g.direction, "lose");
});

test("goalProgress: passing the calorie target is not 'moving away'", () => {
  const big = { "2026-10-01": { date: "2026-10-01", meals: [{ id: "a", kcal: 1 }] }, "2026-10-02": { date: "2026-10-02", meals: [{ id: "b", kcal: 1 }] } };
  const g = goalProgress(goalInput({ food: big, profile: { ...goalInput().profile, goalWeight: 79.5 } })); // target −3,850; bank ≈ −4,294
  assert.equal(g.bankReached, true);
  assert.equal(g.awayFromGoal, false);
  assert.equal(g.finish, null);
  assert.equal(g.bankPct, 1);
});

test("a target equal to the start weight earns no goal badges", () => {
  const list = badges({ ...base, workouts: [], profile: { goalWeight: 80, goalStart: "2026-10-01" },
    body: [{ date: "2026-10-01", weight: 80 }, { date: "2026-10-05", weight: 81.2 }] });
  assert.equal(B(list, "goal-reached").earned, null);
  assert.equal(B(list, "goal-first-kg").earned, null);
});

test("goal badges also use the first weight after goalStart", () => {
  const list = badges({ ...base, workouts: [], profile: { goalWeight: 75, goalStart: "2026-10-01" },
    body: [{ date: "2026-10-03", weight: 80 }, { date: "2026-10-12", weight: 78.8 }] });
  assert.equal(B(list, "goal-first-kg").earned, "2026-10-12");
});

test("badges() stays fast with two years of daily data", () => {
  const ws = [], food = {}, body = [];
  for (let i = 0; i < 730; i++) {
    const d = new Date("2025-01-01T12:00:00"); d.setDate(d.getDate() + i);
    const k = d.toISOString().slice(0, 10);
    food[k] = { date: k, meals: [{ id: "m", kcal: 2000 }] };
    if (i % 7 < 4) ws.push(wo(k, [S(60 + (i % 20), 5), S(60, 5)]));
    if (i % 3 === 0) body.push({ date: k, weight: 80 });
  }
  const t0 = performance.now();
  const list = badges({ ...base, today: "2026-12-31", workouts: ws, food, body });
  const ms = performance.now() - t0;
  assert.equal(B(list, "food-30").earned, "2025-01-30");
  assert.ok(ms < 150, `took ${Math.round(ms)} ms`);
});

test("goalProgress: the person's activity level changes the burn, so the calorie bank", () => {
  const food = { "2026-10-02": { date: "2026-10-02", meals: [{ id: "b", kcal: 2000 }] } };
  const plain = goalProgress(goalInput({ food })), active = goalProgress(goalInput({ food, profile: { ...goalInput().profile, activity: "very" } }));
  assert.ok(active.bank < plain.bank, `${active.bank} < ${plain.bank}`);
});

test("warm-ups and drop sets never make a PR; a warm-up-only exercise is harmless", () => {
  const heavyWarm = { w: 100, r: 5, k: "w" }, heavyDrop = { w: 90, r: 5, k: "d" };
  const ws = [wo("2026-10-01", [S(60, 5)]), wo("2026-10-03", [S(60, 5)]), wo("2026-10-05", [S(60, 5), heavyWarm, heavyDrop]), wo("2026-10-07", [{ w: 40, r: 10, k: "w" }])];
  assert.deepEqual(prEvents(ws), []);
  const real = [...ws.slice(0, 3), wo("2026-10-09", [S(65, 5)])];
  assert.deepEqual(prEvents(real), [{ date: "2026-10-09", ex: "bench press" }]);
});

test("volume badges count drop sets but not warm-ups", () => {
  const big = k => badges({ ...base, workouts: [wo("2026-10-05", [{ w: 1000, r: 100, k }], "Leg Press")] });
  assert.equal(B(big("w"), "volume-100t").earned, null, "a warm-up adds no volume");
  assert.equal(B(big("d"), "volume-100t").earned, "2026-10-05", "a drop set does");
  assert.equal(B(big(undefined), "volume-100t").earned, "2026-10-05");
});
