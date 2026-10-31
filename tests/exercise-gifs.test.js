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
