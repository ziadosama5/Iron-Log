// Carbon screen builders (Looks 2.0, docs/looks/today.md). Pure: ctx in, HTML out. Screens not listed here use the Classic layout.
// A builder arranges the same named parts the Classic screen is made of, so every data-act the Classic card has is present here too.

import { weekStrip, glance } from "./today-parts.js";

// The Today home with no workout open: the day to train comes first, the level card after it.
function today(c) {
  return [c.dateHtml, weekStrip(c), glance(c), c.heroHtml, c.deloadHtml, c.hintHtml, c.journeyHtml, c.cardioHtml, c.foodHtml].join("");
}

// One training day in the Plan list: a dense row: the name, a quiet meta line and weekday tags, the muscles and exercises, Train this day.
function dayCard(c) {
  const { t, tn, esc: e, icon } = c;
  const meta = [tn("{n} exercise", "{n} exercises", c.exCount), ...c.focus].map(e).join(" · ");
  const wds = c.wds.length ? `<span class="lk-wds">${c.wds.map(w => `<span class="lk-wtag">${e(w)}</span>`).join("")}</span>` : "";
  return `<div class="card lk-day${c.next ? " is-next" : ""}">
    <button class="daysum" data-act="edit-day" data-id="${e(c.id)}" aria-expanded="false">
      <span class="lk-dhead">${""}<span class="lk-dtitle"><span class="dayname">${e(c.name)}</span><span class="lk-dmeta">${meta}</span></span>${c.next ? `<span class="lk-dnext">${e(t("Up next"))}</span>` : ""}</span>
      ${wds}${c.listHtml}
    </button>
    <div class="row">${c.trainHtml}</div>
  </div>`;
}

// Progress overview: the numbers first, training per week leads the charts.
function overview(c) {
  return `<h2>${c.esc(c.t("Overview"))}</h2>${c.statsHtml}${c.yearHtml}${c.trainingHtml}${c.weightHtml}${c.caloriesHtml}${c.strengthHtml}`;
}

// Goals: streaks and the target first, badges last.
function goals(c) {
  return `<h2>${c.esc(c.t("Goals"))}</h2>${c.streaksHtml}${c.targetHtml}${c.badgesHtml}`;
}

// Friends: requests, the leaderboard (flat, compact rows), the friends list, Manage.
function friends(c) {
  return `<h2>${c.esc(c.t("Friends"))}</h2>${c.requestsHtml}<div class="lk-board">${c.boardHtml}</div>${c.friendsHtml}${c.manageHtml}`;
}

// Body: the weight and the entry actions first, the trend after, your profile line last.
function body(c) {
  const form = c.profileIsForm ? c.profileHtml : "", line = c.profileIsForm ? "" : c.profileHtml;   // the About-you form belongs under the weight; the finished profile line goes last
  return `<h2>${c.esc(c.t("Body"))}</h2>${c.quickHtml}${form}${c.entryHtml}${c.trendHtml}${c.recentHtml}${line}`;
}

// My Gym: flat lists of switches under a quiet count line. Every equipment item stays a gym-toggle button (aria-pressed), drawn as a row with a switch.
function gym(c) {
  const e = c.esc;
  const groups = c.groups.map(g => `<h3 class="lk-gh">${e(g.label)}</h3><div class="card lk-sw-card">${g.items.map(i => `<button type="button" class="lk-swrow" data-act="gym-toggle" data-id="${e(i.id)}" aria-pressed="${i.on}"><span class="lk-swl">${e(i.label)}</span><i class="lk-sw" aria-hidden="true"></i></button>`).join("")}</div>`).join("");
  return `<h2>${e(c.t("My Gym"))}</h2>${c.introHtml}${groups}${c.injuriesHtml}${c.endHtml}`;
}

// History: one dense row per workout (name, date, totals), the exercise chips on one line; the backup card stays last.
function history(c) {
  const e = c.esc, rows = c.items.map(it => `<div class="card lk-hist" data-open="${e(it.date)}" tabindex="0">
    <div class="lk-hhead">${""}<div class="lk-dtitle"><span class="dayname">${e(it.name)}</span><span class="lk-dmeta">${e(it.dateLabel)}</span></div><span class="num lk-hsum">${it.summaryHtml}</span></div>
    <div class="lk-hchips">${it.chipsHtml}</div>${it.deleteHtml}</div>`).join("");
  return `<h2>${e(c.t("History"))}</h2>${c.summaryHtml}${`<div class="stack">${rows}</div>`}${c.moreHtml}${c.backupHtml}`;
}

// Friend page: the comparison table first, the two level cards after it, then Remove / Block / Report.
function friendPage(c) {
  const duo = `<div class="lk-duo">${c.duoHtml}</div>`;
  return c.headHtml + c.bodyHtml + c.tableHtml + duo + c.actionsHtml + c.reportHtml;
}

// Challenges list: invitations first (they need an answer), then active and finished.
function challenges(c) {
  return c.headHtml + c.emptyHtml + c.invHtml + c.actHtml + c.finHtml + c.oldHtml;
}

// The focus card: name, tags and target on the left, a 96 px demo on the right; advice, set type, the sets, two stacked steppers, one big Log button.
function workout(c) {
  return `<div class="card focus lk-focus" id="open-card">
    ${c.full ? c.demoHtml : ""}
    <div class="ex-top lk-top"><div class="grow lk-who">${c.nameHtml}${c.tagsHtml}</div>${c.full ? "" : c.demoHtml}</div>
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
  ${c.footHtml}`;
}

export const screens = { today, workout, "plan.dayCard": dayCard, "progress.overview": overview, "progress.goals": goals, "friends.board": friends, "progress.body": body, "plan.gym": gym, "progress.history": history, "friends.page": friendPage, "challenges.list": challenges };
