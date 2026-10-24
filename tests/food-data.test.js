import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../public/food-table.js";

const MIN_FOODS = 60;

test("the table has enough foods", () => assert.ok(FOODS.length >= MIN_FOODS, `${FOODS.length} foods`));

test("ids are unique and well formed", () => {
  const ids = FOODS.map(f => f.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate id");
  for (const id of ids) assert.match(id, /^[a-z0-9-]{2,30}$/, id);
});

test("every food has names, a group, servings with Arabic names and a default that exists", () => {
  for (const f of FOODS) {
    assert.ok(f.en && f.en.trim(), f.id + " en");
    assert.ok(f.ar && f.ar.trim(), f.id + " ar");
    assert.ok(f.group, f.id + " group");
    assert.ok(Array.isArray(f.alt), f.id + " alt");
    assert.ok(f.servings.length >= 1 && f.servings.length <= 5, f.id + " servings");
    const sids = f.servings.map(s => s.id);
    assert.equal(new Set(sids).size, sids.length, f.id + " serving ids");
    assert.ok(sids.includes(f.def), f.id + " default serving");
    assert.ok(f.servings.some(s => s.grams > 0), f.id + " a serving with grams");
    for (const s of f.servings) { assert.ok(s.en && s.ar, f.id + "/" + s.id + " names"); assert.ok(s.grams > 0 && s.grams <= 5000, f.id + "/" + s.id + " grams"); }
  }
});

test("numbers are plausible, and kcal agrees with the macros where they are recorded", () => {
  for (const f of FOODS) {
    assert.ok(f.kcal100 >= 0 && f.kcal100 <= 900, f.id + " kcal100");
    assert.ok(f.protein100 >= 0 && f.protein100 <= 100, f.id + " protein100");
    if (f.fat100 != null && f.carbs100 != null) {
      assert.ok(f.protein100 + f.fat100 + f.carbs100 <= 100, f.id + " macros add up to more than 100 g");
      const calc = 4 * f.carbs100 + 4 * f.protein100 + 9 * f.fat100;
      assert.ok(Math.abs(f.kcal100 - calc) <= 0.15 * calc, `${f.id}: kcal ${f.kcal100} vs macros ${calc}`);
    }
  }
});
