import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pairId, planRequest, planAccept, planRemove, planBlock, planUnblock, planNameRefresh,
  groupFriendships, relationTo, compareSummaries, staleNameDocs
} from "../public/friends.js";

const paths = r => r.ops.map(o => o.op + " " + o.path.join("/"));
const fd = (requester, other, status, names, updated = 1) => ({ users: [requester, other].sort(), requester, status, names, updated });

test("pairId sorts the two uids and rejects equal or empty ids", () => {
  assert.equal(pairId("b", "a"), "a_b");
  assert.equal(pairId("a", "b"), "a_b");
  assert.throws(() => pairId("a", "a"));
  assert.throws(() => pairId("", "a"));
});

test("planRequest writes one pending pair doc with sorted users and both names", () => {
  const r = planRequest({ me: "u2", meName: "zed", other: "u1", otherName: "ziad", now: 7 });
  assert.deepEqual(paths(r), ["set friendships/u1_u2"]);
  assert.deepEqual(r.ops[0].data, { users: ["u1", "u2"], requester: "u2", status: "pending", names: { u2: "zed", u1: "ziad" }, updated: 7 });
});

test("planAccept, planRemove, planUnblock and planNameRefresh touch exactly one doc", () => {
  const a = planAccept({ me: "u1", other: "u2", now: 3 });
  assert.deepEqual(paths(a), ["update friendships/u1_u2"]);
  assert.deepEqual(a.ops[0].data, { status: "accepted", updated: 3 });
  assert.deepEqual(paths(planRemove({ me: "u1", other: "u2" })), ["delete friendships/u1_u2"]);
  assert.deepEqual(paths(planUnblock({ me: "u1", other: "u2" })), ["delete blocks/u1_u2"]);
  const n = planNameRefresh({ me: "u2", other: "u1", myName: "zed2", now: 4 });
  assert.deepEqual(paths(n), ["update friendships/u1_u2"]);
  assert.deepEqual(n.ops[0].data, { "names.u2": "zed2", updated: 4 });
});

test("planBlock sets the block first (with the person's name when known), then deletes the friendship", () => {
  const r = planBlock({ me: "u1", other: "u2", otherName: "zed", now: 5 });
  assert.deepEqual(paths(r), ["set blocks/u1_u2", "delete friendships/u1_u2"]);
  assert.deepEqual(r.ops[0].data, { blocker: "u1", blocked: "u2", name: "zed", updated: 5 });
  assert.deepEqual(planBlock({ me: "u1", other: "u2", now: 5 }).ops[0].data, { blocker: "u1", blocked: "u2", updated: 5 });
});

test("groupFriendships splits requests, friends, sent and blocked; ignores other pairs", () => {
  const docs = [
    fd("u2", "u1", "pending", { u1: "me", u2: "zed" }, 5),
    fd("u1", "u3", "pending", { u1: "me", u3: "omar" }, 6),
    fd("u4", "u1", "accepted", { u1: "me", u4: "bob" }, 1),
    fd("u1", "u5", "accepted", { u1: "me", u5: "Ann" }, 2),
    fd("u7", "u8", "accepted", { u7: "x", u8: "y" }, 9)
  ];
  const blocks = [{ blocker: "u1", blocked: "u9", name: "spam", updated: 4 }];
  const g = groupFriendships(docs, "u1", blocks);
  assert.deepEqual(g.requests, [{ uid: "u2", name: "zed", updated: 5 }]);
  assert.deepEqual(g.sent, [{ uid: "u3", name: "omar", updated: 6 }]);
  assert.deepEqual(g.friends.map(f => f.name), ["Ann", "bob"]);
  assert.deepEqual(g.blocked, [{ uid: "u9", name: "spam", updated: 4 }]);
  assert.equal(groupFriendships([], "u1", [{ blocker: "u1", blocked: "u8", updated: 1 }]).blocked[0].name, null);
});

test("relationTo covers all six states and a block wins over a friendship", () => {
  const docs = [fd("u2", "u1", "pending", { u1: "me", u2: "zed" }), fd("u1", "u3", "pending", { u1: "me", u3: "o" }), fd("u1", "u4", "accepted", { u1: "me", u4: "b" })];
  const blocks = [{ blocker: "u1", blocked: "u4", updated: 1 }];
  assert.equal(relationTo("u1", "u1", docs, blocks), "self");
  assert.equal(relationTo("u1", "u2", docs, blocks), "received");
  assert.equal(relationTo("u1", "u3", docs, blocks), "sent");
  assert.equal(relationTo("u1", "u4", docs, blocks), "blocked");
  assert.equal(relationTo("u1", "u5", docs, blocks), "none");
  assert.equal(relationTo("u1", "u4", docs, []), "friends");
});

test("compareSummaries gives the leader per key in a fixed order; a missing summary counts as 0", () => {
  const mine = { level: 5, workoutsWeek: 2, workouts30: 9, streakWeeks: 3, volumeWeekKg: 1000, prs30: 1, workoutsTotal: 50 };
  const theirs = { level: 4, workoutsWeek: 2, workouts30: 12, streakWeeks: 3, volumeWeekKg: 900, prs30: 0, workoutsTotal: 80 };
  const rows = compareSummaries(mine, theirs);
  assert.deepEqual(rows.map(r => r.key), ["level", "workoutsWeek", "workouts30", "streakWeeks", "volumeWeekKg", "prs30", "workoutsTotal"]);
  assert.deepEqual(rows.map(r => r.leader), ["me", "tie", "them", "tie", "me", "me", "them"]);
  const none = compareSummaries(mine, null);
  assert.ok(none.every(r => r.theirs === 0));
  assert.equal(none[0].leader, "me");
});

test("staleNameDocs lists the pairs where my stored name differs from my username", () => {
  const docs = [
    fd("u1", "u2", "accepted", { u1: "old", u2: "zed" }),
    fd("u3", "u1", "pending", { u1: "ziad", u3: "omar" }),
    fd("u1", "u4", "pending", { u1: "ziad", u4: "x" }),
    fd("u7", "u8", "accepted", { u7: "a", u8: "b" })
  ];
  assert.deepEqual(staleNameDocs(docs, "u1", "ziad"), [{ other: "u2" }]);
  assert.deepEqual(staleNameDocs(docs, "u1", "new"), [{ other: "u2" }, { other: "u3" }, { other: "u4" }]);
  assert.deepEqual(staleNameDocs([], "u1", "ziad"), []);
  assert.deepEqual(staleNameDocs(docs, "u1", ""), [], "no username yet: nothing to refresh");
});

import { rankWeek } from "../public/friends.js";
const sm = n => ({ workoutsWeek: n });

test("rankWeek: most workouts first, ties share a rank, me is marked", () => {
  const r = rankWeek({ uid: "me", name: "me", summary: sm(2) }, [{ uid: "a", name: "a", summary: sm(3) }, { uid: "b", name: "b", summary: sm(2) }]);
  assert.deepEqual(r.map(x => [x.uid, x.rank, x.workoutsWeek]), [["a", 1, 3], ["me", 2, 2], ["b", 2, 2]]);
  assert.equal(r.find(x => x.uid === "me").isMe, true);
  assert.equal(r.find(x => x.uid === "a").isMe, false);
});
test("rankWeek: a friend without a summary is last with a null rank", () => {
  const r = rankWeek({ uid: "me", name: "me", summary: sm(0) }, [{ uid: "z", name: "z", summary: null }, { uid: "a", name: "a", summary: sm(1) }]);
  assert.deepEqual(r.map(x => [x.uid, x.rank, x.workoutsWeek]), [["a", 1, 1], ["me", 2, 0], ["z", null, null]]);
});
test("rankWeek: no friends gives just me with rank 1", () => {
  assert.deepEqual(rankWeek({ uid: "me", name: "me", summary: sm(0) }, []).map(x => [x.uid, x.rank]), [["me", 1]]);
});
