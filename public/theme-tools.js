// Accent color math: turn one chosen color into the three accent tokens for light or dark mode.
// Pure (no DOM), unit-tested in tests/theme-tools.test.js.

export const PRESETS = [
  { id: "plate", name: "Plate blue", hex: "#1f5fd1" },
  { id: "teal", name: "Teal", hex: "#0f9488" },
  { id: "green", name: "Green", hex: "#2f9e44" },
  { id: "orange", name: "Orange", hex: "#e8590c" },
  { id: "red", name: "Red", hex: "#e03131" },
  { id: "pink", name: "Pink", hex: "#d6336c" },
  { id: "purple", name: "Purple", hex: "#7048e8" },
  { id: "gold", name: "Gold", hex: "#f0a500" }
];

// Today's colors, kept exactly so existing users see no change.
const PLATE = {
  light: { accent: "#1f5fd1", ink: "#ffffff", soft: "#dbe6fb" },
  dark: { accent: "#6c9cff", ink: "#0b1220", soft: "#1b2a47" }
};
const INKS = ["#ffffff", "#0b1220"];

// "#abc" / "#AABBCC" -> "#aabbcc"; anything else -> null.
export function parseHex(s) {
  if (typeof s !== "string") return null;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (!m) return null;
  const h = m[1].toLowerCase();
  return "#" + (h.length === 3 ? [...h].map(c => c + c).join("") : h);
}

const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hexOf = rgb => "#" + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

function luminance(hex) {
  const [r, g, b] = rgbOf(hex).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function toHsl(hex) {
  const [r, g, b] = rgbOf(hex).map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function fromHsl([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return hexOf([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

// Same hue and saturation; lightness moves down (light mode) or up (dark mode) until the contrast is enough.
export function ensureContrast(hex, bg, mode, min = 4.5) {
  if (contrast(hex, bg) >= min) return hex;
  const [h, s, l0] = toHsl(hex), step = mode === "dark" ? 0.01 : -0.01;
  let l = l0, out = hex;
  for (let i = 0; i < 100; i++) {
    l = Math.max(0, Math.min(1, l + step));
    out = fromHsl([h, s, l]);
    if (contrast(out, bg) >= min || l <= 0 || l >= 1) break;
  }
  return out;
}

const mix = (a, b, k) => hexOf(rgbOf(a).map((v, i) => v * k + rgbOf(b)[i] * (1 - k)));

// setting: preset id, "#rrggbb", or anything else (= plate blue).
export function deriveAccent(setting, mode, surface, bg) {
  const m = mode === "dark" ? "dark" : "light";
  const preset = PRESETS.find(p => p.id === setting);
  const base = preset ? preset.hex : parseHex(setting);
  if (!base || (preset && preset.id === "plate")) return { ...PLATE[m] };
  let accent = ensureContrast(base, surface, m);
  accent = ensureContrast(accent, bg, m);
  const ink = INKS.reduce((best, c) => (contrast(c, accent) > contrast(best, accent) ? c : best));
  return { accent, ink, soft: mix(accent, surface, m === "dark" ? 0.22 : 0.14) };
}
