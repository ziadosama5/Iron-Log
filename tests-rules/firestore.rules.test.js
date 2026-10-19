// Security-rules tests for firestore.rules. Run from this folder: `npm install` then `npm test`
// (starts the Firestore emulator, so Java is required). Not part of the root `npm test`.
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, collection, getDocs, query, where } from "firebase/firestore";

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-iron-log", firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const U1 = { email: "u1@x.com", email_verified: true }, U2 = { email: "u2@x.com", email_verified: true };
const as = (uid, claims) => env.authenticatedContext(uid, claims).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = fn => env.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));

const SUMMARY = { level: 3, xp: 400, title: "Rookie", badges: 2, streakWeeks: 1, foodDays: 0, workoutsWeek: 2, workouts30: 9, workoutsTotal: 20, volumeWeekKg: 5000.5, prs30: 1, lastWorkout: "2026-10-17", updated: 5 };
const profile = (o = {}) => ({ username: "ziad", displayName: "Ziad", visibility: "private", findByEmail: false, updated: 1, ...o });
const nameDoc = (uid = "u1") => ({ uid, updated: 1 });

// A claim batch: username doc + profile in one commit (what the app does).
const claim = async (db, uid, name, extra = {}) => {
  const b = writeBatch(db);
  b.set(doc(db, "usernames", name), nameDoc(uid));
  b.set(doc(db, "profiles", uid), profile({ username: name, ...extra }));
  return b.commit();
};
const seedClaim = (uid, name, extra = {}) => seed(async db => {
  await setDoc(doc(db, "usernames", name), nameDoc(uid));
  await setDoc(doc(db, "profiles", uid), profile({ username: name, ...extra }));
});

test("existing paths: owner reads and writes users/{uid}/items, others and signed-out cannot", async () => {
  await assertSucceeds(setDoc(doc(as("u1", U1), "users/u1/items/profile"), { sex: "male", updated: 1 }));
  await assertSucceeds(getDoc(doc(as("u1", U1), "users/u1/items/profile")));
  await assertFails(getDoc(doc(as("u2", U2), "users/u1/items/profile")));
  await assertFails(setDoc(doc(as("u2", U2), "users/u1/items/profile"), { sex: "x" }));
  await assertFails(getDoc(doc(anon(), "users/u1/items/profile")));
});

test("list is denied on usernames, emails and profiles", async () => {
  await seedClaim("u1", "ziad", { visibility: "public" });
  for (const c of ["usernames", "emails", "profiles"]) await assertFails(getDocs(collection(as("u2", U2), c)));
});

test("usernames: claim with a matching profile in the same batch is allowed", async () => {
  await assertSucceeds(claim(as("u1", U1), "u1", "ziad"));
});

test("usernames: claim without the profile write is denied", async () => {
  await assertFails(setDoc(doc(as("u1", U1), "usernames", "ziad"), nameDoc("u1")));
});

test("usernames: a taken name cannot be claimed or overwritten", async () => {
  await seedClaim("u2", "ziad");
  await assertFails(claim(as("u1", U1), "u1", "ziad"));
  const db = as("u1", U1);
  await assertFails(setDoc(doc(db, "usernames", "ziad"), nameDoc("u1")));
});

test("usernames: reserved and invalid names are denied", async () => {
  for (const bad of ["admin", "ironlog", "ab", "a..b", ".abc", "abc_", "Ziad", "a".repeat(21), "zi ad", "zi-ad"]) {
    await assertFails(claim(as("u1", U1), "u1", bad));
  }
});

test("usernames: extra keys or another user's uid are denied", async () => {
  const db = as("u1", U1);
  let b = writeBatch(db);
  b.set(doc(db, "usernames", "ziad"), { ...nameDoc("u1"), extra: 1 });
  b.set(doc(db, "profiles", "u1"), profile());
  await assertFails(b.commit());
  b = writeBatch(db);
  b.set(doc(db, "usernames", "ziad"), nameDoc("u2"));
  b.set(doc(db, "profiles", "u1"), profile());
  await assertFails(b.commit());
});

test("usernames: only the owner can update or delete; anyone signed in can get; signed-out cannot", async () => {
  await seedClaim("u1", "ziad");
  await assertFails(deleteDoc(doc(as("u2", U2), "usernames", "ziad")));
  await assertSucceeds(getDoc(doc(as("u2", U2), "usernames", "ziad")));
  await assertFails(getDoc(doc(anon(), "usernames", "ziad")));
  await assertFails(updateDoc(doc(as("u1", U1), "usernames", "ziad"), { uid: "u2" }));
  const db = as("u1", U1), b = writeBatch(db);
  b.delete(doc(db, "usernames", "ziad"));
  b.delete(doc(db, "profiles", "u1"));
  await assertSucceeds(b.commit());
});

test("usernames: a freed name can be claimed by someone else", async () => {
  await seedClaim("u1", "ziad");
  const db = as("u1", U1), b = writeBatch(db);
  b.delete(doc(db, "usernames", "ziad"));
  b.set(doc(db, "usernames", "zed"), nameDoc("u1"));
  b.set(doc(db, "profiles", "u1"), profile({ username: "zed" }));
  await assertSucceeds(b.commit());
  await assertSucceeds(claim(as("u2", U2), "u2", "ziad"));
});

test("emails: own verified e-mail with findByEmail in the same batch is allowed", async () => {
  await seedClaim("u1", "ziad");
  const db = as("u1", U1), b = writeBatch(db);
  b.set(doc(db, "profiles", "u1"), profile({ findByEmail: true }));
  b.set(doc(db, "emails", "u1@x.com"), { uid: "u1" });
  await assertSucceeds(b.commit());
});

test("emails: denied without findByEmail, for someone else's e-mail, unverified accounts, another uid", async () => {
  await seedClaim("u1", "ziad");
  await assertFails(setDoc(doc(as("u1", U1), "emails", "u1@x.com"), { uid: "u1" }));
  await seedClaim("u3", "third", { findByEmail: true });
  await assertFails(setDoc(doc(as("u3", { email: "u3@x.com", email_verified: true }), "emails", "u1@x.com"), { uid: "u3" }));
  await assertFails(setDoc(doc(as("u3", { email: "u3@x.com", email_verified: false }), "emails", "u3@x.com"), { uid: "u3" }));
  await assertFails(setDoc(doc(as("u3", { email: "u3@x.com", email_verified: true }), "emails", "u3@x.com"), { uid: "u1" }));
  await assertSucceeds(setDoc(doc(as("u3", { email: "u3@x.com", email_verified: true }), "emails", "u3@x.com"), { uid: "u3" }));
});

test("emails: get for signed-in users, owner-only delete", async () => {
  await seedClaim("u1", "ziad", { findByEmail: true });
  await seed(db => setDoc(doc(db, "emails", "u1@x.com"), { uid: "u1" }));
  await assertSucceeds(getDoc(doc(as("u2", U2), "emails", "u1@x.com")));
  await assertFails(getDoc(doc(anon(), "emails", "u1@x.com")));
  await assertFails(deleteDoc(doc(as("u2", U2), "emails", "u1@x.com")));
  await assertSucceeds(deleteDoc(doc(as("u1", U1), "emails", "u1@x.com")));
});

test("profiles: owner can write a private profile without a summary and read it", async () => {
  await seed(db => setDoc(doc(db, "usernames", "ziad"), nameDoc("u1")));
  await assertSucceeds(setDoc(doc(as("u1", U1), "profiles", "u1"), profile()));
  await assertSucceeds(getDoc(doc(as("u1", U1), "profiles", "u1")));
});

test("profiles: others cannot read private or friends profiles; they can read public ones; signed-out cannot", async () => {
  await seedClaim("u1", "ziad", { visibility: "private" });
  await assertFails(getDoc(doc(as("u2", U2), "profiles", "u1")));
  await seed(db => setDoc(doc(db, "profiles", "u1"), profile({ visibility: "friends", summary: SUMMARY })));
  await assertFails(getDoc(doc(as("u2", U2), "profiles", "u1")));
  await assertSucceeds(getDoc(doc(as("u1", U1), "profiles", "u1")));
  await seed(db => setDoc(doc(db, "profiles", "u1"), profile({ visibility: "public", summary: SUMMARY })));
  await assertSucceeds(getDoc(doc(as("u2", U2), "profiles", "u1")));
  await assertFails(getDoc(doc(anon(), "profiles", "u1")));
});

test("profiles: summary rejected while private; bad visibility and extra keys rejected", async () => {
  await seed(db => setDoc(doc(db, "usernames", "ziad"), nameDoc("u1")));
  const ref = doc(as("u1", U1), "profiles", "u1");
  await assertFails(setDoc(ref, profile({ visibility: "private", summary: SUMMARY })));
  await assertFails(setDoc(ref, profile({ visibility: "everyone" })));
  await assertFails(setDoc(ref, profile({ sneaky: 1 })));
  await assertSucceeds(setDoc(ref, profile({ visibility: "public", summary: SUMMARY })));
  await assertSucceeds(setDoc(ref, profile({ visibility: "friends", summary: SUMMARY })));
});

test("profiles: every Summary field is validated (type, range, missing, extra)", async () => {
  await seed(db => setDoc(doc(db, "usernames", "ziad"), nameDoc("u1")));
  const ref = doc(as("u1", U1), "profiles", "u1");
  const bad = (patch, del) => { const s = { ...SUMMARY, ...patch }; if (del) delete s[del]; return profile({ visibility: "public", summary: s }); };
  const range = { level: [0, 501], xp: [-1, 10000001], badges: [-1, 101], streakWeeks: [-1, 601], foodDays: [-1, 4001], workoutsWeek: [-1, 51], workouts30: [-1, 401], workoutsTotal: [-1, 50001], volumeWeekKg: [-1, 1000001], prs30: [-1, 401] };
  for (const [k, [lo, hi]] of Object.entries(range)) {
    await assertFails(setDoc(ref, bad({ [k]: lo })));
    await assertFails(setDoc(ref, bad({ [k]: hi })));
  }
  for (const k of Object.keys(SUMMARY)) {
    await assertFails(setDoc(ref, bad({}, k)));
    await assertFails(setDoc(ref, bad({ [k]: k === "title" || k === "lastWorkout" ? 5 : "x" })));
  }
  await assertFails(setDoc(ref, bad({ extra: 1 })));
  await assertFails(setDoc(ref, bad({ title: "x".repeat(21) })));
  await assertFails(setDoc(ref, bad({ lastWorkout: "yesterday" })));
  await assertSucceeds(setDoc(ref, bad({ lastWorkout: null })));
  await assertSucceeds(setDoc(ref, bad({})));
});

test("profiles: the username must be claimed by me", async () => {
  await assertFails(setDoc(doc(as("u1", U1), "profiles", "u1"), profile()));
  await seed(db => setDoc(doc(db, "usernames", "ziad"), nameDoc("u2")));
  await assertFails(setDoc(doc(as("u1", U1), "profiles", "u1"), profile()));
});

test("profiles: others cannot write or delete; owner can delete; oversized documents are denied", async () => {
  await seedClaim("u1", "ziad", { visibility: "public", summary: SUMMARY });
  await assertFails(setDoc(doc(as("u2", U2), "profiles", "u1"), profile()));
  await assertFails(deleteDoc(doc(as("u2", U2), "profiles", "u1")));
  await assertFails(setDoc(doc(as("u1", U1), "profiles", "u1"), profile({ displayName: "x".repeat(6000) })));
  const db = as("u1", U1), b = writeBatch(db);
  b.delete(doc(db, "profiles", "u1"));
  b.delete(doc(db, "usernames", "ziad"));
  await assertSucceeds(b.commit());
});

test("profiles: display name must be 1-40 characters", async () => {
  await seed(db => setDoc(doc(db, "usernames", "ziad"), nameDoc("u1")));
  const ref = doc(as("u1", U1), "profiles", "u1");
  await assertFails(setDoc(ref, profile({ displayName: "" })));
  await assertFails(setDoc(ref, profile({ displayName: "x".repeat(41) })));
  await assertSucceeds(setDoc(ref, profile({ displayName: "x".repeat(40) })));
});

test("usernames: one username per person - a second name needs the first one deleted in the same batch", async () => {
  await seedClaim("u1", "first");
  const db = as("u1", U1);
  const sq = writeBatch(db);
  sq.set(doc(db, "usernames", "second"), nameDoc("u1"));
  sq.set(doc(db, "profiles", "u1"), profile({ username: "second" }));
  await assertFails(sq.commit());
  const ok = writeBatch(db);
  ok.delete(doc(db, "usernames", "first"));
  ok.set(doc(db, "usernames", "second"), nameDoc("u1"));
  ok.set(doc(db, "profiles", "u1"), profile({ username: "second" }));
  await assertSucceeds(ok.commit());
});

test("usernames: no display name is stored there (it would leak a private person's name)", async () => {
  const db = as("u1", U1), b = writeBatch(db);
  b.set(doc(db, "usernames", "ziad"), { uid: "u1", displayName: "Ziad", updated: 1 });
  b.set(doc(db, "profiles", "u1"), profile());
  await assertFails(b.commit());
});

test("orphans: deleting only the profile or only the username doc is denied (no name squatting)", async () => {
  await seedClaim("u1", "ziad");
  const db = as("u1", U1);
  await assertFails(deleteDoc(doc(db, "profiles", "u1")));
  await assertFails(deleteDoc(doc(db, "usernames", "ziad")));
  const b = writeBatch(db);
  b.delete(doc(db, "profiles", "u1"));
  b.delete(doc(db, "usernames", "ziad"));
  await assertSucceeds(b.commit());
});

test("profile update keeping the same name still works after the orphan guards", async () => {
  await seedClaim("u1", "ziad", { visibility: "public" });
  await assertSucceeds(updateDoc(doc(as("u1", U1), "profiles", "u1"), { summary: SUMMARY, updated: 9 }));
});

// ---- friends: friendships/{pairId}, blocks/{blocker}_{blocked}, friends-only profile reads ----
const U3 = { email: "u3@x.com", email_verified: true };
const NAMES = { u1: "ziad", u2: "zed", u3: "omar" };
const pid = (a, b) => (a < b ? a + "_" + b : b + "_" + a);
const fdoc = (requester, other, status = "pending", o = {}) => ({ users: [requester, other].sort(), requester, status, names: { [requester]: NAMES[requester], [other]: NAMES[other] }, updated: 1, ...o });
const seedPeople = async (vis = {}) => { for (const [u, n] of Object.entries(NAMES)) await seedClaim(u, n, vis[u] ? { visibility: vis[u], ...(vis[u] === "private" ? {} : { summary: SUMMARY }) } : {}); };
const seedPair = (a, b, status = "pending") => seed(db => setDoc(doc(db, "friendships", pid(a, b)), fdoc(a, b, status)));
const seedBlock = (blocker, blocked) => seed(db => setDoc(doc(db, "blocks", blocker + "_" + blocked), { blocker, blocked, updated: 1 }));
const claims = { u1: U1, u2: U2, u3: U3 };
const ref = (uid, col, id) => doc(as(uid, claims[uid]), col, id);

test("friendships: a stranger cannot get or list a pair; a member can get and list with array-contains", async () => {
  await seedPeople(); await seedPair("u1", "u2");
  await assertFails(getDoc(ref("u3", "friendships", "u1_u2")));
  await assertSucceeds(getDoc(ref("u1", "friendships", "u1_u2")));
  await assertSucceeds(getDocs(query(collection(as("u1", U1), "friendships"), where("users", "array-contains", "u1"))));
  await assertFails(getDocs(collection(as("u1", U1), "friendships")));
  await assertFails(getDocs(query(collection(as("u3", U3), "friendships"), where("users", "array-contains", "u1"))));
});

test("friendships: a valid request is allowed", async () => {
  await seedPeople();
  await assertSucceeds(setDoc(ref("u1", "friendships", "u1_u2"), fdoc("u1", "u2")));
});

test("friendships: forged or malformed requests are denied", async () => {
  await seedPeople();
  const bad = [
    ["requester is the other person", fdoc("u2", "u1")],
    ["status accepted", fdoc("u1", "u2", "accepted")],
    ["users not sorted", { ...fdoc("u1", "u2"), users: ["u2", "u1"] }],
    ["my name is not my username", fdoc("u1", "u2", "pending", { names: { u1: "fake", u2: "zed" } })],
    ["their name does not point at them", fdoc("u1", "u2", "pending", { names: { u1: "ziad", u2: "omar" } })],
    ["extra key", { ...fdoc("u1", "u2"), extra: 1 }],
    ["not a number", { ...fdoc("u1", "u2"), updated: "x" }]
  ];
  for (const [why, d] of bad) await assertFails(setDoc(ref("u1", "friendships", "u1_u2"), d), why);
  await assertFails(setDoc(ref("u1", "friendships", "u2_u3"), fdoc("u2", "u3")), "not part of the pair");
  await assertFails(setDoc(ref("u1", "friendships", "u1_u3"), fdoc("u1", "u2")), "id does not match users");
});

test("friendships: a person without a profile cannot request", async () => {
  await seedClaim("u2", "zed");
  await assertFails(setDoc(ref("u1", "friendships", "u1_u2"), fdoc("u1", "u2")));
});

test("friendships: blocked senders cannot request", async () => {
  await seedPeople(); await seedBlock("u2", "u1");
  await assertFails(setDoc(ref("u1", "friendships", "u1_u2"), fdoc("u1", "u2")));
});

test("friendships: the other side cannot overwrite a pending request as requester", async () => {
  await seedPeople(); await seedPair("u1", "u2");
  await assertFails(setDoc(ref("u2", "friendships", "u1_u2"), fdoc("u2", "u1")));
});

test("friendships: only the non-requester can accept, and only status and updated change", async () => {
  await seedPeople(); await seedPair("u1", "u2");
  await assertFails(updateDoc(ref("u1", "friendships", "u1_u2"), { status: "accepted", updated: 2 }));
  await assertFails(updateDoc(ref("u3", "friendships", "u1_u2"), { status: "accepted", updated: 2 }));
  await assertFails(updateDoc(ref("u2", "friendships", "u1_u2"), { status: "accepted", requester: "u2", updated: 2 }));
  await assertFails(updateDoc(ref("u2", "friendships", "u1_u2"), { status: "accepted", "names.u1": "x", updated: 2 }));
  await assertSucceeds(updateDoc(ref("u2", "friendships", "u1_u2"), { status: "accepted", updated: 2 }));
});

test("friendships: accepted cannot go back to pending", async () => {
  await seedPeople(); await seedPair("u1", "u2", "accepted");
  await assertFails(updateDoc(ref("u1", "friendships", "u1_u2"), { status: "pending", updated: 2 }));
  await assertFails(updateDoc(ref("u2", "friendships", "u1_u2"), { status: "pending", updated: 2 }));
  await assertFails(setDoc(ref("u1", "friendships", "u1_u2"), fdoc("u1", "u2")));
});

test("friendships: a member may refresh only their own name", async () => {
  await seedPeople();
  await seed(db => setDoc(doc(db, "friendships", "u1_u2"), fdoc("u1", "u2", "accepted", { names: { u1: "old", u2: "zed" } })));
  await assertSucceeds(updateDoc(ref("u1", "friendships", "u1_u2"), { "names.u1": "ziad", updated: 3 }));
  await assertFails(updateDoc(ref("u1", "friendships", "u1_u2"), { "names.u2": "hacked", updated: 3 }));
  await assertFails(updateDoc(ref("u1", "friendships", "u1_u2"), { "names.u1": "notmine", updated: 3 }));
});

test("friendships: either member can delete, a stranger cannot, a missing doc can be deleted", async () => {
  await seedPeople(); await seedPair("u1", "u2");
  await assertFails(deleteDoc(ref("u3", "friendships", "u1_u2")));
  await assertSucceeds(deleteDoc(ref("u2", "friendships", "u1_u2")));
  await assertSucceeds(deleteDoc(ref("u1", "friendships", "u1_u2")));
});

test("blocks: create only as the blocker with a matching id; only the blocker reads or deletes", async () => {
  await seedPeople();
  await assertFails(setDoc(ref("u2", "blocks", "u1_u2"), { blocker: "u1", blocked: "u2", updated: 1 }));
  await assertFails(setDoc(ref("u1", "blocks", "u1_u3"), { blocker: "u1", blocked: "u2", updated: 1 }));
  await assertFails(setDoc(ref("u1", "blocks", "u1_u2"), { blocker: "u1", blocked: "u2", updated: 1, extra: 1 }));
  await assertFails(setDoc(ref("u1", "blocks", "u1_u2"), { blocker: "u1", blocked: "u2", name: "x".repeat(21), updated: 1 }));
  await assertFails(setDoc(ref("u1", "blocks", "u1_u2"), { blocker: "u1", blocked: "u2", name: 5, updated: 1 }));
  await assertSucceeds(setDoc(ref("u1", "blocks", "u1_u2"), { blocker: "u1", blocked: "u2", name: "zed", updated: 1 }));
  await assertSucceeds(getDoc(ref("u1", "blocks", "u1_u2")));
  await assertFails(getDoc(ref("u2", "blocks", "u1_u2")));
  await assertSucceeds(getDocs(query(collection(as("u1", U1), "blocks"), where("blocker", "==", "u1"))));
  await assertFails(getDocs(query(collection(as("u2", U2), "blocks"), where("blocker", "==", "u1"))));
  await assertFails(getDocs(collection(as("u1", U1), "blocks")));
  await assertFails(deleteDoc(ref("u2", "blocks", "u1_u2")));
  await assertSucceeds(deleteDoc(ref("u1", "blocks", "u1_u2")));
});

test("block batch removes the friendship and the blocked person cannot re-request", async () => {
  await seedPeople(); await seedPair("u1", "u2", "accepted");
  const db = as("u1", U1), b = writeBatch(db);
  b.set(doc(db, "blocks", "u1_u2"), { blocker: "u1", blocked: "u2", updated: 2 });
  b.delete(doc(db, "friendships", "u1_u2"));
  await assertSucceeds(b.commit());
  await assertFails(setDoc(ref("u2", "friendships", "u1_u2"), fdoc("u2", "u1")));
});

test("profiles: a friends-only profile is readable by accepted friends only, and not after removal", async () => {
  await seedPeople({ u2: "friends" });
  await assertFails(getDoc(ref("u1", "profiles", "u2")));
  await seedPair("u1", "u2", "pending");
  await assertFails(getDoc(ref("u1", "profiles", "u2")));
  await seedPair("u1", "u2", "accepted");
  await assertSucceeds(getDoc(ref("u1", "profiles", "u2")));
  await assertFails(getDoc(ref("u3", "profiles", "u2")));
  await assertSucceeds(getDoc(ref("u2", "profiles", "u2")));
  await assertSucceeds(deleteDoc(ref("u1", "friendships", "u1_u2")));
  await assertFails(getDoc(ref("u1", "profiles", "u2")));
});

test("profiles: private stays owner-only even for friends; public stays open to any signed-in user", async () => {
  await seedPeople({ u2: "private", u3: "public" }); await seedPair("u1", "u2", "accepted");
  await assertFails(getDoc(ref("u1", "profiles", "u2")));
  await assertSucceeds(getDoc(ref("u1", "profiles", "u3")));
});

// ---- reports/{reporter}_{reported}: write-only, the owner reads them in the Firebase console ----
const report = (o = {}) => ({ reporter: "u1", reported: "u2", reason: "spam", username: "zed", updated: 1, ...o });
const seedReport = () => seed(db => setDoc(doc(db, "reports", "u1_u2"), report()));

test("reports: the reporter can write their own pair and overwrite it", async () => {
  await assertSucceeds(setDoc(ref("u1", "reports", "u1_u2"), report()));
  await assertSucceeds(setDoc(ref("u1", "reports", "u1_u2"), report({ reason: "harassment", updated: 2 })));
  for (const reason of ["name", "harassment", "spam", "other"]) await assertSucceeds(setDoc(ref("u1", "reports", "u1_u2"), report({ reason })));
});

test("reports: nobody can write a report for someone else's id", async () => {
  await assertFails(setDoc(ref("u2", "reports", "u1_u2"), report()), "the reported person writing the pair");
  await assertFails(setDoc(ref("u3", "reports", "u1_u2"), report()), "a stranger writing the pair");
  await assertFails(setDoc(ref("u1", "reports", "u2_u1"), report()), "id that starts with another uid");
  await assertFails(setDoc(ref("u1", "reports", "u2_u1"), report({ reporter: "u2", reported: "u1" })), "claiming to be the other reporter");
  await assertFails(setDoc(ref("u1", "reports", "x"), report()), "id not made of the two uids");
  await assertFails(setDoc(doc(anon(), "reports", "u1_u2"), report()), "signed out");
});

test("reports: self-reports and malformed documents are denied", async () => {
  await assertFails(setDoc(ref("u1", "reports", "u1_u1"), report({ reported: "u1" })), "self");
  const bad = [
    ["reason", report({ reason: "bad" })], ["reason number", report({ reason: 5 })],
    ["reporter", report({ reporter: "u2" })], ["reported does not match the id", report({ reported: "u3" })],
    ["empty username", report({ username: "" })], ["long username", report({ username: "x".repeat(21) })], ["username number", report({ username: 5 })],
    ["updated string", report({ updated: "x" })], ["extra key", { ...report(), extra: 1 }], ["missing key", { reporter: "u1", reported: "u2", reason: "spam", updated: 1 }]
  ];
  for (const [why, d] of bad) await assertFails(setDoc(ref("u1", "reports", "u1_u2"), d), why);
  await assertSucceeds(setDoc(ref("u1", "reports", "u1_u2"), report({ username: "x".repeat(20) })));
});

test("reports: nobody can read, list or delete them (only the console can)", async () => {
  await seedReport();
  for (const u of ["u1", "u2", "u3"]) {
    await assertFails(getDoc(ref(u, "reports", "u1_u2")), u + " get");
    await assertFails(getDocs(collection(as(u, claims[u]), "reports")), u + " list");
    await assertFails(deleteDoc(ref(u, "reports", "u1_u2")), u + " delete");
  }
  await assertFails(getDoc(doc(anon(), "reports", "u1_u2")), "signed out get");
});
