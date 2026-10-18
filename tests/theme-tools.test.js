import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, parseHex, contrast, ensureContrast, deriveAccent } from "../public/theme-tools.js";

const LIGHT = { surface: "#ffffff", bg: "#f3f5f9" }, DARK = { surface: "#171d26", bg: "#0f1319" };
const derive = (s, mode) => deriveAccent(s, mode, (mode === "dark" ? DARK : LIGHT).surface, (mode === "dark" ? DARK : LIGHT).bg);
const hue = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

test("parseHex accepts #rgb and #rrggbb in any case and rejects everything else", () => {
  assert.equal(parseHex("#ABC"), "#aabbcc");
  assert.equal(parseHex("#1F5FD1"), "#1f5fd1");
  for (const bad of ["1f5fd1", "#xyz", "#12345", "javascript:alert(1)", "", null, undefined, 42, "#1f5fd1ff", "#1f5fd1 "]) assert.equal(parseHex(bad), null, String(bad));
});

test("contrast follows WCAG", () => {
  assert.ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 0.01);
  assert.equal(contrast("#ffffff", "#ffffff"), 1);
});

test("ensureContrast fixes weak colors in the right direction, keeps hue, leaves good ones alone", () => {
  const gold = ensureContrast("#f0a500", "#ffffff", "light");
  assert.ok(contrast(gold, "#ffffff") >= 4.5);
  assert.ok(Math.abs(hue(gold) - hue("#f0a500")) <= 3);
  assert.equal(ensureContrast("#1f5fd1", "#ffffff", "light"), "#1f5fd1");
  const navy = ensureContrast("#0a2a66", "#0b1220", "dark");
  assert.ok(contrast(navy, "#0b1220") >= 4.5);
});

test("plate blue returns exactly today's tokens", () => {
  assert.deepEqual(derive("plate", "light"), { accent: "#1f5fd1", ink: "#ffffff", soft: "#dbe6fb" });
  assert.deepEqual(derive("plate", "dark"), { accent: "#6c9cff", ink: "#0b1220", soft: "#1b2a47" });
});

test("every preset and a custom yellow stay readable in both modes", () => {
  for (const s of [...PRESETS.map(p => p.id), "#ffff00", "#000000", "#ffffff"]) {
    for (const mode of ["light", "dark"]) {
      const env = mode === "dark" ? DARK : LIGHT, d = derive(s, mode);
      assert.ok(contrast(d.accent, env.surface) >= 4.5, `${s} ${mode} accent/surface`);
      assert.ok(contrast(d.accent, env.bg) >= 4.5, `${s} ${mode} accent/bg`);
      assert.ok(contrast(d.ink, d.accent) >= 4.5, `${s} ${mode} ink/accent`);
      assert.match(d.soft, /^#[0-9a-f]{6}$/, `${s} ${mode} soft`);
    }
  }
});

test("ink flips with the accent: gold gets dark ink on dark backgrounds, navy white ink on light ones", () => {
  assert.equal(derive("gold", "dark").ink, "#0b1220");
  assert.equal(derive("#0a2a66", "light").ink, "#ffffff");
});

test("invalid or missing settings fall back to plate blue", () => {
  for (const bad of ["not-a-color", null, undefined, "", "#12", "javascript:1"]) assert.deepEqual(derive(bad, "light"), derive("plate", "light"), String(bad));
});

test("presets: 8, plate first, unique ids, valid hex, English names", () => {
  assert.equal(PRESETS.length, 8);
  assert.equal(PRESETS[0].id, "plate");
  assert.deepEqual(PRESETS.map(p => p.name), ["Plate blue", "Teal", "Green", "Orange", "Red", "Pink", "Purple", "Gold"]);
  assert.equal(new Set(PRESETS.map(p => p.id)).size, 8);
  for (const p of PRESETS) assert.equal(parseHex(p.hex), p.hex);
});

test("accent-coloured text on the soft tint stays readable (4.5:1) for presets and random colours", () => {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const customs = Array.from({ length: 300 }, () => "#" + [0, 0, 0].map(() => Math.floor(rnd() * 256).toString(16).padStart(2, "0")).join(""));
  for (const s of [...PRESETS.filter(p => p.id !== "plate").map(p => p.id), ...customs]) {
    for (const mode of ["light", "dark"]) {
      const d = derive(s, mode);
      assert.ok(contrast(d.accent, d.soft) >= 4.5, `${s} ${mode}: ${contrast(d.accent, d.soft).toFixed(2)}`);
    }
  }
});
