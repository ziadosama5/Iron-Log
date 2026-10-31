// Bloom screen builders (Looks 2.0, docs/looks/today.md). Pure: ctx in, HTML out. Screens not listed here use the Classic layout.
// A builder arranges the same named parts the Classic screen is made of, so every data-act the Classic card has is present here too.

import { weekStrip, glance } from "./today-parts.js";

// The Today home with no workout open: the level card comes first, then the plan.
function today(c) {
  return [c.dateHtml, weekStrip(c), c.heroHtml, glance(c), c.deloadHtml, c.hintHtml, c.journeyHtml, c.cardioHtml, c.foodHtml].join("");
}

// One training day in the Plan list: a round tile, the name and meta, weekday bubbles, the muscles and exercises, Train this day.
function dayCard(c) {
  const { t, tn, esc: e, icon } = c;
  const meta = [tn("{n} exercise", "{n} exercises", c.exCount), ...c.focus].map(e).join(" · ");
  const wds = c.wds.length ? `<span class="lk-wds">${c.wds.map(w => `<span class="lk-wtag">${e(w)}</span>`).join("")}</span>` : "";
  return `<div class="card lk-day${c.next ? " is-next" : ""}">
    <button class="daysum" data-act="edit-day" data-id="${e(c.id)}" aria-expanded="false">
      <span class="lk-dhead">${`<span class="lk-dtile" aria-hidden="true">${icon("bar", 22)}</span>`}<span class="lk-dtitle"><span class="dayname">${e(c.name)}</span><span class="lk-dmeta">${meta}</span></span>${c.next ? `<span class="lk-dnext">${e(t("Up next"))}</span>` : ""}</span>
      ${wds}${c.listHtml}
    </button>
    <div class="row">${c.trainHtml}</div>
  </div>`;
}

// Progress overview: a soft weight hero first, two small tiles, then the charts.
function overview(c) {
  const { t, esc: e, stats: s } = c;
  return `<h2>${e(t("Overview"))}</h2>
  <div class="card lk-wthero"><div class="label">${e(t("Weight"))}</div><div class="bignum num">${e(s.weight)} <small>kg</small></div><div class="prev">${e(t("vs. 4 weeks ago"))}: <b class="num">${e(s.change)}</b> kg</div></div>
  <div class="stats"><div class="stat"><div class="label">${e(t("Workouts this week"))}</div><div class="v">${e(s.thisWeek)} <small>/ ${e(s.target)}</small></div></div><div class="stat"><div class="label">${e(t("Training streak (weeks)"))}</div><div class="v">${e(s.streak)}</div></div></div>
  ${c.weightHtml}${c.trainingHtml}${c.caloriesHtml}${c.strengthHtml}`;
}

// Goals: the badges first (the rewards), then streaks and the target.
function goals(c) {
  return `<h2>${c.esc(c.t("Goals"))}</h2>${c.badgesHtml}${c.streaksHtml}${c.targetHtml}`;
}

// Friends: requests, the leaderboard (lifted into a tinted hero panel), the friends list, Manage.
function friends(c) {
  return `<h2>${c.esc(c.t("Friends"))}</h2>${c.requestsHtml}<div class="lk-board lk-boardhero">${c.boardHtml}</div>${c.friendsHtml}${c.manageHtml}`;
}

// Body: a large weight hero first, then the trend, then adding an entry.
function body(c) {
  return `<h2>${c.esc(c.t("Body"))}</h2><div class="lk-bodyhero">${c.quickHtml}</div>${c.trendHtml}${c.entryHtml}${c.recentHtml}${c.profileHtml}`;
}

// The focus card: a wide demo banner on top, then the name with its tags, the advice, the sets, two stacked steppers and a pill Log button.
function workout(c) {
  return `<div class="card focus lk-focus lk-bloomcard" id="open-card">
    ${c.demoHtml ? `<div class="lk-banner">${c.demoHtml}</div>` : ""}
    <div class="lk-body">
      <div class="lk-who">${c.nameHtml}${c.tagsHtml}</div>
      ${c.avoidHtml}
      ${c.targetHtml}
      ${c.kindHtml}
      ${c.tableHtml}
      ${c.plannedHtml}
      ${c.bwHtml}
      ${c.weightHtml}
      ${c.repsHtml}
      ${c.actionHtml}
      ${c.lastHtml}
      ${c.removeHtml}
    </div>
  </div>
  ${c.footHtml}`;
}

export const screens = { today, workout, "plan.dayCard": dayCard, "progress.overview": overview, "progress.goals": goals, "friends.board": friends, "progress.body": body };
