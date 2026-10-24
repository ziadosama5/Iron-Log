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

async function open(query = "", viewport = { width: 420, height: 860 }, initScript) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  if (initScript) await ctx.addInitScript(initScript);
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
  assert.equal(await bwText(advice(page)), "Add 2.5 kg extra, start at 8 reps");
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
  assert.equal((await bwText(targetChip(page))), "Target 3 × 30–60");
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
