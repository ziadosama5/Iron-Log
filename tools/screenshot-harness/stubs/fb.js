// Stand-ins for the Firebase SDK so the real app can run signed-in with sample data (screenshots only).
const day = n => new Date(Date.now() - n * 864e5).toLocaleDateString("en-CA");
const T = Date.now();
const S = (w, r, m) => ({ w, r, t: T - m * 60000 });
const items = [];
const add = (id, data) => items.push({ id, data: () => data });
add("program", { v: 2, days: [{ id: "d1", name: "Push", focus: ["Chest", "Shoulders", "Triceps"], exercises: ["Bench Press", "Overhead Press", "Lateral Raise"], weekdays: [6, 2] }, { id: "d2", name: "Pull", focus: ["Back", "Biceps"], exercises: ["Pull-up", "Barbell Row"], weekdays: [0, 3] }] });
add("profile", { sex: "male", height: 178, birthYear: 1996, goal: "fat-loss", goalWeight: 78, goalStart: day(30) });
const gymQ = new URLSearchParams(location.search).get("gym");
add("settings", { rest: {}, seenBadges: new URLSearchParams(location.search).get("cele") ? ["workouts-1"] : ["workouts-1","workouts-10","workouts-50","workouts-100","workouts-250","kcal-10k","kcal-50k","kcal-100k","cardio-1000","cardio-5000","goal-first-kg","goal-reached","streak-4","streak-12","streak-26","food-7","food-30","pr-1","pr-10","bench-bw","squat-1.5","deadlift-2","volume-100t","volume-1000t"], ...(gymQ ? { gym: JSON.parse(gymQ) } : {}) });
for (let i = 0; i < 10; i++) { const date = day(i * 2 + 1); add("w-" + date, { date, dayId: "d" + (1 + (i % 2)), dayName: ["Push", "Pull"][i % 2], updated: T, entries: [{ ex: "Bench Press", sets: [S(60 + i, 8, 50), S(62.5 + i, 6, 45)], done: true }, { ex: "Overhead Press", sets: [S(40, 8, 35)], done: true }] }); }
// ?bw=1: a bodyweight session two days ago (Push-up and Pull-up at the top of their ranges, Plank at 60 s)
if (new URLSearchParams(location.search).get("bw")) add("w-" + day(2), { date: day(2), dayId: "d2", dayName: "Pull", updated: T, entries: [
  { ex: "Push-up", bw: true, sets: [S(0, 12, 40), S(0, 12, 35), S(0, 12, 30)] }, { ex: "Pull-up", bw: true, sets: [S(0, 6, 25), S(0, 6, 20), S(0, 6, 15)] }, { ex: "Plank", bw: true, sets: [S(0, 60, 10), S(0, 60, 8), S(0, 60, 6)] }] });
// ?bw=2 also: an older session from before the feature (no bw flag) of the same pull-up
if (new URLSearchParams(location.search).get("bw") === "2") add("w-" + day(4), { date: day(4), dayId: "d2", dayName: "Pull", updated: T, entries: [{ ex: "Pull-up", sets: [S(0, 5, 30), S(0, 5, 25), S(0, 5, 20)] }] });
for (let i = 0; i < 6; i++) { const date = day(i * 5); add("b-" + date, { date, weight: 86 - i * 0.6, waist: 92 - i * 0.4, updated: T }); }
for (let i = 1; i < 6; i++) add("f-" + day(i), { date: day(i), meals: [{ id: "x" + i, name: "Lunch", kcal: 2100, protein: 150 }] });

const freshQ = new URLSearchParams(location.search).get("fresh");
if (freshQ) { const keep = freshQ === "2" ? ["settings"] : ["profile", "settings"]; items.splice(0, items.length, ...items.filter(i => keep.includes(i.id))); }
// in-memory "database" for the sharing collections
const mem = {
  "usernames/zed": { uid: "u2", displayName: "Zed", updated: 1 },
  "profiles/u2": { username: "zed", displayName: "Zed", visibility: "public", findByEmail: false, updated: 1,
    summary: { level: 7, xp: 5200, title: "Regular", badges: 9, streakWeeks: 4, foodDays: 12, workoutsWeek: 3, workouts30: 14, workoutsTotal: 120, volumeWeekKg: 18250.5, prs30: 3, lastWorkout: day(1), updated: 1 } },
  "usernames/hidden": { uid: "u3", displayName: "Hidden", updated: 1 },
  "profiles/u3": { username: "hidden", displayName: "Hidden", visibility: "private", findByEmail: false, updated: 1 }
};
if (new URLSearchParams(location.search).get("mine") === "1") {
  mem["usernames/ziad"] = { uid: "u1", displayName: "Ziad", updated: 1 };
  mem["profiles/u1"] = { username: "ziad", displayName: "Ziad", visibility: "public", findByEmail: true, updated: 1, summary: null };
  delete mem["profiles/u1"].summary;
}
const path = segs => segs.slice(1).join("/");
export const initializeApp = () => ({});
export const getAuth = () => ({ currentUser: { uid: "u1" } });
export class GoogleAuthProvider { setCustomParameters() {} }
export const signInWithPopup = () => Promise.resolve();
export const signInWithRedirect = () => Promise.resolve();
export const getRedirectResult = () => Promise.resolve(null);
let authCb = null;
export const onAuthStateChanged = (a, cb) => { authCb = cb; window.__fakeAuth = u => cb(u); setTimeout(() => cb({ uid: "u1", displayName: "Ziad", email: "ziad@example.com", emailVerified: true }), 0); return () => {}; };
export const signOut = () => { if (authCb) authCb(null); return Promise.resolve(); };
export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const collection = (...segs) => ({ path: path(segs) });
export const doc = (...segs) => ({ path: path(segs), id: segs[segs.length - 1] });
export const setDoc = (ref, data) => { mem[ref.path] = data; return Promise.resolve(); };
// arrayUnion(...values) is a marker that merge() resolves against the stored array, like Firestore does on the server.
export const arrayUnion = (...vals) => ({ __union: vals });
const merge = (target, d) => { for (const k of Object.keys(d)) target[k] = d[k] && d[k].__union ? [...new Set([...(target[k] || []), ...d[k].__union])] : d[k]; return target; };
export const updateDoc = (ref, data) => { mem[ref.path] = merge(mem[ref.path] || {}, data); return Promise.resolve(); };
export const deleteDoc = ref => { delete mem[ref.path]; return Promise.resolve(); };
export const getDoc = ref => Promise.resolve(ref.path in mem ? { exists: () => true, data: () => mem[ref.path] } : { exists: () => false, data: () => undefined });
const Q = new URLSearchParams(location.search);
const calls = (() => { try { return JSON.parse(localStorage.getItem("__calls") || "[]"); } catch (e) { return []; } })();
const logc = n => { calls.push(n); try { localStorage.setItem("__calls", JSON.stringify(calls)); } catch (e) {} };
export const reauthenticateWithPopup = () => { logc("reauth"); return Q.get("reauth") === "fail" ? Promise.reject(new Error("cancelled")) : Promise.resolve(); };
export const deleteUser = () => { logc("account"); try { sessionStorage.setItem("__ranOnce", "1"); } catch (e) {} return Q.get("failat") === "account" ? Promise.reject(new Error("no")) : Promise.resolve(); };
export const terminate = () => { logc("terminate"); return Promise.resolve(); };
export const clearIndexedDbPersistence = () => { logc("clearIdb"); return Promise.resolve(); };
export const getDocs = ref => {
  const p = ref.path; logc("list:" + p);
  if (Q.get("failat") === "items" && p.endsWith("/items") && !window.__itemsFailed) { window.__itemsFailed = true; return Promise.reject(new Error("boom")); }
  if (p === "challenges") return Promise.resolve({ docs: CHS.map(x => ({ id: x.id, ref: { path: "challenges/" + x.id }, data: () => x.doc })) });
  if (p.startsWith("challenges/") && p.endsWith("/progress")) { const cid = p.split("/")[1], pr = (CHS.find(x => x.id === cid) || { progress: {} }).progress; return Promise.resolve({ docs: Object.entries(pr).map(([u, v]) => ({ id: u, ref: { path: p + "/" + u }, data: () => v })) }); }
  const list = p === "friendships" ? friendships.map((d, i) => ({ d, path: "friendships/" + d.users.join("_") })) : p === "blocks" ? blocksList.map(d => ({ d, path: "blocks/" + d.blocker + "_" + d.blocked })) : items.map(i => ({ d: i.data(), path: p + "/" + i.id }));
  return Promise.resolve({ docs: list.map(x => ({ ref: { path: x.path }, data: () => x.d })) });
};
export const writeBatch = () => { const ops = []; return { set: (r, d) => ops.push(() => { logc("set:" + r.path + ":" + JSON.stringify(d)); mem[r.path] = d; }), update: (r, d) => ops.push(() => { logc("update:" + r.path + ":" + JSON.stringify(d)); }, () => merge(mem[r.path] || (mem[r.path] = {}), d)), delete: r => ops.push(() => { logc("delete:" + r.path); delete mem[r.path]; }), commit: () => { ops.forEach(f => f()); return Promise.resolve(); } }; };
export const query = c => c;
export const where = () => ({});
const FR = new URLSearchParams(location.search).get("friends") === "1";
const T0 = Date.now();
const friendships = FR ? [
  { users: ["u1", "u2"], requester: "u1", status: "accepted", names: { u1: "ziad", u2: "zed" }, updated: T0 - 5e6 },
  { users: ["u1", "u3"], requester: "u3", status: "pending", names: { u1: "ziad", u3: "hidden" }, updated: T0 - 4e6 },
  { users: ["u1", "u4"], requester: "u1", status: "pending", names: { u1: "ziad", u4: "mara" }, updated: T0 - 3e6 }
] : [];
const blocksList = FR ? [{ blocker: "u1", blocked: "u5", updated: T0 - 2e6 }] : [];
const CH = new URLSearchParams(location.search).get("ch") === "1";
const CHS = CH ? [
  { id: "c1", doc: { owner: "u2", members: ["u2", "u1", "u3"], joined: ["u2", "u1"], names: { u1: "ziad", u2: "zed", u3: "omar" }, start: day(3), weeks: 2, end: day(-10), updated: 1 }, progress: { u2: { days: 5, updated: 1 } } },
  { id: "c2", doc: { owner: "u3", members: ["u3", "u1"], joined: ["u3"], names: { u1: "ziad", u3: "omar" }, start: day(-1), weeks: 1, end: day(-7), updated: 1 }, progress: {} },
  { id: "c3", doc: { owner: "u1", members: ["u1", "u2"], joined: ["u1", "u2"], names: { u1: "ziad", u2: "zed" }, start: day(30), weeks: 2, end: day(17), updated: 1 }, progress: { u1: { days: 9, updated: 1 }, u2: { days: 11, updated: 1 } } }
] : [];
export const onSnapshot = (col, opts, cb) => {
  if (typeof opts === "function") {
    const withId = (list, idOf) => list.map(d => ({ id: idOf(d), data: () => d }));
    let docs;
    if (col.path === "challenges") docs = withId(CHS.map(x => x.doc), d => CHS.find(x => x.doc === d).id);
    else if (col.path.startsWith("challenges/") && col.path.endsWith("/progress")) { const cid = col.path.split("/")[1], p = (CHS.find(x => x.id === cid) || { progress: {} }).progress; docs = Object.entries(p).map(([u, v]) => ({ id: u, data: () => v })); }
    else { const list = col.path === "friendships" ? friendships : col.path === "blocks" ? blocksList : []; docs = list.map(d => ({ data: () => d })); }
    setTimeout(() => opts({ docs, metadata: { fromCache: false } }), 10); return () => {};
  }
  setTimeout(() => cb({ docs: items, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [1] }), 10); return () => {};
};
