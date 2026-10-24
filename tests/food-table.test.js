import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS, normalizeText, makeMyFood, searchFoods, portionTotals, mealTotals, defaultMealName, recentFoods, asEntry } from "../public/food-table.js";

// kcal100 250, protein100 8: a 40 g piece = 100 kcal / 3.2 g
const bread = { id: "bread", en: "Baladi bread", ar: "عيش بلدي", alt: [], group: "bread", kcal100: 250, protein100: 8,
  servings: [{ id: "g100", en: "100 g", ar: "100 جرام", grams: 100 }, { id: "piece", en: "1 piece", ar: "قطعة", grams: 40 }], def: "piece" };
const koshari = { id: "koshari", en: "Koshari", ar: "كشري", alt: ["koshary", "kushari"], group: "mains", kcal100: 150, protein100: 5,
  servings: [{ id: "plate", en: "1 plate", ar: "طبق", grams: 400 }], def: "plate" };
const bar = asEntry({ id: "m1", name: "Protein bar", per100: null, servings: [{ id: "s1", name: "1 bar", kcal: 210, protein: 20 }] });
const foods = [bread, koshari];

test("FOODS is an array", () => assert.ok(Array.isArray(FOODS)));

test("normalizeText strips diacritics and unifies letter variants", () => {
  assert.equal(normalizeText("  أَرُزٌ  "), "ارز");
  assert.equal(normalizeText("مَدرسة"), "مدرسه");
  assert.equal(normalizeText("إبراهيم آل"), "ابراهيم ال");
  assert.equal(normalizeText("على"), "علي");
  assert.equal(normalizeText("Baladi   BREAD "), "baladi bread");
});

test("searchFoods: empty and odd queries never throw", () => {
  assert.deepEqual(searchFoods("", { foods }), []);
  assert.deepEqual(searchFoods("   ", { foods }), []);
  assert.doesNotThrow(() => searchFoods("(", { foods }));
  assert.doesNotThrow(() => searchFoods(".*", { foods }));
  assert.deepEqual(searchFoods("(", { foods }), []);
});

test("searchFoods finds English, Arabic with diacritics, and alt spellings", () => {
  assert.deepEqual(searchFoods("bala", { foods }).map(f => f.id), ["bread"]);
  assert.deepEqual(searchFoods("كُشري", { foods }).map(f => f.id), ["koshari"]);
  assert.deepEqual(searchFoods("kushari", { foods }).map(f => f.id), ["koshari"]);
  assert.deepEqual(searchFoods("عيش", { foods }).map(f => f.id), ["bread"]);
});

test("searchFoods ranks prefix before substring and includes extra entries", () => {
  const a = { ...bread, id: "a", en: "Rye bread", alt: [] }, b = { ...bread, id: "b", en: "Bread roll", alt: [] };
  assert.deepEqual(searchFoods("bread", { foods: [a, b] }).map(f => f.id), ["b", "a"]);
  assert.deepEqual(searchFoods("bar", { foods: [], extra: [bar] }).map(f => f.id), ["m1"]);
  assert.equal(searchFoods("bread", { foods: [a, b], limit: 1 }).length, 1);
});

test("portionTotals by serving, grams and fixed servings", () => {
  assert.deepEqual(portionTotals(bread, { serving: "piece", amount: 2 }), { grams: 80, kcal: 200, protein: 6.4 });
  assert.deepEqual(portionTotals(bread, { serving: "g", grams: 150 }), { grams: 150, kcal: 375, protein: 12 });
  assert.deepEqual(portionTotals(bar, { serving: "s1", amount: 2 }), { grams: null, kcal: 420, protein: 40 });
  assert.deepEqual(portionTotals({ ...bread, protein100: null }, { serving: "piece", amount: 1 }), { grams: 40, kcal: 100, protein: null });
  assert.equal(portionTotals(bar, { serving: "g", grams: 50 }), null, "no per-100 g values");
});

test("portionTotals rejects bad amounts", () => {
  for (const amount of [0, -1, NaN, Infinity, 101, "2", undefined]) assert.equal(portionTotals(bread, { serving: "piece", amount }), null, String(amount));
  for (const grams of [0, -5, NaN, 5001, undefined]) assert.equal(portionTotals(bread, { serving: "g", grams }), null, String(grams));
  assert.equal(portionTotals(bread, { serving: "nope", amount: 1 }), null);
});

test("mealTotals and defaultMealName", () => {
  assert.deepEqual(mealTotals([]), { kcal: 0, protein: null });
  assert.deepEqual(mealTotals([{ kcal: 100.4, protein: 3.25 }, { kcal: 50.4, protein: null }]), { kcal: 151, protein: 3.3 });
  assert.deepEqual(mealTotals([{ kcal: 10, protein: null }]), { kcal: 10, protein: null });
  assert.equal(defaultMealName([{ name: "Ful" }, { name: "Bread" }, { name: "Taameya" }, { name: "Salad" }]), "Ful + Bread + Taameya");
  assert.equal(defaultMealName([{ name: "x".repeat(30) }, { name: "y".repeat(30) }]).length, 40);
  assert.equal(defaultMealName([]), "");
});

test("recentFoods: newest first, last 14 days, one per src+ref, ignores meals without items", () => {
  const it = (ref, src = "table") => ({ src, ref, name: ref, serving: "s", amount: 1, grams: null, kcal: 1, protein: null });
  const docs = [
    { date: "2026-10-20", meals: [{ items: [it("ful"), it("bread")] }] },
    { date: "2026-10-23", meals: [{ items: [it("bread")] }, { kcal: 300 }] },
    { date: "2026-10-01", meals: [{ items: [it("old")] }] },
    { date: "2026-10-22", meals: [{ items: [it("bread", "mine")] }] },
  ];
  assert.deepEqual(recentFoods(docs, "2026-10-24", 10).map(i => i.src + ":" + i.ref), ["table:bread", "mine:bread", "table:ful"]);
  assert.equal(recentFoods(docs, "2026-10-24", 2).length, 2);
  assert.deepEqual(recentFoods([], "2026-10-24", 5), []);
});

test("asEntry adapts a My food", () => {
  assert.equal(bar.group, "mine");
  assert.equal(bar.en, "Protein bar");
  assert.equal(bar.ar, "Protein bar");
  assert.equal(bar.def, "s1");
  assert.deepEqual(bar.alt, []);
});

test("makeMyFood: a fixed-kcal serving keeps its numbers on the serving", () => {
  const f = makeMyFood({ id: "m1", name: "  Protein bar ", kcal: 210, protein: 20, servingName: "1 bar", barcode: "5449000000996" });
  assert.deepEqual(f, { id: "m1", name: "Protein bar", per100: null, servings: [{ id: "s1", name: "1 bar", kcal: 210, protein: 20 }], barcode: "5449000000996" });
  assert.deepEqual(makeMyFood({ id: "m2", name: "Tea cake", kcal: 150, protein: null, servingName: "" }).servings, [{ id: "s1", name: "1 serving", kcal: 150 }]);
});

test("makeMyFood: with grams it stores per-100 g values and a grams serving", () => {
  const f = makeMyFood({ id: "m3", name: "Home ful", kcal: 300, protein: 17.5, servingName: "1 plate", grams: 250 });
  assert.deepEqual(f.per100, { kcal: 120, protein: 7 });
  assert.deepEqual(f.servings, [{ id: "s1", name: "1 plate", grams: 250 }]);
  assert.equal(makeMyFood({ id: "m4", name: "x", kcal: 300, protein: null, servingName: "p", grams: 250 }).per100.protein, null);
  const e = asEntry(f);
  assert.deepEqual(portionTotals(e, { serving: "s1", amount: 1 }), { grams: 250, kcal: 300, protein: 17.5 });
});

test("makeMyFood rejects bad input", () => {
  const ok = { id: "m", name: "x", kcal: 100, protein: 5, servingName: "s" };
  for (const bad of [{ name: "" }, { name: "   " }, { kcal: -1 }, { kcal: 5001 }, { kcal: NaN }, { kcal: "100" }, { protein: 501 }, { protein: -1 }, { grams: 0 }, { grams: 5001 },
    { grams: 10, kcal: 500 }, { barcode: "12ab" }]) assert.equal(makeMyFood({ ...ok, ...bad }), null, JSON.stringify(bad));
  assert.equal(makeMyFood({ ...ok, name: "x".repeat(70) }).name.length, 60);
  assert.match(makeMyFood({ name: "x", kcal: 1, protein: null, servingName: "s" }).id, /^[a-z0-9]{1,40}$/, "generated id");
});
