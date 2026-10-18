import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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

test("every exercise has a drawing", () => assert.equal(Object.values(INFO).filter(e => e.img).length, ALL_EX.length));

test("slugs are unique among exercises with their own drawing; reused drawings point at a real, non-reused target", () => {
  const sources = JSON.parse(readFileSync("tools/exercise-sources.json", "utf8"));
  const own = Object.values(INFO).filter(e => !sources[e.name].drawing).map(e => e.slug);
  assert.equal(new Set(own).size, own.length);
  for (const [name, s] of Object.entries(sources)) {
    if (!s.drawing) continue;
    const target = sources[s.drawing];
    assert.ok(target && !target.drawing, `${name}: bad drawing source ${s.drawing}`);
    assert.equal(INFO[name.toLowerCase()].slug, INFO[s.drawing.toLowerCase()].slug, name);
    assert.equal(INFO[name.toLowerCase()].img, true, name);
  }
});

test("infoFor is case-insensitive", () => {
  assert.equal(infoFor("bench press").name, "Bench Press");
  assert.equal(infoFor("BENCH PRESS").name, "Bench Press");
  assert.equal(infoFor("My Custom Thing"), null);
});

test("merged names still show the info of the exercise they were merged into", () => {
});

test("every exercise has Arabic tips: same count, short, no trailing period", () => {
  for (const e of Object.values(INFO)) {
    assert.ok(e.ar && Array.isArray(e.ar.tips), `${e.name}: missing ar.tips`);
    assert.equal(e.ar.tips.length, e.tips.length, `${e.name}: tip count differs`);
    for (const t of e.ar.tips) {
      assert.ok(t.trim().length > 0 && t.length <= 80, `${e.name}: bad length: ${t}`);
      assert.ok(!t.endsWith("."), `${e.name}: trailing period: ${t}`);
      assert.ok(/[؀-ۿ]/.test(t), `${e.name}: not Arabic: ${t}`);
    }
  }
});

test("restored exercises are their own entries, no longer redirected", () => {
  assert.equal(infoFor("Dumbbell Shoulder Press").name, "Dumbbell Shoulder Press");
  assert.equal(infoFor("cable lateral raise").name, "Cable Lateral Raise");
  assert.equal(muscleOf("Dumbbell Shoulder Press"), "Shoulders");
  assert.equal(muscleOf("Cable Lateral Raise"), "Shoulders");
});

test("infoFor ignores inherited object keys (a custom exercise named constructor has no info)", () => {
  for (const n of ["constructor", "toString", "__proto__"]) assert.equal(infoFor(n), null, n);
});
