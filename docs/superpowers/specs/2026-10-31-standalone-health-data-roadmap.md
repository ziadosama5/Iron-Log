# Roadmap after workout screen 2.0: standalone APK, Health Connect, data layer (decisions 2026-10-31)

Recorded from the owner's answers. Each step gets its own brainstorm, spec, plan and final review, in this order. Steps 26-28 are outlines, not specs.

**Order:** 25 Workout screen 2.0 + Carbon/Bloom looks (spec written) → 26 Standalone APK → 27 Health Connect → 28 Data layer and read reduction → then the old list (meal templates, challenge types, CSV, Play pack, V2 flows).

**Standing rules from the owner**
- The live app (https://gym-logger-85d4c.web.app) is not disturbed: all work stays on branches, nothing is deployed until the owner calls a build bug-free.
- No pay-as-you-go: the owner does not want a billing account because of attack risk. Stay on the Firebase free plan (Spark cannot be billed; at its limit the app only pauses until the next day).
- Current users' data must be kept in any future change.

## 25b. Exercise library expansion (spec 2026-11-01-library-expansion-design.md)
All 1,129 new dataset exercises with exact GIFs, Arabic names, joint tags, search. Built before the APK because the APK bundles the GIFs.

## 25c. Looks 2.0: real layouts (not started; the owner asked for it on 2026-11-01)
Today Carbon and Bloom only restyle (tokens, fonts, a few shapes); the screens keep the old layout. Goal: the layouts of the design-canvas boards (https://claude.ai/artifact/35ekGA7CkuEcnEQAtKJbDL): Carbon = a glanceable workout card with big weight/rep numbers and one large "Log set" button, flat full-width bar; Bloom = soft cards, floating bar, rounded rows; the new Today with level ring and watch card; all five tabs and the sheets. Needs its own brainstorm (which screens first, what changes per look, whether the two looks share one layout with different skins or have different layouts) and spec before any code.

## 26. Standalone APK (Capacitor)
- Replace the thin TWA with a Capacitor app (package `app.ironlog`, same signing key `C:/Android/keys/ironlog.keystore`) that carries the web code and the ~183 exercise GIFs inside the APK, so the app and every demo work offline from the first launch.
- Native Google sign-in (the WebView cannot use the popup flow): a Capacitor Firebase Auth plugin, then `signInWithCredential` on the web SDK. Firestore keeps its offline cache.
- **Updates change:** a hosting deploy no longer updates the APK. Web users still update on deploy. Plan for the spec: an in-app "New version available" notice from a small `version.json` on hosting with a link to the GitHub Release, versionCode bumps, optionally a live-update service later. Decide how the bundled code and the hosted code stay one codebase (one `public/` folder copied into the APK at build time).
- Distribution: GitHub Release asset `iron-log.apk` first (as now), Google Play later (AAB, assetlinks/Play signing, Data safety, account-deletion page).
- `DEMO_BASE` in `exercise-gifs.js` points at the bundled folder (set by the build).

## 27. Health Connect (Android only)
- Capacitor Health plugin (permissions declared in our own manifest, only the data types we use). Needs Android 9+, a privacy policy shown from the permission screen and the Play "Health apps" declaration before a Play release. Update `privacy.html` (EN + AR) and the delete-my-account flow to cover imported data.
- **Data, in the owner's order:** heart rate, steps and calories, sleep. Workouts stay manual: the app shows the heart-rate readings inside a workout's time window (first to last set) as average and maximum; the Today card shows steps, active calories, resting heart rate and last night's sleep. Watch calories sit beside our estimate, the person chooses which to trust (spec decides).
- **Watches:** Samsung (via Samsung Health), Xiaomi (via Mi Fitness; synced over Bluetooth, not live; heart rate is periodic), Kieslect (not confirmed to write to Health Connect: check the Health Connect "App permissions" list on a real phone; if absent they log by hand).
- Imported values are private, derived on the phone, and never part of the shared friends summary unless a later decision says so. Permission asked after the person has seen value, not at first launch.

## 28. Data layer and read reduction
- Put every Firestore call behind one data interface (the `store`), so a later backend move (Supabase or Cloudflare) is a contained job with a one-time export and a match of users by Google e-mail. Today's research: Supabase free = 500 MB, 50,000 monthly users, pauses after a week of inactivity, no offline cache; Cloudflare D1 free = 5 M reads / 100 k writes a day, hard failures past the limit; neither gives Firestore's offline cache, so there is no reason to move yet (3-4 users now).
- Cut reads per app open (listen to the last 90 days of workouts, load older on demand), add a usage trigger (reads above about 60% of the daily 50,000 for a week = revisit), add Firebase App Check (free) against quota-burning abuse.
- No data migration in this step.

## Follow-ups after 28: the openGym feature backlog (owner: muscle map first, then everything openGym has, then our own ideas)
Priority order (value for a gym logger first, then effort; the owner can reorder). Each is its own small sub-project (spec, plan, review). "Have" = Iron Log already does it.
1. **Muscle map:** front and back body figure shaded by work per muscle (week / month / all time), names the muscles not trained, previews what a routine hits while building it, shows what you just trained at the end of a workout. Geometry from MuscleMap (MIT, credit in the notices). A male and a female figure option.
2. **Supersets:** link exercises, log them back to back, rest only after the pair.
3. **Timed holds with a work timer:** plank, wall sit, carries: a count-up/down timer that logs the seconds actually held (we log seconds by hand today).
4. **Effort per set:** optional RIR or RPE column, off by default, never changes progression.
5. **Move a day's workout** to another day without touching the weekly plan.
6. **Choice of progression rule** per routine / exercise (linear, Greyskull LP, double progression, add time) with the "why" line; today only double progression.
7. **Estimated 1RM extras:** the 1RM calculator, "from this set" line, 1RM progress curve (we have per-set e1RM and the Lifts chart).
8. **Year activity heatmap** (GitHub-style, shaded by time trained) on Progress.
9. **Notifications on Android:** rest-timer alert with the app closed and a workout-day reminder (needs the standalone APK).
10. **Imports:** Strong, Hevy and FitNotes CSV (names matched against the library, unknown ones become own exercises). Apple Health weight is iPhone only, so not needed.
11. **Share a plan** as a small file or a printable PDF (routines and schedule only).
12. **Bigger exercise library:** the dataset has 1,324 exercises with GIFs and instructions against our 183; add them with equipment and joint tags so My Gym and Injuries keep working.
13. **Cardio speed and distance** (we log minutes and intensity).
14. **Plate calculator and per-exercise notes** (on openGym's own wish list).
Already have: body-weight chart and goal, weekly plan, guided workout with rest timer and PR detection, wake lock, equipment filter (My Gym), own exercises, themes and accents, import/export of our JSON backup, languages (English and Arabic). Left out on purpose: passkeys, admin dashboard, 12 languages, the AI Coach (our rule-based Coach stays), iOS.
After this list: meal templates, challenge types and rematch, CSV export, Google Play pack, V2 flows (see `docs/roadmap-v1-features.md`), and our own improvements on top.
