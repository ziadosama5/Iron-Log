// Workout helpers with no DOM or Firebase code, so they can be unit-tested in Node.

export const REST_MIN = 15;
export const REST_MAX = 600;
const GO_MS = 60000; // how long the "Rest over" state shows before the bar goes away

// First match wins. Big compound lifts get longer rest.
const REST_RULES = [
  [/upright row|leg extension/i, 90],
  [/split squat|row\b|pull-?up|chin-?up|\bdips?\b|hip thrust|incline (barbell|bench)/i, 150],
  [/squat|deadlift|\brdl\b|bench press|overhead press|military press|leg press/i, 180],
];

export function defaultRest(exName) {
  const rule = REST_RULES.find(([re]) => re.test(exName));
  return rule ? rule[1] : 90;
}

export function restFor(exName, settings) {
  const saved = settings && settings.rest && settings.rest[exName];
  return saved > 0 ? saved : defaultRest(exName);
}

export function startRest(ex, seconds, now) {
  return { ex, endsAt: now + seconds * 1000, total: seconds };
}

export function adjustRest(rest, deltaSec, now) {
  const total = Math.min(REST_MAX, Math.max(REST_MIN, rest.total + deltaSec));
  return { ex: rest.ex, endsAt: Math.max(now, rest.endsAt + deltaSec * 1000), total };
}

export function remaining(endsAt, now) {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function restPhase(rest, now) {
  if (!rest) return "none";
  if (now < rest.endsAt) return "resting";
  return now < rest.endsAt + GO_MS ? "go" : "expired";
}

export function fmtClock(sec) {
  return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
}

// Values for the next set: last session's set at the same position, else repeat today's last set,
// else last session's first set, else a starter value.
export function prefillFor(entry, last) {
  const n = entry.sets.length;
  const s = (last && last.sets[n]) || entry.sets[n - 1] || (last && last.sets[0]);
  return s ? { w: String(Math.round(s.w * 100) / 100), r: String(s.r) } : { w: "20", r: "8" };
}

// Keep the screen on only while logging today's workout.
export function shouldWake({ view, date, today, exerciseCount }) {
  return view === "log" && date === today && exerciseCount > 0;
}

// Screen Wake Lock wrapper. Browsers drop the lock when the app is hidden, so it is
// requested again when the page becomes visible. Unsupported or refused: does nothing.
export function createWakeLock(env = globalThis) {
  const api = env.navigator && env.navigator.wakeLock;
  if (!api) return { want() {} };
  let wanted = false, sentinel = null, pending = false;
  const release = () => {
    const s = sentinel; sentinel = null;
    if (s && !s.released) s.release().catch(() => {});
  };
  const acquire = () => {
    if (!wanted || pending || (sentinel && !sentinel.released)) return;
    if (env.document.visibilityState !== "visible") return;
    pending = true;
    try {
      api.request("screen").then(
        s => { pending = false; sentinel = s; if (!wanted) release(); },
        () => { pending = false; }
      );
    } catch (e) { pending = false; }
  };
  env.document.addEventListener("visibilitychange", acquire);
  return { want(on) { wanted = !!on; if (wanted) acquire(); else release(); } };
}

// Index of the set being edited for this date + exercise, or -1. Checking the date means an
// edit started on one day can never save over a set on another day.
export function editIndexFor(editSet, date, ex, sets) {
  return editSet && editSet.date === date && editSet.ex === ex && sets[editSet.si] ? editSet.si : -1;
}

// If the app was left open past midnight, "today" in the Workout tab must move to the new day.
// A date the user picked on purpose (anything other than the old today) stays as it is.
export function rolloverDate(current, lastToday, nowToday) {
  return current === lastToday && nowToday !== lastToday ? nowToday : current;
}

// A day counts as trained when it has logged sets or any cardio.
export function trainedOn(w) {
  return !!w && ((w.entries || []).some(e => (e.sets || []).length > 0) || (w.cardio || []).length > 0);
}
