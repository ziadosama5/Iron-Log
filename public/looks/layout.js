// Per-look screen layouts (Looks 2.0). A look module (carbon.js / bloom.js) exports `screens`: pure builders that take a ctx and return an
// HTML string. index.html asks `screenHtml(name, ctx, classicBuilder)`: a look's builder when it has one, else the Classic builder
// (drawn in the look's colours). Pure: no DOM, no Firebase. Unit-tested in tests/looks-layout.test.js.

// Every screen a look may define (docs/looks/INDEX.md). A builder under any other name is ignored.
export const SCREENS = [
  "chrome.tabbar", "chrome.pills",
  "today", "today.new", "workout", "workout.done", "workout.variants", "rest.bar", "demo.thumb", "demo.viewer",
  "sheet.addExercise", "sheet.info", "sheet.food", "sheet.cardio", "sheet.target",
  "plan.days", "plan.dayEdit", "plan.gym", "sheet.plan", "sheet.split",
  "progress.overview", "progress.body", "progress.bodyForm", "progress.lifts", "progress.goals", "progress.coach", "progress.history", "sheet.family",
  "friends.board", "friends.page", "friends.manage", "friends.find", "challenges.list", "challenges.open", "challenges.new",
  "me.root", "me.appearance", "me.privacy", "me.delete",
  "flow.lookPicker", "flow.journey", "flow.celebrate", "flow.toast", "flow.signin"
];

const defaultImporter = look => import("./" + look + ".js");
const LOOK_IDS = ["carbon", "bloom"];

// Builders of a look, or {} for Classic, an unknown look or a module that cannot load (a warning, never a throw).
export async function loadLayout(look, importer = defaultImporter) {
  if (!LOOK_IDS.includes(look)) return {};
  try {
    const mod = await importer(look);
    const src = mod && mod.screens && typeof mod.screens === "object" ? mod.screens : {};
    const out = {};
    for (const name of SCREENS) if (Object.prototype.hasOwnProperty.call(src, name) && typeof src[name] === "function") out[name] = src[name];
    return out;
  } catch (e) {
    console.warn("look module failed to load, using the Classic layout:", look, e && e.message);
    return {};
  }
}

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// A number of kilograms (or any plain count) for display; null/NaN = a dash.
export function kg(n) {
  if (n === null || n === undefined || n === "" || !Number.isFinite(Number(n))) return "–";
  const v = Math.round(Number(n) * 10) / 10;
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

// The one line-icon set of the looks (1.75 px stroke, 24 px grid).
const ICON_PATHS = {
  today: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 12.5l3 3 5-6", plan: "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M4 10h16 M9 3v4 M15 3v4",
  progress: "M5 20V11 M12 20V4 M19 20v-7", friends: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5 M16 5.2a3 3 0 0 1 0 5.6 M17 15.3c2.3.5 4 2 4 4.7",
  me: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 20c0-4 3.6-6 8-6s8 2 8 6", plus: "M12 5v14 M5 12h14", minus: "M5 12h14", check: "M5 12.5l4.5 4.5L19 7.5",
  chev: "M9 6l6 6-6 6", chevd: "M6 9l6 6 6-6", search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-3.5-3.5",
  flame: "M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.5 1.2 2 2 2 0-3-1-5 1-8z",
  trophy: "M8 4h8v6a4 4 0 0 1-8 0V4z M8 6H5v2a3 3 0 0 0 3 3 M16 6h3v2a3 3 0 0 1-3 3 M12 14v4 M8.5 20h7", bar: "M3 9v6 M6 7v10 M18 7v10 M21 9v6 M6 12h12",
  timer: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M12 9v4l2.5 2 M10 3h4", close: "M6 6l12 12 M18 6L6 18", more: "M6 12h.01 M12 12h.01 M18 12h.01",
  expand: "M14 4h6v6 M10 20H4v-6 M20 4l-7 7 M4 20l7-7", pause: "M9 5v14 M15 5v14", play: "M8 5l11 7-11 7z", bolt: "M13 3L5 14h6l-1 7 8-11h-6z",
  cardio: "M3 12h4l2-6 4 12 2-6h6", food: "M7 3v8 M5 3v5a2 2 0 0 0 4 0V3 M7 11v10 M17 3c-2 2-3 4-3 7h3v11",
  scan: "M4 8V5a1 1 0 0 1 1-1h3 M16 4h3a1 1 0 0 1 1 1v3 M20 16v3a1 1 0 0 1-1 1h-3 M8 20H5a1 1 0 0 1-1-1v-3 M4 12h16",
  warn: "M12 4l9 16H3z M12 10v4 M12 17h.01", edit: "M4 20h4L19 9l-4-4L4 16z", info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 8h.01",
  crown: "M3 8l4 4 5-7 5 7 4-4-2 11H5z", lock: "M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3", trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13",
  out: "M9 4H5v16h4 M16 8l4 4-4 4 M20 12H9", dl: "M12 4v11 M7 11l5 5 5-5 M5 20h14", shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  moon: "M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10z", pic: "M4 5h16v14H4z M4 15l5-5 4 4 3-3 4 4 M9 9h.01"
};
export const ICON_NAMES = Object.keys(ICON_PATHS);

// A decorative inline line icon; an unknown name draws nothing.
export function icon(name, size = 24, style = "") {
  if (!Object.prototype.hasOwnProperty.call(ICON_PATHS, name)) return "";
  return `<svg class="ico" style="width:${size}px;height:${size}px;${style}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICON_PATHS[name]}"/></svg>`;
}

// The context every builder receives: the data the page computed (`base`) plus the tiny helpers, so a builder never touches the DOM.
export function buildCtx(base) {
  const b = base || {};
  return { ...b, esc, kg, icon, isRtl: !!b.rtl || !!b.isRtl };
}
