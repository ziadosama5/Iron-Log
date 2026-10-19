// Safety helpers: user reports and the "Delete my account" steps. Pure (no DOM, no Firebase).

export const REPORT_REASONS = [
  { id: "name", label: "Inappropriate name or username" },
  { id: "harassment", label: "Harassment" },
  { id: "spam", label: "Spam" },
  { id: "other", label: "Something else" }
];

// One report document per pair of people: reporting again overwrites it.
export function reportId(reporter, reported) {
  if (!reporter || !reported || reporter === reported) throw new Error("reportId needs two different uids");
  return reporter + "_" + reported;
}

// The report document, or null when anything is not valid (the rules check the same things).
export function buildReport({ reporter, reported, reason, username, now }) {
  if (!REPORT_REASONS.some(r => r.id === reason)) return null;
  if (!reporter || !reported || reporter === reported) return null;
  const name = typeof username === "string" ? username.trim() : "";
  if (name.length < 1 || name.length > 20) return null;
  if (typeof now !== "number" || !Number.isFinite(now)) return null;
  return { id: reportId(reporter, reported), data: { reporter, reported, reason, username: name, updated: now } };
}

// Consecutive slices of at most size (Firestore batches hold up to 500 writes).
export function chunk(list, size) {
  if (!(size >= 1)) throw new Error("chunk size must be at least 1");
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// The steps of "Delete my account and data", in the order they run. The Google account goes last so a
// failure never leaves data without an account; the shared profile step exists only when there is one.
export function wipePlan({ hasProfile }) {
  return [
    { id: "reauth", label: "Signing in again…" },
    ...(hasProfile ? [{ id: "share", label: "Removing your shared profile…" }] : []),
    { id: "friendships", label: "Removing friendships…" },
    { id: "blocks", label: "Removing blocks…" },
    { id: "items", label: "Removing your data…" },
    { id: "device", label: "Clearing this device…" },
    { id: "account", label: "Deleting your account…" }
  ];
}
