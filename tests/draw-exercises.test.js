import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DRAWINGS } from "../tools/draw-exercises.mjs";
import { INFO } from "../public/exercise-info.js";
import { slugify } from "../tools/svg-tools.mjs";

test("hand-drawn figures: 14 exercises, start and finish, plain theme-aware SVG only", () => {
  assert.equal(Object.keys(DRAWINGS).length, 14);
  for (const [slug, d] of Object.entries(DRAWINGS)) for (const k of ["start", "end"]) {
    const s = d[k];
    assert.match(s, /^<svg viewBox="0 0 216 300" xmlns="http:\/\/www\.w3\.org\/2000\/svg">/, `${slug} ${k}`);
    assert.ok(s.endsWith("</svg>"), `${slug} ${k}`);
    assert.ok(!/<script|\son\w+=|style=|href=|#[0-9a-f]{3,6}\b|rgb\(/i.test(s), `${slug} ${k}: only currentColor and exbg classes allowed`);
    assert.ok(!s.includes("NaN") && !s.includes("undefined"), `${slug} ${k}: bad number`);
  }
});

test("every hand-drawn figure belongs to a library exercise marked own, with files on disk", () => {
  const own = Object.values(INFO).filter(e => e.own);
  assert.deepEqual(own.map(e => slugify(e.name)).sort(), Object.keys(DRAWINGS).sort());
  for (const e of own) for (const k of ["start", "end"]) {
    assert.equal(readFileSync(new URL(`../public/exercises/${e.slug}-${k}.svg`, import.meta.url), "utf8").trim(), DRAWINGS[e.slug][k], `${e.slug}-${k}.svg is stale: run node tools/import-exercises.mjs`);
  }
});
