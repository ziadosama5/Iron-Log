// Profiles, privacy and search helpers (pure: no DOM, no Firebase). Unit-tested in tests/social.test.js.
// What is shared lives in profiles/{uid}; usernames/{name} and emails/{email} only point at a uid.
// The matching security rules are in firestore.rules (and tested in tests-rules/).
import { badges, xpSummary, trainingStreak, foodStreak, weekKey, prEvents, addDays } from "./achievements.js";
import { trainedOn } from "./workout-tools.js";

export const RESERVED_USERNAMES = ["admin", "administrator", "support", "ironlog", "iron-log", "moderator", "root", "system", "help", "staff", "official", "me", "null", "undefined"];

// [min, max] of every numeric field of the published summary. firestore.rules enforces the same ranges.
export const SUMMARY_LIMITS = {
  level: [1, 500], xp: [0, 10000000], badges: [0, 100], streakWeeks: [0, 600], foodDays: [0, 4000],
  workoutsWeek: [0, 50], workouts30: [0, 400], workoutsTotal: [0, 50000], volumeWeekKg: [0, 1000000], prs30: [0, 400]
};

export const normalizeUsername = s => String(s ?? "").trim().replace(/^@/, "").toLowerCase();

export function validUsername(name) {
  const n = String(name ?? "");
  if (n.length < 3) return { ok: false, reason: "short" };
  if (n.length > 20) return { ok: false, reason: "long" };
  if (!/^[a-z0-9_.]+$/.test(n)) return { ok: false, reason: "chars" };
  if (/^[._]|[._]$/.test(n)) return { ok: false, reason: "edges" };
  if (n.includes("..")) return { ok: false, reason: "dots" };
  if (RESERVED_USERNAMES.includes(n)) return { ok: false, reason: "reserved" };
  return { ok: true };
}

export function normalizeEmail(s) {
  if (typeof s !== "string") return null;
  const e = s.trim().toLowerCase();
  return /^[^\s@/]+@[^\s@/.]+(\.[^\s@/.]+)+$/.test(e) ? e : null;
}

const clamp = (v, lo, hi, step = 1) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  const c = Math.min(hi, Math.max(lo, n));
  return step === 1 ? Math.round(c) : Math.round(c * 10) / 10;
};

// Forces every field into the ranges the rules accept, so a published summary is never rejected.
export function clampSummary(s) {
  const out = {};
  for (const [k, [lo, hi]] of Object.entries(SUMMARY_LIMITS)) out[k] = clamp(s[k], lo, hi, k === "volumeWeekKg" ? 0.1 : 1);
  out.title = String(s.title ?? "").slice(0, 20);
  out.lastWorkout = typeof s.lastWorkout === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.lastWorkout) ? s.lastWorkout : null;
  out.updated = Number(s.updated) || 0;
  return out;
}

// The summary friends/the public may see. Derived from the user's own data only; never body, meals,
// per-workout or per-lift details.
export function buildSummary({ workouts = [], body = [], food = {}, days = [], profile = {}, today }, now) {
  const input = { workouts, body, food, days, profile, today };
  const list = badges(input), xp = xpSummary(input, list);
  const ws = workouts.filter(w => w.date <= today), trained = ws.filter(trainedOn);
  const wk = weekKey(today), since = addDays(today, -30);
  const week = trained.filter(w => weekKey(w.date) === wk);
  const volume = week.reduce((a, w) => a + (w.entries || []).reduce((b, e) => b + (e.sets || []).reduce((c, s) => c + (Number(s.w) || 0) * (Number(s.r) || 0), 0), 0), 0);
  const last = trained.reduce((m, w) => (w.date > m ? w.date : m), "");
  return clampSummary({
    level: xp.level, xp: xp.xp, title: xp.title, badges: list.filter(b => b.earned).length,
    streakWeeks: trainingStreak(workouts, days, today).weeks, foodDays: foodStreak(food, today),
    workoutsWeek: week.length, workouts30: trained.filter(w => w.date > since).length, workoutsTotal: trained.length,
    volumeWeekKg: volume, prs30: prEvents(ws).filter(e => e.date > since).length, lastWorkout: last || null, updated: now
  });
}

export function summaryEqual(a, b) {
  if (!a || !b) return !a && !b;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter(k => k !== "updated"));
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
}

export function shareLabel(v) {
  return v === "friends" ? "Friends" : v === "public" ? "Public" : "Private";
}

// The exact Firestore writes for saving the share settings: a list of {op, path, data}. Order matters:
// username docs first, then the profile, then the e-mail doc (the rules check the later documents
// against the profile written in the same batch).
export function planShare({ uid, current, next, email, summary, now }) {
  const ops = [];
  const oldName = current && current.username;
  if (next.username !== oldName) {
    ops.push({ op: "set", path: ["usernames", next.username], data: { uid, displayName: next.displayName, updated: now } });
    if (oldName) ops.push({ op: "delete", path: ["usernames", oldName] });
  } else if (current && current.displayName !== next.displayName) {
    ops.push({ op: "update", path: ["usernames", next.username], data: { displayName: next.displayName, updated: now } });
  }
  const profile = { username: next.username, displayName: next.displayName, visibility: next.visibility, findByEmail: !!next.findByEmail, updated: now };
  if ((next.visibility === "friends" || next.visibility === "public") && summary) profile.summary = summary;
  ops.push({ op: "set", path: ["profiles", uid], data: profile });
  if (next.findByEmail) {
    if (!email) return { error: "email-needed" };
    ops.push({ op: "set", path: ["emails", email], data: { uid } });
  } else if (current && current.findByEmail && email) {
    ops.push({ op: "delete", path: ["emails", email] });
  }
  return { ops };
}

// Whether the app should write a fresh summary now: only for friends/public, only when something
// changed, and not more often than every minGapMs.
export function shouldPublish({ visibility, last, next, lastAt, now, minGapMs = 20000 }) {
  if (visibility !== "friends" && visibility !== "public") return false;
  if (summaryEqual(last, next)) return false;
  return now - lastAt >= minGapMs;
}

// What the "Find a friend" box shows. A missing result and a hidden/unreadable one are the same {kind:"none"},
// so a search can't tell whether someone exists but keeps their progress private.
export function lookupResult(input, outcome) {
  const raw = String(input ?? "").trim();
  if (!raw) return { kind: "empty" };
  if (!normalizeEmail(raw) && !validUsername(normalizeUsername(raw)).ok) return { kind: "invalid" };
  if (!outcome || outcome.status !== "found" || !outcome.profile) return { kind: "none" };
  const p = outcome.profile;
  return { kind: "card", card: { displayName: p.displayName, username: p.username, summary: p.summary || null } };
}
