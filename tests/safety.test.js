import { test } from "node:test";
import assert from "node:assert/strict";
import { REPORT_REASONS, reportId, buildReport, chunk, wipePlan, withTimeout } from "../public/safety.js";

test("REPORT_REASONS: four reasons in a fixed order", () => {
  assert.deepEqual(REPORT_REASONS.map(r => r.id), ["name", "harassment", "spam", "other"]);
  assert.deepEqual(REPORT_REASONS.map(r => r.label), ["Inappropriate name or username", "Harassment", "Spam", "Something else"]);
});

test("reportId joins reporter and reported, and rejects empty or equal ids", () => {
  assert.equal(reportId("a", "b"), "a_b");
  assert.equal(reportId("b", "a"), "b_a");
  assert.throws(() => reportId("a", "a"));
  assert.throws(() => reportId("", "a"));
  assert.throws(() => reportId("a", ""));
});

test("buildReport: the document for a valid report, null for anything else", () => {
  const ok = buildReport({ reporter: "u1", reported: "u2", reason: "spam", username: "zed", now: 5 });
  assert.deepEqual(ok, { id: "u1_u2", data: { reporter: "u1", reported: "u2", reason: "spam", username: "zed", updated: 5 } });
  assert.equal(buildReport({ reporter: "u1", reported: "u2", reason: "spam", username: "  zed  ", now: 5 }).data.username, "zed", "username is trimmed");
  const bad = o => buildReport({ reporter: "u1", reported: "u2", reason: "spam", username: "zed", now: 5, ...o });
  assert.equal(bad({ reason: "nope" }), null);
  assert.equal(bad({ reason: undefined }), null);
  assert.equal(bad({ reported: "u1" }), null, "cannot report yourself");
  assert.equal(bad({ reporter: "" }), null);
  assert.equal(bad({ reported: "" }), null);
  assert.equal(bad({ username: "" }), null);
  assert.equal(bad({ username: "   " }), null);
  assert.equal(bad({ username: "x".repeat(21) }), null);
  assert.equal(bad({ username: 5 }), null);
  assert.equal(bad({ now: NaN }), null);
  assert.equal(bad({ now: "5" }), null);
  assert.ok(bad({ username: "x".repeat(20) }));
});

test("chunk splits a list into slices of at most size", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5, 6, 7], 3), [[1, 2, 3], [4, 5, 6], [7]]);
  assert.deepEqual(chunk([], 3), []);
  assert.deepEqual(chunk([1], 450), [[1]]);
  assert.deepEqual(chunk([1, 2], 2), [[1, 2]]);
  assert.throws(() => chunk([1], 0));
});

test("wipePlan: the Delete flow's steps in order, the account always last, the shared profile only when there is one", () => {
  const ids = c => wipePlan(c).map(s => s.id);
  assert.deepEqual(ids({ hasProfile: true }), ["reauth", "share", "friendships", "blocks", "items", "device", "account"]);
  assert.deepEqual(ids({ hasProfile: false }), ["reauth", "friendships", "blocks", "items", "device", "account"]);
  assert.deepEqual(wipePlan({ hasProfile: true }).map(s => s.label), [
    "Signing in again…", "Removing your shared profile…", "Removing friendships…", "Removing blocks…", "Removing your data…", "Clearing this device…", "Deleting your account…"]);
});

test("withTimeout: passes the result through, rejects when it takes too long, passes errors through", async () => {
  assert.equal(await withTimeout(Promise.resolve(5), 50), 5);
  await assert.rejects(withTimeout(new Promise(() => {}), 20), /timeout/);
  await assert.rejects(withTimeout(Promise.reject(new Error("boom")), 50), /boom/);
  const slow = new Promise(r => setTimeout(() => r("late"), 80));
  await assert.rejects(withTimeout(slow, 10), /timeout/);
});
