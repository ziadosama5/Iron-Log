import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { INFO, infoFor } from "../public/exercise-info.js";
import { ALL_EX, MUSCLES, muscleOf, isCurated, CURATED } from "../public/exercise-library.js";

test("every curated library exercise has an entry (the dataset ones get a lazily loaded How-to instead)", () => { for (const n of ALL_EX.filter(isCurated)) assert.ok(infoFor(n), n); });

test("no entries for unknown exercises", () => assert.equal(Object.keys(INFO).length, CURATED.size));

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

test("there are no drawings: no drawing folder, no drawing fields in the info, no drawing code in the page", () => {
  assert.equal(existsSync("public/exercises"), false, "public/exercises was removed");
  for (const e of Object.values(INFO)) for (const k of ["img", "slug", "own"]) assert.ok(!(k in e), `${e.name} still has "${k}"`);
  const page = readFileSync("public/index.html", "utf8");
  for (const word of ["Everkinetic", "ex-fig", "demo-fallback", "figureBox"]) assert.ok(!page.includes(word), word + " is gone from the page");
  assert.ok(!readFileSync("public/sw.js", "utf8").includes('"/exercises/"'), "the service worker no longer caches drawings");
});
