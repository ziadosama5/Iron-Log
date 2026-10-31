import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_EX } from "../public/exercise-library.js";
import { DEMO_BASE, GIFS, gifUrl, stillUrl, gifUrls } from "../public/exercise-gifs.js";

test("every library exercise has a GIF id or an explicit null", () => {
  for (const name of ALL_EX) {
    assert.ok(Object.prototype.hasOwnProperty.call(GIFS, name), name + " is missing from tools/exercise-gifs.json");
    assert.ok(GIFS[name] === null || typeof GIFS[name] === "string", name);
  }
});

test("mapped ids look like dataset file ids", () => {
  for (const [name, id] of Object.entries(GIFS)) if (id !== null) assert.match(id, /^\d{4}-[A-Za-z0-9_-]+$/, name);
});

test("gifUrl and stillUrl build the pinned URLs and stay null for unknown names", () => {
  const name = ALL_EX.find(n => GIFS[n]);
  assert.ok(name, "at least one exercise has a GIF");
  assert.equal(gifUrl(name), DEMO_BASE + "videos/" + GIFS[name] + ".gif");
  assert.equal(stillUrl(name), DEMO_BASE + "images/" + GIFS[name] + ".jpg");
  assert.match(DEMO_BASE, /exercises-dataset@[0-9a-f]{40}\/$/);
  for (const bad of ["constructor", "__proto__", "toString", "My Custom Lift", "", undefined, null, 7]) {
    assert.equal(gifUrl(bad), null, String(bad));
    assert.equal(stillUrl(bad), null, String(bad));
  }
});

test("gifUrls lists each mapped GIF once", () => {
  const urls = gifUrls();
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every(u => u.startsWith(DEMO_BASE + "videos/") && u.endsWith(".gif")));
});


import { makeGifs, stillUrls } from "../public/exercise-gifs.js";

test("the kill switch: with no base URL there are no GIFs, stills or downloads at all", () => {
  const off = makeGifs("", GIFS), off2 = makeGifs(null, GIFS);
  for (const g of [off, off2]) {
    assert.equal(g.gifUrl("Bench Press"), null);
    assert.equal(g.stillUrl("Bench Press"), null);
    assert.deepEqual(g.gifUrls(), []);
    assert.deepEqual(g.stillUrls(), []);
  }
  const on = makeGifs("https://x.test/", { A: "0001-abc", B: null });
  assert.equal(on.gifUrl("A"), "https://x.test/videos/0001-abc.gif");
  assert.equal(on.stillUrl("A"), "https://x.test/images/0001-abc.jpg");
  assert.deepEqual(on.stillUrls(), ["https://x.test/images/0001-abc.jpg"]);
});

test("stillUrls mirrors gifUrls one to one", () => {
  assert.equal(stillUrls().length, gifUrls().length);
  assert.ok(stillUrls().every(u => u.startsWith(DEMO_BASE + "images/") && u.endsWith(".jpg")));
});

import { readFileSync } from "node:fs";
const HAND = JSON.parse(readFileSync(new URL("../tools/gif-overrides.json", import.meta.url), "utf8"));

test("two exercises share one picture only when a person hand-picked one of them (tools/gif-overrides.json)", () => {
  const seen = new Map();
  for (const [name, id] of Object.entries(GIFS)) if (id) {
    if (seen.has(id)) assert.ok(name in HAND || seen.get(id) in HAND, `${name} and ${seen.get(id)} both use ${id} without a hand pick`);
    seen.set(id, name);
  }
});

test("every hand pick is in the picture map, and the exercises with no picture in the dataset stay null", () => {
  for (const [name, id] of Object.entries(HAND)) assert.equal(GIFS[name], id, name);
  for (const n of ["Box Squat", "Single-leg Leg Press", "Kettlebell Deadlift", "Glute Kickback Machine", "Cable Hip Abduction", "Donkey Kick", "Cable Woodchop"]) assert.equal(GIFS[n], null, n);
});

test("almost every exercise has a picture, and none uses a movement the final review found to be wrong", () => {
  assert.ok(Object.values(GIFS).filter(Boolean).length >= 170, "pictures: " + Object.values(GIFS).filter(Boolean).length);
  const wrong = { "Cable Hip Abduction": "0168-hBGWILP", "Seated Leg Curl": "0689-Hgs6Nl1", "Single-leg Leg Press": "1756-gEyURal", "Dumbbell Floor Press": "2137-Xy4jlWA", "Close-grip Pulldown": "1327-VnfUNW7", "Rope Hammer Curl": "0636-o1ntciW", "Underhand Barbell Row": "0049-dmgMp3n", "Dumbbell Sumo Squat": "0291-mnzcrIB", "High Cable Curl": "1631-NvfE43H", "Leg Press": "0760-7zdxRTl" };
  for (const [n, id] of Object.entries(wrong)) assert.notEqual(GIFS[n], id, n);
});
