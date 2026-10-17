import { test } from "node:test";
import assert from "node:assert/strict";
import { recolorSvg, slugify } from "../tools/svg-tools.mjs";

const SRC = '<?xml version="1.0"?><!-- c --><svg width="268pt" height="275pt" viewBox="0 0 268 275" xmlns="http://www.w3.org/2000/svg"><g fill="#FFF"><path d="M0 0h1"/></g><g fill="#333"><path d="M1 1h1"/></g></svg>';

test("recolorSvg maps line and background fills", () => {
  const out = recolorSvg(SRC);
  assert.match(out, /fill="currentColor"/);
  assert.match(out, /fill="var\(--ex-bg\)"/);
  assert.doesNotMatch(out, /#333|#FFF/i);
});

test("recolorSvg accepts other near-black and white spellings", () => {
  for (const c of ["#2e2e2c", "#40413F", "#333333", "#000"]) assert.match(recolorSvg(SRC.replace("#333", c)), /currentColor/, c);
  for (const c of ["#ffffff", "white", "#FfF"]) assert.match(recolorSvg(SRC.replace("#FFF", c)), /var\(--ex-bg\)/, c);
});

test("recolorSvg drops width/height, keeps viewBox, strips prolog and comments", () => {
  const out = recolorSvg(SRC);
  assert.ok(out.startsWith("<svg"));
  assert.doesNotMatch(out, /\swidth=|\sheight=|<!--|<\?xml/);
  assert.match(out, /viewBox="0 0 268 275"/);
});

test("recolorSvg throws on unexpected fill", () =>
  assert.throws(() => recolorSvg(SRC.replace("#333", "#ff0000"), "0042-tension"), /0042-tension.*#ff0000/));

test("recolorSvg throws on fills hidden in style attributes", () =>
  assert.throws(() => recolorSvg(SRC.replace('<path d="M1 1h1"/>', '<path style="fill:#333" d="M1 1h1"/>'), "x"), /style/));

test("slugify", () => {
  assert.equal(slugify("Close-grip Bench Press"), "close-grip-bench-press");
  assert.equal(slugify("Hamstrings & Glutes"), "hamstrings-glutes");
  assert.equal(slugify("  Push-up "), "push-up");
});
