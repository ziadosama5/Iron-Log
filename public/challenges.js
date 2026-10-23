// Challenges: dates, counting training days, ranking and the exact Firestore writes. Pure (no DOM, no Firebase).
// All date math is UTC on "YYYY-MM-DD" strings; the week starts on Saturday (like the rest of the app).

export const MAX_MEMBERS = 6;
export const MAX_INVITEES = 5;
export const MAX_OPEN = 5;
export const WEEK_CHOICES = [1, 2, 4];

const toUtc = d => { const [y, m, day] = String(d).split("-").map(Number); return Date.UTC(y, m - 1, day); };
const fromUtc = ms => new Date(ms).toISOString().slice(0, 10);

export const addDaysISO = (date, n) => fromUtc(toUtc(date) + n * 86400000);

// The Saturday on or before the date.
export function weekStart(date) {
  const dow = new Date(toUtc(date)).getUTCDay();          // 0 = Sunday ... 6 = Saturday
  return addDaysISO(date, -((dow + 1) % 7));
}

// The Saturday 1 to 7 days after today.
export function nextSaturday(today) {
  const dow = new Date(toUtc(today)).getUTCDay();
  const ahead = (6 - dow + 7) % 7;
  return addDaysISO(today, ahead === 0 ? 7 : ahead);
}

export function challengeDates({ startChoice, weeks, today }) {
  if (!WEEK_CHOICES.includes(weeks)) throw new Error("weeks must be 1, 2 or 4");
  if (startChoice !== "today" && startChoice !== "saturday") throw new Error("unknown start choice");
  const start = startChoice === "today" ? today : nextSaturday(today);
  return { start, end: addDaysISO(start, weeks * 7 - 1) };
}

export function statusOf(ch, today) {
  if (today < ch.start) return "upcoming";
  if (today > ch.end) return "finished";
  return "active";
}

// 1-based day of the challenge while it is active, else null.
export function dayNumber(ch, today) {
  if (statusOf(ch, today) !== "active") return null;
  return { day: (toUtc(today) - toUtc(ch.start)) / 86400000 + 1, total: ch.weeks * 7 };
}

// Distinct trained dates inside [start, min(end, today)].
export function countDays(workouts, start, end, today, isTrained) {
  const last = end < today ? end : today;
  const days = new Set();
  for (const w of workouts || []) {
    if (w && w.date >= start && w.date <= last && isTrained(w)) days.add(w.date);
  }
  return days.size;
}

// Leaderboard rows: joined members by days (desc) then name, competition ranking, invited-only people last.
export function rankMembers({ members, joined, progress, names }) {
  const nameOf = u => (names && names[u]) || "?";
  const isJoined = new Set(joined);
  const rows = members.map(uid => ({ uid, name: nameOf(uid), days: isJoined.has(uid) ? ((progress && progress[uid] && progress[uid].days) || 0) : 0, rank: null, joined: isJoined.has(uid) }));
  const inn = rows.filter(r => r.joined).sort((a, b) => b.days - a.days || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  inn.forEach((r, i) => { r.rank = i > 0 && inn[i - 1].days === r.days ? inn[i - 1].rank : i + 1; });
  return [...inn, ...rows.filter(r => !r.joined)];
}

export function winners(rows, status) {
  if (status !== "finished") return [];
  return rows.filter(r => r.joined && r.rank === 1 && r.days > 0).map(r => r.uid);
}

const chPath = cid => ["challenges", cid];
const progressPath = (cid, uid) => ["challenges", cid, "progress", uid];

export function planCreate({ cid, owner, ownerName, invitees, weeks, startChoice, today, now }) {
  if (!Array.isArray(invitees) || invitees.length < 1 || invitees.length > MAX_INVITEES) throw new Error("invite 1 to 5 friends");
  const uids = invitees.map(i => i.uid);
  if (new Set(uids).size !== uids.length || uids.includes(owner)) throw new Error("invitees must be different people");
  const { start, end } = challengeDates({ startChoice, weeks, today });
  const names = { [owner]: ownerName };
  invitees.forEach(i => { names[i.uid] = i.name; });
  return { ops: [{ op: "set", path: chPath(cid), data: { owner, members: [owner, ...uids], joined: [owner], names, start, weeks, end, updated: now } }] };
}

export function planAccept({ cid, me, current, now }) {
  if (!current.members.includes(me) || current.joined.includes(me)) throw new Error("cannot accept");
  return { ops: [{ op: "update", path: chPath(cid), data: { joined: [...current.joined, me], updated: now } }] };
}

// Leaving or declining: my score goes first, then I come off both lists and my username comes off the names. The owner deletes the challenge instead.
export function planLeave({ cid, me, current, now }) {
  if (me === current.owner) throw new Error("the owner deletes the challenge instead");
  return { ops: [
    { op: "delete", path: progressPath(cid, me) },
    { op: "update", path: chPath(cid), data: { members: current.members.filter(u => u !== me), joined: current.joined.filter(u => u !== me), names: Object.fromEntries(Object.entries(current.names || {}).filter(([u]) => u !== me)), updated: now } }
  ] };
}

// Every progress document goes before the challenge (subcollections are not removed with their parent).
export function planDelete({ cid, memberUids }) {
  return { ops: [...memberUids.map(uid => ({ op: "delete", path: progressPath(cid, uid) })), { op: "delete", path: chPath(cid) }] };
}

export function planProgress({ cid, me, days, now }) {
  return { ops: [{ op: "set", path: progressPath(cid, me), data: { days, updated: now } }] };
}

// Where `me` stands among the people who joined: leading (gap = lead over the next person), tied for first,
// behind the leader (gap in days) or alone. null when I have not joined.
export function standing(rows, me) {
  const inn = (rows || []).filter(r => r.joined), mine = inn.find(r => r.uid === me);
  if (!mine) return null;
  const base = { rank: mine.rank, of: inn.length };
  if (inn.length < 2) return { kind: "alone", ...base, gap: 0, leader: mine.name };
  const tops = inn.filter(r => r.rank === 1);
  if (mine.rank === 1) {
    if (tops.length > 1) return { kind: "tied", ...base, gap: 0, leader: mine.name };
    return { kind: "leading", ...base, gap: mine.days - inn[1].days, leader: mine.name };
  }
  return { kind: "behind", ...base, gap: tops[0].days - mine.days, leader: tops[0].name };
}

// Time position of a challenge: day (1-based while active), days left after today, percent through, days until start.
export function timeLeft(ch, today) {
  const status = statusOf(ch, today), total = ch.weeks * 7;
  if (status === "upcoming") return { status, day: null, total, left: total, pct: 0, startsIn: (toUtc(ch.start) - toUtc(today)) / 86400000 };
  if (status === "finished") return { status, day: null, total, left: 0, pct: 100, startsIn: 0 };
  const day = dayNumber(ch, today).day;
  return { status, day, total, left: total - day, pct: Math.round(day / total * 100), startsIn: 0 };
}

// My final place for a results line: rank among the people who joined, null when I did not join.
export function myResult(rows, me) {
  const s = standing(rows, me);
  return s ? { rank: s.rank, of: s.of } : null;
}
