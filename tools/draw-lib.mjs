// Helpers for drawing exercise figures as outlined, slightly muscular shapes (dev only, not served).
// Plain SVG that follows the app theme like the Everkinetic drawings: lines use currentColor and
// white shapes use class "exbg" (fill) / "exbg-s" (stroke), set from CSS.
//
// Canvas 216 x 300, ground at y = 270. A figure is a list of parts; each part is a tapered capsule
// between two joints (wide end -> narrow end), so shoulders/thighs/calves look built:
//   tap([x1,y1], [x2,y2], w1, w2)
// All outlines are drawn first, then all fills, so overlapping parts read as one silhouette.

const f = n => Math.round(n * 10) / 10;
const pts = a => a.map(p => `${f(p[0])},${f(p[1])}`).join(" ");

export const tap = (a, b, w1, w2 = w1) => ({ a, b, w1, w2 });

// Chain of tapered parts through joints with widths per joint, e.g. chain([hip,knee,ank],[22,16,10]).
export const chain = (joints, widths) => joints.slice(0, -1).map((j, i) => tap(j, joints[i + 1], widths[i], widths[i + 1]));

function shape(p, attrs) {
  const [dx, dy] = [p.b[0] - p.a[0], p.b[1] - p.a[1]], len = Math.hypot(dx, dy) || 1;
  const [nx, ny] = [-dy / len, dx / len];
  const poly = [[p.a[0] + nx * p.w1 / 2, p.a[1] + ny * p.w1 / 2], [p.b[0] + nx * p.w2 / 2, p.b[1] + ny * p.w2 / 2], [p.b[0] - nx * p.w2 / 2, p.b[1] - ny * p.w2 / 2], [p.a[0] - nx * p.w1 / 2, p.a[1] - ny * p.w1 / 2]];
  return `<polygon points="${pts(poly)}" ${attrs}/><circle cx="${f(p.a[0])}" cy="${f(p.a[1])}" r="${f(p.w1 / 2)}" ${attrs}/><circle cx="${f(p.b[0])}" cy="${f(p.b[1])}" r="${f(p.w2 / 2)}" ${attrs}/>`;
}

export function fig({ head, headR = 15, parts = [], gear = "", behind = "", front = "" }) {
  const outer = parts.map(p => shape(p, 'fill="currentColor" stroke="currentColor" stroke-width="5" stroke-linejoin="round"')).join("");
  const inner = parts.map(p => shape(p, 'class="exbg"')).join("");
  const h = head ? `<circle cx="${f(head[0])}" cy="${f(head[1])}" r="${headR}" class="exbg" stroke="currentColor" stroke-width="3"/>` : "";
  return `<svg viewBox="0 0 216 300" xmlns="http://www.w3.org/2000/svg"><rect width="216" height="300" class="exbg" stroke="none"/>${behind}<g>${outer}${inner}</g>${h}${gear}${front}</svg>`;
}

// Equipment and details: thin currentColor lines and outlined shapes.
export const line = (a, b, w = 3) => `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="currentColor" stroke-width="${w}" stroke-linecap="round"/>`;
export const rect = (x, y, w, h, r = 3, filled = true) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${r}" ${filled ? 'class="exbg"' : 'fill="none"'} stroke="currentColor" stroke-width="3"/>`;
export const circle = (c, r, filled = true) => `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r)}" ${filled ? 'class="exbg"' : 'fill="none"'} stroke="currentColor" stroke-width="3"/>`;
export const floor = (y = 270, x1 = 6, x2 = 210) => line([x1, y], [x2, y], 3);
export const poly = (a, filled = false) => `<polyline points="${pts(a)}" ${filled ? 'class="exbg"' : 'fill="none"'} stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
export const plate = (c, r = 20) => circle(c, r) + circle(c, 3, false);
export const cable = (a, b) => line(a, b, 2) + circle(b, 3);
// A hand: small outlined circle at the wrist.
export const hand = (c, r = 6) => circle(c, r);
// Dumbbell seen from the side: a short bar with a plate at each end, centred on c, angle in degrees.
export function dumbbell(c, angle = 0, len = 26, r = 9) {
  const a = angle * Math.PI / 180, [dx, dy] = [Math.cos(a) * len / 2, Math.sin(a) * len / 2];
  const p1 = [c[0] - dx, c[1] - dy], p2 = [c[0] + dx, c[1] + dy];
  return line(p1, p2, 4) + circle(p1, r) + circle(p2, r);
}
// Barbell seen end-on / from the side is just a plate; a long bar from a to b with plates at both ends.
export function barbell(a, b, r = 16) { return line(a, b, 4) + circle(a, r) + circle(b, r); }

// Figure builders shared by several exercises. All joint lists use [x, y] points.
// Muscular proportions: shoulders/chest wide, waist narrow, thick thighs and arms.
export const body = ({ sh, hip, chest = 40, waist = 25 }) => [tap(sh, hip, chest, waist)];
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
export const arm = (sh, elbow, wrist, w = [18, 14, 10]) => { const m = lerp(sh, elbow, 0.45); return [tap(sh, elbow, w[0], w[1]), tap(m, m, w[0] + 3, w[0] + 3), tap(elbow, wrist, w[1], w[2])]; };
export const leg = (hip, knee, ankle, toe, w = [28, 19, 12]) => { const m = lerp(knee, ankle, 0.3); return [tap(hip, knee, w[0], w[1]), tap(knee, ankle, w[1], w[2]), tap(m, m, w[1] + 4, w[1] + 4), tap(ankle, toe, 11, 8)]; };
// Shoulder cap (deltoid) as an extra round part.
export const delt = (sh, r = 13) => tap(sh, sh, r * 2, r * 2);
