import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scanSource } from "../tools/scan-strings.mjs";
import { AR } from "../public/lang-ar.js";

// Sections still being translated (empty now that the whole app is done; new sections must ship translated).
const PENDING = [];

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

test("every section is translated (PENDING is empty)", () => {
  assert.deepEqual(PENDING, []);
});

// ---- names of library things (Task 7) ----
import { ALL_EX, MUSCLES, TEMPLATES } from "../public/exercise-library.js";
import { BADGES } from "../public/achievements.js";
import { CARDIO_TYPES, INTENSITIES } from "../public/energy.js";

const needNames = (kind, list) => {
  const table = AR.names[kind] || {};
  const missing = list.filter(n => !table[n] || !String(table[n]).trim());
  assert.deepEqual(missing, [], `AR.names.${kind} is missing entries`);
};

test("every exercise, muscle, template, day and badge has an Arabic name", () => {
  needNames("ex", ALL_EX);
  needNames("muscle", MUSCLES);
  needNames("template", TEMPLATES.map(t => t.name));
  needNames("tplnote", TEMPLATES.map(t => t.note));
  needNames("day", [...new Set(TEMPLATES.flatMap(t => t.days.map(d => d.name))), "Free workout", "Cardio"]);
  needNames("badge", BADGES.map(b => b.name));
});

test("cardio, intensity, goal, weekday, meal and level names exist", () => {
  const labels = { treadmill: "Treadmill", elliptical: "Elliptical", bike: "Bike", other: "Other" };
  needNames("cardio", [...CARDIO_TYPES.map(c => labels[c]), "Cardio"]);
  needNames("intensity", INTENSITIES.map(i => i[0].toUpperCase() + i.slice(1)));
  needNames("goal", ["Lose fat", "Build muscle", "Lose fat and build muscle", "Get stronger", "Stay in shape"]);
  needNames("weekday", ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  needNames("meal", ["Breakfast", "Lunch", "Dinner", "Snack"]);
  needNames("level", ["Rookie", "Regular", "Committed", "Iron"]);
});

test("Arabic exercise names are unique", () => {
  const v = ALL_EX.map(n => AR.names.ex[n]);
  assert.equal(new Set(v).size, v.length);
});

test("labels kept in index.html constants (body fields, screen titles) have Arabic", () => {
  const src = read("index.html");
  const block = (start, end) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)));
  const labels = [...block("const BF = {", "};").matchAll(/label:"([^"]+)"/g)].map(m => m[1]);
  labels.push(...[...block("const SCREEN_TITLES={", "}").matchAll(/:"([^"]+)"/g)].map(m => m[1]));
  assert.ok(labels.length >= 20, "found the constants");
  assert.deepEqual([...new Set(labels)].filter(l => AR.ui[l] == null), []);
});

import { PRESETS } from "../public/theme-tools.js";
test("accent preset names and the picker labels have Arabic", () => {
  const missing = [...PRESETS.map(p => p.name), "Accent", "Custom"].filter(k => AR.ui[k] == null);
  assert.deepEqual(missing, []);
});

import { EQUIPMENT } from "../public/exercise-library.js";
test("every equipment item has a unique Arabic name", () => {
  const names = EQUIPMENT.map(e => (AR.names.equipment || {})[e.id]);
  assert.deepEqual(EQUIPMENT.filter((e, i) => !names[i] || !String(names[i]).trim()).map(e => e.id), []);
  assert.equal(new Set(names).size, names.length);
});
