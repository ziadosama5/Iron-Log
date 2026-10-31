import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { DEMO_BASE } from "../public/exercise-gifs.js";

const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const shell = sw.slice(sw.indexOf("const APP_SHELL = ["), sw.indexOf("];", sw.indexOf("const APP_SHELL = [")));

test("the service worker has a new version and caches the new files", () => {
  assert.match(sw, /const VERSION = "iron-log-v48"/);
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
