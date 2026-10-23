# Iron Log: project context

Gym logger web app (installable PWA) built for Ziad (Cairo, Egypt) and shared with other people.
Each person signs in with Google and logs their own workouts, body measurements and InBody scans.
Live at **https://gym-logger-85d4c.web.app** (Firebase project `gym-logger-85d4c`, free Spark plan).

## How the pieces fit together (read this first)
One page, one `state` object, one `store`. Everything below is wired through them, so a change in one place usually has a counterpart elsewhere:
- **Sign-in → store.init:** `onAuthStateChanged` loads the private items (`onSnapshot` on `users/{uid}/items`), then `loadShare` (my `profiles/{uid}`), `watchFriends` (friendships + blocks) and `watchChallenges`. Each snapshot rebuilds `state`, then `render()`; the data callback also runs the **publishers** and one-time starters (`checkBadges`, `maybePublish`, `refreshFriendNames`, `maybeStartJourney`, `publishProgress`). Sign-out resets every part of `state`.
- **Private vs shared:** private data lives only in `users/{uid}/items/*` (owner-only rules). Anything other people see is *derived on the phone and published by its owner*: the progress **summary** (`profiles/{uid}.summary`, only for Friends/Public), the **challenge score** (`challenges/{cid}/progress/{uid}`, a day count). Social documents (`profiles`, `usernames`, `emails`, `friendships`, `blocks`, `challenges`, `reports`) are never listed, only fetched by exact id or by an `array-contains me` query; `firestore.rules` + `tests-rules/` are the security boundary, the client is only convenience.
- **Settings round trip:** the `settings` document is written ONLY through `settingsDoc()` (ui-helpers.js); a field must be carried in the snapshot parser, `store.saveSettings`, `settingsDoc` and `cleanSettings` (backup) or it is silently dropped (this bit My Gym once).
- **Writes go through plans:** pure `plan*` functions (social.js, friends.js, challenges.js) return `{ops:[{op,path,data}]}`; `store.saveShare/friendAction/challengeAction` run them in one `writeBatch`. Every failure shows the same message (a block is never revealed). Writes need a connection (`navigator.onLine`).
- **Delete my account** (`store.wipeAccount`) must know about every collection above (`wipePlan` in safety.js): add a step whenever a new top-level collection or per-user data appears, add it to the privacy policy (`privacy.html`, English + Arabic) and keep `store.wiping` guarding every background writer.
- **Journey, My Gym, Coach, Days** share data: the journey writes `program` (days), `profile` and `settings.gym`; My Gym's `settings.gym` filters suggestions everywhere (`gymFilter`, never hides what is already in days/history); training days feed streaks, XP, badges, the shared summary and challenge scores through one rule (`trainedOn`).
- **Language and offline:** every visible string needs an Arabic entry (`npm test` fails otherwise); every new `public/*.js` or page goes into `APP_SHELL` in sw.js and the `VERSION` is bumped on each deploy.

## Android app (TWA, shipped 2026-10-23)
- Thin Android shell around the live site (`android/`, package `app.ironlog`, Bubblewrap). Same web code: every hosting deploy updates every installed app; only icon/name/package changes need a new APK. Spec: `docs/superpowers/specs/2026-10-20-android-apk-design.md`.
- Google sign-in uses `authDomain = gym-logger-85d4c.web.app` (the OAuth client lists `https://gym-logger-85d4c.web.app/__/auth/handler`). `public/.well-known/assetlinks.json` (SHA-256 of the signing key) removes the URL bar; Android checks it at install time.
- Distribution: the signed APK is a **GitHub Release asset** named `iron-log.apk` (repo is public); `public/app.html` (EN/AR) links to `.../releases/latest/download/iron-log.apk`. Firebase Spark forbids hosting `.apk` files, so never put one in `public/`. New release: build with Bubblewrap (bump `appVersionCode`), publish a release with the file named `iron-log.apk`.
- Signing key `C:/Android/keys/ironlog.keystore` (never in the repo; losing it = no more updates under this package id). Tools in `C:/Android` (JDK 17, SDK, Bubblewrap; `env.ps1`).
- Google Play later: upload the `.aab`, add Play's fingerprint to assetlinks, Data safety form, account-deletion web page, $25 fee.

## Stack
- **No build step, no framework.** One page: `public/index.html` (HTML + CSS + one `<script type="module">`), plain JS.
- **Firebase JS SDK 10.12.2**, ES modules from `https://www.gstatic.com/firebasejs/10.12.2/...`
  - Auth: Google sign-in (`signInWithPopup`, falls back to `signInWithRedirect` when popups are blocked)
  - Firestore with `persistentLocalCache` + `persistentMultipleTabManager`, so it works offline and syncs later
- **Firebase Hosting** serves `public/`. **Service worker** `public/sw.js` caches the app shell for offline opening.
- Fonts: Google Fonts (Barlow Condensed for display, IBM Plex Sans for body, JetBrains Mono for numbers).

## Files
```
public/index.html           whole app (UI, logic, storage layer)
public/exercise-library.js  EQUIPMENT (39 ids), EXERCISES (183: name, muscle group, required equipment), LIB/MUSCLES/ALL_EX derived from them, equipmentOf(name), exercisesFor(gym), TEMPLATES, muscleOf/fillFocus/migrateProgram, ALIASES (empty). Unit-tested
public/exercise-info.js     GENERATED by tools/import-exercises.mjs: INFO + infoFor(name) (muscles, tips, has-drawing). Don't edit by hand
public/exercises/           recolored Everkinetic drawings <slug>-start.svg / -end.svg (CC BY-SA 4.0, see LICENSE.md there)
tools/exercise-sources.json source of truth for exercise info: {ek id | draw | drawing (reuse another exercise's figure), start pose, primary, secondary, tips, ar.tips}
tools/import-exercises.mjs  dev script: downloads + recolors drawings, writes exercise-info.js (`node tools/import-exercises.mjs`)
tools/draw-lib.mjs         helpers for hand-drawn figures (tapered capsules = slightly muscular body, equipment shapes)
tools/draw-exercises.mjs   DRAWINGS: hand-drawn start/finish figures for the 14 exercises Everkinetic lacks (`"draw": true` in exercise-sources.json; the importer writes them). `node tools/draw-exercises.mjs --sheet out.html` makes a contact sheet
tools/find-drawing.mjs     `node tools/find-drawing.mjs "leg curl"` finds Everkinetic drawings (and whether the files exist)
tools/screenshot-harness/  dev only: runs the real page with stubbed Firebase for screenshots and write-order checks (README inside)
tools/svg-tools.mjs         helpers for the import script (recolor, clean SVG). Unit-tested
public/achievements.js      streaks, 24 badges (BADGES, earned dates by replaying history), XP/levels, goalProgress. Unit-tested
public/nav.js               the five tabs and section pills: TABS, PILL_LABEL, tabOf(view), pillsFor(tab), migrateView(saved), neighborTab(tab, dir), swipeDirection({dx,dy,startX,width,rtl}). Pure, unit-tested
public/badge-art.js         the 24 badges grouped into 9 levelling families: FAMILIES, familyState (level, tier locked/bronze/silver/gold, next badge, pct), allFamilies, closestFamily, ICONS (path data). Pure, unit-tested; nothing stored
public/celebrate.js         buildCards (badge/level/win celebration cards in order), newWins. Pure, unit-tested
public/energy.js            daily calories: weightOn, bmrFor, baselineBurn, liftMinutes/liftKcal, cardioKcal (MET table), exerciseKcal, dayEnergy. Unit-tested
public/ui-helpers.js        themeAttr, sortTips (warn→info→good), withWeight (quick weight keeps other fields), daysSince (whole calendar days, never negative; the backup age). Unit-tested
public/theme-tools.js      accent colours: PRESETS (8), parseHex, contrast, ensureContrast, deriveAccent(setting, mode, surface, bg) → {accent, ink, soft}. Unit-tested
public/plan-tools.js         personal journey: buildPlan({goal,daysPerWeek,experience,gym,splitId?}) → {split,days,notes} (two splits per days/week, `splitOptions(days, experience)` lists them default-first, movement-family de-duplication, gym filter), movementFamily, GOAL_DEFAULT_DAYS, EXPERIENCE, shouldAutoJourney, needsAbout, checkProfile, mergeProfile. Pure, unit-tested (exhaustive over goal × days × experience × gym preset)
public/challenges.js       training-days challenges: weekStart/nextSaturday/challengeDates, statusOf, dayNumber, countDays, rankMembers, winners, write plans (planCreate/Accept/Leave/Delete/Progress). Pure, unit-tested
public/safety.js            REPORT_REASONS, reportId, buildReport (report documents), chunk (batching), wipePlan (the Delete-my-account steps). Pure, unit-tested
public/privacy.html, public/terms.html  standalone Privacy Policy and Terms of Use, English + Arabic blocks (language from `ironlog.lang`), contact ziadosamaabdo@gmail.com. Offline-cached; keep them true to what the app does (tests/pages.test.js checks key statements)
public/social.js            profiles/privacy/search helpers: validUsername, normalizeEmail, buildSummary (the shared progress summary), planShare (exact write batch), shouldPublish, lookupResult. Unit-tested
public/overview.js         Progress Overview series: weeklyCounts, weightSeries/weightChange, caloriesWeek, topLifts, prsThisMonth. Pure, unit-tested
public/friends.js          friends: pairId, write plans (planRequest/Accept/Remove/Block/Unblock/NameRefresh), groupFriendships, relationTo, compareSummaries. Pure, unit-tested
public/i18n.js             English/Arabic layer: t(text,{params}), tn(one,other,n), nameOf(kind,name), trDom(root) (swaps plain labels + isolates numbers in Arabic), withLang, detectLang. Unit-tested
public/lang-ar.js          AR = {ui: English text → Arabic, names: ex/muscle/template/tplnote/day/badge/cardio/intensity/goal/weekday/meal/level}
tools/scan-strings.mjs     finds user-visible English text in the source for tests/lang-coverage.test.js (dev/test only). Unit-tested
public/backup.js            cleanBackupItems(): validates/cleans every item of a backup file before restore. Unit-tested
public/workout-tools.js     pure helpers (rest defaults/timer math, set prefill, wake lock). No DOM/Firebase; unit-tested
public/firebase-config.js   `export const firebaseConfig = {...}`. MUST keep the `export` keyword
public/sw.js                offline cache. Bump VERSION ("iron-log-vN") on EVERY deploy that changes files
public/manifest.webmanifest PWA manifest
public/logo-mark.svg, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
firestore.rules             users/{uid}/items/{itemId}: only that signed-in user can read/write; profiles/usernames/emails: sharing (see below). No listing anywhere
tests-ui/                   UI smoke tests (Playwright on Edge/Chrome against the screenshot harness: tabs, pills, Back, swipe, Arabic, all badges, week picker, meals, 44px targets and 12px text). Own package.json: `cd tests-ui && npm install && npm test`; NOT part of `npm test`
tests-rules/                security-rules tests in the Firebase emulator (own package.json, needs Java 21+; run `cd tests-rules && npm install && npm test` whenever the rules change; NOT part of `npm test`)
firebase.json               hosting (no-cache headers on html/js, manifest content type) + rules path
.firebaserc                 links folder to project gym-logger-85d4c
README.md                   overview, folder map, setup/deploy guide for a fresh Firebase project
brand/                      logo source files (PNG/SVG, white variants, 1024 mark). Not served
tests/*.test.js             unit tests: `npm test` (Node built-in runner, runs only tests/, no dependencies)
package.json                only `"type":"module"` + the test script; nothing to install
docs/README.md              index of sub-projects with links to each spec + plan
docs/superpowers/           design specs and implementation plans
```

## Data model (Firestore)
Everything for one user lives in **`users/{uid}/items/{id}`**. One collection, partitioned by doc id:

| doc id | content |
|---|---|
| `w-YYYY-MM-DD` | workout: `{date, dayId, dayName, entries:[{ex, sets:[{w,r,t?}], done?}], cardio?:[{id,type,min,intensity,kcal|null}], updated}` (w = kg, r = reps, t = ms when logged; cardio type treadmill/elliptical/bike/other, kcal null = estimate). Cardio-only day: `dayName:"Cardio"`, `entries:[]` |
| `f-YYYY-MM-DD` | food: `{date, meals:[{id, name|null, kcal, protein|null}], updated}`. Deleted when the last meal is removed |
| `b-YYYY-MM-DD` | body entry: `{date, weight, waist, chest, hips, neck, arm, thigh, calf, smm, bfm, pbf, vfl, bmr, tbw, score, updated}` (all optional numbers) |
| `program` | training days: `{days:[{id, name, focus:[muscle], exercises:[name], weekdays:[0-6]}], v, updated}`. `v:2` = focus tags were auto-filled from exercises once (`migrateProgram`); never re-run, so removed tags stay removed |
| `profile` | `{sex:"male"/"female", height (cm), birthYear, goal, goalWeight?, goalStart?}` (target weight kg; goalStart resets when the target changes) goal in fat-loss, muscle, recomp, strength, maintain |
| `settings` | `{rest:{"<exercise>": seconds}, seenBadges?:[badge ids], updated}` (seenBadges undefined = first run; saveSettings merges) per-exercise rest length, written when ±15s is tapped (debounced) |

**Sharing (top-level collections, all in firestore.rules; none can be listed, only fetched by exact id):**

| path | content |
|---|---|
| `profiles/{uid}` | what the person chose to share: `{username, displayName, visibility: private/friends/public, findByEmail, summary?, updated}`. `summary` (only when friends/public): `{level, xp, title, badges, streakWeeks, foodDays, workoutsWeek, workouts30, workoutsTotal, volumeWeekKg, prs30, lastWorkout, updated}` built on the phone by `buildSummary` (never body data, meals or single workouts). NOT the same as `users/{uid}/items/profile` (private body profile) |
| `usernames/{name}` | `{uid, updated}`: exact-name lookup. Name = 3–20 of a-z 0-9 _ . (no leading/trailing . or _, no `..`, not reserved). Claimed in one batch together with the profile; one name per person (a rename deletes the old one in the same batch); the profile and its name doc can only be deleted together |
| `emails/{email}` | `{uid}`: opt-in exact e-mail lookup; id = the person's own verified e-mail, lower-case |
| `friendships/{smallerUid_largerUid}` | `{users:[a,b] (sorted), requester, status: pending/accepted, names:{uid:username}, updated}`. Created by the requester (pending; names checked against profile/usernames), accepted by the other person, deleted by either (decline, cancel, remove). Readable only by the two people (query `where users array-contains me`) |
| `challenges/{cid}` | `{owner, members:[uid] (owner first, 2–6), joined:[uid], names:{uid:username}, start, weeks:1/2/4, end, updated}`. Only members read it (query `members array-contains me`); only the owner creates it (invitees must be accepted friends) and deletes it; an invited member can accept (add self to `joined`) or leave (remove self from both lists), nothing else may change |
| `challenges/{cid}/progress/{uid}` | `{days (0..weeks*7), updated}`: my own score, written only by me while I am in `joined`; readable by joined members; deletable by me or the owner |
| `reports/{reporter_reported}` | `{reporter, reported, reason: name/harassment/spam/other, username, updated}`: write-only (create/update by the reporter for their own pair; no get/list/delete for anyone). The owner reads them in the Firebase console. Kept when the reporter deletes their account |
| `blocks/{blocker_blocked}` | `{blocker, blocked, name?, updated}`: only the blocker can read/delete it; a blocked person cannot create a request. Blocking = set this + delete the friendship in one batch |

- Visibility: only the owner reads a `private` or `friends` profile; any signed-in user reads a `public` one, accepted friends read a `friends` one (rules: `areFriends`). New users publish nothing until they pick a username (More › Profile and privacy). The app republishes the summary ~20 s after data changes (`maybePublish`, server snapshots only, skipped when unchanged).
- Find a friend (now on the Friends screen): `store.lookup` → exact username or e-mail → uid → profile. A username whose profile is unreadable still gives a bare `@username` card (request can be sent); e-mail search and missing names show "No one found".

- Only ids starting `w-` are read as workouts; any other unknown id is ignored.
- The running rest timer lives in localStorage `ironlog.rest` (`{ex, endsAt, total}`), not Firestore.

- One workout per calendar date. `weekdays` uses JS `getDay()` numbers (0 = Sun); the UI shows Saturday first (Egypt).
- **Firestore rejects `undefined` values.** Use `null` or omit the field.
- Free quota: 20k writes/day. Every set logged = 1 write (whole workout doc is rewritten).

## index.html structure (search for these section comments)
- `LIB`, `TEMPLATES` (PPL, Upper/Lower, Full Body, Bro Split) are imported from `exercise-library.js`; a test checks every template day is tagged with each exercise's muscle group
- `state` object: `workouts, days, body, profile, view, date, bdate, openEx, editDay, pickSplit, confirmTpl, authed, ...`
- `/* ---------- storage: Firebase Auth + Firestore ... */`: `store` with `init, write, save, remove, saveDays, saveBody, removeBody, saveProfile, restore`. One `onSnapshot` on the collection rebuilds state, then `render()`.
- Navigation (since the redesign, sw v26): a floating dark pill `.tabbar` with five tabs, **Today · Plan · Progress · Friends · Me** (`nav.js`). `state.view` is still the id of a screen (`log`, `days`, `gym`, `body`, `progress` (Lifts), `goals`, `coach`, `history`, `friends`, `challenges`, `find`, `profile`, plus full-screen `journey`/`delete`); `tabOf(view)` says which tab it belongs to. Today = view `log`, Me = view `profile`. A tab with several screens shows section **pills** at the top (`#pills`, drawn by `renderPills`): Plan = Days · My Gym; Progress = Body · Lifts · Goals · Coach · History; Friends = Friends · Challenges · Find. `state.tabView` remembers the last section per tab; `ironlog.view` is restored through `migrateView`. There is no More sheet: **Me** holds Appearance (Language `ironlog.lang`, Accent `ironlog.accent`, Theme `ironlog.theme`, each applied by a tiny `<head>` script before first paint), History & backup, the profile and privacy cards, Privacy Policy, Terms, Delete my account and Sign out. Header = logo + screen title + sync status. The Friends tab shows a dot (and the Friends/Challenges pills a count) for waiting friend requests plus challenge invites.
- Sheets (`dialog.sheet`): `#exinfo`, `#moresheet`, `#exsheet` (+ Exercise), `#cardiosheet` (+ Cardio). Each pushes a history entry; its popstate handler closes it only when its own step was left (sheets can stack).
- Views (each has a `render*()` writing `innerHTML` into `#view-*`): `log` (Workout), `days`, `body`, `coach`, `goals`, `progress` (tab label "Lifts"), `history`, plus `signin`.
- Events: one delegated `click` handler with `switch` on `data-act`, plus delegated `input`/`change`/`submit` handlers.
- Snapshot re-render is skipped while a text input/select is focused (so typing isn't interrupted).

## Features (current)
- **Today tab, workout part (Focus mode; view id `log`):** pick a training day (or free workout). Header shows "N of M done · X min" (`elapsedMin`) + progress bar; an exercise chip row (✓ done / started / not started; tap = jump, any order); one focus card with big ± steppers (`.bigstep`, 2.5 kg / 1 rep), last-session reference, "Add set N", set table (tap to edit, PR badges, Epley e1RM), "Remove exercise"; then "✓ Done" and "Next: <name>" (`nextUnfinished`, wraps); "Workout complete" card when all done. "+ Exercise" / "+ Cardio" open bottom sheets.
  - **Prefill:** set N starts from last session's set N (`prefillFor`); beyond that it repeats today's last set.
  - **Rest timer:** "Add set" starts a countdown in a bar pinned to the bottom (every tab). Rest per exercise is remembered in `settings`; defaults 3:00 big compounds, 2:30 rows/pull-ups/dips/hip thrust/incline/split squat, 1:30 others (`defaultRest`). −15s/+15s/Skip; when over: vibrate + beep + "Go" state for 60 s. No alert while the phone is locked.
  - **Edit sets:** tap a logged set row → steppers load it, "Save set"/Cancel. Saving doesn't restart the timer.
  - **Screen awake:** Wake Lock while on today's workout with ≥1 exercise (`shouldWake`).
- **Exercise info ("!"):** round "!" next to library exercises (Workout rows + open card, Days editor list, suggestion chips) opens a bottom-sheet `<dialog>`: Start/Finish line drawings (inlined SVG; lines = currentColor, white shapes = `.exbg` filled from CSS so they follow the theme), "Works:" muscles, 2–4 tips, credit line. Every exercise has start/finish drawings: Everkinetic (CC BY-SA, credit line shown) or hand-drawn outlined figures (`info.own`, no credit line; lines = currentColor, fills = `.exbg`, strokes = `.exbg-s`). Back gesture closes it (history entry). Drawings are cached by the service worker on first view.
  - Everkinetic pose names are relaxation/tension, not start/finish: exercises that start at the top (squat, bench...) set `"start": "tension"` in exercise-sources.json.
- **Days tab:** templates, rename/reorder/add/remove exercises, muscle focus → exercise suggestions, weekday assignment (tap a weekday in the week strip to put a day on it or make it Rest: `assignWeekday` in plan-tools.js, saved at once; a day can have several weekdays; the "Train on" chips in Edit day do the same; today's day auto-suggested), "Change split" with confirmation, move/delete days. Editing a day syncs into today's workout if it uses that day (`syncTodayWithDay`).
- **Body tab:** latest weight in big numbers + quick weight entry (`withWeight`), profile line, "Add measurements / scan" opens the full entry form (weight, tape measurements, InBody), trend chart per metric, recent entries table.
- **Cardio (Today tab):** "+ Cardio" opens a sheet (inline card under the day picker): type, minutes ±5, intensity, optional machine kcal; logged sessions listed under the buttons. A cardio-only day keeps showing the day picker.
- **Toasts** are a `popover="manual"` element so they show above open sheets (fallback: plain hidden element). `history.scrollRestoration="manual"` because sheets push history entries.
- **Food and energy card (Today tab, under the workout and cardio):** the Today date strip drives it (one date for the whole page); Eaten / Target, Burned (Everyday · Lifting · Cardio), Balance (green when it matches the goal); meals quick add (kcal, optional protein + name chips); protein vs 1.6–2.2 g/kg.
  - Target model: burned = BMR×1.2 + that day's exercise; target = burned + goal adjustment. Estimates use MET−1 (resting part is already in the baseline); machine kcal used as typed. Lifting time = first→last set +2 min, else 2.5 min/set.
  - "Trained" (`trainedOn`) = sets or cardio, except training-day rotation (sets only).
- **Goals tab:** level (XP: trained day 50, cardio 10+1/5min ≤30, meals day 10, PR 20, badge 100; level L at 50·L·(L−1)), target-weight card (calorie bank at 7,700 kcal/kg over days with meals + weight bar + finish estimate from last 14 logged days), streaks (weekly training Sat–Fri with target 2–6 from training days; daily food), 24 badges. All derived from data; badge toasts once via `settings.seenBadges`, only after a server (non-cache) snapshot; first run marks existing badges silently.
- **Coach tab:** Today card, then Tips (top 3 by `sortTips`, "Show all tips"), then "More from Coach" (sets per muscle + written review). Rule-based insights (weight-trend vs goal pace, body fat range by sex, visceral fat ≥10, muscle/fat change between scans, waist-to-height, weekly sets per muscle vs 10–20, stalled/progressing lifts). "Copy my summary" copies a coaching prompt + JSON data to paste into an AI chat (no API key in the app, to stay free).
- **Less crowded (sw v34):** Today's Food and energy card is compact (Eaten / target + bar, "Burned · Balance", "+ Add meal"); the meal form lives in `#mealsheet` (`mealSheetHtml`, draft in `state.mealDraft`, same sheet/Back machinery as `#exsheet`/`#cardiosheet`). With no workout open Today shows one "+ Cardio" row (`cardioRowHtml`) and the form is only in `#cardiosheet`. The level hero has no "Next badge" line; tapping it opens the closest badge family. Goals shows one badge family tile plus "Show all". Body entries, Lifts sessions and History list 5 rows with "Show all (N)" (`moreList(items,key)`, open state `state.showMore[key]`, session only; `more-list` action). Friends: avatars (`initialsOf`/`avatarHue` in ui-helpers.js), "Who's ahead this week" strip (`rankWeek` in friends.js), requests as a highlighted banner, Sent + Blocked behind "Manage", "Invite a friend" card when there are no friends.
- **Overview, leaderboard, calmer Plan (sw v35):** Progress opens on **Overview** (first pill): headline stats + weight trend, training per week (8 bars + target), calories vs target (7 days) and strength cards, each with a tap-through; series from `overview.js` cached per `state.dataRev`. Friends starts with a leaderboard (`boardHtml`, `rankBoard` in friends.js): This week / This month / Level switch (`ironlog.board`), a podium with a crown on first place (`podiumMarkup`, shared with Challenges), then ranked rows. Plan: a slim gym banner, one **Edit plan** button opening `#plansheet` (Plan my training, Add a day, Change split) and one tap target per day card (`.daysum`).
- **Challenges (Friends › Challenges):** consistency challenge between friends. New challenge: 1/2/4 weeks, start Today or Next Saturday, invite 1–5 accepted friends. Invitations (Accept/Decline), Active, Finished; the challenge page shows a live leaderboard (`rankMembers`, ties share a rank, invited-only people last, bars, winners when finished) and "Scores are self-reported". A training day = `trainedOn(workout)`. `publishProgress` writes my day count (`countDays` inside the dates) to `challenges/{cid}/progress/{me}` after a server snapshot, when it changed, at most every 20 s, until the day after the end. Leave = delete my score then remove me; owner Delete = every score then the challenge. Max 5 unfinished challenges per person (client). Dot/count on More for waiting invitations. Delete my account has a "challenges" step.
- **Updates and type-ahead (sw v27):** an open app reloads itself once when a new service worker takes over (`controllerchange`; waits while typing, in a sheet or in the journey) and checks for updates when it returns to the front. The "type any exercise" suggestions (Add exercise sheet and the day editor) only offer exercises of the day's muscles (`typeaheadNames({focus})`; no focus = everything). Marking an exercise done stops its rest timer.
- **Policy, delete, report:** sign-in screen and the Me page link to `/privacy.html` and `/terms.html` (new tab). Me › Delete my account opens the `delete` view (tab bar hidden, never restored as last view): Download backup, then Delete everything → confirm → `store.wipeAccount(onStep)` runs `wipePlan()` in order: re-authenticate with Google (cancel = nothing deleted), shared profile + username (+ e-mail doc), friendships, blocks, every `users/{uid}/items` doc (batches of 450 via `chunk`), then this device (listeners stopped, `ironlog.*` localStorage cleared, Firestore terminated + persistence cleared), then `deleteUser` last; success reloads with a one-time "Your account and data were deleted." note on the sign-in screen (`sessionStorage ironlog.deleted`). A failure stops the run (steps are safe to repeat); at the device/account steps the view offers Reload. Report a user: **Report** on the friend page and search cards opens an inline panel (four reasons) that writes `reports/{me}_{them}` via `store.sendReport`, then offers Block.
- **Plan my training (journey):** full-screen `journey` view (tab bar hidden, history entry): goal → split (Full Body 2–3 days, Upper/Lower 2/4/6, Push/Pull/Legs 3/6, Bro Split 5, or "Not sure, suggest one" = automatic by days; `SPLIT_FAMILIES`, `splitFor`) → days per week (only what the split supports; 2–6 for automatic) → gym (presets plus the full equipment checklist, or "Not sure, suggest everything") → experience → About you (only when sex/height/birth year are missing, skippable) → preview of the week with a split picker (two splits per days-per-week via `splitOptions`; 5 days offers Bro Split, 6 days Upper/Lower ×3) → Start. Start writes `saveDays` (new ids), `saveProfile(mergeProfile(...))` and, only when the equipment was ticked or a preset picked, `saveSettings({gym})`; workout history is never touched; double taps are ignored (`state.journey.busy`). Opens automatically once per session for a signed-in person whose server-synced data has no days and no workouts and who has not skipped on this device (`localStorage ironlog.journey = "skip"`); anywhere else via the card on the Today tab (no days) and the Plan › Days button/empty state. Skip/back never save. `journey` is never restored as the last view.
- **My Gym (Plan › My Gym):** presets (Bodyweight only, Home, Basic gym, Full gym) + a grouped checklist of the 39 equipment items; counts line "N of 39 items · M exercises available"; "Clear my gym" (with a Keep/Clear confirmation) removes the setting; a status line shows Saving…/Saved ✓ and Done saves at once and returns to More. Stored as `settings.gym` (absent = not set, no filtering; `[]` = bodyweight only). Taps apply at once (`setGym`, draft in `state.gymEdit` so a snapshot can't undo them) and save after 600 ms. The filter (`activeGym()`, session switch `state.showAllGym`) applies to `suggestionsFor` (Days editor + Exercise sheet), the type-ahead list and Coach's low-muscle suggestions, with a "Hiding N exercises ..." line + Show all (`gymNote`). Never filtered: exercises already in days/history, templates, Lifts. Days tab shows a dismissible hint card until the gym is set (`localStorage ironlog.gymHint`). The settings document is always written with `settingsDoc()` (ui-helpers.js), also by backup export; `cleanBackupItems` needs the `equipment` ids option.
- **Friends screen (Friends tab):** Find a friend (its own section, `find`), Requests (Accept/Decline/Block), Friends (tap → friend page: their summary next to yours, leader marked ✓, Remove/Block with inline confirm), Sent (Cancel), Blocked (Unblock). Live `onSnapshot` on `friendships` and `blocks` (`store.watchFriends`); friends' profiles are fetched on open/Refresh (`state.friends.data`). Dot on the More tab + count on the More row for waiting requests. Writes go through `store.friendAction(plan)` (one batch); offline and every failure show the same messages. Caps 100 friends / 30 sent (client only). `refreshFriendNames` updates my name in my friendship docs once per session.
- **Lifts tab:** per-exercise e1RM + top-set chart (hand-written SVG `lineChart()`), stats, session table.
- **History tab:** workouts list (tap to edit, delete with inline confirm), **Backup** (download JSON / restore from file, reminder when last backup > 30 days, stored in localStorage `ironlog.lastBackup`).
- Offline: Firestore cache + service worker. Status text in header ("Synced", "Offline · saving on this phone"...).

## Language (English / Arabic)
- Switch: Me › Appearance › Language. First run follows the phone (`navigator.language` starts with `ar`). `applyLang` sets `<html lang dir>`, runs `trDom`, redraws.
- **English text is the key.** Plain labels in HTML/templates need no code: `trDom` swaps any text node / `aria-label` / `placeholder` / `title` that exactly matches an `AR.ui` key (a MutationObserver does it for everything drawn later). Text with numbers or names uses `t("{n} of {m} done",{n,m})` / `tn("{n} set","{n} sets",n)`; never glue strings (`"Add "+name`, `\`${n} sets\``). Toast/setSync/insight messages must go through `t()`.
- Add a string: write the English in the code, run `npm test`, add the Arabic to `public/lang-ar.js` (`tests/lang-coverage.test.js` lists what is missing; it also fails on glued text). Keep `{placeholders}` identical.
- Library things are translated at display time with `nameOf(kind, name)`; stored data (Firestore, backups, `dayName`, cardio `type`) stays English. Adding an exercise/muscle/badge/template without an Arabic name fails the tests. Exercise tips: `ar.tips` in `tools/exercise-sources.json`.
- Local variables named `t` shadow the imported `t()`: rename them before wrapping strings in that scope.
- Arabic = simple Modern Standard Arabic, digits 0-9 (`toLocaleString("en-US")`, dates via `locale()` = `ar-EG-u-nu-latn`), units stay Latin (kg, cm, kcal, g, min). `trDom` wraps numbers/ranges/units in LTR isolates so "138–189 g" keeps its order. "Copy my summary" stays English (`withLang("en", …)`).
- RTL: CSS uses logical properties (`margin-inline-start`, `inset-inline-end`, `text-align:start`); steppers, charts and numeric inputs stay LTR; chevrons flip; font IBM Plex Sans Arabic. Known limits: the browser's own date picker shows its own digits, and the header sync text keeps its language until the next sync event.

## Accent colours
- Me › Appearance › Accent: 8 presets (plate blue default, teal, green, orange, red, pink, purple, gold) + a custom colour (`<input type=color>`). Stored per device in `ironlog.accent` (preset id or `#rrggbb`; anything invalid = plate blue).
- `deriveAccent` turns the one colour into `--accent`, `--accent-ink` (white or near-black, ≥ 4.5:1) and `--accent-soft` for light and dark, moving lightness until the accent has ≥ 4.5:1 against surface and bg (so a light gold becomes brown in light mode). Plate blue returns the original tokens exactly and sets nothing.
- `applyAccent` sets the three custom properties inline on `<html>`; the computed values for both modes are cached in `ironlog.accent.css` so the `<head>` script can paint the right colour on first load. Re-applied on theme change and when the phone switches dark/light.
- Never hardcode blue in UI CSS/SVG: use `var(--accent)` etc. (the logo/icons stay blue). `--good`/`--danger` never change with the accent.

## Redesign (sw v26): five tabs, "Bold Block", levelling badges
- **Look:** page background = a gradient mixed from the accent (`--bg-grad`, `color-mix` over `--accent`, light and dark, so any accent works); cards white / lifted dark; dark "hero" blocks with the level ring (`.hero`, `.ring`); floating dark tab bar (`--bar`); section pills (`.pill`); line icons from the sprite (`svg.i`, symbols `#i-today #i-plan #i-progress #i-friends #i-me #i-flame #i-trophy ...` generated from `ICONS` in badge-art.js). Reward colours (`--gold --silver --bronze`, star `--star`) never follow the accent.
- **Badges level up:** Goals shows a wall of 9 family tiles (`familyTile`: icon, tier colour, stars = levels, "Level a of b", progress to the next level); tapping opens `#familysheet` with the ladder. Today shows the level hero with the closest badge. The 24 badges, XP, `seenBadges`, the shared summary and challenge scores are unchanged.
- **Celebration cards:** `#celebrate` dialog + queue (`showCelebrations`), confetti canvas (skipped for reduced motion). Triggers: new badge and level-up (inside `checkBadges`, server snapshots only; first run is silent; last level in localStorage `ironlog.level`) and a challenge win (when you open the finished challenge, remembered in `ironlog.seenWins`).
- **Native feel (sw v31):** Back from any tab returns to Today first (one `history.pushState({tab:1})` when leaving Today, `tabEntry` in `go()`; Today never pushes), then leaves the app. Touch polish: `touch-action:manipulation`, no tap highlight, no text selection or long-press callout on controls, `overscroll-behavior-y:contain`. Targets are at least 44px (48px steppers) and no text is under 12px (tests-ui checks both).
- **Swipe (sw v29):** a left/right swipe moves between the five tabs (`swipeDirection` in nav.js; mirrored in Arabic), opening the section last used in that tab, with a short slide-in. Ignored on inputs/steppers and anything that scrolls sideways, while a dialog is open, on the journey/delete screens, near the screen edges (Android back gesture) and for mostly vertical moves. **All badges:** Goals has a "Show all 24 badges" button (`state.goalsAll`, `renderAllBadges`) listing every badge per family with earned date or progress.
- **Challenge page:** podium for the top 3 (2-1-3, crown on rank 1, ties share a step), the rest as rows, a gold winner banner when finished.
- Friend page: two level cards (you and them) above the comparison table.

## Design rules in use
- "Clean plate" style: CSS tokens on `:root` with dark-mode overrides (`prefers-color-scheme` + `[data-theme]`): `--bg/--surface/--sunk/--line`, `--shadow`, `--card-border`, `--r-card` 18px, `--r-btn` 14px, `--tabbar` 64px. Accent plate-blue `#1f5fd1` (light) / `#6c9cff` (dark). Building blocks: `.card`, `.btn.primary/.secondary`, `.bigstep`, `.chip`, `.exchip`, `.ebar`, `dialog.sheet`. Icons: inline `<symbol>` sprite (`#i-workout`, `#i-coach`, `#i-body`, `#i-goals`, `#i-more`, `#i-chev`).
- Mobile-first, max-width 640px, safe-area insets respected, no horizontal scroll.
- Logo: blue rounded square, white loaded barbell with a rising trend arrow above it; wordmark "IRON LOG" in Barlow Condensed 800.
- Copy style: plain, direct, short; units kg and cm.

## How a sub-project is built here
Brainstorm in chat (one question at a time) → spec in `docs/superpowers/specs/` → plan in `docs/superpowers/plans/` → execute on a branch, test-first, one commit per task → one opus whole-branch review → fix pass (each fix RED→GREEN) → the owner approves the deploy explicitly → deploy (rules first when they changed, then hosting) → verify live → merge `--ff-only`, push, delete the branch. Dev tools: `npm test` (unit), `cd tests-rules && npm install && npm test` (rules emulator, needs Java 21; JDK at `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot\bin`), `tools/screenshot-harness/` (the real page with stubbed Firebase, screenshots and write logs: see its README).

## Deploy / workflow
```
git pull                                  # always before editing
# edit files; bump VERSION in public/sw.js (and add any new public/*.js to APP_SHELL)
npm test                                  # unit tests (also runs automatically before `firebase deploy`, via predeploy)
git add . && git commit -m "..." && git push
firebase deploy --only hosting            # rules: firebase deploy --only firestore:rules (run tests-rules first; deploy rules BEFORE hosting when both change)
```
- Windows: if PowerShell blocks npm/firebase scripts, use Command Prompt or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- Can't test by opening index.html from disk (module + auth need http). Use the deployed URL or `firebase serve` (http://localhost:5000).

## Gotchas already hit
- App left open past midnight: `checkNewDay()` (visibilitychange + every 60 s) moves the Workout/Body date to the new day via `rolloverDate`, unless the user picked another date.
- Snapshots arriving while typing are deferred (`renderSoon`) and redrawn 400 ms after the field loses focus, so taps aren't swallowed.
- Restore never trusts the file: `cleanBackupItems` skips bad items/fields.
- Pasting Firebase's config snippet dropped `export`, which broke the app (stuck on "Loading…"). Keep `export const firebaseConfig`.
- Phones keep old files until `sw.js` VERSION changes.
- Home-screen icon may stay old until the app is removed and re-added.

## Later (big, parked by the owner): built-in Egyptian food table. Everything else that is open: docs/open-points.md
Food logging today = manual kcal (+ optional protein/name) per meal (`f-YYYY-MM-DD`: `meals:[{id,name,kcal,protein}]`, Coach › Today card, `mealDraft`). Goal: pick a food (aish baladi, koshari, ful, taameya, feteer, molokhia, shawarma, sandwiches, snacks...) and get kcal/protein for a typical serving ("1 piece", "1 plate", grams) without knowing the numbers. **Decision:** a curated table bundled in the app (a few hundred Egyptian + everyday foods, Arabic + English names, search in both, per-100 g plus typical servings), NOT a live API. Research (2026-10-19): Open Food Facts is patchy for Egyptian dishes and its name search has no CORS; USDA FoodData Central is public domain with good generic foods but needs a key visible in the client (1,000 req/h per IP) and has no koshari/baklava; fatsecret/Edamam need secret keys; the real Egyptian source is the Nutrition Institute 1996 table (FAO INFOODS page). So: build from that table + recipes + USDA public-domain values; barcode lookup (Open Food Facts barcode API has CORS) could come later. Fit with the rest: a new pure module (`food-table.js`, unit-tested: search, portions, kcal scaling), a picker in the Coach Today card feeding the existing meal model (keep `name`/`kcal`/`protein` so Coach, XP, badges, summary and backups keep working), Arabic names via the i18n layer (`nameOf`-style, tests for missing Arabic), `APP_SHELL` + sw bump, backup unchanged (meals stay plain), and numbers shown as estimates with an editable portion.

## Ideas not built yet
- Bodyweight-exercise mode; set types (warm-up / drop set)
- Done so far (sub-projects 1-16, see docs/README.md; the list below is only what is left): faster logging, exercise info, full-app review, smarter coaching/progress, look & feel, Arabic, accent colours, exercise library, profiles/privacy/search, friends, My Gym, personal journey): challenges; next: built-in Egyptian food table; ready for more users: reporting, terms/privacy
- Per-day target sets/reps in templates
- CSV export for spreadsheets
- GitHub Actions auto-deploy (`firebase init hosting:github`), offered but not set up

## Exercise library (183 exercises with equipment)
- `EXERCISES` in `public/exercise-library.js`: `[name, ...equipment ids]` per muscle group (popular first). `eq` lists EVERYTHING the exercise needs (none = bodyweight); `equipmentOf(name)`, `exercisesFor(gym)` (names whose every item is in the gym) feed the My Gym setting. Custom (typed) exercises have no equipment and are never filtered out. My Gym helpers: `GYM_PRESETS` (bodyweight ⊂ home ⊂ basic ⊂ full), `gymFilter(names, gym)` (gym not an array = keep all), `gymCounts(gym)`, `sameGym(a, b)`, `hiddenCount(lists, gym)`.
- 39 equipment ids in `EQUIPMENT` (weights / station / machine groups), each with an English name and `AR.names.equipment`. Machines are separate items (`pec-deck`, `leg-press`, `seated-leg-curl`, ...). Tests: name words agree with equipment (Smith/Cable/Dumbbell/Barbell...), every equipment id is used, names unique.
- Exercises that differ only by equipment are separate entries (Lateral Raise / Cable Lateral Raise / Machine Lateral Raise). There are no aliases left; `ALIASES` and `resolveAlias` stay for future merges (own-key lookups, so a custom name like "constructor" is safe).
- Add an exercise: `EXERCISES` row, `tools/exercise-sources.json` entry (muscles, 2-4 tips ≤ 60 chars, `ar.tips` same count ≤ 80 chars, drawing source), `AR.names.ex`, then `node tools/import-exercises.mjs` (writes drawings + `exercise-info.js`); `npm test` lists anything missing. Drawing source: `"ek"` (find with `tools/find-drawing.mjs`; only if files exist), `"draw": true` (code in `tools/draw-exercises.mjs`), or `"drawing": "<other exercise>"` (reuse; no chains). Today: 104 Everkinetic, 36 hand-drawn, 43 reused.
- The importer skips drawing files that already exist: after changing `start` for an `ek` exercise, delete its two SVGs (or run `--force`).
- Suggestion lists show 6 per muscle with "Show more (N)" (`chipRow`, open state in `state.showAllEx`); the info sheet shows an "Equipment:" line.
