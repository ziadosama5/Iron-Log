import { test } from "node:test";
import assert from "node:assert/strict";
import { SCREENS, loadLayout, buildCtx, icon } from "../public/looks/layout.js";

test("classic and unknown looks load no builders", async () => {
  assert.deepEqual(await loadLayout("classic"), {});
  assert.deepEqual(await loadLayout("nope"), {});
  assert.deepEqual(await loadLayout(undefined), {});
});

test("a look module that fails to import gives no builders and never throws", async () => {
  const warns = [];
  const prev = console.warn; console.warn = (...a) => warns.push(a.join(" "));
  try {
    const out = await loadLayout("carbon", async () => { throw new Error("blocked"); });
    assert.deepEqual(out, {});
    assert.ok(warns.length >= 1);
  } finally { console.warn = prev; }
});

test("only builders named in SCREENS are used, and they must be functions", async () => {
  const mod = { screens: { today: () => "<b>t</b>", notAScreen: () => "x", workout: "nope" } };
  const out = await loadLayout("bloom", async () => mod);
  assert.deepEqual(Object.keys(out), ["today"]);
  assert.equal(out.today({}), "<b>t</b>");
});

test("SCREENS has unique dotted lowercase ids and covers the INDEX groups", () => {
  assert.equal(new Set(SCREENS).size, SCREENS.length);
  for (const s of SCREENS) assert.match(s, /^[a-z]+(\.[a-zA-Z]+)?$/);
  for (const must of ["chrome.tabbar", "chrome.pills", "today", "workout", "rest.bar", "plan.days", "progress.overview", "friends.board", "me.root", "flow.lookPicker", "flow.journey", "flow.signin"]) assert.ok(SCREENS.includes(must), must);
});

test("buildCtx escapes, exposes the helpers and keeps the base fields", () => {
  const t = s => s, tn = (a, b, n) => (n === 1 ? a : b);
  const ctx = buildCtx({ look: "carbon", rtl: true, who: "Ziad", t, tn, nameOf: (k, n) => n });
  assert.equal(ctx.who, "Ziad");
  assert.equal(ctx.look, "carbon");
  assert.equal(ctx.isRtl, true);
  assert.equal(ctx.esc("<a href=\"x\">&'"), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  assert.equal(ctx.kg(82.4), "82.4");
  assert.equal(ctx.kg(1234567), "1,234,567");
  assert.equal(ctx.kg(null), "–");
  assert.equal(typeof ctx.icon, "function");
  assert.equal(ctx.t("x"), "x");
});

test("icon draws a decorative svg and an unknown name draws nothing harmful", () => {
  assert.match(icon("check"), /^<svg class="ico"[^>]*aria-hidden="true"[^>]*><path d="[^"]+"/);
  assert.match(icon("check", 18), /width:18px/);
  assert.equal(icon("<script>"), "");
});
