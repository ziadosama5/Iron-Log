import test from "node:test";
import assert from "node:assert/strict";
import { BADGES } from "../public/achievements.js";
import { buildCards, newWins } from "../public/celebrate.js";

const mk = earned => BADGES.map(b => ({ id: b.id, name: b.name, group: b.group, earned: earned.includes(b.id) ? "2026-01-01" : null, value: 0, target: b.target }));
const base = { freshBadges: [], list: mk([]), levelBefore: 3, levelNow: 3, wins: [] };

test("nothing new gives no cards", () => {
  assert.deepEqual(buildCards(base), []);
});

test("badge cards come in family then ladder order", () => {
  const ids = ["pr-1", "workouts-10", "workouts-1"];
  const cards = buildCards({ ...base, list: mk(ids), freshBadges: ids.map(id => ({ id })) });
  assert.deepEqual(cards.map(c => c.key), ["badge:workouts-1", "badge:workouts-10", "badge:pr-1"]);
  assert.equal(cards[1].familyId, "workouts"); assert.equal(cards[1].level, 2); assert.equal(cards[1].of, 5); assert.equal(cards[1].tier, "silver");
  assert.equal(cards[1].badgeName, "10 workouts");
});

test("level card only when the level went up, and not on the first run", () => {
  assert.equal(buildCards({ ...base, levelNow: 4 }).map(c => c.kind).join(), "level");
  assert.equal(buildCards({ ...base, levelNow: 4 })[0].levelNow, 4);
  assert.deepEqual(buildCards({ ...base, levelNow: 2 }), []);
  assert.deepEqual(buildCards({ ...base, levelBefore: null, levelNow: 9 }), []);
});

test("wins come last", () => {
  const cards = buildCards({ ...base, levelNow: 4, freshBadges: [{ id: "pr-1" }], list: mk(["pr-1"]), wins: [{ cid: "c1", name: "Ali" }] });
  assert.deepEqual(cards.map(c => c.kind), ["badge", "level", "win"]);
  assert.equal(cards[2].key, "win:c1");
});

test("unknown badge ids are skipped", () => {
  assert.deepEqual(buildCards({ ...base, freshBadges: [{ id: "nope" }] }), []);
});

test("newWins keeps finished, won, unseen", () => {
  const rows = [
    { cid: "a", name: "A", finished: true, won: true },
    { cid: "b", name: "B", finished: false, won: true },
    { cid: "c", name: "C", finished: true, won: false },
    { cid: "d", name: "D", finished: true, won: true },
  ];
  assert.deepEqual(newWins(rows, ["d"]), [{ cid: "a", name: "A" }]);
  assert.deepEqual(newWins(rows, undefined).map(r => r.cid), ["a", "d"]);
});
