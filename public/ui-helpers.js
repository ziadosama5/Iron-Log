// Small pure helpers for the UI (theme, tip order, quick weight). Unit-tested in tests/ui-helpers.test.js.

// Theme setting ("system" | "light" | "dark") → value for <html data-theme>, or null to follow the phone.
export function themeAttr(setting) {
  return setting === "light" || setting === "dark" ? setting : null;
}

// Coach tips: warnings first, then info, then good news; order kept within each group.
const TONE_ORDER = { warn: 0, info: 1, good: 2 };
export function sortTips(items) {
  return (items || []).map((t, i) => [t, i])
    .sort((a, b) => (TONE_ORDER[a[0].tone] ?? 1) - (TONE_ORDER[b[0].tone] ?? 1) || a[1] - b[1])
    .map(([t]) => t);
}

// Body tab quick weight: set the weight on that day's entry and keep everything else.
export function withWeight(entry, date, kg) {
  return { ...(entry || { date }), weight: kg };
}

// Suggestion lists: the first `limit` items, or all of them when expanded ("Show more").
export function visibleItems(items, expanded, limit = 6) {
  const list = items || [];
  const shown = expanded ? list : list.slice(0, limit);
  return { shown, hidden: list.length - shown.length };
}

// The exact settings document written to Firestore. Every field of the settings lives here so one
// save (rest times, badges seen, gym) never drops another. gym: absent = not set, [] = bodyweight only.
export function settingsDoc(s, now) {
  const x = s || {};
  return { rest: x.rest || {}, ...(x.seenBadges ? { seenBadges: x.seenBadges } : {}), ...(Array.isArray(x.gym) ? { gym: x.gym } : {}), ...(x.targets && Object.keys(x.targets).length ? { targets: x.targets } : {}), updated: now };
}

// Whether the Days tab shows the "set up your gym" card: not before the first sync (settings may not
// have loaded), only while the gym is unset (an empty list is a choice), never once dismissed.
export function showGymHint({ gym, dismissed, synced }) {
  return synced === true && gym === undefined && !dismissed;
}

// Whole calendar days from a YYYY-MM-DD date to another (today by default the caller passes it); never negative.
export function daysSince(date, today) {
  const d = (new Date(today + "T12:00:00") - new Date(date + "T12:00:00")) / 864e5;
  return Math.max(0, Math.round(d));
}

// Avatar helpers: one or two letters (by code point, so Arabic and emoji work) and a stable colour per name.
export function initialsOf(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const chars = w => Array.from(w);
  const s = words.length > 1 ? chars(words[0])[0] + chars(words[1])[0] : chars(words[0]).slice(0, 2).join("");
  return s.toUpperCase();
}
export function avatarHue(name) {
  let h = 0;
  for (const c of String(name || "")) h = (h * 31 + c.codePointAt(0)) % 360;
  return h;
}
