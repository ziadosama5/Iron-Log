// Navigation registry: which screen (state.view) belongs to which of the five tabs, and the section pills.
// Pure (no DOM/Firebase), unit-tested in tests/nav.test.js.

export const TABS = [
  { id: "today", label: "Today", icon: "today", views: ["log"] },
  { id: "plan", label: "Plan", icon: "plan", views: ["days", "gym"] },
  { id: "progress", label: "Progress", icon: "progress", views: ["overview", "body", "progress", "goals", "coach", "history"] },
  { id: "friends", label: "Friends", icon: "friends", views: ["friends", "challenges", "find"] },
  { id: "me", label: "Me", icon: "me", views: ["profile"] },
];

// Full-screen flows: no tab bar, never restored as the last view.
export const FULLSCREEN = ["journey", "delete"];

export const PILL_LABEL = {
  days: "Days", gym: "My Gym",
  overview: "Overview", body: "Body", progress: "Lifts", goals: "Goals", coach: "Coach", history: "History",
  friends: "Friends", challenges: "Challenges", find: "Find",
};

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const BY_VIEW = {};
TABS.forEach(t => t.views.forEach(v => { BY_VIEW[v] = t.id; }));

export function tabOf(view) { return typeof view === "string" && has(BY_VIEW, view) ? BY_VIEW[view] : null; }

export function pillsFor(tabId) {
  const t = TABS.find(x => x.id === tabId);
  return t && t.views.length > 1 ? t.views.slice() : [];
}

// Any value saved in ironlog.view (old or damaged) becomes a screen the app can draw.
export function migrateView(saved) { return tabOf(saved) ? saved : "log"; }

// The tab one step away (dir +1 = next, -1 = previous), or null at either end.
export function neighborTab(tabId, dir) {
  const i = TABS.findIndex(t => t.id === tabId);
  const j = i + dir;
  return i < 0 || j < 0 || j >= TABS.length ? null : TABS[j].id;
}

// A finished touch gesture -> +1 (next tab), -1 (previous tab) or 0 (not a tab swipe).
// Swipe left = next in left-to-right layouts; mirrored in right-to-left (the tab bar is mirrored too).
// Ignored: short, mostly vertical, or starting within `edge` px of a screen edge (the phone's own back gesture).
export function swipeDirection({ dx, dy, startX, width, rtl = false, minDist = 60, edge = 24 }) {
  if (!(Math.abs(dx) >= minDist) || Math.abs(dx) < 1.5 * Math.abs(dy)) return 0;
  if (startX < edge || startX > width - edge) return 0;
  const next = rtl ? dx > 0 : dx < 0;
  return next ? 1 : -1;
}
