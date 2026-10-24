import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanDigits, validBarcode, productUrl, normalizeProduct, canonicalBarcode } from "../public/barcode.js";

const FULL = { status: 1, product: { product_name: "Cola", product_name_ar: "", brands: "Fizz, Fizz Intl", serving_size: "330 ml", serving_quantity: 330,
  nutriments: { "energy-kcal_100g": 42, proteins_100g: 0 } } };

test("cleanDigits removes spaces and dashes and refuses anything else", () => {
  assert.equal(cleanDigits("5 449000 000996"), "5449000000996");
  assert.equal(cleanDigits(" 5449-0000-00996 "), "5449000000996");
  assert.equal(cleanDigits("12a"), "");
  assert.equal(cleanDigits(""), "");
  assert.equal(cleanDigits(null), "");
  assert.equal(cleanDigits("١٢٣٤٥٦٧٨"), "", "Arabic-Indic digits are not accepted");
});

test("validBarcode checks length and the GS1 check digit", () => {
  for (const ok of ["5449000000996", "96385074", "036000291452", "4006381333931", "00012345678905"]) assert.equal(validBarcode(ok), true, ok);
  for (const bad of ["5449000000995", "96385075", "036000291453", "12345678901", "123456789", "", "abcdefgh", "54490000009961"]) assert.equal(validBarcode(bad), false, bad);
  assert.equal(validBarcode(5449000000996), false, "numbers are not strings");
});

test("productUrl asks only for the fields the app needs", () => {
  const u = productUrl("5449000000996");
  assert.ok(u.startsWith("https://world.openfoodfacts.org/api/v2/product/5449000000996.json?fields="));
  for (const f of ["product_name", "product_name_ar", "brands", "nutriments", "serving_size", "serving_quantity"]) assert.ok(u.includes(f), f);
});

test("normalizeProduct maps a full product to a My-food shape", () => {
  const f = normalizeProduct(FULL, "5449000000996");
  assert.deepEqual(f, { id: "scan-5449000000996", name: "Cola (Fizz)", per100: { kcal: 42, protein: 0 },
    servings: [{ id: "pkg", name: "330 ml", grams: 330 }, { id: "g100", name: "100 g", grams: 100 }], barcode: "5449000000996" });
});

test("normalizeProduct: Arabic name wins, no package serving gives only 100 g, missing protein is null", () => {
  const p = { status: 1, product: { product_name: "Biscuit", product_name_ar: "بسكويت", brands: "", nutriments: { "energy-kcal_100g": 480 } } };
  const f = normalizeProduct(p, "96385074");
  assert.equal(f.name, "بسكويت");
  assert.deepEqual(f.servings, [{ id: "g100", name: "100 g", grams: 100 }]);
  assert.equal(f.per100.protein, null);
});

test("normalizeProduct returns null when there are no usable calories or the product is unknown", () => {
  const withN = n => ({ status: 1, product: { product_name: "X", nutriments: n } });
  assert.equal(normalizeProduct(withN({ energy_100g: 1500 }), "96385074"), null, "kJ only");
  assert.equal(normalizeProduct(withN({ "energy-kcal_100g": 950 }), "96385074"), null, "over 900 kcal");
  assert.equal(normalizeProduct(withN({ "energy-kcal_100g": -5 }), "96385074"), null, "negative");
  assert.equal(normalizeProduct(withN({ "energy-kcal_100g": "lots" }), "96385074"), null, "not a number");
  assert.equal(normalizeProduct(withN({ "energy-kcal_100g": 100, proteins_100g: 140 }), "96385074"), null, "protein over 100 g");
  assert.equal(normalizeProduct({ status: 0 }, "96385074"), null);
  assert.equal(normalizeProduct({ status: 1, product: { nutriments: { "energy-kcal_100g": 100 } } }, "96385074"), null, "no name");
  for (const junk of [null, undefined, "x", 5, [], { status: 1 }]) assert.equal(normalizeProduct(junk, "96385074"), null);
});

test("normalizeProduct cuts long names and ignores silly serving sizes", () => {
  const p = { status: 1, product: { product_name: "N".repeat(80), brands: "B", serving_quantity: 99999, serving_size: "huge",
    nutriments: { "energy-kcal_100g": 100, proteins_100g: 5 } } };
  const f = normalizeProduct(p, "96385074");
  assert.ok(f.name.length <= 60);
  assert.deepEqual(f.servings, [{ id: "g100", name: "100 g", grams: 100 }]);
});

test("normalizeProduct accepts numbers sent as numeric strings, but not words", () => {
  const p = { status: 1, product: { product_name: "Cola", serving_size: "330 ml", serving_quantity: "330", nutriments: { "energy-kcal_100g": "42", proteins_100g: "1.5" } } };
  const f = normalizeProduct(p, "5449000000996");
  assert.deepEqual(f.per100, { kcal: 42, protein: 1.5 });
  assert.deepEqual(f.servings[0], { id: "pkg", name: "330 ml", grams: 330 });
  const words = { status: 1, product: { product_name: "Cola", nutriments: { "energy-kcal_100g": "lots" } } };
  assert.equal(normalizeProduct(words, "5449000000996"), null);
  assert.equal(normalizeProduct({ status: 1, product: { product_name: "Cola", nutriments: { "energy-kcal_100g": "" } } }, "5449000000996"), null, "empty string is no data");
  assert.equal(normalizeProduct({ status: 1, product: { product_name: "Cola", nutriments: { "energy-kcal_100g": 40, proteins_100g: "x" } } }, "5449000000996"), null, "protein that is not a number");
});

test("canonicalBarcode: UPC-A and EAN-13 of one product are the same code", () => {
  assert.equal(canonicalBarcode("036000291452"), "0036000291452");
  assert.equal(canonicalBarcode("0036000291452"), "0036000291452");
  assert.equal(canonicalBarcode("5449000000996"), "5449000000996");
  assert.equal(canonicalBarcode("96385074"), "96385074", "EAN-8 stays");
  assert.equal(canonicalBarcode("036000291453"), "", "bad check digit");
  assert.equal(canonicalBarcode("12ab"), "");
});

test("canonicalBarcode: UPC-E is expanded to UPC-A and checked with that check digit", () => {
  assert.equal(canonicalBarcode("04252614"), "0042100005264");  // UPC-A 042100005264
  assert.equal(canonicalBarcode("04252615"), "", "wrong check digit");
});
