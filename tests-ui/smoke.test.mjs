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
  const expect = { plan: ["Days", "My Gym"], progress: ["Overview", "Body", "Lifts", "Goals", "Coach", "History"], friends: ["Friends", "Challenges", "Find"], me: [], today: [] };
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
  assert.equal(await page.locator("#view-goals .tile").count(), 1);
  assert.equal(await page.locator("#view-goals .hero").count(), 0);
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

test("meal form lives in a sheet; adding a meal closes it and lists the meal", async () => {
  const { page, ctx } = await open();
  assert.equal(await page.locator("#meal-form").count(), 0);
  await page.locator('#view-log [data-act="open-mealsheet"]').first().click();
  await page.waitForSelector("#mealsheet[open]");
  assert.ok(await page.locator("#meal-kcal").evaluate(el => el === document.activeElement));
  await page.locator("#meal-kcal").fill("450");
  await page.locator("#meal-form button[type=submit]").click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#mealsheet[open]").count(), 0);
  assert.ok((await page.locator("#view-log .cardio-list").innerText()).includes("450 kcal"));
  await ctx.close();
});

test("Back closes the meal sheet and keeps a half-typed meal", async () => {
  const { page, ctx } = await open();
  await page.locator('#view-log [data-act="open-mealsheet"]').first().click();
  await page.waitForSelector("#mealsheet[open]");
  await page.locator("#meal-kcal").fill("300");
  await page.goBack();
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#mealsheet[open]").count(), 0);
  assert.equal(await page.title() !== "", true);
  await page.locator('#view-log [data-act="open-mealsheet"]').first().click();
  await page.waitForSelector("#mealsheet[open]");
  assert.equal(await page.locator("#meal-kcal").inputValue(), "300");
  await ctx.close();
});

test("Today without an open workout has no inline cardio form; + Cardio opens it in a sheet", async () => {
  const { page, ctx } = await open();
  assert.equal(await page.locator("#view-log #cardio-min").count(), 0);
  await page.locator('#view-log [data-act="open-cardiosheet"]').first().click();
  await page.waitForSelector("#cardiosheet[open]");
  assert.equal(await page.locator("#cardiosheet #cardio-min").count(), 1);
  await ctx.close();
});

test("the level hero on Today has no Next badge line and opens a badge family", async () => {
  const { page, ctx } = await open();
  assert.ok(!(await page.locator("#view-log .hero").first().innerText()).includes("Next badge"));
  await page.locator("#view-log .hero").first().click();
  await page.waitForSelector("#familysheet[open]");
  await ctx.close();
});

for (const [name, pill, rows, total] of [["Body entries", "body", "#view-body tr[data-bdate]", 6], ["Lifts sessions", "progress", "#view-progress tbody tr", 10], ["History workouts", "history", "#view-history [data-open]", 10]]) {
  test(name + " show 5 rows and Show all reveals the rest", async () => {
    const { page, ctx } = await open();
    await tab(page, "progress");
    await page.locator('.pill[data-view="' + pill + '"]').click();
    assert.equal(await page.locator(rows).count(), 5);
    await page.locator("#view-" + pill + ' [data-act="more-list"]').click();
    assert.equal(await page.locator(rows).count(), total);
    assert.ok((await page.locator("#view-" + pill + ' [data-act="more-list"]').innerText()).includes("Show fewer"));
    await page.locator("#view-" + pill + ' [data-act="more-list"]').click();
    assert.equal(await page.locator(rows).count(), 5);
    await ctx.close();
  });
}

test("Friends: who's ahead strip, avatars, requests banner and a collapsed Manage card", async () => {
  const { page, ctx, errors } = await open();
  await tab(page, "friends");
  assert.ok(await page.locator("#view-friends .podium").count() === 1);
  assert.ok(await page.locator("#view-friends .fcard .avatar").count() >= 1);
  assert.equal(await page.locator('#view-friends .banner [data-act="fr-accept"]').count(), 1);
  assert.equal(await page.locator('#view-friends [data-act="fr-cancel"]').count(), 0);
  assert.equal(await page.locator('#view-friends [data-act="fr-unblock"]').count(), 0);
  await page.locator('#view-friends [data-act="more-list"][data-k="manage"]').click();
  assert.equal(await page.locator('#view-friends [data-act="fr-cancel"]').count(), 1);
  assert.equal(await page.locator('#view-friends [data-act="fr-unblock"]').count(), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("Friends with no friends shows an Invite a friend card that opens Find", async () => {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(BASE + "?mine=1");
  await page.waitForSelector(".tabbar:not([hidden])");
  await page.waitForTimeout(900);
  await tab(page, "friends");
  assert.equal(await page.locator("#view-friends .ahead").count(), 0);
  assert.ok((await page.locator("#view-friends").innerText()).toLowerCase().includes("invite a friend"));
  await page.locator('#view-friends [data-act="pill"][data-view="find"]').click();
  assert.equal(await title(page), "Find a friend");
  await ctx.close();
});

test("the Progress tab opens on the Overview", async () => {
  const { page, ctx, errors } = await open();
  await tab(page, "progress");
  assert.equal(await page.locator("#view-overview").isVisible(), true);
  assert.equal(await title(page), "Overview");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("Overview: headline numbers and four graph cards", async () => {
  const { page, ctx, errors } = await open();
  await tab(page, "progress");
  assert.equal(await page.locator("#view-overview .stats .stat").count(), 4);
  assert.equal(await page.locator("#view-overview .ovcard").count(), 4);
  assert.equal(await page.locator('#view-overview [data-card="weight"] svg.chart').count(), 1);
  assert.equal(await page.locator('#view-overview [data-card="training"] rect.bar').count(), 8);
  assert.equal(await page.locator('#view-overview [data-card="calories"] rect.bar').count(), 5);
  assert.ok(await page.locator('#view-overview [data-card="strength"] li').count() >= 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

for (const [card, expected] of [["weight", "Body"], ["training", "History"], ["calories", "Today"], ["strength", "Lifts"]]) {
  test("Overview: the " + card + " card opens " + expected, async () => {
    const { page, ctx } = await open();
    await tab(page, "progress");
    await page.locator('#view-overview [data-card="' + card + '"] [data-act]').first().click();
    await page.waitForTimeout(200);
    assert.equal(await title(page), expected);
    await ctx.close();
  });
}

test("Overview with no data shows a hint in every card and no errors", async () => {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => localStorage.setItem("ironlog.journey", "skip"));
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(BASE + "?fresh=2");
  await page.waitForSelector(".tabbar:not([hidden])");
  await page.waitForTimeout(900);
  await tab(page, "progress");
  const txt = await page.locator("#view-overview").innerText();
  for (const m of ["Log your weight on two days to see the trend.", "Log a workout to start your weekly chart.", "Add meals on Today to compare with your target.", "Log a few sessions to see your strongest lifts."]) assert.ok(txt.includes(m), m);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("Friends leaderboard: switch, podium with a crown, choice kept after reload", async () => {
  const { page, ctx, errors } = await open();
  await tab(page, "friends");
  assert.equal(await page.locator('#view-friends .seg button').count(), 3);
  assert.equal(await page.locator('#view-friends .seg [data-v="week"]').getAttribute("aria-pressed"), "true");
  assert.ok(await page.locator("#view-friends .podium .crown").count() >= 1);
  for (const b of await page.locator("#view-friends .seg button").all()) assert.ok((await b.boundingBox()).height >= 44, "leaderboard switch is at least 44px");
  await page.locator('#view-friends .seg [data-v="level"]').click();
  assert.equal(await page.locator('#view-friends .seg [data-v="level"]').getAttribute("aria-pressed"), "true");
  assert.ok((await page.locator("#view-friends .podium").innerText()).includes("Level"));
  await page.reload();
  await page.waitForSelector(".tabbar:not([hidden])");
  await page.waitForTimeout(900);
  await tab(page, "friends");
  assert.equal(await page.locator('#view-friends .seg [data-v="level"]').getAttribute("aria-pressed"), "true");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("Challenges podium still shows the crown after the shared podium refactor", async () => {
  const { page, ctx } = await open("go=ch:open");
  await page.waitForSelector("#view-challenges .podium");
  assert.equal(await page.locator("#view-challenges .podium .crown").count(), 1);
  await ctx.close();
});

test("Plan: one Edit plan button opens a sheet with the three actions; Add a day works; Back closes it", async () => {
  const { page, ctx, errors } = await open();
  await tab(page, "plan");
  assert.equal(await page.locator('#view-days [data-act="open-plansheet"]').count(), 1);
  const before = await page.locator("#view-days").innerText();
  for (const s of ["Plan my training", "Add day", "Change split"]) assert.ok(!before.includes(s), s);
  await page.locator('#view-days [data-act="open-plansheet"]').click();
  await page.waitForSelector("#plansheet[open]");
  assert.equal(await page.locator("#plansheet button[data-act]:not([data-act=sheet-close])").count(), 3);
  await page.goBack();
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#plansheet[open]").count(), 0);
  assert.equal(await current(page), "plan");
  const cards = await page.locator("#view-days .card .daysum").count();
  await page.locator('#view-days [data-act="open-plansheet"]').click();
  await page.waitForSelector("#plansheet[open]");
  await page.locator('#plansheet [data-act="add-day"]').click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#plansheet[open]").count(), 0);
  assert.ok(await page.locator("#view-days .card.open").count() === 1);
  assert.ok(cards >= 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("Plan: a day card has one tap target to open the editor and one Train button", async () => {
  const { page, ctx } = await open();
  await tab(page, "plan");
  assert.equal(await page.locator('#view-days button:has-text("Edit day")').count(), 0);
  const first = page.locator("#view-days .card").first();
  assert.equal(await first.locator('[data-act="train-day"]').count(), 1);
  await first.locator(".daysum").click();
  assert.equal(await page.locator("#view-days .card.open").count(), 1);
  await ctx.close();
});

test("Plan: the gym hint is a slim banner that can be closed for good", async () => {
  const { page, ctx } = await open();
  await tab(page, "plan");
  const banner = page.locator("#view-days .notice").first();
  const box = await banner.boundingBox();
  assert.ok(box && box.height < 80, "banner height " + (box && box.height));
  await page.locator('#view-days [data-act="gym-hint-no"]').click();
  assert.equal(await page.locator('#view-days [data-act="gym-hint-no"]').count(), 0);
  await ctx.close();
});

test("Challenge list: icon tiles, status badges, progress and avatar stacks", async () => {
  const { page, ctx, errors } = await open("go=ch:list");
  await page.waitForSelector("#view-challenges .chcard");
  assert.ok(await page.locator("#view-challenges .chcard").count() >= 2);
  assert.equal(await page.locator("#view-challenges .chcard .chicon").count(), await page.locator("#view-challenges .chcard").count());
  const txt = await page.locator("#view-challenges").innerText();
  for (const s of ["Active", "Finished", "Invited"]) assert.ok(txt.toLowerCase().includes(s.toLowerCase()), s);
  assert.ok(await page.locator("#view-challenges .chcard .ebar").count() >= 1);
  assert.ok(await page.locator("#view-challenges .avs .avatar").count() >= 1);
  assert.equal(await page.locator("#view-challenges .chbadge").first().evaluate(e => getComputedStyle(e).position), "static", "status badges sit in the row, not absolutely positioned");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("Open challenge: hero with ring, standing line, medals and an Invited badge", async () => {
  const { page, ctx, errors } = await open("go=ch:open");
  await page.waitForSelector("#view-challenges .podium");
  assert.equal(await page.locator("#view-challenges .chhero .ring").count(), 1);
  assert.ok((await page.locator("#view-challenges .chhero").innerText()).includes("Day 4 of 14"));
  assert.ok(/behind|leading|tied/i.test(await page.locator("#view-challenges .standing").innerText()));
  assert.equal(await page.locator("#view-challenges .chrow").count(), 3);
  assert.equal(await page.locator("#view-challenges .chrow .medal").count(), 2);
  assert.equal(await page.locator("#view-challenges .chrow .chbadge").count(), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("Finished challenge keeps the winner banner and shows my result", async () => {
  const { page, ctx } = await open("go=ch:fin");
  await page.waitForSelector("#view-challenges .winner");
  assert.ok((await page.locator("#view-challenges .standing").innerText()).includes("Rank 2 of 2"));
  await ctx.close();
});

test("New challenge form: icons on the chips and avatars on friends", async () => {
  const { page, ctx } = await open("go=ch:new");
  await page.waitForSelector('#view-challenges [data-act="ch-weeks"]');
  assert.equal(await page.locator('#view-challenges [data-act="ch-weeks"] svg').count(), 3);
  assert.equal(await page.locator('#view-challenges [data-act="ch-start"] svg').count(), 2);
  assert.ok(await page.locator('#view-challenges [data-act="ch-friend"] .avatar').count() >= 1);
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
