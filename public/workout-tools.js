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
