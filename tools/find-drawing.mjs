// Finds Everkinetic drawings for an exercise name (dev only).
//   node tools/find-drawing.mjs "leg curl"
// Prints: id  title  (files: yes|no). Only ids with files can be used as "ek" in exercise-sources.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const words = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);

// Entries whose title contains every query word, shortest title first.
export function matchTitles(index, query) {
  const q = words(query);
  if (!q.length) return [];
  return index
    .filter(e => { const t = new Set(words(e.title)); return q.every(w => t.has(w)); })
    .sort((a, b) => a.title.length - b.title.length || (a.id < b.id ? -1 : 1));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const BASE = "https://raw.githubusercontent.com/everkinetic/data/main/dist/";
  const cache = join(tmpdir(), "everkinetic-exercises.json");
  if (!existsSync(cache)) writeFileSync(cache, await (await fetch(BASE + "exercises.json")).text());
  const index = JSON.parse(readFileSync(cache, "utf8")).map(e => ({ id: e.id, title: e.title }));
  const hits = matchTitles(index, process.argv.slice(2).join(" ")).slice(0, 12);
  if (!hits.length) console.log("no match");
  for (const h of hits) {
    const ok = (await fetch(`${BASE}svg/${h.id}-relaxation.svg`, { method: "HEAD" })).ok;
    console.log(`${h.id}  ${h.title}  (files: ${ok ? "yes" : "no"})`);
  }
}
