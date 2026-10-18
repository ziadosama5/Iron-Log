import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../public/index.html", import.meta.url), "utf8").split("<style>")[1].split("</style>")[0];
const rules = css.split("}").map(r => r.trim()).filter(Boolean);

test("states that mean good / warning / info / bar level never take the accent colour", () => {
  const toneRules = rules.filter(r => /^\.insight\.(good|warn|info)|^\.insight\.\w+\{|\.bars \.fill/.test(r) || /\.insight\.(good|warn|info)\{/.test(r));
  assert.ok(toneRules.length >= 3, "found the tone rules");
  for (const r of toneRules) assert.ok(!r.includes("var(--accent"), `accent used for a state colour: ${r}`);
});
