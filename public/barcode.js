// Barcode helpers for the food picker: validate digits, build the Open Food Facts lookup URL, turn a product into a My food.
// Pure: no camera, no network. Open Food Facts is user-edited, so every number is checked before the app trusts it.

const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const isNum = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
// Open Food Facts sometimes sends numbers as strings ("42"); words and empty strings stay as they are and fail isNum.
const toNum = v => (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v);
const text = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// "5 449000 000996" -> "5449000000996"; anything with other characters (letters, other digit scripts) -> "".
export function cleanDigits(s) {
  if (typeof s !== "string") return "";
  const d = s.replace(/[\s-]/g, "");
  return /^[0-9]*$/.test(d) ? d : "";
}

// EAN-8, UPC-A (12), EAN-13 and GTIN-14 with a correct GS1 check digit.
export function validBarcode(digits) {
  if (typeof digits !== "string" || !/^[0-9]+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length)) return false;
  const a = digits.split("").map(Number), check = a.pop();
  const sum = a.reverse().reduce((s, x, i) => s + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export function productUrl(digits) {
  return "https://world.openfoodfacts.org/api/v2/product/" + digits + ".json?fields=product_name,product_name_ar,brands,nutriments,serving_size,serving_quantity";
}

// An Open Food Facts answer as a My food {id, name, per100, servings, barcode}, or null when there is no usable calorie figure.
export function normalizeProduct(json, digits) {
  if (!isObj(json) || json.status !== 1 || !isObj(json.product)) return null;
  const p = json.product, n = isObj(p.nutriments) ? p.nutriments : {};
  const base = text(p.product_name_ar, 60) || text(p.product_name, 60);
  if (!base) return null;
  const kcal = toNum(n["energy-kcal_100g"]);
  if (!isNum(kcal, 0, 900)) return null;
  const protein = toNum(n.proteins_100g);
  if (protein !== undefined && protein !== null && !isNum(protein, 0, 100)) return null;
  const brand = typeof p.brands === "string" ? text(p.brands.split(",")[0], 30) : null;
  const name = (brand && !base.includes(brand) ? base + " (" + brand + ")" : base).slice(0, 60);
  const servings = [];
  const pack = toNum(p.serving_quantity);
  if (isNum(pack, 1, 5000)) servings.push({ id: "pkg", name: text(p.serving_size, 60) || pack + " g", grams: pack });
  servings.push({ id: "g100", name: "100 g", grams: 100 });
  return { id: "scan-" + digits, name, per100: { kcal, protein: protein ?? null }, servings, barcode: digits };
}
