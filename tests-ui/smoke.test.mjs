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
  browser = await chromium.launch({ channel, headless: true, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
});
after(async () => { await browser?.close(); server?.kill(); });

async function open(query = "", viewport = { width: 420, height: 860 }, initScript, setup) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  // a person who already chose a look (Classic) is not asked again; tests of the first-launch picker pass `pick=1` to skip this
  if (!/(^|&)pick=1/.test(query)) await ctx.addInitScript('try{if(localStorage.getItem("ironlog.look")===null)localStorage.setItem("ironlog.look","classic")}catch(e){}');
  if (initScript) await ctx.addInitScript(initScript);
  if (setup) await setup(ctx);
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
  assert.ok(await page.locator("#food-q").evaluate(el => el === document.activeElement), "search box is focused");
  assert.equal(await page.locator("#meal-kcal").count(), 0, "kcal box is behind the toggle");
  await page.locator('[data-act="manual-toggle"]').click();
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
  await page.locator('[data-act="manual-toggle"]').click();
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

test("Overview: headline numbers, the year activity grid and four graph cards", async () => {
  const { page, ctx, errors } = await open();
  await tab(page, "progress");
  assert.equal(await page.locator("#view-overview .stats .stat").count(), 4);
  assert.equal(await page.locator("#view-overview .ovcard").count(), 5);
  assert.equal(await page.locator('#view-overview [data-card="year"] .hm-col').count(), 53);
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
  await ctx.addInitScript(() => { localStorage.setItem("ironlog.journey", "skip"); localStorage.setItem("ironlog.look", "classic"); });
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
  await page.waitForSelector("#view-friends .podium");
  assert.equal(await page.locator('#view-friends .seg button').count(), 3);
  assert.equal(await page.locator('#view-friends .seg [data-v="week"]').getAttribute("aria-pressed"), "true");
  await page.locator('#view-friends .seg [data-v="month"]').click();
  assert.ok(await page.locator("#view-friends .podium .crown").count() >= 1, "crown on first place (month, so the test does not depend on the weekday)");
  await page.locator('#view-friends .seg [data-v="week"]').click();
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

test("chart text is readable: at least 11.5px as rendered", async () => {
  const { page, ctx } = await open();
  await tab(page, "progress");
  for (const view of ["overview", "body", "progress"]) {
    await page.locator('.pill[data-view="' + view + '"]').click();
    const sizes = await page.evaluate(v => [...document.querySelectorAll("#view-" + v + " svg.chart")].map(svg => {
      const vb = svg.viewBox.baseVal, scale = svg.getBoundingClientRect().width / vb.width;
      return [...svg.querySelectorAll("text")].map(t => parseFloat(getComputedStyle(t).fontSize) * scale);
    }).flat(), view);
    assert.ok(sizes.length > 0, view + " has chart text");
    for (const s of sizes) assert.ok(s >= 11.5, view + " chart text " + s + "px");
  }
  await ctx.close();
});

test("the level hero label says it opens badges", async () => {
  const { page, ctx } = await open();
  assert.ok((await page.locator("#view-log .hero").first().getAttribute("aria-label")).toLowerCase().includes("badges"));
  await ctx.close();
});

test("Plan my training from the Edit plan menu leaves no stale history entry", async () => {
  const { page, ctx } = await open();
  await tab(page, "plan");
  await page.locator('#view-days [data-act="open-plansheet"]').click();
  await page.waitForSelector("#plansheet[open]");
  const len = await page.evaluate(() => history.length);
  await page.locator('#plansheet [data-act="journey-open"]').click();
  await page.waitForSelector("#view-journey:not([hidden])");
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => history.length), len, "history grew by more than the journey entry");
  await page.goBack();
  await page.waitForTimeout(400);
  assert.equal(await page.locator("#view-journey:not([hidden])").count(), 0);
  assert.equal(await page.evaluate(() => !!(history.state && history.state.sheet)), false, "a sheet entry is left behind");
  await ctx.close();
});

test("Find result card has an avatar", async () => {
  const { page, ctx } = await open("go=find:zed");
  await page.waitForSelector("#find-form .avatar", { timeout: 8000 });
  await ctx.close();
});

test("week labels on the training chart are direction-safe day/month pairs",async () => {
  const { page, ctx } = await open("lang=ar");
  await tab(page, "progress");
  const labels = await page.locator('#view-overview [data-card="training"] svg.chart text').allTextContents();
  const dates = labels.filter(s => s.includes("/"));
  assert.ok(dates.length === 8, "eight week labels, got " + dates.length);
  for (const s of dates) assert.match(s, /^⁦\d{1,2}\/\d{1,2}⁩$/);
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

// ---- food picker (meal sheet) ----
const openMealSheet = async page => { await page.locator('#view-log [data-act="open-mealsheet"]').first().click(); await page.waitForSelector("#mealsheet[open]"); };
const addFood = async (page, query, ref) => {
  await page.locator("#food-q").fill(query);
  await page.locator(`#food-results [data-act="food-open"][data-ref="${ref}"]`).click();
  await page.locator("#food-add").click();
};
const trayKcal = async page => Number((await page.locator("#tray-total").innerText()).match(/([\d,]+) kcal/)[1].replace(",", ""));

test("food picker: search, open a food, add it to the tray", async () => {
  const { page, ctx, errors } = await open();
  await openMealSheet(page);
  assert.ok((await page.locator("#meal-tray").innerText()).includes("Pick foods below"));
  await page.locator("#food-q").fill("ful");
  assert.ok(await page.locator('#food-results [data-ref="ful-medames"]').count() >= 1);
  await page.locator('#food-results [data-act="food-open"][data-ref="ful-medames"]').click();
  assert.ok(await page.locator("#food-preview").innerText().then(x => /kcal/.test(x)));
  await page.locator("#food-add").click();
  assert.equal(await page.locator("#meal-tray .trayrow").count(), 1);
  assert.ok(await trayKcal(page) > 100);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("food picker: Arabic text finds Egyptian foods even in the English app", async () => {
  const { page, ctx } = await open();
  await openMealSheet(page);
  await page.locator("#food-q").fill("كشري");
  assert.equal(await page.locator('#food-results [data-ref="koshari"]').count(), 1);
  await page.locator("#food-q").fill("zzzzqq");
  assert.ok((await page.locator("#food-results").innerText()).includes("No foods found"));
  await ctx.close();
});

test("food picker: a meal built from two foods is saved with the tray total", async () => {
  const { page, ctx } = await open();
  const before = await page.locator("#view-log .cardio-list li").count();
  await openMealSheet(page);
  await addFood(page, "ful", "ful-medames");
  await addFood(page, "baladi", "aish-baladi");
  assert.equal(await page.locator("#meal-tray .trayrow").count(), 2);
  const total = await trayKcal(page);
  await page.locator("#meal-form button[type=submit]").click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#mealsheet[open]").count(), 0);
  const items = page.locator("#view-log .cardio-list li");
  assert.equal(await items.count(), before + 1);
  const text = await items.last().innerText();
  assert.match(text, /Meal \d+/);
  assert.ok(!text.includes("Ful") && !text.includes("bread"), "the foods are not repeated on the list: " + text);
  assert.ok(text.includes(total.toLocaleString("en-US") + " kcal"), text + " vs " + total);
  await ctx.close();
});

test("food picker: bad grams cannot be added; steppers change the tray row", async () => {
  const { page, ctx } = await open();
  await openMealSheet(page);
  await page.locator("#food-q").fill("rice");
  await page.locator('#food-results [data-act="food-open"][data-ref="rice-white"]').click();
  for (const bad of ["0", "abc", "-5", "99999"]) { await page.locator("#food-grams").fill(bad); assert.equal(await page.locator("#food-add").isDisabled(), true, bad); }
  await page.locator("#food-grams").fill("");
  await page.locator("#food-add").click();
  const one = await trayKcal(page);
  await page.locator('#meal-tray [data-act="tray-step"][data-d="1"]').first().click();
  assert.ok(await trayKcal(page) > one, "plus makes it bigger");
  await page.locator('#meal-tray [data-act="tray-remove"]').first().click();
  assert.equal(await page.locator("#meal-tray .trayrow").count(), 0);
  await ctx.close();
});

test("food picker: a tray over 5000 kcal is refused and nothing is saved", async () => {
  const { page, ctx } = await open();
  const before = await page.locator("#view-log .cardio-list li").count();
  await openMealSheet(page);
  await page.locator("#food-q").fill("olive oil");
  await page.locator('#food-results [data-act="food-open"][data-ref="olive-oil"]').click();
  await page.locator("#food-grams").fill("600");
  await page.locator("#food-add").click();
  await page.locator("#meal-form button[type=submit]").click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#mealsheet[open]").count(), 1, "sheet stays open");
  assert.ok((await page.locator("#toast").innerText()).includes("0–5000"));
  await page.locator('[data-act="sheet-close"]').first().click();
  assert.equal(await page.locator("#view-log .cardio-list li").count(), before);
  await ctx.close();
});

test("food picker: touch targets are at least 44px and text at least 12px", async () => {
  const { page, ctx } = await open();
  await openMealSheet(page);
  await addFood(page, "ful", "ful-medames");
  await page.locator("#food-q").fill("rice");
  await page.locator('#food-results [data-act="food-open"][data-ref="rice-white"]').click();
  const small = await page.evaluate(() => [...document.querySelectorAll("#mealsheet button, #mealsheet input")].filter(e => e.offsetParent).map(e => [e.id || e.textContent.trim().slice(0, 20), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44));
  assert.deepEqual(small, []);
  const tiny = await page.evaluate(() => [...document.querySelectorAll("#mealsheet *")].filter(e => e.children.length === 0 && e.textContent.trim() && e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 12).map(e => e.textContent.trim().slice(0, 30)));
  assert.deepEqual(tiny, []);
  await ctx.close();
});

test("food picker: a food you logged lately shows as a Recent chip and adds in one tap", async () => {
  const { page, ctx } = await open();
  await openMealSheet(page);
  assert.equal(await page.locator('#food-results [data-act="recent-add"]').count(), 0, "nothing logged with foods yet");
  await addFood(page, "taameya", "taameya");
  await page.locator("#meal-form button[type=submit]").click();
  await page.waitForTimeout(300);
  await openMealSheet(page);
  const chip = page.locator('#food-results [data-act="recent-add"]');
  assert.equal(await chip.count(), 1);
  assert.ok((await chip.first().innerText()).includes("Taameya"));
  await chip.first().click();
  assert.equal(await page.locator("#meal-tray .trayrow").count(), 1);
  await ctx.close();
});

test("food picker: typing grams replaces the serving and shows in the tray", async () => {
  const { page, ctx } = await open();
  await openMealSheet(page);
  await page.locator("#food-q").fill("rice");
  await page.locator('#food-results [data-act="food-open"][data-ref="rice-white"]').click();
  const before = await page.locator("#food-preview").innerText();
  await page.locator("#food-grams").fill("150");
  const after = await page.locator("#food-preview").innerText();
  assert.notEqual(before, after);
  assert.equal(await page.locator('#food-results [data-act="food-serving"][aria-pressed="true"]').count(), 0, "no serving is selected while grams are typed");
  await page.locator("#food-add").click();
  assert.ok((await page.locator("#meal-tray .trayrow").innerText()).includes("150 g"));
  await ctx.close();
});

const myFoodForm = async (page, v) => {
  await page.locator('[data-act="myfood-new"]').first().click();
  for (const [id, val] of Object.entries(v)) await page.locator("#mf-" + id).fill(val);
  await page.locator('[data-act="myfood-save"]').click();
};

test("My foods: create, find with a Mine tag, add, edit, delete (saved meals keep their foods)", async () => {
  const { page, ctx } = await open();
  await openMealSheet(page);
  await myFoodForm(page, { name: "Protein bar", kcal: "abc", protein: "20", serving: "1 bar" });
  assert.ok((await page.locator("#toast").innerText()).includes("Check the numbers"), "bad kcal is refused");
  await page.locator("#mf-kcal").fill("210");
  await page.locator('[data-act="myfood-save"]').click();
  await page.locator("#food-q").fill("protein bar");
  const row = page.locator('#food-results [data-act="food-open"][data-src="mine"]');
  assert.equal(await row.count(), 1);
  assert.ok((await row.first().innerText()).includes("Mine"));
  await row.first().click();
  await page.locator("#food-add").click();
  assert.equal(await trayKcal(page), 210);
  await page.locator("#meal-form button[type=submit]").click();
  await page.waitForTimeout(300);
  // edit: the number changes
  await openMealSheet(page);
  await page.locator("#food-q").fill("protein bar");
  await page.locator('#food-results [data-act="food-open"][data-src="mine"]').first().click();
  await page.locator('[data-act="myfood-edit"]').click();
  assert.equal(await page.locator("#mf-name").inputValue(), "Protein bar");
  assert.equal(await page.locator("#mf-kcal").inputValue(), "210");
  await page.locator("#mf-kcal").fill("230");
  await page.locator('[data-act="myfood-save"]').click();
  await page.locator('#food-results [data-act="food-open"][data-src="mine"]').first().click();
  await page.locator("#food-add").click();
  assert.equal(await trayKcal(page), 230);
  // delete: gone from search, the meal already saved still lists it
  await page.locator('[data-act="tray-remove"]').first().click();
  await page.locator("#food-q").fill("protein bar");
  await page.locator('#food-results [data-act="food-open"][data-src="mine"]').first().click();
  await page.locator('[data-act="myfood-delete"]').click();
  assert.equal(await page.locator('#food-results [data-src="mine"]').count(), 0);
  await page.locator('[data-act="sheet-close"]').first().click();
  await page.locator('#view-log [data-act="meal-edit"]').first().click();
  await page.waitForSelector("#mealsheet[open]");
  assert.ok((await page.locator("#meal-tray").innerText()).includes("Protein bar"), "the saved meal still lists its food");
  await ctx.close();
});

const saveBuiltMeal = async page => { await page.locator("#meal-form button[type=submit]").click(); await page.waitForTimeout(300); };
const mealRows = page => page.locator("#view-log .cardio-list li");

test("edit a saved meal: pencil only on built meals, saving replaces the same meal", async () => {
  const { page, ctx } = await open();
  // a hand-typed meal: no pencil
  await openMealSheet(page);
  await page.locator('[data-act="manual-toggle"]').click();
  await page.locator("#meal-kcal").fill("450");
  await saveBuiltMeal(page);
  assert.equal(await page.locator('#view-log [data-act="meal-edit"]').count(), 0, "no pencil on a typed meal");
  // a built meal: pencil
  const before = await mealRows(page).count();
  await openMealSheet(page);
  await addFood(page, "ful", "ful-medames");
  await addFood(page, "baladi", "aish-baladi");
  const total = await trayKcal(page);
  await saveBuiltMeal(page);
  assert.equal(await mealRows(page).count(), before + 1);
  assert.equal(await page.locator('#view-log [data-act="meal-edit"]').count(), 1);
  await page.locator('#view-log [data-act="meal-edit"]').click();
  await page.waitForSelector("#mealsheet[open]");
  assert.equal(await page.locator("#meal-tray .trayrow").count(), 2, "both foods are back in the tray");
  assert.equal(await trayKcal(page), total);
  await page.locator('#meal-tray [data-act="tray-step"][data-d="1"]').first().click();
  const bigger = await trayKcal(page);
  assert.ok(bigger > total);
  await saveBuiltMeal(page);
  assert.equal(await mealRows(page).count(), before + 1, "still one meal, not two");
  assert.ok((await mealRows(page).last().innerText()).includes(bigger.toLocaleString("en-US") + " kcal"));
  await ctx.close();
});

test("edit a saved meal: closing without saving changes nothing and the next new meal starts empty", async () => {
  const { page, ctx } = await open();
  await openMealSheet(page);
  await addFood(page, "ful", "ful-medames");
  await saveBuiltMeal(page);
  const text = await mealRows(page).last().innerText();
  await page.locator('#view-log [data-act="meal-edit"]').click();
  await page.waitForSelector("#mealsheet[open]");
  await page.locator('#meal-tray [data-act="tray-remove"]').first().click();
  await page.locator('[data-act="sheet-close"]').first().click();
  await page.waitForTimeout(200);
  assert.equal(await mealRows(page).last().innerText(), text);
  await openMealSheet(page);
  assert.equal(await page.locator("#meal-tray .trayrow").count(), 0, "a new meal does not inherit the edit");
  assert.equal(await page.locator("#mealsheet h2").textContent(), "Add a meal");
  await ctx.close();
});

test("edit a saved meal: a food that was deleted from My foods still opens and can be stepped", async () => {
  const { page, ctx } = await open();
  await openMealSheet(page);
  await myFoodForm(page, { name: "Date bar", kcal: "200", protein: "4", serving: "1 bar" });
  await page.locator("#food-q").fill("date bar");
  await page.locator('#food-results [data-act="food-open"][data-src="mine"]').first().click();
  await page.locator("#food-add").click();
  await saveBuiltMeal(page);
  await openMealSheet(page);
  await page.locator("#food-q").fill("date bar");
  await page.locator('#food-results [data-act="food-open"][data-src="mine"]').first().click();
  await page.locator('[data-act="myfood-delete"]').click();
  await page.locator('[data-act="sheet-close"]').first().click();
  await page.locator('#view-log [data-act="meal-edit"]').click();
  await page.waitForSelector("#mealsheet[open]");
  assert.equal(await trayKcal(page), 200);
  await page.locator('#meal-tray [data-act="tray-step"][data-d="1"]').first().click();
  assert.equal(await trayKcal(page), 300, "scaled from the saved snapshot (1.5 servings)");
  await ctx.close();
});

// ---- barcode scan ----
const COLA = { status: 1, product: { product_name: "Cola", brands: "Fizz", serving_size: "330 ml", serving_quantity: 330, nutriments: { "energy-kcal_100g": 42, proteins_100g: 0 } } };
const NO_CAMERA = () => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("no camera", "NotFoundError")); };
const WATCH_STREAMS = () => { const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); window.__streams = [];
  navigator.mediaDevices.getUserMedia = async c => { const s = await orig(c); window.__streams.push(s); return s; }; };
async function offRoute(ctx, body, counter) {
  await ctx.route("https://world.openfoodfacts.org/**", route => { counter.n++; return body === "fail" ? route.abort() : route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) }); });
}
const openScan = async page => { await page.locator('#mealsheet [data-act="scan-open"]').click(); await page.waitForSelector("#scan-digits"); };
const findCode = async (page, code) => { await page.locator("#scan-digits").fill(code); await page.locator('#scan-form button[type=submit]').click(); };

test("barcode: the vendored scanner library decodes an EAN-13 picture", async () => {
  const { page, ctx } = await open();
  await page.addScriptTag({ url: BASE + "vendor/zxing-library.min.js" });
  const text = await page.evaluate(async () => {
    const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
    const R = L.map(c => c.split("").map(b => (b === "0" ? "1" : "0")).join("")), G = R.map(c => c.split("").reverse().join(""));
    const PAR = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
    const digits = "5449000000996".split("").map(Number);
    let bits = "101";
    for (let i = 0; i < 6; i++) bits += (PAR[digits[0]][i] === "L" ? L : G)[digits[i + 1]];
    bits += "01010";
    for (let i = 7; i < 13; i++) bits += R[digits[i]];
    bits += "101";
    const m = 4, quiet = 12, c = document.createElement("canvas");
    c.width = (bits.length + quiet * 2) * m; c.height = 140;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.fillStyle = "#000";
    bits.split("").forEach((b, i) => { if (b === "1") g.fillRect((quiet + i) * m, 10, m, 120); });
    const Z = window.ZXing, hints = new Map([[Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]]]);
    const reader = new Z.BrowserMultiFormatReader(hints);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    return reader.decode(img).getText();
  });
  assert.equal(text, "5449000000996");
  await ctx.close();
});

test("barcode: typing a number finds a product, adds it, and a second lookup needs no network", async () => {
  const { page, ctx } = await open("", undefined, NO_CAMERA);
  const net = { n: 0 }; await offRoute(ctx, COLA, net);
  await openMealSheet(page);
  await openScan(page);
  assert.ok((await page.locator("#scan-msg").innerText()).includes("Camera not available"));
  await findCode(page, "5 449000 000996");
  await page.waitForSelector("#food-add");
  assert.equal(await page.locator("#scan-digits").count(), 0, "scan view closed");
  assert.ok((await page.locator("#food-results").innerText()).includes("Cola (Fizz)"));
  assert.ok((await page.locator("#food-results").innerText()).includes("Open Food Facts"));
  await page.locator("#food-add").click();
  assert.equal(await page.locator("#meal-tray .trayrow").count(), 1);
  assert.equal(await trayKcal(page), 139, "330 ml at 42 kcal per 100 g");
  assert.equal(net.n, 1);
  // saved to My foods: found again without the network
  await openScan(page);
  await findCode(page, "5449000000996");
  await page.waitForSelector("#food-add");
  assert.equal(net.n, 1, "no second request");
  await ctx.close();
});

test("barcode: a wrong check digit is refused before any request", async () => {
  const { page, ctx } = await open("", undefined, NO_CAMERA);
  const net = { n: 0 }; await offRoute(ctx, COLA, net);
  await openMealSheet(page);
  await openScan(page);
  await findCode(page, "5449000000995");
  assert.ok((await page.locator("#scan-msg").innerText()).includes("isn't a valid barcode"));
  await findCode(page, "12ab");
  assert.ok((await page.locator("#scan-msg").innerText()).includes("isn't a valid barcode"));
  assert.equal(net.n, 0);
  await ctx.close();
});

test("barcode: an unknown product opens the My food form with the barcode, and saving makes it findable offline", async () => {
  const { page, ctx } = await open("", undefined, NO_CAMERA);
  const net = { n: 0 }; await offRoute(ctx, { status: 0 }, net);
  await openMealSheet(page);
  await openScan(page);
  await findCode(page, "96385074");
  await page.waitForSelector("#mf-name");
  await page.locator("#mf-name").fill("Local biscuits");
  await page.locator("#mf-kcal").fill("120");
  await page.locator('[data-act="myfood-save"]').click();
  await page.locator("#food-q").fill("local biscuits");
  assert.equal(await page.locator('#food-results [data-src="mine"]').count(), 1);
  await openScan(page);
  await findCode(page, "96385074");
  await page.waitForSelector("#food-add");
  assert.equal(net.n, 1, "the second lookup came from My foods");
  await ctx.close();
});

test("barcode: offline or failing lookups say so and keep typing possible", async () => {
  const { page, ctx } = await open("", undefined, NO_CAMERA);
  const net = { n: 0 }; await offRoute(ctx, "fail", net);
  await openMealSheet(page);
  await openScan(page);
  await findCode(page, "5449000000996");
  await page.waitForFunction(() => /look that up/.test(document.querySelector("#toast")?.textContent || ""));
  assert.equal(await page.locator("#scan-digits").count(), 1, "still on the scan view");
  await ctx.close();
});

test("barcode: the camera stops on Back and on closing the sheet, with no stale history entry", async () => {
  const { page, ctx } = await open("", undefined, WATCH_STREAMS);
  await openMealSheet(page);
  await openScan(page);
  await page.waitForFunction(() => window.__streams.length === 1 && document.querySelector("#scan-video")?.srcObject);
  await page.goBack();
  await page.waitForSelector("#scan-digits", { state: "detached" });
  assert.equal(await page.evaluate(() => window.__streams.every(s => s.getTracks().every(t => t.readyState === "ended"))), true, "Back stopped the camera");
  assert.equal(await page.locator("#mealsheet[open]").count(), 1, "the sheet itself is still open");
  await openScan(page);
  await page.waitForFunction(() => window.__streams.length === 2);
  await page.locator('#mealsheet [data-act="sheet-close"]').first().click();
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__streams.every(s => s.getTracks().every(t => t.readyState === "ended"))), true, "closing the sheet stopped the camera");
  assert.equal(await page.evaluate(() => !!(history.state && history.state.sheet)), false, "no leftover sheet step in history");
  await ctx.close();
});

// ---- final review fixes ----
test("review: a data refresh while scanning keeps the camera picture", async () => {
  const { page, ctx } = await open("", undefined, WATCH_STREAMS);
  await openMealSheet(page);
  await openScan(page);
  await page.waitForFunction(() => window.__streams.length === 1 && document.querySelector("#scan-video")?.srcObject);
  await page.evaluate(() => { window.__v = document.getElementById("scan-video"); document.querySelector('[data-act="lang-set"][data-v="ar"]').click(); });
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.getElementById("scan-video") === window.__v), true, "the same video element is still on screen");
  assert.equal(await page.evaluate(() => !!window.__v.srcObject && window.__streams[0].getTracks().every(t => t.readyState === "live")), true, "the camera is still running");
  await ctx.close();
});

// The app's service worker fetches the library itself, which Playwright routes cannot see: make the load fail inside the page.
const SCANNER_LIB_FAILS = () => {
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); window.__streams = [];
  navigator.mediaDevices.getUserMedia = async c => { const s = await orig(c); window.__streams.push(s); return s; };
  const add = Node.prototype.appendChild;
  Node.prototype.appendChild = function (n) { if (n.tagName === "SCRIPT" && /zxing/.test(n.src)) { setTimeout(() => n.onerror && n.onerror(new Event("error")), 0); return n; } return add.call(this, n); };
};
test("review: if the scanner library cannot load, the camera is switched off", async () => {
  const { page, ctx } = await open("", undefined, SCANNER_LIB_FAILS);
  await openMealSheet(page);
  await openScan(page);
  await page.waitForFunction(() => /Scanner not available/.test(document.querySelector("#scan-msg")?.textContent || ""));
  assert.equal(await page.evaluate(() => window.__streams.every(s => s.getTracks().every(t => t.readyState === "ended"))), true, "no camera left running");
  assert.equal(await page.locator("#scan-digits").count(), 1, "typing still works");
  await ctx.close();
});

test("review: signing out clears the meal draft for the next person", async () => {
  const { page, ctx } = await open();
  await openMealSheet(page);
  await addFood(page, "ful", "ful-medames");
  await page.locator("#food-q").fill("rice");
  await page.locator('[data-act="sheet-close"]').first().click();
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector("#signout").click());
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__fakeAuth({ uid: "u2", displayName: "Next", email: "next@example.com", emailVerified: true }));
  await page.waitForSelector(".tabbar:not([hidden])");
  await openMealSheet(page);
  assert.equal(await page.locator("#meal-tray .trayrow").count(), 0, "the tray is empty");
  assert.equal(await page.locator("#food-q").inputValue(), "", "the search box is empty");
  await ctx.close();
});

test("review: in Arabic the − and + steppers keep their order (left to right)", async () => {
  const { page, ctx } = await open("lang=ar");
  await openMealSheet(page);
  await page.locator("#food-q").fill("rice");
  await page.locator('#food-results [data-act="food-open"][data-ref="rice-white"]').click();
  const xs = async sel => page.evaluate(s => document.querySelector(s).getBoundingClientRect().x, sel);
  assert.ok(await xs('.foodamt [data-d="-0.5"]') < await xs('.foodamt [data-d="0.5"]'), "amount stepper: minus is left of plus");
  await page.locator("#food-add").click();
  assert.ok(await xs('#meal-tray [data-act="tray-step"][data-d="-1"]') < await xs('#meal-tray [data-act="tray-step"][data-d="1"]'), "tray stepper: minus is left of plus");
  await ctx.close();
});

test("meal names: unnamed meals are 'Meal 1', 'Meal 2'..., a named meal keeps its name and takes no number", async () => {
  const { page, ctx } = await open();
  const labels = async () => (await page.locator("#view-log .cardio-list li").allInnerTexts()).map(x => x.split("·")[0].trim());
  const nums = list => list.map(x => (x.match(/^Meal (\d+)$/) || [])[1]).filter(Boolean).map(Number);
  await openMealSheet(page); await addFood(page, "ful", "ful-medames"); await saveBuiltMeal(page);
  await openMealSheet(page); await addFood(page, "rice", "rice-white"); await saveBuiltMeal(page);
  let list = await labels(), n = nums(list);
  assert.equal(n.length, 2 + nums(list).length - 2, "two unnamed meals were added");
  assert.deepEqual(n.slice(-2), [n.at(-2), n.at(-2) + 1], "numbers are consecutive");
  assert.ok(!list.some(x => x.includes("Ful") || x.includes("Rice")), "the foods are not used as the name: " + list.join(" | "));
  const before = n.at(-1);
  await openMealSheet(page);
  await page.locator('#mealsheet [data-act="meal-name"][data-name="Breakfast"]').click();
  await addFood(page, "toast", "toast"); await saveBuiltMeal(page);
  await openMealSheet(page); await addFood(page, "taameya", "taameya"); await saveBuiltMeal(page);
  list = await labels();
  assert.ok(list.includes("Breakfast"), "the named meal keeps its name: " + list.join(" | "));
  assert.equal(nums(list).at(-1), before + 1, "the next unnamed meal skips the named one");
  await ctx.close();
});

// ---- small-fixes batch ----
test("small fixes: a zero-calorie meal (water) can be saved, an empty typed meal cannot", async () => {
  const { page, ctx } = await open();
  await openMealSheet(page);
  await page.locator('[data-act="manual-toggle"]').click();
  await page.locator("#meal-form button[type=submit]").click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#mealsheet[open]").count(), 1, "blank kcal is not 0 kcal");
  assert.ok((await page.locator("#toast").innerText()).includes("Add a food"));
  await page.locator('[data-act="sheet-close"]').first().click();
  await openMealSheet(page);
  await addFood(page, "water", "water");
  await saveBuiltMeal(page);
  assert.equal(await page.locator("#mealsheet[open]").count(), 0, "saved");
  assert.ok((await page.locator("#view-log .cardio-list").innerText()).includes("0 kcal"));
  await ctx.close();
});

test("small fixes: a UPC-A number is looked up as EAN-13 and found again under either form", async () => {
  const { page, ctx } = await open("", undefined, NO_CAMERA);
  const urls = []; await ctx.route("https://world.openfoodfacts.org/**", route => { urls.push(route.request().url()); return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(COLA) }); });
  await openMealSheet(page); await openScan(page);
  await findCode(page, "036000291452");
  await page.waitForSelector("#food-add");
  assert.ok(urls[0].includes("/0036000291452.json"), urls[0]);
  await page.locator("#food-add").click();
  await openScan(page); await findCode(page, "0036000291452");
  await page.waitForSelector("#food-add");
  assert.equal(urls.length, 1, "the saved food is found by the other form of the code");
  await ctx.close();
});

test("small fixes: an answer that is not JSON is a failed lookup, not 'no calories on record'", async () => {
  const { page, ctx } = await open("", undefined, NO_CAMERA);
  await ctx.route("https://world.openfoodfacts.org/**", route => route.fulfill({ status: 200, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: "<html>maintenance</html>" }));
  await openMealSheet(page); await openScan(page);
  await findCode(page, "5449000000996");
  await page.waitForFunction(() => /look that up/.test(document.querySelector("#toast")?.textContent || ""));
  assert.equal(await page.locator("#mf-name").count(), 0, "no My food form");
  assert.equal(await page.locator("#scan-digits").count(), 1, "still on the scan view");
  await ctx.close();
});

// ---- calorie target sheet ----
const cardTarget = async page => Number((await page.locator("#view-log .eatsum .v small").innerText()).replace(/[^\d]/g, ""));
const sheetNum = async (page, row) => Number(await page.locator(`#targetsheet [data-row="${row}"] .num`).getAttribute("data-v"));
const openTarget = async page => { await page.locator('#view-log [data-act="target-open"]').click(); await page.waitForSelector("#targetsheet[open]"); };
const pressed = async (page, id) => page.locator(`#targetsheet [data-act="target-activity"][data-id="${id}"]`).getAttribute("aria-pressed");

test("target sheet: the link opens the breakdown and its numbers are the card's", async () => {
  const { page, ctx } = await open();
  await openTarget(page);
  assert.equal(await sheetNum(page, "target"), await cardTarget(page));
  assert.equal(await sheetNum(page, "burned") + await sheetNum(page, "goal"), await sheetNum(page, "target"));
  assert.equal(await sheetNum(page, "everyday") + await sheetNum(page, "lifting") + await sheetNum(page, "cardio"), await sheetNum(page, "burned"));
  assert.equal(await pressed(page, "sitting"), "true", "default is mostly sitting");
  assert.ok((await page.locator("#targetsheet").innerText()).includes("Estimated from your height"), "no InBody scan in the sample data");
  await ctx.close();
});

test("target sheet: a higher activity level raises the target, and the choice is kept", async () => {
  const { page, ctx } = await open();
  await openTarget(page);
  const before = await sheetNum(page, "target"), resting = await sheetNum(page, "resting");
  await page.locator('#targetsheet [data-act="target-activity"][data-id="active"]').click();
  await page.waitForTimeout(200);
  assert.equal(await pressed(page, "active"), "true");
  assert.equal(await sheetNum(page, "target") - before, Math.round(resting * 1.4) - Math.round(resting * 1.2));
  assert.equal(await cardTarget(page), await sheetNum(page, "target"), "the card behind follows");
  await ctx.close();
});

test("target sheet: the daily adjustment steps by 50, zero is a choice, and the goal default comes back", async () => {
  const { page, ctx } = await open();
  await openTarget(page);
  const dflt = await sheetNum(page, "goal");
  assert.equal(await page.locator('#targetsheet [data-act="target-adjust-reset"]').count(), 0, "nothing to reset yet");
  await page.locator('#targetsheet [data-act="target-adjust"][data-d="50"]').click();
  await page.waitForTimeout(150);
  assert.equal(await sheetNum(page, "goal"), dflt + 50);
  for (let i = 0; i < 20; i++) { if (await sheetNum(page, "goal") === 0) break; await page.locator('#targetsheet [data-act="target-adjust"][data-d="50"]').click(); await page.waitForTimeout(120); }
  assert.equal(await sheetNum(page, "goal"), 0);
  assert.equal(await sheetNum(page, "target"), await sheetNum(page, "burned"));
  assert.equal(await page.locator('#targetsheet [data-act="target-adjust-reset"]').count(), 1, "zero is your own choice, so it can be reset");
  await page.locator('#targetsheet [data-act="target-adjust-reset"]').click();
  await page.waitForTimeout(150);
  assert.equal(await sheetNum(page, "goal"), dflt);
  assert.equal(await page.locator('#targetsheet [data-act="target-adjust-reset"]').count(), 0);
  await ctx.close();
});

test("target sheet: saving the About-you form keeps the activity level and the adjustment", async () => {
  const { page, ctx } = await open();
  await openTarget(page);
  await page.locator('#targetsheet [data-act="target-activity"][data-id="light"]').click();
  await page.locator('#targetsheet [data-act="target-adjust"][data-d="-50"]').click();
  await page.waitForTimeout(200);
  const want = await sheetNum(page, "target");
  await page.locator('#targetsheet [data-act="sheet-close"]').click();
  await tab(page, "progress");
  await page.locator('#pills [data-view="body"]').click();
  await page.locator('[data-act="edit-profile"]').click();
  await page.locator('#profile-form button[type=submit]').click();
  await page.waitForTimeout(300);
  await tab(page, "today");
  assert.equal(await cardTarget(page), want);
  await openTarget(page);
  assert.equal(await pressed(page, "light"), "true");
  await ctx.close();
});

test("target sheet: without a weight there is no link, only the fill-in message", async () => {
  const { page, ctx } = await open("fresh=1", undefined, () => localStorage.setItem("ironlog.journey", "skip"));
  assert.equal(await page.locator('#view-log [data-act="target-open"]').count(), 0);
  assert.ok((await page.locator("#view-log .today").innerText()).includes("Log your weight"));
  await ctx.close();
});

test("target sheet: in Arabic it opens and the adjustment buttons keep their order", async () => {
  const { page, ctx } = await open("lang=ar");
  await openTarget(page);
  const xs = async sel => page.evaluate(s => document.querySelector(s).getBoundingClientRect().x, sel);
  assert.ok(await xs('#targetsheet [data-act="target-adjust"][data-d="-50"]') < await xs('#targetsheet [data-act="target-adjust"][data-d="50"]'), "minus is left of plus");
  await ctx.close();
});

test("target sheet: changing the goal in About you resets the person's own adjustment, keeping it keeps it", async () => {
  const { page, ctx } = await open();
  await openTarget(page);
  await page.locator('#targetsheet [data-act="target-adjust"][data-d="50"]').click();
  await page.waitForTimeout(150);
  const own = await sheetNum(page, "goal");
  await page.locator('#targetsheet [data-act="sheet-close"]').click();
  const saveForm = async goal => {
    await tab(page, "progress"); await page.locator('#pills [data-view="body"]').click();
    await page.locator('[data-act="edit-profile"]').click();
    if (goal) await page.locator('#profile-form [name="goal"]').selectOption(goal);
    await page.locator('#profile-form button[type=submit]').click(); await page.waitForTimeout(300);
    await tab(page, "today"); await openTarget(page);
  };
  await saveForm(null);
  assert.equal(await sheetNum(page, "goal"), own, "same goal: the own number stays");
  await page.locator('#targetsheet [data-act="sheet-close"]').click();
  await saveForm("muscle");
  assert.equal(await page.locator('#targetsheet [data-act="target-adjust-reset"]').count(), 0, "a new goal starts from its default");
  assert.equal(await sheetNum(page, "goal"), 250, "the muscle default");
  await ctx.close();
});

// ---- set types ----
const startPush = async page => { await page.locator('#view-log [data-act="start-day"]').first().click(); await page.waitForSelector("#open-card"); };
const kindChip = (page, k) => page.locator(`#open-card [data-act="set-kind"][data-k="${k}"]`);
const addSetWith = async (page, w, r, kind) => {
  await page.locator("#w-0").fill(String(w)); await page.locator("#r-0").fill(String(r));
  if (kind) await kindChip(page, kind).click();
  await page.locator('#open-card [data-act="add-set"]').click(); await page.waitForTimeout(250);
};
const rowsOf = page => page.locator("#open-card tr.setrow");

test("set types: three chips above Add set, Normal pressed by default", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  assert.deepEqual(await page.locator('#open-card [data-act="set-kind"]').allInnerTexts(), ["Normal", "Warm-up", "Drop set"]);
  assert.equal(await kindChip(page, "normal").getAttribute("aria-pressed"), "true");
  await ctx.close();
});

test("set types: a warm-up gets a tag and no PR badge, and the chip returns to Normal", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  await addSetWith(page, 300, 5, "warmup");
  assert.equal(await rowsOf(page).count(), 1);
  assert.ok((await rowsOf(page).first().innerText()).includes("Warm-up"));
  assert.equal(await rowsOf(page).first().locator(".pr").count(), 0, "no PR on a warm-up");
  assert.equal(await kindChip(page, "normal").getAttribute("aria-pressed"), "true");
  await ctx.close();
});

test("set types: a drop set has a tag and no PR; a normal heavy set still gets the PR", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  await addSetWith(page, 300, 5, "drop");
  assert.ok((await rowsOf(page).first().innerText()).includes("Drop"));
  assert.equal(await rowsOf(page).first().locator(".pr").count(), 0);
  await addSetWith(page, 300, 5);
  assert.equal(await rowsOf(page).nth(1).locator(".pr").count(), 1, "the normal set is the PR");
  assert.equal(await rowsOf(page).nth(1).locator(".settag").count(), 0);
  await ctx.close();
});

test("set types: editing a set shows its type, saving keeps it, and it can be changed", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  await addSetWith(page, 40, 10, "warmup");
  await rowsOf(page).first().click();
  assert.equal(await kindChip(page, "warmup").getAttribute("aria-pressed"), "true");
  await page.locator('#open-card [data-act="save-set"]').click(); await page.waitForTimeout(250);
  assert.ok((await rowsOf(page).first().innerText()).includes("Warm-up"), "type kept by a plain save");
  await rowsOf(page).first().click();
  await kindChip(page, "normal").click();
  await page.locator('#open-card [data-act="save-set"]').click(); await page.waitForTimeout(250);
  assert.equal(await rowsOf(page).first().locator(".settag").count(), 0, "now a normal set");
  await ctx.close();
});

test("set types: in Arabic the chips are translated", async () => {
  const { page, ctx } = await open("lang=ar");
  await startPush(page);
  const chips = await page.locator('#open-card [data-act="set-kind"]').allInnerTexts();
  assert.equal(chips.length, 3);
  assert.ok(chips.every(c => /[؀-ۿ]/.test(c)), chips.join("|"));
  await ctx.close();
});

// ---- targets and progression advice ----
const targetChip = page => page.locator('#open-card [data-act="target-edit"]');
const tgt = (page, f, d) => page.locator(`#open-card [data-act="tgt-step"][data-f="${f}"][data-d="${d}"]`);
const advice = page => page.locator("#open-card .advice");

test("targets: every exercise shows its default target as a tappable chip", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  assert.equal((await targetChip(page).innerText()).replace(/\s+/g, " ").trim(), "Target 3 × 5–8", "Bench Press is a heavy compound");
  await ctx.close();
});

test("targets: the editor changes sets and reps with limits, Done shows the new target, Reset brings the default back", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  await targetChip(page).click();
  await tgt(page, "max", 1).click(); await tgt(page, "sets", 1).click();
  await tgt(page, "min", 1).click(); await tgt(page, "min", 1).click(); await tgt(page, "min", 1).click(); await tgt(page, "min", 1).click();
  assert.equal(await page.locator('#open-card [data-row="min"] .num').innerText(), "9", "min stops at max (9)");
  await page.locator('#open-card [data-act="tgt-done"]').click();
  assert.equal((await targetChip(page).innerText()).replace(/\s+/g, " ").trim(), "Target 4 × 9–9");
  await targetChip(page).click();
  await page.locator('#open-card [data-act="tgt-reset"]').click();
  assert.equal(await page.locator('#open-card [data-row="max"] .num').innerText(), "8", "the editor shows the default again");
  await page.locator('#open-card [data-act="tgt-done"]').click();
  assert.equal((await targetChip(page).innerText()).replace(/\s+/g, " ").trim(), "Target 3 × 5–8");
  await ctx.close();
});

test("targets: not reaching the top of the range says to keep the weight and pre-fills set 1", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  assert.equal((await advice(page).innerText()).replace(/\s+/g, " ").trim(), "Same weight: aim for 7 on every set");
  assert.equal(await page.locator("#w-0").inputValue(), "62.5");
  assert.equal(await page.locator("#r-0").inputValue(), "7");
  await ctx.close();
});

test("targets: reaching the top of the range suggests more weight and pre-fills it", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  await targetChip(page).click();
  await tgt(page, "sets", -1).click(); await tgt(page, "sets", -1).click(); await tgt(page, "max", -1).click(); await tgt(page, "max", -1).click();
  await page.locator('#open-card [data-act="tgt-done"]').click();
  assert.equal((await advice(page).innerText()).replace(/\s+/g, " ").trim(), "Try 65 kg × 5");
  assert.equal(await page.locator("#w-0").inputValue(), "65");
  assert.equal(await page.locator("#r-0").inputValue(), "5");
  await ctx.close();
});

test("targets: a warm-up logged first does not take the suggestion away from the first working set", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  await addSetWith(page, 40, 10, "warmup");
  assert.equal(await page.locator("#w-0").inputValue(), "62.5");
  assert.equal(await page.locator("#r-0").inputValue(), "7");
  await ctx.close();
});

test("targets: in Arabic the editor steppers keep minus left of plus", async () => {
  const { page, ctx } = await open("lang=ar");
  await startPush(page);
  await targetChip(page).click();
  const xs = async sel => page.evaluate(s => document.querySelector(s).getBoundingClientRect().x, sel);
  assert.ok(await xs('#open-card [data-act="tgt-step"][data-f="max"][data-d="-1"]') < await xs('#open-card [data-act="tgt-step"][data-f="max"][data-d="1"]'));
  await ctx.close();
});

test("targets: opening the target editor while editing a logged set leaves set editing, so Save cannot write the wrong numbers", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  await addSetWith(page, 70, 6);
  await rowsOf(page).first().click();
  assert.equal(await page.locator('#open-card [data-act="save-set"]').count(), 1);
  await targetChip(page).click();
  assert.equal(await page.locator('#open-card [data-act="save-set"]').count(), 0, "no longer editing the set");
  assert.equal(await page.locator('#open-card [data-act="add-set"]').count(), 1);
  await ctx.close();
});

// ---- bodyweight ----
const addEx = async (page, name) => {
  await page.locator('#view-log [data-act="open-exsheet"]').first().click(); await page.waitForSelector("#exsheet[open]");
  await page.locator("#new-ex").fill(name); await page.locator('#add-ex-form button[type="submit"]').click(); await page.waitForSelector("#open-card");
  await page.waitForFunction(n => document.documentElement.lang === "ar" || document.querySelector("#open-card .ex-name")?.textContent.trim().toLowerCase() === n.toLowerCase(), name);
};
const bwChip = page => page.locator('#open-card [data-act="bw-toggle"]');
const wLabel = async page => (await page.locator("#open-card .label", { hasText: /weight/i }).first().textContent()).trim();   // textContent: innerText is upper-cased by the CSS
const bwText = async loc => (await loc.innerText()).replace(/\s+/g, " ").trim();

test("bodyweight: Push-up logs extra kg from 0; a weighted lift keeps its label and starter", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  assert.equal(await wLabel(page), "Weight · kg", "Bench Press is weighted");
  await addEx(page, "Push-up");
  assert.ok((await wLabel(page)).startsWith("Extra weight"), await wLabel(page));
  assert.equal(await page.locator('#open-card input[data-f="w"]').inputValue(), "0");
  assert.equal(await page.locator('#open-card input[data-f="r"]').inputValue(), "8");
  assert.equal(await bwChip(page).getAttribute("aria-pressed"), "true");
  await ctx.close();
});

test("bodyweight: a typed exercise starts weighted and the Bodyweight chip flips it both ways", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  await addEx(page, "Zottman Move");
  assert.equal(await wLabel(page), "Weight · kg");
  assert.equal(await page.locator('#open-card input[data-f="w"]').inputValue(), "20");
  await bwChip(page).click();
  assert.ok((await wLabel(page)).startsWith("Extra weight"));
  assert.equal(await page.locator('#open-card input[data-f="w"]').inputValue(), "0");
  await bwChip(page).click();
  assert.equal(await wLabel(page), "Weight · kg", "flipped back");
  await ctx.close();
});

test("bodyweight: the weight steps below zero only for bodyweight; assisted sets show with a minus", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  await addEx(page, "Push-up");
  const w = page.locator('#open-card input[data-f="w"]');
  await page.locator('#open-card [data-act="step"][data-f="w"][data-d="-2.5"]').click();
  assert.equal(await w.inputValue(), "-2.5");
  await w.fill("-20"); await page.locator('#open-card input[data-f="r"]').fill("8");
  await page.locator('#open-card [data-act="add-set"]').click(); await page.waitForTimeout(250);
  assert.ok((await rowsOf(page).first().innerText()).includes("−20"), await rowsOf(page).first().innerText());
  await page.locator('#view-log [data-act="jump-ex"]').first().click();   // Bench Press: weighted
  const bw0 = page.locator('#open-card input[data-f="w"]');
  await bw0.fill("0");
  await page.locator('#open-card [data-act="step"][data-f="w"][data-d="-2.5"]').click();
  assert.equal(await bw0.inputValue(), "0", "weighted weights stop at 0");
  await ctx.close();
});

test("bodyweight: rows show BW or +kg with no e1RM, more reps than last time is a PR, and the chip locks after a set", async () => {
  const { page, ctx } = await open("bw=1");
  await startPush(page);
  await addEx(page, "Push-up");
  await page.locator('#open-card input[data-f="w"]').fill("0"); await page.locator('#open-card input[data-f="r"]').fill("13");
  await page.locator('#open-card [data-act="add-set"]').click(); await page.waitForTimeout(250);
  const row = await rowsOf(page).first().innerText();
  assert.ok(row.includes("BW") && row.includes("13"), row);
  assert.equal(await rowsOf(page).first().locator(".pr").count(), 1, "13 reps beats the best earlier session (12)");
  assert.ok(!/\d\s*kg/.test(row));
  await page.locator('#open-card input[data-f="w"]').fill("10"); await page.locator('#open-card input[data-f="r"]').fill("5");
  await page.locator('#open-card [data-act="add-set"]').click(); await page.waitForTimeout(250);
  assert.ok((await rowsOf(page).nth(1).innerText()).includes("+10"));
  assert.equal(await bwChip(page).isDisabled(), true, "no switching once a set is logged");
  await ctx.close();
});

test("bodyweight: at the top of the range the advice adds a little weight, and set 1 is pre-filled", async () => {
  const { page, ctx } = await open("bw=1");
  await startPush(page);
  await addEx(page, "Push-up");
  assert.equal(await bwText(advice(page)), "Try +2.5 kg extra, start at 8 reps");
  assert.equal(await page.locator('#open-card input[data-f="w"]').inputValue(), "2.5");
  assert.equal(await page.locator('#open-card input[data-f="r"]').inputValue(), "8");
  await ctx.close();
});

test("bodyweight: a plank counts seconds and never suggests weight", async () => {
  const { page, ctx } = await open("bw=1");
  await startPush(page);
  await addEx(page, "Plank");
  assert.ok((await page.locator("#open-card .label", { hasText: /Seconds/ }).count()) >= 1, "reps are called Seconds");
  assert.equal(await bwText(advice(page)), "Aim for 60 seconds on every set");
  assert.equal(await page.locator('#open-card input[data-f="r"]').inputValue(), "60");
  assert.equal((await bwText(targetChip(page))), "Target 3 × 30–60 s");
  await ctx.close();
});

test("bodyweight: in Arabic the chip and labels are translated and the steppers keep their order", async () => {
  const { page, ctx } = await open("lang=ar&bw=1");
  await startPush(page);
  await addEx(page, "Push-up");
  assert.ok(/[؀-ۿ]/.test(await bwChip(page).innerText()));
  const xs = async sel => page.evaluate(s => document.querySelector(s).getBoundingClientRect().x, sel);
  assert.ok(await xs('#open-card [data-act="step"][data-f="w"][data-d="-2.5"]') < await xs('#open-card [data-act="step"][data-f="w"][data-d="2.5"]'));
  await ctx.close();
});

test("bodyweight: Lifts shows Best set and Sessions for a bodyweight lift, never an e1RM", async () => {
  const { page, ctx, errors } = await open("bw=1");
  await tab(page, "progress");
  await page.locator('#pills [data-view="progress"]').click();
  await page.waitForSelector("#prog-ex");
  await page.locator("#prog-ex").selectOption("Push-up");
  const txt = await page.locator("#view-progress").innerText();
  assert.ok(/BEST SET/i.test(txt), txt.slice(0, 300));
  assert.ok(txt.includes("BW × 12"), txt.slice(0, 400));
  assert.ok(!/Best e1RM/i.test(txt), "no one-rep max for a bodyweight lift");
  await page.locator("#prog-ex").selectOption("Bench Press");
  assert.ok(/Best e1RM/i.test(await page.locator("#view-progress").innerText()), "weighted lifts are unchanged");
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ---- review fixes: the two kinds of one exercise stay apart ----
test("bodyweight: deleting the only set and switching the exercise to weighted logs a weighted set", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  await addEx(page, "Push-up");
  await page.locator('#open-card input[data-f="r"]').fill("12");
  await page.locator('#open-card [data-act="add-set"]').click(); await page.waitForTimeout(250);
  await page.locator('#open-card [data-act="rm-set"]').first().click(); await page.waitForTimeout(250);
  assert.equal(await bwChip(page).isDisabled(), false, "no sets left, so it can be switched");
  await bwChip(page).click();
  assert.equal(await wLabel(page), "Weight · kg");
  await page.locator('#open-card input[data-f="w"]').fill("60"); await page.locator('#open-card input[data-f="r"]').fill("8");
  await page.locator('#open-card [data-act="add-set"]').click(); await page.waitForTimeout(250);
  const row = await rowsOf(page).first().innerText();
  assert.ok(!row.includes("+60") && row.includes("60"), row);
  assert.equal(await wLabel(page), "Weight · kg", "the card stays weighted");
  await ctx.close();
});

test("bodyweight: history from before the feature stays visible in Lifts next to new bodyweight sessions", async () => {
  const { page, ctx } = await open("bw=2");
  await tab(page, "progress");
  await page.locator('#pills [data-view="progress"]').click();
  await page.waitForSelector("#prog-ex");
  await page.locator("#prog-ex").selectOption("Pull-up");
  assert.ok(/SESSIONS\s*2/i.test(await page.locator("#view-progress").innerText()), "the old session and the new one");
  await ctx.close();
});

test("bodyweight: switching an exercise between kinds does not borrow the other kind's last session", async () => {
  const { page, ctx } = await open("bw=1");
  await startPush(page);
  assert.ok((await page.locator("#open-card .prev").first().innerText()).includes("Last time"), "Bench Press has weighted history");
  await bwChip(page).click();
  assert.ok((await page.locator("#open-card").innerText()).includes("First time logging this one"), "no bodyweight history for Bench Press");
  assert.equal(await page.locator('#open-card input[data-f="w"]').inputValue(), "0");
  await addEx(page, "Pull-up");
  assert.ok((await page.locator("#open-card").innerText()).includes("Last time"), "the bodyweight session counts for a bodyweight pull-up");
  await bwChip(page).click();
  assert.ok((await page.locator("#open-card").innerText()).includes("First time logging this one"), "a weighted pull-up has no history yet");
  assert.equal(await page.locator('#open-card input[data-f="w"]').inputValue(), "20");
  await ctx.close();
});

test("bodyweight: an old pull-up session that has the body weight typed in does not start the next one at 80 kg extra", async () => {
  const { page, ctx } = await open("bw=3");
  await startPush(page);
  await addEx(page, "Pull-up");
  assert.equal(await page.locator('#open-card input[data-f="w"]').inputValue(), "0", "reps carry over, the old weight does not");
  const card = (await page.locator("#open-card").innerText());
  assert.ok(card.includes("Last time") && card.includes("BW×5"), card.slice(0, 300));
  assert.ok(!card.includes("80"), "no 80 anywhere on the card");
  await ctx.close();
});

// ---- injuries ----
const AVOID_WRIST = "avoid=" + encodeURIComponent(JSON.stringify({ areas: ["wrist"] }));
const openExSheet = async page => { await page.locator('#view-log [data-act="open-exsheet"]').first().click(); await page.waitForSelector("#exsheet[open]"); };

test("injuries: suggestions leave out what loads an avoided area and say so; Show all brings them back", async () => {
  const { page, ctx } = await open(AVOID_WRIST);
  await startPush(page);
  await openExSheet(page);
  let sheet = await page.locator("#exsheet").innerText();
  assert.ok(!sheet.includes("Incline Barbell Press"), "it loads the wrist");
  assert.ok(sheet.includes("Machine Chest Press"), "it does not");
  assert.ok(/injur/i.test(sheet), sheet.slice(0, 600));
  await page.locator('#exsheet [data-act="gym-showall"]').click();
  sheet = await page.locator("#exsheet").innerText();
  assert.ok(sheet.includes("Incline Barbell Press"), "Show all shows everything");
  await ctx.close();
});

test("injuries: the type-ahead list drops avoided library names but keeps what is already on the day", async () => {
  const { page, ctx } = await open(AVOID_WRIST);
  await startPush(page);
  await openExSheet(page);
  const opts = await page.locator("#exl-sheet option").evaluateAll(os => os.map(o => o.value));
  assert.ok(!opts.includes("Incline Barbell Press"), opts.join(","));
  assert.ok(opts.includes("Bench Press"), "Bench Press is on the day, so it stays");
  await ctx.close();
});

test("injuries: with nothing avoided suggestions are exactly as before", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  await openExSheet(page);
  const sheet = await page.locator("#exsheet").innerText();
  assert.ok(sheet.includes("Incline Barbell Press"));
  assert.ok(!/injur/i.test(sheet));
  await ctx.close();
});

const openGym = async page => { await tab(page, "plan"); await page.locator('#pills [data-view="gym"]').click(); await page.waitForSelector("#view-gym .card"); };
const areaChip = (page, id) => page.locator(`#view-gym [data-act="avoid-area"][data-id="${id}"]`);

test("injuries: My Gym has an Injuries card with seven area chips of at least 44px", async () => {
  const { page, ctx } = await open();
  await openGym(page);
  const txt = await page.locator("#view-gym").innerText();
  assert.ok(/INJURIES/i.test(txt) && /not medical advice/i.test(txt), txt.slice(0, 200));
  assert.equal(await page.locator('#view-gym [data-act="avoid-area"]').count(), 7);
  const heights = await page.locator('#view-gym [data-act="avoid-area"]').evaluateAll(bs => bs.map(b => b.getBoundingClientRect().height));
  assert.ok(heights.every(h => h >= 43.5), heights.join(","));
  await ctx.close();
});

test("injuries: tapping an area presses its chip, counts the hidden exercises, and the suggestions follow", async () => {
  const { page, ctx } = await open();
  await openGym(page);
  await areaChip(page, "wrist").click();
  assert.equal(await areaChip(page, "wrist").getAttribute("aria-pressed"), "true");
  assert.ok(/\d+ exercises hidden/i.test(await page.locator("#view-gym").innerText()));
  await tab(page, "today"); await startPush(page); await openExSheet(page);
  assert.ok(!(await page.locator("#exsheet").innerText()).includes("Incline Barbell Press"));
  await page.locator('#exsheet [data-act="sheet-close"]').first().click();
  await openGym(page);
  assert.equal(await areaChip(page, "wrist").getAttribute("aria-pressed"), "true", "still chosen after leaving and coming back");
  await areaChip(page, "wrist").click();
  assert.equal(await areaChip(page, "wrist").getAttribute("aria-pressed"), "false");
  await ctx.close();
});

test("injuries: an exercise can be avoided by name from the card and removed again", async () => {
  const { page, ctx } = await open();
  await openGym(page);
  await page.locator("#avoid-ex").fill("barbell row");
  await page.locator('#avoid-form button[type="submit"]').click();
  const list = page.locator("#view-gym .avoidlist");
  assert.ok((await list.innerText()).includes("Barbell Row"), "stored with the library spelling");
  await page.locator('#view-gym [data-act="avoid-remove"]').first().click();
  assert.equal(await page.locator("#view-gym .avoidlist").count() === 0 || !(await page.locator("#view-gym .avoidlist").innerText()).includes("Barbell Row"), true);
  await ctx.close();
});

test("injuries: the exercise info sheet can start and stop avoiding an exercise", async () => {
  const { page, ctx } = await open();
  await startPush(page);
  await page.locator('#open-card .ex-name[data-act="ex-info"]').first().click();
  await page.waitForSelector("#exinfo[open]");
  const btn = page.locator('#exinfo [data-act="avoid-toggle"]');
  assert.equal((await btn.innerText()).trim(), "Avoid this exercise");
  await btn.click();
  assert.equal((await page.locator('#exinfo [data-act="avoid-toggle"]').innerText()).trim(), "Stop avoiding");
  await page.locator('#exinfo [data-act="exinfo-close"]').click();
  await openGym(page);
  assert.ok((await page.locator("#view-gym .avoidlist").innerText()).includes("Bench Press"));
  await ctx.close();
});

test("injuries: in Arabic the area chips are translated", async () => {
  const { page, ctx } = await open("lang=ar");
  await openGym(page);
  const chips = await page.locator('#view-gym [data-act="avoid-area"]').allInnerTexts();
  assert.equal(chips.length, 7);
  assert.ok(chips.every(c => /[؀-ۿ]/.test(c)), chips.join("|"));
  await ctx.close();
});

// ---- injuries: warnings on what is already there ----
const AVOID_LATERAL = "avoid=" + encodeURIComponent(JSON.stringify({ exercises: ["Lateral Raise"] }));
const chipOf = (page, name) => page.locator(`#exchips [data-name="${name}"]`);

test("injuries: an avoided exercise on today's workout is marked on its chip and explained on its card", async () => {
  const { page, ctx } = await open(AVOID_WRIST);
  await startPush(page);
  assert.equal(await chipOf(page, "Bench Press").locator(".avoidtag").count(), 1);
  assert.equal(await chipOf(page, "Lateral Raise").locator(".avoidtag").count(), 0, "it loads only the shoulder");
  assert.ok((await page.locator("#open-card .avoidnote").innerText()).includes("You chose to avoid this: it loads your wrist."));
  await ctx.close();
});

test("injuries: Skip it removes an avoided exercise with no sets, and is gone once a set is logged", async () => {
  const { page, ctx } = await open(AVOID_WRIST);
  await startPush(page);
  await page.locator('#open-card [data-act="skip-avoided"]').click();
  assert.equal(await chipOf(page, "Bench Press").count(), 0, "skipped for today");
  await chipOf(page, "Overhead Press").click();
  assert.equal(await page.locator('#open-card [data-act="skip-avoided"]').count(), 1);
  await addSetWith(page, 40, 8);
  assert.equal(await page.locator('#open-card [data-act="skip-avoided"]').count(), 0, "a logged exercise is never removed");
  assert.equal(await chipOf(page, "Overhead Press").count(), 1);
  await ctx.close();
});

test("injuries: the Days editor and the day card mark avoided exercises, and nothing is removed", async () => {
  const { page, ctx } = await open(AVOID_WRIST);
  await tab(page, "plan");
  await page.waitForSelector('#view-days [data-act="edit-day"]');
  assert.ok(await page.locator("#view-days .daysum .avoidtag").count() >= 1, "the collapsed card shows the mark");
  await page.locator('#view-days [data-act="edit-day"][data-id="d1"]').first().click();
  const rows = page.locator("#view-days .exlist li");
  assert.ok((await rows.count()) >= 3, "all three exercises stay");
  assert.equal(await rows.filter({ hasText: "Bench Press" }).locator(".avoidtag").count(), 1);
  assert.equal(await rows.filter({ hasText: "Lateral Raise" }).locator(".avoidtag").count(), 0);
  await ctx.close();
});

test("injuries: the exercise info sheet explains why, and an exercise avoided by name says so", async () => {
  const { page, ctx } = await open(AVOID_WRIST);
  await startPush(page);
  await page.locator('#open-card .ex-name[data-act="ex-info"]').first().click();
  await page.waitForSelector("#exinfo[open]");
  assert.ok((await page.locator("#exinfo .avoidnote").innerText()).includes("wrist"));
  await ctx.close();
  const b = await open(AVOID_LATERAL);
  await startPush(b.page);
  await chipOf(b.page, "Lateral Raise").click();
  assert.ok((await b.page.locator("#open-card .avoidnote").innerText()).includes("You chose to avoid this exercise."));
  await b.ctx.close();
});

test("injuries: nothing is marked when nothing is avoided, and the warning text is Arabic in Arabic", async () => {
  const a = await open();
  await startPush(a.page);
  assert.equal(await a.page.locator(".avoidtag, .avoidnote").count(), 0);
  await a.ctx.close();
  const b = await open("lang=ar&" + AVOID_WRIST);
  await startPush(b.page);
  assert.ok(/[؀-ۿ]/.test(await b.page.locator("#open-card .avoidnote").innerText()));
  await b.ctx.close();
});

// ---- injuries: review fixes ----
test("injuries: Show all keeps the warning on the exercises it brings back", async () => {
  const { page, ctx } = await open(AVOID_WRIST);
  await startPush(page);
  await openExSheet(page);
  await page.locator('#exsheet [data-act="gym-showall"]').click();
  assert.equal(await page.locator('#exsheet [data-name="Incline Barbell Press"] .avoidtag').count(), 1);
  assert.equal(await page.locator('#exsheet [data-name="Machine Chest Press"] .avoidtag').count(), 0);
  await ctx.close();
});

test("injuries: text typed in the avoid field survives tapping an area, and a duplicate says so", async () => {
  const { page, ctx } = await open();
  await openGym(page);
  await page.locator("#avoid-ex").fill("bar");
  await areaChip(page, "knee").click();
  assert.equal(await page.locator("#avoid-ex").inputValue(), "bar");
  await page.locator("#avoid-ex").fill("Barbell Row");
  await page.locator('#avoid-form button[type="submit"]').click();
  assert.equal(await page.locator("#avoid-ex").inputValue(), "", "cleared after adding");
  await page.locator("#avoid-ex").fill("barbell row");
  await page.locator('#avoid-form button[type="submit"]').click();
  assert.ok(/already/i.test(await page.locator("#toast").innerText()));
  await ctx.close();
});

test("injuries: while Show all is on the card says nothing is hidden", async () => {
  const { page, ctx } = await open(AVOID_WRIST);
  await startPush(page);
  await openExSheet(page);
  await page.locator('#exsheet [data-act="gym-showall"]').click();
  await page.locator('#exsheet [data-act="sheet-close"]').first().click();
  await openGym(page);
  assert.ok((await page.locator("#view-gym").innerText()).includes("Nothing hidden."));
  await ctx.close();
});

// ---- Plan my training remembers its answers ----
const PLAN_MEM = "plan=" + encodeURIComponent(JSON.stringify({ days: 4, experience: "intermediate", family: "upper-lower" }));
const openJourneyFromPlan = async page => {
  await tab(page, "plan");
  await page.locator('#view-days [data-act="open-plansheet"]').click(); await page.waitForSelector("#plansheet[open]");
  await page.locator('#plansheet [data-act="journey-open"]').click(); await page.waitForSelector("#view-journey:not([hidden])");
  await page.waitForTimeout(300);
};
const jrTitle = async page => (await page.locator("#view-journey h2").first().textContent()).trim();

test("plan my training: a first run asks the questions from the start", async () => {
  const { page, ctx } = await open();
  await openJourneyFromPlan(page);
  assert.notEqual(await jrTitle(page), "Your week");
  assert.equal(await page.locator('#view-journey [data-act="jr-edit"]').count(), 0);
  await ctx.close();
});

test("plan my training: with remembered answers it opens at the preview, and Change my answers walks the steps with them filled in", async () => {
  const { page, ctx } = await open(PLAN_MEM);
  await openJourneyFromPlan(page);
  assert.equal(await jrTitle(page), "Your week");
  assert.equal(await page.locator("#view-journey .card").count(), 4, "four training days from the remembered answers");
  assert.equal(await page.locator('#view-journey [data-act="jr-start"]').isDisabled(), false);
  await page.locator('#view-journey [data-act="jr-edit"]').click();
  assert.notEqual(await jrTitle(page), "Your week", "back at the first step");
  assert.ok(await page.locator('#view-journey [aria-pressed="true"]').count() >= 1, "the goal is already picked");
  await ctx.close();
});

test("plan my training: finishing a run saves the answers, so the next run opens at the preview", async () => {
  const { page, ctx } = await open();
  await openJourneyFromPlan(page);
  const next = () => page.locator('#view-journey [data-act="jr-next"]').click();
  await next();                                                                           // goal (already picked from the profile)
  await page.locator('#view-journey [data-act="jr-family"][data-v="ppl"]').click(); await next();   // split
  await page.locator('#view-journey [data-act="jr-days"][data-v="6"]').click(); await next();        // days
  await page.locator('#view-journey [data-act="jr-gym"][data-v="none"]').click(); await next();      // gym
  await page.locator('#view-journey [data-act="jr-exp"][data-v="beginner"]').click(); await next();  // experience
  assert.equal(await jrTitle(page), "Your week");
  await page.locator('#view-journey [data-act="jr-start"]').click(); await page.waitForTimeout(500);
  await openJourneyFromPlan(page);
  assert.equal(await jrTitle(page), "Your week", "remembered");
  assert.equal(await page.locator("#view-journey .card").count(), 6, "six days, as chosen last time");
  await ctx.close();
});

// ---- deload ----
test("deload: Last time skips a deload-week session, Lifts still lists it", async () => {
  const { page, ctx } = await open("deloadwk=1");
  await startPush(page);
  const prev = await page.locator("#open-card .prev").first().innerText();
  assert.ok(prev.includes("Last time") && prev.includes("61×8") && !prev.includes("30×8"), prev);
  await ctx.close();
  const b = await open("deloadwk=1");
  await tab(b.page, "progress");
  await b.page.locator('#pills [data-view="progress"]').click();
  await b.page.waitForSelector("#prog-ex");
  await b.page.locator("#prog-ex").selectOption("Bench Press");
  assert.ok((await b.page.locator("#view-progress").innerText()).includes("30×8"), "the light session is still training history");
  await b.ctx.close();
});

const bannerText = async page => (await page.locator("#view-log").innerText());
const DELOAD_START_TODAY = "deload=" + encodeURIComponent(JSON.stringify({ start: new Date().toLocaleDateString("en-CA") }));
const daysAgoISO = n => new Date(Date.now() - n * 864e5).toLocaleDateString("en-CA");

test("deload: a long streak or several stalled lifts shows the suggestion; a short streak shows nothing", async () => {
  const a = await open("streak=8");
  let txt = await bannerText(a.page);
  assert.ok(txt.includes("Time for an easy week?") && /trained \d+ weeks in a row/.test(txt), txt.slice(0, 400));
  await a.ctx.close();
  const b = await open("stalled=1");
  txt = await bannerText(b.page);
  assert.ok(txt.includes("Time for an easy week?") && txt.includes("stalled"), txt.slice(0, 400));
  await b.ctx.close();
  const c = await open("streak=3");
  assert.ok(!(await bannerText(c.page)).includes("Time for an easy week?"));
  await c.ctx.close();
});

test("deload: Not now hides the suggestion, Start shows the week, End deload closes it and the suggestion stays away", async () => {
  const { page, ctx } = await open("streak=8");
  await page.locator('#view-log [data-act="deload-later"]').click();
  assert.ok(!(await bannerText(page)).includes("Time for an easy week?"), "dismissed");
  await ctx.close();
  const b = await open("streak=8");
  await b.page.locator('#view-log [data-act="deload-start"]').click();
  let txt = await bannerText(b.page);
  assert.ok(txt.includes("Deload week · day 1 of 7") && txt.includes("90%"), txt.slice(0, 400));
  await b.page.locator('#view-log [data-act="deload-end"]').click();
  txt = await bannerText(b.page);
  assert.ok(!txt.includes("Deload week") && !txt.includes("Time for an easy week?"), "ended, and the cooldown keeps the suggestion away");
  await b.ctx.close();
});

test("deload: a stored deload opens active; one that is over shows nothing; Arabic renders", async () => {
  const a = await open(DELOAD_START_TODAY);
  assert.ok((await bannerText(a.page)).includes("Deload week · day 1 of 7"));
  await a.ctx.close();
  const old = "deload=" + encodeURIComponent(JSON.stringify({ start: daysAgoISO(8) }));
  const b = await open(old);
  assert.ok(!(await bannerText(b.page)).includes("Deload week"));
  await b.ctx.close();
  const c = await open("lang=ar&streak=8");
  assert.ok(/[؀-ۿ]/.test(await c.page.locator('#view-log [data-act="deload-start"]').innerText()));
  await c.ctx.close();
});

test("deload: during a deload week the card shows the lighter plan and pre-fills it", async () => {
  const { page, ctx } = await open(DELOAD_START_TODAY);
  await startPush(page);
  assert.equal((await bwText(advice(page))), "Deload: 55 kg for about 2 sets", "90% of the last normal 62.5 kg, to 2.5 kg");
  assert.equal(await page.locator('#open-card input[data-f="w"]').inputValue(), "55");
  assert.equal(await page.locator('#open-card input[data-f="r"]').inputValue(), "6", "the reps done at the top weight last time");
  await ctx.close();
});

test("deload: bodyweight exercises get a set count only, a new exercise gets no line, and the normal advice returns when the week is over", async () => {
  const a = await open(DELOAD_START_TODAY + "&bw=1");
  await startPush(a.page);
  await addEx(a.page, "Push-up");
  assert.equal(await bwText(advice(a.page)), "Deload: about 2 sets, stay well short of your best");
  assert.equal(await a.page.locator('#open-card input[data-f="w"]').inputValue(), "0");
  await addEx(a.page, "Zottman Move");
  assert.equal(await advice(a.page).count(), 0, "no history, no line");
  await a.ctx.close();
  const over = "deload=" + encodeURIComponent(JSON.stringify({ start: daysAgoISO(8) }));
  const b = await open(over);
  await startPush(b.page);
  assert.ok(!(await bwText(advice(b.page))).includes("Deload"), "the week is over");
  await b.ctx.close();
});

test("deload: in Arabic the deload line is translated", async () => {
  const { page, ctx } = await open("lang=ar&" + DELOAD_START_TODAY);
  await startPush(page);
  assert.ok(/[؀-ۿ]/.test(await advice(page).innerText()));
  await ctx.close();
});

test("deload: starting or ending a deload refreshes the pre-fill of an exercise that is already open", async () => {
  const { page, ctx } = await open("streak=8");
  await startPush(page);
  const w = page.locator('#open-card input[data-f="w"]');
  assert.equal(await w.inputValue(), "62.5", "normal pre-fill");
  await page.locator('#view-log [data-act="deload-start"]').click();
  assert.equal(await w.inputValue(), "55", "the lighter plan, without reopening the exercise");
  await page.locator('#view-log [data-act="deload-end"]').click();
  assert.equal(await w.inputValue(), "62.5", "back to normal");
  await ctx.close();
});

// ---- workout screen 2.0: demo on the card ----
const GIF_1PX = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const gifHost = async ctx => { ctx.__gifHits = []; await ctx.route("https://cdn.jsdelivr.net/**", route => { ctx.__gifHits.push(route.request().url()); return route.fulfill({ status: 200, contentType: "image/gif", headers: { "access-control-allow-origin": "*" }, body: GIF_1PX }); }); };
const gifHostDown = async ctx => { await ctx.route("https://cdn.jsdelivr.net/**", route => route.abort()); };

test("the workout card shows the exercise GIF as a small thumbnail beside the name and tags", async () => {
  const { page, ctx, errors } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  const img = page.locator("#open-card .demo img.demo-gif");
  await img.waitFor();
  assert.match(await img.getAttribute("src"), /\/videos\/0025-EIeI8Vf\.gif$/, "Bench Press shows its own GIF");
  const box = await page.locator("#open-card .demo").boundingBox();
  assert.ok(box.width <= 112 && box.width >= 80, "thumbnail width " + box.width);
  const name = await page.locator("#open-card .ex-name").boundingBox();
  assert.ok(Math.abs(name.y - box.y) < 40, "the name sits beside the thumbnail");
  const tags = (await page.locator("#open-card .tagrow .tag2").allTextContents()).map(s => s.trim());
  assert.ok(tags.includes("Chest"), "muscle tag: " + tags);
  assert.ok(tags.some(x => /barbell/i.test(x)), "equipment tag: " + tags);
  assert.equal(await page.locator('#open-card [data-act="demo-full"]').count(), 1, "full-screen button");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("a custom exercise has no demo and no empty gap, and still logs sets", async () => {
  const { page, ctx, errors } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  await addEx(page, "My Cable Thing");
  assert.equal(await page.locator("#open-card .demo").count(), 0);
  const nameBox = await page.locator("#open-card .ex-name").boundingBox(), cardBox = await page.locator("#open-card").boundingBox();
  assert.ok(nameBox.y - cardBox.y < 90, "name is near the top of the card");
  await page.locator("#w-" + (await page.locator("#open-card [id^=w-]").first().getAttribute("id")).slice(2)).fill("20");
  await page.locator('#open-card [data-act="add-set"]').click(); await page.waitForTimeout(250);
  assert.equal(await page.locator("#open-card tr.setrow").count(), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("when the GIF cannot load the demo box goes away, with no broken image and no gap", async () => {
  const { page, ctx, errors } = await open("", undefined, undefined, gifHostDown);
  await swReady(page); await failCdnInSw(ctx);   // the service worker answers the picture requests, so make its network fail
  await startPush(page);
  await page.waitForFunction(() => !document.querySelector("#open-card .demo"));
  assert.equal(await page.locator("#open-card img.demo-gif").count(), 0, "failed image removed");
  const nameBox = await page.locator("#open-card .ex-name").boundingBox(), cardBox = await page.locator("#open-card").boundingBox();
  assert.ok(nameBox.y - cardBox.y < 90, "the name moves up to the top of the card");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("a bad ironlog.demo value or a throwing localStorage still gives the thumbnail", async () => {
  for (const init of ['try{localStorage.setItem("ironlog.demo","garbage")}catch(e){}', 'Object.defineProperty(window,"localStorage",{get(){throw new Error("blocked")}})']) {
    const { page, ctx, errors } = await open("", undefined, init, gifHost);
    await startPush(page);
    await page.locator("#open-card .demo").waitFor();
    assert.ok((await page.locator("#open-card .demo").boundingBox()).width <= 112, init);
    assert.deepEqual(errors.filter(e => !/blocked/.test(e)), []);
    await ctx.close();
  }
});

// ---- workout screen 2.0: full-screen demo viewer and the large-demo switch ----
test("the full-screen button opens the viewer: pause shows the still, X and Back close it", async () => {
  const { page, ctx, errors } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  await page.locator('#open-card [data-act="demo-full"]').click();
  await page.waitForSelector("#demoview[open]");
  const img = page.locator("#demoview img.demoview-img");
  assert.match(await img.getAttribute("src"), /\/videos\/0025-EIeI8Vf\.gif$/);
  const w = (await img.boundingBox()).width;
  assert.ok(w >= 200 && w <= 250, "viewer image at most 240 px (the source is 180 px, so a smaller picture looks sharper), got " + w);
  const pause = page.locator('#demoview [data-act="demo-pause"]');
  assert.equal(await pause.getAttribute("aria-pressed"), "false");
  await pause.click();
  assert.match(await img.getAttribute("src"), /\/images\/0025-EIeI8Vf\.jpg$/);
  assert.equal(await pause.getAttribute("aria-pressed"), "true");
  await pause.click();
  assert.match(await img.getAttribute("src"), /\.gif$/);
  await page.locator('#demoview [data-act="demo-view-close"]').click();
  await page.waitForFunction(() => !document.querySelector("#demoview").open);
  await page.locator('#open-card [data-act="demo-full"]').click();
  await page.waitForSelector("#demoview[open]");
  await page.goBack();
  await page.waitForFunction(() => !document.querySelector("#demoview").open);
  assert.equal(await title(page), "Today");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("Me > Appearance: the large demo switch shows the big box on the card and survives a reload", async () => {
  const { page, ctx, errors } = await open("", undefined, undefined, gifHost);
  await tab(page, "me");
  const full = page.locator('[data-act="demo-size-set"][data-v="full"]'), mini = page.locator('[data-act="demo-size-set"][data-v="mini"]');
  assert.equal(await mini.getAttribute("aria-pressed"), "true", "mini is the default");
  await full.click();
  assert.equal(await full.getAttribute("aria-pressed"), "true");
  assert.equal(await page.evaluate(() => localStorage.getItem("ironlog.demo")), "full");
  await tab(page, "today"); await startPush(page);
  const big = await page.locator("#open-card .demo.big").boundingBox();
  assert.ok(big.width > 200, "inline big box, width " + big.width);
  assert.ok(big.height <= 190, "capped height " + big.height);
  await page.reload(); await page.waitForSelector(".tabbar:not([hidden])");
  await tab(page, "me");
  assert.equal(await page.locator('[data-act="demo-size-set"][data-v="full"]').getAttribute("aria-pressed"), "true");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("the viewer works in Arabic without sideways scrolling", async () => {
  const { page, ctx, errors } = await open("lang=ar", undefined, undefined, gifHost);
  await startPush(page);
  await page.locator('#open-card [data-act="demo-full"]').click();
  await page.waitForSelector("#demoview[open]");
  assert.equal(await page.evaluate(() => document.documentElement.dir), "rtl");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no horizontal scroll");
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ---- workout screen 2.0: planned set rows with a tick, and the why line ----
const targetSets = async page => +(/Target (\d+)/.exec(await page.locator("#open-card button.chip[data-act='target-edit']").first().textContent())[1]);
const planned = page => page.locator("#open-card .prow");
const liveTick = page => page.locator('#open-card .prow button[data-act="add-set"]');

test("planned rows: one per target set, only the next tick is live, ticking logs the set and starts the rest bar", async () => {
  const { page, ctx, errors } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  const n = await targetSets(page);
  assert.equal(await planned(page).count(), n);
  assert.equal(await liveTick(page).count(), 1, "only the next planned row has a live tick");
  assert.equal(await page.locator('#open-card .prow[aria-disabled="true"]').count(), n - 1);
  assert.equal(await page.locator('#open-card button.btn.primary[data-act="add-set"]').count(), 0, "no separate Add set button while rows are planned");
  const w = await page.locator("#w-0").inputValue(), r = await page.locator("#r-0").inputValue();
  await liveTick(page).click(); await page.waitForTimeout(300);
  assert.equal(await rowsOf(page).count(), 1);
  const cells = await rowsOf(page).first().locator("td").allTextContents();
  assert.ok(cells[1].includes(w.replace(/\.0$/, "")) && cells[2].trim() === r, "logged with the values in the steppers: " + cells);
  assert.equal(await planned(page).count(), n - 1);
  assert.equal(await page.locator("#restbar").isVisible(), true, "rest timer started");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("planned rows: after the last planned set the Add set button takes over and extra sets keep working", async () => {
  const { page, ctx } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  const n = await targetSets(page);
  for (let i = 0; i < n; i++) { await liveTick(page).click(); await page.waitForTimeout(250); }
  assert.equal(await planned(page).count(), 0);
  const add = page.locator('#open-card [data-act="add-set"]');
  assert.equal((await add.textContent()).trim(), "Add set " + (n + 1));
  await add.click(); await page.waitForTimeout(250);
  assert.equal(await rowsOf(page).count(), n + 1);
  assert.equal(await planned(page).count(), 0, "more sets than the target never makes a negative or planned row");
  assert.equal((await page.locator('#open-card [data-act="add-set"]').textContent()).trim(), "Add set " + (n + 2));
  await ctx.close();
});

test("planned rows: a warm-up or a drop set does not use up a planned row", async () => {
  const { page, ctx } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  const n = await targetSets(page);
  await kindChip(page, "warmup").click();
  await liveTick(page).click(); await page.waitForTimeout(250);
  assert.equal(await rowsOf(page).count(), 1);
  assert.equal(await planned(page).count(), n, "warm-up left the planned rows alone");
  await ctx.close();
});

test("planned rows: while a logged set is being edited the rows give way to Save set", async () => {
  const { page, ctx } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  await liveTick(page).click(); await page.waitForTimeout(250);
  await rowsOf(page).first().click();
  assert.equal(await planned(page).count(), 0);
  assert.match(await page.locator('#open-card [data-act="save-set"]').textContent(), /Save set 1/);
  await ctx.close();
});

test("planned rows: the live row follows the steppers", async () => {
  const { page, ctx } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  const before = await page.locator("#open-card .prow").first().locator(".pval").textContent();
  await page.locator('#open-card [data-act="step"][data-f="w"][data-d="2.5"]').click();
  const after = await page.locator("#open-card .prow").first().locator(".pval").textContent();
  assert.notEqual(before, after);
  await ctx.close();
});

test("planned rows: a deload week plans the lighter number of sets", async () => {
  const { page, ctx } = await open(DELOAD_START_TODAY, undefined, undefined, gifHost);
  await startPush(page);
  const n = await planned(page).count();
  const text = await page.locator("#open-card .advice").first().textContent();
  const m = /about (\d+) set/.exec(text);
  assert.ok(m, "deload advice names a set count: " + text);
  assert.equal(n, +m[1]);
  await ctx.close();
});

test("the why line explains the advice for an exercise with history and is absent for a new one", async () => {
  const { page, ctx } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  const why = page.locator("#open-card .advice-why");
  assert.equal(await why.count(), 1);
  assert.ok((await why.textContent()).trim().length > 10);
  await addEx(page, "Brand New Lift");
  assert.equal(await page.locator("#open-card .advice-why").count(), 0);
  await ctx.close();
});

test("planned rows mirror in Arabic and cause no sideways scrolling", async () => {
  const { page, ctx, errors } = await open("lang=ar", undefined, undefined, gifHost);
  await startPush(page);
  assert.ok(await planned(page).count() >= 1);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const tick = await liveTick(page).boundingBox();
  assert.ok(tick.width >= 44 && tick.height >= 44, "tick is a 44 px target");
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ---- looks: Classic (default), Carbon, Bloom ----
const lookInit = look => `try{localStorage.setItem("ironlog.look",${JSON.stringify(look)})}catch(e){}`;
const rootVar = (page, name) => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
const dataLook = page => page.evaluate(() => document.documentElement.dataset.look || null);

test("looks: with no saved look the page is Classic (no data-look, today's card radius)", async () => {
  const { page, ctx, errors } = await open();
  assert.equal(await dataLook(page), null);
  assert.equal(await rootVar(page, "--r-card"), "20px");
  assert.ok(await page.evaluate(() => [...document.styleSheets].some(s => (s.href || "").endsWith("/looks.css"))), "looks.css is linked");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("looks: a saved look is on <html> before the page draws and changes the tokens", async () => {
  for (const [look, radius] of [["carbon", "18px"], ["bloom", "24px"]]) {
    const { page, ctx, errors } = await open("", undefined, lookInit(look));
    assert.equal(await dataLook(page), look);
    assert.equal(await rootVar(page, "--r-card"), radius, look);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test("looks: an unknown saved value or a throwing localStorage gives Classic without errors", async () => {
  for (const init of [lookInit("CARBON"), lookInit("x"), lookInit(""), 'Object.defineProperty(window,"localStorage",{get(){throw new Error("blocked")}})']) {
    const { page, ctx, errors } = await open("", undefined, init);
    assert.equal(await dataLook(page), null, init);
    assert.deepEqual(errors.filter(e => !/blocked/.test(e)), [], init);
    await ctx.close();
  }
});

test("looks: Me > Appearance has three tiles; Carbon sets its accent and swatches, Classic restores plate blue; both survive a reload", async () => {
  const { page, ctx, errors } = await open();
  await tab(page, "me");
  assert.deepEqual(await page.locator('[data-act="look-set"]').evaluateAll(els => els.map(e => e.dataset.v)), ["classic", "carbon", "bloom"]);
  assert.equal(await page.locator('[data-act="look-set"][data-v="classic"]').getAttribute("aria-pressed"), "true");
  await page.locator('[data-act="look-set"][data-v="carbon"]').click();
  assert.equal(await dataLook(page), "carbon");
  assert.equal(await page.evaluate(() => localStorage.getItem("ironlog.accent")), "#ff7a2f");
  assert.equal(await page.locator("#accent-swatches .swatch").count(), 7, "six Carbon accents plus custom");
  await page.reload(); await page.waitForSelector(".tabbar:not([hidden])");
  assert.equal(await dataLook(page), "carbon");
  await tab(page, "me");
  assert.equal(await page.locator('[data-act="look-set"][data-v="carbon"]').getAttribute("aria-pressed"), "true");
  await page.locator('[data-act="look-set"][data-v="classic"]').click();
  assert.equal(await dataLook(page), null);
  assert.equal(await page.evaluate(() => localStorage.getItem("ironlog.accent")), "plate");
  assert.equal(await page.locator("#accent-swatches .swatch").count(), 9, "eight Classic accents plus custom");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("looks: every main screen fits the phone in Carbon and Bloom, light and dark, English and Arabic", async () => {
  for (const look of ["carbon", "bloom"]) for (const theme of ["light", "dark"]) for (const lang of ["en", "ar"]) {
    const init = lookInit(look) + `try{localStorage.setItem("ironlog.theme","${theme}");localStorage.setItem("ironlog.lang","${lang}")}catch(e){}`;
    const { page, ctx, errors } = await open("", { width: 360, height: 740 }, init);
    for (const id of ["today", "plan", "progress", "friends", "me"]) {
      await tab(page, id); await page.waitForTimeout(150);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${look} ${theme} ${lang} ${id}: no sideways scroll`);
    }
    const bar = await page.locator(".tabbar button").first().boundingBox();
    assert.ok(bar.height >= 44, `${look} ${theme} ${lang}: tab targets`);
    assert.deepEqual(errors, [], `${look} ${theme} ${lang}`);
    await ctx.close();
  }
});

// ---- looks: the first-launch picker and the "New looks" card (query token `pick=1` = do not pre-save a look) ----
const pickerOpen = page => page.locator("#lookpick[open]");
const journeyShown = page => page.locator("#view-journey").isVisible();
const pickCard = (page, look) => page.locator(`#lookpick [data-act="lp-card"][data-v="${look}"]`);

test("picker: a new person is asked before the journey; the sex answer preselects the suggested look and Choose applies it", async () => {
  const { page, ctx, errors } = await open("fresh=2&pick=1");
  await pickerOpen(page).waitFor();
  assert.equal(await journeyShown(page), false, "the journey waits for the picker");
  assert.equal(await page.locator('#lookpick [data-act="lp-card"]').count(), 2, "Carbon and Bloom previews");
  assert.equal(await page.locator('#lookpick [data-act="lp-choose"]').isDisabled(), true, "nothing suggested yet");
  await page.locator('#lookpick [data-act="lp-sex"][data-v="male"]').click();
  assert.equal(await pickCard(page, "carbon").getAttribute("aria-pressed"), "true");
  assert.equal(await pickCard(page, "bloom").getAttribute("aria-pressed"), "false");
  assert.match(await pickCard(page, "carbon").textContent(), /Suggested/);
  await page.locator('#lookpick [data-act="lp-sex"][data-v="female"]').click();
  assert.equal(await pickCard(page, "bloom").getAttribute("aria-pressed"), "true");
  await page.locator('#lookpick [data-act="lp-sex"][data-v="male"]').click();
  await page.locator('#lookpick [data-act="lp-choose"]').click();
  await page.waitForFunction(() => !document.querySelector("#lookpick").open);
  assert.equal(await dataLook(page), "carbon");
  assert.equal(await page.evaluate(() => localStorage.getItem("ironlog.look")), "carbon");
  assert.equal(await page.evaluate(() => localStorage.getItem("ironlog.accent")), "#ff7a2f");
  await page.waitForSelector("#view-journey", { state: "visible" });
  const calls = await page.evaluate(() => localStorage.__calls || "");
  const profileCall = JSON.parse(calls).find(c => c.startsWith("setDoc:profile:"));
  assert.ok(profileCall, "the profile was written: " + calls.slice(-300));
  assert.equal(JSON.parse(profileCall.slice("setDoc:profile:".length)).sex, "male");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("picker: 'Prefer not to say' preselects nothing; tapping a card selects it", async () => {
  const { page, ctx } = await open("fresh=2&pick=1");
  await pickerOpen(page).waitFor();
  await page.locator('#lookpick [data-act="lp-sex"][data-v="skip"]').click();
  assert.equal(await pickCard(page, "carbon").getAttribute("aria-pressed"), "false");
  assert.equal(await pickCard(page, "bloom").getAttribute("aria-pressed"), "false");
  await pickCard(page, "bloom").click();
  assert.equal(await pickCard(page, "bloom").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator('#lookpick [data-act="lp-choose"]').isDisabled(), false);
  await ctx.close();
});

test("picker: 'Keep the classic look' saves Classic and the journey still starts; a reload before choosing asks again", async () => {
  const a = await open("fresh=2&pick=1");
  await pickerOpen(a.page).waitFor();
  await a.page.reload(); await a.page.waitForSelector(".tabbar", { state: "attached" });
  await pickerOpen(a.page).waitFor();
  await a.page.locator('#lookpick [data-act="lp-classic"]').click();
  await a.page.waitForFunction(() => !document.querySelector("#lookpick").open);
  assert.equal(await dataLook(a.page), null);
  assert.equal(await a.page.evaluate(() => localStorage.getItem("ironlog.look")), "classic");
  await a.page.waitForSelector("#view-journey", { state: "visible" });
  await a.ctx.close();
});

test("New looks card: an existing person sees it once, 'Not now' is remembered, 'See looks' opens the picker without the sex question", async () => {
  const { page, ctx, errors } = await open("pick=1");
  const card = page.locator("#view-log .lookhint");
  await card.waitFor();
  assert.equal(await pickerOpen(page).count(), 0, "nothing pops up over the workout");
  await page.locator('#view-log [data-act="look-hint-open"]').click();
  await pickerOpen(page).waitFor();
  assert.equal(await page.locator('#lookpick [data-act="lp-sex"]').count(), 0, "no sex question for someone who already has a profile");
  await page.locator('#lookpick [data-act="lp-card"][data-v="bloom"]').click();
  await page.locator('#lookpick [data-act="lp-choose"]').click();
  await page.waitForFunction(() => !document.querySelector("#lookpick").open);
  assert.equal(await dataLook(page), "bloom");
  assert.equal(await page.locator("#view-log .lookhint").count(), 0, "the card is gone once a look is chosen");
  assert.deepEqual(errors, []);
  await ctx.close();
  const b = await open("pick=1");
  await b.page.locator("#view-log .lookhint").waitFor();
  await b.page.locator('#view-log [data-act="look-hint-close"]').click();
  await b.page.reload(); await b.page.waitForSelector(".tabbar:not([hidden])"); await b.page.waitForTimeout(600);
  assert.equal(await b.page.locator("#view-log .lookhint").count(), 0, "dismissed for good");
  await b.ctx.close();
});

test("picker: Arabic is right-to-left and fits the phone", async () => {
  const { page, ctx, errors } = await open("fresh=2&pick=1&lang=ar", { width: 360, height: 740 });
  await pickerOpen(page).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dir), "rtl");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  for (const sel of ['[data-act="lp-sex"]', '[data-act="lp-card"]', '[data-act="lp-choose"]']) {
    for (const h of await page.locator("#lookpick " + sel).evaluateAll(els => els.map(e => e.getBoundingClientRect().height))) assert.ok(h >= 44, sel + " height " + h);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ---- offline pictures: service worker caches, warm-up and the Download button ----
// Playwright routes cannot see the service worker's own requests, so the worker's fetch is replaced inside it by a fake CDN
// (tiny GIFs) that records the URLs it was asked for.
const swReady = async page => { await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForSelector(".tabbar:not([hidden])"); await page.waitForTimeout(500); };
const fakeCdnInSw = async ctx => {
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker");
  await sw.evaluate(b64 => {
    self.__cdnHits = []; const real = self.fetch.bind(self);
    self.fetch = (req, init) => { const u = typeof req === "string" ? req : req.url; if (!u.includes("cdn.jsdelivr.net")) return real(req, init); self.__cdnHits.push(u); return Promise.resolve(new Response(Uint8Array.from(atob(b64), c => c.charCodeAt(0)), { status: 200, headers: { "content-type": "image/gif" } })); };
  }, GIF_1PX.toString("base64"));
  return sw;
};
const failCdnInSw = async ctx => { const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker"); await sw.evaluate(() => { const real = self.fetch.bind(self); self.fetch = (req, init) => ((typeof req === "string" ? req : req.url).includes("cdn.jsdelivr.net") ? Promise.reject(new TypeError("offline")) : real(req, init)); }); };
const cdnHits = sw => sw.evaluate(() => self.__cdnHits.filter(u => u.includes("/videos/")));
const openSw = async () => { const o = await open("", undefined, undefined, gifHostDown); await swReady(o.page); o.sw = await fakeCdnInSw(o.ctx); return o; };

test("opening a workout day fetches that day's GIFs once, ahead of time", async () => {
  const { page, ctx, sw } = await openSw();
  await startPush(page);
  await page.waitForTimeout(1200);
  const hits = await cdnHits(sw);
  assert.ok(hits.some(u => u.includes("0025-EIeI8Vf")), "Bench Press GIF requested");
  assert.ok(new Set(hits).size >= 2, "the other exercises of the day are warmed too: " + hits.length);
  const before = hits.length;
  await page.locator('#view-log [data-act="next-ex"]').click(); await page.waitForTimeout(600);
  assert.equal((await cdnHits(sw)).length, before, "already cached: no new requests when moving between exercises");
  await ctx.close();
});

test("Me > Download exercise pictures saves every GIF, works offline, and Remove downloads clears it", async () => {
  const { page, ctx, errors, sw } = await openSw();
  await tab(page, "me");
  assert.match(await page.locator("#pics-line").textContent(), /Not downloaded/);
  await page.locator('[data-act="pics-download"]').click();
  await page.waitForFunction(() => /Downloaded/.test(document.querySelector("#pics-line").textContent), null, { timeout: 60000 });
  const total = await page.evaluate(async () => (await (await caches.open("ironlog-demo-all")).keys()).length);
  assert.ok(total >= 100, "downloaded " + total);
  assert.equal(new Set(await cdnHits(sw)).size * 2, total, "each GIF and its still fetched once");
  await ctx.setOffline(true);
  await tab(page, "today"); await startPush(page);
  const ok = await page.evaluate(() => new Promise(res => { const i = document.querySelector("#open-card img.demo-gif"); if (!i) return res(false); if (i.complete) return res(i.naturalWidth > 0); i.onload = () => res(true); i.onerror = () => res(false); }));
  assert.equal(ok, true, "the GIF loads with no network");
  await ctx.setOffline(false);
  await tab(page, "me");
  await page.locator('[data-act="pics-clear"]').click();
  await page.waitForFunction(() => /Not downloaded/.test(document.querySelector("#pics-line").textContent));
  assert.equal(await page.evaluate(async () => (await (await caches.open("ironlog-demo-all")).keys()).length), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("Download exercise pictures is disabled with a message while offline", async () => {
  const { page, ctx } = await openSw();
  await ctx.setOffline(true);
  await tab(page, "me");
  await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-act="pics-download"]').isDisabled(), true);
  assert.match(await page.locator("#pics-line").textContent(), /internet/);
  await ctx.setOffline(false);
  await ctx.close();
});

// ---- final-review fixes ----
test("review: the journey does not open behind the look picker when a settings write echoes back (echo=1)", async () => {
  const { page, ctx, errors } = await open("fresh=2&pick=1&echo=1");
  await pickerOpen(page).waitFor();
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__fakeAuth({ uid: "u1", displayName: "Ziad", email: "ziad@example.com", emailVerified: true }));   // another data snapshot arrives while the picker is open
  await page.waitForTimeout(1200);
  assert.equal(await journeyShown(page), false, "still waiting for the picker");
  await page.locator('#lookpick [data-act="lp-sex"][data-v="male"]').click();
  await page.locator('#lookpick [data-act="lp-choose"]').click();
  await page.waitForSelector("#view-journey", { state: "visible" });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("review: keeping the classic look keeps the person's own accent, and Classic gets it back after trying Carbon", async () => {
  const { page, ctx } = await open("pick=1", undefined, 'try{localStorage.setItem("ironlog.accent","teal")}catch(e){}');
  await page.locator('#view-log [data-act="look-hint-open"]').click();
  await pickerOpen(page).waitFor();
  await page.locator('#lookpick [data-act="lp-classic"]').click();
  await page.waitForFunction(() => !document.querySelector("#lookpick").open);
  assert.equal(await page.evaluate(() => localStorage.getItem("ironlog.accent")), "teal");
  await tab(page, "me");
  await page.locator('[data-act="look-set"][data-v="carbon"]').click();
  assert.equal(await page.evaluate(() => localStorage.getItem("ironlog.accent")), "#ff7a2f");
  await page.locator('[data-act="look-set"][data-v="classic"]').click();
  assert.equal(await page.evaluate(() => localStorage.getItem("ironlog.accent")), "teal");
  await page.locator('[data-act="look-set"][data-v="classic"]').click();
  assert.equal(await page.evaluate(() => localStorage.getItem("ironlog.accent")), "teal", "tapping the look already in use changes nothing");
  await ctx.close();
});

test("review: the full-screen viewer shows a short message, not a broken image, when the GIF cannot load", async () => {
  const { page, ctx, errors } = await open("", undefined, undefined, gifHost);
  await swReady(page);
  await startPush(page);
  await page.locator('#open-card [data-act="demo-full"]').click();
  await page.waitForSelector("#demoview[open]");
  await page.evaluate(() => document.querySelector("#demoview img.demoview-img").dispatchEvent(new Event("error")));
  await page.waitForFunction(() => !document.querySelector("#demoview img.demoview-img"));
  assert.match(await page.locator("#demoview .demoview-stage").textContent(), /Not available offline yet/);
  assert.equal(await page.locator("#demoview .ex-fig").count(), 0, "no drawings");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("demos play by default even with reduced motion, and the person can stop and restart them", async () => {
  const { page, ctx } = await open("", undefined, undefined, gifHost);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startPush(page);
  const src = () => page.locator("#open-card .demo img.demo-gif").getAttribute("src");
  assert.match(await src(), /\.gif$/, "plays by default");
  await page.locator('#open-card [data-act="demo-toggle"]').click();
  assert.match(await src(), /\/images\/0025-EIeI8Vf\.jpg$/, "stopped: the still picture");
  assert.equal(await page.evaluate(() => localStorage.getItem("ironlog.demoStill")), "1");
  await page.locator('#open-card [data-act="demo-toggle"]').click();
  assert.match(await src(), /\.gif$/, "plays again");
  assert.equal(await page.evaluate(() => localStorage.getItem("ironlog.demoStill")), null);
  await ctx.close();
});

test("review: Remove downloads clears the pictures seen while training too, and shows even when nothing was downloaded", async () => {
  const { page, ctx } = await openSw();
  await startPush(page);
  await page.waitForTimeout(1200);
  const seen = () => page.evaluate(async () => (await (await caches.open("ironlog-demo")).keys()).length);
  assert.ok(await seen() > 0, "the day's pictures were kept");
  await tab(page, "me");
  await page.locator('[data-act="pics-clear"]').waitFor({ state: "visible" });
  await page.locator('[data-act="pics-clear"]').click();
  await page.waitForFunction(() => document.querySelector('[data-act="pics-clear"]').hidden);
  assert.equal(await seen(), 0);
  await ctx.close();
});

test("review: the download status counts only pictures still wanted, drops stale ones, and offers the rest", async () => {
  const { page, ctx } = await openSw();
  const total = await page.evaluate(async () => {
    const m = await import("/exercise-gifs.js"), all = [...m.gifUrls(), ...m.stillUrls()];
    const c = await caches.open("ironlog-demo-all");
    for (const u of [...all.slice(0, 3), m.DEMO_BASE + "videos/9999-stale.gif"]) await c.put(u, new Response("x", { status: 200 }));
    return all.length;
  });
  await tab(page, "me");
  await page.waitForFunction(() => /Downloaded/.test(document.querySelector("#pics-line").textContent));
  assert.match(await page.locator("#pics-line").textContent(), /3 pictures/);
  assert.equal(await page.locator('[data-act="pics-download"]').isDisabled(), false, "pictures are still missing");
  await page.locator('[data-act="pics-download"]').click();
  await page.waitForFunction(n => document.querySelector("#pics-line").textContent.includes(n + " pictures"), String(total), { timeout: 60000 });
  const keys = await page.evaluate(async () => (await (await caches.open("ironlog-demo-all")).keys()).map(r => r.url));
  assert.equal(keys.length, total);
  assert.ok(!keys.some(u => u.includes("9999-stale")), "the stale picture was removed");
  await ctx.close();
});

// ---- quick pass: no "!" on the card, the demo survives re-renders, the info sheet shows the GIF ----
test("quick pass: no ! button on the workout card; tapping the exercise name opens its info", async () => {
  const { page, ctx, errors } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  assert.equal(await page.locator("#open-card .infobtn").count(), 0, "no ! icon on the card");
  await page.locator('#open-card .ex-name[data-act="ex-info"]').click();
  await page.waitForSelector("#exinfo[open]");
  assert.match(await page.locator("#exinfo .sheet-head h2").textContent(), /Bench Press/i);
  await page.locator('#exinfo [data-act="exinfo-close"]').click();
  await addEx(page, "My Own Lift");
  assert.equal(await page.locator('#open-card .ex-name[data-act="ex-info"]').count(), 0, "a custom exercise has no info to open");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("quick pass: logging a set keeps the same demo element, so the GIF does not restart", async () => {
  const { page, ctx } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  await page.evaluate(() => { document.querySelector("#open-card .demo").__mark = "same"; });
  await page.locator('#open-card .prow button[data-act="add-set"]').click();
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.querySelector("#open-card .demo").__mark), "same");
  await ctx.close();
});

test("quick pass: the info sheet shows the exercise GIF at the top, with the credit", async () => {
  const { page, ctx } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  await page.locator('#open-card .ex-name[data-act="ex-info"]').click();
  await page.waitForSelector("#exinfo[open]");
  assert.match(await page.locator("#exinfo img.exinfo-gif").getAttribute("src"), /\/videos\/0025-EIeI8Vf\.gif$/);
  assert.match(await page.locator("#exinfo .ex-credit").last().textContent(), /Gym visual/);
  await ctx.close();
});

test("no drawings: an exercise with no GIF (Push Press) shows no demo box and the info sheet has no figures", async () => {
  const { page, ctx, errors } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  await addEx(page, "Push Press");
  assert.equal(await page.locator("#open-card .demo").count(), 0);
  await page.locator('#open-card .ex-name[data-act="ex-info"]').click();
  await page.waitForSelector("#exinfo[open]");
  assert.equal(await page.locator("#exinfo .ex-fig, #exinfo .ex-figs").count(), 0);
  assert.equal(await page.locator("#exinfo img.exinfo-gif").count(), 0);
  assert.equal(await page.locator("#exinfo .ex-credit").count(), 0, "no credit line without a GIF");
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ---- library expansion: info sheet of a dataset exercise (lazy How-to) ----
const failHowtoInSw = async ctx => { const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker"); await sw.evaluate(() => { const real = self.fetch.bind(self); self.fetch = (req, init) => ((typeof req === "string" ? req : req.url).includes("exercise-howto.js") ? Promise.reject(new TypeError("offline")) : real(req, init)); }); };

test("library: a dataset exercise opens its info sheet with GIF, muscles, equipment and a lazily loaded How-to", async () => {
  const { page, ctx, errors } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  await addEx(page, "Smith Machine Full Squat");
  await page.locator('#open-card .ex-name[data-act="ex-info"]').click();
  await page.waitForSelector("#exinfo[open]");
  await page.waitForSelector("#exinfo .howto-steps li");
  assert.ok(await page.locator("#exinfo .howto-steps li").count() >= 3, "several steps");
  const text = await page.locator("#exinfo").innerText();
  assert.match(text, /Works:/); assert.match(text, /Quads/); assert.match(text, /Smith machine/i);
  assert.equal(await page.locator("#exinfo img.exinfo-gif").count(), 1, "its own GIF");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("library: when the How-to file cannot load the sheet still opens, without a list and without errors", async () => {
  const { page, ctx, errors } = await open("", undefined, undefined, gifHost);
  await swReady(page); await failHowtoInSw(ctx);
  await startPush(page);
  await addEx(page, "Smith Machine Full Squat");
  await page.locator('#open-card .ex-name[data-act="ex-info"]').click();
  await page.waitForSelector("#exinfo[open]");
  await page.waitForTimeout(800);
  assert.equal(await page.locator("#exinfo .howto-steps").count(), 0);
  assert.match(await page.locator("#exinfo").innerText(), /Works:/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("library: a curated exercise keeps its tips and gets no How-to list", async () => {
  const { page, ctx } = await open("", undefined, undefined, gifHost);
  await startPush(page);
  await page.locator('#open-card .ex-name[data-act="ex-info"]').click();
  await page.waitForSelector("#exinfo[open]");
  await page.waitForTimeout(500);
  assert.ok(await page.locator("#exinfo .ex-tips li").count() >= 2);
  assert.equal(await page.locator("#exinfo .howto-steps").count(), 0);
  await ctx.close();
});

test("library: in Arabic a dataset exercise shows its Arabic name and the steps note", async () => {
  const { page, ctx, errors } = await open("lang=ar", undefined, undefined, gifHost);
  await startPush(page);
  await addEx(page, "Smith Machine Full Squat");
  await page.locator('#open-card .ex-name[data-act="ex-info"]').click();
  await page.waitForSelector("#exinfo[open]");
  await page.waitForSelector("#exinfo .howto-steps li");
  assert.match(await page.locator("#exinfo .sheet-head h2").textContent(), /[؀-ۿ]/);
  assert.match(await page.locator("#exinfo").innerText(), /الخطوات بالإنجليزية/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ---- library expansion: search in the Add exercise sheet ----
const openAddSheet = async page => { await page.locator('#view-log [data-act="open-exsheet"]').first().click(); await page.waitForSelector("#exsheet[open]"); };
const searchBox = page => page.locator("#exsheet #ex-search");
const resRows = page => page.locator("#exsheet .exres");

test("search: typing finds exercises of the whole library with muscle and equipment tags, and tapping one adds it", async () => {
  const { page, ctx, errors } = await open("", undefined, undefined, gifHost);
  await startPush(page); await openAddSheet(page);
  await searchBox(page).fill("full squat");
  await resRows(page).first().waitFor();
  assert.ok(await resRows(page).count() >= 1);
  assert.match(await resRows(page).first().textContent(), /Full.*Squat/);
  assert.ok((await resRows(page).first().locator(".tag2").count()) >= 1, "tags");
  for (const h of await resRows(page).evaluateAll(els => els.map(e => e.getBoundingClientRect().height))) assert.ok(h >= 44, "row height " + h);
  const name = (await resRows(page).first().locator("b").textContent()).trim();
  await resRows(page).first().click();
  await page.waitForTimeout(500);
  assert.ok((await page.locator("#exchips").innerText()).toLowerCase().includes(name.toLowerCase()), name + " is now on today's workout");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("search: words in any order, a message when nothing matches, and the show more button", async () => {
  const { page, ctx } = await open("", undefined, undefined, gifHost);
  await startPush(page); await openAddSheet(page);
  await searchBox(page).fill("zzzz qqqq");
  await page.locator("#exsheet .exres-none").waitFor();
  await searchBox(page).fill("dumbbell");
  await resRows(page).first().waitFor();
  assert.equal(await resRows(page).count(), 20);
  await page.locator('#exsheet [data-act="ex-search-more"]').click();
  assert.equal(await resRows(page).count(), 40);
  await ctx.close();
});

test("search: the gym filter applies (bodyweight only hides machine and barbell exercises)", async () => {
  const { page, ctx } = await open("gym=%5B%5D", undefined, undefined, gifHost);
  await startPush(page); await openAddSheet(page);
  await searchBox(page).fill("squat");
  await resRows(page).first().waitFor();
  const names = await resRows(page).evaluateAll(els => els.map(e => e.dataset.name));
  assert.ok(!names.includes("Smith Machine Full Squat") && !names.includes("Front Squat"), "no equipment squats: " + names.slice(0, 6));
  assert.ok(names.length >= 1);
  await ctx.close();
});

test("search: in Arabic the Arabic names are searched and shown", async () => {
  const { page, ctx, errors } = await open("lang=ar", undefined, undefined, gifHost);
  await startPush(page); await openAddSheet(page);
  await searchBox(page).fill("سكوات");
  await resRows(page).first().waitFor();
  assert.match(await resRows(page).first().textContent(), /[؀-ۿ]/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("search: a data refresh while typing keeps the text and the focus", async () => {
  const { page, ctx } = await open("echo=1", undefined, undefined, gifHost);
  await startPush(page); await openAddSheet(page);
  await searchBox(page).click(); await searchBox(page).pressSequentially("press");
  await page.evaluate(() => window.__fakeAuth({ uid: "u1", displayName: "Ziad", email: "ziad@example.com", emailVerified: true }));
  await page.waitForTimeout(900);
  assert.equal(await searchBox(page).inputValue(), "press");
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), "ex-search");
  await ctx.close();
});

// ---- library expansion: My Gym at 53 items and speed with the whole library ----
test("library: My Gym counts 53 items and every exercise for the Full gym; Bodyweight only keeps the body-weight ones", async () => {
  const { page, ctx, errors } = await open("", undefined, undefined, gifHost);
  await openGym(page);
  assert.equal(await page.locator('#view-gym [data-act="gym-toggle"]').count(), 53);
  assert.ok(await page.locator('#view-gym h3', { hasText: "Accessories" }).count() >= 1, "the Accessories group");
  await page.locator('#view-gym [data-act="gym-preset"][data-p="full"]').click();
  assert.match(await page.locator("#view-gym").innerText(), /53 of 53 items · 1314 exercises available/);
  await page.locator('#view-gym [data-act="gym-preset"][data-p="bodyweight"]').click();
  const bw = /0 of 53 items · (\d+) exercises available/.exec(await page.locator("#view-gym").innerText());
  assert.ok(bw && +bw[1] > 250 && +bw[1] < 700, "body-weight exercises: " + (bw && bw[1]));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("library: Today, the Add sheet and typing a search stay responsive with the whole library (no long task over 500 ms)", async () => {
  const { page, ctx } = await open("", undefined, undefined, gifHost);
  await page.evaluate(() => { window.__long = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push(e.duration))).observe({ entryTypes: ["longtask"] }); } catch (e) {} });
  await startPush(page); await openAddSheet(page);
  await searchBox(page).pressSequentially("dumbbell press", { delay: 20 });
  await resRows(page).first().waitFor();
  await page.waitForTimeout(400);
  const max = await page.evaluate(() => Math.max(0, ...window.__long));
  assert.ok(max < 500, "longest task " + Math.round(max) + " ms");
  await ctx.close();
});

// ---- library expansion: a name the person used before the library knew it keeps its kind ----
test("library: a former custom exercise that is now a body-weight library exercise continues its weighted history", async () => {
  const { page, ctx, errors } = await open("kind=1", undefined, undefined, gifHost);
  await startPush(page);
  await addEx(page, "Jump Squat");
  assert.equal(await page.locator('#open-card [data-act="bw-toggle"]').getAttribute("aria-pressed"), "false", "still logged with weight, like its history");
  assert.match(await page.locator("#open-card .prev").first().textContent(), /Last time/);
  assert.match(await page.locator("#open-card").innerText(), /10.*12/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ---- Looks 2.0: per-look layouts (Carbon, Bloom), the Classic fallback, Classic users download nothing extra ----
for (const look of ["carbon", "bloom"]) {
  test(`looks 2.0 (${look}): Today shows the glance card and the workout card opens in the look's own layout`, async () => {
    const { page, ctx, errors } = await open("", undefined, lookInit(look));
    await page.waitForSelector(".lk-glance");
    assert.ok(await page.locator('.lk-glance [data-act="start-day"]').first().isVisible());
    assert.equal(await page.locator(".lk-wd").count(), 7);
    assert.equal(await page.locator('#view-log [data-act="start-free"]').count(), 1);
    await page.locator('.lk-glance [data-act="start-day"]').first().click();
    await page.waitForSelector("#open-card.lk-focus");
    assert.equal(await page.locator("#open-card.lk-bloomcard .lk-banner").count(), look === "bloom" ? 1 : 0);
    for (const act of ["add-set", "done-ex", "set-kind", "step", "target-edit"]) assert.ok(await page.locator(`#view-log [data-act="${act}"]`).count() >= 1, act);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

test("looks 2.0: Classic never requests a look module or a look stylesheet", async () => {
  const seen = [];
  const { page, ctx, errors } = await open("", undefined, undefined, async c => { c.on("request", r => { if (/\/looks\/(carbon|bloom)\.js|looks-(carbon|bloom)\.css/.test(r.url())) seen.push(r.url()); }); });
  await page.waitForSelector("#view-log .daypick");
  assert.deepEqual(seen, []);
  assert.equal(await page.locator(".lk-glance").count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("looks 2.0: a look module that cannot load still draws Today (Classic layout, look colours) without errors", async () => {
  const { page, ctx, errors } = await open("", undefined, lookInit("carbon"), async c => { await c.route("**/looks/carbon.js", r => r.abort()); });
  await page.waitForSelector("#view-log .daypick");
  assert.equal(await page.locator(".lk-glance").count(), 0);
  assert.equal(await dataLook(page), "carbon");
  assert.deepEqual(errors.filter(e => !/Failed to fetch dynamically imported|Importing a module script failed|carbon\.js/.test(e)), []);
  await ctx.close();
});

test("looks 2.0: switching the look in Me redraws Today with the new layout and back to Classic removes it", async () => {
  const { page, ctx, errors } = await open("", undefined, lookInit("carbon"));
  await page.waitForSelector(".lk-glance");
  await tab(page, "me");
  await page.locator('[data-act="look-set"][data-v="bloom"]').click();
  await tab(page, "today");
  await page.waitForSelector(".lk-glance");
  assert.equal(await dataLook(page), "bloom");
  await tab(page, "me");
  await page.locator('[data-act="look-set"][data-v="classic"]').click();
  await tab(page, "today");
  await page.waitForSelector("#view-log .daypick");
  assert.equal(await page.locator(".lk-glance").count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ---- Year activity: a GitHub-style grid on Progress > Overview ----
for (const look of ["classic", "carbon", "bloom"]) {
  test(`year activity (${look}): a 53-week grid with month and weekday labels, legend, and a tapped day shows its detail`, async () => {
    const { page, ctx, errors } = await open("", undefined, lookInit(look));
    await tab(page, "progress");
    await page.waitForSelector(".hm-wrap");
    assert.equal(await page.locator(".hm-col").count(), 53);
    assert.ok(await page.locator(".hm-c[data-date]").count() > 300, "past and today cells");
    assert.ok(await page.locator(".hm-c.future").count() < 7, "only this week's later days are future");
    assert.equal(await page.locator(".hm-c.today").count(), 1);
    assert.ok(await page.locator(".hm-c.l1, .hm-c.l2, .hm-c.l3, .hm-c.l4").count() > 5, "shaded days");
    assert.equal(await page.locator(".hm-legend .hm-c").count(), 5);
    assert.ok((await page.locator(".hm-months span").allInnerTexts()).filter(Boolean).length >= 11, "month labels");
    assert.equal((await page.locator(".hm-days span").allInnerTexts()).filter(Boolean).length, 3, "three weekday labels");
    const scrolledToEnd = await page.locator(".hm-wrap").evaluate(e => e.scrollLeft + e.clientWidth >= e.scrollWidth - 2);
    assert.ok(scrolledToEnd, "starts at today");
    const cell = page.locator(".hm-c[data-n]:not([data-n='0'])").last();
    await cell.click({ force: true });
    assert.match(await page.locator("#hm-cap").innerText(), /workout.*min/);
    assert.equal(await page.locator('#hm-cap [data-open]').count(), 1, "Open button for that day");
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}
test("year activity: Arabic keeps the grid left to right and translates the labels", async () => {
  const { page, ctx, errors } = await open("lang=ar");
  await tab(page, "progress");
  await page.waitForSelector(".hm-wrap");
  assert.equal(await page.locator(".hm-wrap").getAttribute("dir"), "ltr");
  assert.match(await page.locator("#hm-cap").innerText(), /تدريب/);
  assert.match(await page.locator(".hm-legend").innerText(), /وقت أقل/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
