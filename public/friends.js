import { weekStart } from "./challenges.js";
import { addDays } from "./achievements.js";
// Friends: pair ids, the exact Firestore writes for each action, and the pure view logic. No DOM, no Firebase.

export function pairId(a, b) {
  if (!a || !b || a === b) throw new Error("pairId needs two different uids");
  return a < b ? a + "_" + b : b + "_" + a;
}

const pairPath = (a, b) => ["friendships", pairId(a, b)];
const blockPath = (blocker, blocked) => ["blocks", blocker + "_" + blocked];

export function planRequest({ me, meName, other, otherName, now }) {
  const data = { users: [me, other].sort(), requester: me, status: "pending", names: { [me]: meName, [other]: otherName }, updated: now };
  return { ops: [{ op: "set", path: pairPath(me, other), data }] };
}

export function planAccept({ me, other, now }) {
  return { ops: [{ op: "update", path: pairPath(me, other), data: { status: "accepted", updated: now } }] };
}

// Decline, cancel and remove friend are the same write.
export function planRemove({ me, other }) {
  return { ops: [{ op: "delete", path: pairPath(me, other) }] };
}

// otherName (optional) is kept on the block so the Blocked list can show who it is after the friendship is gone.
export function planBlock({ me, other, otherName, now }) {
  const data = { blocker: me, blocked: other, updated: now };
  if (otherName) data.name = otherName;
  return { ops: [
    { op: "set", path: blockPath(me, other), data },
    { op: "delete", path: pairPath(me, other) }
  ] };
}

export function planUnblock({ me, other }) {
  return { ops: [{ op: "delete", path: blockPath(me, other) }] };
}

export function planNameRefresh({ me, other, myName, now }) {
  return { ops: [{ op: "update", path: pairPath(me, other), data: { ["names." + me]: myName, updated: now } }] };
}

// Pairs where my stored name is not my current username: [{other}] (the app refreshes those once).
export function staleNameDocs(docs, me, myName) {
  if (!myName) return [];
  return (docs || []).filter(d => d && Array.isArray(d.users) && d.users.includes(me) && !(d.names && d.names[me] === myName))
    .map(d => ({ other: d.users.find(u => u !== me) }));
}

const otherOf = (d, me) => d.users.find(u => u !== me);

export function groupFriendships(docs, me, blocks) {
  const blockedIds = new Set((blocks || []).map(b => b.blocked));
  const out = { requests: [], friends: [], sent: [], blocked: [] };
  const nameSeen = {};
  for (const d of docs || []) {
    if (!d || !Array.isArray(d.users) || !d.users.includes(me)) continue;
    const uid = otherOf(d, me), name = (d.names && d.names[uid]) || null;
    nameSeen[uid] = name;
    if (blockedIds.has(uid)) continue;
    const item = { uid, name, updated: d.updated };
    if (d.status === "accepted") out.friends.push(item);
    else if (d.requester === me) out.sent.push(item);
    else out.requests.push(item);
  }
  for (const b of blocks || []) out.blocked.push({ uid: b.blocked, name: b.name ?? nameSeen[b.blocked] ?? null, updated: b.updated });
  out.friends.sort((a, b) => String(a.name).toLowerCase() < String(b.name).toLowerCase() ? -1 : 1);
  for (const k of ["requests", "sent", "blocked"]) out[k].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return out;
}

export function relationTo(me, other, docs, blocks) {
  if (me === other) return "self";
  if ((blocks || []).some(b => b.blocked === other)) return "blocked";
  const d = (docs || []).find(x => x && Array.isArray(x.users) && x.users.includes(me) && x.users.includes(other));
  if (!d) return "none";
  if (d.status === "accepted") return "friends";
  return d.requester === me ? "sent" : "received";
}

const COMPARE_KEYS = ["level", "workoutsWeek", "workouts30", "streakWeeks", "volumeWeekKg", "prs30", "workoutsTotal"];

export function compareSummaries(mine, theirs) {
  return COMPARE_KEYS.map(key => {
    const m = (mine && Number(mine[key])) || 0, t = (theirs && Number(theirs[key])) || 0;
    return { key, mine: m, theirs: t, leader: m > t ? "me" : m < t ? "them" : "tie" };
  });
}

// Workouts this week from a shared summary. The summary is published by its owner when they open the app, so one
// published before this week's Saturday describes an earlier week and counts as 0. null = no usable summary.
export function weekCount(summary, today = new Date().toISOString().slice(0, 10)) {
  if (!summary || summary.workoutsWeek == null || !Number.isFinite(Number(summary.workoutsWeek))) return null;
  const upd = Number(summary.updated);
  if (Number.isFinite(upd) && upd > 0 && new Date(upd).toISOString().slice(0, 10) < weekStart(today)) return 0;
  return Number(summary.workoutsWeek);
}

// The leaderboard: me and my friends ranked by one metric: "week" (workouts this week), "month" (workouts in 30 days)
// or "level" (level, ties by xp). Ties share a rank (1,2,2,4); people with no usable summary come last, in the given
// order, with a null value and rank. An unknown metric behaves like "week".
// Workouts in 30 days from a shared summary; one published more than 30 days ago describes an older month and counts as 0.
export function monthCount(summary, today = new Date().toISOString().slice(0, 10)) {
  if (!summary || summary.workouts30 == null || !Number.isFinite(Number(summary.workouts30))) return null;
  const upd = Number(summary.updated);
  if (Number.isFinite(upd) && upd > 0 && new Date(upd).toISOString().slice(0, 10) < addDays(today, -30)) return 0;
  return Number(summary.workouts30);
}

export function rankBoard(me, friends, metric, today) {
  const m = metric === "month" || metric === "level" ? metric : "week";
  const num = v => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
  const valueOf = s => !s ? null : m === "week" ? weekCount(s, today) : m === "month" ? monthCount(s, today) : num(s.level);
  const people = [{ uid: me.uid, name: me.name, isMe: true, summary: me.summary }, ...(friends || []).map(f => ({ uid: f.uid, name: f.name, isMe: false, summary: f.summary }))]
    .map((p, i) => ({ uid: p.uid, name: p.name, isMe: p.isMe, value: valueOf(p.summary), xp: m === "level" ? num(p.summary && p.summary.xp) || 0 : 0, i }));
  const ranked = people.filter(p => p.value !== null).sort((a, b) => b.value - a.value || b.xp - a.xp || a.i - b.i);
  ranked.forEach((p, k) => { p.rank = k > 0 && ranked[k - 1].value === p.value && ranked[k - 1].xp === p.xp ? ranked[k - 1].rank : k + 1; });
  const rest = people.filter(p => p.value === null).map(p => ({ ...p, rank: null }));
  return [...ranked, ...rest].map(({ i, xp, ...p }) => p);
}

// "Who's ahead this week" (workouts this week), kept for callers that want the old shape.
export function rankWeek(me, friends, today) {
  return rankBoard(me, friends, "week", today).map(({ value, ...p }) => ({ ...p, workoutsWeek: value }));
}
