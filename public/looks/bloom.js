// Bloom screen builders (Looks 2.0, docs/looks/today.md). Pure: ctx in, HTML out. Screens not listed here use the Classic layout.
// A builder arranges the same named parts the Classic screen is made of, so every data-act the Classic card has is present here too.

import { weekStrip, glance } from "./today-parts.js";

// The Today home with no workout open: the level card comes first, then the plan.
function today(c) {
  return [c.dateHtml, weekStrip(c), c.heroHtml, glance(c), c.deloadHtml, c.hintHtml, c.journeyHtml, c.cardioHtml, c.foodHtml].join("");
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

export const screens = { today, workout };
