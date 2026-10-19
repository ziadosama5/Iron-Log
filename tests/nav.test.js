import test from "node:test";
import assert from "node:assert/strict";
import { TABS, FULLSCREEN, PILL_LABEL, tabOf, pillsFor, migrateView } from "../public/nav.js";

const all = TABS.flatMap(t => t.views);

test("every view is in exactly one tab", () => {
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(TABS.map(t => t.id), ["today", "plan", "progress", "friends", "me"]);
});

test("tabOf maps views to tabs and fullscreen views to null", () => {
  assert.equal(tabOf("log"), "today");
  assert.equal(tabOf("goals"), "progress");
  assert.equal(tabOf("find"), "friends");
  assert.equal(tabOf("profile"), "me");
  assert.equal(tabOf("gym"), "plan");
  assert.equal(tabOf("journey"), null);
  assert.equal(tabOf("delete"), null);
  assert.equal(tabOf("constructor"), null);
  assert.equal(tabOf(undefined), null);
});

test("pillsFor gives sections only for multi-section tabs", () => {
  assert.deepEqual(pillsFor("today"), []);
  assert.deepEqual(pillsFor("me"), []);
  assert.deepEqual(pillsFor("plan"), ["days", "gym"]);
  assert.deepEqual(pillsFor("progress"), ["body", "progress", "goals", "coach", "history"]);
  assert.deepEqual(pillsFor("friends"), ["friends", "challenges", "find"]);
  assert.deepEqual(pillsFor("nope"), []);
});

test("migrateView always returns a usable screen", () => {
  for (const v of all) assert.equal(migrateView(v), v);
  for (const bad of ["more", "journey", "delete", "", null, undefined, "constructor", "__proto__", 42, {}, "signin"]) assert.equal(migrateView(bad), "log");
  assert.deepEqual(FULLSCREEN, ["journey", "delete"]);
});

test("pill labels cover every multi-section view", () => {
  for (const id of ["plan", "progress", "friends"]) for (const v of pillsFor(id)) assert.ok(PILL_LABEL[v], v);
  for (const k of Object.keys(PILL_LABEL)) assert.ok(all.includes(k), k);
});
