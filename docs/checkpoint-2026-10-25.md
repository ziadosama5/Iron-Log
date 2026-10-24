# Checkpoint: 2026-10-25

Where the project stands at the end of this session, and exactly how to continue. Read this first, then `CLAUDE.md` (architecture), `docs/roadmap-v1-features.md` (the owner's recorded decisions for every remaining feature) and `docs/open-points.md`.

## State
- Live: https://gym-logger-85d4c.web.app, service worker `iron-log-v47`. `main` has everything; the owner pushes to GitHub himself (`! git push`, it asks for a login).
- Tests at this point: `npm test` 482 unit tests; `tests-ui` 123 (Playwright on Edge against the stubbed-Firebase harness, ~2.5 min, one copy at a time, port 5083); `tests-rules` 56 (Firebase emulator, JDK 21 on PATH, only needed when `firestore.rules` changes).
- Working tree clean, no open branches.

## Built since the food table (all deployed)
| version | what | spec / plan |
|---|---|---|
| v40 | small cleanups | |
| v41 | food table (297 foods), meal builder, My foods, recents, barcode scan | sub-project 19 |
| v42 | 24 small fixes (barcode, profiles, friends, challenges, accessibility, wording) + a rules change | |
| v43 | calorie-target explainer (breakdown sheet, activity level, own daily adjustment) | sub-project 20 |
| v44 | set types (warm-up / drop), per-exercise targets, "what to try today" advice | sub-project 21 |
| v45 | bodyweight mode (extra kg, assisted, holds in seconds, per-exercise switch) | sub-project 22 |
| v46 | injuries / exercises to avoid (7 body areas, joint table for 183 exercises) + Plan my training remembers its answers | sub-project 23 |
| v47 | deload suggestions (banner, 7-day deload week, lighter advice, deload sessions kept out of Last time and stalls) | sub-project 24 |

Every sub-project has `docs/superpowers/specs/<date>-<name>-design.md` and `docs/superpowers/plans/<date>-<name>.md`; `docs/README.md` indexes them.

## What is next (owner decisions already recorded in `docs/roadmap-v1-features.md`)
1. **Meal templates**: "Save as my meal" in the meal sheet on any meal with foods (name required); "My meals" chips next to Recent, one tap fills the tray (amounts editable), edit/delete there, up to 50, no prompt toast after saving a meal. Storage is the spec's call (a private document under `users/{uid}/items/`, carried by the snapshot parser, save function, backup export and `cleanBackupItems`, like `foods`).
2. **More challenge types + rematch**: volume (kg, normal + drop sets, no warm-ups), PRs, workouts count, food-logging days (days only, never calories); rematch can be proposed by anyone in a finished challenge (it becomes that person's challenge, same type/length, they invite the others). Needs `firestore.rules` + rules tests, `challenges.js` plans, privacy-policy check.
3. **CSV export**: workouts (one row per set: date, day, exercise, set number, kg, reps, set type, time), body measurements, cardio sessions. No food file. UTF-8 with BOM.
4. **Google Play release pack**: EN/AR listing text, Data safety answers, account-deletion web page, signed `.aab`, assetlinks fingerprint step, screenshot checklist. The owner creates the developer account ($25) and uploads.
5. **V2** (final major task): new look **and** new screen flows, same Firestore data (no migration), built first at a preview path (e.g. `/v2`), then switched in. Whether the code becomes modules without a build or a small framework with a build is decided in V2's own brainstorm. Start it with brainstorm, spec, plan.

Left out on purpose: several gyms, per-day targets, planned deloads, allergens, chat, notifications, food CSV.

## Owner's open items
- Review the food figures in `public/food-table.js` (74 `varies:true` dishes first).
- Real-phone check of the barcode camera (browser and Android app).
- Decide whether the Shoulder / Elbow joint tags in `public/injuries.js` should be gentler (each hides 84 of 183 exercises); the review list is `docs/injury-tags.md` (regenerate with `node tools/injury-review.mjs`).
- Deferred minors: `docs/open-points.md` (sections B, B3) plus the "deferred minors" listed in each feature's final report (e.g. Start-deload after training today flags that session; the info sheet scrolls to the top after Avoid; Arabic dual/11+ forms for new counts).

## How a feature is run here (the process the owner expects)
1. Spec from the recorded answers (new branch `<feature>`, commit the spec) → owner reviews.
2. Plan (`docs/superpowers/plans/`, tasks with exact interfaces, a Review Focus list) → owner reviews and says **native**; they may say to run the tasks automatically.
3. Execute task by task, **test first and watch it fail**, commit per task, keep a ledger in `.superpowers/sdd/<plan>/progress.md` (git-ignored; scripts `sdd-workspace` and `review-package` live in the superpowers plugin `skills/subagent-driven-development/scripts`).
4. Ask "start the final review?", then one fresh Opus whole-branch review (Agent tool, `model: opus`) with the diff package; fix every Critical/Important finding test-first, cheap Minors too, ledger the rest.
5. Owner says "lets see the results localy first": `firebase serve --only hosting --port 5000`, give a test checklist.
6. Owner says "deploy": `firebase deploy --only hosting` (rules first if they changed; run `tests-rules` then), verify the live site with cache-busting curls (`sw.js?x=<time>`), merge `--ff-only` into `main`, delete the branch, update memory and docs.

## Gotchas learned (keep these)
- **Never put regexes, `\b`, `\n` or other backslashes in shell heredocs or in patch-script string literals**: they get eaten or turn into control characters (a backspace character ended up in source three times). Use the Write/Edit tools, or a Node patch script written with the Write tool whose strings have no backslashes. Check with `grep -c $'\x08' <files>`.
- Files are CRLF in git (autocrlf, harmless `LF will be replaced by CRLF` warnings). Edits must tolerate both.
- Playwright `innerText` is CSS-uppercased for labels: use `textContent`.
- Test harness options (`tools/screenshot-harness/stubs/fb.js`): `gym`, `avoid`, `bw=1|2|3`, `deload=<json>`, `deloadwk=1`, `streak=N`, `stalled=1`, `plan=<json>`, `fresh=1|2`, `friends`, `ch`, `mine`, `cele`, `lang=ar`. The harness database resets on page reload.
- Final reviews found real bugs on every feature (history of one exercise mixing kinds, flags lost on re-save, settings races, privacy wording): always run them.
- The round-trip rule: a new field must be carried by the snapshot parser, the save function, `settingsDoc`/`cleanSettings` or the explicit workout body in `store.save`/`cleanWorkout`, and the backup export, or it is silently dropped.
