import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { DEMO_BASE } from "../public/exercise-gifs.js";

const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const shell = sw.slice(sw.indexOf("const APP_SHELL = ["), sw.indexOf("];", sw.indexOf("const APP_SHELL = [")));

test("the service worker has a new version and caches the new files", () => {
  const v = Number(/const VERSION = "iron-log-v(\d+)"/.exec(sw)?.[1]);
  assert.ok(v >= 48, "the service worker version was bumped for sub-project 25 (v" + v + ")");
  for (const f of ["/looks.js", "/looks.css", "/exercise-gifs.js"]) assert.ok(shell.includes(`"${f}"`), f + " is in APP_SHELL");
});

test("every file in APP_SHELL exists in public/ (except the root and Firebase URLs)", () => {
  for (const m of shell.matchAll(/"(\/[^"]*)"/g)) {
    const p = m[1]; if (p === "/") continue;
    assert.ok(existsSync(new URL("../public" + p, import.meta.url)), p);
  }
});

test("the demo host in the service worker is the one exercise-gifs.js uses, and its caches survive a version bump", () => {
  assert.ok(sw.includes(`const DEMO_BASE = "${DEMO_BASE}"`), "same pinned base URL");
  assert.ok(sw.includes('"ironlog-demo"') && sw.includes('"ironlog-demo-all"'));
  assert.match(sw, /startsWith\("ironlog-demo"\)/, "activate keeps the demo caches");
});

test("the demo handler does nothing when there is no base URL, and Remove clears both demo caches", () => {
  assert.match(sw, /DEMO_BASE && req\.url\.startsWith\(DEMO_BASE\)/, "an empty base must not match every request");
  assert.ok(sw.includes("caches.delete(DEMO_ALL)") && sw.includes("caches.delete(DEMO_CACHE)"), "demo-clear deletes both");
});

test("demo-status counts only the pictures the page still wants and drops the rest", () => {
  assert.match(sw, /d\.type === "demo-status"[\s\S]*?d\.urls/, "status receives the current URL list");
  assert.ok(sw.includes("stale"), "keys outside the list are removed");
});

test("library expansion: the eager catalog files are in the shell, the lazy How-to is not, and the eager size stays small", async () => {
  for (const f of ["/exercise-catalog.js", "/lang-ar-catalog.js", "/injuries-catalog.js", "/exercise-search.js"]) assert.ok(shell.includes(`"${f}"`), f + " is in APP_SHELL");
  assert.ok(!shell.includes("exercise-howto"), "the How-to file is fetched on demand, not at install");
  const { statSync } = await import("node:fs");
  const bytes = f => statSync(new URL("../public/" + f, import.meta.url)).size;
  const eager = bytes("exercise-catalog.js") + bytes("lang-ar-catalog.js") + bytes("injuries-catalog.js");
  assert.ok(eager <= 330 * 1024, "eager catalog files: " + Math.round(eager / 1024) + " KB (limit 330 KB)");
});

test("the look modules and stylesheets are in the shell, so a Carbon or Bloom user still gets their layout offline after an update", () => {
  for (const f of ["/looks/layout.js", "/looks/carbon.js", "/looks/bloom.js", "/looks/today-parts.js", "/looks-carbon.css", "/looks-bloom.css"]) assert.ok(shell.includes(`"${f}"`), f + " is in APP_SHELL");
});
