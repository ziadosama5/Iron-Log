import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scanSource } from "../tools/scan-strings.mjs";
import { AR } from "../public/lang-ar.js";

// Sections still being translated (empty now that the whole app is done; new sections must ship translated).
const PENDING = [];

const read = f => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const MARK = '<script type="module">';

function sectionsOfIndex() {
  const src = read("index.html"), mi = src.indexOf(MARK), from = mi + MARK.length, to = src.lastIndexOf("</script>");
  const out = [{ name: "static", text: src.slice(0, mi), kind: "html", firstLine: 1 }];
  const js = src.slice(from, to), re = /\/\* -{8,} ([^\n]*?) -{8,} \*\//g;
  const cuts = [{ name: "start", at: 0 }];
  for (let m; (m = re.exec(js)); ) cuts.push({ name: m[1].split(/[:(]/)[0].trim(), at: m.index });
  const baseLine = src.slice(0, from).split("\n").length;
  cuts.forEach((c, i) => {
    const text = js.slice(c.at, i + 1 < cuts.length ? cuts[i + 1].at : js.length);
    out.push({ name: c.name, text, kind: "js", firstLine: baseLine + js.slice(0, c.at).split("\n").length - 1 });
  });
  return out;
}

const sections = [
  ...sectionsOfIndex(),
  ...["achievements.js", "energy.js", "workout-tools.js"].map(f => ({ name: f, text: read(f), kind: "js", firstLine: 1 }))
];

const placeholders = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",");

test("PENDING only lists real sections", () => {
  const names = new Set(sections.map(s => s.name));
  for (const p of PENDING) assert.ok(names.has(p), `unknown section in PENDING: ${p}`);
});

test("every finished section has no untranslated or glued English text and an Arabic entry for each label", () => {
  const problems = [];
  for (const sec of sections) {
    if (PENDING.includes(sec.name)) continue;
    const r = scanSource(sec.text, { kind: sec.kind });
    for (const v of r.violations) problems.push(`${sec.name} (line ~${sec.firstLine + v.line - 1}): ${v.why}: ${v.text}`);
    for (const l of r.labels) if (AR.ui[l] == null) problems.push(`${sec.name}: no Arabic for "${l}"`);
  }
  assert.deepEqual(problems, []);
});

test("Arabic entries keep the same {placeholders} as their English key and are not empty", () => {
  for (const [k, v] of Object.entries(AR.ui)) {
    assert.ok(String(v).trim().length > 0, `empty Arabic for "${k}"`);
    assert.equal(placeholders(v), placeholders(k), `placeholders differ for "${k}"`);
  }
});

test("every section is translated (PENDING is empty)", () => {
  assert.deepEqual(PENDING, []);
});

// ---- names of library things (Task 7) ----
import { ALL_EX, MUSCLES, TEMPLATES } from "../public/exercise-library.js";
import { BADGES } from "../public/achievements.js";
import { CARDIO_TYPES, INTENSITIES } from "../public/energy.js";

const needNames = (kind, list) => {
  const table = AR.names[kind] || {};
  const missing = list.filter(n => !table[n] || !String(table[n]).trim());
  assert.deepEqual(missing, [], `AR.names.${kind} is missing entries`);
};

test("every exercise, muscle, template, day and badge has an Arabic name", () => {
  needNames("ex", ALL_EX);
  needNames("muscle", MUSCLES);
  needNames("template", TEMPLATES.map(t => t.name));
  needNames("tplnote", TEMPLATES.map(t => t.note));
  needNames("day", [...new Set(TEMPLATES.flatMap(t => t.days.map(d => d.name))), "Free workout", "Cardio"]);
  needNames("badge", BADGES.map(b => b.name));
});

test("cardio, intensity, goal, weekday, meal and level names exist", () => {
  const labels = { treadmill: "Treadmill", elliptical: "Elliptical", bike: "Bike", other: "Other" };
  needNames("cardio", [...CARDIO_TYPES.map(c => labels[c]), "Cardio"]);
  needNames("intensity", INTENSITIES.map(i => i[0].toUpperCase() + i.slice(1)));
  needNames("goal", ["Lose fat", "Build muscle", "Lose fat and build muscle", "Get stronger", "Stay in shape"]);
  needNames("weekday", ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  needNames("meal", ["Breakfast", "Lunch", "Dinner", "Snack"]);
  needNames("level", ["Rookie", "Regular", "Committed", "Iron"]);
});

test("Arabic exercise names are unique", () => {
  const v = ALL_EX.map(n => AR.names.ex[n]);
  assert.equal(new Set(v).size, v.length);
});

test("labels kept in index.html constants (body fields, screen titles) have Arabic", () => {
  const src = read("index.html");
  const block = (start, end) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)));
  const labels = [...block("const BF = {", "};").matchAll(/label:"([^"]+)"/g)].map(m => m[1]);
  labels.push(...[...block("const SCREEN_TITLES={", "}").matchAll(/:"([^"]+)"/g)].map(m => m[1]));
  assert.ok(labels.length >= 20, "found the constants");
  assert.deepEqual([...new Set(labels)].filter(l => AR.ui[l] == null), []);
});

import { PRESETS } from "../public/theme-tools.js";
test("accent preset names and the picker labels have Arabic", () => {
  const missing = [...PRESETS.map(p => p.name), "Accent", "Custom"].filter(k => AR.ui[k] == null);
  assert.deepEqual(missing, []);
});

import { EQUIPMENT } from "../public/exercise-library.js";
test("every equipment item has a unique Arabic name", () => {
  const names = EQUIPMENT.map(e => (AR.names.equipment || {})[e.id]);
  assert.deepEqual(EQUIPMENT.filter((e, i) => !names[i] || !String(names[i]).trim()).map(e => e.id), []);
  assert.equal(new Set(names).size, names.length);
});

test("profile screen: messages built from dynamic keys and constants have Arabic", () => {
  const src = read("index.html");
  const msgLine = src.split("\n").find(l => l.startsWith("const USERNAME_MSG="));
  assert.ok(msgLine, "found USERNAME_MSG");
  const msgs = [...msgLine.matchAll(/:"([^"]+)"/g)].map(m => m[1]);
  assert.equal(msgs.length, 6);
  const keys = [...msgs, "That username is taken", "You're offline. Try again when you're back online.", "Your Google account has no verified e-mail.",
    "Couldn't save. Check your connection.", "Profile deleted", "Saved", "Private", "Friends", "Public", "Profile", "Username", "Choose a username"];
  assert.deepEqual(keys.filter(k => AR.ui[k] == null), []);
});

test("friends screen: labels and messages built from variables have Arabic", () => {
  const src = read("index.html");
  const line = src.split(/\r?\n/).find(l => l.startsWith("const CMP_LABEL="));
  assert.ok(line, "found CMP_LABEL");
  const labels = [...line.matchAll(/:"([^"]+)"/g)].map(m => m[1]);
  assert.equal(labels.length, 7);
  const keys = [...labels, "Request sent", "You are now friends", "Removed", "Blocked", "Unblocked", "Accept", "Decline", "Send request", "Cancel", "Unblock", "Open", "Remove", "Block", "Keep", "Ahead", "You"];
  assert.deepEqual(keys.filter(k => AR.ui[k] == null), []);
});

test("my gym: labels shown through a condition have Arabic", () => {
  const keys = ["Show all", "Hide them again", "Bodyweight only", "Home", "Basic gym", "Full gym", "Weights", "Stations", "Machines", "Saving…", "Saved ✓", "Done", "Clear", "Keep"];
  assert.deepEqual(keys.filter(k => AR.ui[k] == null), []);
});

test("journey: labels, notes and split names shown through variables have Arabic", () => {
  const keys = ["Beginner", "Intermediate", "Advanced", "New to lifting, or coming back after a long break", "Training regularly for about a year or more",
    "Several years of consistent training", "Skip", "Start", "Next", "Male", "Female", "No {muscle} exercise fits your gym.", "{day} was left out: nothing in it fits your gym.",
    "Full Body", "Push / Pull / Legs", "Upper / Lower", "Push / Pull / Legs + Upper / Lower", "Which split do you want?", "Not sure, suggest one", "Based on how many days you can train", "Every muscle each session · 2–3 days", "Upper body and lower body days · 2, 4 or 6 days", "Push, pull and leg days · 3 or 6 days", "One muscle group a day · 5 days", "Push / Pull / Legs ×2", "Push / Pull / Legs + Full Body", "Upper / Lower ×3", "Bro Split", "Bodyweight only", "Home", "Basic gym", "Full gym"];
  assert.deepEqual(keys.filter(k => AR.ui[k] == null), []);
});

test("report panel: reason labels and buttons shown through variables have Arabic", () => {
  const keys = ["Inappropriate name or username", "Harassment", "Spam", "Something else", "Report", "Block this person", "Done", "Cancel"];
  assert.deepEqual(keys.filter(k => AR.ui[k] == null), []);
});

test("delete my account: progress labels and failure messages shown through variables have Arabic", () => {
  const keys = ["Signing in again…", "Removing your shared profile…", "Removing friendships…", "Removing blocks…", "Removing your data…", "Clearing this device…", "Deleting your account…",
    "Sign-in was cancelled.", "Your browser blocked the sign-in window. Allow pop-ups for this site, or open Iron Log in your browser, and try again.", "Choose the same Google account you signed in with.", "Your data is removed, but the sign-in account could not be deleted. Reload the app and open Delete my account again.",
    "Couldn't delete everything. Some of your data may already be removed. Try again.", "You're offline. Try again when you're back online."];
  assert.deepEqual(keys.filter(k => AR.ui[k] == null), []);
});

test("challenges: messages and labels shown through variables have Arabic", () => {
  const keys = ["Challenge created", "You joined the challenge", "Declined", "You left the challenge", "Challenge deleted", "Delete challenge", "Leave challenge", "Leave", "Delete", "Keep",
    "Accept", "Decline", "Today", "Cancel", "Back", "{n} week", "{n} weeks", "Create challenge"];
  assert.deepEqual(keys.filter(k => AR.ui[k] == null), []);
});
