import { test } from "node:test";
import assert from "node:assert/strict";
import { matchTitles } from "../tools/find-drawing.mjs";

const idx = [{ id: "0126", title: "Leg Press" }, { id: "0127", title: "Narrow Stance Leg Press" }, { id: "0001", title: "Neck" }];

test("matchTitles: every query word must appear, shortest title first", () => {
  assert.deepEqual(matchTitles(idx, "leg press").map(e => e.id), ["0126", "0127"]);
  assert.deepEqual(matchTitles(idx, "narrow press").map(e => e.id), ["0127"]);
});

test("matchTitles ignores case and punctuation; an empty query matches nothing", () => {
  assert.deepEqual(matchTitles(idx, "Leg-Press!").map(e => e.id), ["0126", "0127"]);
  assert.deepEqual(matchTitles(idx, ""), []);
  assert.deepEqual(matchTitles(idx, "   "), []);
});
