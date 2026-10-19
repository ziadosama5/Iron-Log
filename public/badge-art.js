// Badge families: the 24 badges of achievements.js grouped into 9 ladders that level up (bronze → silver → gold).
// Pure (no DOM/Firebase), unit-tested in tests/badge-art.test.js. Nothing here is stored: it only changes how badges are shown.

export const FAMILIES = [
  { id: "workouts", name: "Workouts", icon: "dumbbell", ids: ["workouts-1", "workouts-10", "workouts-50", "workouts-100", "workouts-250"] },
  { id: "kcal", name: "Calories burned", icon: "flame", ids: ["kcal-10k", "kcal-50k", "kcal-100k"] },
  { id: "cardio", name: "Cardio minutes", icon: "bolt", ids: ["cardio-1000", "cardio-5000"] },
  { id: "goal", name: "Goal weight", icon: "scale", ids: ["goal-first-kg", "goal-reached"] },
  { id: "streak", name: "Training streak", icon: "calendar", ids: ["streak-4", "streak-12", "streak-26"] },
  { id: "food", name: "Food streak", icon: "food", ids: ["food-7", "food-30"] },
  { id: "pr", name: "Personal records", icon: "trophy", ids: ["pr-1", "pr-10"] },
  { id: "strength", name: "Strength club", icon: "crown", ids: ["bench-bw", "squat-1.5", "deadlift-2"] },
  { id: "volume", name: "Volume lifted", icon: "dumbbell", ids: ["volume-100t", "volume-1000t"] },
];

export function familyOf(badgeId) { return FAMILIES.find(f => f.ids.includes(badgeId)) || null; }

export function tierFor(level, of) {
  if (!level || level < 1) return "locked";
  if (level >= of) return "gold";
  if (of === 2) return "silver";
  return level === 1 ? "bronze" : "silver";
}

const clamp01 = n => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function familyState(family, list) {
  const byId = new Map((list || []).map(b => [b.id, b]));
  const steps = family.ids.map(id => { const b = byId.get(id); return { id, name: b ? b.name : id, earned: b ? b.earned || null : null }; });
  const level = steps.filter(s => s.earned).length;
  const nextStep = steps.find(s => !s.earned);
  let next = null, pct = 1;
  if (nextStep) {
    const b = byId.get(nextStep.id) || {};
    next = { id: nextStep.id, name: nextStep.name, value: b.value, target: b.target };
    pct = b.target > 0 ? clamp01(b.value / b.target) : 0;
  }
  return { id: family.id, name: family.name, icon: family.icon, level, of: family.ids.length, tier: tierFor(level, family.ids.length), next, pct, steps };
}

export function allFamilies(list) { return FAMILIES.map(f => familyState(f, list)); }

// The unfinished family nearest its next level (ties keep ladder order); null when everything is done.
export function closestFamily(states) {
  let best = null;
  for (const s of states) if (s.next && (!best || s.pct > best.pct)) best = s;
  return best;
}

// 24×24 line-icon path data (stroke = currentColor)
export const ICONS = {
  dumbbell: "M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12",
  flame: "M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z",
  bolt: "M13 3L5 13h6l-1 8 8-10h-6z",
  scale: "M4 8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM8.5 10a3.5 3.5 0 0 1 7 0M12 10l1.5-2",
  calendar: "M4 8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM4 10h16M9 3v4M15 3v4",
  food: "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8",
  crown: "M4 18l-1-10 5 4 4-7 4 7 5-4-1 10z",
  lock: "M5 13a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 13v5.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18.5zM8 10.5V8a4 4 0 0 1 8 0v2.5",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  chart: "M4 19V5M4 19h16M8 15l4-4 3 3 5-6",
  people: "M3 19c0-3 3-5 6-5s6 2 6 5M16 14c3 0 5 1.5 5 4M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19.2 9a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0z",
  user: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 20c0-4 4-6 8-6s8 2 8 6",
  today: "M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12",
};
