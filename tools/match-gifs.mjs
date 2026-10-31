// Dev tool: proposes, for each of our exercises, the matching exercise of hasaneyldrm/exercises-dataset (names are MIT; the
// GIFs are (c) Gym visual, see NOTICE.md of that repo). Writes tools/exercise-gifs.json ({our name: "<id>-<media_id>" | null}),
// the module public/exercise-gifs.js and a review list docs/gif-matches.md for the owner.
//
//   node tools/match-gifs.mjs --data <path to data/exercises.json of the dataset> [--keep]
//
// Data fields used: id ("0001"), media_id ("2gPfomN"), name ("3/4 sit-up"), equipment ("body weight"); the file id of the GIF
// is "<id>-<media_id>" (videos/0001-2gPfomN.gif, images/0001-2gPfomN.jpg). With --keep an existing tools/exercise-gifs.json is
// only regenerated into the module and the review list (use it after the owner corrected the JSON by hand).
import fs from "node:fs";
import { ALL_EX, equipmentOf, isCurated } from "../public/exercise-library.js";
const CURATED_EX = ALL_EX.filter(isCurated);   // the dataset exercises (exercise-catalog.js) carry their own picture id

const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const keep = process.argv.includes("--keep");
const JSON_PATH = new URL("./exercise-gifs.json", import.meta.url), MODULE_PATH = new URL("../public/exercise-gifs.js", import.meta.url), REVIEW_PATH = new URL("../docs/gif-matches.md", import.meta.url);

// Known to have no good picture in the dataset: they start as null (the line drawings stay).
const NONE = ["Pec Deck", "Reverse Pec Deck", "Skull Crusher", "Dumbbell Skull Crusher", "Hip Thrust", "Dumbbell Hip Thrust", "Glute Kickback Machine", "Plank", "Ab Wheel Rollout"];
const FOLD = [[/\bez[- ]?bar(bell)?\b/g, "ez bar"], [/\bsz[- ]bar\b/g, "ez bar"], [/\b(leverage|lever|selectorized)\b/g, "machine"], [/\btricep\b/g, "triceps"], [/\bbicep\b/g, "biceps"], [/\bskullcrusher\b/g, "skull crusher"], [/\bbody ?weight\b/g, "bodyweight"]];
const norm = s => { let t = String(s).toLowerCase().replace(/[-/]/g, " "); for (const [re, to] of FOLD) t = t.replace(re, to); return t.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).map(w => (w.length > 3 ? w.replace(/s$/, "") : w)); };
const EQ_WORDS = ["barbell", "dumbbell", "cable", "machine", "smith", "ez", "kettlebell", "band", "sled", "bodyweight"];
const DEFAULT_OK = ["barbell", "bodyweight"];            // what an unqualified name ("Squat", "Deadlift") means
const AVOID = ["band", "assisted", "weighted", "kneeling", "reverse", "alternate", "single", "one", "twisting"];
const eqOf = toks => new Set(toks.filter(w => EQ_WORDS.includes(w)));

// What our library says an exercise needs, as the dataset's equipment words: a dumbbell lift must not get a barbell picture.
const STRONG = { barbell: ["barbell", "ez barbell", "olympic barbell", "trap bar"], "ez-bar": ["ez barbell", "barbell"], "trap-bar": ["trap bar"], dumbbell: ["dumbbell"], cable: ["cable"], smith: ["smith machine"], kettlebell: ["kettlebell"] };
export const wantedEquipment = name => { const w = new Set(); for (const id of equipmentOf(name) || []) for (const e of STRONG[id] || []) w.add(e); return w; };
function score(ours, theirs, theirEquip, wanted) {
  const a = norm(ours), b = norm(theirs), A = new Set(a), B = new Set(b);
  const inter = [...A].filter(x => B.has(x)).length;
  let sc = 0.7 * (inter / A.size) + 0.3 * (inter / Math.max(A.size, B.size));
  const eqA = eqOf(a), eqB = eqOf([...b, ...norm(theirEquip)]);
  if (eqA.size) { if (![...eqA].every(x => eqB.has(x))) sc *= 0.5; }
  else if (eqB.size && ![...eqB].some(x => DEFAULT_OK.includes(x))) sc *= 0.7;
  const extra = b.filter(w => AVOID.includes(w) && !A.has(w)).length;
  if (wanted && wanted.size && !wanted.has(String(theirEquip).toLowerCase())) sc *= 0.4;   // our equipment and theirs disagree
  return sc * Math.pow(0.8, extra);
}

let map, rows = [];
const alts = {};   // our exercise -> its four closest dataset exercises (printed to docs/gif-alternatives.txt for a hand pick)
if (keep && fs.existsSync(JSON_PATH)) {
  map = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
} else {
  const data = JSON.parse(fs.readFileSync(arg("--data") || (console.error("--data <exercises.json> required"), process.exit(1)), "utf8"));
  map = {};
  for (const name of CURATED_EX) {
    if (NONE.includes(name)) { map[name] = null; rows.push({ name, best: "", s: 0, id: null }); continue; }
    let best = null, bs = 0;
    const top = [];
    const wanted = wantedEquipment(name);
    for (const e of data) { const s = score(name, e.name, e.equipment, wanted); if (s > bs) { bs = s; best = e; } top.push({ s, e }); }
    top.sort((a, b) => b.s - a.s); alts[name] = top.slice(0, 4).map(x => `${x.e.name} [${x.e.equipment}] ${x.e.id}-${x.e.media_id} ${x.s.toFixed(2)}`);
    const id = best && bs >= 0.75 ? `${best.id}-${best.media_id}` : null;
    map[name] = id; rows.push({ name, best: best ? best.name : "", s: bs, id });
  }
  // one picture per exercise: when two exercises got the same file, only the better match keeps it
  const best = {};
  for (const r of rows) if (r.id && (!best[r.id] || r.s > best[r.id].s)) best[r.id] = r;
  for (const r of rows) if (r.id && best[r.id] !== r) { map[r.name] = null; r.id = null; }
  // hand picks (tools/gif-overrides.json): the closest same-movement picture chosen by a person; they win over the automatic match
  // and may share a picture with another exercise (e.g. two leg-press variants)
  const hand = JSON.parse(fs.readFileSync(new URL("./gif-overrides.json", import.meta.url), "utf8"));
  for (const [name, id] of Object.entries(hand)) { map[name] = id; const r = rows.find(x => x.name === name); if (r) { r.id = id; r.best = "(hand-picked)"; r.s = 1; } }
  fs.writeFileSync(JSON_PATH, JSON.stringify(map, null, 1) + "\n");
  const byId = new Map(data.map(e => [e.id + "-" + e.media_id, e]));
  const meta = {}; for (const [name, id] of Object.entries(map)) if (id && byId.has(id)) meta[name] = { name: byId.get(id).name, equipment: byId.get(id).equipment };
  fs.writeFileSync(new URL("./exercise-gifs.meta.json", import.meta.url), JSON.stringify(meta, null, 1) + "\n");
}

const mod = `// Generated by tools/match-gifs.mjs from tools/exercise-gifs.json. Edit the JSON (or rerun the tool with --keep), not this file.
// The GIFs are from hasaneyldrm/exercises-dataset; the media is (c) Gym visual (https://gymvisual.com/), see that repo's NOTICE.md.
export const DEMO_BASE = "https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/";
import { CATALOG } from "./exercise-catalog.js";
const CURATED_GIFS = ${JSON.stringify(map, null, 1)};
// every exercise: the reviewed mapping for the curated ones, the dataset's own picture for each catalog row
export const GIFS = { ...CURATED_GIFS, ...Object.fromEntries(CATALOG.map(r => [r[0], r[3]])) };
// The helpers come from a factory so an empty base URL (the kill switch: set DEMO_BASE = "") turns every picture, still and
// download off at once, and a test can prove it.
export function makeGifs(base, map) {
  const on = typeof base === "string" && base.length > 0;
  const idOf = name => (on && typeof name === "string" && Object.prototype.hasOwnProperty.call(map, name) ? map[name] : null);
  const ids = () => (on ? [...new Set(Object.values(map).filter(Boolean))] : []);
  return {
    gifUrl: name => { const id = idOf(name); return id ? base + "videos/" + id + ".gif" : null; },
    stillUrl: name => { const id = idOf(name); return id ? base + "images/" + id + ".jpg" : null; },
    gifUrls: () => ids().map(id => base + "videos/" + id + ".gif"),
    stillUrls: () => ids().map(id => base + "images/" + id + ".jpg")
  };
}
const everything = makeGifs(DEMO_BASE, GIFS), curated = makeGifs(DEMO_BASE, CURATED_GIFS);
export const { gifUrl, stillUrl } = everything;
export const allGifUrls = everything.gifUrls, allStillUrls = everything.stillUrls;
// the "Download exercise pictures" set: the curated exercises only (about 17 MB); the rest load one by one and are cached as they are seen
export const { gifUrls, stillUrls } = curated;
`;
fs.writeFileSync(MODULE_PATH, mod);

if (rows.length) {
  if (process.argv.includes("--alts")) fs.writeFileSync(new URL("../docs/gif-alternatives.txt", import.meta.url), rows.filter(r => !r.id).map(r => r.name + "\n  " + (alts[r.name] || []).join("\n  ")).join("\n") + "\n");
  const order = rows.sort((x, y) => (x.id ? 1 : 0) - (y.id ? 1 : 0) || x.s - y.s);
  const flag = r => (!r.id ? "NONE" : r.s < 0.75 ? "check" : "ok");
  fs.writeFileSync(REVIEW_PATH, `# GIF matches (owner review)\n\nOur exercise -> the dataset exercise whose GIF it would show. Fix a wrong row by editing \`tools/exercise-gifs.json\` (the id is \`<id>-<media_id>\` from the dataset's \`data/exercises.json\`, or \`null\` for "keep the drawings"), then run \`node tools/match-gifs.mjs --keep\`.\n\n| Status | Our exercise | Dataset exercise | Score | File id |\n|---|---|---|---|---|\n` + order.map(r => `| ${flag(r)} | ${r.name} | ${r.best} | ${r.s.toFixed(2)} | ${r.id || ""} |`).join("\n") + "\n");
}
console.log("exercises:", Object.keys(map).length, "with gif:", Object.values(map).filter(Boolean).length);
