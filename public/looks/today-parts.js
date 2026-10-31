// Pieces of the Today home shared by Carbon and Bloom (Looks 2.0). Pure: ctx in, HTML out.

// Seven day dots, Saturday first: today filled, a dot under every planned or trained day. Not interactive (the date field stays in the page).
export function weekStrip(c) {
  const e = c.esc;
  return `<div class="lk-week" aria-hidden="true">${c.week.map(d => `<span class="lk-wd${d.today ? " is-today" : ""}${d.selected ? " is-sel" : ""}"><i>${e(d.label)}</i><b class="num">${d.num}</b><u${d.planned ? ' class="on"' : ""}></u></span>`).join("")}</div>`;
}

// "Up next": the day to train with a big Start button, Free workout, and the other days as chips. With no days (or while switching to
// another day) the Classic picker is used, so nothing is lost.
export function glance(c) {
  const { t, tn, esc: e } = c, n = c.next;
  if (!c.hasDays || !n || c.switching) return c.dayPickerHtml;
  const others = c.days.filter(d => d.id !== n.id);
  return `<div class="card lk-glance">
    <div class="lk-up">${e(t(c.scheduled && c.isToday ? "Today" : "Up next"))}</div>
    <div class="lk-name num">${e(n.name)}</div>
    <div class="lk-meta">${e(tn("{n} exercise", "{n} exercises", n.count))}${n.last ? " · " + e(t("last {d}", { d: n.last })) : ""}</div>
    ${n.focus.length ? `<div class="lk-tags">${n.focus.map(m => `<span class="tag2">${e(m)}</span>`).join("")}</div>` : ""}
    <button type="button" class="btn primary" data-act="start-day" data-id="${e(n.id)}">${e(t("Start workout"))}</button>
    <div class="row lk-alt"><button type="button" class="btn grow" data-act="start-free">${e(t("Free workout"))}</button></div>
    ${others.length ? `<div class="lk-others"><span class="label">${e(t("Other days"))}</span><div class="chips">${others.map(d => `<button type="button" class="chip" data-act="start-day" data-id="${e(d.id)}">${e(d.name)}</button>`).join("")}</div></div>` : ""}
  </div>`;
}
