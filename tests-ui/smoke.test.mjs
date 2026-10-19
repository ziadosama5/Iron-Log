// UI smoke tests: the real page (public/index.html) with stubbed Firebase (tools/screenshot-harness), driven by Edge/Chrome.
// Not part of `npm test`. Run: cd tests-ui && npm install && npm test   (needs Microsoft Edge or Chrome installed)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5083, BASE = `http://localhost:${PORT}/`;
let server, browser;

before(async () => {
  server = spawn(process.execPath, [path.join(root, "tools/screenshot-harness/run.cjs"), path.join(root, "public"), path.join(root, "tools/screenshot-harness"), String(PORT)], { stdio: "ignore" });
  await new Promise(r => setTimeout(r, 1500));
  const channel = process.env.UI_BROWSER || "msedge";
  browser = await chromium.launch({ channel, headless: true });
});
after(async () => { await browser?.close(); server?.kill(); });

async function open(query = "", viewport = { width: 420, height: 860 }) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(BASE + "?friends=1&ch=1&mine=1&" + query);
  await page.waitForSelector(".tabbar:not([hidden])");
  await page.waitForTimeout(900);
  return { page, ctx, errors };
}
const title = page => page.locator("#screen-title").textContent();
const current = page => page.locator('.tabbar button[aria-current="page"]').getAttribute("data-tab");
const tab = (page, id) => page.locator(`.tabbar [data-tab="${id}"]`).click();
const swipe = (page, from, to) => page.evaluate(([a, b]) => {
  const tg = document.querySelector("main h2, main .card, main") || document.body;
  const mk = (type, x, y) => { const t = new Touch({ identifier: 1, target: tg, clientX: x, clientY: y }); tg.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === "touchend" ? [] : [t], changedTouches: [t] })); };
  mk("touchstart", a, 300); mk("touchend", b, 310);
}, [from, to]);

test("signs in and shows Today with five tabs and no script errors", async () => {
  const { page, ctx, errors } = await open();
  assert.equal(await page.locator(".tabbar button").count(), 5);
  assert.equal(await current(page), "today");
  assert.equal(await title(page), "Today");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("every tab opens its first section and shows its pills", async () => {
  const { page, ctx, errors } = await open();
  const expect = { plan: ["Days", "My Gym"], progress: ["Body", "Lifts", "Goals", "Coach", "History"], friends: ["Friends", "Challenges", "Find"], me: [], today: [] };
  for (const [id, pills] of Object.entries(expect)) {
    await tab(page, id);
    assert.equal(await current(page), id);
    const got = await page.locator("#pills .pill").allInnerTexts();
    assert.deepEqual(got.map(s => s.replace(/\d+$/, "").trim()), pills, id);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("Back from another tab returns to Today, Back from Today stays in the app's history", async () => {
  const { page, ctx } = await open();
  await tab(page, "progress");
  await tab(page, "friends");
  await page.goBack();
  await page.waitForTimeout(200);
  assert.equal(await current(page), "today");
  await ctx.close();
});

test("tapping Today after another tab does not leave an extra history entry", async () => {
  const { page, ctx } = await open();
  const before = await page.evaluate(() => history.length);
  await tab(page, "plan");
  await tab(page, "today");
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => history.length), before + 1);   // the pushed entry stays in the list but we are back on it
  assert.equal(await current(page), "today");
  await ctx.close();
});

test("swipe left/right moves between tabs; the first tab ignores a swipe to the right", async () => {
  const { page, ctx } = await open();
  await swipe(page, 300, 100); await page.waitForTimeout(150);
  assert.equal(await current(page), "plan");
  await swipe(page, 300, 100); await page.waitForTimeout(150);
  assert.equal(await current(page), "progress");
  await swipe(page, 100, 300); await page.waitForTimeout(150);
  assert.equal(await current(page), "plan");
  await swipe(page, 100, 300); await page.waitForTimeout(150);
  assert.equal(await current(page), "today");
  await swipe(page, 100, 300); await page.waitForTimeout(150);
  assert.equal(await current(page), "today");
  await swipe(page, 12, 250); await page.waitForTimeout(150);          // starts at the screen edge: ignored
  assert.equal(await current(page), "today");
  await ctx.close();
});

test("Arabic switches to right-to-left and mirrors the swipe", async () => {
  const { page, ctx } = await open("lang=ar");
  assert.equal(await page.evaluate(() => document.documentElement.dir), "rtl");
  await swipe(page, 100, 300); await page.waitForTimeout(150);          // swipe right = next in Arabic
  assert.equal(await current(page), "plan");
  await ctx.close();
});

test("all badges page lists 24 badges and goes back", async () => {
  const { page, ctx } = await open();
  await tab(page, "progress");
  await page.locator('.pill[data-view="goals"]').click();
  await page.locator('[data-act="badges-all"]').click();
  assert.equal(await page.locator("#view-goals .brow").count(), 24);
  await page.locator('[data-act="badges-back"]').click();
  assert.equal(await page.locator("#view-goals .tile").count(), 9);
  await ctx.close();
});

test("week strip: a tapped weekday can be made a rest day", async () => {
  const { page, ctx } = await open();
  await tab(page, "plan");
  await page.locator('[data-act="wd-pick"][data-wd="2"]').click();
  await page.locator('[data-act="wd-set"][data-id=""]').click();
  assert.equal((await page.locator('[data-act="wd-pick"][data-wd="2"] .wdn').innerText()).trim(), "Rest");
  await ctx.close();
});

test("adding a meal on Today shows it in the list", async () => {
  const { page, ctx } = await open();
  await page.locator("#meal-kcal").fill("450");
  await page.locator("#meal-form button[type=submit]").click();
  await page.waitForTimeout(300);
  assert.ok((await page.locator("#view-log .cardio-list").innerText()).includes("450 kcal"));
  await ctx.close();
});

test("controls meet the 44px touch target and text is at least 12px", async () => {
  const { page, ctx } = await open();
  await tab(page, "plan");
  const small = await page.evaluate(() => [...document.querySelectorAll("#view-days .btn, #view-days button.chip, .pill, .tabbar button")].filter(e => e.offsetParent).map(e => [e.textContent.trim().slice(0, 20), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44));
  assert.deepEqual(small, []);
  const tiny = await page.evaluate(() => [...document.querySelectorAll("main *, .tabbar *")].filter(e => e.children.length === 0 && e.textContent.trim() && e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 12).map(e => e.className || e.tagName).slice(0, 5));
  assert.deepEqual(tiny, []);
  await ctx.close();
});
