import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLayout, buildCtx, SCREENS } from "../public/looks/layout.js";
import { t, tn } from "../public/i18n.js";

const acts = html => new Set([...String(html).matchAll(/data-act="([^"]+)"/g)].map(m => m[1]));

// A card whose every named part carries its own marker act, so a builder that drops or duplicates a part is caught.
const PARTS = ["nameHtml", "tagsHtml", "demoHtml", "avoidHtml", "targetHtml", "kindHtml", "tableHtml", "plannedHtml", "bwHtml", "weightHtml", "repsHtml", "actionHtml", "lastHtml", "removeHtml", "doneHtml"];
const workoutCtx = (over = {}) => ({ ...Object.fromEntries(PARTS.map(p => [p, `<i data-act="mark-${p}">${p}</i>`])), ...over });
const todayCtx = (over = {}) => ({
  hasDays: true, switching: false, scheduled: true, isToday: true,
  week: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].map((label, i) => ({ iso: "2026-10-" + (31 - 0 + i), label, num: i + 1, today: i === 0, selected: i === 0, planned: i % 2 === 0 })),
  days: [{ id: "d1", n: 1, name: "Push Day", count: 6, last: "Fri, Oct 30", next: true, focus: ["Chest", "Triceps"] }, { id: "d2", n: 2, name: "Pull", count: 5, last: "", next: false, focus: [] }],
  next: { id: "d1", n: 1, name: "Push Day", count: 6, last: "Fri, Oct 30", next: true, focus: ["Chest", "Triceps"] },
  heroHtml: '<i data-act="hero-go">hero</i>', deloadHtml: '<i data-act="deload-start">d</i>', hintHtml: "", journeyHtml: '<i data-act="journey-open">j</i>', dateHtml: '<input id="log-date">',
  dayPickerHtml: '<i data-act="classic-picker">picker</i>', cardioHtml: '<i data-act="open-cardiosheet">c</i>', foodHtml: '<i data-act="open-mealsheet">f</i>', ...over
});

for (const look of ["carbon", "bloom"]) {
  test(`${look}: the builders it defines are named in SCREENS and are functions`, async () => {
    const L = await loadLayout(look);
    assert.ok(Object.keys(L).length >= 2);
    for (const [name, fn] of Object.entries(L)) { assert.ok(SCREENS.includes(name), name); assert.equal(typeof fn, "function"); }
  });

  test(`${look}: the workout card keeps every part and so every data-act of the Classic card`, async () => {
    const L = await loadLayout(look), html = L.workout(buildCtx({ ...workoutCtx(), t, tn }));
    for (const p of PARTS) assert.equal(html.split(`data-act="mark-${p}"`).length - 1, 1, `${look} ${p} appears exactly once`);
    assert.match(html, /id="open-card"/);
  });

  test(`${look}: an exercise without a demo draws no empty box and no banner`, async () => {
    const L = await loadLayout(look), html = L.workout(buildCtx({ ...workoutCtx({ demoHtml: "" }), t, tn }));
    assert.ok(!html.includes("lk-banner"));
    assert.ok(!html.includes("mark-demoHtml"));
  });

  test(`${look}: today shows Start for the next day, Free workout, the other days and every fragment`, async () => {
    const L = await loadLayout(look), html = L.today(buildCtx({ ...todayCtx(), t, tn }));
    const a = acts(html);
    for (const need of ["start-day", "start-free", "hero-go", "deload-start", "journey-open", "open-cardiosheet", "open-mealsheet"]) assert.ok(a.has(need), need);
    assert.ok(!a.has("classic-picker"), "the Classic picker is only the fallback");
    assert.match(html, /data-id="d1"/);
    assert.match(html, /data-id="d2"/);
    assert.match(html, /id="log-date"/);
    assert.equal((html.match(/class="lk-wd/g) || []).length, 7);
  });

  test(`${look}: with no days, or while switching day, today falls back to the Classic picker`, async () => {
    const L = await loadLayout(look);
    for (const over of [{ hasDays: false, next: null, days: [] }, { switching: true }]) {
      const html = L.today(buildCtx({ ...todayCtx(over), t, tn }));
      assert.ok(acts(html).has("classic-picker"), JSON.stringify(over));
    }
  });

  test(`${look}: a long or hostile day name is escaped and clamped, never raw HTML`, async () => {
    const L = await loadLayout(look), name = '<img src=x onerror=1>' + "Very long day name ".repeat(5);
    const html = L.today(buildCtx({ ...todayCtx({ next: { id: 'a"b', n: 1, name, count: 1, last: "", next: true, focus: ["<b>x</b>"] }, days: [{ id: 'a"b', n: 1, name, count: 1, last: "", next: true, focus: [] }] }), t, tn }));
    assert.ok(!html.includes("<img"), "name escaped");
    assert.ok(!html.includes("<b>x</b>"), "muscle escaped");
    assert.ok(!html.includes('data-id="a"b"'), "id escaped");
  });
}

test("carbon puts the day to train before the level card, bloom after it", async () => {
  const c = buildCtx({ ...todayCtx(), t, tn }), C = await loadLayout("carbon"), B = await loadLayout("bloom");
  const pos = (html, s) => html.indexOf(s);
  const ch = C.today(c), bh = B.today(c);
  assert.ok(pos(ch, 'data-act="start-day"') < pos(ch, 'data-act="hero-go"'));
  assert.ok(pos(bh, 'data-act="hero-go"') < pos(bh, 'data-act="start-day"'));
});

test("carbon: the demo is a wide banner above the name, like Bloom, whatever the Large demo setting", async () => {
  const C = await loadLayout("carbon");
  for (const full of [true, false]) {
    const html = C.workout(buildCtx({ ...workoutCtx({ demoHtml: '<div class="demo" data-name="x"></div>' }), full, t, tn }));
    assert.ok(html.indexOf('class="lk-banner"') >= 0 && html.indexOf('class="lk-banner"') < html.indexOf("mark-nameHtml"), "the banner comes before the name");
    assert.equal((html.match(/class="demo"/g) || []).length, 1);
  }
});
