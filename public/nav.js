// Navigation registry: which screen (state.view) belongs to which of the five tabs, and the section pills.
// Pure (no DOM/Firebase), unit-tested in tests/nav.test.js.

export const TABS = [
  { id: "today", label: "Today", icon: "today", views: ["log"] },
  { id: "plan", label: "Plan", icon: "plan", views: ["days", "gym"] },
  { id: "progress", label: "Progress", icon: "progress", views: ["body", "progress", "goals", "coach", "history"] },
  { id: "friends", label: "Friends", icon: "friends", views: ["friends", "challenges", "find"] },
  { id: "me", label: "Me", icon: "me", views: ["profile"] },
];

// Full-screen flows: no tab bar, never restored as the last view.
export const FULLSCREEN = ["journey", "delete"];

export const PILL_LABEL = {
  days: "Days", gym: "My Gym",
  body: "Body", progress: "Lifts", goals: "Goals", coach: "Coach", history: "History",
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
