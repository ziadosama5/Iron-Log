import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composeArabic } from "../tools/ar-glossary.mjs";
import { CATALOG } from "../public/exercise-catalog.js";
import { ALL_EX } from "../public/exercise-library.js";
import { AR } from "../public/lang-ar.js";
import { AR_CATALOG_EX } from "../public/lang-ar-catalog.js";
import { nameOf } from "../public/i18n.js";

test("composeArabic: movement, muscle, position words, equipment", () => {
  assert.equal(composeArabic("Dumbbell Biceps Curl").ar, "كيرل البايسبس بالدمبل");
  assert.equal(composeArabic("Cable One Arm Lateral Raise").ar, "رفع جانبي بذراع واحدة بالكابل");
  assert.equal(composeArabic("Barbell Full Squat").ar, "سكوات كامل بالبار");
  assert.equal(composeArabic("Smith Machine Incline Press").ar, "ضغط مائل على جهاز سميث");
  assert.equal(composeArabic("Band Squat").ar, "سكوات بالحزام المطاطي");
  assert.equal(composeArabic("Dumbbell Bent over Row").ar, "تجديف بانحناء بالدمبل");
  assert.equal(composeArabic("Back Lever").ar, "باك ليفر");
});

test("composeArabic knows every word of every catalog name", () => {
  const bad = CATALOG.map(r => [r[0], composeArabic(r[0]).unknown]).filter(([, u]) => u.length);
  assert.deepEqual(bad, []);
});

test("every catalog exercise has its own Arabic name, in Arabic letters, merged into AR.names.ex", () => {
  const seen = new Map();
  for (const [name] of CATALOG) {
    const ar = AR.names.ex[name];
    assert.ok(ar && ar.trim(), "Arabic name for " + name);
    assert.equal(ar, AR_CATALOG_EX[name], "merged from lang-ar-catalog.js: " + name);
    assert.match(ar, /[؀-ۿ]/, "Arabic letters: " + name);
    assert.ok(!/[A-Za-z]/.test(ar.replace(/EZ/g, "")), `no Latin letters left in "${ar}" (${name})`);
    assert.notEqual(ar, name);
    assert.ok(ar.length <= 70, "not too long: " + ar);
    assert.equal(nameOf("ex", name), nameOf("ex", name));
  }
  for (const n of ALL_EX) {
    const ar = AR.names.ex[n]; assert.ok(ar, n);
    assert.ok(!seen.has(ar), `"${ar}" is the Arabic name of both "${n}" and "${seen.get(ar)}"`);
    seen.set(ar, n);
  }
});

test("hand fixes in tools/ar-names/overrides.json win and every override names a real catalog exercise", () => {
  const ov = JSON.parse(readFileSync(new URL("../tools/ar-names/overrides.json", import.meta.url), "utf8"));
  const names = new Set(CATALOG.map(r => r[0]));
  for (const [n, ar] of Object.entries(ov)) { assert.ok(names.has(n), "unknown exercise in overrides: " + n); assert.equal(AR_CATALOG_EX[n], ar); }
});
