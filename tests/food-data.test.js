import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS, searchFoods } from "../public/food-table.js";

const MIN_FOODS = 280;
const GROUPS = ["bread", "legumes", "mains", "rice", "eggs-dairy", "sides", "veg", "fruit", "meat", "sweets", "drinks", "snacks", "fastfood", "fats", "grains", "supplements"];

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
      assert.ok(Math.abs(f.kcal100 - calc) <= Math.max(0.15 * calc, 1), `${f.id}: kcal ${f.kcal100} vs macros ${calc}`);
    }
  }
});

test("every group has foods, and many foods carry alternate spellings for search", () => {
  const present = new Set(FOODS.map(f => f.group));
  for (const g of GROUPS) assert.ok(present.has(g), "no foods in group " + g);
  assert.ok(FOODS.filter(f => f.alt.length).length >= 15, "alt spellings");
});

test("a few anchor foods exist with believable numbers", () => {
  const by = id => FOODS.find(f => f.id === id);
  assert.ok(by("olive-oil").kcal100 >= 800, "olive oil is almost all fat");
  assert.ok(by("sugar").kcal100 >= 380 && by("sugar").kcal100 <= 410, "sugar");
  assert.ok(by("banana").kcal100 >= 80 && by("banana").kcal100 <= 110, "banana");
  assert.ok(by("whey").protein100 >= 70, "whey protein");
});

// What the owner looked for and could not find, plus a spread of other everyday searches: each must put the right food in the first results.
const MUST_FIND = {
  "brown toast": "brown-toast", "brown rice": "rice-brown", "basmaty rice": "rice-basmati", "basmati": "rice-basmati", "rice basmati": "rice-basmati",
  "egyptian salad": "tomato-salad", "egyptian rice": "rice-white", "boiled chicken": "chicken-breast", "whole wheat bread": "wheat-bread",
  "shrimp": "shrimp", "salmon": "salmon", "quinoa": "quinoa", "broccoli": "broccoli", "tabbouleh": "tabbouleh", "mozzarella": "mozzarella",
  "greek yoghurt": "greek-yoghurt", "zalabia": "zalabia", "kahk": "kahk", "protein shake": "protein-shake", "avocado": "avocado", "water": "water",
  "skim milk": "milk-skim", "oats": "oats", "egg white": "egg-white", "wrap": "wrap", "shakshuka": "shakshuka", "sayadeya": "sayadeya", "creatine": "creatine",
  "كينوا": "quinoa", "أرز بسمتي": "rice-basmati", "توست أسمر": "brown-toast", "جمبري": "shrimp", "سلطة مصرية": "tomato-salad", "بروكلي": "broccoli",
  "ماء": "water", "كحك": "kahk", "زلابية": "zalabia", "اندومي": "noodles-instant",
};
test("the owner's searches and other everyday ones find the right food near the top", () => {
  for (const [q, id] of Object.entries(MUST_FIND)) {
    assert.ok(FOODS.some(f => f.id === id), id + " exists");
    const top = searchFoods(q).slice(0, 5).map(f => f.id);
    assert.ok(top.includes(id), `"${q}" should find ${id} in the first 5, got: ${top.join(", ")}`);
  }
});

test("Arabic labels follow the project rule: digits 0-9 and Latin units", () => {
  const bad = [];
  for (const f of FOODS) for (const text of [f.ar, ...f.servings.map(s => s.ar)]) if (/[٠-٩]/.test(text) || /(^|[\s(])مل([\s)]|$)/.test(text)) bad.push(f.id + ": " + text);
  assert.deepEqual(bad, []);
});
