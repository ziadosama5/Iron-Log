// Hand-drawn start/finish figures for exercises the Everkinetic set doesn't cover (dev only).
//   node tools/draw-exercises.mjs            writes nothing; tools/import-exercises.mjs imports DRAWINGS
//   node tools/draw-exercises.mjs --sheet f.html   writes a contact sheet to look at them
// Figures face right in side views. Canvas 216 x 300, ground y = 270 (see draw-lib.mjs).
import { fig, tap, chain, line, rect, circle, floor, poly, plate, cable, hand, dumbbell, barbell, body, arm, leg, delt } from "./draw-lib.mjs";

const head = (c, r = 15) => ({ head: c, headR: r });

// ---------- Face Pull (cable at head height, pull the rope to the face) ----------
const facePull = finish => {
  const sh = [106, 92], hip = [108, 162], knee = [110, 216], ank = [110, 262];
  const wrist = finish ? [128, 70] : [154, 98], elbow = finish ? [86, 84] : [130, 98];
  return fig({
    ...head([108, 56]),
    parts: [...body({ sh, hip }), ...leg(hip, knee, ank, [132, 266]), ...arm(sh, elbow, wrist), delt(sh, 11)],
    behind: rect(192, 40, 14, 230, 3) + circle([192, 66], 7),
    gear: floor() + cable([192, 66], wrist) + hand(wrist, 5)
  });
};

// ---------- Hip Thrust (upper back on a bench, bar over the hips) ----------
const hipThrust = finish => {
  const sh = [58, 196], hip = finish ? [122, 198] : [122, 240], knee = finish ? [164, 204] : [166, 206], ank = [168, 258];
  const bar = [hip[0], hip[1] - 12], elbow = [92, bar[1] - 4];
  return fig({
    ...head([38, 180]),
    parts: [...body({ sh, hip, chest: 32, waist: 26 }), ...leg(hip, knee, ank, [190, 264]), ...arm(sh, elbow, bar), delt(sh, 11)],
    behind: rect(14, 206, 62, 64, 4),
    gear: floor() + plate(bar, 20) + hand(bar, 5)
  });
};

// ---------- Plank (forearms on the floor, straight line head to heels) ----------
const plank = () => {
  const sh = [60, 198], hip = [118, 220], knee = [152, 232], ank = [188, 244], elbow = [60, 246], wrist = [24, 246];
  return fig({
    ...head([30, 184]),
    parts: [...body({ sh, hip, chest: 30, waist: 22 }), ...leg(hip, knee, ank, [198, 262], [22, 16, 10]), ...arm(sh, elbow, wrist), delt(sh, 11)],
    gear: floor(264)
  });
};

// ---------- Pec Deck (front view, forearms on the pads, bring the pads together) ----------
const pecDeck = finish => {
  const L = finish ? { e: [86, 124], h: [98, 84] } : { e: [46, 120], h: [48, 82] };
  const R = finish ? { e: [130, 124], h: [118, 84] } : { e: [170, 120], h: [168, 82] };
  const pad = (c, ang) => `<rect x="${c[0] - 7}" y="${c[1] - 22}" width="14" height="52" rx="6" class="exbg" stroke="currentColor" stroke-width="3"/>`;
  return fig({
    ...head([108, 50]),
    parts: [tap([108, 90], [108, 172], 72, 46),
      tap([78, 98], L.e, 18, 14), tap(L.e, L.h, 14, 10), tap([138, 98], R.e, 18, 14), tap(R.e, R.h, 14, 10),
      delt([78, 98], 12), delt([138, 98], 12),
      tap([94, 176], [72, 204], 24, 17), tap([72, 204], [72, 260], 17, 11), tap([122, 176], [144, 204], 24, 17), tap([144, 204], [144, 260], 17, 11),
      tap([72, 260], [60, 266], 11, 8), tap([144, 260], [156, 266], 11, 8)],
    behind: rect(66, 178, 84, 14, 5) + rect(92, 70, 32, 70, 8),
    gear: floor() + pad(L.h) + pad(R.h)
  });
};

// ---------- Reverse Pec Deck (front view, open the arms to the sides) ----------
const reversePecDeck = finish => {
  const L = finish ? { e: [52, 96], h: [24, 98] } : { e: [88, 134], h: [100, 160] };
  const R = finish ? { e: [164, 96], h: [192, 98] } : { e: [128, 134], h: [116, 160] };
  return fig({
    ...head([108, 50]),
    parts: [tap([108, 90], [108, 172], 72, 46),
      tap([78, 98], L.e, 18, 14), tap(L.e, L.h, 14, 10), tap([138, 98], R.e, 18, 14), tap(R.e, R.h, 14, 10),
      delt([78, 98], 12), delt([138, 98], 12),
      tap([94, 176], [72, 204], 24, 17), tap([72, 204], [72, 260], 17, 11), tap([122, 176], [144, 204], 24, 17), tap([144, 204], [144, 260], 17, 11),
      tap([72, 260], [60, 266], 11, 8), tap([144, 260], [156, 266], 11, 8)],
    behind: rect(66, 178, 84, 14, 5) + rect(88, 92, 40, 60, 8),
    gear: floor() + hand(L.h, 7) + hand(R.h, 7)
  });
};

// ---------- Arnold Press (front view, rotate the palms as you press) ----------
const arnoldPress = finish => {
  const L = finish ? { e: [64, 62], h: [76, 24] } : { e: [86, 138], h: [96, 84] };
  const R = finish ? { e: [152, 62], h: [140, 24] } : { e: [130, 138], h: [120, 84] };
  return fig({
    ...head([108, 52]),
    parts: [tap([108, 92], [108, 170], 72, 46),
      tap([76, 98], L.e, 18, 14), tap(L.e, L.h, 14, 10), tap([140, 98], R.e, 18, 14), tap(R.e, R.h, 14, 10),
      delt([76, 98], 12), delt([140, 98], 12),
      tap([94, 174], [90, 220], 24, 17), tap([90, 220], [88, 262], 17, 11), tap([122, 174], [126, 220], 24, 17), tap([126, 220], [128, 262], 17, 11),
      tap([88, 262], [78, 266], 11, 8), tap([128, 262], [138, 266], 11, 8)],
    gear: floor() + dumbbell(L.h, finish ? 0 : 90, 24, 8) + dumbbell(R.h, finish ? 0 : 90, 24, 8)
  });
};

// ---------- Machine Shoulder Press (side view, seated against the back pad) ----------
const machineShoulderPress = finish => {
  const sh = [94, 94], hip = [88, 196], knee = [140, 202], ank = [144, 262];
  const elbow = finish ? [112, 60] : [114, 120], wrist = finish ? [120, 28] : [124, 82];
  return fig({
    ...head([100, 58]),
    parts: [...body({ sh, hip, chest: 34, waist: 26 }), ...leg(hip, knee, ank, [166, 266], [24, 17, 11]), ...arm(sh, elbow, wrist), delt(sh, 12)],
    behind: rect(54, 66, 16, 140, 6) + rect(62, 198, 92, 14, 5) + line([172, 18], [172, 150], 4) + line([124, wrist[1]], [172, wrist[1]], 3),
    gear: floor() + hand(wrist, 5) + line([wrist[0] - 8, wrist[1]], [wrist[0] + 10, wrist[1]], 6)
  });
};

// ---------- Chest Dip (parallel bars, lean forward, elbows out) ----------
const chestDip = finish => {
  const wrist = [118, 130];
  const sh = finish ? [120, 114] : [114, 70], elbow = finish ? [92, 126] : [116, 100];
  const hip = finish ? [98, 178] : [90, 148], knee = finish ? [90, 216] : [84, 196], ank = finish ? [66, 248] : [62, 236];
  return fig({
    ...head(finish ? [134, 92] : [124, 48]),
    parts: [...body({ sh, hip, chest: 34, waist: 24 }), ...chain([hip, knee, ank], [22, 16, 11]), ...arm(sh, elbow, wrist), delt(sh, 12)],
    behind: line([84, 270], [84, 134], 4) + line([150, 270], [150, 134], 4),
    gear: floor() + line([84, 130], [152, 130], 5) + hand(wrist, 5)
  });
};

// ---------- Overhead Cable Extension (rope overhead, cable from a low pulley behind) ----------
const overheadCableExtension = finish => {
  const sh = [108, 94], hip = [102, 162], knee = [106, 216], ank = [106, 262];
  const elbow = finish ? [118, 54] : [116, 52], wrist = finish ? [124, 22] : [92, 62];
  return fig({
    ...head([110, 58]),
    parts: [...body({ sh, hip }), ...leg(hip, knee, ank, [128, 266]), ...arm(sh, elbow, wrist), delt(sh, 11)],
    behind: rect(14, 60, 14, 210, 3) + circle([21, 250], 7),
    gear: floor() + line([21, 250], [wrist[0] - 4, wrist[1] + 2], 2) + hand(wrist, 5) + line([wrist[0] - 4, wrist[1] - 4], [wrist[0] + 6, wrist[1] + 4], 5)
  });
};

// ---------- Stiff-leg Deadlift (nearly straight legs, hinge at the hips) ----------
const stiffLegDeadlift = finish => {
  const sh = finish ? [152, 140] : [108, 92], hip = finish ? [94, 168] : [108, 162];
  const knee = finish ? [100, 216] : [110, 216], ank = [110, 262];
  const wrist = finish ? [154, 216] : [118, 170], elbow = finish ? [154, 178] : [114, 132];
  return fig({
    ...head(finish ? [176, 132] : [108, 56]),
    parts: [...body({ sh, hip, chest: 34, waist: 24 }), ...leg(hip, knee, ank, [132, 266]), ...arm(sh, elbow, wrist), delt(sh, 12)],
    gear: floor() + plate(wrist, finish ? 24 : 18) + hand(wrist, 5)
  });
};

// ---------- Bulgarian Split Squat (rear foot on a bench) ----------
const bulgarianSplitSquat = finish => {
  const hip = finish ? [118, 198] : [118, 166];
  const knee = finish ? [152, 222] : [122, 216], ank = finish ? [138, 262] : [124, 262];
  const rKnee = finish ? [86, 252] : [92, 208], rAnk = [58, 214];
  const sh = [hip[0] - 2, hip[1] - 70];
  return fig({
    ...head([hip[0], hip[1] - 106]),
    parts: [...body({ sh, hip, chest: 34, waist: 24 }), ...leg(hip, knee, ank, [158, 266]), ...chain([hip, rKnee, rAnk], [22, 16, 11]), ...arm(sh, [sh[0] + 6, sh[1] + 34], [sh[0] + 10, sh[1] + 64]), delt(sh, 12)],
    behind: rect(16, 222, 56, 48, 4),
    gear: floor() + hand([sh[0] + 10, sh[1] + 64], 5)
  });
};

// ---------- One-arm Dumbbell Row (one hand and knee on the bench) ----------
const oneArmRow = finish => {
  const sh = [152, 168], hip = [96, 172], knee = [76, 216], ank = [66, 262];
  const bKnee = [100, 202], bAnk = [58, 202];
  const elbow = finish ? [124, 174] : [158, 214], wrist = finish ? [122, 210] : [158, 244];
  return fig({
    ...head([184, 152]),
    parts: [...body({ sh, hip, chest: 34, waist: 24 }), ...chain([hip, knee, ank], [24, 17, 11]), ...chain([hip, bKnee, bAnk], [22, 16, 11]),
      ...arm(sh, elbow, wrist), ...arm([158, 172], [164, 190], [168, 206]), delt(sh, 12)],
    behind: rect(50, 204, 150, 14, 4) + line([60, 218], [60, 270], 4) + line([190, 218], [190, 270], 4),
    gear: floor() + dumbbell(wrist, 0, 22, 8)
  });
};

// ---------- Hanging Leg Raise (hang from a bar, raise the legs) ----------
const hangingLegRaise = finish => {
  const sh = [108, 76], hip = finish ? [102, 152] : [108, 152];
  const knee = finish ? [152, 150] : [110, 206], ank = finish ? [202, 150] : [110, 258];
  return fig({
    ...head([108, 50]),
    parts: [...body({ sh, hip, chest: 34, waist: 24 }), ...chain([hip, knee, ank], [24, 17, 11]), tap(ank, [ank[0] + (finish ? 12 : 16), ank[1] + (finish ? 0 : 4)], 11, 8),
      ...arm(sh, [122, 54], [116, 28]), delt(sh, 12)],
    behind: line([56, 24], [160, 24], 5) + line([56, 24], [56, 270], 3) + line([160, 24], [160, 270], 3),
    gear: floor() + hand([116, 26], 5)
  });
};

// ---------- Russian Twist (front view, V-sit on the floor, plate from side to side) ----------
const russianTwist = finish => {
  const plateC = finish ? [62, 148] : [154, 148];
  return fig({
    ...head([108, 58]),
    parts: [tap([108, 96], [108, 238], 70, 50),
      tap([76, 102], finish ? [76, 138] : [82, 144], 18, 13), tap(finish ? [76, 138] : [82, 144], finish ? [70, 150] : [96, 150], 13, 10),
      tap([140, 102], finish ? [134, 144] : [140, 138], 18, 13), tap(finish ? [134, 144] : [140, 138], finish ? [118, 150] : [140, 150], 13, 10),
      delt([76, 102], 12), delt([140, 102], 12),
      tap([96, 238], [88, 214], 28, 22), tap([88, 214], [92, 254], 22, 13), tap([120, 238], [128, 214], 28, 22), tap([128, 214], [124, 254], 22, 13)],
    gear: floor(266) + plate(plateC, 16) + hand(finish ? [72, 150] : [140, 150], 5)
  });
};

// ---------- Incline Push-up (hands on a bench, body in a straight line) ----------
const inclinePushUp = finish => {
  const sh = finish ? [140, 190] : [150, 154], hip = finish ? [88, 226] : [95, 202], knee = finish ? [58, 244] : [62, 230], ank = [30, 258];
  const elbow = finish ? [124, 208] : [152, 184], wrist = [154, 212];
  return fig({
    ...head(finish ? [162, 176] : [172, 138]),
    parts: [...body({ sh, hip, chest: 34, waist: 24 }), ...leg(hip, knee, ank, [20, 266], [26, 18, 11]), ...arm(sh, elbow, wrist), delt(sh, 12)],
    behind: rect(150, 214, 58, 56, 4),
    gear: floor() + hand(wrist, 5)
  });
};

// ---------- Decline Push-up (feet on a bench, hands on the floor) ----------
const declinePushUp = finish => {
  const sh = finish ? [148, 244] : [146, 206], hip = finish ? [96, 219] : [93, 200], knee = finish ? [68, 207] : [66, 197], ank = [40, 196];
  const elbow = finish ? [126, 254] : [148, 236], wrist = [152, 262];
  return fig({
    ...head(finish ? [172, 238] : [170, 196]),
    parts: [...body({ sh, hip, chest: 34, waist: 24 }), ...leg(hip, knee, ank, [28, 202], [26, 18, 11]), ...arm(sh, elbow, wrist), delt(sh, 12)],
    behind: rect(8, 204, 56, 66, 4),
    gear: floor() + hand(wrist, 5)
  });
};

// ---------- Dumbbell Floor Press (lying on the floor, upper arms stop on the floor) ----------
const dumbbellFloorPress = finish => {
  const sh = [62, 248], hip = [132, 252], knee = [164, 214], ank = [178, 260];
  const elbow = finish ? [62, 200] : [46, 262], wrist = finish ? [62, 176] : [50, 214];
  return fig({
    ...head([36, 250]),
    parts: [...body({ sh, hip, chest: 32, waist: 26 }), ...leg(hip, knee, ank, [196, 264], [26, 18, 11]), ...arm(sh, elbow, wrist), delt(sh, 11)],
    gear: floor(268) + dumbbell([wrist[0], wrist[1] - 4], 0, 28, 9) + hand(wrist, 5)
  });
};

export const DRAWINGS = {
  "face-pull": { start: facePull(false), end: facePull(true) },
  "hip-thrust": { start: hipThrust(false), end: hipThrust(true) },
  "plank": { start: plank(), end: plank() },
  "pec-deck": { start: pecDeck(false), end: pecDeck(true) },
  "reverse-pec-deck": { start: reversePecDeck(false), end: reversePecDeck(true) },
  "arnold-press": { start: arnoldPress(false), end: arnoldPress(true) },
  "machine-shoulder-press": { start: machineShoulderPress(false), end: machineShoulderPress(true) },
  "chest-dip": { start: chestDip(false), end: chestDip(true) },
  "overhead-cable-extension": { start: overheadCableExtension(false), end: overheadCableExtension(true) },
  "stiff-leg-deadlift": { start: stiffLegDeadlift(false), end: stiffLegDeadlift(true) },
  "bulgarian-split-squat": { start: bulgarianSplitSquat(false), end: bulgarianSplitSquat(true) },
  "one-arm-dumbbell-row": { start: oneArmRow(false), end: oneArmRow(true) },
  "hanging-leg-raise": { start: hangingLegRaise(false), end: hangingLegRaise(true) },
  "russian-twist": { start: russianTwist(false), end: russianTwist(true) },
  "incline-push-up": { start: inclinePushUp(false), end: inclinePushUp(true) },
  "decline-push-up": { start: declinePushUp(false), end: declinePushUp(true) },
  "dumbbell-floor-press": { start: dumbbellFloorPress(true), end: dumbbellFloorPress(false) }
};

// Contact sheet for looking at the drawings.
if (process.argv[2] === "--sheet") {
  const { writeFileSync } = await import("node:fs");
  let h = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#fff;color:#141a23;font:11px sans-serif}.exbg{fill:#fff}.exbg-s{stroke:#fff}svg{width:150px;height:208px;border:1px solid #ccc}div{display:inline-block;margin:3px}</style><body>`;
  for (const [k, d] of Object.entries(DRAWINGS)) h += `<div><b>${k}</b><br>${d.start}${d.end}</div>`;
  writeFileSync(process.argv[3], h);
}
