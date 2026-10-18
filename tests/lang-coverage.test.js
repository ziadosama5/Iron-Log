import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scanSource } from "../tools/scan-strings.mjs";
import { AR } from "../public/lang-ar.js";

// Sections still being translated. Tasks 5-7 of docs/superpowers/plans/2026-10-18-arabic-language.md
// remove names from this list; it must end up empty.
const PENDING = [
  "derived", "BODY", "COACH", "GOALS",
  "SCREEN WAKE LOCK", "THEME"
];

const read = f => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const MARK = '<script type="module">';

function sectionsOfIndex() {
  const src = read("index.html"), mi = src.indexOf(MARK), from = mi + MARK.length, to = src.lastIndexOf("</script>");
  const out = [{ name: "static", text: src.slice(0, mi), kind: "html", firstLine: 1 }];
  const js = src.slice(from, to), re = /\/\* -{8,} ([^\n]*?) -{8,} \*\//g;
  const cuts = [{ name: "start", at: 0 }];
  for (let m; (m = re.exec(js)); ) cuts.push({ name: m[1].split(/[:(]/)[0].trim(), at: m.index });
  const baseLine = src.slice(0, from).split("\n").length;
  cuts.forEach((c, i) => {
    const text = js.slice(c.at, i + 1 < cuts.length ? cuts[i + 1].at : js.length);
    out.push({ name: c.name, text, kind: "js", firstLine: baseLine + js.slice(0, c.at).split("\n").length - 1 });
  });
  return out;
}

const sections = [
  ...sectionsOfIndex(),
  ...["achievements.js", "energy.js", "workout-tools.js"].map(f => ({ name: f, text: read(f), kind: "js", firstLine: 1 }))
];

const placeholders = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",");

test("PENDING only lists real sections", () => {
  const names = new Set(sections.map(s => s.name));
  for (const p of PENDING) assert.ok(names.has(p), `unknown section in PENDING: ${p}`);
});

test("every finished section has no untranslated or glued English text and an Arabic entry for each label", () => {
  const problems = [];
  for (const sec of sections) {
    if (PENDING.includes(sec.name)) continue;
    const r = scanSource(sec.text, { kind: sec.kind });
    for (const v of r.violations) problems.push(`${sec.name} (line ~${sec.firstLine + v.line - 1}): ${v.why}: ${v.text}`);
    for (const l of r.labels) if (AR.ui[l] == null) problems.push(`${sec.name}: no Arabic for "${l}"`);
  }
  assert.deepEqual(problems, []);
});

test("Arabic entries keep the same {placeholders} as their English key and are not empty", () => {
  for (const [k, v] of Object.entries(AR.ui)) {
    assert.ok(String(v).trim().length > 0, `empty Arabic for "${k}"`);
    assert.equal(placeholders(v), placeholders(k), `placeholders differ for "${k}"`);
  }
});

test("translation is finished when I18N_DONE=1", { skip: process.env.I18N_DONE !== "1" }, () => {
  assert.deepEqual(PENDING, []);
});
