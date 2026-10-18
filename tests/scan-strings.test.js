import { test } from "node:test";
import assert from "node:assert/strict";
import { scanSource, LABEL_ALLOW } from "../tools/scan-strings.mjs";

const js = src => scanSource(src, { kind: "js" });
const html = src => scanSource(src, { kind: "html" });

test("a plain HTML text node is a label", () => {
  assert.deepEqual(html("<button>Skip</button>").labels, ["Skip"]);
  assert.deepEqual(html("<button>Skip</button>").violations, []);
});

test("entities are decoded and surrounding whitespace trimmed", () => {
  assert.deepEqual(html("<a>  History &amp; backup \n</a>").labels, ["History & backup"]);
});

test("text glued to an interpolation is a violation; the same inside t() is fine", () => {
  const bad = js("const a = `<span>Last time (${d}): <b>${x}</b></span>`;");
  assert.equal(bad.violations.length, 1);
  assert.match(bad.violations[0].why, /interpolated text/);
  const good = js('const a = `<span>${t("Last time ({d})",{d})}</span>`;');
  assert.deepEqual(good.violations, []);
  assert.deepEqual(good.labels, ["Last time ({d})"]);
});

test("attributes: aria-label, placeholder, title, alt", () => {
  const r = html('<input placeholder="Search" aria-label="Weight" title="Tip" alt="Pic" aria-label2="x">');
  assert.deepEqual(r.labels.sort(), ["Pic", "Search", "Tip", "Weight"]);
  assert.deepEqual(js('const a = `<i aria-label="${esc(n)}"></i>`;').labels, []);
  assert.equal(js('const a = `<i aria-label="Remove ${esc(n)}"></i>`;').violations.length, 1);
});

test("toast / setSync / add messages must go through t()", () => {
  assert.equal(js('toast("Saved");').violations.length, 1);
  assert.equal(js("toast(`Saved for ${d}`);").violations.length, 1);
  assert.equal(js('toast("Saved " + x);').violations.length, 1);
  assert.deepEqual(js('toast(t("Saved"));').violations, []);
  assert.deepEqual(js('toast(t("Saved"));').labels, ["Saved"]);
  assert.deepEqual(js("toast(msg);").violations, []);
  assert.equal(js('setSync("Offline");').violations.length, 1);
  assert.equal(js('add("Body","info","Title here",t("ok"));').violations.length, 1);
  assert.deepEqual(js('add("Body","info",t("Title"),t("Text"));').violations, []);
  assert.deepEqual(js("s.add(x); function add(a,b,c,d){}").violations, []);
});

test("tn collects both forms; dynamic keys inside t() are violations", () => {
  assert.deepEqual(js('tn("{n} set","{n} sets",n);').labels.sort(), ["{n} set", "{n} sets"]);
  assert.equal(js("t(`${x} sets`);").violations.length, 1);
  assert.deepEqual(js("t(label);").violations, []);
});

test("nested templates inside interpolations are scanned too", () => {
  const r = js("const a = `<ul>${items.map(i => `<li>Remove</li>`).join(\"\")}</ul>`;");
  assert.deepEqual(r.labels, ["Remove"]);
});

test("symbols, numbers and the allow list are ignored", () => {
  const r = html("<b>×</b><b>–</b><b>·</b><b>✕</b><b>12</b><b>kg</b><b>Iron Log</b>");
  assert.deepEqual(r.labels, []);
  assert.ok(LABEL_ALLOW.has("kg") && LABEL_ALLOW.has("Iron Log"));
});

test("script and style contents, comments and non-markup strings are ignored", () => {
  assert.deepEqual(html("<style>.a{color:red}</style><script>var x = 'Hello there';</script><p>Hi</p>").labels, ["Hi"]);
  assert.deepEqual(js("// <b>Not shown</b>\n/* <b>Nor this</b> */ const x = 1;").labels, []);
  assert.deepEqual(js("const prompt = `You are a coach. Be brief ${x}`;").violations, []);
  assert.deepEqual(js('const re = /[&<>"\']/g; const a = `<i>Real</i>`;').labels, ["Real"]);
});

test("in an HTML file only the part after the module script is JavaScript", () => {
  const src = '<h1>Title</h1><script type="module">toast("Oops"); const a = `<b>Hi</b>`;</script>';
  const r = html(src);
  assert.deepEqual(r.labels.sort(), ["Hi", "Title"]);
  assert.equal(r.violations.length, 1);
});

test("doctype is not text; units next to interpolations are not violations", () => {
  assert.deepEqual(html("<!doctype html><p>Hi</p>").labels, ["Hi"]);
  assert.deepEqual(js("const a = `<span>${w} kg × ${r} · ${m} min</span>`;").violations, []);
  assert.equal(js("const a = `<span>${n} of ${m} done</span>`;").violations.length, 1);
});

test("a message built from a variable plus English text is a violation unless the text is inside t()", () => {
  assert.equal(js('toast(name+" is already in this workout");').violations.length, 1);
  assert.equal(js("toast(`${name} is saved`);").violations.length, 1);
  assert.deepEqual(js('toast(ok ? t("Saved") : t("Not saved"));').violations, []);
  assert.deepEqual(js("toast(e.message);").violations, []);
  assert.deepEqual(js('toast(t("{n} saved",{n:name+"x"}));').violations, []);
});
