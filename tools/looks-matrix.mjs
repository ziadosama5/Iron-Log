// Screen matrix: looks x theme x language at 360 px; reports horizontal overflow, targets under 44 px and text under 12 px.
import { createRequire } from "module";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
const root = fileURLToPath(new URL("../", import.meta.url)).split(String.fromCharCode(92)).join("/");
const require = createRequire(root + "tests-ui/");
const { chromium } = require("playwright-core");
const PORT = 5622;
const server = spawn(process.execPath, [root + "tools/screenshot-harness/run.cjs", root + "public", root + "tools/screenshot-harness", String(PORT)], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 1500));
const b = await chromium.launch({ channel: "msedge", headless: true });
const screens = [
  ["today", []], ["workout", ['[data-act="start-day"]']], ["plan", ['[data-tab="plan"]']], ["gym", ['[data-tab="plan"]', '[data-view="gym"]']],
  ["overview", ['[data-tab="progress"]']], ["body", ['[data-tab="progress"]', '[data-view="body"]']], ["lifts", ['[data-tab="progress"]', '[data-view="progress"]']],
  ["goals", ['[data-tab="progress"]', '[data-view="goals"]']], ["coach", ['[data-tab="progress"]', '[data-view="coach"]']], ["history", ['[data-tab="progress"]', '[data-view="history"]']],
  ["friends", ['[data-tab="friends"]']], ["challenges", ['[data-tab="friends"]', '[data-view="challenges"]']], ["me", ['[data-tab="me"]']],
  ["dayedit", [], "&go=days:edit"], ["friendpage", [], "&go=friend:u2"], ["find", ['[data-tab="friends"]', '[data-view="find"]']],
  ["challengeopen", [], "&go=ch:open"], ["challengenew", [], "&go=ch:new"]
];
const out = [];
for (const look of ["carbon", "bloom"]) for (const theme of ["dark", "light"]) for (const lang of ["en", "ar"]) {
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, serviceWorkers: "block" });
  await ctx.addInitScript('try{localStorage.setItem("ironlog.journey","skip")}catch(e){}');
  for (const [name, clicks, extra = ""] of screens) {
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${PORT}/?friends=1&ch=1&mine=1&look=${look}&theme=${theme}&lang=${lang}${extra}`);
    await p.waitForSelector(".tabbar:not([hidden])"); await p.waitForTimeout(700);
    for (const sel of clicks) { try { await p.click(sel, { timeout: 2000 }); } catch (e) { out.push(`${look}/${theme}/${lang}/${name}: click failed ${sel}`); break; } await p.waitForTimeout(350); }
    const r = await p.evaluate(() => {
      const de = document.documentElement, over = de.scrollWidth - de.clientWidth, issues = [];
      const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !e.closest("[hidden]") && !e.closest("dialog:not([open])"); };
      for (const e of document.querySelectorAll("main button, main [role=button], main a, .tabbar button, #pills button, main input:not([type=hidden]), main select")) {
        if (!vis(e)) continue; const r = e.getBoundingClientRect();
        if (e.closest(".exchips,.pills,.scrollx")) { if (r.height < 43.5) issues.push("h" + Math.round(r.height) + ":" + (e.textContent || e.id).trim().slice(0, 18)); continue; }
        if (r.height < 43.5 && !e.closest("table,.setrow") && !e.closest(".chips")) issues.push("h" + Math.round(r.height) + ":" + (e.getAttribute("aria-label") || e.textContent || e.id).trim().slice(0, 18));
        if (r.right > de.clientWidth + 1 || r.left < -1) issues.push("out:" + (e.textContent || e.id).trim().slice(0, 18));
      }
      for (const e of document.querySelectorAll("main *")) { if (!vis(e) || !e.childNodes.length) continue; if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11.9) issues.push("font:" + e.textContent.trim().slice(0, 16)); }
      return { over, issues: [...new Set(issues)].slice(0, 8) };
    });
    if (r.over > 1 || r.issues.length) out.push(`${look}/${theme}/${lang}/${name}: overflow=${r.over} ${r.issues.join(" | ")}`);
    await p.close();
  }
  await ctx.close();
}
await b.close(); server.kill();
console.log(out.join("\n") || "no findings");
