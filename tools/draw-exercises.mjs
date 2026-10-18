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

// ---------- Chest-supported Dumbbell Row (face down on an incline bench) ----------
const chestSupportedRow = finish => {
  const sh = [120, 164], hip = [74, 214], knee = [54, 240], ank = [38, 262];
  const elbow = finish ? [98, 188] : [124, 198], wrist = finish ? [114, 208] : [126, 232];
  return fig({
    ...head([142, 144]),
    parts: [...body({ sh, hip, chest: 34, waist: 24 }), ...leg(hip, knee, ank, [26, 266], [26, 18, 11]), ...arm(sh, elbow, wrist), delt(sh, 12)],
    behind: poly([[56, 228], [68, 240], [138, 172], [126, 160], [56, 228]], true) + line([94, 206], [94, 270], 4) + line([122, 178], [134, 270], 4),
    gear: floor() + dumbbell(wrist, 0, 22, 8) + hand(wrist, 5)
  });
};

// ---------- Machine Row (seated, chest against the pad) ----------
const machineRow = finish => {
  const sh = [104, 98], hip = [92, 196], knee = [152, 202], ank = [154, 262];
  const elbow = finish ? [78, 124] : [142, 116], wrist = finish ? [128, 130] : [178, 128];
  return fig({
    ...head([108, 60]),
    parts: [...body({ sh, hip, chest: 34, waist: 26 }), ...leg(hip, knee, ank, [176, 266], [26, 18, 11]), ...arm(sh, elbow, wrist), delt(sh, 12)],
    behind: rect(48, 198, 70, 14, 5) + rect(128, 88, 16, 78, 6) + line([196, 60], [196, 270], 4),
    gear: floor() + line([wrist[0], wrist[1]], [196, wrist[1]], 2) + line([wrist[0] + 2, wrist[1] - 8], [wrist[0] + 2, wrist[1] + 8], 5) + hand(wrist, 5)
  });
};

// ---------- Side Lunge (front view, step wide to the side) ----------
const sideLunge = finish => {
  const sh = finish ? [100, 114] : [108, 92], hip = finish ? [88, 192] : [108, 172];
  const lKnee = finish ? [52, 216] : [92, 222], lAnk = finish ? [50, 262] : [90, 262];
  const rHip = finish ? [112, 194] : [122, 176], rKnee = finish ? [146, 232] : [124, 222], rAnk = finish ? [178, 262] : [126, 262];
  const hands = finish ? [[96, 140], [110, 140]] : [[100, 118], [116, 118]], bell = [(hands[0][0] + hands[1][0]) / 2, hands[0][1]];
  return fig({
    ...head(finish ? [104, 74] : [108, 52]),
    parts: [tap(sh, hip, 70, 46),
      tap([hip[0] - 8, hip[1]], lKnee, 26, 19), tap(lKnee, lAnk, 19, 12), tap(rHip, rKnee, 26, 19), tap(rKnee, rAnk, 19, 12),
      tap([sh[0] - 26, sh[1] + 6], [sh[0] - 22, sh[1] + 36], 18, 13), tap([sh[0] - 22, sh[1] + 36], hands[0], 13, 10),
      tap([sh[0] + 26, sh[1] + 6], [sh[0] + 22, sh[1] + 36], 18, 13), tap([sh[0] + 22, sh[1] + 36], hands[1], 13, 10),
      delt([sh[0] - 28, sh[1] + 6], 12), delt([sh[0] + 28, sh[1] + 6], 12)],
    gear: floor() + dumbbell(bell, 0, 26, 8)
  });
};

// ---------- Bodyweight Squat (arms forward, sit down to parallel) ----------
const bodyweightSquat = finish => {
  const sh = finish ? [112, 134] : [106, 92], hip = finish ? [80, 214] : [108, 162], knee = finish ? [142, 206] : [110, 216], ank = finish ? [112, 262] : [110, 262];
  const elbow = finish ? [142, 140] : [136, 100], wrist = finish ? [168, 140] : [162, 102];
  return fig({
    ...head(finish ? [124, 112] : [108, 54]),
    parts: [...body({ sh, hip }), ...leg(hip, knee, ank, [134, 266]), ...arm(sh, elbow, wrist), delt(sh, 12)],
    gear: floor()
  });
};

// ---------- Wall Sit (back flat on the wall, thighs parallel) ----------
const wallSit = finish => {
  const sh = finish ? [66, 134] : [66, 92], hip = finish ? [66, 206] : [66, 162], knee = finish ? [136, 206] : [68, 216], ank = finish ? [138, 262] : [68, 262];
  const elbow = finish ? [92, 166] : [76, 128], wrist = finish ? [118, 194] : [80, 168];
  return fig({
    ...head(finish ? [66, 98] : [66, 54]),
    parts: [...body({ sh, hip, chest: 34, waist: 26 }), ...leg(hip, knee, ank, [158, 266], [26, 18, 11]), ...arm(sh, elbow, wrist), delt(sh, 12)],
    behind: rect(26, 20, 14, 250, 3),
    gear: floor()
  });
};

// ---------- Glute Bridge (on the floor, lift the hips) ----------
const gluteBridge = finish => {
  const sh = [50, 250], hip = finish ? [120, 206] : [118, 250], knee = [164, 216], ank = [172, 262];
  return fig({
    ...head([28, 252]),
    parts: [...body({ sh, hip, chest: 32, waist: 26 }), ...leg(hip, knee, ank, [194, 266], [26, 18, 11]), ...arm(sh, [82, 258], [112, 262]), delt(sh, 11)],
    gear: floor(268)
  });
};

// ---------- Cable Pull-through (facing away from a low cable) ----------
const cablePullThrough = finish => {
  const sh = finish ? [108, 92] : [150, 150], hip = finish ? [104, 160] : [96, 170], knee = finish ? [108, 216] : [100, 214], ank = finish ? [108, 262] : [104, 262];
  const wrist = finish ? [114, 172] : [106, 206], elbow = finish ? [112, 130] : [134, 186];
  return fig({
    ...head(finish ? [108, 54] : [172, 134]),
    parts: [...body({ sh, hip }), ...leg(hip, knee, ank, [130, 266]), ...arm(sh, elbow, wrist), delt(sh, 12)],
    behind: rect(10, 60, 14, 210, 3) + circle([17, 250], 7),
    gear: floor() + cable([17, 250], wrist) + hand(wrist, 5)
  });
};

// ---------- Cable Glute Kickback (lean on the frame, kick one leg straight back) ----------
const cableGluteKickback = finish => {
  const sh = [140, 112], hip = [112, 172], knee = [118, 218], ank = [118, 262];
  const wKnee = finish ? [78, 208] : [106, 220], wAnk = finish ? [44, 232] : [98, 262];
  return fig({
    ...head([158, 92]),
    parts: [...body({ sh, hip }), ...leg(hip, knee, ank, [138, 266]), ...chain([hip, wKnee, wAnk], [26, 18, 11]), ...arm(sh, [166, 118], [190, 126]), delt(sh, 12)],
    behind: line([190, 70], [190, 270], 5),
    gear: floor() + cable([20, 262], wAnk) + hand([190, 126], 5)
  });
};

// ---------- Cable Hip Abduction (front view, ankle strap, leg out to the side) ----------
const cableHipAbduction = finish => {
  const hip = [108, 172];
  const rKnee = finish ? [148, 218] : [124, 222], rAnk = finish ? [170, 254] : [126, 262];
  return fig({
    ...head([108, 52]),
    parts: [tap([108, 92], hip, 70, 46),
      tap([94, 176], [92, 222], 26, 19), tap([92, 222], [90, 262], 19, 12), tap([122, 176], rKnee, 26, 19), tap(rKnee, rAnk, 19, 12),
      tap([78, 98], [72, 134], 18, 13), tap([72, 134], [92, 168], 13, 10), tap([138, 98], [144, 134], 18, 13), tap([144, 134], [124, 168], 13, 10),
      delt([78, 98], 12), delt([138, 98], 12)],
    behind: rect(196, 60, 14, 210, 3),
    gear: floor() + cable([203, 262], rAnk)
  });
};

// ---------- Kettlebell Swing (hinge, snap the hips) ----------
const kettlebellSwing = finish => {
  const sh = finish ? [106, 92] : [150, 128], hip = finish ? [106, 160] : [92, 172], knee = finish ? [108, 216] : [100, 216], ank = finish ? [108, 262] : [104, 262];
  const wrist = finish ? [170, 98] : [112, 198], elbow = finish ? [140, 96] : [132, 168];
  const bell = finish ? [184, 102] : [112, 212];
  return fig({
    ...head(finish ? [108, 54] : [172, 110]),
    parts: [...body({ sh, hip }), ...leg(hip, knee, ank, [130, 266]), ...arm(sh, elbow, wrist), delt(sh, 12)],
    gear: floor() + circle(bell, 12) + line([bell[0] - 7, bell[1] - 10], [bell[0] + 7, bell[1] - 10], 4) + hand(wrist, 5)
  });
};

// ---------- Donkey Kick (on hands and knees, kick one leg back and up) ----------
const donkeyKick = finish => {
  const sh = [150, 196], hip = [92, 198];
  const wKnee = finish ? [52, 200] : [96, 262], wAnk = finish ? [52, 152] : [56, 264];
  return fig({
    ...head([180, 184]),
    parts: [...body({ sh, hip, chest: 32, waist: 26 }), tap(hip, [96, 262], 26, 18), tap([96, 262], [52, 264], 18, 11), ...chain([hip, wKnee, wAnk], [26, 18, 11]), ...arm(sh, [152, 232], [152, 262]), delt(sh, 11)],
    gear: floor(268) + hand([152, 262], 5)
  });
};

// ---------- Sit-up (lie back, curl up to sitting) ----------
const sitUp = finish => {
  const sh = finish ? [132, 178] : [56, 252], hip = finish ? [118, 254] : [124, 254], knee = [168, 214], ank = [176, 262];
  const elbow = finish ? [152, 206] : [78, 244], wrist = finish ? [166, 212] : [98, 238];
  return fig({
    ...head(finish ? [142, 154] : [32, 252]),
    parts: [...body({ sh, hip, chest: 32, waist: 26 }), ...leg(hip, knee, ank, [196, 266], [26, 18, 11]), ...arm(sh, elbow, wrist), delt(sh, 11)],
    gear: floor(268)
  });
};

// ---------- Reverse Crunch (curl the hips up toward the chest) ----------
const reverseCrunch = finish => {
  const sh = [54, 250], hip = finish ? [112, 236] : [116, 252], knee = finish ? [138, 184] : [128, 200], ank = finish ? [176, 192] : [170, 196];
  return fig({
    ...head([30, 252]),
    parts: [...body({ sh, hip, chest: 32, waist: 26 }), ...chain([hip, knee, ank], [26, 18, 11]), ...arm(sh, [84, 258], [112, 262]), delt(sh, 11)],
    gear: floor(268)
  });
};

// ---------- Bicycle Crunch (elbow to the opposite knee, pedalling) ----------
const bicycleCrunch = finish => {
  const sh = [76, 228], hip = [122, 252];
  const bent = finish ? [[136, 252], [176, 252]] : [[134, 208], [166, 222]], straight = finish ? [[134, 208], [166, 222]] : [[166, 238], [206, 252]];
  const elbow = [60, 196], wrist = [80, 198];
  return fig({
    ...head([56, 206]),
    parts: [...body({ sh, hip, chest: 32, waist: 26 }), ...chain([hip, bent[0], bent[1]], [26, 18, 11]), ...chain([hip, straight[0], straight[1]], [26, 18, 11]), ...arm(sh, elbow, wrist), delt(sh, 11)],
    gear: floor(268)
  });
};

// ---------- V-up (reach for the toes, body folds into a V) ----------
const vUp = finish => {
  const sh = finish ? [100, 186] : [52, 254], hip = finish ? [118, 254] : [120, 256], knee = finish ? [156, 210] : [158, 258], ank = finish ? [190, 168] : [198, 260];
  const elbow = finish ? [140, 184] : [30, 258], wrist = finish ? [176, 178] : [10, 262];
  return fig({
    ...head(finish ? [88, 160] : [28, 250]),
    parts: [...body({ sh, hip, chest: 32, waist: 26 }), ...chain([hip, knee, ank], [26, 18, 11]), ...arm(sh, elbow, wrist), delt(sh, 11)],
    gear: floor(268)
  });
};

// ---------- Mountain Climber (high plank, drive the knees in turn) ----------
const mountainClimber = finish => {
  const sh = [150, 198], hip = [94, 218];
  const fwd = finish ? [[66, 236], [38, 254]] : [[132, 214], [112, 246]], back = finish ? [[132, 214], [112, 246]] : [[66, 236], [38, 254]];
  return fig({
    ...head([176, 184]),
    parts: [...body({ sh, hip, chest: 32, waist: 24 }), ...chain([hip, fwd[0], fwd[1]], [24, 17, 11]), ...chain([hip, back[0], back[1]], [24, 17, 11]), ...arm(sh, [152, 232], [152, 262]), delt(sh, 11)],
    gear: floor(268) + hand([152, 262], 5)
  });
};

// ---------- Dead Bug (on the back, lower the opposite arm and leg) ----------
const deadBug = finish => {
  const sh = [52, 252], hip = [118, 252];
  const armA = [[52, 214], [52, 184]], legA = [[118, 206], [160, 206]];
  const armB = finish ? [[30, 250], [8, 254]] : [[52, 214], [52, 184]], legB = finish ? [[158, 236], [196, 252]] : [[118, 206], [160, 206]];
  return fig({
    ...head([28, 250]),
    parts: [...body({ sh, hip, chest: 32, waist: 26 }), ...chain([hip, ...legA], [26, 18, 11]), ...chain([hip, ...legB], [26, 18, 11]), ...chain([sh, ...armA], [18, 14, 10]), ...chain([sh, ...armB], [18, 14, 10]), delt(sh, 11)],
    gear: floor(268)
  });
};

// ---------- Cable Woodchop (front view, high to low across the body) ----------
const cableWoodchop = finish => {
  const H = finish ? [62, 196] : [156, 58];
  const sh = finish ? [112, 98] : [104, 92];
  return fig({
    ...head(finish ? [114, 56] : [106, 52]),
    parts: [tap(sh, [108, 172], 70, 46),
      tap([sh[0] - 28, sh[1] + 6], [(sh[0] - 28 + H[0]) / 2, (sh[1] + 6 + H[1]) / 2], 18, 13), tap([(sh[0] - 28 + H[0]) / 2, (sh[1] + 6 + H[1]) / 2], H, 13, 10),
      tap([sh[0] + 28, sh[1] + 6], [(sh[0] + 28 + H[0]) / 2, (sh[1] + 6 + H[1]) / 2], 18, 13), tap([(sh[0] + 28 + H[0]) / 2, (sh[1] + 6 + H[1]) / 2], H, 13, 10),
      delt([sh[0] - 28, sh[1] + 6], 12), delt([sh[0] + 28, sh[1] + 6], 12),
      tap([94, 176], [92, 222], 26, 19), tap([92, 222], [90, 262], 19, 12), tap([122, 176], [124, 222], 26, 19), tap([124, 222], [126, 262], 19, 12)],
    behind: rect(196, 30, 14, 240, 3) + circle([203, 52], 7),
    gear: floor() + cable([203, 52], H) + hand(H, 5)
  });
};

// ---------- Pallof Press (side-on to the cable, press out and resist the twist) ----------
const pallofPress = finish => {
  const sh = [106, 94], hip = [104, 162], knee = [108, 216], ank = [108, 262];
  const elbow = finish ? [140, 106] : [122, 126], wrist = finish ? [176, 108] : [130, 112];
  return fig({
    ...head([108, 56]),
    parts: [...body({ sh, hip }), ...leg(hip, knee, ank, [130, 266]), ...arm(sh, elbow, wrist), delt(sh, 12)],
    behind: rect(10, 40, 14, 230, 3) + circle([17, 108], 7),
    gear: floor() + cable([17, 108], wrist) + hand(wrist, 5)
  });
};

// ---------- Spider Curl (face down on an incline bench, arms hanging) ----------
const spiderCurl = finish => {
  const sh = [120, 164], hip = [74, 214], knee = [54, 240], ank = [38, 262];
  const elbow = [126, 200], wrist = finish ? [148, 178] : [128, 232];
  return fig({
    ...head([142, 144]),
    parts: [...body({ sh, hip, chest: 34, waist: 24 }), ...leg(hip, knee, ank, [26, 266], [26, 18, 11]), ...arm(sh, elbow, wrist), delt(sh, 12)],
    behind: poly([[56, 228], [68, 240], [138, 172], [126, 160], [56, 228]], true) + line([94, 206], [94, 270], 4) + line([122, 178], [134, 270], 4),
    gear: floor() + dumbbell(wrist, 0, 22, 8) + hand(wrist, 5)
  });
};

// ---------- Glute-Ham Raise (heels locked, hips on the pad, curl the body up) ----------
const gluteHamRaise = finish => {
  const hip = [104, 190], knee = [68, 196], ank = [34, 202];
  const sh = finish ? [150, 188] : [112, 236];
  return fig({
    ...head(finish ? [176, 184] : [114, 262]),
    parts: [...body({ sh, hip, chest: 34, waist: 26 }), ...chain([hip, knee, ank], [26, 18, 11]), ...arm(sh, finish ? [150, 212] : [118, 232], finish ? [136, 220] : [122, 246]), delt(sh, 11)],
    behind: rect(88, 172, 34, 28, 6) + line([105, 200], [105, 270], 4) + rect(10, 186, 14, 40, 3) + line([17, 226], [17, 270], 4),
    gear: floor()
  });
};

// ---------- Goblet Squat (one dumbbell held at the chest) ----------
const gobletSquat = finish => {
  const sh = finish ? [112, 138] : [106, 92], hip = finish ? [82, 212] : [108, 162], knee = finish ? [142, 208] : [110, 216], ank = finish ? [112, 262] : [110, 262];
  const elbow = finish ? [134, 158] : [126, 128], wrist = finish ? [138, 136] : [132, 106];
  return fig({
    ...head(finish ? [124, 116] : [108, 54]),
    parts: [...body({ sh, hip }), ...leg(hip, knee, ank, [134, 266]), ...arm(sh, elbow, wrist), delt(sh, 12)],
    gear: floor() + dumbbell([wrist[0] + 4, wrist[1] - 2], 90, 26, 8) + hand(wrist, 5)
  });
};

// ---------- Low Cable Crossover (front view, low pulleys, sweep the hands up and together) ----------
const lowCableCrossover = finish => {
  const L = finish ? { e: [84, 130], h: [100, 118] } : { e: [60, 152], h: [66, 206] };
  const R = finish ? { e: [132, 130], h: [116, 118] } : { e: [156, 152], h: [150, 206] };
  return fig({
    ...head([108, 52]),
    parts: [tap([108, 92], [108, 172], 72, 46),
      tap([78, 98], L.e, 18, 14), tap(L.e, L.h, 14, 10), tap([138, 98], R.e, 18, 14), tap(R.e, R.h, 14, 10),
      delt([78, 98], 12), delt([138, 98], 12),
      tap([94, 176], [92, 222], 26, 19), tap([92, 222], [90, 262], 19, 12), tap([122, 176], [124, 222], 26, 19), tap([124, 222], [126, 262], 19, 12)],
    behind: rect(4, 60, 14, 210, 3) + rect(198, 60, 14, 210, 3),
    gear: floor() + cable([11, 250], L.h) + cable([205, 250], R.h) + hand(L.h, 5) + hand(R.h, 5)
  });
};

// ---------- Single-leg Calf Raise (one foot on a step edge) ----------
const singleLegCalfRaise = finish => {
  const sh = [106, 92], hip = [108, 162], knee = [110, 212], ank = finish ? [110, 232] : [110, 246], toe = [134, 246];
  return fig({
    ...head([108, 54]),
    parts: [...body({ sh, hip }), ...leg(hip, knee, ank, toe, [28, 19, 12]), ...chain([hip, [88, 204], [70, 226]], [26, 18, 11]), ...arm(sh, [100, 130], [104, 166]), delt(sh, 12)],
    behind: rect(70, 246, 100, 24, 4),
    gear: floor()
  });
};

// ---------- Hanging Knee Raise (hang from a bar, bring the knees up) ----------
const hangingKneeRaise = finish => {
  const sh = [108, 76], hip = finish ? [102, 152] : [108, 152];
  const knee = finish ? [148, 166] : [110, 206], ank = finish ? [120, 206] : [110, 258];
  return fig({
    ...head([108, 50]),
    parts: [...body({ sh, hip, chest: 34, waist: 24 }), ...chain([hip, knee, ank], [24, 17, 11]), tap(ank, [ank[0] + 14, ank[1] + 4], 11, 8),
      ...arm(sh, [122, 54], [116, 28]), delt(sh, 12)],
    behind: line([56, 24], [160, 24], 5) + line([56, 24], [56, 270], 3) + line([160, 24], [160, 270], 3),
    gear: floor() + hand([116, 26], 5)
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
  "dumbbell-floor-press": { start: dumbbellFloorPress(true), end: dumbbellFloorPress(false) },
  "chest-supported-dumbbell-row": { start: chestSupportedRow(false), end: chestSupportedRow(true) },
  "machine-row": { start: machineRow(false), end: machineRow(true) },
  "side-lunge": { start: sideLunge(false), end: sideLunge(true) },
  "bodyweight-squat": { start: bodyweightSquat(false), end: bodyweightSquat(true) },
  "wall-sit": { start: wallSit(false), end: wallSit(true) },
  "glute-bridge": { start: gluteBridge(false), end: gluteBridge(true) },
  "cable-pull-through": { start: cablePullThrough(false), end: cablePullThrough(true) },
  "cable-glute-kickback": { start: cableGluteKickback(false), end: cableGluteKickback(true) },
  "cable-hip-abduction": { start: cableHipAbduction(false), end: cableHipAbduction(true) },
  "kettlebell-swing": { start: kettlebellSwing(false), end: kettlebellSwing(true) },
  "donkey-kick": { start: donkeyKick(false), end: donkeyKick(true) },
  "sit-up": { start: sitUp(false), end: sitUp(true) },
  "reverse-crunch": { start: reverseCrunch(false), end: reverseCrunch(true) },
  "bicycle-crunch": { start: bicycleCrunch(false), end: bicycleCrunch(true) },
  "v-up": { start: vUp(false), end: vUp(true) },
  "mountain-climber": { start: mountainClimber(false), end: mountainClimber(true) },
  "dead-bug": { start: deadBug(false), end: deadBug(true) },
  "cable-woodchop": { start: cableWoodchop(false), end: cableWoodchop(true) },
  "pallof-press": { start: pallofPress(false), end: pallofPress(true) },
  "spider-curl": { start: spiderCurl(false), end: spiderCurl(true) },
  "glute-ham-raise": { start: gluteHamRaise(false), end: gluteHamRaise(true) },
  "goblet-squat": { start: gobletSquat(false), end: gobletSquat(true) },
  "low-cable-crossover": { start: lowCableCrossover(false), end: lowCableCrossover(true) },
  "single-leg-calf-raise": { start: singleLegCalfRaise(false), end: singleLegCalfRaise(true) },
  "hanging-knee-raise": { start: hangingKneeRaise(false), end: hangingKneeRaise(true) }
};

// Contact sheet for looking at the drawings.
if (process.argv[2] === "--sheet") {
  const { writeFileSync } = await import("node:fs");
  let h = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#fff;color:#141a23;font:11px sans-serif}.exbg{fill:#fff}.exbg-s{stroke:#fff}svg{width:150px;height:208px;border:1px solid #ccc}div{display:inline-block;margin:3px}</style><body>`;
  for (const [k, d] of Object.entries(DRAWINGS)) h += `<div><b>${k}</b><br>${d.start}${d.end}</div>`;
  writeFileSync(process.argv[3], h);
}
