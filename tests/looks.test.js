import { test } from "node:test";
import assert from "node:assert/strict";
import { LOOKS, cleanLook, suggestLook, accentPresetsFor, defaultAccentFor, envFor, LOOK_ENV } from "../public/looks.js";
import { deriveAccent, contrast, parseHex } from "../public/theme-tools.js";

test("cleanLook keeps the three look ids and turns anything else into classic", () => {
  for (const l of LOOKS) assert.equal(cleanLook(l), l);
  for (const bad of [undefined, null, "", "Carbon ", "CARBON", {}, [], 5, "__proto__", "constructor"]) assert.equal(cleanLook(bad), "classic");
});

test("suggestLook suggests from the sex entered and nothing otherwise", () => {
  assert.equal(suggestLook("male"), "carbon");
  assert.equal(suggestLook("female"), "bloom");
  for (const v of [undefined, null, "", "other", "Male", 3]) assert.equal(suggestLook(v), null);
});

test("carbon and bloom each have six unique valid accent presets", () => {
  for (const look of ["carbon", "bloom"]) {
    const list = accentPresetsFor(look);
    assert.equal(list.length, 6, look);
    assert.equal(new Set(list.map(p => p.id)).size, 6, look);
    for (const p of list) assert.ok(parseHex(p.hex), look + " " + p.id);
  }
  assert.equal(accentPresetsFor("classic").length, 8);
  assert.equal(accentPresetsFor("nope").length, 8);
});

test("defaultAccentFor gives plate for classic and the first preset otherwise", () => {
  assert.equal(defaultAccentFor("classic"), "plate");
  assert.equal(defaultAccentFor("carbon"), "#ff7a2f");
  assert.equal(defaultAccentFor("bloom"), "#c2255c");
  assert.equal(defaultAccentFor("zzz"), "plate");
});

test("envFor returns the surface and background of a look for both modes", () => {
  assert.deepEqual(envFor("classic"), { light: { surface: "#ffffff", bg: "#f3f5f9" }, dark: { surface: "#171d26", bg: "#0f1319" } });
  assert.equal(envFor("nope"), LOOK_ENV.classic);
  for (const l of LOOKS) for (const m of ["light", "dark"]) {
    assert.ok(parseHex(envFor(l)[m].surface) && parseHex(envFor(l)[m].bg), l + m);
  }
});

test("every look, mode and accent preset keeps readable contrast", () => {
  for (const look of LOOKS) for (const mode of ["light", "dark"]) {
    const env = envFor(look)[mode];
    for (const p of accentPresetsFor(look)) {
      const d = deriveAccent(p.id && look === "classic" ? p.id : p.hex, mode, env.surface, env.bg);
      assert.ok(contrast(d.accent, env.surface) >= 4.5, `${look} ${mode} ${p.id}: accent on surface`);
      assert.ok(contrast(d.ink, d.accent) >= 4.5, `${look} ${mode} ${p.id}: ink on accent`);
    }
  }
});

import { shouldPickLook, savedLookOf } from "../public/looks.js";

test("savedLookOf returns a stored look id and null for nothing or junk", () => {
  for (const l of LOOKS) assert.equal(savedLookOf(l), l);
  for (const bad of [null, undefined, "", "x", "CARBON", 3, {}]) assert.equal(savedLookOf(bad), null);
});

test("shouldPickLook: only a signed-in, synced person with no data, no saved look and not shown yet", () => {
  const base = { authed: true, synced: true, days: [], workouts: [], savedLook: null, shown: false };
  assert.equal(shouldPickLook(base), true);
  for (const [k, v] of [["authed", false], ["synced", false], ["days", [{ id: "d" }]], ["workouts", [{ id: "w" }]], ["savedLook", "carbon"], ["savedLook", "classic"], ["shown", true], ["days", null], ["workouts", undefined]]) {
    assert.equal(shouldPickLook({ ...base, [k]: v }), false, k + "=" + JSON.stringify(v));
  }
});
