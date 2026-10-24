# Roadmap: remaining features, then V2 (decisions recorded 2026-10-24)

The owner answered the design questions for every feature below in one session. Each feature is built on its own branch: a short spec from these answers (the owner reviews it), a plan, native execution test-first, a final review, local testing by the owner, explicit "deploy" approval, then merge. If an answer turns out to be wrong when the spec is written, ask again; do not silently change a decision.

**Order:** 1 Bodyweight mode, 2 Injuries, 3 Deload suggestions, 4 Meal templates, 5 Challenge types + rematch, 6 CSV export, 7 Google Play release pack, then 8 **V2** (the final major task).

**Left out on purpose:** several gyms (Home + Gym), per-day targets, automatic planned deloads, allergens, chat, notifications, food CSV.

## 1. Bodyweight mode
- **Detection:** automatic from the library (exercises that need no weights, e.g. push-up, pull-up, dip, plank, bodyweight lunges, start as bodyweight) plus a per-exercise switch on the exercise card that flips any exercise, including custom typed ones, either way.
- **Weight box = extra kg**, 0 by default, negative for assisted machines (assisted pull-up). Reps are the main number.
- **Progression advice:** raise reps first (aim for the top of the target range), then suggest adding 2.5 kg extra once the top is reached.
- Open for the spec: how reps-only PRs/volume/e1RM/strength-ratio badges are counted (a 0 kg set has no e1RM and no kg volume; likely "best reps" for PRs). Must work with set types (warm-up / drop) and `progression.js`.

## 2. Injuries / exercises to avoid
- **Marking:** body areas (shoulder, elbow, wrist, lower back, hip, knee, ankle) plus hiding single exercises. Every library exercise (183) is tagged with the joints it loads (Claude tags, the owner reviews the table).
- **Effect:** avoided exercises disappear from suggestions, the Add exercise list, type-ahead and the generated training week (journey). Exercises already in days or history stay with a clear warning mark; nothing is ever deleted; a "show anyway" switch exists. No automatic swap.

## 3. Deload suggestions
- A banner on Today suggests an easy week after 6 weeks of training in a row, or when several lifts stall. One tap to accept.
- Accepting turns on "Deload week" for 7 days: the advice says to use about 90% of last weight for about 60% of the sets; nothing is blocked. It can be ended any time; dismissing the suggestion silences it for 4 weeks.
- Skipped: per-day targets, automatic planned deloads.

## 4. Meal templates
- In the meal sheet, a "Save as my meal" button on any meal with foods (name required). "My meals" chips next to Recent: one tap fills the tray with that meal's foods (amounts editable); edit or delete in the same place. Up to 50 saved meals. No toast prompting after saving a meal.
- Storage is the spec's decision (a private document under `users/{uid}/items/`, carried by snapshot parser, save function, backup export and `cleanBackupItems`, like `foods`; `wipePlan` already deletes every item).

## 5. More challenge types + rematch
- **Types:** total volume (kg, normal + drop sets, warm-ups excluded), personal records, workouts count, food-logging days (counts days only, never calories or food), plus the existing training days. All self-reported like today's score.
- **Rematch:** anyone in a finished challenge can propose it; it becomes that person's challenge with the same type and length, and they invite the others (who accept again). Starting Today or next Saturday.
- Needs rules + rules tests (new score field/type), `challenges.js` plans, privacy policy mention if a new kind of number is shared.

## 6. CSV export
- Three files from History & backup: **workouts** (one row per set: date, day, exercise, set number, kg, reps, set type, time), **body measurements** (every measurement and InBody value), **cardio sessions** (date, type, minutes, intensity, kcal). No food file. UTF-8 with BOM so Excel opens Arabic correctly.

## 7. Google Play release pack
- Listing text in English and Arabic, the Data safety form answers, the account-deletion web page (Play requires it), the signed `.aab` build, the assetlinks fingerprint step (add Play's app-signing fingerprint) and a screenshot checklist. The owner creates the developer account ($25) and presses upload; Claude guides the rest. Android signing key is at `C:/Android/keys/ironlog.keystore` (backed up by the owner).

## 8. V2 (final major task)
A V2 of the whole application: the same features and data, with a new UI that fits the system architecture as it stands after features 1-7.
- **Scope (decided):** new look **and** new screen flows where the architecture now allows (for example a proper workout flow, one place for settings, food and training sharing the same patterns). Same Firestore data, **no data migration**.
- **Rollout (decided):** build it at a preview address first (for example `/v2`, same login and data, V1 keeps working), test on the owner's phone, then switch it in at the main address; the Android app picks it up automatically.
- **Code structure (not decided):** split into modules with no build step, or a small framework with a build step. Decide in the V2 brainstorm with the final feature set in front of us.
- Start with its own brainstorm, spec and plan (visual direction, navigation, screen inventory, component toolkit, test strategy, how to keep `npm test`, tests-ui and tests-rules meaningful).
