# Open points (as of 2026-10-19, app at sw v26, redesign live)

Everything planned in sub-projects 1-16 (the redesign, sw v26) is shipped. This is what is still open, collected from every review ("deferred minors"), the specs' non-goals and the owner's ideas. Nothing here blocks normal use. The built-in Egyptian food table is a big separate project and is parked for later (see CLAUDE.md "Next step").

**Done 2026-10-23:** Android APK (TWA); less-crowded Today/Progress/Friends (v34); Progress Overview, Friends leaderboard, calmer Plan page and the Challenges look (v35). The owner tested v35 on a phone and approved. **Still open:** Google Play (optional), the deferred minors below, and the parked Egyptian food table.

## Unfinished projects (the big ones, none started)
1. ~~**Built-in Egyptian + everyday food table**~~ **Built (sub-project 19, 2026-10-24):** 297 foods, meal builder, My foods, recents, edit a saved meal and barcode scan. Waiting for the owner's phone check (including a real camera scan) and the deploy.
- ~~Calorie target explainer~~ **Built (sub-project 20, sw v43):** the "How is this built?" sheet on Today, everyday activity level and own daily adjustment.
2. **Training depth:** ~~target sets/reps, progression, warm-up/drop set types~~ **built (sub-project 21, sw v44)**. Bodyweight mode **built (sub-project 22, sw v45)**. Still open: injuries / exercises to avoid, several gyms (Home + Gym), templates adapted to the gym, per-day targets, deloads.
3. **Social growth:** more challenge types (volume, PRs, streaks), rematch, chat/activity feed, notifications (need the paid plan or an alternative).
4. **Running it for many users:** abuse protection (App Check / rate limits), quota monitoring, a report admin screen or e-mail, auto-deploy from GitHub, running rules tests and screenshot checks automatically.
5. **Data and codebase:** CSV export; splitting the single 2,350-line `index.html` into modules.
In progress now: the owner is testing the later features on a real phone; expect a bug-fix batch from that.

## A. Needs the owner (not code)
1. ~~**Read `public/privacy.html` and `public/terms.html`.**~~ **Done (owner read both, 2026-10-23).** They are plain-language drafts, not legal advice; a legal review (GDPR, Egypt's data protection law) is still optional. `terms.html` does not mention challenges (the privacy policy does).
2. **Try the later features on real phones** (journey, friends, challenges, My Gym, delete my account on a throwaway Google account, Arabic/RTL). Most of this was checked only in a headless browser with stubbed Firebase and the rules emulator.
3. **Read reports** in the Firebase console (Firestore › `reports`). There is no admin screen and no notification. Names on a report are free text: check them by hand.
4. **Decide on abuse protection:** App Check / rate limiting is not set up. Each user can still write many documents within the free quota (20k writes/day shared by everyone).
5. **Watch the free plan quota** as people join (writes, reads, hosting). Publishers add writes: the summary and each challenge score.

## B. Small known issues (deferred minors)
**Profiles and search**
- Changing the Google e-mail leaves the old e-mail lookup document.

**Friends**
- A hand-made client can befriend someone it blocked (the app does not offer it); a friend who deletes their profile leaves a stale `@name`.

**My Gym**
- The My Gym screen can redraw under a finger while tapping (values stay correct).
- An Add exercise sheet left open over another tab can go stale after another device changes the gym.
- Settings are one document: the last write wins between devices.

**Personal journey**
- Vertical pulls and rows are not separate slots (Upper A can get Pull-up + Lat Pulldown); Pull-up is the first Back pick for beginners.
- Bodyweight-only gyms get very short, repeated days (the library has few bodyweight back/shoulder/biceps exercises).
- The automatic journey can leave a stale back-button entry when the app opened it automatically; the skip flag is per device; focus does not move to the step heading and the dots have no "Step n of m"; a few Arabic phrases could read better.

**Readiness (delete / report)**
- No redirect fallback for re-authentication: iOS home-screen apps with popups blocked cannot delete in-app (they see a "browser blocked" message).
- The Delete button does not re-enable/disable when the connection changes without a redraw.
- After a report, Block is offered only for friends and pending requests.

**Challenges**
- Two invitees accepting at the same instant can make one see "Couldn't save" (whole-array writes; `arrayUnion`/`arrayRemove` would avoid it).
- The owner's `names` map can carry odd labels for friends (display only).

**Redesign (sw v26)**
- The level card on Goals is a button that goes to Goals; it has an aria-label that hides its text from screen readers and a block element inside a button.
- The celebration card has no history entry (the Android back gesture leaves the app).
- A report started on a friend page also shows in the Find section.
- `levelHero()` recomputes badges and XP on every Today redraw (could be cached on `state.dataRev`); `header`/`body::before` have no fallback for browsers without `color-mix` (before 2023); `background-attachment:fixed` and the header blur cost on phones; tapping the current tab only scrolls to the top.
- The tile aria-label joins name and level with a Latin comma (Arabic). `FULLSCREEN` in nav.js is only used by its test.
- Not checked on a real phone: 320 px width in Arabic (five tab labels), tab bar + rest bar + toast over safe-area insets, confetti frame rate.

**Food table and barcode (sub-project 19)**
- The food figures are estimates written from recipes and USDA values; the owner reviews `public/food-table.js` (the 74 `varies:true` dishes first). Open Food Facts data is user-edited and patchy for Egyptian products; implausible values are treated as "no calories on record".
- My foods are one document (`foods`, max 200): two devices editing at once means the last write wins (same as `settings`).
- The live camera path (BarcodeDetector on Android, the ZXing loop elsewhere) is only proven on a real phone; the tests use Chrome's fake camera and a generated EAN-13 picture.
- The meal name is stored in the language it was saved in.

**Across the app:** writes on a connection that looks online but is dead can hang without a message (timeouts exist only for delete and report).

## B3. Small-fixes batch (v42, 2026-10-24)
Fixed: scanned-food edit keeps its other servings; zero-calorie meals (water) save, a blank typed meal says so; camera requests no longer overlap; UPC-A and EAN-13 (and UPC-E) are one product (`canonicalBarcode`); a non-JSON Open Food Facts answer is a failed lookup, repeated failure toasts are muted for 15 s; a tray with over 500 g protein is refused; the edit sheet shows the meal name in the app language; a deleted My food's serving shows its weight; a failed profile load is retried before saving; deleting a shared profile works when the username/e-mail doc is already gone (rules); display names are cleaned (`cleanDisplayName`); a request that crosses an incoming one becomes an accept; friend-profile fetches are de-duplicated and dropped after sign-out; lookups and profile saves have timeouts; a backup with unknown gym ids leaves the gym unset; expired challenge invitations can be removed; wording, dead code, celebration card (alertdialog, backdrop close, queue cleared on sign-out) and pill focus. Already fine when checked: the Saturday summary refresh (`checkNewDay` calls `maybePublish`) and `firestore-debug.log` (ignored by `*-debug.log`).

## B2. Review cleanups (done in v36, 2026-10-24)
Fixed: stale history entry after Plan my training from the Edit plan menu; chart text now about 12px (viewBox close to the rendered width); Arabic dual (`tn` looks for `<other>#2`); the Friends podium waits for friends' data (`boardReady`); level hero label says it opens badges; `showMore` reset on sign-out; avatar on the Find result; Overview weight stat uses the latest weigh-in at any age; week labels are direction-safe. Kept on purpose: Block stays on request rows.

## C. Ideas not built
- **Training:** bodyweight-exercise mode; per-day targets; deloads and RPE; injuries / exercises to avoid; cardio scheduling; templates adapted to the gym; several gyms (Home + Gym).
- **Food:** more foods (the table has 297; the owner can ask for more), meal templates ("my usual breakfast", easy now that saved meals keep their items), allergens / full nutrition from barcode data, macros beyond kcal and protein, shared foods.
- **Social:** other challenge metrics (volume, PRs, streak weeks), rematch in one tap, owner removing a member, chat, an activity feed, server-side friend limits, cooldown after a decline, notifications (need the paid plan).
- **Data and tooling:** CSV export; GitHub Actions auto-deploy (`firebase init hosting:github`); running the rules tests and screenshot checks in CI; an admin screen or e-mail for reports (needs the paid plan or manual work).

## D. Technical hygiene
- `public/index.html` is ~2,350 lines in one file; fine today, but splitting the screens into modules would make future work safer.
- The rules emulator tests need Java 21 and are not run by `npm test` or `firebase deploy`: run them by hand before deploying rules.
- Accessibility basics beyond the checks done so far (focus management between steps, screen-reader labels for charts and bars).


# latest session resume 
- 'claude --resume 8ef26a81-34e5-4f64-858f-e20768fc4575'