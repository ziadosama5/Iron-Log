// Celebration cards: what to show (in order) when badges, a level or a challenge win are new.
// Pure (no DOM/Firebase); the page formats the text with t() and draws the card. Unit-tested in tests/celebrate.test.js.
import { FAMILIES, familyOf, familyState } from "./badge-art.js";

export function buildCards({ freshBadges = [], list = [], levelBefore = null, levelNow = 0, wins = [] } = {}) {
  const cards = [];
  const rank = id => { const f = familyOf(id); return f ? FAMILIES.indexOf(f) * 100 + f.ids.indexOf(id) : -1; };
  const known = freshBadges.filter(b => rank(b.id) >= 0).sort((a, b) => rank(a.id) - rank(b.id));
  for (const b of known) {
    const fam = familyOf(b.id), s = familyState(fam, list), step = s.steps.find(x => x.id === b.id);
    cards.push({ kind: "badge", key: "badge:" + b.id, familyId: fam.id, level: fam.ids.indexOf(b.id) + 1, of: fam.ids.length, tier: s.tier, badgeName: step ? step.name : b.id });
  }
  if (levelBefore !== null && levelNow > levelBefore) cards.push({ kind: "level", key: "level:" + levelNow, levelNow });
  for (const w of wins) cards.push({ kind: "win", key: "win:" + w.cid, challengeName: w.name });
  return cards;
}

export function newWins(rows = [], seen = []) {
  const done = new Set(seen || []);
  return rows.filter(r => r.finished && r.won && !done.has(r.cid)).map(r => ({ cid: r.cid, name: r.name }));
}
