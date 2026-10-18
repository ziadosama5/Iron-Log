import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { INFO, infoFor } from "../public/exercise-info.js";
import { ALL_EX, MUSCLES, muscleOf } from "../public/exercise-library.js";

test("every library exercise has an entry", () => { for (const n of ALL_EX) assert.ok(infoFor(n), n); });

test("no entries for unknown exercises", () => assert.equal(Object.keys(INFO).length, ALL_EX.length));

test("tips: 2-4 each, short, no trailing period", () => {
  for (const e of Object.values(INFO)) {
    assert.ok(e.tips.length >= 2 && e.tips.length <= 4, e.name);
    for (const t of e.tips) { assert.ok(t.length <= 60, t); assert.ok(!t.endsWith("."), t); }
  }
});

test("muscles valid and primary matches the library group", () => {
  for (const e of Object.values(INFO)) {
    assert.ok(e.primary.length > 0, e.name);
    for (const m of [...e.primary, ...e.secondary]) assert.ok(MUSCLES.includes(m), `${e.name}: ${m}`);
    assert.equal(e.primary[0], muscleOf(e.name), e.name);
  }
});

test("drawing files exist for img:true and none are unreferenced", () => {
  const files = new Set(readdirSync("public/exercises").filter(f => f.endsWith(".svg")));
  const want = new Set(Object.values(INFO).filter(e => e.img).flatMap(e => [`${e.slug}-start.svg`, `${e.slug}-end.svg`]));
  assert.deepEqual([...files].sort(), [...want].sort());
});

test("60 exercises have drawings", () => assert.equal(Object.values(INFO).filter(e => e.img).length, 60));

test("slugs are unique", () => {
  const s = Object.values(INFO).map(e => e.slug);
  assert.equal(new Set(s).size, s.length);
});

test("infoFor is case-insensitive", () => {
  assert.equal(infoFor("bench press").name, "Bench Press");
  assert.equal(infoFor("BENCH PRESS").name, "Bench Press");
  assert.equal(infoFor("My Custom Thing"), null);
});

test("merged names still show the info of the exercise they were merged into", () => {
  assert.equal(infoFor("Dumbbell Shoulder Press").name, "Overhead Press");
  assert.equal(infoFor("glute bridge").name, "Hip Thrust");
});
