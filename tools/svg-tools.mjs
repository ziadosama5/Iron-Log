// Helpers for tools/import-exercises.mjs (dev only, not served).

function rgb(color) {
  const c = color.toLowerCase();
  if (c === "white") return [255, 255, 255];
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(c);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, x => x + x) : m[1];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

// Everkinetic drawings use one near-black line color and white fills. Lines follow the text
// color (currentColor) and white shapes get class="exbg" (filled from CSS), so the drawing
// matches light and dark themes. var() inside SVG attributes isn't reliable in every browser.
// Any other color throws, so a surprising source file is caught at import time.
export function recolorSvg(text, label = "svg") {
  if (/style="[^"]*fill/i.test(text)) throw new Error(`${label}: fill inside a style attribute is not supported`);
  let out = text
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    .replace(/fill="([^"]*)"/g, (all, color) => {
      if (color === "none") return all;
      const v = rgb(color);
      if (v && v.every(n => n <= 0x60)) return 'fill="currentColor"';
      if (v && v.every(n => n === 255)) return 'class="exbg"';
      throw new Error(`${label}: unexpected fill ${color}`);
    })
    .replace(/<svg\b([^>]*)>/, (all, attrs) => "<svg" + attrs.replace(/\s(width|height)="[^"]*"/g, "") + ">")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();
  return out;
}

export function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Everkinetic names poses by muscle state (relaxation/tension), not by movement order.
// Most exercises start relaxed; ones that start at the top (squat, bench press...) set start:"tension".
// Returns [[everkineticPose, "start"], [everkineticPose, "end"]].
export function posesFor(source) {
  const s = source.start || "relaxation";
  if (s !== "relaxation" && s !== "tension") throw new Error(`unknown start pose "${s}" (use "relaxation" or "tension")`);
  return s === "tension" ? [["tension", "start"], ["relaxation", "end"]] : [["relaxation", "start"], ["tension", "end"]];
}
