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
