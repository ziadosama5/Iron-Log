import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerLang, setLang, getLang, isRtl, detectLang, t, tn, nameOf, locale, trDom } from "../public/i18n.js";

const AR = {
  ui: { "Add set": "إضافة مجموعة", "Skip": "تخطي", "Close": "إغلاق", "Search": "بحث", "Weight": "الوزن", "{n} of {m} done": "{n} من {m} تم", "{n} set": "{n} مجموعة", "{n} sets": "{n} مجموعات" },
  names: { ex: { "Bench Press": "ضغط الصدر" }, muscle: { "Chest": "الصدر" } }
};
registerLang("ar", AR);
beforeEach(() => setLang("en"));

// Tiny fake DOM: enough for trDom.
const text = v => ({ nodeType: 3, nodeValue: v });
function el(tag, attrs = {}, children = []) {
  const a = { ...attrs };
  return { nodeType: 1, tagName: tag.toUpperCase(), childNodes: children,
    getAttribute: k => (k in a ? a[k] : null), setAttribute: (k, v) => { a[k] = v; },
    hasAttribute: k => k in a, removeAttribute: k => { delete a[k]; } };
}

test("t returns English in en, Arabic in ar, English when the key is missing", () => {
  assert.equal(t("Skip"), "Skip");
  setLang("ar");
  assert.equal(t("Skip"), "تخطي");
  assert.equal(t("Not in the dictionary"), "Not in the dictionary");
});

test("t replaces placeholders; unknown placeholders stay", () => {
  assert.equal(t("{n} of {m} done", { n: 2, m: 5 }), "2 of 5 done");
  setLang("ar");
  assert.equal(t("{n} of {m} done", { n: 2, m: 5 }), "2 من 5 تم");
  assert.equal(t("Hello {x}", {}), "Hello {x}");
});

test("tn picks one only for exactly 1", () => {
  assert.equal(tn("{n} set", "{n} sets", 1), "1 set");
  for (const n of [0, 2, 5]) assert.equal(tn("{n} set", "{n} sets", n), `${n} sets`);
  setLang("ar");
  assert.equal(tn("{n} set", "{n} sets", 1), "1 مجموعة");
  assert.equal(tn("{n} set", "{n} sets", 3), "3 مجموعات");
});

test("detectLang prefers a valid saved value, else the phone language", () => {
  assert.equal(detectLang("ar", "en-US"), "ar");
  assert.equal(detectLang(null, "ar-EG"), "ar");
  assert.equal(detectLang(null, "en-GB"), "en");
  assert.equal(detectLang("en", "ar"), "en");
  assert.equal(detectLang("xx", "ar"), "ar");
  assert.equal(detectLang(null, undefined), "en");
});

test("setLang rejects unknown codes; isRtl and locale follow the language", () => {
  assert.equal(setLang("zz"), false);
  assert.equal(getLang(), "en");
  assert.equal(isRtl(), false);
  assert.equal(locale(), undefined);
  assert.equal(setLang("ar"), true);
  assert.equal(isRtl(), true);
  assert.equal(locale(), "ar-EG-u-nu-latn");
});

test("nameOf is case-insensitive and leaves custom names alone", () => {
  setLang("ar");
  assert.equal(nameOf("ex", "Bench Press"), "ضغط الصدر");
  assert.equal(nameOf("ex", "bench press"), "ضغط الصدر");
  assert.equal(nameOf("ex", "My Custom Thing"), "My Custom Thing");
  assert.equal(nameOf("nokind", "Bench Press"), "Bench Press");
  setLang("en");
  assert.equal(nameOf("ex", "Bench Press"), "Bench Press");
});

test("trDom translates text and attributes, keeps whitespace, is idempotent and reversible", () => {
  const skip = text("  Skip "), other = text("Unknown words");
  const root = el("div", {}, [
    el("button", { "aria-label": "Close", title: "Close" }, [skip]),
    el("input", { placeholder: "Search" }),
    el("p", {}, [other]),
    el("script", {}, [text("Skip")]),
    el("span", { "data-no-tr": "" }, [text("Skip")])
  ]);
  setLang("ar"); trDom(root);
  assert.equal(skip.nodeValue, "  تخطي ");
  assert.equal(root.childNodes[0].getAttribute("aria-label"), "إغلاق");
  assert.equal(root.childNodes[0].getAttribute("title"), "إغلاق");
  assert.equal(root.childNodes[1].getAttribute("placeholder"), "بحث");
  assert.equal(other.nodeValue, "Unknown words");
  assert.equal(root.childNodes[3].childNodes[0].nodeValue, "Skip");
  assert.equal(root.childNodes[4].childNodes[0].nodeValue, "Skip");
  trDom(root);
  assert.equal(skip.nodeValue, "  تخطي ");
  setLang("en"); trDom(root);
  assert.equal(skip.nodeValue, "  Skip ");
  assert.equal(root.childNodes[0].getAttribute("aria-label"), "Close");
});

test("trDom matches text split over lines by collapsing inner whitespace", () => {
  const n = text("\n   Add\n      set\n ");
  setLang("ar"); trDom(el("p", {}, [n]));
  assert.equal(n.nodeValue, "\n   إضافة مجموعة\n ");
});
