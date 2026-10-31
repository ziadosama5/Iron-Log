// Carbon screen builders (Looks 2.0, docs/looks/today.md). Pure: ctx in, HTML out. Screens not listed here use the Classic layout.
// A builder arranges the same named parts the Classic screen is made of, so every data-act the Classic card has is present here too.

import { weekStrip, glance } from "./today-parts.js";

// The Today home with no workout open: the day to train comes first, the level card after it.
function today(c) {
  return [c.dateHtml, weekStrip(c), glance(c), c.heroHtml, c.deloadHtml, c.hintHtml, c.journeyHtml, c.cardioHtml, c.foodHtml].join("");
}

// The focus card: name, tags and target on the left, a 96 px demo on the right; advice, set type, the sets, two stacked steppers, one big Log button.
function workout(c) {
  return `<div class="card focus lk-focus" id="open-card">
    <div class="ex-top lk-top"><div class="grow lk-who">${c.nameHtml}${c.tagsHtml}</div>${c.demoHtml}</div>
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

export const screens = { today, workout };
