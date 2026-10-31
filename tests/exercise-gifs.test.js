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

test("the exercises with no good picture in the dataset keep their drawings (null)", () => {
  for (const n of ["Pec Deck", "Reverse Pec Deck", "Skull Crusher", "Dumbbell Skull Crusher", "Hip Thrust", "Dumbbell Hip Thrust", "Glute Kickback Machine", "Plank", "Ab Wheel Rollout"]) assert.equal(GIFS[n], null, n);
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

test("no two exercises share one picture (a wrong or duplicated picture is worse than none)", () => {
  const seen = new Map();
  for (const [name, id] of Object.entries(GIFS)) if (id) { assert.ok(!seen.has(id), `${name} and ${seen.get(id)} both use ${id}`); seen.set(id, name); }
});

test("pictures the final review found to be the wrong movement stay off until checked by hand", () => {
  for (const n of ["Cable Hip Abduction", "Seated Leg Curl", "Single-leg Leg Press", "Dumbbell Floor Press", "Close-grip Pulldown", "Rope Hammer Curl", "Underhand Barbell Row", "Dumbbell Sumo Squat", "High Cable Curl", "Leg Press"]) assert.equal(GIFS[n], null, n);
});
