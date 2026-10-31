// Pure mapping rules for the exercise catalog import (tools/import-catalog.mjs). Unit-tested in tests/catalog.test.js.
// Input is a record of hasaneyldrm/exercises-dataset (names, targets, equipment are MIT; the pictures are (c) Gym visual).

const SMALL = new Set(["to", "with", "on", "of", "and", "the", "a", "in", "for", "at", "by", "from", "over", "under", "off"]);

// "barbell full squat" -> "Barbell Full Squat". Matches the library's style: hyphen words keep only their first part capitalised
// ("Close-grip"), small words stay lower case, a few gear names are normalised ("EZ-bar", "T-bar", leading "lever" -> "Machine").
export function titleCase(name) {
  let s = String(name).trim().toLowerCase().replace(/в°/g, "°").replace(/\s+/g, " ");   // the dataset has a broken "45в°" in a few names
  s = s.replace(/^lever\b/, "machine").replace(/^smith(?! machine)\b/, "smith machine").replace(/\bez[- ]?bar(bell)?\b/g, "ez-bar").replace(/\bsz[- ]bar\b/g, "ez-bar").replace(/\bt[- ]bar\b/g, "t-bar");
  const words = s.split(" ").map((w, i) => {
    const open = w.startsWith("(") ? "(" : "", core = open ? w.slice(1) : w;
    if (i > 0 && SMALL.has(core)) return w;
    if (w === "ez-bar") return "EZ-bar";
    const cap = c => (/^[a-z]/.test(c) ? c[0].toUpperCase() + c.slice(1) : c);
    return open + cap(core);
  });
  return words.join(" ");
}

// Two records that are the same exercise seen twice share a key: "v. 2" copies, "(male)"/"(female)" and "(... pov)" views.
export function foldKey(name) {
  return String(name).toLowerCase().replace(/\s+v\. \d+/g, "").replace(/\s*\((male|female)\)/g, "").replace(/\s*\([^)]*\bpov\b[^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

// dataset target muscle -> one of the library's nine groups
export const GROUP_OF_TARGET = {
  pectorals: "Chest", lats: "Back", "upper back": "Back", traps: "Back", spine: "Back", "levator scapulae": "Back",
  delts: "Shoulders", biceps: "Biceps", forearms: "Biceps", triceps: "Triceps", quads: "Quads",
  hamstrings: "Hamstrings & Glutes", glutes: "Hamstrings & Glutes", adductors: "Hamstrings & Glutes", abductors: "Hamstrings & Glutes",
  calves: "Calves", abs: "Core", "serratus anterior": "Core", "cardiovascular system": "Core"
};
// Squat-pattern lifts are tagged "glutes" by the dataset but live under Quads in this library.
const QUAD_WORDS = /squat|lunge|leg press|leg extension|step[- ]?up|hack/i;
const NOT_QUAD = /romanian|deadlift|bridge|thrust|good morning|hip |glute|curl|kickback|pull[- ]?through|stiff|abduction|adduction/i;
export function groupFor(entry) {
  let g = GROUP_OF_TARGET[entry.target];
  if (!g) g = entry.category === "neck" ? "Back" : "Core";
  if (g === "Hamstrings & Glutes" && QUAD_WORDS.test(entry.name) && !NOT_QUAD.test(entry.name)) g = "Quads";
  return g;
}

// secondary/muscle_group words of the dataset -> library groups ("also works" in the info sheet)
const WORD_GROUP = {
  chest: "Chest", pectorals: "Chest", pectoralis: "Chest", back: "Back", lats: "Back", "latissimus dorsi": "Back", traps: "Back", trapezius: "Back", rhomboids: "Back", "upper back": "Back", "lower back": "Back", spine: "Back", "levator scapulae": "Back", "rotator cuff": "Shoulders",
  shoulders: "Shoulders", deltoids: "Shoulders", delts: "Shoulders", biceps: "Biceps", forearms: "Biceps", brachialis: "Biceps", wrists: "Biceps", "wrist flexors": "Biceps", "wrist extensors": "Biceps", hands: "Biceps", triceps: "Triceps",
  quadriceps: "Quads", quads: "Quads", hamstrings: "Hamstrings & Glutes", glutes: "Hamstrings & Glutes", adductors: "Hamstrings & Glutes", abductors: "Hamstrings & Glutes", "hip flexors": "Hamstrings & Glutes", groin: "Hamstrings & Glutes", calves: "Calves", soleus: "Calves", ankles: "Calves", "ankle stabilizers": "Calves", shins: "Calves",
  core: "Core", abs: "Core", abdominals: "Core", obliques: "Core", "serratus anterior": "Core", "cardiovascular system": "Core"
};
export function groupsOfWords(words, exclude) {
  const out = [];
  for (const w of words || []) { const g = WORD_GROUP[String(w).toLowerCase()]; if (g && g !== exclude && !out.includes(g)) out.push(g); }
  return out;
}

// Machine exercises ("leverage machine" / "sled machine") map to one of our specific machine ids by name words, else the generic id.
const MACHINE_RULES = [
  [/assisted/, "assisted-machine"], [/seated calf|calf press/, "seated-calf-machine"], [/calf/, "standing-calf-machine"],
  [/seated fly|pec deck|\bfly\b.*machine|machine.*\bfly\b/, "pec-deck"], [/incline chest press|incline press/, "incline-press-machine"], [/chest press/, "chest-press"],
  [/shoulder press/, "shoulder-press-machine"], [/lateral raise/, "lateral-raise-machine"], [/t[- ]bar/, "tbar-row"], [/pulldown|pull-down/, "lat-pulldown"],
  [/\brow\b/, "seated-row"], [/hack squat/, "hack-squat"], [/leg press/, "leg-press"], [/leg extension/, "leg-extension"], [/seated leg curl/, "seated-leg-curl"],
  [/leg curl/, "leg-curl"], [/hip abduction/, "hip-abduction"], [/hip adduction/, "hip-adduction"], [/glute (kick|press)|kickback/, "glute-kickback"],
  [/biceps? curl|\bcurl\b/, "biceps-curl-machine"],
  [/triceps|\bdip\b/, "triceps-machine"], [/crunch|sit-?up/, "ab-crunch-machine"], [/back extension/, "hyper-bench"]
];
const PLAIN = {
  "body weight": [], dumbbell: ["dumbbell"], barbell: ["barbell"], "olympic barbell": ["olympic-barbell"], "ez barbell": ["ez-bar"], "trap bar": ["trap-bar"],
  kettlebell: ["kettlebell"], cable: ["cable"], "smith machine": ["smith"], band: ["resistance-band"], "resistance band": ["resistance-band"],
  "stability ball": ["stability-ball"], "medicine ball": ["medicine-ball"], "bosu ball": ["bosu-ball"], rope: ["battle-rope"], roller: ["foam-roller"],
  "wheel roller": ["wheel-roller"], weighted: ["weight-plate"], assisted: ["assisted-machine"], tire: ["tire"], hammer: ["sledgehammer"],
  "upper body ergometer": ["ergometer"], "skierg machine": ["ergometer"], "stationary bike": ["ergometer"], "elliptical machine": ["ergometer"], "stepmill machine": ["ergometer"]
};
export function eqIdsFor(entry) {
  const name = String(entry.name).toLowerCase(), eq = String(entry.equipment).toLowerCase(), out = new Set();
  if (eq === "leverage machine" || eq === "sled machine") {
    const rule = MACHINE_RULES.find(([re]) => re.test(name));
    out.add(rule ? rule[1] : eq === "sled machine" ? "sled-machine" : "lever-machine");
  } else for (const id of PLAIN[eq] || []) out.add(id);
  if (!(eq in PLAIN) && eq !== "leverage machine" && eq !== "sled machine") out.add("lever-machine");   // an equipment kind we have not seen
  // stations the exercise implies (a bench, a pull-up bar, a dip station, a preacher bench ...)
  if (/\bbench\b/.test(name) && !/bench dip|bench squat|bench hip|bench press sit|over bench|jump over|bench jump/.test(name) && eq !== "leverage machine") out.add("bench");
  if (/decline/.test(name) && /bench|press|fly|dumbbell|barbell/.test(name) && eq !== "body weight" && eq !== "cable" && !out.has("tbar-row")) { out.add("decline-bench"); out.delete("bench"); }
  if (/pull-?up|chin-?up/.test(name) && !/assisted/.test(name) && eq === "body weight") out.add("pullup-bar");
  if (/\bdip\b|\bdips\b/.test(name) && !/bench dip|three bench|reverse dip/.test(name) && eq === "body weight") out.add("dip-station");
  if (/preacher/.test(name)) out.add("preacher-bench");
  if (/captains? chair/.test(name)) out.add("captains-chair");
  if (/hanging/.test(name) && eq === "body weight") out.add("pullup-bar");
  if (/rack pull|rack /.test(name) && /barbell/.test(eq)) out.add("rack");
  if (/step-up|box jump|box squat|\bbox\b/.test(name)) out.add("box");
  return [...out];
}

// Logged as seconds (like Plank): stretches, mobility, rollers, holds and every cardio-category exercise.
export function isHoldKind(entry) {
  return entry.category === "cardio" || String(entry.equipment).toLowerCase() === "roller"
    || /stretch|mobility|foam|massage|roller|\bplank\b|\bhold\b|isometric|wall sit|\bhang\b|dead hang|\bpose\b|rotation \(|circles/.test(String(entry.name).toLowerCase());
}
