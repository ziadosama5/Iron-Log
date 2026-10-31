// Joint tags for the dataset exercises, derived from the dataset's own name/equipment/category plus the library's muscle group.
// Conservative on purpose (more joints rather than fewer): a person who marks an area would rather lose an exercise than hurt the joint.
// Areas: shoulder, elbow, wrist, lower-back, hip, knee, ankle (the order of AREAS in public/injuries.js). Pure; tested in tests/injuries-catalog.test.js.
const AREAS = ["shoulder", "elbow", "wrist", "lower-back", "hip", "knee", "ankle"];

const RULES = [
  // [pattern on the lowercase dataset name, areas it adds]
  [/\b(bench|chest|shoulder|overhead|military|arnold|incline|decline|floor|landmine|push|svend|cuban|neck) press|\bpress\b/, ["shoulder", "elbow", "wrist"]],
  [/push[- ]?up|handstand|planche|burpee|bear crawl|crab|crawl|plank|walkout|mountain climber|renegade|pike/, ["shoulder", "elbow", "wrist"]],
  [/\bdips?\b|triceps|tricep|skull|pushdown|french|close[- ]grip bench/, ["shoulder", "elbow"]],
  [/\bfly\b|flye|crossover|pec deck|butterfly|pullover|\braises?\b|upright row|shrug|face pull|rear delt|reverse fly|y raise|t raise|\bcircles?\b|scapular|rotation.*shoulder|shoulder.*rotation/, ["shoulder"]],
  [/curl/, ["elbow", "wrist"]],
  [/wrist|forearm|grip|gripper|finger/, ["wrist", "elbow"]],
  [/pull[- ]?up|chin[- ]?up|pulldown|\brow\b|\brows\b|lat |hang\b|hanging|muscle[- ]?up|kipping|inverted|rope climb|climb/, ["shoulder", "elbow", "wrist"]],
  [/deadlift|good morning|back extension|hyperextension|superman|swing|clean|snatch|jerk|pendlay|\brow\b|bent[- ]?over|hip hinge|hyper|zercher|rack pull|stiff/, ["lower-back", "hip"]],
  [/squat|lunge|leg press|step[- ]?up|hack|split squat|pistol|wall sit|sissy|cossack|skater|box|thruster|wall ball/, ["knee", "hip"]],
  [/barbell.*squat|front squat|overhead squat|zercher|good morning|deadlift|thruster|clean|snatch|jerk/, ["lower-back"]],
  [/jump|hop|plyo|sprint|\brun\b|jog|skip|jack|burpee|bound|jump rope|skipping|speed/, ["knee", "ankle", "hip"]],
  [/lunge|step|calf|heel|toe raise|ankle|tibialis|donkey calf|stair|walk|march/, ["ankle"]],
  [/leg extension|leg curl|hamstring curl|knee|quad|sled|bike|cycle|elliptical|treadmill|stepmill|ergometer|skier|\bleg curl/, ["knee"]],
  [/hip thrust|bridge|glute|kickback|abduction|adduction|donkey|fire hydrant|clam|pull[- ]?through|hip |hips|groin|piriformis|inner thigh|outer thigh|\bleg raise|knee raise|v[- ]?up|jackknife|flutter|scissor/, ["hip"]],
  [/hip thrust|bridge|barbell glute|weighted glute/, ["lower-back"]],
  [/crunch|sit[- ]?up|twist|woodchop|russian|bicycle|dead bug|hollow|rollout|rollerout|wheel|toe touch|side bend|oblique|windshield|wiper|v[- ]?up|jackknife|leg raise|knee raise|cocoon|\bab\b/, ["lower-back"]],
  [/rollout|rollerout|wheel|saw|plank|body saw|ab wheel|pallof|battling ropes?|jump rope/, ["shoulder", "wrist"]]
];

// stretches and mobility drills load the joint they name
const STRETCH = [
  [/shoulder|chest|lat\b|arm|pectoral|triceps|biceps|neck|trap/, ["shoulder"]],
  [/elbow|triceps/, ["elbow"]],
  [/wrist|forearm|finger/, ["wrist"]],
  [/back|spine|cobra|child|cat|camel|twist|lumbar|seated forward|lower back/, ["lower-back"]],
  [/hip|glute|piriformis|groin|adductor|abductor|hamstring|thigh|butterfly|pigeon|frog|figure|cross/, ["hip"]],
  [/knee|quad|thigh/, ["knee"]],
  [/calf|ankle|achilles|soleus|shin|foot|toe/, ["ankle"]],
  [/lunge|squat/, ["hip", "knee"]]
];

export function jointRules(entry, group) {
  const name = String(entry.name).toLowerCase(), eq = String(entry.equipment).toLowerCase(), set = new Set();
  const isStretch = /stretch|mobility|foam|massage|roller|pose|release/.test(name) || eq === "roller";
  if (isStretch) { for (const [re, areas] of STRETCH) if (re.test(name)) areas.forEach(a => set.add(a)); }
  else {
    for (const [re, areas] of RULES) if (re.test(name)) areas.forEach(a => set.add(a));
    // a group-based floor, so lower-body strength work and presses are never left without tags
    if (!set.size) {
      if (group === "Chest" || group === "Shoulders" || group === "Triceps") ["shoulder", "elbow"].forEach(a => set.add(a));
      else if (group === "Back") ["shoulder", "elbow", "lower-back"].forEach(a => set.add(a));
      else if (group === "Biceps") ["elbow", "wrist"].forEach(a => set.add(a));
      else if (group === "Quads") ["knee", "hip"].forEach(a => set.add(a));
      else if (group === "Hamstrings & Glutes") ["hip", "lower-back"].forEach(a => set.add(a));
      else if (group === "Calves") set.add("ankle");
      else if (group === "Core") set.add("lower-back");
    }
    // pushing/pulling with a loaded bar or bell stresses the wrists; a bodyweight curl-like or leg exercise does not
    if (/barbell|dumbbell|kettlebell|ez barbell|smith machine/.test(eq) && ["Chest", "Shoulders", "Triceps", "Back"].includes(group)) set.add("wrist");
  }
  // upper-body joints do not belong to a leg or ab exercise unless the movement really loads the arms (planks, climbers, cleans, hanging...)
  const UPPER = ["shoulder", "elbow", "wrist"];
  const ARMS_IN_IT = /push[- ]?up|plank|burpee|crawl|mountain|renegade|walkout|clean|snatch|jerk|thruster|swing|\brow\b|overhead|shoulder|bench|pullover|hang|roll|saw|climb|handstand|wall ball|battling|kettlebell/;
  if (!isStretch && ["Quads", "Hamstrings & Glutes", "Calves", "Core"].includes(group) && !ARMS_IN_IT.test(name)) UPPER.forEach(a => set.delete(a));
  return AREAS.filter(a => set.has(a)).slice(0, 5);
}
