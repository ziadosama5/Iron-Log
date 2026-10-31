import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadLayout, buildCtx } from "../public/looks/layout.js";
import { t, tn } from "../public/i18n.js";

const read = f => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const index = read("index.html"), css = read("looks.css"), carbonCss = read("looks-carbon.css"), bloomCss = read("looks-bloom.css");
const fn = (src, name) => { const a = src.indexOf("function " + name + "("); assert.ok(a >= 0, name); const b = src.indexOf("\nfunction ", a + 10); return src.slice(a, b < 0 ? undefined : b); };

// A part is a named HTML fragment with its own marker act; every builder must draw each part exactly once.
const mk = names => Object.fromEntries(names.map(n => [n, `<i data-act="mark-${n}">${n}</i>`]));
const once = (html, names, label) => { for (const n of names) assert.equal(html.split(`data-act="mark-${n}"`).length - 1, 1, `${label}: ${n} appears exactly once`); };

const BUILDERS = {
  "plan.dayCard": { parts: ["listHtml", "trainHtml"], ctx: { id: "d1", name: "Push", wds: ["Sat"], focus: ["Chest"], exCount: 3, next: true } },
  "progress.overview": { parts: ["statsHtml", "yearHtml", "weightHtml", "trainingHtml", "caloriesHtml", "strengthHtml"], ctx: { stats: { weight: "86", change: "−1", thisWeek: 2, target: 3, streak: 4 } } },
  "progress.goals": { parts: ["targetHtml", "streaksHtml", "badgesHtml"], ctx: {} },
  "progress.body": { parts: ["quickHtml", "profileHtml", "entryHtml", "trendHtml", "recentHtml"], ctx: {} },
  "friends.board": { parts: ["requestsHtml", "boardHtml", "friendsHtml", "manageHtml"], ctx: {} },
  "progress.history": { parts: ["summaryHtml", "moreHtml", "backupHtml"], ctx: { items: [{ date: "2026-10-30", dateLabel: "30 Oct", name: "Push", summaryHtml: "<i data-act=\"mark-item\">x</i>", chipsHtml: "<div class=\"chips\"></div>", deleteHtml: "<button data-act=\"ask-del\">d</button>" }] } },
  "friends.page": { parts: ["headHtml", "bodyHtml", "duoHtml", "tableHtml", "actionsHtml", "reportHtml"], ctx: {} },
  "challenges.list": { parts: ["headHtml", "emptyHtml", "invHtml", "actHtml", "finHtml", "oldHtml"], ctx: {} },
  "plan.gym": { parts: ["introHtml", "injuriesHtml", "endHtml"], ctx: { groups: [{ id: "w", label: "Weights", items: [{ id: "barbell", label: "Barbell", on: true }] }], count: "1 of 53 items" } }
};
for (const look of ["carbon", "bloom"]) for (const [name, b] of Object.entries(BUILDERS)) {
  test(`${look}: ${name} draws every part of the Classic screen exactly once`, async () => {
    const L = await loadLayout(look), html = L[name](buildCtx({ ...mk(b.parts), ...b.ctx, t, tn }));
    // Bloom rebuilds the four plain numbers from the data (they carry no action), so only the action-bearing parts must appear once
    const need = look === "bloom" && name === "progress.overview" ? b.parts.filter(p => p !== "statsHtml") : b.parts;
    once(html, need, `${look} ${name}`);
  });
}
test("my gym: every equipment item stays a gym-toggle button and the count is drawn once", async () => {
  for (const look of ["carbon", "bloom"]) {
    const L = await loadLayout(look), c = { ...mk(BUILDERS["plan.gym"].parts), ...BUILDERS["plan.gym"].ctx, t, tn };
    const html = L["plan.gym"](buildCtx({ ...c, endHtml: "<p>1 of 53 items</p>" }));
    assert.match(html, /data-act="gym-toggle" data-id="barbell" aria-pressed="true"/);
    assert.equal(html.split("1 of 53 items").length - 1, 1, look + ": the count appears once");
  }
});
test("body: the About-you form comes right after the weight, the finished profile line stays last", async () => {
  for (const look of ["carbon", "bloom"]) {
    const L = await loadLayout(look), parts = BUILDERS["progress.body"].parts;
    const form = L["progress.body"](buildCtx({ ...mk(parts), profileIsForm: true, t, tn })), line = L["progress.body"](buildCtx({ ...mk(parts), profileIsForm: false, t, tn }));
    assert.ok(form.indexOf("mark-profileHtml") < form.indexOf("mark-entryHtml"), look + " form first");
    assert.ok(line.indexOf("mark-profileHtml") > line.indexOf("mark-recentHtml"), look + " line last");
  }
});

test("renderBody and renderGym build their parts as variables, not by splitting on a control character", () => {
  for (const name of ["renderBody", "renderGym"]) assert.ok(!/u0001|\x01/.test(fn(index, name)), name + " has no control-character separator");
});
test("a layout loaded late redraws gently and a blocked localStorage cannot strand the layout", () => {
  const act = fn(index, "activateLayout");
  assert.ok(act.includes("renderSoon()") && !/\brender\(\)/.test(act), "activateLayout uses renderSoon");
  assert.ok(act.includes("wantedLook"), "the race check uses a variable, not localStorage");
});
test("the info sheet follows the stop switch and the day's still pictures are warmed with the GIFs", () => {
  assert.ok(fn(index, "openExInfo").includes("demoStill()"), "info sheet");
  assert.ok(fn(index, "warmDemos").includes("stillUrl"), "warmDemos warms stills");
});
test("glass blur is limited to cards, bars, header and sheets (not inner buttons, chips, pills)", () => {
  const rule = css.split("}").find(r => r.includes("backdrop-filter:blur(28px) saturate(180%)") && r.includes(".card")) || "";
  for (const bad of [".pill", ".exchip", ".btn"]) assert.ok(!rule.includes(bad), bad + " has no blur");
});
test("the scroll rows have no always-on fade, and the Carbon first tab keeps its focus ring", () => {
  assert.ok(!/\.exchips[^}]*mask-image/.test(css) && !/\.pills[^}]*mask-image/.test(css));
  assert.match(carbonCss, /\.pills\{[^}]*padding-inline:2px/);
});
test("the tab bar keeps the 616 px column on wide windows", () => {
  for (const c of [carbonCss, bloomCss]) assert.match(c, /\.tabbar\{[^}]*max-width:616px/);
});
test("the advice box rounds its bottom corners only when a why line follows", () => {
  assert.ok(!css.includes(".advice:only-child"));
  assert.match(css, /\.advice:has\(\+ \.advice-why\)/);
});
test("the demo stop button has an RTL corner gap", () => {
  assert.match(index, /\[dir="rtl"\] \.demo-toggle span|:root\[dir="rtl"\] \.demo-toggle span/);
});
